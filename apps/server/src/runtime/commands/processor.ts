import { createHash, randomUUID } from "node:crypto";
import {
  canonicalizeJson,
  isCommandOperationType,
  isPastTenseEventType,
  type CanonicalErrorCode,
  type CommandEnvelopeV1,
  type CommandReceiptV1,
  type JsonObject,
  type JsonValue
} from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../../database.js";
import { authorizationError } from "../../errors.js";
import type { SessionAccessContextV1 } from "../../identity/context.js";

export type CommandDecision =
  | { status: "accepted"; aggregateVersion: number; eventType: string; eventPayload: JsonObject;
      followUpEvents?: Array<{ eventType: string; eventPayload: JsonObject; aggregateVersion?: number }> }
  | { status: "rejected" | "needs_reconciliation"; errorCode: CanonicalErrorCode; message: string };

export interface CommandExecutionContext {
  client: PoolClient;
  context: SessionAccessContextV1;
  command: CommandEnvelopeV1;
  activeReleaseId: string;
}

export interface ProcessCommandInput {
  pool: Pool;
  context: SessionAccessContextV1;
  command: CommandEnvelopeV1;
  correlationId: string;
  deploymentId: string;
  lockAggregateAndExecute: (input: CommandExecutionContext) => Promise<CommandDecision>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function validateCommandEnvelope(command: CommandEnvelopeV1, correlationId: string): void {
  if (
    !uuid.test(command.commandId) || !uuid.test(command.deviceId) ||
    !uuid.test(command.aggregateId) || !uuid.test(command.governingReleaseId) ||
    !isCommandOperationType(command.operationType) ||
    !Number.isSafeInteger(command.expectedAggregateVersion) || command.expectedAggregateVersion < 0 ||
    typeof command.payload !== "object" || command.payload === null || Array.isArray(command.payload)
  ) {
    throw authorizationError("INVALID_COMMAND", "The Command envelope is invalid.", correlationId);
  }
}

function commandDigest(command: CommandEnvelopeV1): string {
  const value: JsonObject = {
    commandId: command.commandId.toLowerCase(),
    deviceId: command.deviceId.toLowerCase(),
    operationType: command.operationType,
    aggregateId: command.aggregateId.toLowerCase(),
    expectedAggregateVersion: command.expectedAggregateVersion,
    governingReleaseId: command.governingReleaseId.toLowerCase(),
    activeSessionRoleId: command.activeSessionRoleId ?? null,
    deviceObservedAt: command.deviceObservedAt ?? null,
    payload: command.payload
  };
  return createHash("sha256").update(canonicalizeJson(value)).digest("hex");
}

async function previousReceipt(
  client: PoolClient,
  sessionId: string,
  commandId: string
): Promise<(CommandReceiptV1 & { payloadSha256: string; actorPersonId: string }) | undefined> {
  const result = await client.query<{
    command_id: string; status: CommandReceiptV1["status"]; result_version: string | null;
    evidence_sequence: string | null; rejection_code: CanonicalErrorCode | null; message: string | null;
    payload_sha256: string; actor_person_id: string;
  }>(
    `SELECT command_id, status, result_version, evidence_sequence, rejection_code, message,
            payload_sha256, actor_person_id
       FROM sync.command_receipts
      WHERE session_id = $1 AND command_id = $2`,
    [sessionId, commandId]
  );
  const row = result.rows[0];
  if (row === undefined) return undefined;
  return {
    commandId: row.command_id,
    status: row.status,
    aggregateVersion: row.result_version === null ? null : Number(row.result_version),
    evidenceSequence: row.evidence_sequence === null ? null : Number(row.evidence_sequence),
    errorCode: row.rejection_code,
    message: row.message,
    replayed: true,
    payloadSha256: row.payload_sha256,
    actorPersonId: row.actor_person_id
  };
}

async function allocateEvidenceSequence(client: PoolClient, organizationId: string, sessionId: string): Promise<number> {
  const result = await client.query<{ sequence: string }>(
    `UPDATE evidence.session_sequences
        SET next_sequence = next_sequence + 1
      WHERE organization_id = $1 AND session_id = $2
    RETURNING next_sequence - 1 AS sequence`,
    [organizationId, sessionId]
  );
  const sequence = Number(result.rows[0]?.sequence);
  if (!Number.isSafeInteger(sequence)) throw new Error("Session evidence sequence is missing");
  return sequence;
}

async function recordOutcome(
  client: PoolClient,
  input: Omit<ProcessCommandInput, "pool" | "lockAggregateAndExecute">,
  digest: string,
  decision: CommandDecision,
  activeReleaseId: string
): Promise<CommandReceiptV1> {
  const { context, command, correlationId } = input;
  const accepted = decision.status === "accepted";
  const eventType = accepted
    ? decision.eventType
    : decision.status === "rejected" ? "command.rejected" : "command.reconciliation_required";
  if (!isPastTenseEventType(eventType)) throw new Error(`Event type is not past-tense dot-case: ${eventType}`);
  const aggregateVersion = accepted ? decision.aggregateVersion : null;
  const errorCode = accepted ? null : decision.errorCode;
  const message = accepted ? null : decision.message;
  const eventPayload: JsonObject = accepted ? decision.eventPayload : {
    operationType: command.operationType,
    aggregateId: command.aggregateId,
    errorCode,
    activeSessionRoleId: context.activeSessionRoleId
  };
  const sequence = await allocateEvidenceSequence(client, context.organizationId, context.sessionId);
  const eventId = randomUUID();
  await client.query(
    `INSERT INTO evidence.events
       (id, organization_id, session_id, sequence, event_type, event_version, command_id,
        actor_person_id, actor_participant_id, governing_release_id, authority_epoch, body,
        correlation_id, causation_id, aggregate_id, aggregate_version, occurred_at)
     VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10,$11::jsonb,$12,$6,$13,$14,transaction_timestamp())`,
    [eventId, context.organizationId, context.sessionId, sequence, eventType, command.commandId,
      context.principalId, context.participantId, accepted ? command.governingReleaseId : activeReleaseId, context.authorityEpoch,
      JSON.stringify(eventPayload), correlationId, command.aggregateId, aggregateVersion]
  );
  await client.query(
    `INSERT INTO sync.command_receipts
       (id, organization_id, session_id, command_id, payload_sha256, device_id, actor_person_id,
        actor_participant_id, active_session_role_id, authority_epoch, operation_type, aggregate_id,
        status, result_version, evidence_sequence, rejection_code, resolved_at, correlation_id, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
             transaction_timestamp(),$17,$18)`,
    [randomUUID(), context.organizationId, context.sessionId, command.commandId, digest,
      command.deviceId, context.principalId, context.participantId, context.activeSessionRoleId,
      context.authorityEpoch, command.operationType, command.aggregateId, decision.status,
      aggregateVersion, sequence, errorCode, correlationId, message]
  );
  await client.query(
    `INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id)
     VALUES ($1,$2,$3,$4)`,
    [randomUUID(), context.organizationId, context.sessionId, eventId]
  );
  if (accepted) {
    for (const followUp of decision.followUpEvents ?? []) {
      if (!isPastTenseEventType(followUp.eventType)) throw new Error(`Event type is not past-tense dot-case: ${followUp.eventType}`);
      const followUpSequence = await allocateEvidenceSequence(client, context.organizationId, context.sessionId);
      const followUpId = randomUUID();
      await client.query(
        `INSERT INTO evidence.events
           (id,organization_id,session_id,sequence,event_type,event_version,actor_person_id,actor_participant_id,
            governing_release_id,authority_epoch,body,correlation_id,causation_id,aggregate_id,aggregate_version,occurred_at)
         VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,transaction_timestamp())`,
        [followUpId, context.organizationId, context.sessionId, followUpSequence, followUp.eventType,
          context.principalId, context.participantId, command.governingReleaseId, context.authorityEpoch,
          JSON.stringify(followUp.eventPayload), correlationId, command.commandId, command.aggregateId,
          followUp.aggregateVersion ?? aggregateVersion]
      );
      await client.query(
        `INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id) VALUES ($1,$2,$3,$4)`,
        [randomUUID(), context.organizationId, context.sessionId, followUpId]
      );
    }
  }
  return { commandId: command.commandId, status: decision.status, aggregateVersion,
    evidenceSequence: sequence, errorCode, message, replayed: false };
}

export async function processSessionCommand(input: ProcessCommandInput): Promise<CommandReceiptV1> {
  const { pool, context, command, correlationId, deploymentId } = input;
  validateCommandEnvelope(command, correlationId);
  if (context.deviceId === undefined || command.deviceId !== context.deviceId) {
    throw authorizationError("DEVICE_NOT_REGISTERED", "The Device is not registered.", correlationId);
  }
  const digest = commandDigest(command);

  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const authority = await client.query<{ deployment_id: string; authority_epoch: string; status: string }>(
      `SELECT deployment_id, authority_epoch, status FROM runtime.session_authorities
        WHERE organization_id=$1 AND session_id=$2 FOR UPDATE`,
      [context.organizationId, context.sessionId]
    );
    const authorityRow = authority.rows[0];
    if (authorityRow === undefined) throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", correlationId);

    const prior = await previousReceipt(client, context.sessionId, command.commandId);
    if (prior !== undefined) {
      if (prior.payloadSha256 !== digest || prior.actorPersonId !== context.principalId) {
        throw authorizationError("IDEMPOTENCY_COLLISION", "The Command ID was already used.", correlationId);
      }
      const { payloadSha256: _digest, actorPersonId: _actor, ...receipt } = prior;
      return receipt;
    }
    if (
      authorityRow.deployment_id !== deploymentId ||
      Number(authorityRow.authority_epoch) !== context.authorityEpoch || authorityRow.status !== "active"
    ) throw authorizationError("AUTHORITY_UNAVAILABLE", "This Deployment is not the Session Authority.", correlationId);

    const access = await client.query<{ participant_exists: boolean; active_role: boolean; active_release_id: string; status: string }>(
      `SELECT EXISTS(
         SELECT 1 FROM runtime.participants participant
          WHERE participant.organization_id=$1 AND participant.session_id=$2
            AND participant.id=$3 AND participant.person_id=$5
       ) AS participant_exists,
       EXISTS(
         SELECT 1 FROM runtime.seat_assignments assignment
          WHERE assignment.organization_id=$1 AND assignment.session_id=$2
            AND assignment.participant_id=$3 AND assignment.session_role_id=$4
            AND assignment.valid_to IS NULL
       ) AS active_role,
       (SELECT release_id FROM runtime.release_activations
         WHERE organization_id=$1 AND session_id=$2 ORDER BY activation_sequence DESC LIMIT 1) AS active_release_id,
       (SELECT status FROM runtime.sessions WHERE organization_id=$1 AND id=$2) AS status`,
      [context.organizationId, context.sessionId, context.participantId, context.activeSessionRoleId, context.principalId]
    );
    const accessRow = access.rows[0];
    if (accessRow === undefined || !accessRow.participant_exists || accessRow.status === null) {
      throw authorizationError("NOT_A_PARTICIPANT", "The Principal is not a Participant.", correlationId);
    }
    const device = await client.query(
      `SELECT 1 FROM sync.devices WHERE organization_id=$1 AND id=$2 AND person_id=$3 AND revoked_at IS NULL`,
      [context.organizationId, command.deviceId, context.principalId]
    );
    if (device.rowCount !== 1) throw authorizationError("DEVICE_NOT_REGISTERED", "The Device is not registered.", correlationId);

    if (!accessRow.active_role || (command.activeSessionRoleId !== undefined && command.activeSessionRoleId !== context.activeSessionRoleId)) {
      return recordOutcome(client, input, digest, { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Active Role Context is not authorized." }, accessRow.active_release_id);
    }
    if (accessRow.status !== "active") {
      return recordOutcome(client, input, digest, { status: "rejected", errorCode: "SESSION_NOT_ACTIVE", message: `The Session is ${accessRow.status}.` }, accessRow.active_release_id);
    }
    const decision = await input.lockAggregateAndExecute({ client, context, command, activeReleaseId: accessRow.active_release_id });
    return recordOutcome(client, input, digest, decision, accessRow.active_release_id);
  });
}
