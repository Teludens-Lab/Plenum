import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  PLATFORM_CONTROL_PLANE_CONTRACT_ID,
  type PlatformAdministratorChangeTypeV1,
  type PlatformAdministratorMutationV1,
  type PlatformAdministratorWorkforceV1
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withPlatformTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import {
  audit as writePlatformAudit,
  requirePlatformAdministrator,
  type FirstAdminInvitationDelivery
} from "./provisioning.js";

const emailPattern = /^[^\s@]+@[^\s@]+$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ProposePlatformAdministratorChangeInput {
  changeType: PlatformAdministratorChangeTypeV1;
  targetPersonId?: string;
  email?: string;
  displayName?: string;
  reason: string;
}

type ChangeRequestRow = {
  id: string;
  change_type: PlatformAdministratorChangeTypeV1;
  anchor_organization_id: string;
  target_person_id: string | null;
  target_email: string | null;
  target_display_name: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "applied" | "expired";
  requested_by: string;
  requested_at: Date;
  expires_at: Date;
  decided_by: string | null;
  decided_at: Date | null;
  decision_reason: string | null;
  target_name: string | null;
  requester_name: string;
  decider_name: string | null;
  invitation_expires_at: Date | null;
  identity_linked_at: Date | null;
  delivery_status: "queued" | "sent" | "failed" | "cancelled" | null;
  delivery_failure_reason: string | null;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clean(value: string): string {
  return value.trim();
}

async function stepUpState(client: PoolClient, principal: AuthenticatedPrincipal): Promise<PlatformAdministratorWorkforceV1["stepUp"]> {
  const result = await client.query<{ satisfied: boolean; expires_at: Date | null }>(
    `SELECT identity.platform_session_is_step_up($1,$2) AS satisfied,
            CASE WHEN lower(authentication_strength) IN ('mfa','urn:mfa')
                  AND revoked_at IS NULL AND expires_at > transaction_timestamp()
                 THEN LEAST(expires_at,created_at + interval '10 minutes') ELSE NULL END AS expires_at
       FROM identity.authentication_sessions
      WHERE organization_id=$3 AND id=$2 AND person_id=$1`,
    [principal.principalId, principal.authenticationSessionId, principal.organizationId]
  );
  const row = result.rows[0];
  return { satisfied: row?.satisfied === true, expiresAt: row?.expires_at?.toISOString() ?? null };
}

async function requireStepUp(client: PoolClient, principal: AuthenticatedPrincipal, correlationId: string): Promise<void> {
  if (!(await stepUpState(client, principal)).satisfied) {
    throw authorizationError("PERMISSION_DENIED",
      "Recent multifactor authentication is required. Sign in again with MFA before changing Platform Administrator authority.",
      correlationId, { stepUpRequired: true, maximumAgeMinutes: 10 });
  }
}

async function expirePendingRequests(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<void> {
  const expired = await client.query<{ id: string; anchor_organization_id: string; change_type: string }>(
    `UPDATE identity.platform_administrator_change_requests
        SET status='expired',decided_at=transaction_timestamp()
      WHERE status='pending' AND expires_at<=transaction_timestamp()
    RETURNING id,anchor_organization_id,change_type`
  );
  for (const request of expired.rows) {
    await writePlatformAudit(client, principal, "platform.platform_administrator_change_expired",
      request.anchor_organization_id, `platform_administrator_change:${request.id}`, correlationId,
      { status: "pending" }, { status: "expired" }, { changeType: request.change_type });
  }
}

async function loadWorkforce(
  client: PoolClient,
  principal: AuthenticatedPrincipal
): Promise<PlatformAdministratorWorkforceV1> {
  const administrators = await client.query<{
    person_id: string; display_name: string; status: "active" | "suspended" | "revoked";
    home_organization_id: string; organization_name: string; assigned_at: Date;
    suspended_at: Date | null; revoked_at: Date | null; assignment_version: string;
    active_session_count: string; last_authenticated_at: Date | null;
  }>(
    `SELECT assignment.person_id,person.display_name,assignment.status,
            assignment.home_organization_id,organization.name AS organization_name,
            assignment.assigned_at,assignment.suspended_at,assignment.revoked_at,
            assignment.assignment_version::text,
            (SELECT count(*)::text FROM identity.authentication_sessions session
              WHERE session.organization_id=assignment.home_organization_id
                AND session.person_id=assignment.person_id
                AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()) AS active_session_count,
            (SELECT max(identity_record.last_authenticated_at) FROM identity.federated_identities identity_record
              WHERE identity_record.organization_id=assignment.home_organization_id
                AND identity_record.person_id=assignment.person_id) AS last_authenticated_at
       FROM identity.platform_role_assignments assignment
       JOIN identity.persons person ON person.id=assignment.person_id
       JOIN identity.organizations organization ON organization.id=assignment.home_organization_id
      WHERE assignment.platform_role='platform_administrator'
      ORDER BY (assignment.status='active') DESC,lower(person.display_name),assignment.person_id`
  );
  const requests = await client.query<ChangeRequestRow>(
    `SELECT request.id,request.change_type,request.anchor_organization_id,
            request.target_person_id,request.target_email,request.target_display_name,
            request.reason,request.status,request.requested_by,request.requested_at,
            request.expires_at,request.decided_by,request.decided_at,request.decision_reason,
            target.display_name AS target_name,requester.display_name AS requester_name,
            decider.display_name AS decider_name,invitation.expires_at AS invitation_expires_at,
            invitation.identity_linked_at,invitation.delivery_status,invitation.delivery_failure_reason
       FROM identity.platform_administrator_change_requests request
       JOIN identity.persons requester ON requester.id=request.requested_by
       LEFT JOIN identity.persons target ON target.id=request.target_person_id
       LEFT JOIN identity.persons decider ON decider.id=request.decided_by
       LEFT JOIN identity.platform_administrator_invitations invitation
         ON invitation.change_request_id=request.id
      ORDER BY request.requested_at DESC,request.id DESC
      LIMIT 100`
  );
  return {
    contractId: PLATFORM_CONTROL_PLANE_CONTRACT_ID,
    currentPersonId: principal.principalId,
    stepUp: await stepUpState(client, principal),
    administrators: administrators.rows.map((row) => ({
      personId: row.person_id,
      displayName: row.display_name,
      status: row.status,
      homeOrganization: { id: row.home_organization_id, name: row.organization_name },
      assignedAt: row.assigned_at.toISOString(),
      suspendedAt: row.suspended_at?.toISOString() ?? null,
      revokedAt: row.revoked_at?.toISOString() ?? null,
      assignmentVersion: Number(row.assignment_version),
      activeSessionCount: Number(row.active_session_count),
      lastAuthenticatedAt: row.last_authenticated_at?.toISOString() ?? null
    })),
    changeRequests: requests.rows.map((row) => ({
      id: row.id,
      changeType: row.change_type,
      status: row.status,
      target: {
        personId: row.target_person_id,
        displayName: row.target_name ?? row.target_display_name ?? "Invited administrator",
        email: row.target_email
      },
      requestedBy: { personId: row.requested_by, displayName: row.requester_name },
      requestedAt: row.requested_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      reason: row.reason,
      decidedBy: row.decided_by === null || row.decider_name === null ? null : {
        personId: row.decided_by, displayName: row.decider_name
      },
      decidedAt: row.decided_at?.toISOString() ?? null,
      decisionReason: row.decision_reason,
      invitation: row.invitation_expires_at === null || row.delivery_status === null ? null : {
        expiresAt: row.invitation_expires_at.toISOString(),
        identityLinkedAt: row.identity_linked_at?.toISOString() ?? null,
        deliveryStatus: row.delivery_status,
        deliveryFailureReason: row.delivery_failure_reason
      }
    }))
  };
}

export async function listPlatformAdministratorWorkforce(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  correlationId: string
): Promise<PlatformAdministratorWorkforceV1> {
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    await expirePendingRequests(client, principal, correlationId);
    return loadWorkforce(client, principal);
  });
}

function validateProposal(
  input: ProposePlatformAdministratorChangeInput,
  correlationId: string
): Required<Pick<ProposePlatformAdministratorChangeInput, "changeType" | "reason">> & {
  targetPersonId: string | null; email: string | null; displayName: string | null;
} {
  const reason = clean(input.reason);
  if (!["invite", "suspend", "revoke", "recover"].includes(input.changeType) || reason.length < 3 || reason.length > 1_000) {
    throw authorizationError("VALIDATION_FAILED", "Select a valid authority change and provide a specific reason.", correlationId);
  }
  if (input.changeType === "invite") {
    const email = clean(input.email ?? "").toLowerCase();
    const displayName = clean(input.displayName ?? "");
    if (!emailPattern.test(email) || email.length > 320 || displayName.length < 2 || displayName.length > 200 || input.targetPersonId !== undefined) {
      throw authorizationError("VALIDATION_FAILED", "A valid invited email and display name are required.", correlationId);
    }
    return { changeType: input.changeType, reason, targetPersonId: null, email, displayName };
  }
  if (input.targetPersonId === undefined || !uuidPattern.test(input.targetPersonId) ||
      input.email !== undefined || input.displayName !== undefined) {
    throw authorizationError("VALIDATION_FAILED", "Select the Platform Administrator whose authority will change.", correlationId);
  }
  return { changeType: input.changeType, reason, targetPersonId: input.targetPersonId, email: null, displayName: null };
}

export async function proposePlatformAdministratorChange(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  input: ProposePlatformAdministratorChangeInput,
  correlationId: string
): Promise<PlatformAdministratorWorkforceV1> {
  const proposal = validateProposal(input, correlationId);
  return withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    await requireStepUp(client, principal, correlationId);
    await expirePendingRequests(client, principal, correlationId);
    if (proposal.targetPersonId !== null) {
      const target = await client.query<{ status: "active" | "suspended" | "revoked"; home_organization_id: string }>(
        `SELECT status,home_organization_id FROM identity.platform_role_assignments
          WHERE person_id=$1 AND platform_role='platform_administrator'`, [proposal.targetPersonId]
      );
      const row = target.rows[0];
      if (row === undefined) throw authorizationError("NOT_FOUND", "The Platform Administrator was not found.", correlationId);
      if ((proposal.changeType === "recover" && row.status !== "suspended") ||
          (proposal.changeType !== "recover" && row.status !== "active")) {
        throw authorizationError("INVALID_TRANSITION", "That authority change is not available from the current status.", correlationId);
      }
    }
    const requestId = randomUUID();
    try {
      await client.query(
        `INSERT INTO identity.platform_administrator_change_requests(
           id,change_type,anchor_organization_id,target_person_id,target_email,target_display_name,
           reason,requested_by,expires_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,transaction_timestamp()+interval '24 hours')`,
        [requestId, proposal.changeType, principal.organizationId, proposal.targetPersonId,
          proposal.email, proposal.displayName, proposal.reason, principal.principalId]
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw authorizationError("TARGET_EXISTS", "A matching authority change already awaits a second approver.", correlationId);
      }
      throw error;
    }
    await writePlatformAudit(client, principal, "platform.platform_administrator_change_requested",
      principal.organizationId, `platform_administrator_change:${requestId}`, correlationId, null,
      { status: "pending", changeType: proposal.changeType },
      { targetPersonId: proposal.targetPersonId, targetEmail: proposal.email, reason: proposal.reason });
    return loadWorkforce(client, principal);
  });
}

function decisionError(outcome: string, correlationId: string): never {
  if (outcome === "not_found") throw authorizationError("NOT_FOUND", "The authority change request was not found.", correlationId);
  if (outcome === "self_approval") throw authorizationError("INVALID_TRANSITION", "The requester cannot approve their own authority change.", correlationId);
  if (outcome === "last_active") throw authorizationError("INVALID_TRANSITION", "The final active Platform Administrator cannot be suspended or revoked.", correlationId);
  if (outcome === "expired") throw authorizationError("INVALID_TRANSITION", "The authority change request expired. Create a new request.", correlationId);
  if (outcome === "permission_denied") throw authorizationError("PERMISSION_DENIED", "Recent multifactor authentication and active Platform Administrator authority are required.", correlationId);
  throw authorizationError("INVALID_TRANSITION", "The authority change is no longer available from its current state.", correlationId);
}

export async function decidePlatformAdministratorChange(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  requestId: string,
  decision: "approve" | "reject",
  reasonInput: string,
  correlationId: string,
  delivery?: FirstAdminInvitationDelivery,
  publicBaseUrl?: string
): Promise<PlatformAdministratorMutationV1> {
  const reason = clean(reasonInput);
  if (reason.length < 3 || reason.length > 1_000) {
    throw authorizationError("VALIDATION_FAILED", "A decision reason between 3 and 1,000 characters is required.", correlationId);
  }
  if (decision === "reject") {
    const workforce = await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
      await requirePlatformAdministrator(client, principal, correlationId);
      await requireStepUp(client, principal, correlationId);
      const result = await client.query<{ anchor_organization_id: string; requested_by: string; change_type: string }>(
        `UPDATE identity.platform_administrator_change_requests
            SET status='rejected',decided_by=$2,decided_at=transaction_timestamp(),decision_reason=$3
          WHERE id=$1 AND status='pending' AND expires_at>transaction_timestamp() AND requested_by<>$2
        RETURNING anchor_organization_id,requested_by,change_type`, [requestId, principal.principalId, reason]
      );
      const row = result.rows[0];
      if (row === undefined) {
        const own = await client.query("SELECT 1 FROM identity.platform_administrator_change_requests WHERE id=$1 AND requested_by=$2", [requestId, principal.principalId]);
        if (own.rowCount === 1) decisionError("self_approval", correlationId);
        decisionError("invalid_transition", correlationId);
      }
      await writePlatformAudit(client, principal, "platform.platform_administrator_change_rejected",
        row.anchor_organization_id, `platform_administrator_change:${requestId}`, correlationId,
        { status: "pending" }, { status: "rejected" }, { changeType: row.change_type, reason });
      return loadWorkforce(client, principal);
    });
    return { workforce };
  }

  const request = await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    await requireStepUp(client, principal, correlationId);
    const selected = await client.query<ChangeRequestRow>(
      `SELECT request.*,target.display_name AS target_name,requester.display_name AS requester_name,
              NULL::text AS decider_name,NULL::timestamptz AS invitation_expires_at,
              NULL::timestamptz AS identity_linked_at,NULL::text AS delivery_status,
              NULL::text AS delivery_failure_reason
         FROM identity.platform_administrator_change_requests request
         JOIN identity.persons requester ON requester.id=request.requested_by
         LEFT JOIN identity.persons target ON target.id=request.target_person_id
        WHERE request.id=$1 FOR UPDATE OF request`, [requestId]
    );
    const row = selected.rows[0];
    if (row === undefined) decisionError("not_found", correlationId);
    if (row.requested_by === principal.principalId) decisionError("self_approval", correlationId);
    if (row.status !== "pending" || row.expires_at <= new Date()) decisionError("invalid_transition", correlationId);
    if (row.change_type !== "invite") {
      const applied = await client.query<{ outcome: string }>(
        "SELECT identity.apply_platform_administrator_change($1,$2,$3,$4,$5) AS outcome",
        [requestId, principal.principalId, principal.authenticationSessionId, reason, correlationId]
      );
      const outcome = applied.rows[0]?.outcome ?? "invalid_transition";
      if (outcome !== "applied") decisionError(outcome, correlationId);
      return { row, token: null, invitationId: null, deliveryId: null, expiresAt: null };
    }
    if (delivery === undefined || publicBaseUrl === undefined) {
      throw authorizationError("INVALID_TRANSITION", "Platform Administrator invitation delivery is not configured.", correlationId);
    }
    const token = randomBytes(32).toString("base64url");
    const invitationId = randomUUID();
    const deliveryId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    await client.query(
      `UPDATE identity.platform_administrator_invitations invitation
          SET revoked_at=transaction_timestamp(),delivery_status=CASE WHEN delivery_status='queued' THEN 'cancelled' ELSE delivery_status END,
              updated_at=transaction_timestamp()
         FROM identity.platform_administrator_change_requests prior
        WHERE prior.id=invitation.change_request_id
          AND prior.anchor_organization_id=$1 AND prior.target_email=$2
          AND invitation.identity_linked_at IS NULL AND invitation.revoked_at IS NULL`,
      [row.anchor_organization_id, row.target_email]
    );
    await client.query(
      `UPDATE identity.platform_administrator_change_requests
          SET status='approved',decided_by=$2,decided_at=transaction_timestamp(),decision_reason=$3
        WHERE id=$1`, [requestId, principal.principalId, reason]
    );
    await client.query(
      `INSERT INTO identity.platform_administrator_invitations(
         id,change_request_id,organization_id,email,display_name,token_sha256,expires_at,
         delivery_id,delivery_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued')`,
      [invitationId, requestId, row.anchor_organization_id, row.target_email,
        row.target_display_name, sha256(token), expiresAt, deliveryId]
    );
    await writePlatformAudit(client, principal, "platform.platform_administrator_invitation_approved",
      row.anchor_organization_id, `platform_administrator_change:${requestId}`, correlationId,
      { status: "pending" }, { status: "approved", deliveryStatus: "queued" },
      { reason, invitationId, expiresAt: expiresAt.toISOString() });
    return { row, token, invitationId, deliveryId, expiresAt };
  });

  if (request.token === null || request.invitationId === null || request.deliveryId === null || request.expiresAt === null) {
    return { workforce: await listPlatformAdministratorWorkforce(pool, principal, correlationId) };
  }
  if (delivery === undefined || publicBaseUrl === undefined) {
    throw new Error("Platform Administrator invitation delivery is unavailable after approval");
  }
  const baseUrl = new URL(publicBaseUrl);
  if (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname))) {
    throw new Error("The public Plenum URL must use HTTPS");
  }
  const invitationUrl = new URL(`/platform/administrator-invitations/${request.token}`, baseUrl).toString();
  let providerReference: string | null = null;
  let previewUrl: string | undefined;
  let failureReason: string | null = null;
  try {
    const delivered = await delivery.deliver({
      messageType: "PLATFORM_ADMINISTRATOR_INVITATION",
      deliveryId: request.deliveryId,
      recipientEmail: request.row.target_email!,
      organizationName: "Plenum platform operations",
      invitationUrl,
      expiresAt: request.expiresAt.toISOString(),
      templateRef: "platform-administrator-v1"
    });
    providerReference = delivered.providerReference;
    previewUrl = delivered.previewUrl;
  } catch {
    failureReason = "Invitation delivery failed. Create and approve a replacement invitation after checking the provider.";
  }
  const workforce = await withPlatformTransaction(pool, principal.principalId, principal.organizationId, async (client) => {
    await requirePlatformAdministrator(client, principal, correlationId);
    await client.query(
      `UPDATE identity.platform_administrator_invitations
          SET delivery_status=CASE WHEN $2::text IS NULL THEN 'sent' ELSE 'failed' END,
              delivery_attempt_count=delivery_attempt_count+1,
              sent_at=CASE WHEN $2::text IS NULL THEN transaction_timestamp() ELSE NULL END,
              failed_at=CASE WHEN $2::text IS NULL THEN NULL ELSE transaction_timestamp() END,
              delivery_failure_reason=$2,provider_reference=$3,updated_at=transaction_timestamp()
        WHERE id=$1 AND delivery_status='queued'`, [request.invitationId, failureReason, providerReference]
    );
    await writePlatformAudit(client, principal,
      failureReason === null ? "platform.platform_administrator_invitation_delivered" : "platform.platform_administrator_invitation_delivery_failed",
      request.row.anchor_organization_id, `platform_administrator_invitation:${request.invitationId}`, correlationId,
      { deliveryStatus: "queued" }, { deliveryStatus: failureReason === null ? "sent" : "failed" },
      failureReason === null ? { providerReference: providerReference ?? "unavailable" } : { reason: failureReason });
    return loadWorkforce(client, principal);
  });
  return { workforce, ...(previewUrl === undefined ? {} : { invitationUrl: previewUrl }) };
}
