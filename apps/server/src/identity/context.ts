import type { PoolClient } from "pg";
import type { OrganizationRole, PolicyContext } from "@plenum/policy-engine";

import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "./login.js";

export const SESSION_ACCESS_CONTEXT_CONTRACT_ID = "session-access-context-v1";

export interface SessionAccessContextV1 {
  principalId: string;
  principalType: "person";
  authenticationSessionId: string;
  deviceId?: string;
  organizationId: string;
  sessionId: string;
  sessionStatus: string;
  participantId: string;
  seatAssignmentIds: string[];
  activeSessionRoleId: string;
  seatId?: string;
  organizationRoles: OrganizationRole[];
  activeReleaseId: string;
  authenticationStrength: string;
  featureFlags: string[];
  authorityEpoch: number;
  accessRevision: number;
}

export interface ResolveSessionContextInput {
  sessionId: string;
  deviceId?: string;
  requestedActiveSessionRoleId?: string;
  correlationId: string;
}

export async function resolveSessionAccessContext(
  client: PoolClient,
  principal: AuthenticatedPrincipal,
  input: ResolveSessionContextInput
): Promise<SessionAccessContextV1> {
  const authentication = await client.query(
    `SELECT 1
       FROM identity.authentication_sessions
      WHERE id = $1
        AND organization_id = $2
        AND person_id = $3
        AND revoked_at IS NULL
        AND expires_at > transaction_timestamp()`,
    [principal.authenticationSessionId, principal.organizationId, principal.principalId]
  );
  if (authentication.rowCount !== 1) {
    throw authorizationError("AUTH_EXPIRED", "The Authentication Session is expired or revoked.", input.correlationId);
  }

  const session = await client.query<{
    status: string;
    active_release_id: string;
    authority_epoch: string;
  }>(
    `SELECT s.status,
            activation.release_id AS active_release_id,
            authority.authority_epoch
       FROM runtime.sessions s
       JOIN LATERAL (
         SELECT release_id
           FROM runtime.release_activations
          WHERE organization_id = s.organization_id AND session_id = s.id
          ORDER BY activation_sequence DESC
          LIMIT 1
       ) activation ON true
       JOIN runtime.session_authorities authority
         ON authority.organization_id = s.organization_id
        AND authority.session_id = s.id
        AND authority.status = 'active'
      WHERE s.organization_id = $1 AND s.id = $2`,
    [principal.organizationId, input.sessionId]
  );
  const sessionRow = session.rows[0];
  if (sessionRow === undefined) {
    throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", input.correlationId);
  }

  const participant = await client.query<{
    participant_id: string;
    access_revision: string;
  }>(
    `SELECT p.id AS participant_id, COALESCE(access.access_revision, 1) AS access_revision
       FROM runtime.participants p
       LEFT JOIN runtime.participant_access_revisions access
         ON access.organization_id = p.organization_id
        AND access.session_id = p.session_id
        AND access.participant_id = p.id
      WHERE p.organization_id = $1 AND p.session_id = $2 AND p.person_id = $3`,
    [principal.organizationId, input.sessionId, principal.principalId]
  );
  const participantRow = participant.rows[0];
  if (participantRow === undefined) {
    throw authorizationError("NOT_A_PARTICIPANT", "The Principal is not a Participant in this Session.", input.correlationId);
  }

  if (input.deviceId !== undefined) {
    const device = await client.query(
      `SELECT 1 FROM sync.devices
        WHERE organization_id = $1 AND id = $2 AND person_id = $3 AND revoked_at IS NULL`,
      [principal.organizationId, input.deviceId, principal.principalId]
    );
    if (device.rowCount !== 1) {
      throw authorizationError("DEVICE_NOT_REGISTERED", "The Device is not registered.", input.correlationId);
    }
  }

  const assignments = await client.query<{
    id: string;
    session_role_id: string;
    seat_id: string | null;
  }>(
    `SELECT id, session_role_id, seat_id
       FROM runtime.seat_assignments
      WHERE organization_id = $1
        AND session_id = $2
        AND participant_id = $3
        AND valid_to IS NULL
      ORDER BY valid_from, id`,
    [principal.organizationId, input.sessionId, participantRow.participant_id]
  );
  if (assignments.rows.length === 0) {
    throw authorizationError("PERMISSION_DENIED", "The Participant has no active Seat Assignment.", input.correlationId);
  }

  const selected = input.requestedActiveSessionRoleId === undefined
    ? assignments.rows.length === 1 ? assignments.rows[0] : undefined
    : assignments.rows.find((assignment) => assignment.session_role_id === input.requestedActiveSessionRoleId);
  if (selected === undefined) {
    throw authorizationError(
      "PERMISSION_DENIED",
      "A valid Active Role Context is required.",
      input.correlationId
    );
  }

  return {
    principalId: principal.principalId,
    principalType: "person",
    authenticationSessionId: principal.authenticationSessionId,
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    organizationId: principal.organizationId,
    sessionId: input.sessionId,
    sessionStatus: sessionRow.status,
    participantId: participantRow.participant_id,
    seatAssignmentIds: assignments.rows.map((assignment) => assignment.id),
    activeSessionRoleId: selected.session_role_id,
    ...(selected.seat_id === null ? {} : { seatId: selected.seat_id }),
    organizationRoles: principal.organizationRoles,
    activeReleaseId: sessionRow.active_release_id,
    authenticationStrength: principal.authenticationStrength,
    featureFlags: [],
    authorityEpoch: Number(sessionRow.authority_epoch),
    accessRevision: Number(participantRow.access_revision)
  };
}

export function toPolicyContext(context: SessionAccessContextV1): PolicyContext {
  return {
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    participantId: context.participantId,
    activeSessionRoleId: context.activeSessionRoleId,
    organizationRoles: context.organizationRoles
  };
}
