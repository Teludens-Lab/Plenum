import type {
  CommandEnvelopeV1,
  CommandReceiptV1,
  JsonObject,
  OfflineCommandV1,
  OfflineOutboxV1,
  RuntimeProjectionV1,
  RuntimeDeltaV1,
  SyncBootstrapV1,
  SyncDeltasV1,
  SyncSnapshotV1
} from "@plenum/event-contracts";
import { OFFLINE_OUTBOX_CONTRACT_ID, OFFLINE_QUEUEABLE_COMMAND_TYPES_V1 } from "@plenum/event-contracts";

export type RuntimeConnectivity = "disconnected" | "connecting" | "catching_up" | "live" | "snapshot_required";
export type RuntimeSyncTransport = "sse" | "polling";

export interface RuntimeSyncState {
  connectivity: RuntimeConnectivity;
  transport: RuntimeSyncTransport;
  cursor: string | null;
  projectionVersion: string | null;
  policyVersion: string | null;
  projection: JsonObject;
  aggregateVersions: Record<string, number>;
  seenDeltaIds: string[];
}

export interface RuntimeSyncStorage {
  saveProjection(state: RuntimeSyncState): Promise<void>;
  saveCursor(cursor: string): Promise<void>;
}

const MAX_SEEN_DELTA_IDS = 512;

export const OFFLINE_QUEUEABLE_OPERATION_TYPES = OFFLINE_QUEUEABLE_COMMAND_TYPES_V1;

export const OFFLINE_OUTBOX_SCHEMA_VERSION = 1;

export interface SealedOfflineOutboxV1 {
  schemaVersion: typeof OFFLINE_OUTBOX_SCHEMA_VERSION;
  iv: string;
  ciphertext: string;
}

export function canQueueOffline(command: CommandEnvelopeV1, bootstrap: SyncBootstrapV1, now = Date.now()): boolean {
  return !bootstrap.isControlRole &&
    Date.parse(bootstrap.credentialExpiresAt) > now &&
    command.deviceId === bootstrap.deviceId &&
    command.activeSessionRoleId === bootstrap.activeSessionRoleId &&
    bootstrap.offlineCommandTypes.includes(command.operationType);
}

export function createOfflineOutbox(bootstrap: SyncBootstrapV1): OfflineOutboxV1 {
  return {
    contractId: OFFLINE_OUTBOX_CONTRACT_ID,
    sessionId: bootstrap.sessionId,
    deviceId: bootstrap.deviceId,
    participantId: bootstrap.participantId,
    activeSessionRoleId: bootstrap.activeSessionRoleId,
    authorityEpoch: bootstrap.authorityEpoch,
    accessRevision: bootstrap.accessRevision,
    credentialExpiresAt: bootstrap.credentialExpiresAt,
    entries: []
  };
}

export function enqueueOfflineCommand(
  outbox: OfflineOutboxV1,
  command: CommandEnvelopeV1,
  queuedAt: string
): OfflineOutboxV1 {
  if (outbox.entries.some((entry) => entry.command.commandId === command.commandId)) return outbox;
  const queueSequence = outbox.entries.reduce((maximum, entry) => Math.max(maximum, entry.queueSequence), -1) + 1;
  return {
    ...outbox,
    entries: [...outbox.entries, {
      command,
      draftPayload: command.payload,
      queuedAt,
      queueSequence,
      status: "local_pending",
      receipt: null
    }]
  };
}

const dependencyRank: Readonly<Record<string, number>> = {
  "artifact.create": 0,
  "artifact.edit": 1,
  "artifact.submit": 2
};

export function orderedOfflineCommands(entries: readonly OfflineCommandV1[]): OfflineCommandV1[] {
  return [...entries].sort((left, right) => {
    if (left.command.aggregateId === right.command.aggregateId) {
      const rank = (dependencyRank[left.command.operationType] ?? 0) - (dependencyRank[right.command.operationType] ?? 0);
      if (rank !== 0) return rank;
    }
    return left.queueSequence - right.queueSequence;
  });
}

export function recordOfflineReceipt(
  outbox: OfflineOutboxV1,
  receipt: CommandReceiptV1
): OfflineOutboxV1 {
  return {
    ...outbox,
    entries: outbox.entries.map((entry) => entry.command.commandId === receipt.commandId
      ? { ...entry, status: receipt.status, receipt }
      : entry)
  };
}

export function updateOfflineDraft(
  outbox: OfflineOutboxV1,
  commandId: string,
  draftPayload: JsonObject
): OfflineOutboxV1 {
  return {
    ...outbox,
    entries: outbox.entries.map((entry) => entry.command.commandId === commandId
      ? { ...entry, draftPayload }
      : entry)
  };
}

export function minimizeOfflineProjection(projection: RuntimeProjectionV1): RuntimeProjectionV1 {
  const { timeline: _timeline, ...offlineProjection } = projection;
  return {
    ...offlineProjection,
    modules: projection.modules.filter(({ type }) => ["session_status", "artifact_form", "task_list"].includes(type)),
    createTasks: projection.createTasks.filter((task) =>
      OFFLINE_QUEUEABLE_OPERATION_TYPES.includes(
        task.action.operationType as typeof OFFLINE_QUEUEABLE_OPERATION_TYPES[number]
      )),
    artifacts: projection.artifacts.map((artifact) => ({
      ...artifact,
      actions: artifact.actions.filter((action) =>
        OFFLINE_QUEUEABLE_OPERATION_TYPES.includes(action.operationType as typeof OFFLINE_QUEUEABLE_OPERATION_TYPES[number]))
    })),
    messages: [],
    injects: [],
    polls: projection.polls.filter((poll) => poll.status === "open" && poll.eligible && !poll.hasVoted).map((poll) => ({
      ...poll,
      canManage: false,
      canCertify: false,
      tally: null,
      certification: null
    })),
    voiceChannels: []
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function outboxScope(outbox: Pick<OfflineOutboxV1, "sessionId" | "deviceId" | "participantId" | "activeSessionRoleId">): string {
  return [outbox.sessionId, outbox.deviceId, outbox.participantId, outbox.activeSessionRoleId].join(":");
}

export async function generateOfflineOutboxKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function sealOfflineData(value: unknown, key: CryptoKey, scope: string): Promise<SealedOfflineOutboxV1> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(scope) },
    key,
    new TextEncoder().encode(JSON.stringify(value))
  );
  return {
    schemaVersion: OFFLINE_OUTBOX_SCHEMA_VERSION,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext))
  };
}

export async function openOfflineData(
  sealed: SealedOfflineOutboxV1,
  key: CryptoKey,
  scope: string
): Promise<unknown> {
  if (sealed.schemaVersion !== OFFLINE_OUTBOX_SCHEMA_VERSION) throw new Error("Unsupported offline storage schema");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(sealed.iv), additionalData: new TextEncoder().encode(scope) },
    key,
    base64ToBytes(sealed.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
}

export async function sealOfflineOutbox(outbox: OfflineOutboxV1, key: CryptoKey): Promise<SealedOfflineOutboxV1> {
  return sealOfflineData(outbox, key, outboxScope(outbox));
}

export async function openOfflineOutbox(
  sealed: SealedOfflineOutboxV1,
  key: CryptoKey,
  expected: Pick<OfflineOutboxV1, "sessionId" | "deviceId" | "participantId" | "activeSessionRoleId">
): Promise<OfflineOutboxV1> {
  if (sealed.schemaVersion !== OFFLINE_OUTBOX_SCHEMA_VERSION) throw new Error("Unsupported Offline Outbox schema");
  try {
    const value = await openOfflineData(sealed, key, outboxScope(expected));
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("object required");
    const outbox = value as Partial<OfflineOutboxV1>;
    if (outbox.contractId !== OFFLINE_OUTBOX_CONTRACT_ID || outboxScope(outbox as OfflineOutboxV1) !== outboxScope(expected) ||
        !Array.isArray(outbox.entries)) throw new Error("scope mismatch");
    return outbox as OfflineOutboxV1;
  } catch {
    throw new Error("Offline Outbox is corrupt or belongs to another scope");
  }
}

export function createRuntimeSyncState(): RuntimeSyncState {
  return {
    connectivity: "disconnected",
    transport: "sse",
    cursor: null,
    projectionVersion: null,
    policyVersion: null,
    projection: {},
    aggregateVersions: {},
    seenDeltaIds: []
  };
}

export function beginRuntimeReconnect(state: RuntimeSyncState): RuntimeSyncState {
  return { ...state, connectivity: state.cursor === null ? "snapshot_required" : "connecting", transport: "sse" };
}

export function fallBackToRuntimePolling(state: RuntimeSyncState): RuntimeSyncState {
  return { ...state, connectivity: "catching_up", transport: "polling" };
}

export function requireRuntimeSnapshot(state: RuntimeSyncState): RuntimeSyncState {
  return { ...state, connectivity: "snapshot_required" };
}

function applyDelta(state: RuntimeSyncState, delta: RuntimeDeltaV1): RuntimeSyncState {
  if (state.seenDeltaIds.includes(delta.deltaId)) return state;
  const seenDeltaIds = [...state.seenDeltaIds, delta.deltaId].slice(-MAX_SEEN_DELTA_IDS);
  if (delta.aggregateVersion === null) return { ...state, seenDeltaIds };
  const currentVersion = state.aggregateVersions[delta.aggregateId] ?? 0;
  if (delta.aggregateVersion <= currentVersion) return { ...state, seenDeltaIds };
  const current = state.projection[delta.aggregateId];
  const currentAggregate = typeof current === "object" && current !== null && !Array.isArray(current)
    ? current as JsonObject
    : {};
  return {
    ...state,
    projection: { ...state.projection, [delta.aggregateId]: { ...currentAggregate, ...delta.payload } },
    aggregateVersions: { ...state.aggregateVersions, [delta.aggregateId]: delta.aggregateVersion },
    seenDeltaIds
  };
}

export function reduceRuntimeDeltas(state: RuntimeSyncState, response: SyncDeltasV1): RuntimeSyncState {
  if (
    state.projectionVersion !== null &&
    (state.projectionVersion !== response.projectionVersion || state.policyVersion !== response.policyVersion)
  ) {
    return requireRuntimeSnapshot(state);
  }
  return response.deltas.reduce(applyDelta, {
    ...state,
    connectivity: "catching_up",
    projectionVersion: response.projectionVersion,
    policyVersion: response.policyVersion
  });
}

export async function persistRuntimeDeltas(
  storage: RuntimeSyncStorage,
  state: RuntimeSyncState,
  response: SyncDeltasV1
): Promise<RuntimeSyncState> {
  const reduced = reduceRuntimeDeltas(state, response);
  if (reduced.connectivity === "snapshot_required") return reduced;
  await storage.saveProjection(reduced);
  await storage.saveCursor(response.nextCursor);
  return { ...reduced, cursor: response.nextCursor, connectivity: "live" };
}

export async function persistRuntimeSnapshot(
  storage: RuntimeSyncStorage,
  state: RuntimeSyncState,
  snapshot: SyncSnapshotV1
): Promise<RuntimeSyncState> {
  const next = {
    ...state,
    connectivity: "catching_up" as const,
    cursor: state.cursor,
    projectionVersion: snapshot.projectionVersion,
    policyVersion: snapshot.policyVersion,
    projection: snapshot.state,
    aggregateVersions: snapshot.aggregateVersions,
    seenDeltaIds: []
  };
  await storage.saveProjection(next);
  await storage.saveCursor(snapshot.cursor);
  return { ...next, cursor: snapshot.cursor, connectivity: "live" };
}

/** The existing SSE endpoint returns a bounded batch and a final cursor frame. */
export function decodeRuntimeSse(body: string): SyncDeltasV1 {
  const deltas: RuntimeDeltaV1[] = [];
  let result: SyncDeltasV1 | undefined;
  for (const frame of body.trim().split(/\r?\n\r?\n/u)) {
    if (result) throw new Error("Runtime SSE cursor must be the final frame");
    const lines = frame.split(/\r?\n/u);
    const kind = lines.find((line) => line.startsWith("event: "))?.slice(7);
    const cursor = lines.find((line) => line.startsWith("id: "))?.slice(4);
    const data = lines.filter((line) => line.startsWith("data: ")).map((line) => line.slice(6)).join("\n");
    if (!cursor || !data) throw new Error("Incomplete Runtime SSE frame");
    const value = JSON.parse(data) as RuntimeDeltaV1 & { projectionVersion: string; policyVersion: string };
    if (kind === "delta" && value.cursor === cursor) deltas.push(value);
    else if (kind === "cursor" && typeof value.projectionVersion === "string" && typeof value.policyVersion === "string") {
      result = { projectionVersion: value.projectionVersion, policyVersion: value.policyVersion, nextCursor: cursor, deltas };
    } else throw new Error("Invalid Runtime SSE frame");
  }
  if (!result) throw new Error("Runtime SSE batch lacks its final cursor");
  return result;
}

export interface RuntimeSubscription {
  snapshot(signal: AbortSignal): Promise<SyncSnapshotV1>;
  deltas(cursor: string, transport: RuntimeSyncTransport, signal: AbortSignal): Promise<SyncDeltasV1>;
  refresh(deltas: readonly RuntimeDeltaV1[] | null, signal: AbortSignal): Promise<void>;
  error(error: unknown): "snapshot" | "retry" | "stop";
  connectivity(state: RuntimeConnectivity): void;
}

/** One bounded request at a time; memory cursors are discarded on scope change or page restart. */
export function subscribeRuntime(options: RuntimeSubscription): () => void {
  let state = createRuntimeSyncState(), stopped = false, retry = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const lifetime = new AbortController();
  const tick = async () => {
    const request = new AbortController();
    const abort = () => request.abort();
    lifetime.signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 10_000);
    let delay = 1_000;
    try {
      const storage: RuntimeSyncStorage = { saveProjection: async () => {}, saveCursor: async () => {} };
      if (state.cursor === null || state.connectivity === "snapshot_required") {
        options.connectivity("catching_up");
        const snapshot = await options.snapshot(request.signal);
        if (request.signal.aborted) return;
        await options.refresh(null, request.signal);
        if (request.signal.aborted) return;
        state = await persistRuntimeSnapshot(storage, state, snapshot);
      } else {
        const response = await options.deltas(state.cursor, state.transport, request.signal);
        if (request.signal.aborted) return;
        const fresh = response.deltas.filter((delta) => !state.seenDeltaIds.includes(delta.deltaId));
        if (fresh.length) await options.refresh(fresh, request.signal);
        if (request.signal.aborted) return;
        state = await persistRuntimeDeltas(storage, state, response);
      }
      retry = 0;
      options.connectivity(state.connectivity);
    } catch (error) {
      if (stopped) return;
      const action = options.error(error);
      if (action === "stop") { stopped = true; lifetime.abort(); return; }
      if (action === "snapshot") state = requireRuntimeSnapshot(state);
      else state = fallBackToRuntimePolling(state);
      options.connectivity("connecting");
      delay = Math.min(30_000, 1_000 * 2 ** Math.min(retry++, 5));
    } finally {
      clearTimeout(timeout);
      lifetime.signal.removeEventListener("abort", abort);
      if (!stopped) timer = setTimeout(() => { void tick(); }, delay);
    }
  };
  void tick();
  return () => { stopped = true; lifetime.abort(); clearTimeout(timer); };
}
