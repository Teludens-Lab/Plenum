import assert from "node:assert/strict";
import test from "node:test";

import {
  REPORT_DEFINITION_CONTRACT_ID,
  REPLAY_DIVERGENCE_CONTRACT_ID,
  RESEARCH_EXPORT_CONTRACT_ID,
  reportDefinitionV1Schema,
  replayDivergenceV1Schema,
  researchExportV1Schema
} from "@plenum/event-contracts";
import { compareReplay } from "@plenum/server";
import { createStoredZip, createTextPdf } from "../../apps/server/dist/reporting/formats.js";

const sessionId = "10000000-0000-4000-8000-000000000001";
const releaseId = "20000000-0000-4000-8000-000000000001";
const manifest = { sessionId, initialReleaseId: releaseId, randomSeed: 42 };
const event = { sequence: 1, eventType: "session.created", eventVersion: 1, governingReleaseId: releaseId,
  aggregateId: sessionId, aggregateVersion: 1, body: { status: "created" } };

test("PS-520-T01 report, research, and replay contracts are registered", () => {
  assert.equal(reportDefinitionV1Schema.$id, REPORT_DEFINITION_CONTRACT_ID);
  assert.equal(researchExportV1Schema.$id, RESEARCH_EXPORT_CONTRACT_ID);
  assert.equal(replayDivergenceV1Schema.$id, REPLAY_DIVERGENCE_CONTRACT_ID);
});

test("Replay comparator plumbing matches supplied records and reports divergence (not reconstruction proof)", () => {
  const matched = compareReplay(sessionId, { manifest, events: [event] }, { manifest: structuredClone(manifest), events: [structuredClone(event)] },
    new Date("2026-10-23T12:00:00.000Z"));
  assert.deepEqual({ matched: matched.matched, compared: matched.comparedEvents, divergences: matched.divergences },
    { matched: true, compared: 1, divergences: [] });
  const changed = compareReplay(sessionId, { manifest, events: [event] }, { manifest, events: [{ ...event, body: { status: "active" } }] },
    new Date("2026-10-23T12:00:00.000Z"));
  assert.equal(changed.matched, false);
  assert.equal(changed.divergences[0].code, "event_mismatch");
  const time = new Date("2026-10-23T12:00:00.000Z");
  assert.deepEqual(compareReplay(sessionId, { manifest, events: [event] }, { manifest, events: [] }, time).divergences.map(({ code }) => code), ["missing_event"]);
  assert.deepEqual(compareReplay(sessionId, { manifest, events: [] }, { manifest, events: [event] }, time).divergences.map(({ code }) => code), ["unexpected_event"]);
  assert.equal(compareReplay(sessionId, { manifest, events: [event] }, { manifest, events: [{ ...event, sequence: 2 }] }, time).divergences[0].code, "event_reordered");
  assert.equal(compareReplay(sessionId, { manifest, events: [] }, { manifest: { ...manifest, randomSeed: 7 }, events: [] }, time).divergences[0].code, "manifest_mismatch");
});

test("PS-520-T03 portable renderers produce deterministic PDF and ZIP containers", () => {
  const pdf = createTextPdf(["Captured History", "Reconstructed Narrative is not a transcript"]);
  assert.equal(Buffer.from(pdf.subarray(0, 8)).toString("ascii"), "%PDF-1.4");
  const zipA = createStoredZip([{ path: "report.json", bytes: new TextEncoder().encode('{"ok":true}') }]);
  const zipB = createStoredZip([{ path: "report.json", bytes: new TextEncoder().encode('{"ok":true}') }]);
  assert.deepEqual(zipA, zipB);
  assert.deepEqual(Buffer.from(zipA.subarray(0, 4)), Buffer.from([0x50, 0x4b, 0x03, 0x04]));
});
