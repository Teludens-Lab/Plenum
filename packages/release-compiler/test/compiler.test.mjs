import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { canonicalizeJson } from "../../event-contracts/dist/index.js";
import { METHODOLOGY_CONTRACT_ID } from "../../simulation-schema/dist/index.js";

import {
  classifyReleaseCompatibility,
  compileModelComposition,
  compileRelease,
  previewCompositionFixture,
  verifyReleasePackage
} from "../dist/index.js";

const compatibilityRelease = (releaseId, coreDesign = { pluginBindings: [] }, scenario = {
  id: "scenario-1", name: "Scenario", description: "Description", deliveryModes: ["virtual"], tags: []
}) => ({ releaseId, schemaVersion: "1.3", compilerVersion: "0.1.0", coreDesign, scenario });

test("AC-07 classifies prospective, additive, consequential, and prohibited live migrations", () => {
  const before = compatibilityRelease("10000000-0000-4000-8000-000000000001");
  const prospective = classifyReleaseCompatibility(before, compatibilityRelease(
    "10000000-0000-4000-8000-000000000002", { pluginBindings: [], presentation: { accent: "gold" } }
  ));
  assert.equal(prospective.classification, "safe_prospective");
  assert.deepEqual(prospective.blockedReasons, []);

  const additive = classifyReleaseCompatibility(before, compatibilityRelease(
    "10000000-0000-4000-8000-000000000003", { pluginBindings: [], workflows: [{ id: "workflow-new", name: "New" }] }
  ));
  assert.equal(additive.classification, "compatibility_dependent");

  const consequential = classifyReleaseCompatibility(
    compatibilityRelease("10000000-0000-4000-8000-000000000004", { pluginBindings: [], workflows: [{ id: "workflow-1", name: "Before" }] }),
    compatibilityRelease("10000000-0000-4000-8000-000000000005", { pluginBindings: [], workflows: [{ id: "workflow-1", name: "After" }] })
  );
  assert.equal(consequential.classification, "consequential");
  assert.equal(consequential.requiresImpactReview, true);

  const security = classifyReleaseCompatibility(before, compatibilityRelease(
    "10000000-0000-4000-8000-000000000006", { pluginBindings: [], accessPolicy: { joinMethods: ["invite"] } }
  ));
  assert.equal(security.blockedReasons.length, 1);
});

test("AC-07 blocks cross-schema activation without an approved compatibility adapter", () => {
  const before = compatibilityRelease("10000000-0000-4000-8000-000000000001");
  const after = { ...compatibilityRelease("10000000-0000-4000-8000-000000000002"), schemaVersion: "2.0" };
  assert.match(classifyReleaseCompatibility(before, after).blockedReasons[0], /compatibility adapter/u);
});

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

test("PS-830-T03 compiled execution excludes inactive authored definitions and retains historical packages", async () => {
  const original = JSON.parse(await readFile(new URL("../../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"));
  const oldBytes = new TextEncoder().encode(JSON.stringify(original));
  // The versioned historical fixture remains untouched and compiles with its original compiler contract.
  const old = compileRelease({ ...input, materialization: { coreDesign: original.coreDesign, scenario: original.scenario } });
  assert.equal(old.release.manifest.compilerVersion, "0.1.0");
  assert.equal(verifyReleasePackage(old.bytes, old.packageDigest).contentDigest, old.contentDigest);
  const draft = { ...structuredClone(input), materialization: { coreDesign: structuredClone(original.coreDesign), scenario: structuredClone(original.scenario) } };
  draft.materialization.coreDesign.methodologyContractId = METHODOLOGY_CONTRACT_ID;
  draft.materialization.coreDesign.adjudicationModels[0].output = { outcomeCategories: ["accepted", "returned"], rationaleRequired: true,
    confidenceRequired: false, stateEffects: [], followOnInjectIds: [] };
  draft.materialization.coreDesign.methodologyConcepts = [{ key: "poll", label: "Ballot", enabled: false, dependsOn: [] }];
  draft.materialization.coreDesign.polls = [{ id: "retained-poll", question: "Retained in the Draft" }];
  const compiled = compileRelease(draft);
  assert.equal(compiled.release.manifest.compilerVersion, "0.2.0");
  assert.deepEqual(compiled.release.coreDesign.polls, []);
  assert.equal(draft.materialization.coreDesign.polls.length, 1);
  assert.deepEqual(verifyReleasePackage(compiled.bytes, compiled.packageDigest).release.coreDesign.polls, []);
  draft.materialization.coreDesign.methodologyConcepts.push({ key: "evidence", label: "Optional", enabled: false, dependsOn: [] });
  assert.throws(() => compileRelease(draft), /mandatory foundation/u);
  assert.deepEqual(new TextEncoder().encode(JSON.stringify(original)), oldBytes);
});

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

test("PS-830-T04 preserves the versioned Form contract in portable packages and rejects a legacy compiler pin", async () => {
  const original = JSON.parse(await readFile(new URL("../../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"));
  const fixture = JSON.parse(await readFile(new URL("../../../tests/platform/fixtures/structured-form-v2.json", import.meta.url), "utf8"));
  for (const section of fixture.form.sections) for (const field of section.fields) delete field.editableBySessionRoleIds;
  original.coreDesign.forms.push(fixture.form);
  original.coreDesign.artifactTypes.push({ ...original.coreDesign.artifactTypes[0], id: "83000000-0000-4000-8000-000000000007",
    key: "bounded", name: "Bounded record", formId: fixture.form.id });
  const compiled = compileRelease({ ...input, materialization: { coreDesign: original.coreDesign, scenario: original.scenario } });
  assert.equal(compiled.release.manifest.compilerVersion, "0.2.0");
  assert.deepEqual(verifyReleasePackage(compiled.bytes, compiled.packageDigest).release.coreDesign.forms.at(-1), fixture.form);
  const wrongPin = JSON.parse(new TextDecoder().decode(compiled.bytes));
  wrongPin.manifest.compilerVersion = "0.1.0";
  wrongPin.manifestDigest = createHash("sha256").update(canonicalizeJson(wrongPin.manifest)).digest("hex");
  const bytes = new TextEncoder().encode(canonicalizeJson(wrongPin));
  assert.throws(() => verifyReleasePackage(bytes, createHash("sha256").update(bytes).digest("hex")), /Structured Forms require compiler 0.2.0/u);
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

const numberPort = (id, unit = "percent", classification = "internal", required = false) =>
  ({ id, label: id, dataType: "number", unit, classification, required });
const effectPort = (id, required = false) =>
  ({ id, label: id, dataType: "effect_proposal", unit: "", classification: "confidential", required, carriesEffectProposals: true });
const compositionBindings = [
  { ...input.materialization.coreDesign.pluginBindings[0], id: "binding-a", pluginId: "org.ssg.model.a",
    inputPorts: [], outputPorts: [numberPort("score")], dependencies: [{ pluginId: "org.ssg.shared.math", version: "1.0.0", digest: `sha256:${"d".repeat(64)}` }] },
  { ...input.materialization.coreDesign.pluginBindings[0], id: "binding-b", pluginId: "org.ssg.model.b", pluginDigest: `sha256:${"e".repeat(64)}`,
    inputPorts: [numberPort("score", "percent", "internal", true)], outputPorts: [effectPort("proposals")] }
];

function sequentialComposition() {
  return {
    contractId: "composition-definition-v1", id: "composition-sequential", name: "Sequential proof", version: "1",
    nodes: [
      { id: "model-a", name: "Model A", kind: "model", bindingId: "binding-a", inputPorts: [], outputPorts: [numberPort("score")] },
      { id: "model-b", name: "Model B", kind: "model", bindingId: "binding-b", inputPorts: [numberPort("score", "percent", "internal", true)], outputPorts: [effectPort("proposals")] },
      { id: "review", name: "Review", kind: "approval_gate", approverSessionRoleIds: ["control"], inputPorts: [effectPort("proposals", true)], outputPorts: [effectPort("approved")] },
      { id: "output", name: "Output", kind: "output", inputPorts: [effectPort("approved", true)], outputPorts: [] }
    ],
    edges: [
      { id: "edge-a-b", fromNodeId: "model-a", fromPortId: "score", toNodeId: "model-b", toPortId: "score" },
      { id: "edge-b-review", fromNodeId: "model-b", fromPortId: "proposals", toNodeId: "review", toPortId: "proposals" },
      { id: "edge-review-output", fromNodeId: "review", fromPortId: "approved", toNodeId: "output", toPortId: "approved" }
    ],
    fixtures: [{ id: "fixture-sequential", name: "Sequential fixture", modelOutputs: {
      "model-a": { score: 42 }, "model-b": { proposals: { target: "synthetic", value: 42 } }
    } }]
  };
}

test("EXT-12 sequential composition routes typed pinned fixture outputs without state change", () => {
  const composition = sequentialComposition();
  const before = structuredClone(composition.fixtures[0]);
  const compiled = compileModelComposition(composition, compositionBindings, new Set(["control"]));
  const preview = previewCompositionFixture(compiled, compositionBindings, composition.fixtures[0]);
  assert.equal(preview.status, "completed");
  assert.deepEqual(preview.stateChanges, []);
  assert.deepEqual(composition.fixtures[0], before);
  assert.match(compiled.graphDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(compiled.dependencyClosure.map(({ digest }) => digest),
    [`sha256:${"a".repeat(64)}`, `sha256:${"d".repeat(64)}`, `sha256:${"e".repeat(64)}`]);
});

test("EXT-13 parallel composition exposes a deterministic partial join", () => {
  const composition = {
    contractId: "composition-definition-v1", id: "composition-parallel", name: "Parallel proof", version: "1",
    nodes: [
      { id: "left", name: "Left", kind: "model", bindingId: "binding-a", inputPorts: [], outputPorts: [numberPort("score")] },
      { id: "right", name: "Right", kind: "model", bindingId: "binding-a", inputPorts: [], outputPorts: [numberPort("score")] },
      { id: "join", name: "Join", kind: "join", joinPolicy: "allow_partial", inputPorts: [numberPort("scores", "percent", "internal", true)], outputPorts: [numberPort("score")] },
      { id: "output", name: "Output", kind: "output", inputPorts: [numberPort("score", "percent", "internal", true)], outputPorts: [] }
    ],
    edges: [
      { id: "left-join", fromNodeId: "left", fromPortId: "score", toNodeId: "join", toPortId: "scores" },
      { id: "right-join", fromNodeId: "right", fromPortId: "score", toNodeId: "join", toPortId: "scores" },
      { id: "join-output", fromNodeId: "join", fromPortId: "score", toNodeId: "output", toPortId: "score" }
    ],
    fixtures: [{ id: "fixture-parallel", name: "Partial fixture", modelOutputs: { left: { score: 40 }, right: { score: 60 } }, failingNodeIds: ["right"] }]
  };
  const preview = previewCompositionFixture(composition, compositionBindings, composition.fixtures[0]);
  assert.equal(preview.status, "partial");
  assert.equal(preview.nodes.find(({ nodeId }) => nodeId === "right").status, "failed");
  assert.equal(preview.nodes.find(({ nodeId }) => nodeId === "join").status, "partial");
  assert.deepEqual(preview.stateChanges, []);
});

test("EXT-14 compiler rejects cycles, unit mismatch, classification leaks and missing approval gates", async (context) => {
  const cases = [
    ["cycle", /cycle/iu, (composition) => { composition.nodes[0].inputPorts.push(effectPort("feedback")); composition.edges.push({ id: "cycle", fromNodeId: "review", fromPortId: "approved", toNodeId: "model-a", toPortId: "feedback" }); }],
    ["unit mismatch", /incompatible units/iu, (composition) => { composition.nodes[1].inputPorts[0].unit = "ratio"; }],
    ["classification leak", /classification ceiling/iu, (composition) => { composition.nodes[1].inputPorts[0].classification = "public"; composition.nodes[0].outputPorts[0].classification = "restricted"; }],
    ["missing approval gate", /approval gate/iu, (composition) => { composition.nodes = composition.nodes.filter(({ id }) => id !== "review"); composition.edges = [{ id: "direct", fromNodeId: "model-b", fromPortId: "proposals", toNodeId: "output", toPortId: "approved" }, composition.edges[0]]; }]
  ];
  for (const [name, pattern, mutate] of cases) await context.test(name, () => {
    const composition = sequentialComposition();
    mutate(composition);
    assert.throws(() => compileModelComposition(composition, compositionBindings, new Set(["control"])), pattern);
  });
});

test("EXT-15 compiled graph and dependency closure stay pinned when the Draft changes", () => {
  const source = sequentialComposition();
  const compiled = compileModelComposition(source, compositionBindings, new Set(["control"]));
  const pinned = structuredClone(compiled);
  source.nodes[0].name = "Changed after run start";
  source.edges.pop();
  assert.deepEqual(compiled, pinned);
  assert.throws(() => compileModelComposition(source, compositionBindings, new Set(["control"])), /missing required input/iu);
});
