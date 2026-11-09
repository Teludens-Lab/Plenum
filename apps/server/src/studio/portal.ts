import { createHash, randomUUID } from "node:crypto";

import {
  PROJECT_PORTAL_CONTRACT_ID,
  TEMPLATE_LIBRARY_CONTRACT_ID,
  canonicalizeJson,
  type JsonObject,
  type OrganizationMemberV1,
  type ProjectMutationV1,
  type ProjectPortalV1,
  type ProjectSummaryV1,
  type SimulationTemplateSummaryV1,
  type TemplateLibraryV1
} from "@plenum/event-contracts";
import type { OrganizationRole } from "@plenum/policy-engine";
import { verifyReleasePackage } from "@plenum/release-compiler";
import { copySimulationTemplate, type CoreDesignV1, type ScenarioV1 } from "@plenum/simulation-schema";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PORTAL_ROLES: readonly OrganizationRole[] = ["admin", "designer", "publisher", "reviewer"];
const MANAGER_ROLES: readonly OrganizationRole[] = ["admin", "designer"];

export interface ProjectListInput {
  query?: string;
  status?: "active" | "archived" | "all";
  limit?: number;
  cursor?: string;
}

export interface CreateProjectInput {
  requestId: string;
  title: string;
  templateId?: string;
  includeScenario?: boolean;
  sourcePackage?: { bytes: Uint8Array; sha256: string };
}

export interface ProjectLifecycleInput {
  requestId: string;
  expectedVersion: number;
}

export interface PublishTemplateInput {
  title: string;
  summary: string;
  includeScenario: boolean;
  rationale: string;
  supersedesTemplateId?: string;
}

interface ProjectRow {
  id: string;
  title: string;
  lifecycle_status: "active" | "archived";
  version: string;
  owner_id: string;
  owner_name: string;
  source_template_id: string | null;
  source_template_title: string | null;
  release_count: string;
  created_at: Date;
  updated_at: Date;
}

interface PortalAccess {
  roles: OrganizationRole[];
  organizationName: string;
}

function isReviewerOnly(access: PortalAccess): boolean {
  return access.roles.includes("reviewer") && !access.roles.some((role) => role !== "reviewer");
}

function digest(value: JsonObject): string {
  return createHash("sha256").update(canonicalizeJson(value)).digest("hex");
}

function normalizedLimit(value: number | undefined): number {
  if (value === undefined) return 20;
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new Error("limit");
  return value;
}

function encodeCursor(date: Date, id: string): string {
  return Buffer.from(JSON.stringify([date.toISOString(), id]), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined): { date: Date; id: string } | null {
  if (value === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" ||
        typeof parsed[1] !== "string" || !uuid.test(parsed[1])) return null;
    const date = new Date(parsed[0]);
    return Number.isNaN(date.getTime()) ? null : { date, id: parsed[1].toLowerCase() };
  } catch {
    return null;
  }
}

async function requirePortalAccess(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  allowedRoles: readonly OrganizationRole[],
  correlationId: string
): Promise<PortalAccess> {
  const result = await client.query<{ organization_name: string; roles: OrganizationRole[] }>(
    `SELECT organization.name AS organization_name,
            array_agg(membership.organization_role ORDER BY membership.organization_role)::text[] AS roles
       FROM identity.authentication_sessions session
       JOIN identity.organizations organization ON organization.id=session.organization_id
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
      WHERE session.organization_id=$1 AND session.id=$2 AND session.person_id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
      GROUP BY organization.name`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId]
  );
  const row = result.rows[0];
  if (row === undefined || !row.roles.some((role) => allowedRoles.includes(role))) {
    throw authorizationError("ACCESS_REVOKED", "Project access is not available for the current Organization Membership.", correlationId);
  }
  return { roles: row.roles, organizationName: row.organization_name };
}

function blankScenario(id: string): ScenarioV1 {
  return { id, name: "Untitled Scenario", description: "", deliveryModes: [], tags: [] };
}

function blankCoreDesign(): CoreDesignV1 {
  return {
    methodologyConcepts: [], teams: [], sessionRoles: [], seats: [], stageGroups: [], stages: [],
    forms: [], artifactTypes: [], workflows: [], informationPolicies: [], interfaces: [],
    researchQuestions: [], decisionTraceability: [], pluginBindings: [], compositions: [],
    stateVariables: [], capabilities: [], resourceDefinitions: [],
    communications: { messageChannels: [], routes: [], voiceChannels: [] }
  } as unknown as CoreDesignV1;
}

async function collaborators(client: PoolClient, organizationId: string, projectIds: string[]): Promise<Map<string, OrganizationMemberV1[]>> {
  if (projectIds.length === 0) return new Map();
  const result = await client.query<{ project_id: string; person_id: string; display_name: string; roles: string[] }>(
    `SELECT collaborator.project_id,collaborator.person_id,person.display_name,
            array_agg(collaborator.project_role ORDER BY collaborator.project_role)::text[] AS roles
       FROM studio.project_collaborators collaborator
       JOIN identity.persons person ON person.id=collaborator.person_id
      WHERE collaborator.organization_id=$1 AND collaborator.project_id=ANY($2::uuid[])
      GROUP BY collaborator.project_id,collaborator.person_id,person.display_name
      ORDER BY person.display_name,collaborator.person_id`,
    [organizationId, projectIds]
  );
  const grouped = new Map<string, OrganizationMemberV1[]>();
  for (const row of result.rows) {
    const values = grouped.get(row.project_id) ?? [];
    values.push({ id: row.person_id, displayName: row.display_name, roles: row.roles });
    grouped.set(row.project_id, values);
  }
  return grouped;
}

function projectSummary(row: ProjectRow, grouped: Map<string, OrganizationMemberV1[]>): ProjectSummaryV1 {
  return {
    id: row.id,
    title: row.title,
    lifecycleStatus: row.lifecycle_status,
    version: Number(row.version),
    owner: { id: row.owner_id, displayName: row.owner_name },
    collaborators: grouped.get(row.id) ?? [],
    sourceTemplate: row.source_template_id === null ? null : { id: row.source_template_id, title: row.source_template_title ?? "Simulation Template" },
    releaseCount: Number(row.release_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    editorUrl: `/studio/projects/${row.id}`
  };
}

export async function listProjectPortal(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: ProjectListInput,
  correlationId: string
): Promise<ProjectPortalV1> {
  let limit: number;
  try { limit = normalizedLimit(input.limit); } catch {
    throw authorizationError("VALIDATION_FAILED", "Project list limit must be between 1 and 50.", correlationId);
  }
  const query = input.query?.trim();
  if (query !== undefined && query.length > 100) throw authorizationError("VALIDATION_FAILED", "Project search is limited to 100 characters.", correlationId);
  const status = input.status ?? "active";
  if (!["active", "archived", "all"].includes(status)) throw authorizationError("VALIDATION_FAILED", "Project status filter is invalid.", correlationId);
  const cursor = decodeCursor(input.cursor);
  if (input.cursor !== undefined && cursor === null) throw authorizationError("VALIDATION_FAILED", "Project list cursor is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const access = await requirePortalAccess(client, principal, PORTAL_ROLES, correlationId);
    const result = await client.query<ProjectRow>(
      `SELECT project.id,project.title,project.lifecycle_status,project.version,
              owner.id AS owner_id,owner.display_name AS owner_name,
              template.id AS source_template_id,template.title AS source_template_title,
              (SELECT count(*) FROM registry.releases release
                WHERE release.organization_id=project.organization_id AND release.project_id=project.id) AS release_count,
              project.created_at,
              GREATEST(project.updated_at,
                COALESCE((SELECT max(draft.updated_at) FROM studio.drafts draft
                  WHERE draft.organization_id=project.organization_id AND draft.project_id=project.id),project.updated_at),
                COALESCE((SELECT max(document.updated_at) FROM studio.collaborative_documents document
                  WHERE document.organization_id=project.organization_id AND document.project_id=project.id),project.updated_at)) AS updated_at
         FROM studio.simulation_projects project
         JOIN identity.persons owner ON owner.id=project.created_by
         LEFT JOIN studio.simulation_templates template
           ON template.organization_id=project.organization_id AND template.id=project.source_template_id
        WHERE project.organization_id=$1
          AND ($2::text IS NULL OR project.title ILIKE '%' || $2 || '%')
          AND ($3::text IS NULL OR project.lifecycle_status=$3)
          AND (NOT $7::boolean OR EXISTS (
            SELECT 1 FROM studio.project_collaborators reviewer_scope
             WHERE reviewer_scope.organization_id=project.organization_id
               AND reviewer_scope.project_id=project.id
               AND reviewer_scope.person_id=$8
               AND reviewer_scope.project_role='reviewer'))
          AND ($4::timestamptz IS NULL OR
            (GREATEST(project.updated_at,
              COALESCE((SELECT max(draft.updated_at) FROM studio.drafts draft
                WHERE draft.organization_id=project.organization_id AND draft.project_id=project.id),project.updated_at),
              COALESCE((SELECT max(document.updated_at) FROM studio.collaborative_documents document
                WHERE document.organization_id=project.organization_id AND document.project_id=project.id),project.updated_at)),project.id)
              < ($4::timestamptz,$5::uuid))
        ORDER BY updated_at DESC,project.id DESC
        LIMIT $6`,
      [principal.organizationId, query === undefined || query === "" ? null : query,
        status === "all" ? null : status, cursor?.date ?? null, cursor?.id ?? null, limit + 1,
        isReviewerOnly(access), principal.principalId]
    );
    const visible = result.rows.slice(0, limit);
    const grouped = await collaborators(client, principal.organizationId, visible.map(({ id }) => id));
    let members: OrganizationMemberV1[] | undefined;
    const canViewMembers = access.roles.includes("admin");
    if (canViewMembers) {
      members = (await client.query<{ person_id: string; display_name: string; roles: string[] }>(
        `SELECT membership.person_id,person.display_name,
                array_agg(membership.organization_role ORDER BY membership.organization_role)::text[] AS roles
           FROM identity.memberships membership JOIN identity.persons person ON person.id=membership.person_id
          WHERE membership.organization_id=$1
          GROUP BY membership.person_id,person.display_name ORDER BY person.display_name,membership.person_id`,
        [principal.organizationId]
      )).rows.map((row) => ({ id: row.person_id, displayName: row.display_name, roles: row.roles }));
    }
    const last = visible.at(-1);
    const canManage = access.roles.some((role) => MANAGER_ROLES.includes(role));
    return {
      contractId: PROJECT_PORTAL_CONTRACT_ID,
      organization: { id: principal.organizationId, name: access.organizationName },
      availableOrganizations: [{ id: principal.organizationId, name: access.organizationName, current: true }],
      permissions: { canCreateProject: canManage, canManageProjects: canManage, canViewMembers },
      projects: visible.map((row) => projectSummary(row, grouped)),
      nextCursor: result.rows.length > limit && last !== undefined ? encodeCursor(last.updated_at, last.id) : null,
      ...(members === undefined ? {} : { members })
    };
  });
}

export async function listSimulationTemplates(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: Pick<ProjectListInput, "query" | "limit" | "cursor">,
  correlationId: string
): Promise<TemplateLibraryV1> {
  let limit: number;
  try { limit = normalizedLimit(input.limit); } catch {
    throw authorizationError("VALIDATION_FAILED", "Template list limit must be between 1 and 50.", correlationId);
  }
  const query = input.query?.trim();
  if (query !== undefined && query.length > 100) throw authorizationError("VALIDATION_FAILED", "Template search is limited to 100 characters.", correlationId);
  const cursor = decodeCursor(input.cursor);
  if (input.cursor !== undefined && cursor === null) throw authorizationError("VALIDATION_FAILED", "Template list cursor is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const access = await requirePortalAccess(client, principal, PORTAL_ROLES, correlationId);
    if (isReviewerOnly(access)) return { contractId: TEMPLATE_LIBRARY_CONTRACT_ID, templates: [], nextCursor: null };
    const rows = (await client.query<{ id: string; title: string; summary: string; scenario: JsonObject | null; published_at: Date;
      version: number; lifecycle_history: Array<{ eventType: "published" | "superseded" | "deprecated" | "archived"; actorDisplayName: string; rationale: string; occurredAt: string }> | null }>(
      `SELECT template.id,template.title,template.summary,template.scenario,template.published_at,template.version,
              (SELECT jsonb_agg(jsonb_build_object('eventType',event.event_type,'actorDisplayName',person.display_name,
                        'rationale',event.rationale,'occurredAt',event.occurred_at) ORDER BY event.occurred_at,event.id)
                 FROM studio.template_lifecycle_events event JOIN identity.persons person ON person.id=event.actor_person_id
                WHERE event.organization_id=template.organization_id AND event.template_id=template.id) AS lifecycle_history
         FROM studio.simulation_templates template
        WHERE template.organization_id=$1 AND ($2::text IS NULL OR template.title ILIKE '%' || $2 || '%')
          AND ($3::timestamptz IS NULL OR (template.published_at,template.id)<($3::timestamptz,$4::uuid))
        ORDER BY template.published_at DESC,template.id DESC LIMIT $5`,
      [principal.organizationId, query === undefined || query === "" ? null : query, cursor?.date ?? null, cursor?.id ?? null, limit + 1]
    )).rows;
    const visible = rows.slice(0, limit);
    const templates: SimulationTemplateSummaryV1[] = visible.map((row) => ({
      id: row.id, title: row.title, summary: row.summary, includesOptionalScenario: row.scenario !== null,
      publishedAt: row.published_at.toISOString(), version: row.version,
      lifecycleStatus: row.lifecycle_history?.at(-1)?.eventType ?? "published",
      lifecycleHistory: (row.lifecycle_history ?? []).map((event) => ({ ...event, occurredAt: new Date(event.occurredAt).toISOString() }))
    }));
    const last = visible.at(-1);
    return { contractId: TEMPLATE_LIBRARY_CONTRACT_ID, templates,
      nextCursor: rows.length > limit && last !== undefined ? encodeCursor(last.published_at, last.id) : null };
  });
}

export async function publishSimulationTemplate(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  input: PublishTemplateInput,
  correlationId: string
): Promise<JsonObject> {
  const title = input.title.trim();
  const summary = input.summary.trim();
  const rationale = input.rationale.trim();
  if (!uuid.test(projectId) || title.length === 0 || title.length > 200 || summary.length > 1000 ||
      rationale.length === 0 || rationale.length > 4000 ||
      (input.supersedesTemplateId !== undefined && !uuid.test(input.supersedesTemplateId))) {
    throw authorizationError("VALIDATION_FAILED", "Template publication fields are invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const access = await requirePortalAccess(client, principal, ["publisher"], correlationId);
    const project = await client.query(
      "SELECT 1 FROM studio.simulation_projects WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [principal.organizationId, projectId]
    );
    if (project.rowCount !== 1) throw authorizationError("TARGET_NOT_FOUND", "The Project was not found.", correlationId);
    const freeze = (await client.query<{
      id: string; materialization: { coreDesign: CoreDesignV1; scenario: ScenarioV1 };
      materialization_sha256: string; policy_version: string;
    }>(`SELECT frozen.id,frozen.materialization,frozen.materialization_sha256,frozen.policy_version
          FROM studio.publication_freezes AS frozen
         WHERE frozen.organization_id=$1 AND frozen.project_id=$2
           AND EXISTS (SELECT 1 FROM studio.publication_reviews review
             JOIN identity.memberships membership ON membership.organization_id=review.organization_id
              AND membership.person_id=review.reviewer_person_id AND membership.organization_role='reviewer'
            WHERE review.organization_id=frozen.organization_id AND review.freeze_id=frozen.id
              AND review.artifact_sha256=frozen.materialization_sha256)
         ORDER BY frozen.frozen_at DESC,frozen.id DESC LIMIT 1`, [principal.organizationId, projectId])).rows[0];
    if (freeze === undefined) throw authorizationError("PERMISSION_DENIED", "A current approved Publication Freeze is required.", correlationId);
    let supersededDigest: string | null = null;
    if (input.supersedesTemplateId !== undefined) {
      const previous = await client.query<{ artifact_sha256: string | null; source_project_id: string }>(
        "SELECT artifact_sha256,source_project_id FROM studio.simulation_templates WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [principal.organizationId, input.supersedesTemplateId]);
      if (previous.rows[0] === undefined || previous.rows[0].source_project_id !== projectId) {
        throw authorizationError("REFERENCE_INVALID", "The superseded Template is unavailable for this Project.", correlationId);
      }
      supersededDigest = previous.rows[0].artifact_sha256;
    }
    const next = await client.query<{ version: number }>(
      "SELECT COALESCE(MAX(version),0)::int+1 AS version FROM studio.simulation_templates WHERE organization_id=$1 AND source_project_id=$2",
      [principal.organizationId, projectId]);
    const templateId = randomUUID();
    const version = next.rows[0]?.version ?? 1;
    const published = await client.query<{ published_at: Date }>(`INSERT INTO studio.simulation_templates
      (id,organization_id,title,summary,source_project_id,core_design,scenario,published_by,version,source_freeze_id,
       artifact_sha256,supersedes_template_id)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12) RETURNING published_at`,
      [templateId, principal.organizationId, title, summary, projectId, JSON.stringify(freeze.materialization.coreDesign),
        input.includeScenario ? JSON.stringify(freeze.materialization.scenario) : null, principal.principalId, version,
        freeze.id, freeze.materialization_sha256, input.supersedesTemplateId ?? null]);
    const evidence = { correlationId, freezeId: freeze.id, includesScenario: input.includeScenario };
    await client.query(`INSERT INTO studio.template_lifecycle_events
      (id,organization_id,template_id,event_type,actor_person_id,actor_roles,policy_version,artifact_sha256,rationale,evidence)
      VALUES ($1,$2,$3,'published',$4,$5::text[],$6,$7,$8,$9::jsonb)`,
      [randomUUID(), principal.organizationId, templateId, principal.principalId, access.roles, freeze.policy_version,
        freeze.materialization_sha256, rationale, JSON.stringify(evidence)]);
    if (input.supersedesTemplateId !== undefined) {
      await client.query(`INSERT INTO studio.template_lifecycle_events
        (id,organization_id,template_id,event_type,actor_person_id,actor_roles,policy_version,artifact_sha256,rationale,evidence)
        VALUES ($1,$2,$3,'superseded',$4,$5::text[],$6,$7,$8,$9::jsonb)`,
        [randomUUID(), principal.organizationId, input.supersedesTemplateId, principal.principalId, access.roles,
          freeze.policy_version, supersededDigest ?? freeze.materialization_sha256, rationale,
          JSON.stringify({ correlationId, supersededByTemplateId: templateId })]);
    }
    return { templateId, version, artifactDigest: freeze.materialization_sha256, lifecycleStatus: "published",
      immutable: true, publishedAt: published.rows[0]!.published_at.toISOString() };
  });
}

export async function recordTemplateLifecycle(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  templateId: string,
  eventType: "deprecated" | "archived",
  rationale: string,
  correlationId: string
): Promise<JsonObject> {
  if (!uuid.test(templateId) || rationale.trim().length === 0 || rationale.length > 4000) {
    throw authorizationError("VALIDATION_FAILED", "Template lifecycle fields are invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const access = await requirePortalAccess(client, principal, ["publisher"], correlationId);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`template-lifecycle:${principal.organizationId}:${templateId}`]);
    const template = (await client.query<{ artifact_sha256: string | null }>(
      "SELECT artifact_sha256 FROM studio.simulation_templates WHERE organization_id=$1 AND id=$2",
      [principal.organizationId, templateId])).rows[0];
    if (template === undefined) throw authorizationError("TARGET_NOT_FOUND", "The Simulation Template was not found.", correlationId);
    const latest = (await client.query<{ event_type: string }>(
      `SELECT event_type FROM studio.template_lifecycle_events
        WHERE organization_id=$1 AND template_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1`,
      [principal.organizationId, templateId])).rows[0]?.event_type;
    if (latest === "archived" || latest === eventType) {
      throw authorizationError("VERSION_CONFLICT", `The Template is already ${latest}.`, correlationId);
    }
    const artifactDigest = template.artifact_sha256 ?? digest({ templateId });
    const eventId = randomUUID();
    await client.query(`INSERT INTO studio.template_lifecycle_events
      (id,organization_id,template_id,event_type,actor_person_id,actor_roles,policy_version,artifact_sha256,rationale,evidence)
      VALUES ($1,$2,$3,$4,$5,$6::text[],'OPEN-013.v1',$7,$8,$9::jsonb)`,
      [eventId, principal.organizationId, templateId, eventType, principal.principalId, access.roles, artifactDigest,
        rationale.trim(), JSON.stringify({ correlationId })]);
    return { templateId, eventId, lifecycleStatus: eventType, immutable: true };
  });
}

async function replayReceipt(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  requestId: string,
  action: string,
  requestDigest: string,
  correlationId: string
): Promise<ProjectMutationV1 | null> {
  const result = await client.query<{ action: string; request_sha256: string; response: ProjectMutationV1 }>(
    `SELECT action,request_sha256,response FROM studio.project_mutation_receipts
      WHERE organization_id=$1 AND actor_person_id=$2 AND request_id=$3`,
    [principal.organizationId, principal.principalId, requestId]
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  if (row.action !== action || row.request_sha256 !== requestDigest) {
    throw authorizationError("IDEMPOTENCY_COLLISION", "The request identifier was already used for a different Project mutation.", correlationId);
  }
  return { ...row.response, replayed: true };
}

async function lockMutationRequest(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  requestId: string
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `project-mutation:${principal.organizationId}:${principal.principalId}:${requestId}`
  ]);
}

async function recordMutation(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  action: "project.create" | "project.archive" | "project.reopen",
  requestId: string,
  requestDigest: string,
  result: ProjectMutationV1,
  correlationId: string,
  details: JsonObject
): Promise<void> {
  await client.query(
    `INSERT INTO studio.project_mutation_receipts
       (organization_id,actor_person_id,request_id,action,project_id,request_sha256,response)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [principal.organizationId, principal.principalId, requestId, action, result.projectId, requestDigest, JSON.stringify(result)]
  );
  await client.query(
    `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), principal.organizationId, principal.principalId, action,
      `simulation_project:${result.projectId}`, JSON.stringify({ ...details, requestId, correlationId, resultVersion: result.version })]
  );
}

export async function createProject(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: CreateProjectInput,
  correlationId: string
): Promise<ProjectMutationV1> {
  const title = input.title.trim();
  if (!uuid.test(input.requestId) || title.length < 1 || title.length > 200 ||
      (input.templateId !== undefined && !uuid.test(input.templateId)) ||
      (input.sourcePackage !== undefined && (input.templateId !== undefined ||
        input.sourcePackage.bytes.byteLength === 0 || input.sourcePackage.bytes.byteLength > 32_000_000 ||
        !/^[a-f0-9]{64}$/u.test(input.sourcePackage.sha256)))) {
    throw authorizationError("VALIDATION_FAILED", "Project creation fields are invalid.", correlationId);
  }
  const requestDigest = digest({ action: "project.create", title,
    templateId: input.templateId ?? null, includeScenario: input.includeScenario === true,
    ...(input.sourcePackage === undefined ? {} : { sourcePackageSha256: createHash("sha256").update(input.sourcePackage.bytes).digest("hex"),
      expectedPackageSha256: input.sourcePackage.sha256 }) });
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requirePortalAccess(client, principal, MANAGER_ROLES, correlationId);
    await lockMutationRequest(client, principal, input.requestId);
    const replay = await replayReceipt(client, principal, input.requestId, "project.create", requestDigest, correlationId);
    if (replay !== null) return replay;
    const projectId = randomUUID();
    const scenarioId = randomUUID();
    let materialization: { coreDesign: CoreDesignV1; scenario: ScenarioV1 };
    let sourcePackage: JsonObject | undefined;
    if (input.sourcePackage !== undefined) {
      let verified;
      try { verified = verifyReleasePackage(input.sourcePackage.bytes, input.sourcePackage.sha256); }
      catch { throw authorizationError("VALIDATION_FAILED", "The Release Package failed integrity or compatibility validation. Choose a supported, unmodified package.", correlationId); }
      const copy = copySimulationTemplate(verified.release.coreDesign, verified.release.scenario, projectId, scenarioId, true);
      materialization = { coreDesign: copy.coreDesign, scenario: copy.scenario };
      // Provenance is historical source evidence, never a local approval or publication.
      sourcePackage = { sha256: verified.packageDigest, contentDigest: verified.contentDigest,
        releaseId: verified.release.manifest.releaseId, projectId: verified.release.manifest.projectId };
    } else if (input.templateId === undefined) {
      materialization = { coreDesign: blankCoreDesign(), scenario: blankScenario(scenarioId) };
    } else {
      const template = (await client.query<{ core_design: CoreDesignV1; scenario: ScenarioV1 | null }>(
        "SELECT core_design,scenario FROM studio.simulation_templates WHERE organization_id=$1 AND id=$2",
        [principal.organizationId, input.templateId]
      )).rows[0];
      if (template === undefined) throw authorizationError("TARGET_NOT_FOUND", "The Simulation Template was not found.", correlationId);
      if (input.includeScenario === true && template.scenario === null) {
        throw authorizationError("VALIDATION_FAILED", "This Simulation Template has no optional Scenario content.", correlationId);
      }
      const copy = copySimulationTemplate(template.core_design, template.scenario ?? blankScenario(randomUUID()),
        projectId, scenarioId, input.includeScenario === true);
      materialization = { coreDesign: copy.coreDesign, scenario: copy.scenario };
    }
    await client.query(
      `INSERT INTO studio.simulation_projects(id,organization_id,title,created_by,source_template_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [projectId, principal.organizationId, title, principal.principalId, input.templateId ?? null]
    );
    await client.query(
      `INSERT INTO studio.drafts(id,organization_id,project_id,document,updated_by)
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [randomUUID(), principal.organizationId, projectId, JSON.stringify(materialization), principal.principalId]
    );
    await client.query(
      `INSERT INTO studio.project_collaborators(organization_id,project_id,person_id,project_role,added_by)
       VALUES ($1,$2,$3,'owner',$3)`,
      [principal.organizationId, projectId, principal.principalId]
    );
    const result: ProjectMutationV1 = { projectId, lifecycleStatus: "active", version: 1,
      editorUrl: `/studio/projects/${projectId}`, replayed: false };
    await recordMutation(client, principal, "project.create", input.requestId, requestDigest, result, correlationId,
      { sourceTemplateId: input.templateId ?? null, includedScenario: input.sourcePackage !== undefined || input.includeScenario === true,
        ...(sourcePackage === undefined ? {} : { sourcePackage }) });
    return result;
  });
}

async function changeProjectLifecycle(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  projectId: string,
  input: ProjectLifecycleInput,
  action: "project.archive" | "project.reopen",
  correlationId: string
): Promise<ProjectMutationV1> {
  if (!uuid.test(projectId) || !uuid.test(input.requestId) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw authorizationError("VALIDATION_FAILED", "Project lifecycle fields are invalid.", correlationId);
  }
  const requestDigest = digest({ action, projectId, expectedVersion: input.expectedVersion });
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requirePortalAccess(client, principal, MANAGER_ROLES, correlationId);
    await lockMutationRequest(client, principal, input.requestId);
    const replay = await replayReceipt(client, principal, input.requestId, action, requestDigest, correlationId);
    if (replay !== null) return replay;
    const current = (await client.query<{ lifecycle_status: "active" | "archived"; version: string }>(
      "SELECT lifecycle_status,version FROM studio.simulation_projects WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [principal.organizationId, projectId]
    )).rows[0];
    if (current === undefined) throw authorizationError("TARGET_NOT_FOUND", "The Simulation Project was not found.", correlationId);
    if (Number(current.version) !== input.expectedVersion) {
      throw authorizationError("STALE_AGGREGATE_VERSION", "The Project changed. Refresh before trying again.", correlationId,
        { currentVersion: Number(current.version) });
    }
    const target = action === "project.archive" ? "archived" : "active";
    if (current.lifecycle_status === target) {
      throw authorizationError("INVALID_TRANSITION", `The Project is already ${target}.`, correlationId);
    }
    const version = input.expectedVersion + 1;
    await client.query(
      `UPDATE studio.simulation_projects SET lifecycle_status=$3,version=$4,updated_at=transaction_timestamp(),
         archived_at=CASE WHEN $3='archived' THEN transaction_timestamp() ELSE NULL END,
         archived_by=CASE WHEN $3='archived' THEN $5::uuid ELSE NULL END
       WHERE organization_id=$1 AND id=$2`,
      [principal.organizationId, projectId, target, version, principal.principalId]
    );
    const result: ProjectMutationV1 = { projectId, lifecycleStatus: target, version,
      editorUrl: `/studio/projects/${projectId}`, replayed: false };
    await recordMutation(client, principal, action, input.requestId, requestDigest, result, correlationId, {});
    return result;
  });
}

export const archiveProject = (pool: Pool, principal: AuthenticatedPrincipal, projectId: string,
  input: ProjectLifecycleInput, correlationId: string) =>
  changeProjectLifecycle(pool, principal, projectId, input, "project.archive", correlationId);

export const reopenProject = (pool: Pool, principal: AuthenticatedPrincipal, projectId: string,
  input: ProjectLifecycleInput, correlationId: string) =>
  changeProjectLifecycle(pool, principal, projectId, input, "project.reopen", correlationId);
