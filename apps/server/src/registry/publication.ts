import { randomUUID } from "node:crypto";
import type { JsonObject } from "@plenum/event-contracts";
import {
  PACKAGE_IMPORT_CONTRACT_ID,
  PACKAGE_SCHEMA_VERSION,
  RELEASE_COMPILER_VERSION,
  compileRelease,
  verifyReleasePackage,
  type CompileReleaseInput,
  type CompiledRelease
} from "@plenum/release-compiler";
import type { CoreDesignV1, ScenarioV1 } from "@plenum/simulation-schema";
import type { Pool } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import type { ObjectStore } from "./object-store.js";

export interface PublicationControls extends JsonObject {
  validationReportId: string;
  validationPassed: boolean;
  warningsAcknowledged: boolean;
  classificationReviewId: string;
  accessibilityReviewStatus: string;
  retentionPolicyId: string;
  approvedBy: string[];
  approvalNotes: string;
  testSessionPassed?: boolean;
}

export interface PublicationPolicy {
  requireDistinctApprover: boolean;
  requireTestSession: boolean;
}

export interface PublishReleaseInput {
  projectId: string;
  releaseLabel: string;
  semanticVersion: string;
  methodologyVersion: string;
  releaseNotes: string;
  controls: PublicationControls;
  policy: PublicationPolicy;
  correlationId: string;
}

export interface PublishedRelease {
  releaseId: string;
  definitionRevisionId: string;
  releaseLabel: string;
  contentDigest: string;
  manifestDigest: string;
  packageDigest: string;
}

export interface ImportedRelease extends PublishedRelease {
  imported: boolean;
}

function requirePublisher(principal: AuthenticatedPrincipal, correlationId: string): void {
  if (!principal.organizationRoles.includes("publisher")) {
    throw authorizationError("PERMISSION_DENIED", "A Publisher Organization Role is required.", correlationId);
  }
}

function validateControls(
  principal: AuthenticatedPrincipal,
  controls: PublicationControls,
  policy: PublicationPolicy,
  correlationId: string
): void {
  if (
    !controls.validationPassed || !controls.warningsAcknowledged ||
    controls.validationReportId.length === 0 || controls.classificationReviewId.length === 0 ||
    controls.accessibilityReviewStatus.length === 0 || controls.retentionPolicyId.length === 0 ||
    controls.approvedBy.length === 0
  ) throw authorizationError("VALIDATION_FAILED", "Publication controls are incomplete.", correlationId);
  if (new Set(controls.approvedBy).size !== controls.approvedBy.length) {
    throw authorizationError("VALIDATION_FAILED", "Publication approvals must be unique.", correlationId);
  }
  if (policy.requireDistinctApprover && controls.approvedBy.every((approver) => approver === principal.principalId)) {
    throw authorizationError("PERMISSION_DENIED", "Publication requires an approver other than the publisher.", correlationId);
  }
  if (policy.requireTestSession && controls.testSessionPassed !== true) {
    throw authorizationError("VALIDATION_FAILED", "Organization policy requires a passed test Session.", correlationId);
  }
}

async function cleanupUnreferenced(
  pool: Pool,
  store: ObjectStore,
  organizationId: string,
  objectKey: string,
  packageDigest: string
): Promise<void> {
  try {
    const referenced = await withOrganizationTransaction(pool, organizationId, (client) =>
      client.query("SELECT 1 FROM registry.releases WHERE organization_id=$1 AND blob_key=$2", [organizationId, objectKey]));
    if (referenced.rowCount === 0) await store.deleteIfDigest(objectKey, packageDigest);
  } catch {
    // An orphan is safer than deleting an object after an ambiguous database commit.
  }
}

interface FrozenMaterialization {
  materialization: { coreDesign: CoreDesignV1; scenario: ScenarioV1 };
  draftVersion?: number;
  sourceFreezeId?: string;
}

async function publishMaterialization(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  input: PublishReleaseInput,
  frozen: FrozenMaterialization,
  now = new Date()
): Promise<PublishedRelease> {
  const releaseId = randomUUID();
  const definitionRevisionId = randomUUID();
  let compiled: CompiledRelease;
  try {
    compiled = compileRelease({
      releaseId,
      projectId: input.projectId,
      definitionRevisionId,
      releaseLabel: input.releaseLabel,
      semanticVersion: input.semanticVersion,
      methodologyVersion: input.methodologyVersion,
      materialization: frozen.materialization,
      publishedBy: principal.principalId,
      approvedBy: input.controls.approvedBy,
      publishedAt: now.toISOString(),
      releaseNotes: input.releaseNotes,
      validationReportId: input.controls.validationReportId
    });
  } catch (error) {
    throw authorizationError("VALIDATION_FAILED", error instanceof Error ? error.message : "Release compilation failed.", input.correlationId);
  }
  const objectKey = `releases/${principal.organizationId}/${releaseId}/${compiled.packageDigest}.json`;
  await store.putImmutable(objectKey, compiled.bytes, compiled.packageDigest);
  try {
    await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
      await client.query(
        "SELECT 1 FROM studio.simulation_projects WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [principal.organizationId, input.projectId]
      );
      const publisher = await client.query(
        `SELECT 1 FROM identity.memberships
          WHERE organization_id=$1 AND person_id=$2 AND organization_role='publisher'`,
        [principal.organizationId, principal.principalId]
      );
      if (publisher.rowCount !== 1) {
        throw authorizationError("ACCESS_REVOKED", "Publisher access is no longer active.", input.correlationId);
      }
      if (frozen.sourceFreezeId === undefined) {
        const draft = await client.query<{ version: string }>(
          "SELECT version FROM studio.drafts WHERE organization_id=$1 AND project_id=$2 FOR UPDATE",
          [principal.organizationId, input.projectId]
        );
        if (Number(draft.rows[0]?.version) !== frozen.draftVersion) {
          throw authorizationError("VERSION_CONFLICT", "The Draft changed during Publication.", input.correlationId);
        }
      } else {
        const freeze = await client.query(
          `SELECT 1 FROM studio.publication_freezes
            WHERE organization_id=$1 AND project_id=$2 AND id=$3`,
          [principal.organizationId, input.projectId, frozen.sourceFreezeId]
        );
        if (freeze.rowCount !== 1) throw authorizationError("NOT_FOUND", "The Publication Freeze was not found.", input.correlationId);
      }
      const duplicate = await client.query<{ release_id: string }>(
        `SELECT release.id AS release_id
           FROM studio.definition_revisions revision
           JOIN registry.releases release ON release.definition_revision_id=revision.id
          WHERE revision.organization_id=$1 AND revision.project_id=$2 AND revision.snapshot_sha256=$3`,
        [principal.organizationId, input.projectId, compiled.contentDigest]
      );
      if (duplicate.rows[0] !== undefined) {
        throw authorizationError("ALREADY_PUBLISHED", "This Draft materialization is already published.", input.correlationId,
          { releaseId: duplicate.rows[0].release_id });
      }
      const approvers = await client.query<{ count: string }>(
        `SELECT count(DISTINCT person_id) AS count FROM identity.memberships
          WHERE organization_id=$1 AND person_id=ANY($2::uuid[])`,
        [principal.organizationId, input.controls.approvedBy]
      );
      if (Number(approvers.rows[0]?.count) !== new Set(input.controls.approvedBy).size) {
        throw authorizationError("REFERENCE_INVALID", "A publication approver is not an active Organization member.", input.correlationId);
      }
      const number = await client.query<{ release_number: number }>(
        "SELECT COALESCE(MAX(release_number),0)::int+1 AS release_number FROM registry.releases WHERE organization_id=$1 AND project_id=$2",
        [principal.organizationId, input.projectId]
      );
      const parent = await client.query<{ id: string }>(
        "SELECT id FROM studio.definition_revisions WHERE organization_id=$1 AND project_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1",
        [principal.organizationId, input.projectId]
      );
      await client.query(
        `INSERT INTO studio.definition_revisions
           (id,organization_id,project_id,parent_revision_id,snapshot,snapshot_sha256,methodology_version,author_id,source_freeze_id)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
        [definitionRevisionId, principal.organizationId, input.projectId, parent.rows[0]?.id ?? null,
          JSON.stringify(frozen.materialization), compiled.contentDigest, input.methodologyVersion, principal.principalId,
          frozen.sourceFreezeId ?? null]
      );
      await client.query(
        `INSERT INTO registry.releases
           (id,organization_id,project_id,definition_revision_id,release_number,release_label,
            package_schema_version,compiler_version,package_sha256,blob_key,published_by,published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [releaseId, principal.organizationId, input.projectId, definitionRevisionId,
          number.rows[0]?.release_number, input.releaseLabel, PACKAGE_SCHEMA_VERSION,
          RELEASE_COMPILER_VERSION, compiled.packageDigest, objectKey, principal.principalId, now]
      );
      for (const approver of input.controls.approvedBy) {
        await client.query(
          `INSERT INTO registry.release_approvals
             (id,organization_id,release_id,approver_person_id,decision,notes,decided_at)
           VALUES ($1,$2,$3,$4,'approved',$5,$6)`,
          [randomUUID(), principal.organizationId, releaseId, approver, input.controls.approvalNotes, now]
        );
      }
      await client.query(
        `INSERT INTO registry.package_manifests
           (id,organization_id,release_id,contract_id,manifest,manifest_sha256,package_sha256,
            publication_status,publication_controls)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,'published',$8::jsonb)`,
        [randomUUID(), principal.organizationId, releaseId, PACKAGE_IMPORT_CONTRACT_ID,
          JSON.stringify(compiled.release.manifest), compiled.manifestDigest, compiled.packageDigest,
          JSON.stringify(input.controls)]
      );
      await client.query(
        `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
         VALUES ($1,$2,$3,'registry.release_published',$4,$5::jsonb)`,
        [randomUUID(), principal.organizationId, principal.principalId, `release:${releaseId}`,
          JSON.stringify({ correlationId: input.correlationId, projectId: input.projectId,
            definitionRevisionId, sourceFreezeId: frozen.sourceFreezeId ?? null, contentDigest: compiled.contentDigest })]
      );
    });
  } catch (error) {
    await cleanupUnreferenced(pool, store, principal.organizationId, objectKey, compiled.packageDigest);
    throw error;
  }
  return { releaseId, definitionRevisionId, releaseLabel: input.releaseLabel,
    contentDigest: compiled.contentDigest, manifestDigest: compiled.manifestDigest,
    packageDigest: compiled.packageDigest };
}

export async function publishRelease(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  input: PublishReleaseInput,
  now = new Date()
): Promise<PublishedRelease> {
  requirePublisher(principal, input.correlationId);
  validateControls(principal, input.controls, input.policy, input.correlationId);
  const frozen = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ document: { coreDesign: CoreDesignV1; scenario: ScenarioV1 }; version: string }>(
      `SELECT draft.document, draft.version
         FROM studio.drafts draft
         JOIN studio.simulation_projects project
           ON project.organization_id=draft.organization_id AND project.id=draft.project_id
        WHERE draft.organization_id=$1 AND draft.project_id=$2
        FOR UPDATE OF draft`,
      [principal.organizationId, input.projectId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Draft was not found.", input.correlationId);
    return { materialization: row.document, draftVersion: Number(row.version) };
  });
  return publishMaterialization(pool, store, principal, input, frozen, now);
}

export async function publishReleaseFromFreeze(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  freezeId: string,
  input: PublishReleaseInput,
  now = new Date()
): Promise<PublishedRelease> {
  requirePublisher(principal, input.correlationId);
  validateControls(principal, input.controls, input.policy, input.correlationId);
  const frozen = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ materialization: { coreDesign: CoreDesignV1; scenario: ScenarioV1 }; project_id: string }>(
      `SELECT materialization,project_id FROM studio.publication_freezes
        WHERE organization_id=$1 AND id=$2`,
      [principal.organizationId, freezeId]
    );
    const row = result.rows[0];
    if (row === undefined || row.project_id !== input.projectId) {
      throw authorizationError("NOT_FOUND", "The Publication Freeze was not found.", input.correlationId);
    }
    return { materialization: row.materialization, sourceFreezeId: freezeId };
  });
  return publishMaterialization(pool, store, principal, input, frozen, now);
}

export async function exportReleasePackage(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  releaseId: string,
  correlationId: string
): Promise<Uint8Array> {
  if (principal.organizationRoles.length === 0) throw authorizationError("PERMISSION_DENIED", "Organization membership is required.", correlationId);
  const release = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const membership = await client.query(
      "SELECT 1 FROM identity.memberships WHERE organization_id=$1 AND person_id=$2",
      [principal.organizationId, principal.principalId]
    );
    if (membership.rowCount === 0) throw authorizationError("ACCESS_REVOKED", "Organization access is no longer active.", correlationId);
    return client.query<{ blob_key: string; package_sha256: string }>(
      "SELECT blob_key,package_sha256 FROM registry.releases WHERE organization_id=$1 AND id=$2",
      [principal.organizationId, releaseId]
    );
  });
  const row = release.rows[0];
  if (row === undefined) throw authorizationError("NOT_FOUND", "The Release was not found.", correlationId);
  const bytes = await store.get(row.blob_key);
  verifyReleasePackage(bytes, row.package_sha256);
  return bytes;
}

export function verifyImportedPackage(bytes: Uint8Array, expectedPackageDigest: string): CompiledRelease {
  return verifyReleasePackage(bytes, expectedPackageDigest);
}

export async function importReleasePackage(
  pool: Pool,
  store: ObjectStore,
  principal: AuthenticatedPrincipal,
  bytes: Uint8Array,
  expectedPackageDigest: string,
  correlationId: string
): Promise<ImportedRelease> {
  requirePublisher(principal, correlationId);
  let compiled: CompiledRelease;
  try {
    compiled = verifyReleasePackage(bytes, expectedPackageDigest);
  } catch (error) {
    throw authorizationError("VALIDATION_FAILED", error instanceof Error ? error.message : "Package verification failed.", correlationId);
  }
  const { manifest } = compiled.release;
  const objectKey = `releases/${principal.organizationId}/${manifest.releaseId}/${compiled.packageDigest}.json`;
  await store.putImmutable(objectKey, bytes, compiled.packageDigest);
  let imported = true;
  try {
    await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
      const publisher = await client.query(
        `SELECT 1 FROM identity.memberships
          WHERE organization_id=$1 AND person_id=$2 AND organization_role='publisher'`,
        [principal.organizationId, principal.principalId]
      );
      if (publisher.rowCount !== 1) {
        throw authorizationError("ACCESS_REVOKED", "Publisher access is no longer active.", correlationId);
      }
      const project = await client.query(
        "SELECT 1 FROM studio.simulation_projects WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [principal.organizationId, manifest.projectId]
      );
      if (project.rowCount !== 1) throw authorizationError("REFERENCE_INVALID", "The target Simulation Project is unavailable.", correlationId);
      const existing = await client.query<{ package_sha256: string }>(
        "SELECT package_sha256 FROM registry.releases WHERE organization_id=$1 AND id=$2",
        [principal.organizationId, manifest.releaseId]
      );
      if (existing.rows[0] !== undefined) {
        if (existing.rows[0].package_sha256 !== compiled.packageDigest) {
          throw authorizationError("IDEMPOTENCY_COLLISION", "The Release ID already identifies different Package bytes.", correlationId);
        }
        imported = false;
        return;
      }
      const people = [manifest.publishedBy, ...manifest.approvedBy];
      const memberships = await client.query<{ count: string }>(
        `SELECT count(DISTINCT person_id) AS count FROM identity.memberships
          WHERE organization_id=$1 AND person_id=ANY($2::uuid[])`,
        [principal.organizationId, people]
      );
      if (Number(memberships.rows[0]?.count) !== new Set(people).size) {
        throw authorizationError("REFERENCE_INVALID", "Package publisher or approver identity is unavailable.", correlationId);
      }
      const number = await client.query<{ release_number: number }>(
        "SELECT COALESCE(MAX(release_number),0)::int+1 AS release_number FROM registry.releases WHERE organization_id=$1 AND project_id=$2",
        [principal.organizationId, manifest.projectId]
      );
      await client.query(
        `INSERT INTO studio.definition_revisions
           (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
        [manifest.definitionRevisionId, principal.organizationId, manifest.projectId,
          JSON.stringify({ coreDesign: compiled.release.coreDesign, scenario: compiled.release.scenario }),
          compiled.contentDigest, manifest.methodologyVersion, manifest.publishedBy]
      );
      await client.query(
        `INSERT INTO registry.releases
           (id,organization_id,project_id,definition_revision_id,release_number,release_label,
            package_schema_version,compiler_version,package_sha256,blob_key,published_by,published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [manifest.releaseId, principal.organizationId, manifest.projectId, manifest.definitionRevisionId,
          number.rows[0]?.release_number, manifest.releaseLabel, PACKAGE_SCHEMA_VERSION,
          manifest.compilerVersion, compiled.packageDigest, objectKey, manifest.publishedBy, manifest.publishedAt]
      );
      for (const approver of manifest.approvedBy) {
        await client.query(
          `INSERT INTO registry.release_approvals
             (id,organization_id,release_id,approver_person_id,decision,notes,decided_at)
           VALUES ($1,$2,$3,$4,'approved','Imported Package',$5)`,
          [randomUUID(), principal.organizationId, manifest.releaseId, approver, manifest.publishedAt]
        );
      }
      await client.query(
        `INSERT INTO registry.package_manifests
           (id,organization_id,release_id,contract_id,manifest,manifest_sha256,package_sha256,
            publication_status,publication_controls)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,'published',$8::jsonb)`,
        [randomUUID(), principal.organizationId, manifest.releaseId, PACKAGE_IMPORT_CONTRACT_ID,
          JSON.stringify(manifest), compiled.manifestDigest, compiled.packageDigest,
          JSON.stringify({ imported: true, signaturePolicy: "OPEN-020" })]
      );
    });
  } catch (error) {
    await cleanupUnreferenced(pool, store, principal.organizationId, objectKey, compiled.packageDigest);
    throw error;
  }
  return {
    releaseId: manifest.releaseId,
    definitionRevisionId: manifest.definitionRevisionId,
    releaseLabel: manifest.releaseLabel,
    contentDigest: compiled.contentDigest,
    manifestDigest: compiled.manifestDigest,
    packageDigest: compiled.packageDigest,
    imported
  };
}
