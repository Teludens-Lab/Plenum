import assert from "node:assert/strict";
import test from "node:test";

import {
  beginRuntimeReconnect,
  createRuntimeSyncState,
  fallBackToRuntimePolling,
  persistRuntimeDeltas,
  persistRuntimeSnapshot,
  reduceRuntimeDeltas,
  decodeRuntimeSse,
  subscribeRuntime
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

test("BA-06 bounded subscription stores refreshed views before advancing, deduplicates and aborts late responses", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const snapshot = { projectionVersion: "runtime-projection-v1", policyVersion: "policy-decision-v1", cursor, state: {}, aggregateVersions: {} };
  const calls = [], states = [];
  let pending, signal, reads = 0;
  const stop = subscribeRuntime({
    snapshot: async () => snapshot,
    deltas: async (resume, transport, requestSignal) => {
      calls.push([resume, transport]); signal = requestSignal;
      if (++reads === 3) return new Promise(resolve => { pending = resolve; });
      return { ...snapshot, deltas: [newer, older, newer], nextCursor: newer.cursor };
    },
    refresh: async deltas => { calls.push(deltas === null ? "snapshot stored" : "projection stored"); },
    error: () => "retry", connectivity: value => states.push(value)
  });
  await flush();
  for (let i = 0; i < 3; i++) { t.mock.timers.tick(1_000); await flush(); }
  assert.equal(calls.filter(item => item === "projection stored").length, 1);
  assert.deepEqual(calls.slice(0, 4), ["snapshot stored", [cursor, "sse"], "projection stored", [newer.cursor, "sse"]]);
  const before = calls.length;
  stop(); assert.equal(signal.aborted, true);
  pending({ ...snapshot, deltas: [{ ...newer, deltaId: "late" }], nextCursor: "late" });
  await flush(); t.mock.timers.tick(60_000); await flush();
  assert.equal(calls.length, before);
  assert.equal(states.at(-1), "live");
});

test("BA-06 expired cursors reset, failed SSE falls back with bounded retry, revocation stops", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const states = [], transports = [];
  let snapshots = 0, reads = 0;
  const stop = subscribeRuntime({
    snapshot: async () => { snapshots++; return { projectionVersion: "v1", policyVersion: "v1", cursor, state: {}, aggregateVersions: {} }; },
    deltas: async (_cursor, transport) => { transports.push(transport); throw ++reads === 1 ? "expired" : reads === 2 ? "network" : "revoked"; },
    refresh: async () => {}, error: error => error === "expired" ? "snapshot" : error === "revoked" ? "stop" : "retry",
    connectivity: value => states.push(value)
  });
  await flush();
  for (let i = 0; i < 5; i++) { t.mock.timers.tick(1_000); await flush(); }
  assert.equal(snapshots, 2);
  assert.deepEqual(transports, ["sse", "sse", "polling"]);
  t.mock.timers.tick(60_000); await flush();
  assert.equal(reads, 3); assert.ok(states.includes("connecting")); stop();
});

test("BA-06 SSE keeps opaque cursor semantics and rejects incomplete batches", () => {
  const frame = `id: ${newer.cursor}\nevent: delta\ndata: ${JSON.stringify(newer)}\n\nid: ${cursor}\nevent: cursor\ndata: {"projectionVersion":"v1","policyVersion":"p1"}\n`;
  assert.deepEqual(decodeRuntimeSse(frame), { projectionVersion: "v1", policyVersion: "p1", nextCursor: cursor, deltas: [newer] });
  assert.throws(() => decodeRuntimeSse(frame.split("\n\n")[0]), /final cursor/);
  assert.throws(() => decodeRuntimeSse("event: delta\ndata: {}"), /Incomplete/);
  assert.throws(() => decodeRuntimeSse(`${frame}\n${frame}`), /final frame/);
});

test("BA-06 retries cap at 30 seconds and each request aborts after 10 seconds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  let attempts = 0, aborted = 0;
  const stop = subscribeRuntime({
    snapshot: signal => {
      attempts++;
      return new Promise((_, reject) => signal.addEventListener("abort", () => { aborted++; reject(new Error("timeout")); }, { once: true }));
    },
    deltas: async () => { throw new Error("unexpected delta request"); },
    refresh: async () => {}, error: () => "retry", connectivity: () => {}
  });
  for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
    t.mock.timers.tick(9_999); await flush();
    assert.equal(aborted, attempts - 1);
    t.mock.timers.tick(1); await flush();
    assert.equal(aborted, attempts);
    const before = attempts;
    t.mock.timers.tick(delay - 1); await flush(); assert.equal(attempts, before);
    t.mock.timers.tick(1); await flush(); assert.equal(attempts, before + 1);
  }
  stop(); await flush();
  const before = attempts; t.mock.timers.tick(60_000); await flush(); assert.equal(attempts, before);
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
