import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  ORGANIZATION_WORKFORCE_CONTRACT_ID,
  type JsonObject,
  type OrganizationWorkforceV1
} from "@plenum/event-contracts";
import type { OrganizationRole } from "@plenum/policy-engine";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction, withRestrictedTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { FirstAdminInvitationDelivery } from "../platform/provisioning.js";
import type { AuthenticatedPrincipal } from "./login.js";
import type { VerifiedOidcIdentity } from "./oidc.js";

const roles: readonly OrganizationRole[] = [
  "admin", "designer", "publisher", "operator", "reviewer", "research_analyst"
];
const roleEntitlements: Partial<Record<OrganizationRole, string>> = {
  designer: "studio_authoring",
  publisher: "studio_authoring",
  reviewer: "studio_authoring",
  operator: "session_delivery",
  research_analyst: "research_reporting"
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export interface ScimCredentialContext {
  organizationId: string;
  credentialId: string;
  actorPersonId: string;
}

export interface ScimListResponse extends JsonObject {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: JsonObject[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function roleRevision(values: readonly string[]): string {
  return sha256(JSON.stringify([...values].sort()));
}

function cleanEmail(value: string, correlationId: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !emailPattern.test(email)) {
    throw authorizationError("VALIDATION_FAILED", "A valid work email address is required.", correlationId);
  }
  return email;
}

function cleanReason(value: string, correlationId: string): string {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 1_000) {
    throw authorizationError("VALIDATION_FAILED", "A reason between 3 and 1,000 characters is required.", correlationId);
  }
  return reason;
}

function cleanRoles(values: readonly string[], correlationId: string, allowEmpty = false): OrganizationRole[] {
  if ((!allowEmpty && values.length === 0) || new Set(values).size !== values.length ||
      values.some((value) => !roles.includes(value as OrganizationRole))) {
    throw authorizationError("VALIDATION_FAILED", "The Organization Role set is invalid.", correlationId);
  }
  return [...values].sort() as OrganizationRole[];
}

async function requireCurrentAdmin(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<void> {
  if (!principal.organizationRoles.includes("admin")) {
    throw authorizationError("PERMISSION_DENIED", "The Admin Organization Role is required.", correlationId);
  }
  const active = await client.query(
    `SELECT 1
       FROM identity.authentication_sessions session
       JOIN identity.memberships membership
         ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
       JOIN identity.organization_workforce_members workforce
         ON workforce.organization_id=membership.organization_id AND workforce.person_id=membership.person_id
      WHERE session.organization_id=$1 AND session.id=$2 AND session.person_id=$3
        AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
        AND membership.organization_role='admin' AND workforce.status='active'`,
    [principal.organizationId, principal.authenticationSessionId, principal.principalId]
  );
  if (active.rowCount !== 1) {
    throw authorizationError("ACCESS_REVOKED", "Organization Admin authority is no longer active.", correlationId);
  }
}

async function audit(
  client: PoolClient,
  organizationId: string,
  actorPersonId: string,
  action: string,
  targetRef: string,
  correlationId: string,
  details: JsonObject = {}
): Promise<void> {
  await client.query(
    `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), organizationId, actorPersonId, action, targetRef,
      JSON.stringify({ ...details, correlationId })]
  );
}

async function requireEntitledRoles(
  client: PoolClient,
  organizationId: string,
  requestedRoles: readonly OrganizationRole[],
  correlationId: string
): Promise<void> {
  const result = await client.query<{ configuration_status: string; entitlements: string[] }>(
    `SELECT configuration_status,entitlements FROM identity.organization_provisioning
      WHERE organization_id=$1`, [organizationId]
  );
  const provisioning = result.rows[0];
  // Legacy Organizations are deliberately reconcilable; the control plane creates
  // a complete provisioning row for every newly activated Organization.
  if (provisioning === undefined) return;
  if (provisioning.configuration_status === "needs_reconciliation") return;
  const missing = [...new Set(requestedRoles.map((role) => roleEntitlements[role]).filter(
    (entitlement): entitlement is string => entitlement !== undefined && !provisioning.entitlements.includes(entitlement)
  ))];
  if (missing.length > 0) {
    throw authorizationError("PERMISSION_DENIED",
      `The Organization is not entitled to grant: ${missing.join(", ")}.`, correlationId);
  }
}

async function requireVerifiedEmailDomain(
  client: PoolClient,
  organizationId: string,
  email: string,
  correlationId: string
): Promise<void> {
  const domain = email.split("@")[1];
  const result = await client.query(
    `SELECT 1 FROM identity.organization_domains
      WHERE organization_id=$1 AND domain=$2 AND verified_at IS NOT NULL`,
    [organizationId, domain]
  );
  if (result.rowCount !== 1) {
    throw authorizationError("PERMISSION_DENIED", "The work email domain is not verified for this Organization.", correlationId);
  }
}

async function protectFinalAdmin(
  client: PoolClient,
  organizationId: string,
  personId: string,
  correlationId: string
): Promise<void> {
  const target = await client.query(
    `SELECT 1 FROM identity.memberships
      WHERE organization_id=$1 AND person_id=$2 AND organization_role='admin'`,
    [organizationId, personId]
  );
  if (target.rowCount === 0) return;
  const remaining = await client.query<{ count: string }>(
    `SELECT count(DISTINCT membership.person_id)::text AS count
       FROM identity.memberships membership
       JOIN identity.organization_workforce_members workforce
         ON workforce.organization_id=membership.organization_id AND workforce.person_id=membership.person_id
      WHERE membership.organization_id=$1 AND membership.organization_role='admin'
        AND workforce.status='active' AND membership.person_id<>$2`,
    [organizationId, personId]
  );
  if (Number(remaining.rows[0]?.count ?? 0) === 0) {
    throw authorizationError("INVALID_TRANSITION", "The final active Organization Admin cannot lose access.", correlationId);
  }
}

async function revokeAccess(
  client: PoolClient,
  organizationId: string,
  personId: string
): Promise<{ sessions: number; projections: number }> {
  const sessions = await client.query(
    `UPDATE identity.authentication_sessions SET revoked_at=transaction_timestamp()
      WHERE organization_id=$1 AND person_id=$2 AND revoked_at IS NULL`,
    [organizationId, personId]
  );
  const projections = await client.query(
    `UPDATE sync.projection_grants grant_row SET revoked_at=transaction_timestamp()
       FROM runtime.participants participant
      WHERE grant_row.organization_id=$1 AND grant_row.revoked_at IS NULL
        AND participant.organization_id=$1 AND participant.person_id=$2
        AND participant.id=grant_row.participant_id`,
    [organizationId, personId]
  );
  await client.query(
    `UPDATE runtime.participant_access_revisions revision
        SET access_revision=revision.access_revision+1,refreshed_at=transaction_timestamp()
       FROM runtime.participants participant
      WHERE revision.organization_id=$1 AND participant.organization_id=$1 AND participant.person_id=$2
        AND revision.participant_id=participant.id`,
    [organizationId, personId]
  );
  return { sessions: sessions.rowCount ?? 0, projections: projections.rowCount ?? 0 };
}

async function transitionMemberWithClient(
  client: PoolClient,
  context: { organizationId: string; actorPersonId: string },
  personId: string,
  transition: "activate" | "suspend" | "deprovision",
  expectedVersion: number,
  reason: string,
  correlationId: string
): Promise<void> {
  if (!uuid.test(personId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw authorizationError("VALIDATION_FAILED", "The workforce lifecycle request is invalid.", correlationId);
  }
  const current = await client.query<{ status: string; lifecycle_version: string }>(
    `SELECT status,lifecycle_version::text FROM identity.organization_workforce_members
      WHERE organization_id=$1 AND person_id=$2 FOR UPDATE`,
    [context.organizationId, personId]
  );
  const member = current.rows[0];
  if (member === undefined) throw authorizationError("NOT_FOUND", "The workforce member was not found.", correlationId);
  if (Number(member.lifecycle_version) !== expectedVersion) {
    throw authorizationError("STALE_AGGREGATE_VERSION", "Workforce access changed in another view. Refresh before trying again.", correlationId);
  }
  if (transition === "activate") {
    if (member.status !== "suspended") throw authorizationError("INVALID_TRANSITION", "Only a suspended member can be reactivated.", correlationId);
    await client.query(
      `UPDATE identity.organization_workforce_members
          SET status='active',suspended_at=NULL,lifecycle_reason=$3,lifecycle_version=lifecycle_version+1,
              updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND person_id=$2`, [context.organizationId, personId, reason]
    );
  } else {
    if (transition === "suspend" && member.status !== "active") {
      throw authorizationError("INVALID_TRANSITION", "Only an active member can be suspended.", correlationId);
    }
    if (transition === "deprovision" && !["active", "suspended"].includes(member.status)) {
      throw authorizationError("INVALID_TRANSITION", "Only an active or suspended member can be deprovisioned.", correlationId);
    }
    if (member.status === "active") await protectFinalAdmin(client, context.organizationId, personId, correlationId);
    const revoked = await revokeAccess(client, context.organizationId, personId);
    await client.query(
      `UPDATE identity.organization_workforce_members
          SET status=$3,
              suspended_at=CASE WHEN $3='suspended' THEN transaction_timestamp() ELSE NULL END,
              deprovisioned_at=CASE WHEN $3='deprovisioned' THEN transaction_timestamp() ELSE NULL END,
              lifecycle_reason=$4,lifecycle_version=lifecycle_version+1,updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND person_id=$2`,
      [context.organizationId, personId, transition === "suspend" ? "suspended" : "deprovisioned", reason]
    );
    if (transition === "deprovision") {
      await client.query("DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2",
        [context.organizationId, personId]);
    }
    await audit(client, context.organizationId, context.actorPersonId,
      `organization.workforce_${transition === "suspend" ? "suspended" : "deprovisioned"}`,
      `person:${personId}`, correlationId, { reason, revokedSessions: revoked.sessions, revokedProjections: revoked.projections });
    return;
  }
  await audit(client, context.organizationId, context.actorPersonId, "organization.workforce_activated",
    `person:${personId}`, correlationId, { reason });
}

export async function replaceWorkforceMemberRoles(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  personId: string,
  input: { roles: OrganizationRole[]; expectedRevision: string },
  correlationId: string
): Promise<{ personId: string; roles: OrganizationRole[]; revision: string }> {
  const next = cleanRoles(input.roles, correlationId);
  if (!uuid.test(personId) || !/^[0-9a-f]{64}$/u.test(input.expectedRevision)) {
    throw authorizationError("VALIDATION_FAILED", "The Organization Role change is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    await requireEntitledRoles(client, principal.organizationId, next, correlationId);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`organization-members:${principal.organizationId}`]);
    const workforce = await client.query<{ status: string }>(
      `SELECT status FROM identity.organization_workforce_members
        WHERE organization_id=$1 AND person_id=$2 FOR UPDATE`, [principal.organizationId, personId]
    );
    if (workforce.rows[0]?.status !== "active") {
      throw authorizationError("INVALID_TRANSITION", "Organization Roles can change only for an active workforce member.", correlationId);
    }
    const current = await client.query<{ organization_role: OrganizationRole }>(
      `SELECT organization_role FROM identity.memberships
        WHERE organization_id=$1 AND person_id=$2 ORDER BY organization_role FOR UPDATE`,
      [principal.organizationId, personId]
    );
    const before = current.rows.map(({ organization_role }) => organization_role);
    if (roleRevision(before) !== input.expectedRevision) {
      throw authorizationError("STALE_AGGREGATE_VERSION", "Organization Roles changed in another view. Refresh before trying again.", correlationId);
    }
    if (before.includes("admin") && !next.includes("admin")) {
      await protectFinalAdmin(client, principal.organizationId, personId, correlationId);
    }
    await client.query(
      `DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2
        AND NOT (organization_role=ANY($3::text[]))`, [principal.organizationId, personId, next]
    );
    for (const role of next) {
      await client.query(
        `INSERT INTO identity.memberships(organization_id,person_id,organization_role)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [principal.organizationId, personId, role]
      );
    }
    await audit(client, principal.organizationId, principal.principalId, "organization.roles_replaced",
      `person:${personId}`, correlationId, { before, after: next });
    return { personId, roles: next, revision: roleRevision(next) };
  });
}

async function workforceProjection(client: PoolClient, organizationId: string): Promise<OrganizationWorkforceV1> {
  const [memberRows, invitationRows, credentialRows, mappingRows, reviewRows, reviewItemRows, provisioningRows, operationRows] = await Promise.all([
    client.query<{
      person_id: string; display_name: string; primary_email: string | null; external_id: string | null;
      source: "legacy" | "invitation" | "scim"; status: "invited" | "active" | "suspended" | "deprovisioned";
      lifecycle_version: string; roles: OrganizationRole[]; last_scim_seen_at: Date | null; last_access_reviewed_at: Date | null;
    }>(
      `SELECT workforce.person_id,person.display_name,workforce.primary_email,workforce.external_id,
              workforce.source,workforce.status,workforce.lifecycle_version::text,
              COALESCE(array_agg(membership.organization_role ORDER BY membership.organization_role)
                FILTER (WHERE membership.organization_role IS NOT NULL),ARRAY[]::text[])::text[] AS roles,
              workforce.last_scim_seen_at,workforce.last_access_reviewed_at
         FROM identity.organization_workforce_members workforce
         JOIN identity.persons person ON person.id=workforce.person_id
         LEFT JOIN identity.memberships membership
           ON membership.organization_id=workforce.organization_id AND membership.person_id=workforce.person_id
        WHERE workforce.organization_id=$1
        GROUP BY workforce.organization_id,workforce.person_id,person.display_name
        ORDER BY (workforce.status='active') DESC,lower(person.display_name),workforce.person_id`, [organizationId]
    ),
    client.query<{
      id: string; email: string; display_name: string; requested_roles: string[]; expires_at: Date;
      accepted_at: Date | null; identity_linked_at: Date | null; revoked_at: Date | null;
      delivery_status: "queued" | "sent" | "delivered" | "bounced" | "failed" | "cancelled"; delivery_failure_reason: string | null;
    }>(
      `SELECT id,email,display_name,requested_roles,expires_at,accepted_at,identity_linked_at,revoked_at,
              delivery_status,delivery_failure_reason
         FROM identity.organization_workforce_invitations WHERE organization_id=$1
        ORDER BY created_at DESC LIMIT 50`, [organizationId]
    ),
    client.query<{
      id: string; label: string; token_prefix: string; expires_at: Date | null; last_used_at: Date | null; revoked_at: Date | null;
    }>(`SELECT id,label,token_prefix,expires_at,last_used_at,revoked_at FROM identity.organization_scim_credentials
          WHERE organization_id=$1 ORDER BY created_at DESC`, [organizationId]),
    client.query<{
      id: string; group_external_id: string; group_display_name: string; organization_role: string;
      identity_provider_id: string | null; member_count: string;
    }>(
      `SELECT mapping.id,mapping.group_external_id,mapping.group_display_name,mapping.organization_role,
              mapping.identity_provider_id,count(assignment.person_id) FILTER (WHERE assignment.removed_at IS NULL)::text AS member_count
         FROM identity.organization_group_role_mappings mapping
         LEFT JOIN identity.organization_group_assignments assignment
           ON assignment.organization_id=mapping.organization_id AND assignment.mapping_id=mapping.id
        WHERE mapping.organization_id=$1 AND mapping.revoked_at IS NULL
        GROUP BY mapping.id ORDER BY lower(mapping.group_display_name),mapping.id`, [organizationId]
    ),
    client.query<{ id: string; status: "open" | "completed"; started_at: Date }>(
      `SELECT id,status,started_at FROM identity.organization_access_reviews
        WHERE organization_id=$1 ORDER BY started_at DESC LIMIT 1`, [organizationId]
    ),
    client.query<{
      id: string; review_id: string; person_id: string; display_name: string; status_snapshot: string;
      roles_snapshot: string[]; decision: "retain" | "suspend" | "deprovision" | null; decision_reason: string | null;
    }>(
      `SELECT item.id,item.review_id,item.person_id,person.display_name,item.status_snapshot,item.roles_snapshot,
              item.decision,item.decision_reason
         FROM identity.organization_access_review_items item
         JOIN identity.persons person ON person.id=item.person_id
        WHERE item.organization_id=$1
          AND item.review_id=(SELECT id FROM identity.organization_access_reviews
            WHERE organization_id=$1 ORDER BY started_at DESC LIMIT 1)
        ORDER BY lower(person.display_name),item.person_id`, [organizationId]
    ),
    client.query<{ configuration_status: string; entitlements: string[]; last_review_at: Date | null; stale_scim: string; group_candidates: string }>(
      `SELECT provisioning.configuration_status,provisioning.entitlements,
              (SELECT max(completed_at) FROM identity.organization_access_reviews
                WHERE organization_id=$1 AND status='completed') AS last_review_at,
              (SELECT count(*)::text FROM identity.organization_workforce_members
                WHERE organization_id=$1 AND source='scim' AND status='active'
                  AND last_scim_seen_at<transaction_timestamp()-interval '7 days') AS stale_scim,
              (SELECT count(*)::text FROM identity.organization_group_assignments assignment
                JOIN identity.organization_group_role_mappings mapping ON mapping.id=assignment.mapping_id
                WHERE assignment.organization_id=$1 AND assignment.removed_at IS NOT NULL AND mapping.revoked_at IS NULL
                  AND EXISTS (SELECT 1 FROM identity.memberships membership
                    WHERE membership.organization_id=$1 AND membership.person_id=assignment.person_id
                      AND membership.organization_role=mapping.organization_role)) AS group_candidates
         FROM identity.organization_provisioning provisioning WHERE provisioning.organization_id=$1`, [organizationId]
    ),
    client.query<{
      id: string; source: "entra" | "okta" | "scim" | "invitation" | "reconciliation";
      operation_type: string; target_ref: string; status: "received" | "succeeded" | "failed" | "retry_pending";
      attempt_count: number; last_error_code: string | null; last_error_reason: string | null;
      started_at: Date; completed_at: Date | null; next_retry_at: Date | null;
    }>(
      `SELECT id,source,operation_type,target_ref,status,attempt_count,last_error_code,last_error_reason,
              started_at,completed_at,next_retry_at
         FROM identity.organization_provisioning_operations
        WHERE organization_id=$1 ORDER BY started_at DESC,id DESC LIMIT 50`, [organizationId]
    )
  ]);
  const review = reviewRows.rows[0];
  const provisioning = provisioningRows.rows[0];
  const entitlementConflicts = provisioning?.configuration_status === "complete" ? memberRows.rows.reduce((count, member) =>
    count + member.roles.filter((role) => roleEntitlements[role] !== undefined &&
      !provisioning.entitlements.includes(roleEntitlements[role] as string)).length, 0) : 0;
  return {
    contractId: ORGANIZATION_WORKFORCE_CONTRACT_ID,
    roles: [...roles],
    members: memberRows.rows.map((member) => ({
      personId: member.person_id, displayName: member.display_name, email: member.primary_email,
      externalId: member.external_id, source: member.source, status: member.status,
      lifecycleVersion: Number(member.lifecycle_version), roles: member.roles, roleRevision: roleRevision(member.roles),
      lastScimSeenAt: member.last_scim_seen_at?.toISOString() ?? null,
      lastAccessReviewedAt: member.last_access_reviewed_at?.toISOString() ?? null
    })),
    invitations: invitationRows.rows.map((invitation) => ({
      id: invitation.id, email: invitation.email, displayName: invitation.display_name, roles: invitation.requested_roles,
      status: invitation.revoked_at !== null ? "revoked" : invitation.identity_linked_at !== null ? "linked" :
        invitation.accepted_at !== null ? "accepted" : invitation.expires_at.getTime() <= Date.now() ? "expired" : "pending",
      deliveryStatus: invitation.delivery_status, expiresAt: invitation.expires_at.toISOString(),
      deliveryFailure: invitation.delivery_failure_reason
    })),
    scimCredentials: credentialRows.rows.map((credential) => ({
      id: credential.id, label: credential.label, tokenPrefix: credential.token_prefix,
      expiresAt: credential.expires_at?.toISOString() ?? null, lastUsedAt: credential.last_used_at?.toISOString() ?? null,
      revokedAt: credential.revoked_at?.toISOString() ?? null
    })),
    groupMappings: mappingRows.rows.map((mapping) => ({
      id: mapping.id, groupExternalId: mapping.group_external_id, groupDisplayName: mapping.group_display_name,
      organizationRole: mapping.organization_role, identityProviderId: mapping.identity_provider_id,
      activeMemberCount: Number(mapping.member_count)
    })),
    accessReview: review === undefined ? null : {
      id: review.id, status: review.status, startedAt: review.started_at.toISOString(),
      pendingCount: reviewItemRows.rows.filter((item) => item.decision === null).length,
      items: reviewItemRows.rows.map((item) => ({
        id: item.id, personId: item.person_id, displayName: item.display_name, statusSnapshot: item.status_snapshot,
        rolesSnapshot: item.roles_snapshot, decision: item.decision, decisionReason: item.decision_reason
      }))
    },
    reconciliation: {
      staleScimMembers: Number(provisioning?.stale_scim ?? 0), entitlementConflicts,
      groupRemovalCandidates: Number(provisioning?.group_candidates ?? 0),
      reviewDue: provisioning?.last_review_at === null || provisioning?.last_review_at === undefined ||
        provisioning.last_review_at.getTime() < Date.now() - 90 * 24 * 60 * 60 * 1_000,
      failedOperations: operationRows.rows.filter((operation) => operation.status === "failed" || operation.status === "retry_pending").length,
      lastRunAt: operationRows.rows.find((operation) => operation.operation_type === "workforce_reconciliation")?.started_at.toISOString() ?? null
    },
    provisioningOperations: operationRows.rows.map((operation) => ({
      id: operation.id, source: operation.source, operationType: operation.operation_type,
      targetRef: operation.target_ref, status: operation.status, attemptCount: operation.attempt_count,
      errorCode: operation.last_error_code, errorReason: operation.last_error_reason,
      startedAt: operation.started_at.toISOString(), completedAt: operation.completed_at?.toISOString() ?? null,
      nextRetryAt: operation.next_retry_at?.toISOString() ?? null
    }))
  } as OrganizationWorkforceV1;
}

export async function getOrganizationWorkforce(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    return workforceProjection(client, principal.organizationId);
  });
}

export type ProvisioningOperationSource = "entra" | "okta" | "scim" | "invitation" | "reconciliation";

export async function beginProvisioningOperation(
  pool: Pool,
  context: ScimCredentialContext,
  input: { source: ProvisioningOperationSource; operationType: string; targetRef: string; externalRequestId?: string },
  correlationId: string
): Promise<string> {
  const operationId = randomUUID();
  const externalRequestId = input.externalRequestId?.trim().slice(0, 300) || null;
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO identity.organization_provisioning_operations(
         id,organization_id,source,operation_type,target_ref,external_request_id,status,actor_person_id,metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,'received',$7,$8::jsonb)
       ON CONFLICT (organization_id,source,external_request_id) WHERE external_request_id IS NOT NULL
       DO UPDATE SET status='received',attempt_count=LEAST(identity.organization_provisioning_operations.attempt_count+1,10),
                     completed_at=NULL,next_retry_at=NULL,last_error_code=NULL,last_error_reason=NULL,
                     updated_at=transaction_timestamp()
       RETURNING id`,
      [operationId, context.organizationId, input.source, input.operationType.slice(0, 120), input.targetRef.slice(0, 300),
        externalRequestId, context.actorPersonId, JSON.stringify({ credentialId: context.credentialId, correlationId })]
    );
    const id = result.rows[0]?.id;
    if (id === undefined) throw new Error("Provisioning operation could not be recorded");
    return id;
  });
}

export async function completeProvisioningOperation(
  pool: Pool,
  organizationId: string,
  operationId: string,
  outcome: { status: "succeeded" | "failed"; errorCode?: string; errorReason?: string },
  correlationId: string
): Promise<void> {
  await withOrganizationTransaction(pool, organizationId, async (client) => {
    const current = await client.query<{ attempt_count: number }>(
      `SELECT attempt_count FROM identity.organization_provisioning_operations
        WHERE organization_id=$1 AND id=$2 FOR UPDATE`, [organizationId, operationId]
    );
    const attempt = current.rows[0]?.attempt_count;
    if (attempt === undefined) return;
    const errorReason = outcome.errorReason?.trim().slice(0, 1000) || null;
    await client.query(
      `UPDATE identity.organization_provisioning_operations
          SET status=$3,completed_at=transaction_timestamp(),next_retry_at=NULL,
              last_error_code=$4,last_error_reason=$5,updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2`,
      [organizationId, operationId, outcome.status, outcome.errorCode?.slice(0, 120) ?? null, errorReason]
    );
    await client.query(
      `INSERT INTO identity.organization_provisioning_operation_attempts(
         id,organization_id,operation_id,attempt_number,outcome,error_code,error_reason,correlation_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (operation_id,attempt_number) DO NOTHING`,
      [randomUUID(), organizationId, operationId, attempt, outcome.status,
        outcome.errorCode?.slice(0, 120) ?? null, errorReason, correlationId]
    );
  });
}

export async function scheduleProvisioningOperationRetry(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  operationId: string,
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  if (!uuid.test(operationId)) throw authorizationError("VALIDATION_FAILED", "The provisioning operation is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const result = await client.query(
      `UPDATE identity.organization_provisioning_operations
          SET status='retry_pending',next_retry_at=transaction_timestamp(),completed_at=NULL,
              updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2 AND status='failed' AND attempt_count<10`,
      [principal.organizationId, operationId]
    );
    if (result.rowCount !== 1) throw authorizationError("INVALID_TRANSITION",
      "Only a failed provisioning operation below the retry limit can be prepared for retry.", correlationId);
    await audit(client, principal.organizationId, principal.principalId, "organization.provisioning_retry_scheduled",
      `provisioning_operation:${operationId}`, correlationId);
    return workforceProjection(client, principal.organizationId);
  });
}

export async function runOrganizationWorkforceReconciliation(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const operationId = randomUUID();
    const findings = await client.query<{ stale_scim: string; group_candidates: string; entitlement_conflicts: string }>(
      `SELECT
         (SELECT count(*)::text FROM identity.organization_workforce_members
           WHERE organization_id=$1 AND source='scim' AND status='active'
             AND last_scim_seen_at<transaction_timestamp()-interval '7 days') AS stale_scim,
         (SELECT count(*)::text FROM identity.organization_group_assignments assignment
           JOIN identity.organization_group_role_mappings mapping ON mapping.id=assignment.mapping_id
          WHERE assignment.organization_id=$1 AND assignment.removed_at IS NOT NULL AND mapping.revoked_at IS NULL
            AND EXISTS (SELECT 1 FROM identity.memberships membership
              WHERE membership.organization_id=$1 AND membership.person_id=assignment.person_id
                AND membership.organization_role=mapping.organization_role)) AS group_candidates,
         (SELECT count(*)::text FROM identity.memberships membership
           JOIN identity.organization_workforce_members workforce
             ON workforce.organization_id=membership.organization_id AND workforce.person_id=membership.person_id
           JOIN identity.organization_provisioning provisioning ON provisioning.organization_id=membership.organization_id
          WHERE membership.organization_id=$1 AND workforce.status='active'
            AND ((membership.organization_role IN ('designer','publisher','reviewer') AND NOT ('studio_authoring'=ANY(provisioning.entitlements)))
              OR (membership.organization_role='operator' AND NOT ('session_delivery'=ANY(provisioning.entitlements)))
              OR (membership.organization_role='research_analyst' AND NOT ('research_reporting'=ANY(provisioning.entitlements)))))
          AS entitlement_conflicts`, [principal.organizationId]
    );
    const result = findings.rows[0] ?? { stale_scim: "0", group_candidates: "0", entitlement_conflicts: "0" };
    const metadata = { staleScimMembers: Number(result.stale_scim), groupRemovalCandidates: Number(result.group_candidates),
      entitlementConflicts: Number(result.entitlement_conflicts), accessChanged: false, correlationId };
    await client.query(
      `INSERT INTO identity.organization_provisioning_operations(
         id,organization_id,source,operation_type,target_ref,status,actor_person_id,metadata,completed_at
       ) VALUES ($1,$2,'reconciliation','workforce_reconciliation',$3,'succeeded',$4,$5::jsonb,transaction_timestamp())`,
      [operationId, principal.organizationId, `organization:${principal.organizationId}`, principal.principalId, JSON.stringify(metadata)]
    );
    await client.query(
      `INSERT INTO identity.organization_provisioning_operation_attempts(
         id,organization_id,operation_id,attempt_number,outcome,correlation_id
       ) VALUES ($1,$2,$3,1,'succeeded',$4)`, [randomUUID(), principal.organizationId, operationId, correlationId]
    );
    await audit(client, principal.organizationId, principal.principalId, "organization.workforce_reconciled",
      `provisioning_operation:${operationId}`, correlationId, metadata);
    return workforceProjection(client, principal.organizationId);
  });
}

export async function recordInvitationDeliveryEvent(
  pool: Pool,
  input: { providerEventId: string; deliveryId: string; status: "delivered" | "bounced" | "failed";
    occurredAt: string; reason?: string },
  correlationId: string
): Promise<{ accepted: true; duplicate: boolean }> {
  const occurredAt = new Date(input.occurredAt);
  if (!uuid.test(input.deliveryId) || input.providerEventId.trim().length === 0 || input.providerEventId.length > 300 ||
      !["delivered", "bounced", "failed"].includes(input.status) || !Number.isFinite(occurredAt.getTime()) ||
      (input.reason?.length ?? 0) > 1000) {
    throw authorizationError("VALIDATION_FAILED", "The invitation delivery event is invalid.", correlationId);
  }
  return withRestrictedTransaction(pool, async (client) => {
    const result = await client.query<{ organization_id: string; invitation_kind: string; invitation_id: string; duplicate: boolean }>(
      "SELECT * FROM identity.record_invitation_delivery_event($1,$2,$3,$4,$5)",
      [input.providerEventId.trim(), input.deliveryId, input.status, occurredAt, input.reason?.trim() ?? ""]
    );
    const receipt = result.rows[0];
    if (receipt === undefined) throw authorizationError("NOT_FOUND", "The invitation delivery was not found.", correlationId);
    return { accepted: true, duplicate: receipt.duplicate };
  });
}

export async function createOrganizationScimCredential(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: { label: string; expiresAt?: string },
  correlationId: string
): Promise<{ credential: string; workforce: OrganizationWorkforceV1 }> {
  const label = input.label.trim();
  const expiresAt = input.expiresAt === undefined ? null : new Date(input.expiresAt);
  if (label.length < 2 || label.length > 120 || (expiresAt !== null &&
      (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()))) {
    throw authorizationError("VALIDATION_FAILED", "The SCIM credential label or expiry is invalid.", correlationId);
  }
  const credential = `plenum_scim_${randomBytes(32).toString("base64url")}`;
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const organization = await client.query("SELECT 1 FROM identity.organizations WHERE id=$1 AND lifecycle_status='active'",
      [principal.organizationId]);
    if (organization.rowCount !== 1) throw authorizationError("INVALID_TRANSITION", "The Organization must be active before SCIM can be enabled.", correlationId);
    const credentialId = randomUUID();
    await client.query(
      `INSERT INTO identity.organization_scim_credentials
         (id,organization_id,label,token_prefix,token_sha256,created_by,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [credentialId, principal.organizationId, label, credential.slice(0, 20), sha256(credential), principal.principalId, expiresAt]
    );
    await audit(client, principal.organizationId, principal.principalId, "organization.scim_credential_created",
      `scim_credential:${credentialId}`, correlationId, { label, expiresAt: expiresAt?.toISOString() ?? null });
    return { credential, workforce: await workforceProjection(client, principal.organizationId) };
  });
}

export async function revokeOrganizationScimCredential(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  credentialId: string,
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  if (!uuid.test(credentialId)) throw authorizationError("VALIDATION_FAILED", "The SCIM credential is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const revoked = await client.query(
      `UPDATE identity.organization_scim_credentials SET revoked_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2 AND revoked_at IS NULL`, [principal.organizationId, credentialId]
    );
    if (revoked.rowCount !== 1) throw authorizationError("NOT_FOUND", "The active SCIM credential was not found.", correlationId);
    await audit(client, principal.organizationId, principal.principalId, "organization.scim_credential_revoked",
      `scim_credential:${credentialId}`, correlationId);
    return workforceProjection(client, principal.organizationId);
  });
}

export async function issueOrganizationWorkforceInvitation(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: { email: string; displayName: string; roles: string[] },
  correlationId: string,
  delivery: FirstAdminInvitationDelivery,
  baseUrl: string
): Promise<{ workforce: OrganizationWorkforceV1; invitationUrl?: string }> {
  const email = cleanEmail(input.email, correlationId);
  const displayName = input.displayName.trim();
  const requestedRoles = cleanRoles(input.roles, correlationId);
  if (displayName.length < 2 || displayName.length > 200) {
    throw authorizationError("VALIDATION_FAILED", "A display name between 2 and 200 characters is required.", correlationId);
  }
  const token = randomBytes(32).toString("base64url");
  const queued = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    await requireEntitledRoles(client, principal.organizationId, requestedRoles, correlationId);
    await requireVerifiedEmailDomain(client, principal.organizationId, email, correlationId);
    const existing = await client.query(
      `SELECT 1 FROM identity.organization_workforce_members
        WHERE organization_id=$1 AND primary_email=$2 AND status<>'deprovisioned'`, [principal.organizationId, email]
    );
    if (existing.rowCount !== 0) throw authorizationError("TARGET_EXISTS", "That work email already belongs to the Organization workforce.", correlationId);
    const invitationId = randomUUID();
    const deliveryId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    await client.query(
      `INSERT INTO identity.organization_workforce_invitations
         (id,organization_id,email,display_name,requested_roles,token_sha256,invited_by,expires_at,delivery_id,delivery_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'queued')`,
      [invitationId, principal.organizationId, email, displayName, requestedRoles, sha256(token), principal.principalId, expiresAt, deliveryId]
    );
    const organization = await client.query<{ name: string }>("SELECT name FROM identity.organizations WHERE id=$1", [principal.organizationId]);
    await audit(client, principal.organizationId, principal.principalId, "organization.workforce_invitation_issued",
      `workforce_invitation:${invitationId}`, correlationId, { email, roles: requestedRoles, expiresAt: expiresAt.toISOString() });
    return { invitationId, deliveryId, expiresAt, organizationName: organization.rows[0]?.name ?? "Organization" };
  });
  const invitationUrl = new URL(`/organization/invitations/${token}`, baseUrl).toString();
  let providerReference: string | null = null;
  let previewUrl: string | undefined;
  let failureReason: string | null = null;
  try {
    const delivered = await delivery.deliver({ messageType: "ORGANIZATION_WORKFORCE_INVITATION",
      deliveryId: queued.deliveryId, recipientEmail: email, organizationName: queued.organizationName,
      invitationUrl, expiresAt: queued.expiresAt.toISOString(), templateRef: "organization-workforce-invitation-v1" });
    providerReference = delivered.providerReference;
    previewUrl = delivered.previewUrl;
  } catch {
    failureReason = "Invitation delivery failed. Reissue after checking the delivery provider.";
  }
  const workforce = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    await client.query(
      `UPDATE identity.organization_workforce_invitations
          SET delivery_status=CASE WHEN $2::text IS NULL THEN 'sent' ELSE 'failed' END,
              delivery_attempt_count=delivery_attempt_count+1,provider_reference=$3,delivery_failure_reason=$2,
              sent_at=CASE WHEN $2::text IS NULL THEN transaction_timestamp() ELSE NULL END,
              failed_at=CASE WHEN $2::text IS NULL THEN NULL ELSE transaction_timestamp() END,
              updated_at=transaction_timestamp()
        WHERE id=$1 AND organization_id=$4`,
      [queued.invitationId, failureReason, providerReference, principal.organizationId]
    );
    await audit(client, principal.organizationId, principal.principalId,
      failureReason === null ? "organization.workforce_invitation_delivered" : "organization.workforce_invitation_delivery_failed",
      `workforce_invitation:${queued.invitationId}`, correlationId,
      failureReason === null ? { providerReference: providerReference ?? "unavailable" } : { reason: failureReason });
    return workforceProjection(client, principal.organizationId);
  });
  return { workforce, ...(previewUrl === undefined ? {} : { invitationUrl: previewUrl }) };
}

export async function revokeOrganizationWorkforceInvitation(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  invitationId: string,
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  if (!uuid.test(invitationId)) throw authorizationError("VALIDATION_FAILED", "The invitation is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const result = await client.query(
      `UPDATE identity.organization_workforce_invitations
          SET revoked_at=transaction_timestamp(),delivery_status=CASE WHEN delivery_status='queued' THEN 'cancelled' ELSE delivery_status END,
              updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [principal.organizationId, invitationId]
    );
    if (result.rowCount !== 1) throw authorizationError("INVALID_TRANSITION", "Only a pending invitation can be revoked.", correlationId);
    await audit(client, principal.organizationId, principal.principalId, "organization.workforce_invitation_revoked",
      `workforce_invitation:${invitationId}`, correlationId);
    return workforceProjection(client, principal.organizationId);
  });
}

export async function reissueOrganizationWorkforceInvitation(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  invitationId: string,
  correlationId: string,
  delivery: FirstAdminInvitationDelivery,
  publicBaseUrl: string
): Promise<{ workforce: OrganizationWorkforceV1; invitationUrl?: string }> {
  if (!uuid.test(invitationId)) throw authorizationError("VALIDATION_FAILED", "The invitation is invalid.", correlationId);
  const previous = await withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const result = await client.query<{ email: string; display_name: string; requested_roles: OrganizationRole[] }>(
      `UPDATE identity.organization_workforce_invitations
          SET revoked_at=transaction_timestamp(),delivery_status=CASE WHEN delivery_status='queued' THEN 'cancelled' ELSE delivery_status END,
              updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2 AND accepted_at IS NULL AND identity_linked_at IS NULL AND revoked_at IS NULL
        RETURNING email,display_name,requested_roles`, [principal.organizationId, invitationId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("INVALID_TRANSITION", "Only an unaccepted invitation can be reissued.", correlationId);
    await audit(client, principal.organizationId, principal.principalId, "organization.workforce_invitation_reissued",
      `workforce_invitation:${invitationId}`, correlationId, { email: row.email });
    return row;
  });
  return issueOrganizationWorkforceInvitation(pool, principal, {
    email: previous.email, displayName: previous.display_name, roles: previous.requested_roles
  }, correlationId, delivery, publicBaseUrl);
}

export async function acceptOrganizationWorkforceInvitation(
  pool: Pool,
  token: string,
  displayName: string,
  correlationId: string
): Promise<{ organizationId: string; organizationName: string; personId: string; email: string }> {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) {
    throw authorizationError("INVALID_TRANSITION", "The workforce invitation is invalid or expired.", correlationId);
  }
  return withRestrictedTransaction(pool, async (client) => {
    const result = await client.query<{
      organization_id: string; organization_name: string; person_id: string; email: string;
    }>("SELECT * FROM identity.accept_organization_workforce_invitation($1,$2,$3,$4)",
      [sha256(token), randomUUID(), displayName, correlationId]);
    const accepted = result.rows[0];
    if (accepted === undefined) throw authorizationError("INVALID_TRANSITION", "The workforce invitation is invalid or expired.", correlationId);
    return { organizationId: accepted.organization_id, organizationName: accepted.organization_name,
      personId: accepted.person_id, email: accepted.email };
  });
}

export async function createOrganizationGroupRoleMapping(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: { groupExternalId: string; groupDisplayName: string; organizationRole: string; identityProviderId?: string },
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  const groupExternalId = input.groupExternalId.trim();
  const groupDisplayName = input.groupDisplayName.trim();
  const organizationRole = cleanRoles([input.organizationRole], correlationId)[0] as OrganizationRole;
  if (groupExternalId.length < 1 || groupExternalId.length > 300 || groupDisplayName.length < 1 || groupDisplayName.length > 300 ||
      (input.identityProviderId !== undefined && !uuid.test(input.identityProviderId))) {
    throw authorizationError("VALIDATION_FAILED", "The identity-provider group mapping is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    await requireEntitledRoles(client, principal.organizationId, [organizationRole], correlationId);
    if (input.identityProviderId !== undefined) {
      const provider = await client.query(
        `SELECT 1 FROM identity.organization_identity_provider_revisions
          WHERE organization_id=$1 AND id=$2 AND status='active'`, [principal.organizationId, input.identityProviderId]
      );
      if (provider.rowCount !== 1) throw authorizationError("INVALID_TRANSITION", "The mapped identity provider must be active.", correlationId);
    }
    const mappingId = randomUUID();
    await client.query(
      `INSERT INTO identity.organization_group_role_mappings
         (id,organization_id,identity_provider_id,group_external_id,group_display_name,organization_role,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [mappingId, principal.organizationId, input.identityProviderId ?? null, groupExternalId, groupDisplayName,
        organizationRole, principal.principalId]
    );
    await audit(client, principal.organizationId, principal.principalId, "organization.group_role_mapping_created",
      `group_role_mapping:${mappingId}`, correlationId, { groupExternalId, groupDisplayName, organizationRole });
    return workforceProjection(client, principal.organizationId);
  });
}

export async function transitionOrganizationWorkforceMember(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  personId: string,
  input: { transition: "activate" | "suspend" | "deprovision"; expectedVersion: number; reason: string },
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  const reason = cleanReason(input.reason, correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`organization-members:${principal.organizationId}`]);
    await transitionMemberWithClient(client, { organizationId: principal.organizationId, actorPersonId: principal.principalId },
      personId, input.transition, input.expectedVersion, reason, correlationId);
    return workforceProjection(client, principal.organizationId);
  });
}

export async function startOrganizationAccessReview(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const reviewId = randomUUID();
    await client.query(
      `INSERT INTO identity.organization_access_reviews
         (id,organization_id,review_period_start,review_period_end,started_by)
       VALUES ($1,$2,transaction_timestamp()-interval '90 days',transaction_timestamp(),$3)`,
      [reviewId, principal.organizationId, principal.principalId]
    );
    await client.query(
      `INSERT INTO identity.organization_access_review_items
         (id,organization_id,review_id,person_id,status_snapshot,roles_snapshot)
       SELECT gen_random_uuid(),workforce.organization_id,$2,workforce.person_id,workforce.status,
              COALESCE(array_agg(membership.organization_role ORDER BY membership.organization_role)
                FILTER (WHERE membership.organization_role IS NOT NULL),ARRAY[]::text[])::text[]
         FROM identity.organization_workforce_members workforce
         LEFT JOIN identity.memberships membership
           ON membership.organization_id=workforce.organization_id AND membership.person_id=workforce.person_id
        WHERE workforce.organization_id=$1 AND workforce.status IN ('active','suspended')
        GROUP BY workforce.organization_id,workforce.person_id`, [principal.organizationId, reviewId]
    );
    await audit(client, principal.organizationId, principal.principalId, "organization.access_review_started",
      `access_review:${reviewId}`, correlationId);
    return workforceProjection(client, principal.organizationId);
  });
}

export async function decideOrganizationAccessReviewItem(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  itemId: string,
  input: { decision: "retain" | "suspend" | "deprovision"; reason: string },
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  if (!uuid.test(itemId) || !["retain", "suspend", "deprovision"].includes(input.decision)) {
    throw authorizationError("VALIDATION_FAILED", "The access review decision is invalid.", correlationId);
  }
  const reason = cleanReason(input.reason, correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const result = await client.query<{ person_id: string; lifecycle_version: string; status: string }>(
      `SELECT item.person_id,workforce.lifecycle_version::text,workforce.status
         FROM identity.organization_access_review_items item
         JOIN identity.organization_access_reviews review ON review.id=item.review_id AND review.organization_id=item.organization_id
         JOIN identity.organization_workforce_members workforce
           ON workforce.organization_id=item.organization_id AND workforce.person_id=item.person_id
        WHERE item.organization_id=$1 AND item.id=$2 AND item.decision IS NULL AND review.status='open'
        FOR UPDATE OF item,workforce`, [principal.organizationId, itemId]
    );
    const item = result.rows[0];
    if (item === undefined) throw authorizationError("INVALID_TRANSITION", "The access review item is no longer pending.", correlationId);
    if (input.decision !== "retain") {
      await transitionMemberWithClient(client, { organizationId: principal.organizationId, actorPersonId: principal.principalId },
        item.person_id, input.decision, Number(item.lifecycle_version), reason, correlationId);
    }
    await client.query(
      `UPDATE identity.organization_access_review_items
          SET decision=$3,decision_reason=$4,reviewed_by=$5,reviewed_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2`,
      [principal.organizationId, itemId, input.decision, reason, principal.principalId]
    );
    await client.query(
      `UPDATE identity.organization_workforce_members
          SET last_access_reviewed_at=transaction_timestamp(),last_access_reviewed_by=$3,updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND person_id=$2`, [principal.organizationId, item.person_id, principal.principalId]
    );
    await audit(client, principal.organizationId, principal.principalId, "organization.access_review_item_decided",
      `access_review_item:${itemId}`, correlationId, { decision: input.decision, reason });
    return workforceProjection(client, principal.organizationId);
  });
}

export async function completeOrganizationAccessReview(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  reviewId: string,
  correlationId: string
): Promise<OrganizationWorkforceV1> {
  if (!uuid.test(reviewId)) throw authorizationError("VALIDATION_FAILED", "The access review is invalid.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentAdmin(client, principal, correlationId);
    const pending = await client.query(
      `SELECT 1 FROM identity.organization_access_review_items
        WHERE organization_id=$1 AND review_id=$2 AND decision IS NULL LIMIT 1`, [principal.organizationId, reviewId]
    );
    if (pending.rowCount !== 0) throw authorizationError("INVALID_TRANSITION", "Every access review item requires a decision before completion.", correlationId);
    const completed = await client.query(
      `UPDATE identity.organization_access_reviews
          SET status='completed',completed_by=$3,completed_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2 AND status='open'`, [principal.organizationId, reviewId, principal.principalId]
    );
    if (completed.rowCount !== 1) throw authorizationError("INVALID_TRANSITION", "The access review is not open.", correlationId);
    await audit(client, principal.organizationId, principal.principalId, "organization.access_review_completed",
      `access_review:${reviewId}`, correlationId);
    return workforceProjection(client, principal.organizationId);
  });
}

export async function authenticateScimCredential(
  pool: Pool,
  authorization: string | undefined,
  correlationId: string
): Promise<ScimCredentialContext> {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!/^plenum_scim_[A-Za-z0-9_-]{43}$/u.test(token)) {
    throw authorizationError("UNAUTHENTICATED", "A valid SCIM bearer credential is required.", correlationId);
  }
  return withRestrictedTransaction(pool, async (client) => {
    const result = await client.query<{ organization_id: string; credential_id: string; actor_person_id: string }>(
      "SELECT * FROM identity.resolve_scim_credential($1)", [sha256(token)]
    );
    const credential = result.rows[0];
    if (credential === undefined) throw authorizationError("UNAUTHENTICATED", "The SCIM bearer credential is invalid or expired.", correlationId);
    return { organizationId: credential.organization_id, credentialId: credential.credential_id,
      actorPersonId: credential.actor_person_id };
  });
}

type ScimUserInput = { externalId: string; userName: string; displayName: string; active: boolean; roles: OrganizationRole[] };

function parseScimUser(body: JsonObject, correlationId: string, existing?: ScimUserInput): ScimUserInput {
  const externalId = typeof body.externalId === "string" ? body.externalId.trim() : existing?.externalId ?? "";
  const userName = typeof body.userName === "string" ? cleanEmail(body.userName, correlationId) : existing?.userName ?? "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : existing?.displayName ?? "";
  const active = typeof body.active === "boolean" ? body.active : existing?.active ?? true;
  const roleValues = Array.isArray(body.roles) ? body.roles.map((entry) =>
    typeof entry === "string" ? entry : typeof entry === "object" && entry !== null && "value" in entry ? String(entry.value) : "") :
    existing?.roles ?? [];
  if (externalId.length < 1 || externalId.length > 300 || displayName.length < 2 || displayName.length > 200 || userName.length === 0) {
    throw authorizationError("VALIDATION_FAILED", "SCIM userName, displayName, and externalId are required.", correlationId);
  }
  return { externalId, userName, displayName, active, roles: cleanRoles(roleValues, correlationId, true) };
}

function scimUser(row: {
  person_id: string; external_id: string | null; primary_email: string | null; display_name: string;
  status: string; roles: OrganizationRole[]; created_at: Date; updated_at: Date;
}): JsonObject {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], id: row.person_id,
    externalId: row.external_id, userName: row.primary_email, displayName: row.display_name,
    active: row.status === "active", roles: row.roles.map((role) => ({ value: role, type: "OrganizationRole" })),
    meta: { resourceType: "User", created: row.created_at.toISOString(), lastModified: row.updated_at.toISOString(),
      location: `/scim/v2/Users/${row.person_id}` }
  };
}

async function loadScimUser(client: PoolClient, organizationId: string, personId: string) {
  const result = await client.query<{
    person_id: string; external_id: string | null; primary_email: string | null; display_name: string;
    status: string; roles: OrganizationRole[]; created_at: Date; updated_at: Date;
  }>(
    `SELECT workforce.person_id,workforce.external_id,workforce.primary_email,person.display_name,workforce.status,
            COALESCE(array_agg(membership.organization_role ORDER BY membership.organization_role)
              FILTER (WHERE membership.organization_role IS NOT NULL),ARRAY[]::text[])::text[] AS roles,
            workforce.created_at,workforce.updated_at
       FROM identity.organization_workforce_members workforce
       JOIN identity.persons person ON person.id=workforce.person_id
       LEFT JOIN identity.memberships membership
         ON membership.organization_id=workforce.organization_id AND membership.person_id=workforce.person_id
      WHERE workforce.organization_id=$1 AND workforce.person_id=$2
      GROUP BY workforce.organization_id,workforce.person_id,person.display_name`, [organizationId, personId]
  );
  return result.rows[0];
}

async function setRolesWithClient(
  client: PoolClient,
  context: ScimCredentialContext,
  personId: string,
  next: OrganizationRole[],
  correlationId: string
): Promise<void> {
  await requireEntitledRoles(client, context.organizationId, next, correlationId);
  const current = await client.query<{ organization_role: OrganizationRole }>(
    `SELECT organization_role FROM identity.memberships
      WHERE organization_id=$1 AND person_id=$2 ORDER BY organization_role FOR UPDATE`, [context.organizationId, personId]
  );
  const before = current.rows.map(({ organization_role }) => organization_role);
  if (before.includes("admin") && !next.includes("admin")) await protectFinalAdmin(client, context.organizationId, personId, correlationId);
  await client.query(
    `DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2
      AND NOT (organization_role=ANY($3::text[]))`, [context.organizationId, personId, next]
  );
  for (const role of next) {
    await client.query(
      `INSERT INTO identity.memberships(organization_id,person_id,organization_role)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [context.organizationId, personId, role]
    );
  }
  if (JSON.stringify(before) !== JSON.stringify(next)) {
    await audit(client, context.organizationId, context.actorPersonId, "organization.scim_roles_replaced",
      `person:${personId}`, correlationId, { credentialId: context.credentialId, before, after: next });
  }
}

export async function listScimUsers(
  pool: Pool,
  context: ScimCredentialContext,
  input: { startIndex: number; count: number; filter?: string },
  correlationId: string
): Promise<ScimListResponse> {
  const startIndex = Math.max(1, input.startIndex);
  const count = Math.min(200, Math.max(1, input.count));
  const filterMatch = input.filter?.match(/^userName eq "([^"]+)"$/u);
  if (input.filter !== undefined && filterMatch === null) {
    throw authorizationError("VALIDATION_FAILED", "Only the SCIM userName eq filter is supported.", correlationId);
  }
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const email = filterMatch?.[1]?.trim().toLowerCase() ?? null;
    const result = await client.query<{
      person_id: string; external_id: string | null; primary_email: string | null; display_name: string;
      status: string; roles: OrganizationRole[]; created_at: Date; updated_at: Date; total_count: string;
    }>(
      `SELECT workforce.person_id,workforce.external_id,workforce.primary_email,person.display_name,workforce.status,
              COALESCE(array_agg(membership.organization_role ORDER BY membership.organization_role)
                FILTER (WHERE membership.organization_role IS NOT NULL),ARRAY[]::text[])::text[] AS roles,
              workforce.created_at,workforce.updated_at,count(*) OVER()::text AS total_count
         FROM identity.organization_workforce_members workforce
         JOIN identity.persons person ON person.id=workforce.person_id
         LEFT JOIN identity.memberships membership
           ON membership.organization_id=workforce.organization_id AND membership.person_id=workforce.person_id
        WHERE workforce.organization_id=$1 AND ($2::text IS NULL OR workforce.primary_email=$2)
        GROUP BY workforce.organization_id,workforce.person_id,person.display_name
        ORDER BY workforce.created_at,workforce.person_id OFFSET $3 LIMIT $4`,
      [context.organizationId, email, startIndex - 1, count]
    );
    return { schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: Number(result.rows[0]?.total_count ?? 0), startIndex,
      itemsPerPage: result.rows.length, Resources: result.rows.map(scimUser) };
  });
}

export async function getScimUser(
  pool: Pool,
  context: ScimCredentialContext,
  personId: string,
  correlationId: string
): Promise<JsonObject> {
  if (!uuid.test(personId)) throw authorizationError("NOT_FOUND", "The SCIM User was not found.", correlationId);
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const row = await loadScimUser(client, context.organizationId, personId);
    if (row === undefined) throw authorizationError("NOT_FOUND", "The SCIM User was not found.", correlationId);
    return scimUser(row);
  });
}

export async function createScimUser(
  pool: Pool,
  context: ScimCredentialContext,
  body: JsonObject,
  correlationId: string
): Promise<JsonObject> {
  const input = parseScimUser(body, correlationId);
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    await requireVerifiedEmailDomain(client, context.organizationId, input.userName, correlationId);
    await requireEntitledRoles(client, context.organizationId, input.roles, correlationId);
    const organization = await client.query("SELECT 1 FROM identity.organizations WHERE id=$1 AND lifecycle_status='active'", [context.organizationId]);
    if (organization.rowCount !== 1) throw authorizationError("INVALID_TRANSITION", "The Organization is not active.", correlationId);
    const personId = randomUUID();
    await client.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,$2)", [personId, input.displayName]);
    await client.query(
      `INSERT INTO identity.organization_workforce_members
         (organization_id,person_id,primary_email,external_id,source,status,joined_at,suspended_at,last_scim_seen_at,created_by)
       VALUES ($1,$2,$3,$4,'scim',$5,CASE WHEN $5='active' THEN transaction_timestamp() ELSE NULL END,
               CASE WHEN $5='suspended' THEN transaction_timestamp() ELSE NULL END,transaction_timestamp(),$6)`,
      [context.organizationId, personId, input.userName, input.externalId, input.active ? "active" : "suspended", context.actorPersonId]
    );
    for (const role of input.roles) {
      await client.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,$3)",
        [context.organizationId, personId, role]);
    }
    await audit(client, context.organizationId, context.actorPersonId, "organization.scim_user_provisioned",
      `person:${personId}`, correlationId, { credentialId: context.credentialId, externalId: input.externalId,
        roles: input.roles, status: input.active ? "active" : "suspended" });
    const row = await loadScimUser(client, context.organizationId, personId);
    if (row === undefined) throw new Error("SCIM workforce projection was unavailable");
    return scimUser(row);
  });
}

export async function replaceScimUser(
  pool: Pool,
  context: ScimCredentialContext,
  personId: string,
  body: JsonObject,
  correlationId: string
): Promise<JsonObject> {
  if (!uuid.test(personId)) throw authorizationError("NOT_FOUND", "The SCIM User was not found.", correlationId);
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const current = await loadScimUser(client, context.organizationId, personId);
    if (current === undefined || current.primary_email === null || current.external_id === null) {
      throw authorizationError("NOT_FOUND", "The SCIM User was not found.", correlationId);
    }
    const input = parseScimUser(body, correlationId, { externalId: current.external_id, userName: current.primary_email,
      displayName: current.display_name, active: current.status === "active", roles: current.roles });
    await requireVerifiedEmailDomain(client, context.organizationId, input.userName, correlationId);
    await client.query("UPDATE identity.persons SET display_name=$2 WHERE id=$1", [personId, input.displayName]);
    await client.query(
      `UPDATE identity.organization_workforce_members
          SET primary_email=$3,external_id=$4,last_scim_seen_at=transaction_timestamp(),updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND person_id=$2`, [context.organizationId, personId, input.userName, input.externalId]
    );
    await setRolesWithClient(client, context, personId, input.roles, correlationId);
    if (input.active !== (current.status === "active")) {
      await transitionMemberWithClient(client, { organizationId: context.organizationId, actorPersonId: context.actorPersonId },
        personId, input.active ? "activate" : "suspend",
        Number((await client.query<{ lifecycle_version: string }>(
          "SELECT lifecycle_version::text FROM identity.organization_workforce_members WHERE organization_id=$1 AND person_id=$2",
          [context.organizationId, personId])).rows[0]?.lifecycle_version),
        "SCIM active state changed", correlationId);
    }
    const row = await loadScimUser(client, context.organizationId, personId);
    if (row === undefined) throw new Error("SCIM workforce projection was unavailable");
    return scimUser(row);
  });
}

export async function patchScimUser(
  pool: Pool,
  context: ScimCredentialContext,
  personId: string,
  body: JsonObject,
  correlationId: string
): Promise<JsonObject> {
  const operations = body.Operations;
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > 20) {
    throw authorizationError("VALIDATION_FAILED", "SCIM PATCH requires between 1 and 20 operations.", correlationId);
  }
  const current = await getScimUser(pool, context, personId, correlationId);
  const replacement: JsonObject = {
    externalId: current.externalId as string,
    userName: current.userName as string,
    displayName: current.displayName as string,
    active: current.active as boolean,
    roles: current.roles as JsonObject[]
  };
  for (const raw of operations) {
    if (typeof raw !== "object" || raw === null || !("op" in raw)) {
      throw authorizationError("VALIDATION_FAILED", "A SCIM PATCH operation is invalid.", correlationId);
    }
    const operation = raw as JsonObject;
    const op = String(operation.op).toLowerCase();
    const path = typeof operation.path === "string" ? operation.path : "";
    if (!["add", "replace"].includes(op) || !["active", "displayName", "userName", "externalId", "roles"].includes(path)) {
      throw authorizationError("VALIDATION_FAILED", "The SCIM PATCH path or operation is not supported.", correlationId);
    }
    replacement[path] = operation.value as never;
  }
  return replaceScimUser(pool, context, personId, replacement, correlationId);
}

export async function deprovisionScimUser(
  pool: Pool,
  context: ScimCredentialContext,
  personId: string,
  correlationId: string
): Promise<void> {
  await withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const member = await client.query<{ lifecycle_version: string }>(
      `SELECT lifecycle_version::text FROM identity.organization_workforce_members
        WHERE organization_id=$1 AND person_id=$2 AND source='scim'`, [context.organizationId, personId]
    );
    if (member.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The SCIM User was not found.", correlationId);
    await transitionMemberWithClient(client, { organizationId: context.organizationId, actorPersonId: context.actorPersonId },
      personId, "deprovision", Number(member.rows[0].lifecycle_version), "SCIM User deleted", correlationId);
  });
}

function scimGroup(row: {
  id: string; group_external_id: string; group_display_name: string; organization_role: string; members: string[];
}): JsonObject {
  return { schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"], id: row.id,
    externalId: row.group_external_id, displayName: row.group_display_name,
    members: row.members.map((value) => ({ value, $ref: `/scim/v2/Users/${value}` })),
    meta: { resourceType: "Group", location: `/scim/v2/Groups/${row.id}` },
    "urn:plenum:params:scim:schemas:extension:governance:2.0:Group": { organizationRole: row.organization_role } };
}

export async function listScimGroups(
  pool: Pool,
  context: ScimCredentialContext
): Promise<ScimListResponse> {
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const result = await client.query<{
      id: string; group_external_id: string; group_display_name: string; organization_role: string; members: string[];
    }>(
      `SELECT mapping.id,mapping.group_external_id,mapping.group_display_name,mapping.organization_role,
              COALESCE(array_agg(assignment.person_id ORDER BY assignment.person_id)
                FILTER (WHERE assignment.removed_at IS NULL),ARRAY[]::uuid[])::text[] AS members
         FROM identity.organization_group_role_mappings mapping
         LEFT JOIN identity.organization_group_assignments assignment
           ON assignment.organization_id=mapping.organization_id AND assignment.mapping_id=mapping.id
        WHERE mapping.organization_id=$1 AND mapping.revoked_at IS NULL
        GROUP BY mapping.id ORDER BY lower(mapping.group_display_name),mapping.id`, [context.organizationId]
    );
    return { schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], totalResults: result.rows.length,
      startIndex: 1, itemsPerPage: result.rows.length, Resources: result.rows.map(scimGroup) };
  });
}

export async function patchScimGroup(
  pool: Pool,
  context: ScimCredentialContext,
  mappingId: string,
  body: JsonObject,
  correlationId: string
): Promise<JsonObject> {
  const operations = body.Operations;
  if (!uuid.test(mappingId) || !Array.isArray(operations) || operations.length === 0 || operations.length > 50) {
    throw authorizationError("VALIDATION_FAILED", "The SCIM Group PATCH request is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const mappingResult = await client.query<{
      id: string; group_external_id: string; group_display_name: string; organization_role: OrganizationRole;
    }>(
      `SELECT id,group_external_id,group_display_name,organization_role
         FROM identity.organization_group_role_mappings
        WHERE organization_id=$1 AND id=$2 AND revoked_at IS NULL FOR UPDATE`, [context.organizationId, mappingId]
    );
    const mapping = mappingResult.rows[0];
    if (mapping === undefined) throw authorizationError("NOT_FOUND", "The governed SCIM Group mapping was not found.", correlationId);
    await requireEntitledRoles(client, context.organizationId, [mapping.organization_role], correlationId);
    for (const raw of operations) {
      if (typeof raw !== "object" || raw === null) throw authorizationError("VALIDATION_FAILED", "A SCIM Group operation is invalid.", correlationId);
      const operation = raw as JsonObject;
      const op = String(operation.op ?? "").toLowerCase();
      const path = String(operation.path ?? "");
      const values = Array.isArray(operation.value) ? operation.value : [];
      const memberIds = values.map((value) => typeof value === "object" && value !== null && "value" in value ? String(value.value) : "");
      if (!["add", "remove", "replace"].includes(op) || !path.startsWith("members") ||
          memberIds.some((personId) => !uuid.test(personId))) {
        throw authorizationError("VALIDATION_FAILED", "Only governed SCIM Group member changes are supported.", correlationId);
      }
      if (op === "replace") {
        const current = await client.query<{ person_id: string }>(
          `SELECT person_id FROM identity.organization_group_assignments
            WHERE organization_id=$1 AND mapping_id=$2 AND removed_at IS NULL`, [context.organizationId, mappingId]
        );
        const submitted = new Set(memberIds);
        for (const { person_id } of current.rows.filter(({ person_id }) => !submitted.has(person_id))) {
          await client.query(
            `UPDATE identity.organization_group_assignments SET removed_at=transaction_timestamp()
              WHERE organization_id=$1 AND mapping_id=$2 AND person_id=$3 AND removed_at IS NULL`,
            [context.organizationId, mappingId, person_id]
          );
        }
      }
      for (const personId of memberIds) {
        const member = await client.query(
          `SELECT 1 FROM identity.organization_workforce_members
            WHERE organization_id=$1 AND person_id=$2 AND status='active'`, [context.organizationId, personId]
        );
        if (member.rowCount !== 1) throw authorizationError("INVALID_TRANSITION", "SCIM Group members must be active Organization workforce members.", correlationId);
        if (op === "remove") {
          await client.query(
            `UPDATE identity.organization_group_assignments SET removed_at=transaction_timestamp()
              WHERE organization_id=$1 AND mapping_id=$2 AND person_id=$3 AND removed_at IS NULL`,
            [context.organizationId, mappingId, personId]
          );
        } else {
          await client.query(
            `INSERT INTO identity.organization_group_assignments(organization_id,mapping_id,person_id)
             VALUES ($1,$2,$3) ON CONFLICT (organization_id,mapping_id,person_id) DO UPDATE SET removed_at=NULL,assigned_at=transaction_timestamp()`,
            [context.organizationId, mappingId, personId]
          );
          await client.query(
            `INSERT INTO identity.memberships(organization_id,person_id,organization_role)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [context.organizationId, personId, mapping.organization_role]
          );
        }
      }
    }
    await audit(client, context.organizationId, context.actorPersonId, "organization.scim_group_synchronized",
      `group_role_mapping:${mappingId}`, correlationId, { credentialId: context.credentialId,
        note: "Explicit additions are applied; omissions and removals remain reconciliation candidates until an Admin confirms role removal." });
    const result = await client.query<{ members: string[] }>(
      `SELECT COALESCE(array_agg(person_id ORDER BY person_id),ARRAY[]::uuid[])::text[] AS members
         FROM identity.organization_group_assignments
        WHERE organization_id=$1 AND mapping_id=$2 AND removed_at IS NULL`, [context.organizationId, mappingId]
    );
    return scimGroup({ ...mapping, members: result.rows[0]?.members ?? [] });
  });
}

export async function linkOrganizationWorkforceOidcIdentity(
  client: PoolClient,
  identity: VerifiedOidcIdentity,
  identityProviderId: string | null,
  correlationId: string
): Promise<string | null> {
  if (identityProviderId === null || !identity.emailVerified || identity.email === null) return null;
  const candidate = await client.query<{
    person_id: string; status: string; invitation_id: string | null; requested_roles: OrganizationRole[] | null;
  }>(
    `SELECT workforce.person_id,workforce.status,invitation.id AS invitation_id,invitation.requested_roles
       FROM identity.organization_workforce_members workforce
       JOIN identity.organization_identity_provider_revisions provider
         ON provider.organization_id=workforce.organization_id AND provider.id=$2 AND provider.status='active'
       LEFT JOIN identity.organization_workforce_invitations invitation
         ON invitation.organization_id=workforce.organization_id AND invitation.person_id=workforce.person_id
        AND invitation.accepted_at IS NOT NULL AND invitation.revoked_at IS NULL AND invitation.identity_linked_at IS NULL
      WHERE workforce.organization_id=$1 AND workforce.primary_email=$3
        AND (workforce.status='active' OR (workforce.status='invited' AND invitation.id IS NOT NULL))
      LIMIT 1 FOR UPDATE OF workforce`, [identity.organizationId, identityProviderId, identity.email]
  );
  const member = candidate.rows[0];
  if (member === undefined) return null;
  await client.query(
    "SELECT identity.link_organization_workforce_federated_identity($1,$2,$3,$4,$5,$6)",
    [identity.organizationId, member.person_id, identityProviderId, identity.issuer, identity.subject, identity.email]
  );
  if (member.status === "invited" && member.invitation_id !== null && member.requested_roles !== null) {
    await requireEntitledRoles(client, identity.organizationId, member.requested_roles, correlationId);
    for (const role of member.requested_roles) {
      await client.query(
        `INSERT INTO identity.memberships(organization_id,person_id,organization_role)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [identity.organizationId, member.person_id, role]
      );
    }
    await client.query(
      `UPDATE identity.organization_workforce_members
          SET status='active',joined_at=transaction_timestamp(),lifecycle_version=lifecycle_version+1,updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND person_id=$2`, [identity.organizationId, member.person_id]
    );
    await client.query(
      `UPDATE identity.organization_workforce_invitations
          SET identity_linked_at=transaction_timestamp(),updated_at=transaction_timestamp()
        WHERE organization_id=$1 AND id=$2`, [identity.organizationId, member.invitation_id]
    );
  }
  await audit(client, identity.organizationId, member.person_id, "organization.workforce_identity_linked",
    `person:${member.person_id}`, correlationId, { identityProviderId, issuer: identity.issuer });
  return member.person_id;
}

