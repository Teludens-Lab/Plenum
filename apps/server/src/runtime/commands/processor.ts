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

export interface PrincipalSessionCommandContext {
  principalId: string;
  organizationId: string;
  organizationRoles: string[];
  sessionId: string;
  deviceId: string;
  authorityEpoch: number;
}

export interface ProcessPrincipalCommandInput {
  pool: Pool;
  context: PrincipalSessionCommandContext;
  command: CommandEnvelopeV1;
  correlationId: string;
  deploymentId: string;
  lockSessionAndExecute: (input: {
    client: PoolClient;
    context: PrincipalSessionCommandContext;
    command: CommandEnvelopeV1;
    activeReleaseId: string;
    sessionStatus: string;
  }) => Promise<CommandDecision>;
}

type RecordedCommandContext = {
  principalId: string;
  organizationId: string;
  sessionId: string;
  deviceId?: string;
  participantId?: string;
  activeSessionRoleId?: string;
  authorityEpoch: number;
};

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

async function lockAuthority(
  client: PoolClient,
  organizationId: string,
  sessionId: string,
  commandId: string
): Promise<{ deploymentId: string; authorityEpoch: number; status: string } | undefined> {
  const result = await client.query<{
    deployment_id: string; authority_epoch: string; status: string;
  }>(
    `WITH authority AS MATERIALIZED (
       SELECT deployment_id,authority_epoch,status
         FROM runtime.session_authorities
        WHERE organization_id=$1::uuid AND session_id=$2::uuid FOR SHARE
     )
     SELECT authority.deployment_id,authority.authority_epoch,authority.status,
            pg_advisory_xact_lock(hashtext($2::text),hashtext($3::text))
       FROM authority`,
    [organizationId, sessionId, commandId]
  );
  const row = result.rows[0];
  if (row === undefined) return undefined;
  return {
    deploymentId: row.deployment_id,
    authorityEpoch: Number(row.authority_epoch),
    status: row.status
  };
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
    `SELECT command_id,status,result_version,evidence_sequence,rejection_code,message,
            payload_sha256,actor_person_id
       FROM sync.command_receipts
      WHERE session_id=$1 AND command_id=$2`,
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
  input: { context: RecordedCommandContext; command: CommandEnvelopeV1; correlationId: string; deploymentId: string },
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
    activeSessionRoleId: context.activeSessionRoleId ?? null
  };
  const eventId = randomUUID();
  const recorded = await client.query<{ sequence: string }>(
    `WITH allocated AS (
       UPDATE evidence.session_sequences SET next_sequence=next_sequence+1
        WHERE organization_id=$1 AND session_id=$2 RETURNING next_sequence-1 AS sequence
     ), inserted_event AS (
       INSERT INTO evidence.events
         (id,organization_id,session_id,sequence,event_type,event_version,command_id,actor_person_id,
          actor_participant_id,governing_release_id,authority_epoch,body,correlation_id,causation_id,
          aggregate_id,aggregate_version,occurred_at)
       SELECT $3,$1,$2,allocated.sequence,$4,1,$5,$6,$7,$8,$9,$10::jsonb,$11,$5,$12,$13,transaction_timestamp()
         FROM allocated RETURNING sequence
     ), inserted_receipt AS (
       INSERT INTO sync.command_receipts
         (id,organization_id,session_id,command_id,payload_sha256,device_id,actor_person_id,
          actor_participant_id,active_session_role_id,authority_epoch,operation_type,aggregate_id,
          status,result_version,evidence_sequence,rejection_code,resolved_at,correlation_id,message)
       SELECT $14,$1,$2,$5,$15,$16,$6,$7,$17,$9,$18,$12,$19,$13,inserted_event.sequence,$20,
              transaction_timestamp(),$11,$21 FROM inserted_event
     ), inserted_outbox AS (
       INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id)
       SELECT $22,$1,$2,$3 FROM inserted_event
     ) SELECT sequence FROM inserted_event`,
    [context.organizationId, context.sessionId, eventId, eventType, command.commandId, context.principalId,
      context.participantId ?? null, accepted ? command.governingReleaseId : activeReleaseId, context.authorityEpoch,
      JSON.stringify(eventPayload), correlationId, command.aggregateId, aggregateVersion, randomUUID(), digest,
      command.deviceId, context.activeSessionRoleId ?? null, command.operationType, decision.status, errorCode, message, randomUUID()]
  );
  const sequence = Number(recorded.rows[0]?.sequence);
  if (!Number.isSafeInteger(sequence)) throw new Error("Session evidence sequence is missing");
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

/** Records pre-admission and Session Operator Commands without inventing a Participant Seat. */
export async function processPrincipalSessionCommand(input: ProcessPrincipalCommandInput): Promise<CommandReceiptV1> {
  const { pool, context, command, correlationId, deploymentId } = input;
  validateCommandEnvelope(command, correlationId);
  if (command.deviceId !== context.deviceId) {
    throw authorizationError("DEVICE_NOT_REGISTERED", "The Device is not registered.", correlationId);
  }
  const digest = commandDigest(command);
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const authorityRow = await lockAuthority(client, context.organizationId, context.sessionId, command.commandId);
    if (authorityRow === undefined) throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", correlationId);
    const prior = await previousReceipt(client, context.sessionId, command.commandId);
    if (prior !== undefined) {
      if (prior.payloadSha256 !== digest || prior.actorPersonId !== context.principalId) {
        throw authorizationError("IDEMPOTENCY_COLLISION", "The Command ID was already used.", correlationId);
      }
      const { payloadSha256: _digest, actorPersonId: _actor, ...receipt } = prior;
      return receipt;
    }
    if (authorityRow.deploymentId !== deploymentId || authorityRow.authorityEpoch !== context.authorityEpoch || authorityRow.status !== "active") {
      throw authorizationError("AUTHORITY_UNAVAILABLE", "This Deployment is not the Session Authority.", correlationId);
    }
    const device = await client.query(
      "SELECT 1 FROM sync.devices WHERE organization_id=$1 AND id=$2 AND person_id=$3 AND revoked_at IS NULL",
      [context.organizationId, command.deviceId, context.principalId]
    );
    if (device.rowCount !== 1) throw authorizationError("DEVICE_NOT_REGISTERED", "The Device is not registered.", correlationId);
    const session = await client.query<{ status: string; active_release_id: string }>(
      `SELECT session.status,activation.release_id AS active_release_id
         FROM runtime.sessions session
         JOIN LATERAL (SELECT release_id FROM runtime.release_activations
           WHERE organization_id=session.organization_id AND session_id=session.id
           ORDER BY activation_sequence DESC LIMIT 1) activation ON true
        WHERE session.organization_id=$1 AND session.id=$2 FOR UPDATE OF session`,
      [context.organizationId, context.sessionId]
    );
    const row = session.rows[0];
    if (row === undefined) throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", correlationId);
    const decision = command.governingReleaseId !== row.active_release_id
      ? { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "The governing Release changed." } as const
      : await input.lockSessionAndExecute({ client, context, command, activeReleaseId: row.active_release_id, sessionStatus: row.status });
    return recordOutcome(client, input, digest, decision, row.active_release_id);
  });
}

export async function processSessionCommand(input: ProcessCommandInput): Promise<CommandReceiptV1> {
  const { pool, context, command, correlationId, deploymentId } = input;
  validateCommandEnvelope(command, correlationId);
  if (context.deviceId === undefined || command.deviceId !== context.deviceId) {
    throw authorizationError("DEVICE_NOT_REGISTERED", "The Device is not registered.", correlationId);
  }
  const digest = commandDigest(command);

  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const authorityRow = await lockAuthority(client, context.organizationId, context.sessionId, command.commandId);
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
      authorityRow.deploymentId !== deploymentId ||
      authorityRow.authorityEpoch !== context.authorityEpoch || authorityRow.status !== "active"
    ) throw authorizationError("AUTHORITY_UNAVAILABLE", "This Deployment is not the Session Authority.", correlationId);

    const access = await client.query<{
      participant_exists: boolean; active_role: boolean; device_registered: boolean;
      active_release_id: string; status: string;
    }>(
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
       EXISTS(
         SELECT 1 FROM sync.devices device
          WHERE device.organization_id=$1 AND device.id=$6 AND device.person_id=$5
            AND device.revoked_at IS NULL
       ) AS device_registered,
       (SELECT release_id FROM runtime.release_activations
         WHERE organization_id=$1 AND session_id=$2 ORDER BY activation_sequence DESC LIMIT 1) AS active_release_id,
       (SELECT status FROM runtime.sessions WHERE organization_id=$1 AND id=$2) AS status`,
      [context.organizationId, context.sessionId, context.participantId, context.activeSessionRoleId,
        context.principalId, command.deviceId]
    );
    const accessRow = access.rows[0];
    if (accessRow === undefined || !accessRow.participant_exists || accessRow.status === null) {
      throw authorizationError("NOT_A_PARTICIPANT", "The Principal is not a Participant.", correlationId);
    }
    if (!accessRow.device_registered) throw authorizationError("DEVICE_NOT_REGISTERED", "The Device is not registered.", correlationId);

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
