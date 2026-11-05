import { createHash, randomUUID } from "node:crypto";

import {
  STUDIO_CRDT_CONTRACT_ID,
  STUDIO_PUBLISH_CONTRACT_ID,
  STUDIO_REHEARSAL_CONTRACT_ID,
  PUBLICATION_REVIEW_CONTRACT_ID,
  ROLE_PREVIEW_CONTRACT_ID,
  PROJECT_DEMO_CONTRACT_ID,
  canonicalizeJson,
  type JsonObject,
  type JsonValue,
  type StudioCrdtV1,
  type StudioPublishV1,
  type RolePreviewV1,
  type ProjectDemoV1,
  type StudioRehearsalV1,
  type PublicationReviewV1,
  type StudioValidationReportV1
} from "@plenum/event-contracts";
import { validateStudioDraft, type StudioMaterialization } from "@plenum/validation-engine";
import type { Pool, PoolClient } from "pg";
import { audienceAllows, type OrganizationRole } from "@plenum/policy-engine";
import * as Y from "yjs";

import { withOrganizationTransaction } from "../../database.js";
import { authorizationError } from "../../errors.js";
import type { AuthenticatedPrincipal } from "../../identity/login.js";
import type { ObjectStore } from "../../registry/object-store.js";
import { publishReleaseFromFreeze, type PublicationControls } from "../../registry/publication.js";
import { resolveRuntimeInterfaceProfile } from "../../runtime/artifact-workflow.js";
import { rehearseStages } from "@plenum/workflow-engine";

const MAX_UPDATE_BYTES = 256 * 1024;
const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;
const MAX_UPDATES_PER_MINUTE = 120;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface DocumentRow {
  id: string;
  generation: string;
  snapshot: Buffer | null;
  state_vector: Buffer | null;
  materialized_document: JsonObject | null;
  update_count: string;
}

export interface CollaborativeDraftState {
  projectId: string;
  projectTitle: string;
  documentId: string;
  generation: number;
  update: string;
  stateVector: string;
  materialization: JsonObject;
  validation: StudioValidationReportV1;
}

export interface ApplyStudioUpdateInput {
  projectId: string;
  updateId: string;
  connectionId: string;
  expectedGeneration: number;
  update: string;
}

export interface CollaborativePublishInput {
  freezeId?: string;
  releaseLabel: string;
  semanticVersion: string;
  methodologyVersion: string;
  releaseNotes: string;
  warningsAcknowledged: boolean;
  classificationReviewId: string;
  accessibilityReviewStatus: string;
  retentionPolicyId: string;
  approvalNotes: string;
}

export interface RolePreviewInput {
  sessionRoleId: string;
  stageId: string;
  teamId?: string;
}

interface ProjectDemoAccessRow {
  roles: Array<"admin" | "designer" | "publisher" | "reviewer" | "operator" | "research_analyst">;
  reviewer_scope: boolean;
}

const PUBLICATION_POLICY_VERSION = "OPEN-013.v1";

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toYValue(value: JsonValue): unknown {
  if (Array.isArray(value)) {
    const result = new Y.Array<unknown>();
    result.push(value.map(toYValue));
    return result;
  }
  if (typeof value === "object" && value !== null) {
    const result = new Y.Map<unknown>();
    for (const [key, child] of Object.entries(value)) result.set(key, toYValue(child));
    return result;
  }
  return value;
}

function documentFrom(materialization: JsonObject): Y.Doc {
  const document = new Y.Doc();
  const root = document.getMap<unknown>("draft");
  document.transact(() => {
    for (const [key, value] of Object.entries(materialization)) root.set(key, toYValue(value));
  }, "bootstrap");
  return document;
}

function openDocument(row: DocumentRow): Y.Doc {
  if (row.snapshot === null) {
    if (row.materialized_document === null) throw new Error("Collaborative document has no materialization");
    return documentFrom(row.materialized_document);
  }
  const document = new Y.Doc();
  Y.applyUpdate(document, row.snapshot, "database");
  return document;
}

function materialize(document: Y.Doc): JsonObject {
  return document.getMap("draft").toJSON() as JsonObject;
}

function decodeUpdate(value: string, correlationId: string): Uint8Array {
  if (value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    throw authorizationError("VALIDATION_FAILED", "The CRDT update is not valid base64.", correlationId);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPDATE_BYTES) {
    throw authorizationError("TOO_LARGE", "The CRDT update exceeds 256 KiB.", correlationId);
  }
  return bytes;
}

async function requireStudioAccess(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  roles: readonly OrganizationRole[],
  correlationId: string
): Promise<void> {
  if (principal.expiresAt <= new Date()) throw authorizationError("AUTH_EXPIRED", "The Authentication Session has expired.", correlationId);
  const access = await client.query(
    `SELECT 1
       FROM identity.authentication_sessions session
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
      WHERE session.organization_id=$1 AND session.id=$2 AND session.person_id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
        AND membership.organization_role=ANY($4::text[])
      LIMIT 1`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId, roles]
  );
  if (access.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Studio access is no longer active.", correlationId);
}

async function requireProjectDemoAccess(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<void> {
  if (principal.expiresAt <= new Date()) throw authorizationError("AUTH_EXPIRED", "The Authentication Session has expired.", correlationId);
  const access = await client.query<ProjectDemoAccessRow>(
    `SELECT array_agg(DISTINCT membership.organization_role ORDER BY membership.organization_role)::text[] AS roles,
            EXISTS (
              SELECT 1 FROM studio.project_collaborators collaborator
               WHERE collaborator.organization_id=session.organization_id
                 AND collaborator.project_id=$4
                 AND collaborator.person_id=session.person_id
                 AND collaborator.project_role='reviewer'
            ) AS reviewer_scope
       FROM identity.authentication_sessions session
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
      WHERE session.organization_id=$1 AND session.id=$2 AND session.person_id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
      GROUP BY session.organization_id,session.person_id`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId, projectId]
  );
  const row = access.rows[0];
  const organizationAccess = row?.roles.some((role) => role === "admin" || role === "designer") === true;
  const assignedReviewerAccess = row?.roles.includes("reviewer") === true && row.reviewer_scope;
  if (!organizationAccess && !assignedReviewerAccess) {
    throw authorizationError("ACCESS_REVOKED", "Project QA demo access is not available for this Project.", correlationId);
  }
}

async function ensureDocument(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<{ row: DocumentRow; projectTitle: string }> {
  const project = await client.query<{ title: string }>(
    "SELECT title FROM studio.simulation_projects WHERE organization_id=$1 AND id=$2 FOR UPDATE",
    [principal.organizationId, projectId]
  );
  if (project.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Simulation Project was not found.", correlationId);
  const existing = await client.query<DocumentRow>(
    `SELECT id,generation,snapshot,state_vector,materialized_document,update_count
       FROM studio.collaborative_documents
      WHERE organization_id=$1 AND project_id=$2 AND branch_key='main' AND document_key='draft'
      FOR UPDATE`,
    [principal.organizationId, projectId]
  );
  let row = existing.rows[0];
  if (row === undefined) {
    const draft = await client.query<{ document: JsonObject }>(
      "SELECT document FROM studio.drafts WHERE organization_id=$1 AND project_id=$2 FOR UPDATE",
      [principal.organizationId, projectId]
    );
    if (draft.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Draft was not found.", correlationId);
    const document = documentFrom(draft.rows[0].document);
    const snapshot = Y.encodeStateAsUpdate(document);
    const stateVector = Y.encodeStateVector(document);
    const inserted = await client.query<DocumentRow>(
      `INSERT INTO studio.collaborative_documents
         (id,organization_id,project_id,branch_key,document_key,schema_version,snapshot,snapshot_sha256,state_vector,materialized_document)
       VALUES ($1,$2,$3,'main','draft',$4,$5,$6,$7,$8::jsonb)
       RETURNING id,generation,snapshot,state_vector,materialized_document,update_count`,
      [randomUUID(), principal.organizationId, projectId, STUDIO_CRDT_CONTRACT_ID, snapshot, sha256(snapshot), stateVector,
        JSON.stringify(draft.rows[0].document)]
    );
    row = inserted.rows[0];
  }
  if (row === undefined) throw new Error("Collaborative document creation returned no row");
  return { row, projectTitle: project.rows[0].title };
}

function stateFrom(projectId: string, projectTitle: string, row: DocumentRow): CollaborativeDraftState {
  const document = openDocument(row);
  const update = Y.encodeStateAsUpdate(document);
  const stateVector = Y.encodeStateVector(document);
  const materialization = materialize(document);
  return {
    projectId,
    projectTitle,
    documentId: row.id,
    generation: Number(row.generation),
    update: Buffer.from(update).toString("base64"),
    stateVector: Buffer.from(stateVector).toString("base64"),
    materialization,
    validation: validateStudioDraft(materialization)
  };
}

export async function assertStudioSyncAccess(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<void> {
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireStudioAccess(client, principal, ["admin", "designer", "publisher", "reviewer", "operator"], correlationId);
    const project = await client.query("SELECT 1 FROM studio.simulation_projects WHERE organization_id=$1 AND id=$2", [principal.organizationId, projectId]);
    if (project.rowCount !== 1) throw authorizationError("NOT_FOUND", "The Simulation Project was not found.", correlationId);
  });
}

export async function getCollaborativeDraft(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<CollaborativeDraftState> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireStudioAccess(client, principal, ["admin", "designer", "publisher", "reviewer", "operator"], correlationId);
    const { row, projectTitle } = await ensureDocument(client, principal, projectId, correlationId);
    return stateFrom(projectId, projectTitle, row);
  });
}

export async function getRolePreview(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  input: RolePreviewInput,
  correlationId: string
): Promise<RolePreviewV1> {
  const draft = await getCollaborativeDraft(pool, principal, projectId, correlationId);
  const materialization = draft.materialization as unknown as StudioMaterialization;
  const core = materialization.coreDesign;
  const role = core.sessionRoles?.find(({ id }) => id === input.sessionRoleId);
  const stage = core.stages?.find(({ id }) => id === input.stageId);
  const team = input.teamId === undefined ? undefined : core.teams?.find(({ id }) => id === input.teamId);
  if (role === undefined || stage === undefined || (input.teamId !== undefined && team === undefined) ||
      (team !== undefined && role.allowedTeamIds !== undefined && !role.allowedTeamIds.includes(team.id))) {
    throw authorizationError("VALIDATION_FAILED", "Choose a valid Session Role, Stage and eligible Team for preview.", correlationId);
  }
  const profile = resolveRuntimeInterfaceProfile({ coreDesign: core }, role.id, stage.id, correlationId);
  if (profile === undefined) {
    throw authorizationError("REFERENCE_INVALID", "No Interface Profile is available for that Session Role and Stage.", correlationId);
  }
  const content = (materialization.scenario.content ?? []).filter((item) => {
    const policy = core.informationPolicies?.find(({ id }) => id === item.informationPolicyId);
    return policy?.grants.some((grant) => {
      const release = grant.release;
      const released = release === undefined || release.mode === "immediate" ||
        (release.mode === "at_stage" && release.stageId === stage.id);
      return released && audienceAllows({
        organizationId: principal.organizationId,
        activeSessionRoleId: role.id,
        ...(team === undefined ? {} : { activeTeamId: team.id }),
        isControlRole: role.isControlRole,
        organizationRoles: []
      }, grant.audience);
    }) === true;
  }).map(({ id, title, type, body }) => ({ id, title, type, ...(body === undefined ? {} : { body }) }));
  return {
    contractId: ROLE_PREVIEW_CONTRACT_ID,
    projectId,
    sessionRoleId: role.id,
    sessionRoleLabel: role.name,
    stageId: stage.id,
    stageLabel: stage.name,
    teamId: team?.id ?? null,
    teamLabel: team?.name ?? null,
    interfaceProfileId: profile.id,
    layout: profile.layout,
    modules: profile.modules,
    content
  };
}

export async function getProjectDemo(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<ProjectDemoV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireProjectDemoAccess(client, principal, projectId, correlationId);
    const result = await client.query<{ title: string; materialization: JsonObject }>(
      `SELECT project.title,COALESCE(document.materialized_document,draft.document) AS materialization
         FROM studio.simulation_projects project
         JOIN studio.drafts draft
           ON draft.organization_id=project.organization_id AND draft.project_id=project.id
         LEFT JOIN studio.collaborative_documents document
           ON document.organization_id=project.organization_id AND document.project_id=project.id
          AND document.branch_key='main' AND document.document_key='draft'
        WHERE project.organization_id=$1 AND project.id=$2`,
      [principal.organizationId, projectId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Simulation Project Draft was not found.", correlationId);
    return {
      contractId: PROJECT_DEMO_CONTRACT_ID,
      projectId,
      projectTitle: row.title,
      demoSessionId: randomUUID(),
      demoMode: true,
      materialization: row.materialization,
      validation: validateStudioDraft(row.materialization)
    };
  });
}

export async function applyStudioUpdate(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: ApplyStudioUpdateInput,
  correlationId: string
): Promise<CollaborativeDraftState> {
  if (!uuid.test(input.projectId) || !uuid.test(input.updateId) || !uuid.test(input.connectionId) || !Number.isSafeInteger(input.expectedGeneration)) {
    throw authorizationError("VALIDATION_FAILED", "The CRDT update envelope is invalid.", correlationId);
  }
  const bytes = decodeUpdate(input.update, correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireStudioAccess(client, principal, ["designer"], correlationId);
    const { row, projectTitle } = await ensureDocument(client, principal, input.projectId, correlationId);
    const duplicate = await client.query(
      "SELECT 1 FROM studio.document_updates WHERE organization_id=$1 AND document_id=$2 AND update_id=$3",
      [principal.organizationId, row.id, input.updateId]
    );
    if (duplicate.rowCount === 1) return stateFrom(input.projectId, projectTitle, row);
    const rate = await client.query<{ count: string }>(
      `SELECT count(*) AS count FROM studio.document_updates
        WHERE organization_id=$1 AND document_id=$2 AND author_person_id=$3
          AND received_at>transaction_timestamp()-interval '1 minute'`,
      [principal.organizationId, row.id, principal.principalId]
    );
    if (Number(rate.rows[0]?.count) >= MAX_UPDATES_PER_MINUTE) {
      throw authorizationError("CAPABILITY_UNAVAILABLE", "The Studio update rate limit was reached. Retry shortly.", correlationId);
    }
    const document = openDocument(row);
    try {
      Y.applyUpdate(document, bytes, "client");
    } catch {
      throw authorizationError("VALIDATION_FAILED", "The CRDT update cannot be applied.", correlationId);
    }
    const snapshot = Y.encodeStateAsUpdate(document);
    if (snapshot.byteLength > MAX_DOCUMENT_BYTES) throw authorizationError("TOO_LARGE", "The collaborative Draft exceeds 32 MiB.", correlationId);
    const stateVector = Y.encodeStateVector(document);
    const nextMaterialization = materialize(document);
    await client.query(
      `INSERT INTO studio.document_updates
         (id,organization_id,document_id,update_id,author_person_id,client_context,bytes,size_bytes,sha256,generation)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
      [randomUUID(), principal.organizationId, row.id, input.updateId, principal.principalId,
        JSON.stringify({ connectionId: input.connectionId, expectedGeneration: input.expectedGeneration }),
        bytes, bytes.byteLength, sha256(bytes), Number(row.generation)]
    );
    await client.query(
      `UPDATE studio.collaborative_documents
          SET snapshot=$1,snapshot_sha256=$2,state_vector=$3,materialized_document=NULL,
              update_count=update_count+1,updated_at=transaction_timestamp()
        WHERE organization_id=$4 AND id=$5`,
      [snapshot, sha256(snapshot), stateVector, principal.organizationId, row.id]
    );
    await client.query(
      `UPDATE studio.drafts SET document=$1::jsonb,version=version+1,updated_by=$2,updated_at=transaction_timestamp()
        WHERE organization_id=$3 AND project_id=$4`,
      [JSON.stringify(nextMaterialization), principal.principalId, principal.organizationId, input.projectId]
    );
    return stateFrom(input.projectId, projectTitle, { ...row, snapshot: Buffer.from(snapshot), state_vector: Buffer.from(stateVector),
      materialized_document: null, update_count: String(Number(row.update_count) + 1) });
  });
}

interface FreezeResult {
  freezeId: string;
  validation: StudioValidationReportV1;
}

export async function freezeCollaborativeDraft(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<FreezeResult> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireStudioAccess(client, principal, ["publisher"], correlationId);
    const { row } = await ensureDocument(client, principal, projectId, correlationId);
    const document = openDocument(row);
    const materialization = materialize(document);
    const validation = validateStudioDraft(materialization);
    if (!validation.valid) {
      throw authorizationError("VALIDATION_FAILED", "The merged Draft has validation errors.", correlationId, validation as unknown as JsonValue);
    }
    const snapshot = Y.encodeStateAsUpdate(document);
    const stateVector = Y.encodeStateVector(document);
    const materializationSha256 = sha256(canonicalizeJson(materialization));
    const validationReportSha256 = sha256(canonicalizeJson(validation));
    const existing = await client.query<{ id: string; validation_report: StudioValidationReportV1 }>(
      `SELECT id,validation_report FROM studio.publication_freezes
        WHERE organization_id=$1 AND project_id=$2 AND materialization_sha256=$3`,
      [principal.organizationId, projectId, materializationSha256]
    );
    if (existing.rows[0] !== undefined) {
      return { freezeId: existing.rows[0].id, validation: existing.rows[0].validation_report };
    }
    const freezeId = randomUUID();
    const authors = await client.query<{ person_id: string }>(
      `SELECT DISTINCT person_id FROM (
         SELECT project.created_by AS person_id
           FROM studio.simulation_projects project
          WHERE project.organization_id=$1 AND project.id=$2
         UNION
         SELECT draft.updated_by AS person_id
           FROM studio.drafts draft
          WHERE draft.organization_id=$1 AND draft.project_id=$2
         UNION
         SELECT update.author_person_id AS person_id
           FROM studio.document_updates update
          WHERE update.organization_id=$1 AND update.document_id=$3 AND update.generation<=$4
       ) authors ORDER BY person_id`,
      [principal.organizationId, projectId, row.id, Number(row.generation)]
    );
    await client.query(
      `INSERT INTO studio.publication_freezes
         (id,organization_id,project_id,document_id,generation,state_vector,state_vector_sha256,materialization,
          materialization_sha256,validation_report,frozen_update_count,frozen_by,author_person_ids,policy_version,
          validation_report_sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,$12,$13::uuid[],$14,$15)`,
      [freezeId, principal.organizationId, projectId, row.id, Number(row.generation), stateVector, sha256(stateVector),
        JSON.stringify(materialization), materializationSha256, JSON.stringify(validation), Number(row.update_count), principal.principalId,
        authors.rows.map(({ person_id }) => person_id), PUBLICATION_POLICY_VERSION, validationReportSha256]
    );
    await client.query(
      "UPDATE studio.collaborative_documents SET generation=generation+1 WHERE organization_id=$1 AND id=$2",
      [principal.organizationId, row.id]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'studio.draft_frozen',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `publication_freeze:${freezeId}`,
        JSON.stringify({ correlationId, projectId, generation: Number(row.generation), stateVectorSha256: sha256(stateVector),
          artifactDigest: materializationSha256, validationReportDigest: validationReportSha256,
          policyVersion: PUBLICATION_POLICY_VERSION, actorRoles: principal.organizationRoles,
          authorPersonIds: authors.rows.map(({ person_id }) => person_id) })]
    );
    return { freezeId, validation };
  });
}

export interface PublicationReview {
  freezeId: string;
  reviewerPersonId: string;
  decidedAt: string;
}

export async function approvePublicationFreeze(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  freezeId: string,
  notes: string,
  correlationId: string
): Promise<PublicationReview> {
  if (!uuid.test(projectId) || !uuid.test(freezeId) || notes.trim().length === 0 || notes.length > 4_000) {
    throw authorizationError("VALIDATION_FAILED", "A valid Publication Freeze and review notes are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireStudioAccess(client, principal, ["reviewer"], correlationId);
    const freeze = await client.query<{ materialization_sha256: string; validation_report_sha256: string; author_person_ids: string[] }>(
      `SELECT materialization_sha256,validation_report_sha256,author_person_ids
         FROM studio.publication_freezes WHERE organization_id=$1 AND project_id=$2 AND id=$3`,
      [principal.organizationId, projectId, freezeId]
    );
    const frozen = freeze.rows[0];
    if (frozen === undefined) throw authorizationError("NOT_FOUND", "The Publication Freeze was not found.", correlationId);
    if (frozen.author_person_ids.includes(principal.principalId)) {
      throw authorizationError("PERMISSION_DENIED", "An author of this exact frozen revision cannot approve it for production.", correlationId);
    }
    const existing = await client.query<{ notes: string; decided_at: Date }>(
      `SELECT notes,decided_at FROM studio.publication_reviews
        WHERE organization_id=$1 AND freeze_id=$2 AND reviewer_person_id=$3`,
      [principal.organizationId, freezeId, principal.principalId]
    );
    if (existing.rows[0] !== undefined) {
      if (existing.rows[0].notes !== notes.trim()) {
        throw authorizationError("IDEMPOTENCY_COLLISION", "This Reviewer already approved the freeze with different notes.", correlationId);
      }
      return { freezeId, reviewerPersonId: principal.principalId, decidedAt: existing.rows[0].decided_at.toISOString() };
    }
    const decidedAt = new Date();
    await client.query(
      `INSERT INTO studio.publication_reviews
         (id,organization_id,project_id,freeze_id,reviewer_person_id,decision,notes,decided_at,
          artifact_sha256,validation_report_sha256,policy_version,reviewer_roles,evidence)
       VALUES ($1,$2,$3,$4,$5,'approved',$6,$7,$8,$9,$10,$11::text[],$12::jsonb)`,
      [randomUUID(), principal.organizationId, projectId, freezeId, principal.principalId, notes.trim(), decidedAt,
        frozen.materialization_sha256, frozen.validation_report_sha256, PUBLICATION_POLICY_VERSION, principal.organizationRoles,
        JSON.stringify({ correlationId, validationReportSha256: frozen.validation_report_sha256 })]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'studio.publication_approved',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `publication_freeze:${freezeId}`,
        JSON.stringify({ correlationId, projectId, policyVersion: PUBLICATION_POLICY_VERSION,
          artifactDigest: frozen.materialization_sha256, validationReportDigest: frozen.validation_report_sha256,
          roles: principal.organizationRoles, rationale: notes.trim() })]
    );
    return { freezeId, reviewerPersonId: principal.principalId, decidedAt: decidedAt.toISOString() };
  });
}

export async function publishCollaborativeDraft(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  projectId: string,
  input: CollaborativePublishInput,
  correlationId: string,
  now = new Date()
): Promise<StudioPublishV1> {
  if (input.freezeId !== undefined && !uuid.test(input.freezeId)) {
    throw authorizationError("VALIDATION_FAILED", "The Publication Freeze identifier is invalid.", correlationId);
  }
  await withOrganizationTransaction(pool, principal.organizationId, (client) =>
    requireStudioAccess(client, principal, ["publisher"], correlationId));
  const frozen = input.freezeId === undefined
    ? await freezeCollaborativeDraft(pool, principal, projectId, correlationId)
    : { freezeId: input.freezeId, validation: null };
  const approvals = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ reviewer_person_id: string }>(
      `SELECT review.reviewer_person_id
         FROM studio.publication_reviews review
         JOIN identity.memberships membership
           ON membership.organization_id=review.organization_id
          AND membership.person_id=review.reviewer_person_id
          AND membership.organization_role='reviewer'
        WHERE review.organization_id=$1 AND review.project_id=$2 AND review.freeze_id=$3
        ORDER BY review.decided_at,review.id`,
      [principal.organizationId, projectId, frozen.freezeId]
    );
    return result.rows.map(({ reviewer_person_id }) => reviewer_person_id);
  });
  if (approvals.length === 0) {
    throw authorizationError("PERMISSION_DENIED", "A current Reviewer approval is required before Publication.", correlationId,
      { freezeId: frozen.freezeId });
  }
  const controls: PublicationControls = {
    validationReportId: frozen.freezeId,
    validationPassed: true,
    warningsAcknowledged: input.warningsAcknowledged,
    classificationReviewId: input.classificationReviewId,
    accessibilityReviewStatus: input.accessibilityReviewStatus,
    retentionPolicyId: input.retentionPolicyId,
    approvedBy: approvals,
    approvalNotes: input.approvalNotes
  };
  const published = await publishReleaseFromFreeze(pool, store, principal, frozen.freezeId, {
    projectId, releaseLabel: input.releaseLabel, semanticVersion: input.semanticVersion,
    methodologyVersion: input.methodologyVersion, releaseNotes: input.releaseNotes, controls,
    // OPEN-013 separates the approver from the frozen revision's authors, not necessarily from the Publisher.
    policy: { requireDistinctApprover: false, requireTestSession: false, approverOrganizationRole: "reviewer" }, correlationId
  }, now);
  return { contractId: STUDIO_PUBLISH_CONTRACT_ID, freezeId: frozen.freezeId, ...published, saveState: "published" };
}

export async function getPublicationReview(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  correlationId: string
): Promise<PublicationReviewV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireStudioAccess(client, principal, ["designer", "publisher", "reviewer"], correlationId);
    const result = await client.query<{
      id: string; materialization_sha256: string; validation_report_sha256: string; frozen_at: Date;
      frozen_by: string; frozen_by_name: string; author_person_ids: string[]; policy_version: string;
    }>(`SELECT frozen.id,frozen.materialization_sha256,frozen.validation_report_sha256,frozen.frozen_at,
               frozen.frozen_by,person.display_name AS frozen_by_name,frozen.author_person_ids,frozen.policy_version
          FROM studio.publication_freezes AS frozen
          JOIN identity.persons person ON person.id=frozen.frozen_by
         WHERE frozen.organization_id=$1 AND frozen.project_id=$2
         ORDER BY frozen.frozen_at DESC,frozen.id DESC LIMIT 1`, [principal.organizationId, projectId]);
    const row = result.rows[0];
    const approvals = row === undefined ? { rows: [] } : await client.query<{
      reviewer_person_id: string; reviewer_name: string; notes: string; decided_at: Date; artifact_sha256: string; policy_version: string;
    }>(`SELECT review.reviewer_person_id,person.display_name AS reviewer_name,review.notes,review.decided_at,
               review.artifact_sha256,review.policy_version
          FROM studio.publication_reviews review JOIN identity.persons person ON person.id=review.reviewer_person_id
         WHERE review.organization_id=$1 AND review.freeze_id=$2 ORDER BY review.decided_at,review.id`,
      [principal.organizationId, row.id]);
    const [sessions, releases] = await Promise.all([
      client.query<{ id: string; label: string }>(
        "SELECT id,title AS label FROM runtime.sessions WHERE organization_id=$1 AND project_id=$2 ORDER BY updated_at DESC,id",
        [principal.organizationId, projectId]
      ),
      client.query<{ id: string; label: string }>(
        "SELECT id,release_label AS label FROM registry.releases WHERE organization_id=$1 AND project_id=$2 ORDER BY published_at DESC,id",
        [principal.organizationId, projectId]
      )
    ]);
    return {
      contractId: PUBLICATION_REVIEW_CONTRACT_ID, projectId,
      freeze: row === undefined ? null : { id: row.id, artifactDigest: row.materialization_sha256,
        validationReportDigest: row.validation_report_sha256, frozenAt: row.frozen_at.toISOString(),
        frozenBy: { id: row.frozen_by, displayName: row.frozen_by_name }, authorPersonIds: row.author_person_ids,
        policyVersion: row.policy_version },
      approvals: approvals.rows.map((review) => ({ reviewerPersonId: review.reviewer_person_id,
        reviewerDisplayName: review.reviewer_name, rationale: review.notes, decidedAt: review.decided_at.toISOString(),
        artifactDigest: review.artifact_sha256, policyVersion: review.policy_version })),
      permissions: { canFreeze: principal.organizationRoles.includes("publisher"),
        canApprove: principal.organizationRoles.includes("reviewer") && !(row?.author_person_ids ?? []).includes(principal.principalId),
        canPublish: principal.organizationRoles.includes("publisher") },
      liveChangeOptions: { sessions: sessions.rows, releases: releases.rows }
    };
  });
}

export async function rehearseCollaborativeDraft(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  input: { seed: number; startedAt: string },
  correlationId: string
): Promise<StudioRehearsalV1> {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || Number.isNaN(Date.parse(input.startedAt))) {
    throw authorizationError("VALIDATION_FAILED", "A non-negative seed and ISO start time are required.", correlationId);
  }
  const draft = await getCollaborativeDraft(pool, principal, projectId, correlationId);
  const materialization = draft.materialization as unknown as StudioMaterialization;
  const state = Object.fromEntries((materialization.scenario.initialState ?? []).map((item) => [
    item.scopeReference === undefined ? `state.${item.stateVariableId}` : `state.${item.stateVariableId}.team.${item.scopeReference}`,
    item.value
  ]));
  const rehearsal = rehearseStages({ stages: materialization.coreDesign.stages ?? [], facts: state,
    startedAt: input.startedAt, seed: input.seed });
  return { contractId: STUDIO_REHEARSAL_CONTRACT_ID, projectId,
    artifactDigest: sha256(canonicalizeJson(materialization as unknown as JsonValue)), seed: rehearsal.seed, startedAt: rehearsal.startedAt,
    finalStageIds: rehearsal.finalStageIds, trace: rehearsal.trace as StudioRehearsalV1["trace"] };
}

export function studioSyncEnvelope(state: CollaborativeDraftState): StudioCrdtV1 {
  return {
    contractId: STUDIO_CRDT_CONTRACT_ID, type: "sync", documentId: state.documentId,
    generation: state.generation, updateId: null, update: state.update, stateVector: state.stateVector,
    saveState: state.validation.valid ? "synchronized" : "validation_required", unsynchronizedChanges: 0,
    validation: state.validation, message: null
  };
}
