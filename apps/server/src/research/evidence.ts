import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

async function requireCurrentRole(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  role: "admin" | "research_analyst",
  correlationId: string
): Promise<void> {
  if (!principal.organizationRoles.includes(role)) {
    throw authorizationError("PERMISSION_DENIED", `The ${role === "admin" ? "Admin" : "Research Analyst"} Organization Role is required.`, correlationId);
  }
  const current = await client.query(
    `SELECT 1
       FROM identity.authentication_sessions session
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
      WHERE session.organization_id=$1 AND session.id=$2 AND session.person_id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
        AND membership.organization_role=$4`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId, role]
  );
  if (current.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Organization access is no longer active.", correlationId);
}

export interface ResearchAccessGrantInput {
  projectId: string;
  analystPersonId: string;
  protocolReference: string;
  expiresAt: Date;
}

export interface ResearchAccessGrant {
  grantId: string;
  projectId: string;
  analystPersonId: string;
  protocolReference: string;
  classificationCeiling: "internal";
  expiresAt: string;
}

export async function grantResearchAccess(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: ResearchAccessGrantInput,
  correlationId: string,
  now = new Date()
): Promise<ResearchAccessGrant> {
  if (!uuid.test(input.projectId) || !uuid.test(input.analystPersonId) ||
      input.protocolReference.trim().length === 0 || input.protocolReference.length > 400 ||
      Number.isNaN(input.expiresAt.getTime()) || input.expiresAt <= now) {
    throw authorizationError("VALIDATION_FAILED", "A project, Research Analyst, protocol reference, and future expiry are required.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, "admin", correlationId);
    const target = await client.query(
      `SELECT 1
         FROM studio.simulation_projects project
         JOIN identity.memberships membership
           ON membership.organization_id=project.organization_id AND membership.person_id=$3
          AND membership.organization_role='research_analyst'
        WHERE project.organization_id=$1 AND project.id=$2`,
      [principal.organizationId, input.projectId, input.analystPersonId]
    );
    if (target.rowCount !== 1) throw authorizationError("REFERENCE_INVALID", "The project or Research Analyst membership is unavailable.", correlationId);
    const grantId = randomUUID();
    await client.query(
      `INSERT INTO evidence.research_access_grants
         (id,organization_id,project_id,analyst_person_id,protocol_reference,classification_ceiling,approved_by,expires_at)
       VALUES ($1,$2,$3,$4,$5,'internal',$6,$7)`,
      [grantId, principal.organizationId, input.projectId, input.analystPersonId,
        input.protocolReference.trim(), principal.principalId, input.expiresAt]
    );
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'research.access_granted',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `research_access_grant:${grantId}`,
        JSON.stringify({ correlationId, projectId: input.projectId, analystPersonId: input.analystPersonId,
          protocolReference: input.protocolReference.trim(), expiresAt: input.expiresAt.toISOString() })]
    );
    return { grantId, projectId: input.projectId, analystPersonId: input.analystPersonId,
      protocolReference: input.protocolReference.trim(), classificationCeiling: "internal", expiresAt: input.expiresAt.toISOString() };
  });
}

export async function revokeResearchAccess(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  grantId: string,
  correlationId: string
): Promise<void> {
  if (!uuid.test(grantId)) throw authorizationError("INVALID_ID", "The Research Access Grant identifier is invalid.", correlationId);
  await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, "admin", correlationId);
    const revoked = await client.query(
      `UPDATE evidence.research_access_grants SET revoked_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2 AND revoked_at IS NULL`,
      [principal.organizationId, grantId]
    );
    if (revoked.rowCount !== 1) throw authorizationError("NOT_FOUND", "The active Research Access Grant was not found.", correlationId);
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'research.access_revoked',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `research_access_grant:${grantId}`, JSON.stringify({ correlationId })]
    );
  });
}

export interface ResearchEvidenceIndex {
  contractId: "research-evidence-index-v1";
  sessionId: string;
  protocolReference: string;
  generatedAt: string;
  events: Array<{
    sequence: number;
    eventType: string;
    eventVersion: number;
    governingReleaseId: string;
    recordedAt: string;
  }>;
  nextSequence: number | null;
}

export async function exportResearchEvidenceIndex(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string,
  afterSequence = 0,
  limit = 1_000,
  now = new Date()
): Promise<ResearchEvidenceIndex> {
  if (!uuid.test(sessionId) || !Number.isSafeInteger(afterSequence) || afterSequence < 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw authorizationError("VALIDATION_FAILED", "The research export cursor or limit is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentRole(client, principal, "research_analyst", correlationId);
    const access = await client.query<{ protocol_reference: string }>(
      `SELECT access_grant.protocol_reference
         FROM runtime.sessions session
         JOIN evidence.research_access_grants access_grant
           ON access_grant.organization_id=session.organization_id AND access_grant.project_id=session.project_id
          AND access_grant.analyst_person_id=$3 AND access_grant.classification_ceiling='internal'
          AND access_grant.revoked_at IS NULL AND access_grant.expires_at>$4
        WHERE session.organization_id=$1 AND session.id=$2
        ORDER BY access_grant.created_at DESC LIMIT 1`,
      [principal.organizationId, sessionId, principal.principalId, now]
    );
    if (access.rows[0] === undefined) throw authorizationError("PERMISSION_DENIED", "An active project-scoped Research Access Grant is required.", correlationId);
    const result = await client.query<{
      sequence: string; event_type: string; event_version: number; governing_release_id: string; recorded_at: Date;
    }>(
      `SELECT sequence,event_type,event_version,governing_release_id,recorded_at
         FROM evidence.events
        WHERE organization_id=$1 AND session_id=$2 AND sequence>$3
        ORDER BY sequence LIMIT $4`,
      [principal.organizationId, sessionId, afterSequence, limit + 1]
    );
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    await client.query(
      `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
       VALUES ($1,$2,$3,'research.evidence_index_exported',$4,$5::jsonb)`,
      [randomUUID(), principal.organizationId, principal.principalId, `session:${sessionId}`,
        JSON.stringify({ correlationId, protocolReference: access.rows[0].protocol_reference,
          afterSequence, returned: rows.length, classificationCeiling: "internal" })]
    );
    return {
      contractId: "research-evidence-index-v1",
      sessionId,
      protocolReference: access.rows[0].protocol_reference,
      generatedAt: now.toISOString(),
      events: rows.map((row) => ({ sequence: Number(row.sequence), eventType: row.event_type,
        eventVersion: row.event_version, governingReleaseId: row.governing_release_id, recordedAt: row.recorded_at.toISOString() })),
      nextSequence: hasMore ? Number(rows.at(-1)?.sequence ?? afterSequence) : null
    };
  });
}
