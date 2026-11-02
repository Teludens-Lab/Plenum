import { randomUUID } from "node:crypto";
import type { CommandEnvelopeV1, CommandReceiptV1, JsonObject } from "@plenum/event-contracts";
import type { Pool, PoolClient } from "pg";

import { authorizationError } from "../errors.js";
import { executeStageCommand } from "./artifact-workflow.js";
import { processPrincipalSessionCommand, type CommandDecision, type PrincipalSessionCommandContext } from "./commands/processor.js";
import { executeInformationCommand } from "./information-flow.js";

const sessionTransitions: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "session.start": { open: "active" },
  "session.pause": { active: "paused" },
  "session.resume": { paused: "active" },
  "session.complete": { active: "completed", paused: "completed" },
  "session.lock": { completed: "locked" }
};

function boundedReason(payload: JsonObject): string | undefined {
  const value = payload.reason;
  return typeof value === "string" && value.trim().length >= 3 && value.length <= 500 ? value.trim() : undefined;
}

async function requireSessionOperator(
  client: PoolClient,
  context: PrincipalSessionCommandContext
): Promise<CommandDecision | null> {
  if (!context.organizationRoles.includes("operator")) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "An Operator Organization Role is required." };
  }
  const assignment = await client.query(
    `SELECT 1 FROM runtime.session_operators
      WHERE organization_id=$1 AND session_id=$2 AND person_id=$3 AND revoked_at IS NULL`,
    [context.organizationId, context.sessionId, context.principalId]
  );
  return assignment.rowCount === 1 ? null : {
    status: "rejected", errorCode: "PERMISSION_DENIED", message: "An active Session Operator assignment is required."
  };
}

async function recordIntervention(
  client: PoolClient,
  context: PrincipalSessionCommandContext,
  releaseId: string,
  category: string,
  reason: string,
  before: JsonObject,
  after: JsonObject
): Promise<void> {
  const clock = await client.query<{ now: Date }>("SELECT transaction_timestamp() AS now");
  const occurredAt = clock.rows[0]?.now.toISOString() ?? new Date(0).toISOString();
  await client.query(
    `INSERT INTO runtime.control_interventions
       (id,organization_id,session_id,governing_release_id,category,reason,before_state,after_state,actor_person_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
    [randomUUID(), context.organizationId, context.sessionId, releaseId, category, reason,
      JSON.stringify({ ...before, serverTime: occurredAt }), JSON.stringify({ ...after, serverTime: occurredAt }), context.principalId]
  );
}

export function nextOperatorSessionStatus(operation: string, currentStatus: string): string | undefined {
  return sessionTransitions[operation]?.[currentStatus];
}

export async function executeOperatorSessionCommand(
  pool: Pool,
  context: PrincipalSessionCommandContext,
  command: CommandEnvelopeV1,
  correlationId: string,
  deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({
    pool, context, command, correlationId, deploymentId,
    lockSessionAndExecute: async ({ client, activeReleaseId, sessionStatus }) => {
      const denied = await requireSessionOperator(client, context);
      if (denied !== null) return denied;
      const reason = boundedReason(command.payload);
      if (reason === undefined || command.payload.confirmed !== true) {
        return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A bounded reason and explicit confirmation are required." };
      }
      const session = await client.query<{ version: string }>(
        "SELECT version FROM runtime.sessions WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [context.organizationId, context.sessionId]
      );
      const version = Number(session.rows[0]?.version);
      if (!Number.isSafeInteger(version)) throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", correlationId);
      if (command.expectedAggregateVersion !== version) {
        return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The Session is at version ${version}.` };
      }
      let next = nextOperatorSessionStatus(command.operationType, sessionStatus);
      if (command.operationType === "session.recover") {
        const target = command.payload.targetStatus;
        next = typeof target === "string" && ((sessionStatus === "active" && target === "paused") ||
          (sessionStatus === "paused" && target === "active")) ? target : undefined;
      }
      if (next === undefined) {
        return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "That Session control is not valid in the current state." };
      }
      const nextVersion = version + 1;
      await client.query(
        "UPDATE runtime.sessions SET status=$1,version=$2 WHERE organization_id=$3 AND id=$4",
        [next, nextVersion, context.organizationId, context.sessionId]
      );
      await recordIntervention(client, context, activeReleaseId, command.operationType, reason,
        { status: sessionStatus, version }, { status: next, version: nextVersion });
      const past = command.operationType === "session.start" ? "started" : command.operationType === "session.pause" ? "paused" :
        command.operationType === "session.resume" ? "resumed" : command.operationType === "session.complete" ? "completed" :
          command.operationType === "session.lock" ? "locked" : "recovered";
      return { status: "accepted", aggregateVersion: nextVersion, eventType: `session.${past}`,
        eventPayload: { sessionId: context.sessionId, fromStatus: sessionStatus, toStatus: next, reason } };
    }
  });
}

export async function executeOperatorStageControl(
  pool: Pool,
  context: PrincipalSessionCommandContext,
  command: CommandEnvelopeV1,
  correlationId: string,
  deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId,
    lockSessionAndExecute: async (input) => {
      const denied = await requireSessionOperator(input.client, context);
      if (denied !== null) return denied;
      if (!['active','paused'].includes(input.sessionStatus)) {
        return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "Stage controls require an active or paused Session." };
      }
      if (boundedReason(command.payload) === undefined || command.payload.confirmed !== true) {
        return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A bounded reason and explicit confirmation are required." };
      }
      const normalized = command.operationType === "stage.skip" ? { ...command, operationType: "stage.advance" } : command;
      return executeStageCommand({ ...input, command: normalized }, true);
    }
  });
}

export async function executeOperatorInjectControl(
  pool: Pool,
  context: PrincipalSessionCommandContext,
  command: CommandEnvelopeV1,
  correlationId: string,
  deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId,
    lockSessionAndExecute: async (input) => {
      const denied = await requireSessionOperator(input.client, context);
      if (denied !== null) return denied;
      if (!['open','active','paused'].includes(input.sessionStatus)) {
        return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "Inject controls are unavailable in this Session state." };
      }
      if (boundedReason(command.payload) === undefined || command.payload.confirmed !== true) {
        return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A bounded reason and explicit confirmation are required." };
      }
      return executeInformationCommand(input, true);
    }
  });
}

export async function retryOperatorDelivery(
  pool: Pool,
  context: PrincipalSessionCommandContext,
  command: CommandEnvelopeV1,
  correlationId: string,
  deploymentId: string
): Promise<CommandReceiptV1> {
  return processPrincipalSessionCommand({ pool, context, command, correlationId, deploymentId,
    lockSessionAndExecute: async ({ client, sessionStatus }) => {
      const denied = await requireSessionOperator(client, context);
      if (denied !== null) return denied;
      if (!["open", "active", "paused"].includes(sessionStatus)) {
        return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "Delivery recovery is unavailable in this Session state." };
      }
      const reason = boundedReason(command.payload);
      if (reason === undefined || command.payload.confirmed !== true) {
        return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A bounded reason and explicit confirmation are required." };
      }
      const retried = await client.query<{ event_id: string; attempts: number }>(
        `UPDATE sync.session_delta_outbox SET publication_status='pending',published_at=NULL
          WHERE organization_id=$1 AND session_id=$2 AND id=$3 AND publication_status='dead_lettered' AND attempts=$4
          RETURNING event_id,attempts`,
        [context.organizationId, context.sessionId, command.aggregateId, command.expectedAggregateVersion]
      );
      const row = retried.rows[0];
      if (row === undefined) {
        const current = await client.query<{ attempts: number }>(
          `SELECT attempts FROM sync.session_delta_outbox
            WHERE organization_id=$1 AND session_id=$2 AND id=$3 AND publication_status='dead_lettered'`,
          [context.organizationId, context.sessionId, command.aggregateId]
        );
        const attempts = current.rows[0]?.attempts;
        return attempts === undefined
          ? { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The dead-lettered delivery was not found." }
          : { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The delivery is at version ${attempts}.` };
      }
      return { status: "accepted", aggregateVersion: row.attempts + 1, eventType: "delivery.retried",
        eventPayload: { outboxId: command.aggregateId, eventId: row.event_id, reason } };
    }
  });
}
