import { createHash, randomUUID } from "node:crypto";
import type { CommandEnvelopeV1, JsonObject } from "@plenum/event-contracts";
import type { Pool } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { SessionAccessContextV1 } from "../identity/context.js";

export interface ReassignParticipantPayload extends JsonObject {
  previousSeatAssignmentId: string;
  newSessionRoleId: string;
  newSeatId: string;
  reason: string;
}

export interface ReassignmentReceipt {
  commandId: string;
  seatAssignmentId: string;
  accessRevision: number;
  evidenceSequence: number;
  exposureWarning: string;
  replayed: boolean;
}

function digestCommand(command: CommandEnvelopeV1): string {
  const canonical = JSON.stringify({
    activeSessionRoleId: command.activeSessionRoleId ?? null,
    aggregateId: command.aggregateId,
    commandId: command.commandId,
    deviceId: command.deviceId,
    expectedAggregateVersion: command.expectedAggregateVersion,
    governingReleaseId: command.governingReleaseId,
    operationType: command.operationType,
    payload: command.payload
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function readPayload(command: CommandEnvelopeV1, correlationId: string): ReassignParticipantPayload {
  const payload = command.payload;
  if (
    command.operationType !== "participant.reassign" ||
    typeof payload.previousSeatAssignmentId !== "string" || payload.previousSeatAssignmentId.length === 0 ||
    typeof payload.newSessionRoleId !== "string" || payload.newSessionRoleId.length === 0 ||
    typeof payload.newSeatId !== "string" || payload.newSeatId.length === 0 ||
    typeof payload.reason !== "string" || payload.reason.trim().length < 3 || payload.reason.length > 500
  ) {
    throw authorizationError("INVALID_COMMAND", "The reassignment Command is invalid.", correlationId);
  }
  return payload as ReassignParticipantPayload;
}

export async function reassignParticipant(
  pool: Pool,
  context: SessionAccessContextV1,
  command: CommandEnvelopeV1,
  correlationId: string
): Promise<ReassignmentReceipt> {
  if (!context.organizationRoles.includes("operator")) {
    throw authorizationError("PERMISSION_DENIED", "An Operator Organization Role is required.", correlationId);
  }
  if (command.aggregateId !== context.participantId || command.deviceId !== context.deviceId) {
    throw authorizationError("PERMISSION_DENIED", "The Command does not match the trusted Session context.", correlationId);
  }
  const payload = readPayload(command, correlationId);
  const payloadSha256 = digestCommand(command);

  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const prior = await client.query<{
      payload_sha256: string;
      actor_person_id: string;
      result_version: string;
      evidence_sequence: string;
      seat_assignment_id: string;
    }>(
      `SELECT receipt.payload_sha256, receipt.actor_person_id, receipt.result_version,
              receipt.evidence_sequence, event.body->>'seatAssignmentId' AS seat_assignment_id
         FROM sync.command_receipts receipt
         JOIN evidence.events event
           ON event.organization_id = receipt.organization_id
          AND event.session_id = receipt.session_id
          AND event.sequence = receipt.evidence_sequence
        WHERE receipt.session_id = $1 AND receipt.command_id = $2
        FOR UPDATE OF receipt`,
      [context.sessionId, command.commandId]
    );
    const priorRow = prior.rows[0];
    if (priorRow !== undefined) {
      if (priorRow.payload_sha256 !== payloadSha256 || priorRow.actor_person_id !== context.principalId) {
        throw authorizationError("IDEMPOTENCY_COLLISION", "The Command ID was already used.", correlationId);
      }
      return {
        commandId: command.commandId,
        seatAssignmentId: priorRow.seat_assignment_id,
        accessRevision: Number(priorRow.result_version),
        evidenceSequence: Number(priorRow.evidence_sequence),
        exposureWarning: "Previously viewed information cannot be withdrawn after reassignment.",
        replayed: true
      };
    }

    const authority = await client.query<{ authority_epoch: string; release_id: string }>(
      `SELECT authority.authority_epoch, activation.release_id
         FROM runtime.session_authorities authority
         JOIN LATERAL (
           SELECT release_id
             FROM runtime.release_activations
            WHERE organization_id = authority.organization_id AND session_id = authority.session_id
            ORDER BY activation_sequence DESC
            LIMIT 1
         ) activation ON true
        WHERE authority.organization_id = $1
          AND authority.session_id = $2
          AND authority.status = 'active'
        FOR UPDATE OF authority`,
      [context.organizationId, context.sessionId]
    );
    const authorityRow = authority.rows[0];
    if (authorityRow === undefined || Number(authorityRow.authority_epoch) !== context.authorityEpoch) {
      throw authorizationError("AUTHORITY_UNAVAILABLE", "The Session Authority changed.", correlationId);
    }
    if (authorityRow.release_id !== command.governingReleaseId) {
      throw authorizationError("INCOMPATIBLE_RELEASE", "The governing Release is no longer active.", correlationId);
    }

    const current = await client.query<{ access_revision: string }>(
      `SELECT access_revision
         FROM runtime.participant_access_revisions
        WHERE organization_id = $1 AND session_id = $2 AND participant_id = $3
        FOR UPDATE`,
      [context.organizationId, context.sessionId, context.participantId]
    );
    const currentVersion = Number(current.rows[0]?.access_revision ?? 1);
    if (command.expectedAggregateVersion !== currentVersion) {
      throw authorizationError("STALE_AGGREGATE_VERSION", "The Participant access version changed.", correlationId);
    }

    const closed = await client.query(
      `UPDATE runtime.seat_assignments
          SET valid_to = transaction_timestamp(), ended_by = $1, end_reason = $2
        WHERE organization_id = $3
          AND session_id = $4
          AND participant_id = $5
          AND id = $6
          AND valid_to IS NULL`,
      [context.principalId, payload.reason.trim(), context.organizationId, context.sessionId,
        context.participantId, payload.previousSeatAssignmentId]
    );
    if (closed.rowCount !== 1) {
      throw authorizationError("TARGET_NOT_FOUND", "The active Seat Assignment was not found.", correlationId);
    }

    const seatAssignmentId = randomUUID();
    await client.query(
      `INSERT INTO runtime.seat_assignments
         (id, organization_id, session_id, participant_id, session_role_id, seat_id, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [seatAssignmentId, context.organizationId, context.sessionId, context.participantId,
        payload.newSessionRoleId, payload.newSeatId, context.principalId]
    );

    const revision = await client.query<{ access_revision: string }>(
      `INSERT INTO runtime.participant_access_revisions
         (organization_id, session_id, participant_id, access_revision)
       VALUES ($1, $2, $3, 2)
       ON CONFLICT (organization_id, session_id, participant_id)
       DO UPDATE SET access_revision = runtime.participant_access_revisions.access_revision + 1,
                     refreshed_at = transaction_timestamp()
       RETURNING access_revision`,
      [context.organizationId, context.sessionId, context.participantId]
    );
    const accessRevision = Number(revision.rows[0]?.access_revision);
    await client.query(
      `UPDATE sync.projection_grants
          SET revoked_at = transaction_timestamp()
        WHERE organization_id = $1 AND session_id = $2 AND participant_id = $3 AND revoked_at IS NULL`,
      [context.organizationId, context.sessionId, context.participantId]
    );

    const sequence = await client.query<{ sequence: string }>(
      `UPDATE evidence.session_sequences
          SET next_sequence = next_sequence + 1
        WHERE organization_id = $1 AND session_id = $2
      RETURNING next_sequence - 1 AS sequence`,
      [context.organizationId, context.sessionId]
    );
    const evidenceSequence = Number(sequence.rows[0]?.sequence);
    if (!Number.isSafeInteger(evidenceSequence)) {
      throw authorizationError("INTERNAL", "The Session evidence sequence is missing.", correlationId);
    }

    const eventId = randomUUID();
    const eventBody = {
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
      `INSERT INTO evidence.events
         (id, organization_id, session_id, sequence, event_type, event_version, command_id,
          actor_person_id, actor_participant_id, governing_release_id, authority_epoch, body)
       VALUES ($1, $2, $3, $4, 'seat_assignment.changed', 1, $5, $6, $7, $8, $9, $10::jsonb)`,
      [eventId, context.organizationId, context.sessionId, evidenceSequence, command.commandId,
        context.principalId, context.participantId, command.governingReleaseId,
        context.authorityEpoch, JSON.stringify(eventBody)]
    );
    await client.query(
      `INSERT INTO sync.command_receipts
         (id, organization_id, session_id, command_id, payload_sha256, device_id,
          actor_person_id, actor_participant_id, active_session_role_id, authority_epoch,
          operation_type, aggregate_id, status, result_version, evidence_sequence, resolved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'accepted', $13, $14,
               transaction_timestamp())`,
      [randomUUID(), context.organizationId, context.sessionId, command.commandId, payloadSha256,
        command.deviceId, context.principalId, context.participantId, context.activeSessionRoleId,
        context.authorityEpoch, command.operationType, command.aggregateId, accessRevision, evidenceSequence]
    );
    await client.query(
      `INSERT INTO sync.session_delta_outbox
         (id, organization_id, session_id, event_id)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), context.organizationId, context.sessionId, eventId]
    );
    await client.query(
      `INSERT INTO evidence.audit_records
         (id, organization_id, actor_person_id, action, target_ref, details)
       VALUES ($1, $2, $3, 'participant.reassigned', $4, $5::jsonb)`,
      [randomUUID(), context.organizationId, context.principalId,
        `participant:${context.participantId}`, JSON.stringify({ correlationId, ...eventBody })]
    );

    return {
      commandId: command.commandId,
      seatAssignmentId,
      accessRevision,
      evidenceSequence,
      exposureWarning: eventBody.exposureWarning,
      replayed: false
    };
  });
}
