import { randomUUID } from "node:crypto";
import {
  OFFLINE_OUTBOX_CONTRACT_ID,
  OFFLINE_QUEUEABLE_COMMAND_TYPES_V1,
  SYNC_BOOTSTRAP_CONTRACT_ID,
  type JsonObject,
  type JsonValue,
  type RuntimeDeltaV1,
  type RuntimeSseV1,
  type SyncBootstrapV1,
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
import { assertOrganizationJobAuthority, type OrganizationJobAuthority } from "../operations/job-authority.js";
import { readRuntimeProjection } from "../runtime/artifact-workflow.js";
import { readEffectProposals } from "../extensions/runtime.js";
import { readAdjudications } from "../adjudication/service.js";
import { visibleClosedVoiceChannelIds } from "../comms/voice.js";

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

export async function getRuntimeBootstrap(input: RuntimeSyncInput): Promise<SyncBootstrapV1> {
  return withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await currentContext(client, input);
    const result = await client.query<{
      deployment_id: string;
      snapshot: unknown;
      server_time: Date;
    }>(
      `SELECT authority.deployment_id,revision.snapshot,transaction_timestamp() AS server_time
         FROM runtime.session_authorities authority
         JOIN registry.releases release
           ON release.organization_id=authority.organization_id AND release.id=$3
         JOIN studio.definition_revisions revision
           ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
        WHERE authority.organization_id=$1 AND authority.session_id=$2 AND authority.status='active'`,
      [context.organizationId, context.sessionId, context.activeReleaseId]
    );
    const row = result.rows[0];
    if (row === undefined || !isRecord(row.snapshot)) {
      throw authorizationError("INCOMPATIBLE_RELEASE", "The active Release cannot initialize offline participation.", input.correlationId);
    }
    const design = isRecord(row.snapshot.coreDesign) ? row.snapshot.coreDesign : row.snapshot;
    const role = Array.isArray(design.sessionRoles)
      ? design.sessionRoles.find((candidate) => isRecord(candidate) && candidate.id === context.activeSessionRoleId)
      : undefined;
    if (!isRecord(role)) {
      throw authorizationError("INCOMPATIBLE_RELEASE", "The active Release lacks the Active Role Context.", input.correlationId);
    }
    const isControlRole = role.isControlRole === true;
    await client.query(
      `UPDATE sync.devices
          SET offline_policy_version=$1,offline_enabled_at=COALESCE(offline_enabled_at,transaction_timestamp()),
              last_offline_bootstrap_at=transaction_timestamp()
        WHERE organization_id=$2 AND id=$3 AND person_id=$4 AND revoked_at IS NULL`,
      [OFFLINE_OUTBOX_CONTRACT_ID, context.organizationId, input.deviceId, context.principalId]
    );
    return {
      contractId: SYNC_BOOTSTRAP_CONTRACT_ID,
      sessionId: context.sessionId,
      deviceId: input.deviceId,
      participantId: context.participantId,
      seatAssignmentIds: context.seatAssignmentIds,
      activeSessionRoleId: context.activeSessionRoleId,
      isControlRole,
      authorityDeploymentId: row.deployment_id,
      authorityEpoch: context.authorityEpoch,
      accessRevision: context.accessRevision,
      governingReleaseId: context.activeReleaseId,
      credentialExpiresAt: input.principal.expiresAt.toISOString(),
      serverTime: row.server_time.toISOString(),
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      policyVersion: POLICY_DECISION_VERSION,
      offlineCommandTypes: isControlRole ? [] : [...OFFLINE_QUEUEABLE_COMMAND_TYPES_V1]
    };
  });
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

/** Notification metadata is selected from the same authorized views as HTTP; raw event bodies never leave here. */
async function projectionChanges(client: PoolClient, context: SessionAccessContextV1, events: EventRow[], input: RuntimeSyncInput) {
  const changes = new Map<string, Omit<RuntimeDeltaV1, "cursor">>();
  const runtimeEvents = events.filter((event) => /^(stage|session|release|artifact|message|inject|poll|ballot|voice_channel|voice_consent|voice_recording|voice_transcription|floor_lease)\./u.test(event.event_type));
  if (runtimeEvents.length) {
    const view = await readRuntimeProjection(client, context, input);
    const ids = (items: Array<{ id: string }>) => new Set(items.map(({ id }) => id));
    const visible = { artifact: ids(view.artifacts), message: ids(view.messages), inject: ids(view.injects), poll: ids(view.polls),
      ballot: ids(view.polls), voice_channel: ids(view.voiceChannels) };
    for (const id of await visibleClosedVoiceChannelIds(client, context, runtimeEvents
      .filter(event => event.event_type === "voice_channel.closed" && event.aggregate_id !== null).map(event => event.aggregate_id!))) visible.voice_channel.add(id);
    for (const event of runtimeEvents) {
      const eventKind = event.event_type.split(".")[0]!;
      const kind = /^(voice_|floor_lease)/u.test(eventKind) ? "voice_channel" : eventKind;
      const body = isRecord(event.body) ? event.body : {};
      const target = kind === "message" ? body.messageId : kind === "ballot" ? body.pollId
        : kind === "voice_channel" ? body.channelId ?? event.aggregate_id : event.aggregate_id;
      const publicSessionChange = target === context.sessionId && /^(stage\.(started|paused|resumed|extended|ended|reopened|advanced|returned)|session\.(opened|started|paused|resumed|completed|locked|archived|recovered)|release\.activated)$/u.test(event.event_type);
      if (!publicSessionChange && !(kind in visible && typeof target === "string" && visible[kind as keyof typeof visible].has(target))) continue;
      if ((kind === "ballot" || /^inject\.(acknowledged|responded)$/u.test(event.event_type)) && event.actor_participant_id !== context.participantId) continue;
      if (["voice_consent", "floor_lease"].includes(eventKind) && event.actor_participant_id !== context.participantId) continue;
      changes.set(event.event_id, { deltaId: event.event_id, eventType: event.event_type, aggregateId: target as string,
        aggregateVersion: null, occurredAt: event.occurred_at.toISOString(), payload: {} });
    }
  }
  if (events.some((event) => event.event_type.startsWith("effect_proposal."))) {
    const visible = new Set((await readEffectProposals(client, context)).map(({ id }) => id));
    for (const event of events.filter((item) => item.event_type.startsWith("effect_proposal."))) {
      if (event.aggregate_id && visible.has(event.aggregate_id)) changes.set(event.event_id, {
        deltaId: event.event_id, eventType: event.event_type, aggregateId: event.aggregate_id,
        aggregateVersion: null, occurredAt: event.occurred_at.toISOString(), payload: {} });
    }
  }
  if (events.some((event) => event.event_type.startsWith("adjudication."))) {
    const visible = await readAdjudications(client, context);
    for (const event of events.filter((item) => item.event_type.startsWith("adjudication."))) {
      if (visible.some((item) => item.id === event.aggregate_id && (item.canReview || event.event_type === "adjudication.published"))) changes.set(event.event_id, {
        deltaId: event.event_id, eventType: event.event_type, aggregateId: event.aggregate_id!,
        aggregateVersion: null, occurredAt: event.occurred_at.toISOString(), payload: {} });
    }
  }
  return changes;
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
  limit = RUNTIME_REPLAY_BATCH_LIMIT,
  authority?: OrganizationJobAuthority
): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > RUNTIME_REPLAY_BATCH_LIMIT) {
    throw new Error(`Runtime delta publish limit must be between 1 and ${RUNTIME_REPLAY_BATCH_LIMIT}`);
  }
  return withOrganizationTransaction(pool, organizationId, async (client) => {
    if (authority) {
      if (authority.organizationId !== organizationId) throw new Error("Runtime publication authority mismatch");
      await assertOrganizationJobAuthority(client, authority);
    }
    // Publishing a later batch first would let a reconnect cursor skip earlier rows.
    const claim = await client.query<{ claimed: boolean }>(
      "SELECT pg_try_advisory_xact_lock(hashtext($1),hashtext('runtime_delta_publication')) AS claimed", [organizationId]);
    if (!claim.rows[0]?.claimed) return 0;
    const result = await client.query(
      `WITH pending AS (
         SELECT item.id FROM sync.session_delta_outbox item
          JOIN evidence.events event ON event.organization_id=item.organization_id AND event.id=item.event_id
          JOIN runtime.session_authorities authority ON authority.organization_id=item.organization_id AND authority.session_id=item.session_id
          WHERE item.organization_id=$1 AND item.publication_status='pending'
            AND ($3::uuid IS NULL OR (authority.deployment_id=$3 AND authority.status='active'))
          ORDER BY event.sequence,item.id LIMIT $2 FOR UPDATE OF item FOR SHARE OF authority
       )
       UPDATE sync.session_delta_outbox item
          SET publication_status='published',attempts=attempts+1,published_at=transaction_timestamp()
         FROM pending WHERE item.id=pending.id
       RETURNING item.id`,
      [organizationId, limit, authority?.deploymentId ?? null]
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
    const changes = await projectionChanges(client, context, result.rows, input);
    for (const event of result.rows) {
      const projected = projectEvent(context, event) ?? changes.get(event.event_id);
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
