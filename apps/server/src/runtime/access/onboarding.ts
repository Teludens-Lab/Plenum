import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { CommandEnvelopeV1, CommandReceiptV1, JsonObject, ReadinessProjectionV1 } from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../../database.js";
import { authorizationError } from "../../errors.js";
import type { AuthenticatedPrincipal } from "../../identity/login.js";
import {
  processPrincipalSessionCommand,
  type CommandDecision,
  type PrincipalSessionCommandContext
} from "../commands/processor.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");

type AccessPolicy = {
  joinMethods: string[];
  guests: { allowed: boolean; expiryHours: number; operatorApproval: boolean };
  displays: Array<{ interfaceProfileId: string; classificationCeiling: string }>;
  reassignment: { crossTeamAllowed: boolean; exposureAcknowledgementRequired: boolean };
  readiness: Array<{ key: string; label: string; blocking: boolean }>;
};

type Seat = {
  seat_id: string;
  session_role_ids: string[];
  team_id: string | null;
  min_occupancy: number;
  max_occupancy: number | null;
  required: boolean;
  join_mode: string;
  state: string;
};

function requireOperation(command: CommandEnvelopeV1, operation: string, correlationId: string): JsonObject {
  if (command.operationType !== operation) throw authorizationError("INVALID_COMMAND", `Expected ${operation}.`, correlationId);
  return command.payload;
}

function requireOrganizationOperator(context: PrincipalSessionCommandContext): CommandDecision | null {
  return context.organizationRoles.includes("operator") ? null : {
    status: "rejected", errorCode: "PERMISSION_DENIED", message: "An Operator Organization Role is required."
  };
}

async function requireSessionOperator(client: PoolClient, context: PrincipalSessionCommandContext): Promise<CommandDecision | null> {
  const operator = await client.query(
    `SELECT 1 FROM runtime.session_operators
      WHERE organization_id=$1 AND session_id=$2 AND person_id=$3 AND revoked_at IS NULL`,
    [context.organizationId, context.sessionId, context.principalId]
  );
  return operator.rowCount === 1 ? null : {
    status: "rejected", errorCode: "PERMISSION_DENIED", message: "An active Session Operator assignment is required."
  };
}

async function audit(client: PoolClient, context: PrincipalSessionCommandContext, action: string, target: string, details: JsonObject) {
  await client.query(
    `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [randomUUID(), context.organizationId, context.principalId, action, target, JSON.stringify(details)]
  );
}

async function config(client: PoolClient, context: PrincipalSessionCommandContext, lock = false) {
  const result = await client.query<{ governing_release_id: string; access_policy: AccessPolicy; assignment_version: string }>(
    `SELECT governing_release_id,access_policy,assignment_version FROM runtime.session_access_configs
      WHERE organization_id=$1 AND session_id=$2${lock ? " FOR UPDATE" : ""}`,
    [context.organizationId, context.sessionId]
  );
  return result.rows[0];
}

async function seat(client: PoolClient, context: PrincipalSessionCommandContext, seatId: string): Promise<Seat | undefined> {
  const result = await client.query<Seat>(
    `SELECT seat_id,session_role_ids,team_id,min_occupancy,max_occupancy,required,join_mode,state
       FROM runtime.session_seats WHERE organization_id=$1 AND session_id=$2 AND seat_id=$3 FOR UPDATE`,
    [context.organizationId, context.sessionId, seatId]
  );
  return result.rows[0];
}

async function assignSeat(
  client: PoolClient,
  context: PrincipalSessionCommandContext,
  personId: string,
  seatId: string,
  sessionRoleId: string
) {
  const definition = await seat(client, context, seatId);
  if (definition === undefined || definition.state === "disabled" || !definition.session_role_ids.includes(sessionRoleId)) {
    return { decision: { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The eligible Seat was not found." } as CommandDecision };
  }
  const occupied = await client.query<{ count: string }>(
    `SELECT count(*) FROM runtime.seat_assignments
      WHERE organization_id=$1 AND session_id=$2 AND seat_id=$3 AND valid_to IS NULL`,
    [context.organizationId, context.sessionId, seatId]
  );
  if (definition.max_occupancy !== null && Number(occupied.rows[0]?.count ?? 0) >= definition.max_occupancy) {
    return { decision: { status: "rejected", errorCode: "CONFLICT", message: "The Seat is already occupied." } as CommandDecision };
  }
  let participant = await client.query<{ id: string }>(
    "SELECT id FROM runtime.participants WHERE organization_id=$1 AND session_id=$2 AND person_id=$3",
    [context.organizationId, context.sessionId, personId]
  );
  if (participant.rows[0] === undefined) {
    participant = await client.query<{ id: string }>(
      `INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES ($1,$2,$3,$4) RETURNING id`,
      [randomUUID(), context.organizationId, context.sessionId, personId]
    );
  }
  const participantId = participant.rows[0]!.id;
  const assignmentId = randomUUID();
  await client.query(
    `INSERT INTO runtime.seat_assignments
      (id,organization_id,session_id,participant_id,session_role_id,seat_id,team_id,exclusive,assigned_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [assignmentId, context.organizationId, context.sessionId, participantId, sessionRoleId, seatId,
      definition.team_id, definition.max_occupancy === 1, context.principalId]
  );
  await client.query(
    `INSERT INTO runtime.participant_access_revisions(organization_id,session_id,participant_id)
     VALUES ($1,$2,$3) ON CONFLICT (organization_id,session_id,participant_id)
     DO UPDATE SET access_revision=runtime.participant_access_revisions.access_revision+1,refreshed_at=transaction_timestamp()`,
    [context.organizationId, context.sessionId, participantId]
  );
  const version = await client.query<{ assignment_version: string }>(
    `UPDATE runtime.session_access_configs SET assignment_version=assignment_version+1
      WHERE organization_id=$1 AND session_id=$2 RETURNING assignment_version`,
    [context.organizationId, context.sessionId]
  );
  await client.query(
    `UPDATE runtime.session_seats SET state='occupied'
      WHERE organization_id=$1 AND session_id=$2 AND seat_id=$3`,
    [context.organizationId, context.sessionId, seatId]
  );
  return { assignmentId, participantId, assignmentVersion: Number(version.rows[0]!.assignment_version), definition };
}

export async function resolvePrincipalCommandContext(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  deviceId: string,
  correlationId: string
): Promise<PrincipalSessionCommandContext> {
  if (!uuid.test(deviceId)) throw authorizationError("DEVICE_NOT_REGISTERED", "A registered Device is required.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ authority_epoch: string }>(
      `SELECT authority_epoch FROM runtime.session_authorities WHERE organization_id=$1 AND session_id=$2`,
      [principal.organizationId, sessionId]
    );
    if (result.rows[0] === undefined) throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", correlationId);
    return { principalId: principal.principalId, organizationId: principal.organizationId,
      organizationRoles: principal.organizationRoles, sessionId, deviceId, authorityEpoch: Number(result.rows[0].authority_epoch) };
  });
}

export async function configureSessionAccess(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client, activeReleaseId, sessionStatus }) => {
    const payload = requireOperation(command, "session.configure", correlationId);
    const denied = requireOrganizationOperator(context); if (denied !== null) return denied;
    if (!new Set(["created", "configured"]).has(sessionStatus)) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: `The Session is ${sessionStatus}.` };
    if (payload.sessionCode !== undefined && (typeof payload.sessionCode !== "string" || payload.sessionCode.length < 6 || payload.sessionCode.length > 100)) {
      throw authorizationError("VALIDATION_FAILED", "The Session code must be 6 to 100 characters.", correlationId);
    }
    const release = await client.query<{ snapshot: { coreDesign?: { accessPolicy?: AccessPolicy; seats?: Array<{ id: string; sessionRoleIds: string[]; teamId?: string; minOccupancy: number; maxOccupancy: number | null; required: boolean; joinMode: string }> } } }>(
      `SELECT revision.snapshot FROM registry.releases release JOIN studio.definition_revisions revision
        ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
       WHERE release.organization_id=$1 AND release.id=$2`, [context.organizationId, activeReleaseId]
    );
    const core = release.rows[0]?.snapshot.coreDesign;
    if (core?.accessPolicy === undefined || !Array.isArray(core.seats)) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "The governing Release has no complete access policy." };
    }
    if (await config(client, context) !== undefined) {
      return { status: "rejected", errorCode: "TARGET_EXISTS", message: "Session access is already configured." };
    }
    await client.query(
      `INSERT INTO runtime.session_access_configs
       (organization_id,session_id,governing_release_id,access_policy,session_code_sha256,configured_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
      [context.organizationId, context.sessionId, activeReleaseId, JSON.stringify(core.accessPolicy),
        typeof payload.sessionCode === "string" ? digest(payload.sessionCode) : null, context.principalId]
    );
    for (const item of core.seats) {
      await client.query(
        `INSERT INTO runtime.session_seats
         (organization_id,session_id,seat_id,session_role_ids,team_id,min_occupancy,max_occupancy,required,join_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [context.organizationId, context.sessionId, item.id, item.sessionRoleIds, item.teamId ?? null,
          item.minOccupancy, item.maxOccupancy, item.required, item.joinMode]
      );
    }
    const configured = await config(client, context);
    for (const check of core.accessPolicy.readiness) {
      await client.query(
        `INSERT INTO runtime.session_readiness_checks
         (organization_id,session_id,check_key,label,blocking,governing_release_id,assignment_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [context.organizationId, context.sessionId, check.key, check.label, check.blocking, activeReleaseId,
          Number(configured!.assignment_version)]
      );
    }
    await client.query(
      `INSERT INTO runtime.session_operators(organization_id,session_id,person_id,assigned_by)
       VALUES ($1,$2,$3,$3) ON CONFLICT (organization_id,session_id,person_id)
       DO UPDATE SET revoked_at=NULL,assigned_by=EXCLUDED.assigned_by,assigned_at=transaction_timestamp()`,
      [context.organizationId, context.sessionId, context.principalId]
    );
    const updated = await client.query<{ version: string }>(
      `UPDATE runtime.sessions SET status='configured',version=version+1 WHERE organization_id=$1 AND id=$2 RETURNING version`,
      [context.organizationId, context.sessionId]
    );
    await audit(client, context, "session.configured", `session:${context.sessionId}`, { governingReleaseId: activeReleaseId });
    return { status: "accepted", aggregateVersion: Number(updated.rows[0]!.version), eventType: "session.configured",
      eventPayload: { sessionId: context.sessionId, governingReleaseId: activeReleaseId } };
  }});
}

export async function issueInvitation(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<{ receipt: CommandReceiptV1; invitationToken: string | null }> {
  let invitationToken: string | null = null;
  const receipt = await processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    const payload = requireOperation(command, "invitation.issue", correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    const expiresInHours = Number(payload.expiresInHours);
    if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 168 ||
        (payload.recipientPersonId !== undefined && (typeof payload.recipientPersonId !== "string" || !uuid.test(payload.recipientPersonId))) ||
        (payload.seatId !== undefined && (typeof payload.seatId !== "string" || payload.seatId.length > 200))) {
      throw authorizationError("VALIDATION_FAILED", "The invitation is invalid.", correlationId);
    }
    const access = await config(client, context);
    if (access === undefined || !(access.access_policy.joinMethods ?? []).includes("invitation")) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Invitation joining is not enabled." };
    }
    invitationToken = token();
    await client.query(
      `INSERT INTO identity.session_invitations
       (id,organization_id,session_id,token_sha256,recipient_person_id,seat_id,expires_at,issued_by)
       VALUES ($1,$2,$3,$4,$5,$6,transaction_timestamp()+($7::text||' hours')::interval,$8)`,
      [command.aggregateId, context.organizationId, context.sessionId, digest(invitationToken),
        payload.recipientPersonId ?? null, payload.seatId ?? null, expiresInHours, context.principalId]
    );
    await audit(client, context, "invitation.issued", `invitation:${command.aggregateId}`, { seatId: payload.seatId ?? null });
    return { status: "accepted", aggregateVersion: 1, eventType: "invitation.issued", eventPayload: { invitationId: command.aggregateId, seatId: payload.seatId ?? null } };
  }});
  return { receipt, invitationToken };
}

export async function submitJoinRequest(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    const payload = requireOperation(command, "join_request.submit", correlationId);
    const access = await config(client, context);
    if (access === undefined) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "Session access is not configured." };
    let invitationId: string | null = null;
    let requestedSeatId: string | null = null;
    if (typeof payload.invitationToken === "string" && payload.invitationToken.length > 0) {
      const invitation = await client.query<{ id: string; recipient_person_id: string | null; seat_id: string | null }>(
        `SELECT id,recipient_person_id,seat_id FROM identity.session_invitations
          WHERE organization_id=$1 AND session_id=$2 AND token_sha256=$3 AND accepted_at IS NULL
            AND revoked_at IS NULL AND expires_at>transaction_timestamp() FOR UPDATE`,
        [context.organizationId, context.sessionId, digest(payload.invitationToken)]
      );
      const row = invitation.rows[0];
      if (row === undefined || (row.recipient_person_id !== null && row.recipient_person_id !== context.principalId)) {
        return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The invitation is invalid or expired." };
      }
      invitationId = row.id; requestedSeatId = row.seat_id;
      await client.query("UPDATE identity.session_invitations SET accepted_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2", [context.organizationId, row.id]);
    } else if (typeof payload.sessionCode === "string" && access.access_policy.joinMethods.includes("code_and_verified_email")) {
      const code = await client.query<{ matches: boolean }>(
        `SELECT session_code_sha256=$3 AS matches FROM runtime.session_access_configs
          WHERE organization_id=$1 AND session_id=$2`,
        [context.organizationId, context.sessionId, digest(payload.sessionCode)]
      );
      if (code.rows[0]?.matches !== true) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Session code is invalid." };
    } else {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "A code alone never grants Session access." };
    }
    const waitingRoom = access.access_policy.joinMethods.includes("waiting_room");
    await client.query(
      `INSERT INTO runtime.join_requests(id,organization_id,session_id,person_id,invitation_id,requested_seat_id,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [command.aggregateId, context.organizationId, context.sessionId, context.principalId, invitationId, requestedSeatId,
        waitingRoom ? "waiting_room" : "assignment_pending"]
    );
    await audit(client, context, "join_request.submitted", `join-request:${command.aggregateId}`, {});
    return { status: "accepted", aggregateVersion: 1, eventType: "join_request.submitted",
      eventPayload: { joinRequestId: command.aggregateId, status: waitingRoom ? "waiting_room" : "assignment_pending" } };
  }});
}

export async function resolveInvitationSession(
  pool: Pool, principal: AuthenticatedPrincipal, invitationToken: string, correlationId: string
): Promise<string> {
  if (invitationToken.length < 20 || invitationToken.length > 200) {
    throw authorizationError("PERMISSION_DENIED", "The invitation is invalid or expired.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const result = await client.query<{ session_id: string; recipient_person_id: string | null }>(
      `SELECT session_id,recipient_person_id FROM identity.session_invitations
        WHERE organization_id=$1 AND token_sha256=$2`,
      [principal.organizationId, digest(invitationToken)]
    );
    const invitation = result.rows[0];
    if (invitation === undefined || (invitation.recipient_person_id !== null && invitation.recipient_person_id !== principal.principalId)) {
      throw authorizationError("PERMISSION_DENIED", "The invitation is invalid or expired.", correlationId);
    }
    return invitation.session_id;
  });
}

export async function decideJoinRequest(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string,
  decision: "admit" | "reject"
): Promise<CommandReceiptV1> {
  const operation = `participant.${decision}`;
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    requireOperation(command, operation, correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    const request = await client.query<{ id: string; person_id: string }>(
      `SELECT id,person_id FROM runtime.join_requests
        WHERE organization_id=$1 AND session_id=$2 AND person_id=$3
          AND status IN ('waiting_room','assignment_pending')
        ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE`,
      [context.organizationId, context.sessionId, command.aggregateId]
    );
    const row = request.rows[0];
    if (row === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The pending join request was not found." };
    await client.query(
      `UPDATE runtime.join_requests SET status=$1,decided_by=$2,decided_at=transaction_timestamp()
        WHERE organization_id=$3 AND id=$4`,
      [decision === "admit" ? "admitted" : "rejected", context.principalId, context.organizationId, row.id]
    );
    let participantId: string | null = null;
    if (decision === "admit") {
      const participant = await client.query<{ id: string }>(
        `INSERT INTO runtime.participants(id,organization_id,session_id,person_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (session_id,person_id) DO UPDATE SET person_id=EXCLUDED.person_id RETURNING id`,
        [randomUUID(), context.organizationId, context.sessionId, row.person_id]
      );
      participantId = participant.rows[0]!.id;
    }
    const eventType = decision === "admit" ? "participant.admitted" : "participant.rejected";
    const eventPayload: JsonObject = { joinRequestId: row.id, personId: row.person_id, participantId };
    await audit(client, context, eventType, `person:${row.person_id}`, eventPayload);
    return { status: "accepted", aggregateVersion: 1, eventType, eventPayload };
  }});
}

export async function importRoster(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<{ receipt: CommandReceiptV1; reviewCount: number }> {
  let reviewCount = 0;
  const receipt = await processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    const payload = requireOperation(command, "roster.import", correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    if (!Array.isArray(payload.rows) || payload.rows.length === 0 || payload.rows.length > 1_000) {
      throw authorizationError("VALIDATION_FAILED", "Roster import requires 1 to 1000 rows.", correlationId);
    }
    for (const [index, value] of payload.rows.entries()) {
      const row = typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
      const reasons: string[] = [];
      if (typeof row.personId !== "string" || !uuid.test(row.personId)) reasons.push("person_unresolved");
      if (typeof row.seatId !== "string") reasons.push("seat_missing");
      let definition: Seat | undefined;
      if (typeof row.seatId === "string") definition = await seat(client, context, row.seatId);
      if (definition === undefined) reasons.push("seat_unknown");
      if (definition !== undefined && (typeof row.sessionRoleId !== "string" || !definition.session_role_ids.includes(row.sessionRoleId))) reasons.push("role_ineligible");
      if (definition !== undefined && definition.team_id !== null && row.teamId !== definition.team_id) reasons.push("team_ambiguous");
      if (reasons.length > 0) reviewCount += 1;
      await client.query(
        `INSERT INTO runtime.roster_import_rows
         (id,organization_id,session_id,import_id,row_number,person_id,team_id,session_role_id,seat_id,status,review_reasons,imported_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [randomUUID(), context.organizationId, context.sessionId, command.aggregateId, index + 1,
          typeof row.personId === "string" && uuid.test(row.personId) ? row.personId : null,
          typeof row.teamId === "string" ? row.teamId : null, typeof row.sessionRoleId === "string" ? row.sessionRoleId : null,
          typeof row.seatId === "string" ? row.seatId : null, reasons.length === 0 ? "ready" : "review", reasons, context.principalId]
      );
    }
    await audit(client, context, "roster.imported", `roster:${command.aggregateId}`, { reviewCount, rowCount: payload.rows.length });
    return { status: "accepted", aggregateVersion: 1, eventType: "roster.imported",
      eventPayload: { importId: command.aggregateId, reviewCount, rowCount: payload.rows.length } };
  }});
  return { receipt, reviewCount };
}

export async function claimSeat(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client, sessionStatus }) => {
    const payload = requireOperation(command, "seat.claim", correlationId);
    if (!["configured", "ready", "open"].includes(sessionStatus) || typeof payload.seatId !== "string" || typeof payload.sessionRoleId !== "string") {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Seat cannot be claimed now." };
    }
    const access = await config(client, context);
    if (access === undefined || !access.access_policy.joinMethods.includes("open_seat_selection")) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Open Seat selection is not enabled." };
    }
    const admission = await client.query(
      `SELECT 1 FROM runtime.join_requests
        WHERE organization_id=$1 AND session_id=$2 AND person_id=$3 AND status='admitted' LIMIT 1`,
      [context.organizationId, context.sessionId, context.principalId]
    );
    if (admission.rowCount !== 1) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Admission is required before a Seat can be claimed." };
    }
    const result = await assignSeat(client, context, context.principalId, payload.seatId, payload.sessionRoleId);
    if (result.decision !== undefined) return result.decision;
    await audit(client, context, "seat.claimed", `seat-assignment:${result.assignmentId}`, { seatId: payload.seatId });
    return { status: "accepted", aggregateVersion: result.assignmentVersion!, eventType: "seat.claimed",
      eventPayload: { seatAssignmentId: result.assignmentId!, participantId: result.participantId!, seatId: payload.seatId,
        sessionRoleId: payload.sessionRoleId, teamId: result.definition!.team_id } };
  }});
}

export async function assignParticipant(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    const payload = requireOperation(command, "participant.assign", correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    if (typeof payload.personId !== "string" || !uuid.test(payload.personId) || typeof payload.seatId !== "string" || typeof payload.sessionRoleId !== "string") {
      throw authorizationError("VALIDATION_FAILED", "The Participant assignment is invalid.", correlationId);
    }
    const result = await assignSeat(client, context, payload.personId, payload.seatId, payload.sessionRoleId);
    if (result.decision !== undefined) return result.decision;
    await audit(client, context, "participant.assigned", `seat-assignment:${result.assignmentId}`, { participantId: result.participantId!, seatId: payload.seatId });
    return { status: "accepted", aggregateVersion: result.assignmentVersion!, eventType: "seat_assignment.created",
      eventPayload: { seatAssignmentId: result.assignmentId!, participantId: result.participantId!, seatId: payload.seatId,
        sessionRoleId: payload.sessionRoleId, teamId: result.definition!.team_id } };
  }});
}

export async function reassignSeat(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    const payload = requireOperation(command, "participant.reassign", correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    if (typeof payload.previousSeatAssignmentId !== "string" || !uuid.test(payload.previousSeatAssignmentId) ||
        typeof payload.newSeatId !== "string" || typeof payload.newSessionRoleId !== "string" ||
        typeof payload.reason !== "string" || payload.reason.trim().length < 3 || payload.reason.length > 500) {
      throw authorizationError("VALIDATION_FAILED", "The reassignment is invalid.", correlationId);
    }
    const previous = await client.query<{ participant_id: string; seat_id: string; team_id: string | null; access_revision: string }>(
      `SELECT assignment.participant_id,assignment.seat_id,assignment.team_id,revision.access_revision
         FROM runtime.seat_assignments assignment JOIN runtime.participant_access_revisions revision
           ON revision.organization_id=assignment.organization_id AND revision.session_id=assignment.session_id
          AND revision.participant_id=assignment.participant_id
        WHERE assignment.organization_id=$1 AND assignment.session_id=$2 AND assignment.id=$3 AND assignment.valid_to IS NULL
        FOR UPDATE OF assignment,revision`,
      [context.organizationId, context.sessionId, payload.previousSeatAssignmentId]
    );
    const prior = previous.rows[0];
    if (prior === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The active Seat Assignment was not found." };
    if (command.expectedAggregateVersion !== Number(prior.access_revision)) {
      return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: "The Participant access version changed." };
    }
    const next = await seat(client, context, payload.newSeatId);
    if (next === undefined || next.state === "disabled" || !next.session_role_ids.includes(payload.newSessionRoleId)) {
      return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The eligible destination Seat was not found." };
    }
    const access = await config(client, context, true);
    if (access === undefined) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "Session access is not configured." };
    const crossTeam = prior.team_id !== next.team_id;
    if (crossTeam && !access.access_policy.reassignment.crossTeamAllowed) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Cross-Team reassignment is not allowed." };
    }
    if (crossTeam && access.access_policy.reassignment.exposureAcknowledgementRequired && payload.exposureAcknowledged !== true) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Prior information exposure must be acknowledged." };
    }
    const occupied = await client.query<{ count: string }>(
      `SELECT count(*) FROM runtime.seat_assignments WHERE organization_id=$1 AND session_id=$2 AND seat_id=$3 AND valid_to IS NULL`,
      [context.organizationId, context.sessionId, payload.newSeatId]
    );
    if (next.max_occupancy !== null && Number(occupied.rows[0]?.count ?? 0) >= next.max_occupancy) {
      return { status: "rejected", errorCode: "CONFLICT", message: "The destination Seat is occupied." };
    }
    await client.query(
      `UPDATE runtime.seat_assignments SET valid_to=transaction_timestamp(),ended_by=$1,end_reason=$2
        WHERE organization_id=$3 AND id=$4`,
      [context.principalId, payload.reason.trim(), context.organizationId, payload.previousSeatAssignmentId]
    );
    await client.query(
      `UPDATE runtime.session_seats SET state=CASE WHEN EXISTS(
         SELECT 1 FROM runtime.seat_assignments assignment
          WHERE assignment.organization_id=$1 AND assignment.session_id=$2
            AND assignment.seat_id=$3 AND assignment.valid_to IS NULL
       ) THEN 'occupied' ELSE 'vacated' END
       WHERE organization_id=$1 AND session_id=$2 AND seat_id=$3`,
      [context.organizationId, context.sessionId, prior.seat_id]
    );
    const assignmentId = randomUUID();
    await client.query(
      `INSERT INTO runtime.seat_assignments
       (id,organization_id,session_id,participant_id,session_role_id,seat_id,team_id,exclusive,assigned_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [assignmentId, context.organizationId, context.sessionId, prior.participant_id, payload.newSessionRoleId,
        payload.newSeatId, next.team_id, next.max_occupancy === 1, context.principalId]
    );
    const revision = await client.query<{ access_revision: string }>(
      `UPDATE runtime.participant_access_revisions SET access_revision=access_revision+1,refreshed_at=transaction_timestamp()
        WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 RETURNING access_revision`,
      [context.organizationId, context.sessionId, prior.participant_id]
    );
    const assignmentVersion = await client.query<{ assignment_version: string }>(
      `UPDATE runtime.session_access_configs SET assignment_version=assignment_version+1
        WHERE organization_id=$1 AND session_id=$2 RETURNING assignment_version`,
      [context.organizationId, context.sessionId]
    );
    await client.query(
      `UPDATE sync.projection_grants SET revoked_at=transaction_timestamp()
        WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 AND revoked_at IS NULL`,
      [context.organizationId, context.sessionId, prior.participant_id]
    );
    const eventPayload: JsonObject = { previousSeatAssignmentId: payload.previousSeatAssignmentId, seatAssignmentId: assignmentId,
      participantId: prior.participant_id, newSessionRoleId: payload.newSessionRoleId, newSeatId: payload.newSeatId,
      teamId: next.team_id, reason: payload.reason.trim(), accessRevision: Number(revision.rows[0]!.access_revision),
      assignmentVersion: Number(assignmentVersion.rows[0]!.assignment_version),
      exposureWarning: crossTeam ? "Previously viewed information cannot be withdrawn after reassignment." : null };
    await audit(client, context, "participant.reassigned", `participant:${prior.participant_id}`, eventPayload);
    return { status: "accepted", aggregateVersion: Number(revision.rows[0]!.access_revision), eventType: "seat_assignment.changed", eventPayload };
  }});
}

export async function createGuestIdentity(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    const payload = requireOperation(command, "guest_identity.create", correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    const access = await config(client, context);
    const hours = Number(payload.expiresInHours);
    if (access === undefined || !access.access_policy.guests.allowed || access.access_policy.guests.operatorApproval !== true) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Guest access is not enabled." };
    }
    if (typeof payload.displayName !== "string" || payload.displayName.trim().length === 0 || payload.displayName.length > 200 ||
        typeof payload.seatId !== "string" || !Number.isInteger(hours) || hours < 1 || hours > access.access_policy.guests.expiryHours) {
      throw authorizationError("VALIDATION_FAILED", "The Guest Identity is invalid.", correlationId);
    }
    if (await seat(client, context, payload.seatId) === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Guest Seat was not found." };
    await client.query(
      `INSERT INTO identity.guest_identities(id,organization_id,session_id,display_name,seat_id,expires_at,approved_by)
       VALUES ($1,$2,$3,$4,$5,transaction_timestamp()+($6::text||' hours')::interval,$7)`,
      [command.aggregateId, context.organizationId, context.sessionId, payload.displayName.trim(), payload.seatId, hours, context.principalId]
    );
    await audit(client, context, "guest_identity.created", `guest:${command.aggregateId}`, { seatId: payload.seatId, expiresInHours: hours });
    return { status: "accepted", aggregateVersion: 1, eventType: "guest_identity.created",
      eventPayload: { guestIdentityId: command.aggregateId, seatId: payload.seatId } };
  }});
}

export async function activateDisplayPrincipal(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<{ receipt: CommandReceiptV1; credential: string | null }> {
  let credential: string | null = null;
  const receipt = await processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    const payload = requireOperation(command, "display_principal.activate", correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    const access = await config(client, context);
    const display = access?.access_policy.displays.find((item) => item.interfaceProfileId === payload.interfaceProfileId && item.classificationCeiling === payload.classificationCeiling);
    if (display === undefined) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The read-only Display Principal profile is not allowed." };
    credential = token();
    await client.query(
      `INSERT INTO identity.display_principals
       (id,organization_id,session_id,interface_profile_id,classification_ceiling,credential_sha256,credential_expires_at,activated_by)
       VALUES ($1,$2,$3,$4,$5,$6,transaction_timestamp()+interval '15 minutes',$7)`,
      [command.aggregateId, context.organizationId, context.sessionId, display.interfaceProfileId, display.classificationCeiling,
        digest(credential), context.principalId]
    );
    await audit(client, context, "display_principal.activated", `display:${command.aggregateId}`, { interfaceProfileId: display.interfaceProfileId, classificationCeiling: display.classificationCeiling });
    return { status: "accepted", aggregateVersion: 1, eventType: "display_principal.activated",
      eventPayload: { displayPrincipalId: command.aggregateId, interfaceProfileId: display.interfaceProfileId, classificationCeiling: display.classificationCeiling, readOnly: true } };
  }});
  return { receipt, credential };
}

export async function revokeSessionPrincipal(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client }) => {
    const payload = requireOperation(command, "principal.revoke", correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    if (typeof payload.principalType !== "string" || !["guest", "display"].includes(payload.principalType)) {
      throw authorizationError("VALIDATION_FAILED", "The revocation target is invalid.", correlationId);
    }
    const table = payload.principalType === "guest" ? "identity.guest_identities" : "identity.display_principals";
    const result = await client.query(
      `UPDATE ${table} SET revoked_at=transaction_timestamp()
        WHERE organization_id=$1 AND session_id=$2 AND id=$3 AND revoked_at IS NULL`,
      [context.organizationId, context.sessionId, command.aggregateId]
    );
    if (result.rowCount !== 1) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The active Principal was not found." };
    await audit(client, context, "principal.revoked", `${payload.principalType}:${command.aggregateId}`, { principalType: payload.principalType });
    return { status: "accepted", aggregateVersion: 2, eventType: "principal.access_revoked",
      eventPayload: { principalId: command.aggregateId, principalType: payload.principalType } };
  }});
}

export async function requireActiveGuest(pool: Pool, organizationId: string, guestIdentityId: string, correlationId: string) {
  return withOrganizationTransaction(pool, organizationId, async (client) => {
    const result = await client.query<{ session_id: string; seat_id: string }>(
      `SELECT session_id,seat_id FROM identity.guest_identities
        WHERE organization_id=$1 AND id=$2 AND revoked_at IS NULL AND expires_at>transaction_timestamp()`,
      [organizationId, guestIdentityId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("ACCESS_REVOKED", "Guest access is expired or revoked.", correlationId);
    return { sessionId: row.session_id, seatId: row.seat_id };
  });
}

async function readiness(client: PoolClient, context: PrincipalSessionCommandContext, activeReleaseId: string): Promise<ReadinessProjectionV1> {
  const access = await config(client, context);
  if (access === undefined) throw new Error("Session access configuration is missing");
  const checks = await client.query<{ check_key: string; label: string; blocking: boolean; governing_release_id: string; assignment_version: string; completed_at: Date | null }>(
    `SELECT check_key,label,blocking,governing_release_id,assignment_version,completed_at
       FROM runtime.session_readiness_checks WHERE organization_id=$1 AND session_id=$2 ORDER BY check_key`,
    [context.organizationId, context.sessionId]
  );
  const seats = await client.query<{ seat_id: string; min_occupancy: number; count: string }>(
    `SELECT seat.seat_id,seat.min_occupancy,count(assignment.id)
       FROM runtime.session_seats seat LEFT JOIN runtime.seat_assignments assignment
         ON assignment.organization_id=seat.organization_id AND assignment.session_id=seat.session_id
        AND assignment.seat_id=seat.seat_id AND assignment.valid_to IS NULL
      WHERE seat.organization_id=$1 AND seat.session_id=$2 AND seat.required
      GROUP BY seat.seat_id,seat.min_occupancy ORDER BY seat.seat_id`,
    [context.organizationId, context.sessionId]
  );
  const operator = await client.query(
    `SELECT 1 FROM runtime.session_operators WHERE organization_id=$1 AND session_id=$2 AND revoked_at IS NULL LIMIT 1`,
    [context.organizationId, context.sessionId]
  );
  const staffingSeats = await client.query<{
    seat_id: string; session_role_ids: string[]; team_id: string | null; min_occupancy: number; max_occupancy: number | null; occupied: string;
  }>(
    `SELECT seat.seat_id,seat.session_role_ids,seat.team_id,seat.min_occupancy,seat.max_occupancy,count(assignment.id) AS occupied
       FROM runtime.session_seats seat LEFT JOIN runtime.seat_assignments assignment
         ON assignment.organization_id=seat.organization_id AND assignment.session_id=seat.session_id
        AND assignment.seat_id=seat.seat_id AND assignment.valid_to IS NULL
      WHERE seat.organization_id=$1 AND seat.session_id=$2
      GROUP BY seat.seat_id,seat.session_role_ids,seat.team_id,seat.min_occupancy,seat.max_occupancy ORDER BY seat.seat_id`,
    [context.organizationId, context.sessionId]
  );
  const joinRequests = await client.query<{ person_id: string; requested_seat_id: string | null; status: string; submitted_at: Date }>(
    `SELECT person_id,requested_seat_id,status,submitted_at FROM runtime.join_requests
      WHERE organization_id=$1 AND session_id=$2 AND status IN ('waiting_room','assignment_pending')
      ORDER BY submitted_at`,
    [context.organizationId, context.sessionId]
  );
  const rosterReview = await client.query<{ id: string; row_number: number; person_id: string | null; seat_id: string | null; review_reasons: string[] }>(
    `SELECT id,row_number,person_id,seat_id,review_reasons FROM runtime.roster_import_rows
      WHERE organization_id=$1 AND session_id=$2 AND status='review' ORDER BY imported_at,row_number`,
    [context.organizationId, context.sessionId]
  );
  const assignments = await client.query<{
    id: string; participant_id: string; person_id: string; seat_id: string; session_role_id: string; team_id: string | null; access_revision: string;
  }>(
    `SELECT assignment.id,assignment.participant_id,participant.person_id,assignment.seat_id,
            assignment.session_role_id,assignment.team_id,revision.access_revision
       FROM runtime.seat_assignments assignment
       JOIN runtime.participants participant ON participant.organization_id=assignment.organization_id
        AND participant.session_id=assignment.session_id AND participant.id=assignment.participant_id
       JOIN runtime.participant_access_revisions revision ON revision.organization_id=assignment.organization_id
        AND revision.session_id=assignment.session_id AND revision.participant_id=assignment.participant_id
      WHERE assignment.organization_id=$1 AND assignment.session_id=$2 AND assignment.valid_to IS NULL
      ORDER BY assignment.seat_id,assignment.id`,
    [context.organizationId, context.sessionId]
  );
  const releaseCurrent = access.governing_release_id === activeReleaseId;
  const assignmentsComplete = seats.rows.every((item) => Number(item.count) >= item.min_occupancy);
  const items = [
    { key: "release_current", label: "Current governing Release is pinned", blocking: true, complete: releaseCurrent },
    { key: "required_seats", label: "Required Seats meet minimum occupancy", blocking: true, complete: assignmentsComplete },
    { key: "operator_assignment", label: "A Session Operator is assigned", blocking: true, complete: operator.rowCount === 1 },
    ...checks.rows.map((item) => ({ key: item.check_key, label: item.label, blocking: item.blocking,
      complete: item.completed_at !== null && item.governing_release_id === activeReleaseId && Number(item.assignment_version) === Number(access.assignment_version) }))
  ];
  return { contractId: "readiness-v1", sessionId: context.sessionId, governingReleaseId: activeReleaseId,
    assignmentVersion: Number(access.assignment_version), ready: items.every((item) => !item.blocking || item.complete), checks: items,
    staffing: {
      seats: staffingSeats.rows.map((item) => ({ seatId: item.seat_id, sessionRoleIds: item.session_role_ids,
        teamId: item.team_id, minimum: item.min_occupancy, maximum: item.max_occupancy, occupied: Number(item.occupied) })),
      joinRequests: joinRequests.rows.map((item) => ({ personId: item.person_id, requestedSeatId: item.requested_seat_id,
        status: item.status, submittedAt: item.submitted_at.toISOString() })),
      rosterReview: rosterReview.rows.map((item) => ({ rowId: item.id, rowNumber: item.row_number,
        personId: item.person_id, seatId: item.seat_id, reasons: item.review_reasons })),
      assignments: assignments.rows.map((item) => ({ seatAssignmentId: item.id, participantId: item.participant_id,
        personId: item.person_id, seatId: item.seat_id, sessionRoleId: item.session_role_id,
        teamId: item.team_id, accessRevision: Number(item.access_revision) }))
    } };
}

export async function getReadiness(
  pool: Pool, principal: AuthenticatedPrincipal, sessionId: string, correlationId: string
): Promise<ReadinessProjectionV1> {
  if (!principal.organizationRoles.includes("operator")) throw authorizationError("PERMISSION_DENIED", "Operator access is required.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    const session = await client.query<{ release_id: string }>(
      `SELECT release_id FROM runtime.release_activations WHERE organization_id=$1 AND session_id=$2 ORDER BY activation_sequence DESC LIMIT 1`,
      [principal.organizationId, sessionId]
    );
    if (session.rows[0] === undefined) throw authorizationError("NOT_FOUND", "The Session was not found.", correlationId);
    const context = { principalId: principal.principalId, organizationId: principal.organizationId,
      organizationRoles: principal.organizationRoles, sessionId, deviceId: "", authorityEpoch: 0 };
    if (await config(client, context) === undefined) {
      throw authorizationError("INVALID_TRANSITION", "Session access is not configured.", correlationId);
    }
    if (await requireSessionOperator(client, context) !== null) {
      throw authorizationError("PERMISSION_DENIED", "An active Session Operator assignment is required.", correlationId);
    }
    return readiness(client, context, session.rows[0].release_id);
  });
}

export async function confirmReadiness(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client, activeReleaseId }) => {
    const payload = requireOperation(command, "readiness.confirm", correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    if (typeof payload.checkKey !== "string" || payload.checkKey.length === 0 || payload.checkKey.length > 200) throw authorizationError("VALIDATION_FAILED", "The readiness check is invalid.", correlationId);
    const access = await config(client, context, true);
    if (access === undefined) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "Session access is not configured." };
    const result = await client.query(
      `UPDATE runtime.session_readiness_checks SET completed_by=$1,completed_at=transaction_timestamp(),
         governing_release_id=$2,assignment_version=$3
       WHERE organization_id=$4 AND session_id=$5 AND check_key=$6`,
      [context.principalId, activeReleaseId, Number(access.assignment_version), context.organizationId, context.sessionId, payload.checkKey]
    );
    if (result.rowCount !== 1) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The readiness check was not found." };
    await audit(client, context, "readiness.confirmed", `readiness:${payload.checkKey}`, { assignmentVersion: Number(access.assignment_version) });
    return { status: "accepted", aggregateVersion: Number(access.assignment_version), eventType: "readiness.confirmed",
      eventPayload: { checkKey: payload.checkKey, assignmentVersion: Number(access.assignment_version) } };
  }});
}

async function transitionSession(
  pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string,
  operation: "session.ready" | "session.open", from: "configured" | "ready", to: "ready" | "open", eventType: "session.readied" | "session.opened"
) {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId, lockSessionAndExecute: async ({ client, activeReleaseId, sessionStatus }) => {
    requireOperation(command, operation, correlationId);
    const denied = await requireSessionOperator(client, context); if (denied !== null) return denied;
    if (sessionStatus !== from) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: `The Session must be ${from}.` };
    const projection = await readiness(client, context, activeReleaseId);
    if (!projection.ready) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Required readiness checks are incomplete." };
    const updated = await client.query<{ version: string }>(
      "UPDATE runtime.sessions SET status=$1,version=version+1 WHERE organization_id=$2 AND id=$3 RETURNING version",
      [to, context.organizationId, context.sessionId]
    );
    await audit(client, context, eventType, `session:${context.sessionId}`, { governingReleaseId: activeReleaseId, assignmentVersion: projection.assignmentVersion });
    return { status: "accepted", aggregateVersion: Number(updated.rows[0]!.version), eventType,
      eventPayload: { sessionId: context.sessionId, governingReleaseId: activeReleaseId, assignmentVersion: projection.assignmentVersion } };
  }});
}

export const markSessionReady = (pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string) =>
  transitionSession(pool, context, command, correlationId, deploymentId, "session.ready", "configured", "ready", "session.readied");
export const openSession = (pool: Pool, context: PrincipalSessionCommandContext, command: CommandEnvelopeV1, correlationId: string, deploymentId: string) =>
  transitionSession(pool, context, command, correlationId, deploymentId, "session.open", "ready", "open", "session.opened");
