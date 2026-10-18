import { randomUUID } from "node:crypto";
import type { CommandEnvelopeV1, CommandReceiptV1, JsonObject } from "@plenum/event-contracts";
import type { Pool } from "pg";

import { authorizationError } from "../errors.js";
import type { SessionAccessContextV1 } from "../identity/context.js";
import { processSessionCommand, type CommandDecision } from "../runtime/commands/processor.js";

export interface ReassignParticipantPayload extends JsonObject {
  previousSeatAssignmentId: string;
  newSessionRoleId: string;
  newSeatId: string;
  reason: string;
}

function readPayload(command: CommandEnvelopeV1, correlationId: string): ReassignParticipantPayload {
  const payload = command.payload;
  if (
    command.operationType !== "participant.reassign" ||
    typeof payload.previousSeatAssignmentId !== "string" || payload.previousSeatAssignmentId.length === 0 ||
    typeof payload.newSessionRoleId !== "string" || payload.newSessionRoleId.length === 0 ||
    typeof payload.newSeatId !== "string" || payload.newSeatId.length === 0 ||
    typeof payload.reason !== "string" || payload.reason.trim().length < 3 || payload.reason.length > 500
  ) throw authorizationError("INVALID_COMMAND", "The reassignment Command is invalid.", correlationId);
  return payload as ReassignParticipantPayload;
}

export async function reassignParticipant(
  pool: Pool,
  context: SessionAccessContextV1,
  command: CommandEnvelopeV1,
  correlationId: string,
  deploymentId: string
): Promise<CommandReceiptV1> {
  const payload = readPayload(command, correlationId);
  return processSessionCommand({
    pool,
    context,
    command,
    correlationId,
    deploymentId,
    lockAggregateAndExecute: async ({ client, activeReleaseId }) => {
      if (!context.organizationRoles.includes("operator")) {
        return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "An Operator Organization Role is required." };
      }
      const assignment = await client.query<{ access_revision: string }>(
        `SELECT COALESCE(revision.access_revision, 1) AS access_revision
           FROM runtime.seat_assignments assignment
           JOIN runtime.participant_access_revisions revision
             ON revision.organization_id=assignment.organization_id
            AND revision.session_id=assignment.session_id
            AND revision.participant_id=assignment.participant_id
          WHERE assignment.organization_id=$1 AND assignment.session_id=$2
            AND assignment.participant_id=$3 AND assignment.id=$4 AND assignment.valid_to IS NULL
          FOR UPDATE OF assignment, revision`,
        [context.organizationId, context.sessionId, context.participantId, payload.previousSeatAssignmentId]
      );
      const row = assignment.rows[0];
      if (row === undefined) {
        return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The active Seat Assignment was not found." };
      }
      if (command.governingReleaseId !== activeReleaseId) {
        return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "The governing Release changed." };
      }
      if (command.expectedAggregateVersion !== Number(row.access_revision)) {
        return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: "The Participant access version changed." };
      }

      await client.query(
        `UPDATE runtime.seat_assignments
            SET valid_to=transaction_timestamp(), ended_by=$1, end_reason=$2
          WHERE organization_id=$3 AND id=$4`,
        [context.principalId, payload.reason.trim(), context.organizationId, payload.previousSeatAssignmentId]
      );
      const seatAssignmentId = randomUUID();
      await client.query(
        `INSERT INTO runtime.seat_assignments
           (id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [seatAssignmentId, context.organizationId, context.sessionId, context.participantId,
          payload.newSessionRoleId, payload.newSeatId, context.principalId]
      );
      const revision = await client.query<{ access_revision: string }>(
        `INSERT INTO runtime.participant_access_revisions
           (organization_id,session_id,participant_id,access_revision)
         VALUES ($1,$2,$3,2)
         ON CONFLICT (organization_id,session_id,participant_id)
         DO UPDATE SET access_revision=runtime.participant_access_revisions.access_revision+1,
                       refreshed_at=transaction_timestamp()
         RETURNING access_revision`,
        [context.organizationId, context.sessionId, context.participantId]
      );
      const accessRevision = Number(revision.rows[0]?.access_revision);
      await client.query(
        `UPDATE sync.projection_grants SET revoked_at=transaction_timestamp()
          WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 AND revoked_at IS NULL`,
        [context.organizationId, context.sessionId, context.participantId]
      );
      const eventPayload = {
        previousSeatAssignmentId: payload.previousSeatAssignmentId,
        seatAssignmentId,
        participantId: context.participantId,
        newSessionRoleId: payload.newSessionRoleId,
        newSeatId: payload.newSeatId,
        reason: payload.reason.trim(),
        accessRevision,
        exposureWarning: "Previously viewed information cannot be withdrawn after reassignment."
      };
      await client.query(
        `INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
         VALUES ($1,$2,$3,'participant.reassigned',$4,$5::jsonb)`,
        [randomUUID(), context.organizationId, context.principalId,
          `participant:${context.participantId}`, JSON.stringify({ correlationId, ...eventPayload })]
      );
      return {
        status: "accepted",
        aggregateVersion: accessRevision,
        eventType: "seat_assignment.changed",
        eventPayload
      } satisfies CommandDecision;
    }
  });
}
