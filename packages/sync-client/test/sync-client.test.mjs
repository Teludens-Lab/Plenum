import assert from "node:assert/strict";
import test from "node:test";

import {
  beginRuntimeReconnect,
  createRuntimeSyncState,
  fallBackToRuntimePolling,
  persistRuntimeDeltas,
  persistRuntimeSnapshot,
  reduceRuntimeDeltas
} from "../dist/index.js";

const cursor = "10000000-0000-4000-8000-000000000001";
const aggregateId = "20000000-0000-4000-8000-000000000001";
const older = {
  deltaId: "30000000-0000-4000-8000-000000000001",
  cursor: "40000000-0000-4000-8000-000000000001",
  eventType: "seat_assignment.changed",
  aggregateId,
  aggregateVersion: 1,
  occurredAt: "2026-10-18T00:00:00.000Z",
  payload: { activeSessionRoleId: "role-a" }
};
const newer = {
  ...older,
  deltaId: "30000000-0000-4000-8000-000000000002",
  cursor: "40000000-0000-4000-8000-000000000002",
  aggregateVersion: 2,
  payload: { activeSessionRoleId: "role-b" }
};

test("SYNC-11 duplicate and reordered Runtime deltas converge", () => {
  const response = (deltas) => ({
    projectionVersion: "runtime-projection-v1",
    policyVersion: "policy-decision-v1",
    deltas,
    nextCursor: cursor
  });
  const left = reduceRuntimeDeltas(createRuntimeSyncState(), response([newer, older, newer]));
  const right = reduceRuntimeDeltas(createRuntimeSyncState(), response([older, newer]));
  assert.deepEqual(left.projection, right.projection);
  assert.deepEqual(left.aggregateVersions, { [aggregateId]: 2 });
  assert.equal(left.projection[aggregateId].activeSessionRoleId, "role-b");
});

test("SYNC-08 persists projection data before its cursor and falls back to polling", async () => {
  const writes = [];
  const storage = {
    async saveProjection() { writes.push("projection"); },
    async saveCursor(value) { writes.push(`cursor:${value}`); }
  };
  const response = {
    projectionVersion: "runtime-projection-v1",
    policyVersion: "policy-decision-v1",
    deltas: [newer],
    nextCursor: cursor
  };
  const connected = await persistRuntimeDeltas(storage, createRuntimeSyncState(), response);
  assert.deepEqual(writes, ["projection", `cursor:${cursor}`]);
  assert.deepEqual([connected.connectivity, connected.cursor], ["live", cursor]);
  assert.deepEqual(fallBackToRuntimePolling(beginRuntimeReconnect(connected)), {
    ...connected,
    connectivity: "catching_up",
    transport: "polling"
  });

  let cursorStored = false;
  await assert.rejects(persistRuntimeDeltas({
    async saveProjection() { throw new Error("disk full"); },
    async saveCursor() { cursorStored = true; }
  }, createRuntimeSyncState(), response), /disk full/);
  assert.equal(cursorStored, false);

  const snapshotCursor = "10000000-0000-4000-8000-000000000002";
  writes.length = 0;
  const snapshotState = await persistRuntimeSnapshot(storage, connected, {
    projectionVersion: "runtime-projection-v1",
    policyVersion: "policy-decision-v1",
    cursor: snapshotCursor,
    state: { sessionStatus: "active" },
    aggregateVersions: {}
  });
  assert.deepEqual(writes, ["projection", `cursor:${snapshotCursor}`]);
  assert.deepEqual([snapshotState.connectivity, snapshotState.cursor], ["live", snapshotCursor]);

  const incompatible = reduceRuntimeDeltas(snapshotState, {
    ...response,
    projectionVersion: "runtime-projection-v2"
  });
  assert.equal(incompatible.connectivity, "snapshot_required");
});
