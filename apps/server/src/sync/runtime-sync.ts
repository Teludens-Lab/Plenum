import { randomUUID } from "node:crypto";
import {
  type JsonObject,
  type JsonValue,
  type RuntimeDeltaV1,
  type RuntimeSseV1,
  type SyncDeltasV1,
  type SyncSnapshotV1
} from "@plenum/event-contracts";
import {
  POLICY_DECISION_VERSION,
  projectResource,
  type FieldAudience,
  type ProtectedResource
} from "@plenum/policy-engine";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import {
  resolveSessionAccessContext,
  toPolicyContext,
  type SessionAccessContextV1
} from "../identity/context.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";

export const RUNTIME_PROJECTION_VERSION = "runtime-projection-v1";
export const RUNTIME_REPLAY_BATCH_LIMIT = 100;
// shortcut: retain the current replay batch until PS-530 sets deployment-profile cursor retention.
const CURSORS_PER_DEVICE = RUNTIME_REPLAY_BATCH_LIMIT + 1;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface RuntimeSyncInput {
  pool: Pool;
  principal: AuthenticatedPrincipal;
  sessionId: string;
  deviceId: string;
  activeSessionRoleId?: string;
  correlationId: string;
}

export interface RuntimeDeltaInput extends RuntimeSyncInput {
  cursor: string;
}

interface EventRow {
  event_id: string;
  sequence: string;
  event_type: string;
  actor_participant_id: string | null;
  aggregate_id: string | null;
  aggregate_version: string | null;
  body: unknown;
  occurred_at: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safePayload(body: unknown, names: readonly string[]): JsonObject {
  if (!isRecord(body)) return {};
  return Object.fromEntries(names.flatMap((name) => {
    const value = body[name];
    return value === null || ["boolean", "number", "string"].includes(typeof value)
      ? [[name, value as JsonValue]]
      : [];
  }));
}

function audienceFor(context: SessionAccessContextV1, event: EventRow): FieldAudience | undefined {
  if (!isRecord(event.body)) return undefined;
  if (event.event_type === "seat_assignment.changed" && typeof event.body.participantId === "string") {
    return { organizationRoles: ["operator"], participantIds: [event.body.participantId] };
  }
  if (
    (event.event_type === "command.rejected" || event.event_type === "command.reconciliation_required") &&
    event.actor_participant_id !== null
  ) {
    return { participantIds: [event.actor_participant_id] };
  }
  return undefined;
}

function projectEvent(context: SessionAccessContextV1, event: EventRow): Omit<RuntimeDeltaV1, "cursor"> | undefined {
  if (event.aggregate_id === null) return undefined;
  const audience = audienceFor(context, event);
  if (audience === undefined) return undefined;
  const payload = event.event_type === "seat_assignment.changed"
    ? safePayload(event.body, ["previousSeatAssignmentId", "seatAssignmentId", "participantId", "newSessionRoleId", "newSeatId", "accessRevision"])
    : safePayload(event.body, ["operationType", "aggregateId", "errorCode", "activeSessionRoleId"]);
  const delta = {
    deltaId: event.event_id,
    eventType: event.event_type,
    aggregateId: event.aggregate_id,
    aggregateVersion: event.aggregate_version === null ? null : Number(event.aggregate_version),
    occurredAt: event.occurred_at.toISOString(),
    payload
  } satisfies Omit<RuntimeDeltaV1, "cursor">;
  const resource: ProtectedResource = {
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    resourceType: "runtime_delta",
    fields: { delta: { classification: "confidential", audience, value: delta } }
  };
  return projectResource(toPolicyContext(context), resource).delta as Omit<RuntimeDeltaV1, "cursor"> | undefined;
}

async function currentContext(client: PoolClient, input: RuntimeSyncInput): Promise<SessionAccessContextV1> {
  if (!uuid.test(input.sessionId) || !uuid.test(input.deviceId)) {
    throw authorizationError("INVALID_ID", "The Session or Device identifier is invalid.", input.correlationId);
  }
  return resolveSessionAccessContext(client, input.principal, {
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    ...(input.activeSessionRoleId === undefined ? {} : { requestedActiveSessionRoleId: input.activeSessionRoleId }),
    correlationId: input.correlationId
  });
}

async function createCursor(
  client: PoolClient,
  context: SessionAccessContextV1,
  deviceId: string,
  lastEvidenceSequence: number
): Promise<string> {
  const cursor = randomUUID();
  await client.query(
    `INSERT INTO sync.projection_cursors
       (id,organization_id,session_id,participant_id,device_id,active_session_role_id,
        access_revision,policy_version,projection_version,last_evidence_sequence,expires_at)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,authentication.expires_at
       FROM identity.authentication_sessions authentication
      WHERE authentication.organization_id=$2 AND authentication.id=$11`,
    [cursor, context.organizationId, context.sessionId, context.participantId, deviceId,
      context.activeSessionRoleId, context.accessRevision, POLICY_DECISION_VERSION,
      RUNTIME_PROJECTION_VERSION, lastEvidenceSequence, context.authenticationSessionId]
  );
  return cursor;
}

async function trimCursors(
  client: PoolClient,
  context: SessionAccessContextV1,
  deviceId: string,
  protectedCursors: readonly string[]
): Promise<void> {
  const retainedOlderCursors = CURSORS_PER_DEVICE - protectedCursors.length;
  await client.query(
    `DELETE FROM sync.projection_cursors
      WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 AND device_id=$4
        AND (expires_at <= transaction_timestamp() OR id IN (
          SELECT id FROM sync.projection_cursors
           WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 AND device_id=$4
             AND NOT (id = ANY($5::uuid[]))
           ORDER BY created_at DESC, id DESC OFFSET $6
        ))`,
    [context.organizationId, context.sessionId, context.participantId, deviceId,
      protectedCursors, Math.max(0, retainedOlderCursors)]
  );
}

async function cursorPosition(
  client: PoolClient,
  context: SessionAccessContextV1,
  deviceId: string,
  cursor: string,
  correlationId: string
): Promise<number> {
  if (!uuid.test(cursor)) {
    throw authorizationError("SYNC_CURSOR_EXPIRED", "The Projection Cursor is expired or no longer authorized.", correlationId);
  }
  const result = await client.query<{ last_evidence_sequence: string }>(
    `SELECT last_evidence_sequence
       FROM sync.projection_cursors
      WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 AND device_id=$4
        AND id=$5 AND active_session_role_id=$6 AND access_revision=$7
        AND policy_version=$8 AND projection_version=$9
        AND expires_at > transaction_timestamp()`,
    [context.organizationId, context.sessionId, context.participantId, deviceId, cursor,
      context.activeSessionRoleId, context.accessRevision, POLICY_DECISION_VERSION, RUNTIME_PROJECTION_VERSION]
  );
  const position = Number(result.rows[0]?.last_evidence_sequence);
  if (!Number.isSafeInteger(position) || position < 0) {
    throw authorizationError("SYNC_CURSOR_EXPIRED", "The Projection Cursor is expired or no longer authorized.", correlationId);
  }
  return position;
}

async function publishedPosition(client: PoolClient, context: SessionAccessContextV1): Promise<number> {
  const result = await client.query<{ position: string }>(
    `SELECT COALESCE(max(event.sequence),0) AS position
       FROM sync.session_delta_outbox item
       JOIN evidence.events event
         ON event.organization_id=item.organization_id AND event.id=item.event_id
      WHERE item.organization_id=$1 AND item.session_id=$2 AND item.publication_status='published'`,
    [context.organizationId, context.sessionId]
  );
  return Number(result.rows[0]?.position ?? 0);
}

export async function publishPendingRuntimeDeltas(
  pool: Pool,
  organizationId: string,
  limit = RUNTIME_REPLAY_BATCH_LIMIT
): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > RUNTIME_REPLAY_BATCH_LIMIT) {
    throw new Error(`Runtime delta publish limit must be between 1 and ${RUNTIME_REPLAY_BATCH_LIMIT}`);
  }
  return withOrganizationTransaction(pool, organizationId, async (client) => {
    const result = await client.query(
      `WITH pending AS (
         SELECT id FROM sync.session_delta_outbox
          WHERE organization_id=$1 AND publication_status='pending'
          ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT $2
       )
       UPDATE sync.session_delta_outbox item
          SET publication_status='published',attempts=attempts+1,published_at=transaction_timestamp()
         FROM pending WHERE item.id=pending.id
       RETURNING item.id`,
      [organizationId, limit]
    );
    return result.rowCount ?? 0;
  });
}

export async function getRuntimeSnapshot(input: RuntimeSyncInput): Promise<SyncSnapshotV1> {
  return withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await currentContext(client, input);
    const position = await publishedPosition(client, context);
    const cursor = await createCursor(client, context, input.deviceId, position);
    await trimCursors(client, context, input.deviceId, [cursor]);
    return {
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      policyVersion: POLICY_DECISION_VERSION,
      cursor,
      state: {
        sessionId: context.sessionId,
        sessionStatus: context.sessionStatus,
        participantId: context.participantId,
        seatAssignmentIds: context.seatAssignmentIds,
        activeSessionRoleId: context.activeSessionRoleId,
        seatId: context.seatId ?? null,
        activeReleaseId: context.activeReleaseId,
        authorityEpoch: context.authorityEpoch,
        accessRevision: context.accessRevision
      },
      aggregateVersions: { [context.participantId]: context.accessRevision }
    };
  });
}

export async function getRuntimeDeltas(input: RuntimeDeltaInput): Promise<SyncDeltasV1> {
  return withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await currentContext(client, input);
    const position = await cursorPosition(client, context, input.deviceId, input.cursor, input.correlationId);
    const result = await client.query<EventRow>(
      `SELECT event.id AS event_id,event.sequence,event.event_type,event.actor_participant_id,
              event.aggregate_id,event.aggregate_version,event.body,event.occurred_at
         FROM sync.session_delta_outbox item
         JOIN evidence.events event
           ON event.organization_id=item.organization_id AND event.id=item.event_id
        WHERE item.organization_id=$1 AND item.session_id=$2
          AND item.publication_status='published' AND event.sequence>$3
        ORDER BY event.sequence LIMIT $4`,
      [context.organizationId, context.sessionId, position, RUNTIME_REPLAY_BATCH_LIMIT]
    );
    const deltas: RuntimeDeltaV1[] = [];
    for (const event of result.rows) {
      const projected = projectEvent(context, event);
      if (projected === undefined) continue;
      deltas.push({ ...projected, cursor: await createCursor(client, context, input.deviceId, Number(event.sequence)) });
    }
    const finalPosition = Number(result.rows.at(-1)?.sequence ?? position);
    const nextCursor = await createCursor(client, context, input.deviceId, finalPosition);
    await trimCursors(client, context, input.deviceId, [...deltas.map((delta) => delta.cursor), nextCursor]);
    return {
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      policyVersion: POLICY_DECISION_VERSION,
      deltas,
      nextCursor
    };
  });
}

export function runtimeSseContract(deltas: SyncDeltasV1): RuntimeSseV1 {
  return {
    projectionVersion: deltas.projectionVersion,
    policyVersion: deltas.policyVersion,
    events: [
      ...deltas.deltas.map((delta) => ({ kind: "delta" as const, cursor: delta.cursor, delta })),
      { kind: "cursor", cursor: deltas.nextCursor, delta: null }
    ]
  };
}

export function encodeRuntimeSse(contract: RuntimeSseV1): string {
  return contract.events.map((event) => [
    `id: ${event.cursor}`,
    `event: ${event.kind}`,
    `data: ${JSON.stringify(event.delta ?? {
      projectionVersion: contract.projectionVersion,
      policyVersion: contract.policyVersion
    })}`,
    ""
  ].join("\n")).join("\n");
}

export async function getRuntimeSse(input: RuntimeDeltaInput): Promise<{
  contentType: "text/event-stream";
  cacheControl: "no-store";
  body: string;
}> {
  const contract = runtimeSseContract(await getRuntimeDeltas(input));
  return {
    contentType: "text/event-stream",
    cacheControl: "no-store",
    body: encodeRuntimeSse(contract)
  };
}
