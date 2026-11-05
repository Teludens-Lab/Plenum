import { createHash, randomUUID } from "node:crypto";

import { OPERATIONS_ADMIN_CONTRACT_ID, REPORT_DELIVERY_CONTRACT_ID, type JsonObject } from "@plenum/event-contracts";
import type { OrganizationRole } from "@plenum/policy-engine";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { replaceWorkforceMemberRoles } from "../identity/organization-workforce.js";

const approvedRoles: readonly OrganizationRole[] = [
  "admin", "designer", "publisher", "operator", "reviewer", "research_analyst"
];

function revision(roles: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify([...roles].sort())).digest("hex");
}

async function requireCurrentRole(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  roles: readonly OrganizationRole[],
  correlationId: string
): Promise<void> {
  if (!principal.organizationRoles.some((role) => roles.includes(role))) {
    throw authorizationError("PERMISSION_DENIED", `One of these Organization Roles is required: ${roles.join(", ")}.`, correlationId);
  }
  const current = await client.query(
    `SELECT 1 FROM identity.authentication_sessions authentication_session
       JOIN identity.memberships membership
         ON membership.organization_id=authentication_session.organization_id
        AND membership.person_id=authentication_session.person_id
       JOIN identity.organization_workforce_members workforce
         ON workforce.organization_id=membership.organization_id
        AND workforce.person_id=membership.person_id
      WHERE authentication_session.organization_id=$1 AND authentication_session.id=$2
        AND authentication_session.person_id=$3 AND authentication_session.revoked_at IS NULL
        AND authentication_session.expires_at>transaction_timestamp()
        AND workforce.status='active'
        AND membership.organization_role=ANY($4::text[]) LIMIT 1`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId, roles]
  );
  if (current.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Organization authority is no longer active.", correlationId);
}

async function audit(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  action: string,
  targetRef: string,
  details: JsonObject
): Promise<void> {
  await client.query(
    `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), principal.organizationId, principal.principalId, action, targetRef, JSON.stringify(details)]
  );
}

export interface OrganizationMemberAdministrationV1 {
  contractId: typeof OPERATIONS_ADMIN_CONTRACT_ID;
  roles: readonly OrganizationRole[];
  members: Array<{ personId: string; displayName: string; roles: OrganizationRole[]; revision: string }>;
}

export async function listOrganizationMemberAdministration(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<OrganizationMemberAdministrationV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], correlationId);
    const result = await client.query<{ person_id: string; display_name: string; roles: OrganizationRole[] }>(
      `SELECT person.id AS person_id,person.display_name,
              array_agg(membership.organization_role ORDER BY membership.organization_role)::text[] AS roles
         FROM identity.memberships membership
         JOIN identity.persons person ON person.id=membership.person_id
        WHERE membership.organization_id=$1
        GROUP BY person.id,person.display_name ORDER BY lower(person.display_name),person.id`,
      [principal.organizationId]
    );
    return { contractId: OPERATIONS_ADMIN_CONTRACT_ID, roles: approvedRoles,
      members: result.rows.map((row) => ({ personId: row.person_id, displayName: row.display_name,
        roles: row.roles, revision: revision(row.roles) })) };
  });
}

export async function replaceOrganizationMemberRoles(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  personId: string,
  input: { roles: OrganizationRole[]; expectedRevision: string },
  correlationId: string
): Promise<{ personId: string; roles: OrganizationRole[]; revision: string }> {
  return replaceWorkforceMemberRoles(pool, principal, personId, input, correlationId);
}

export interface PluginOperationsV1 {
  contractId: typeof OPERATIONS_ADMIN_CONTRACT_ID;
  permissions: { canSubmit: boolean; canApprove: boolean; canInstall: boolean; canRevoke: boolean };
  artifacts: Array<{
    artifactId: string; pluginId: string; version: string; digest: string; bundleDigest: string;
    lifecycleStatus: string; publisherName: string; submittedAt: string; approvedAt: string | null;
    revokedAt: string | null; installationCount: number; bindingCount: number; supplyChain: JsonObject;
  }>;
  governance: {
    publisherMembers: Array<{ personId: string; displayName: string }>;
    publishers: Array<{ publisherId: string; principalId: string; displayName: string; signatureKeyId: string; status: string; approvedAt: string }>;
    trustRoots: Array<{ trustRootId: string; publisherId: string; publisherKeyId: string; revocationKeyId: string; provisionedAt: string }>;
    revocationLists: Array<{ revocationListId: string; publisherId: string; documentSha256: string; generatedAt: string; importedAt: string }>;
    licenseAcceptances: Array<{ acceptanceId: string; pluginId: string; license: string; termsDigest: string; acceptedAt: string }>;
  };
}

export async function listPluginOperations(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<PluginOperationsV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin", "publisher"], correlationId);
    const admin = principal.organizationRoles.includes("admin");
    const result = await client.query<{
      artifact_id: string; plugin_id: string; version: string; digest: string; bundle_digest: string;
      lifecycle_status: string; publisher_name: string; submitted_at: Date; approved_at: Date | null;
      revoked_at: Date | null; installation_count: string; binding_count: string; supply_chain: JsonObject;
    }>(
      `SELECT artifact.id AS artifact_id,artifact.plugin_id,artifact.version,artifact.digest,artifact.bundle_digest,
              artifact.lifecycle_status,publisher.display_name AS publisher_name,artifact.submitted_at,
              artifact.approved_at,artifact.revoked_at,artifact.supply_chain,
              count(DISTINCT installation.id)::text AS installation_count,
              count(DISTINCT binding.id)::text AS binding_count
         FROM extension.plugin_artifacts artifact
         JOIN extension.publishers publisher ON publisher.organization_id=artifact.organization_id AND publisher.id=artifact.publisher_id
         LEFT JOIN extension.plugin_installations installation
           ON installation.organization_id=artifact.organization_id AND installation.artifact_id=artifact.id
         LEFT JOIN extension.plugin_bindings binding
           ON binding.organization_id=installation.organization_id AND binding.installation_id=installation.id
        WHERE artifact.organization_id=$1
        GROUP BY artifact.id,publisher.display_name ORDER BY artifact.submitted_at DESC,artifact.id`,
      [principal.organizationId]
    );
    const [publisherMembers, publishers, trustRoots, revocationLists, licenseAcceptances] = await Promise.all([
      client.query<{ person_id: string; display_name: string }>(
        `SELECT person.id AS person_id,person.display_name FROM identity.memberships membership
          JOIN identity.persons person ON person.id=membership.person_id
         WHERE membership.organization_id=$1 AND membership.organization_role='publisher' AND $2::boolean
         ORDER BY lower(person.display_name),person.id`, [principal.organizationId, admin]),
      client.query<{ id: string; principal_id: string; display_name: string; signature_key_id: string; status: string; approved_at: Date }>(
        `SELECT id,principal_id,display_name,signature_key_id,status,approved_at FROM extension.publishers
          WHERE organization_id=$1 AND $2::boolean ORDER BY approved_at DESC,id`, [principal.organizationId, admin]),
      client.query<{ id: string; publisher_id: string; publisher_key_id: string; revocation_key_id: string; provisioned_at: Date }>(
        `SELECT id,publisher_id,publisher_key_id,revocation_key_id,provisioned_at FROM extension.trust_roots
          WHERE organization_id=$1 AND $2::boolean ORDER BY provisioned_at DESC,id`, [principal.organizationId, admin]),
      client.query<{ id: string; publisher_id: string; document_sha256: string; generated_at: Date; imported_at: Date }>(
        `SELECT id,publisher_id,document_sha256,generated_at,imported_at FROM extension.revocation_lists
          WHERE organization_id=$1 AND $2::boolean ORDER BY generated_at DESC,id`, [principal.organizationId, admin]),
      client.query<{ id: string; plugin_id: string; license: string; terms_digest: string; accepted_at: Date }>(
        `SELECT id,plugin_id,license,terms_digest,accepted_at FROM extension.license_acceptances
          WHERE organization_id=$1 AND $2::boolean ORDER BY accepted_at DESC,id`, [principal.organizationId, admin])
    ]);
    return { contractId: OPERATIONS_ADMIN_CONTRACT_ID,
      permissions: { canSubmit: principal.organizationRoles.includes("publisher"), canApprove: admin, canInstall: admin, canRevoke: admin },
      artifacts: result.rows.map((row) => ({ artifactId: row.artifact_id, pluginId: row.plugin_id,
        version: row.version, digest: row.digest, bundleDigest: row.bundle_digest,
        lifecycleStatus: row.lifecycle_status, publisherName: row.publisher_name,
        submittedAt: row.submitted_at.toISOString(), approvedAt: row.approved_at?.toISOString() ?? null,
        revokedAt: row.revoked_at?.toISOString() ?? null, installationCount: Number(row.installation_count),
        bindingCount: Number(row.binding_count), supplyChain: row.supply_chain })),
      governance: {
        publisherMembers: publisherMembers.rows.map((row) => ({ personId: row.person_id, displayName: row.display_name })),
        publishers: publishers.rows.map((row) => ({ publisherId: row.id, principalId: row.principal_id,
          displayName: row.display_name, signatureKeyId: row.signature_key_id, status: row.status,
          approvedAt: row.approved_at.toISOString() })),
        trustRoots: trustRoots.rows.map((row) => ({ trustRootId: row.id, publisherId: row.publisher_id,
          publisherKeyId: row.publisher_key_id, revocationKeyId: row.revocation_key_id,
          provisionedAt: row.provisioned_at.toISOString() })),
        revocationLists: revocationLists.rows.map((row) => ({ revocationListId: row.id,
          publisherId: row.publisher_id, documentSha256: row.document_sha256,
          generatedAt: row.generated_at.toISOString(), importedAt: row.imported_at.toISOString() })),
        licenseAcceptances: licenseAcceptances.rows.map((row) => ({ acceptanceId: row.id,
          pluginId: row.plugin_id, license: row.license, termsDigest: row.terms_digest,
          acceptedAt: row.accepted_at.toISOString() }))
      } };
  });
}

export interface DataPolicyOperationsV1 {
  contractId: typeof OPERATIONS_ADMIN_CONTRACT_ID;
  retentionPolicies: Array<{ id: string; key: string; version: number; scopeType: string; scopeReference: string;
    periodDays: number; legalHoldBehavior: string; expiryAction: string; archiveDestination: string; approvalRequired: boolean; createdAt: string }>;
  legalHolds: Array<{ holdId: string; scopeType: string; scopeReference: string; reason: string; placedAt: string; releasedAt: string | null }>;
  corrections: Array<{ id: string; targetReference: string; reason: string; reportsMustRegenerate: boolean; correctedAt: string }>;
  imports: Array<{ id: string; sourcePackageSha256: string; importedAt: string }>;
}

export async function getDataPolicyOperations(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<DataPolicyOperationsV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin"], correlationId);
    const [policies, holds, corrections, imports] = await Promise.all([
      client.query<{ id: string; policy_key: string; version: number; scope_type: string; scope_reference: string;
        period_days: number; legal_hold_behavior: string; expiry_action: string; archive_destination: string;
        approval_required: boolean; created_at: Date }>(
        `SELECT id,policy_key,version,scope_type,scope_reference,period_days,legal_hold_behavior,expiry_action,
                archive_destination,approval_required,created_at FROM reporting.retention_policies
          WHERE organization_id=$1 ORDER BY created_at DESC,id`, [principal.organizationId]),
      client.query<{ hold_id: string; scope_type: string; scope_reference: string; reason: string; placed_at: Date; released_at: Date | null }>(
        `SELECT placed.hold_id,placed.scope_type,placed.scope_reference,placed.reason,placed.recorded_at AS placed_at,
                released.recorded_at AS released_at
           FROM reporting.legal_hold_events placed
           LEFT JOIN reporting.legal_hold_events released ON released.organization_id=placed.organization_id
            AND released.hold_id=placed.hold_id AND released.action='released'
          WHERE placed.organization_id=$1 AND placed.action='placed' ORDER BY placed.recorded_at DESC`, [principal.organizationId]),
      client.query<{ id: string; target_reference: string; reason: string; reports_must_regenerate: boolean; corrected_at: Date }>(
        `SELECT id,target_reference,reason,reports_must_regenerate,corrected_at FROM reporting.corrections
          WHERE organization_id=$1 ORDER BY corrected_at DESC,id`, [principal.organizationId]),
      client.query<{ id: string; source_package_sha256: string; imported_at: Date }>(
        `SELECT id,source_package_sha256,imported_at FROM reporting.organization_imports
          WHERE organization_id=$1 ORDER BY imported_at DESC,id`, [principal.organizationId])
    ]);
    return { contractId: OPERATIONS_ADMIN_CONTRACT_ID,
      retentionPolicies: policies.rows.map((row) => ({ id: row.id, key: row.policy_key, version: row.version,
        scopeType: row.scope_type, scopeReference: row.scope_reference, periodDays: row.period_days,
        legalHoldBehavior: row.legal_hold_behavior, expiryAction: row.expiry_action,
        archiveDestination: row.archive_destination, approvalRequired: row.approval_required,
        createdAt: row.created_at.toISOString() })),
      legalHolds: holds.rows.map((row) => ({ holdId: row.hold_id, scopeType: row.scope_type,
        scopeReference: row.scope_reference, reason: row.reason, placedAt: row.placed_at.toISOString(),
        releasedAt: row.released_at?.toISOString() ?? null })),
      corrections: corrections.rows.map((row) => ({ id: row.id, targetReference: row.target_reference,
        reason: row.reason, reportsMustRegenerate: row.reports_must_regenerate,
        correctedAt: row.corrected_at.toISOString() })),
      imports: imports.rows.map((row) => ({ id: row.id, sourcePackageSha256: row.source_package_sha256,
        importedAt: row.imported_at.toISOString() })) };
  });
}

export async function getSessionRetentionStatus(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string
): Promise<{ contractId: typeof OPERATIONS_ADMIN_CONTRACT_ID; sessionId: string; policies: DataPolicyOperationsV1["retentionPolicies"];
  organizationLegalHoldActive: boolean; consequences: string[] }> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["admin", "operator"], correlationId);
    const session = await client.query("SELECT 1 FROM runtime.sessions WHERE organization_id=$1 AND id=$2",
      [principal.organizationId, sessionId]);
    if (session.rowCount !== 1) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
    const policies = await client.query<{ id: string; policy_key: string; version: number; scope_type: string; scope_reference: string;
      period_days: number; legal_hold_behavior: string; expiry_action: string; archive_destination: string;
      approval_required: boolean; created_at: Date }>(
      `SELECT id,policy_key,version,scope_type,scope_reference,period_days,legal_hold_behavior,expiry_action,
              archive_destination,approval_required,created_at FROM reporting.retention_policies
        WHERE organization_id=$1 AND (scope_type='organization' OR (scope_type='session' AND scope_reference=$2))
        ORDER BY created_at DESC,id`, [principal.organizationId, sessionId]);
    const hold = await client.query(
      `SELECT 1 FROM reporting.legal_hold_events placed
        WHERE placed.organization_id=$1 AND placed.action='placed' AND placed.scope_type='organization'
          AND NOT EXISTS (SELECT 1 FROM reporting.legal_hold_events released
            WHERE released.organization_id=placed.organization_id AND released.hold_id=placed.hold_id AND released.action='released') LIMIT 1`,
      [principal.organizationId]
    );
    const mapped = policies.rows.map((row) => ({ id: row.id, key: row.policy_key, version: row.version,
      scopeType: row.scope_type, scopeReference: row.scope_reference, periodDays: row.period_days,
      legalHoldBehavior: row.legal_hold_behavior, expiryAction: row.expiry_action,
      archiveDestination: row.archive_destination, approvalRequired: row.approval_required,
      createdAt: row.created_at.toISOString() }));
    return { contractId: OPERATIONS_ADMIN_CONTRACT_ID, sessionId, policies: mapped,
      organizationLegalHoldActive: hold.rowCount === 1,
      consequences: ["Archiving removes the Session from active operations.",
        "The immutable Governing Release and Evidence history remain preserved.",
        ...(hold.rowCount === 1 ? ["An active Organization legal hold blocks retention purge."] : [])] };
  });
}

export interface ReportArtifactSummaryV1 {
  artifactId: string; jobId: string; filename: string; contentType: string; sha256: string;
  format: string; createdAt: string; purgedAt: string | null; manifest: JsonObject;
}

export async function listResearchReportableSessions(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<{ contractId: typeof REPORT_DELIVERY_CONTRACT_ID; sessions: Array<{ sessionId: string; title: string; projectTitle: string; releaseLabel: string }> }> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, ["research_analyst"], correlationId);
    const result = await client.query<{ session_id: string; title: string; project_title: string; release_label: string }>(
      `SELECT DISTINCT session.id AS session_id,session.title,project.title AS project_title,release.release_label
         FROM evidence.research_access_grants access_grant
         JOIN studio.simulation_projects project
           ON project.organization_id=access_grant.organization_id AND project.id=access_grant.project_id
         JOIN runtime.sessions session
           ON session.organization_id=project.organization_id AND session.project_id=project.id
         JOIN registry.releases release
           ON release.organization_id=session.organization_id AND release.id=session.initial_release_id
        WHERE access_grant.organization_id=$1 AND access_grant.analyst_person_id=$2
          AND access_grant.revoked_at IS NULL AND access_grant.expires_at>transaction_timestamp()
        ORDER BY session.title,session.id`, [principal.organizationId, principal.principalId]
    );
    return { contractId: REPORT_DELIVERY_CONTRACT_ID, sessions: result.rows.map((row) => ({
      sessionId: row.session_id, title: row.title, projectTitle: row.project_title, releaseLabel: row.release_label
    })) };
  });
}

async function requireReportAccess(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string
): Promise<{ researchOnly: boolean }> {
  await requireCurrentRole(client, principal, ["admin", "operator", "research_analyst"], correlationId);
  const researchOnly = principal.organizationRoles.includes("research_analyst") &&
    !principal.organizationRoles.some((role) => role === "admin" || role === "operator");
  const session = await client.query<{ project_id: string }>(
    "SELECT project_id FROM runtime.sessions WHERE organization_id=$1 AND id=$2",
    [principal.organizationId, sessionId]
  );
  if (session.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
  if (researchOnly) {
    const grant = await client.query(
      `SELECT 1 FROM evidence.research_access_grants WHERE organization_id=$1 AND project_id=$2
        AND analyst_person_id=$3 AND revoked_at IS NULL AND expires_at>transaction_timestamp() LIMIT 1`,
      [principal.organizationId, session.rows[0].project_id, principal.principalId]
    );
    if (grant.rowCount !== 1) throw authorizationError("PERMISSION_DENIED", "An active Research Access Grant is required.", correlationId);
  }
  return { researchOnly };
}

export async function listSessionReportArtifacts(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string
): Promise<{ contractId: typeof REPORT_DELIVERY_CONTRACT_ID; artifacts: ReportArtifactSummaryV1[] }> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const { researchOnly } = await requireReportAccess(client, principal, sessionId, correlationId);
    const result = await client.query<{
      artifact_id: string; job_id: string; filename: string; content_type: string; sha256: string; format: string;
      created_at: Date; purged_at: Date | null; manifest: JsonObject;
    }>(
      `SELECT artifact.id AS artifact_id,job.id AS job_id,artifact.filename,artifact.content_type,artifact.sha256,
              job.format,artifact.created_at,artifact.purged_at,artifact.manifest
         FROM reporting.export_jobs job JOIN reporting.export_artifacts artifact
           ON artifact.organization_id=job.organization_id AND artifact.job_id=job.id
        WHERE job.organization_id=$1 AND job.session_id=$2
          AND ($3::boolean=false OR job.requested_by=$4)
        ORDER BY artifact.created_at DESC,artifact.id LIMIT 50`,
      [principal.organizationId, sessionId, researchOnly, principal.principalId]
    );
    return { contractId: REPORT_DELIVERY_CONTRACT_ID, artifacts: result.rows.map((row) => ({
      artifactId: row.artifact_id, jobId: row.job_id, filename: row.filename, contentType: row.content_type,
      sha256: row.sha256, format: row.format, createdAt: row.created_at.toISOString(),
      purgedAt: row.purged_at?.toISOString() ?? null, manifest: row.manifest
    })) };
  });
}

export async function getReportArtifact(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  artifactId: string,
  correlationId: string
): Promise<{ contentType: string; filename: string; bytes: Uint8Array }> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ session_id: string; requested_by: string; content_type: string; filename: string; bytes: Buffer | null }>(
      `SELECT job.session_id,job.requested_by,artifact.content_type,artifact.filename,artifact.bytes
         FROM reporting.export_artifacts artifact JOIN reporting.export_jobs job
           ON job.organization_id=artifact.organization_id AND job.id=artifact.job_id
        WHERE artifact.organization_id=$1 AND artifact.id=$2`, [principal.organizationId, artifactId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The report artifact was not found.", correlationId);
    const { researchOnly } = await requireReportAccess(client, principal, row.session_id, correlationId);
    if (researchOnly && row.requested_by !== principal.principalId) {
      throw authorizationError("PERMISSION_DENIED", "Research Analysts may download only their own authorized exports.", correlationId);
    }
    if (row.bytes === null) throw authorizationError("NOT_FOUND", "The report artifact expired under the retention policy.", correlationId);
    return { contentType: row.content_type, filename: row.filename, bytes: row.bytes };
  });
}
