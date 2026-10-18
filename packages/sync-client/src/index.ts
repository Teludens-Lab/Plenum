import type {
  JsonObject,
  RuntimeDeltaV1,
  SyncDeltasV1,
  SyncSnapshotV1
} from "@plenum/event-contracts";

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
  const seenDeltaIds = [...state.seenDeltaIds, delta.deltaId].sort().slice(-MAX_SEEN_DELTA_IDS);
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
