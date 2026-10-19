import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  compileRelease,
  verifyReleasePackage
} from "../dist/index.js";

const input = {
  releaseId: "10000000-0000-4000-8000-000000000001",
  projectId: "20000000-0000-4000-8000-000000000001",
  definitionRevisionId: "30000000-0000-4000-8000-000000000001",
  releaseLabel: "r1",
  semanticVersion: "1.0.0",
  methodologyVersion: "1.0",
  materialization: {
    coreDesign: {
      pluginBindings: [{
        id: "binding-1", pluginId: "plugin-1", pluginVersion: "1.0.0",
        pluginDigest: `sha256:${"a".repeat(64)}`, installationId: "installation-1",
        categories: [], connectivity: "offline_capable", configuration: {},
        configurationDigest: "b".repeat(64), inputMappings: [], timeoutSeconds: 5,
        enabledInProfiles: ["institutional"]
      }],
      platformAdapters: [{ id: "adapter-1", digest: "c".repeat(64) }],
      stages: [{ id: "stage-1" }]
    },
    scenario: { id: "scenario-1", name: "Synthetic", description: "Fixture", deliveryModes: ["in_person"], tags: [] }
  },
  publishedBy: "40000000-0000-4000-8000-000000000001",
  approvedBy: ["50000000-0000-4000-8000-000000000001"],
  publishedAt: "2026-10-18T12:00:00.000Z",
  releaseNotes: "First release",
  validationReportId: "60000000-0000-4000-8000-000000000001"
};

test("AC-02/AC-06 PS-130-T01 compiles deterministic canonical Release bytes", () => {
  const first = compileRelease(input);
  const reordered = compileRelease({
    ...input,
    materialization: {
      scenario: input.materialization.scenario,
      coreDesign: { stages: [{ id: "stage-1" }], platformAdapters: input.materialization.coreDesign.platformAdapters,
        pluginBindings: input.materialization.coreDesign.pluginBindings }
    }
  });
  assert.deepEqual(first.bytes, reordered.bytes);
  assert.equal(first.packageDigest, reordered.packageDigest);
  assert.equal(verifyReleasePackage(first.bytes, first.packageDigest).release.manifest.releaseId, input.releaseId);
});

test("PS-130-T02 rejects tampering, secrets, Participant data and unpinned dependencies", () => {
  const compiled = compileRelease(input);
  const tampered = Uint8Array.from(compiled.bytes);
  tampered[tampered.length - 2] ^= 1;
  assert.throws(() => verifyReleasePackage(tampered, compiled.packageDigest), /digest mismatch/);
  const noncanonical = new TextEncoder().encode(`${new TextDecoder().decode(compiled.bytes)}\n`);
  const noncanonicalDigest = createHash("sha256").update(noncanonical).digest("hex");
  assert.throws(() => verifyReleasePackage(noncanonical, noncanonicalDigest), /not canonical/);
  const malformedValue = JSON.parse(new TextDecoder().decode(compiled.bytes));
  delete malformedValue.manifest.approvedBy;
  const malformed = new TextEncoder().encode(JSON.stringify(malformedValue));
  const malformedDigest = createHash("sha256").update(malformed).digest("hex");
  assert.throws(() => verifyReleasePackage(malformed, malformedDigest), /manifest values/);
  assert.throws(() => compileRelease({ ...input, materialization: {
    ...input.materialization, coreDesign: { ...input.materialization.coreDesign, secrets: { token: "do-not-package" } }
  } }), /prohibited data/);
  assert.throws(() => compileRelease({ ...input, materialization: {
    ...input.materialization, scenario: { ...input.materialization.scenario, participants: [{ name: "Person" }] }
  } }), /prohibited data/);
  assert.throws(() => compileRelease({ ...input, materialization: {
    ...input.materialization, coreDesign: { ...input.materialization.coreDesign, pluginBindings: [
      { ...input.materialization.coreDesign.pluginBindings[0], pluginDigest: "unpinned" }
    ] }
  } }), /not pinned/);
  assert.throws(() => compileRelease({ ...input, materialization: {
    ...input.materialization, coreDesign: { ...input.materialization.coreDesign,
      platformAdapters: [{ id: "adapter-1", digest: "unpinned" }] }
  } }), /Platform Adapter/);
});
