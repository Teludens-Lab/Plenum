import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";

import { evaluateGate, nextStage, rehearseStages, remainingSeconds, requiredFieldsMissing, resolveWorkflowTransition } from "../dist/index.js";

const workflow = {
  id: "workflow", key: "review", name: "Review", initialState: "draft",
  states: [{ key: "draft", label: "Draft", kind: "draft" }, { key: "done", label: "Done", kind: "terminal" }],
  transitions: [{ id: "submit", from: "draft", command: "artifact.submit", to: "done", allowedSessionRoleIds: ["author"] }]
};

test("PS-200-T02 resolves configured workflow permissions without role-name branches", () => {
  assert.equal(resolveWorkflowTransition(workflow, "draft", "artifact.submit", "author").allowed, true);
  assert.deepEqual(resolveWorkflowTransition(workflow, "draft", "artifact.submit", "reviewer"), { allowed: false, reason: "PERMISSION_DENIED" });
  assert.deepEqual(resolveWorkflowTransition(workflow, "done", "artifact.submit", "author"), { allowed: false, reason: "INVALID_TRANSITION" });
});

test("PS-200-T02 validates configured fields and server-authoritative Stage time", () => {
  const form = { id: "form", name: "Form", formVersion: "1", sections: [{ id: "main", fields: [
    { id: "summary", key: "summary", label: "Summary", type: "long_text", required: true },
    { id: "choices", key: "choices", label: "Choices", type: "multi_select", required: true }
  ] }] };
  assert.deepEqual(requiredFieldsMissing(form, { summary: " ", choices: [] }), ["Summary", "Choices"]);
  const first = { id: "one", name: "One", stageType: "phase", allowedActivityIds: [], durationSeconds: 600,
    timerMode: "countdown", transitions: [{ id: "next", targetStageId: "two", mode: "manual" }],
    operatorControls: { allowStart: true, allowEnd: true, allowReopen: true, allowExtend: true, allowSkip: false, allowReturnToPrevious: true, requireReason: true } };
  const second = { ...first, id: "two", name: "Two", transitions: [] };
  assert.equal(nextStage([first, second], "one", "two")?.name, "Two");
  assert.equal(remainingSeconds(first, new Date("2026-01-01T00:00:00Z"), null, 30, new Date("2026-01-01T00:02:00Z")), 510);
});

test("PS-400-T01 runs the approved bounded Stage and Gate subset", async () => {
  const fixture = JSON.parse(await readFile(new URL("../../../definitions/crisis-response/ps-400-rehearsal.json", import.meta.url), "utf8"));
  const result = rehearseStages(fixture);
  assert.equal(result.finalStageId, "response");
  assert.equal(result.facts["state.infrastructure-strain"], 75);
  assert.equal(result.trace.every(({ fired }) => fired), true);
  assert.deepEqual(result.trace.find(({ kind }) => kind === "effect")?.stateChanges, [{
    stateVariableId: "infrastructure-strain", scopeReference: "", previousValue: 70, newValue: 75, operation: "increment"
  }]);
});

test("PS-400-T02 treats authored Fact names as inert map keys", () => {
  const malicious = "state.infrastructure-strain;globalThis.compromised=true";
  const evaluation = evaluateGate({ operator: "all", conditions: [{ fact: malicious, operator: "equals", value: 1 }] }, {});
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.explanations[0]?.reason, "fact_unavailable");
  assert.equal(globalThis.compromised, undefined);
});

test("PS-400-T03 repeats a rehearsal with the same trace", async () => {
  const fixture = JSON.parse(await readFile(new URL("../../../definitions/crisis-response/ps-400-rehearsal.json", import.meta.url), "utf8"));
  assert.deepEqual(rehearseStages(fixture), rehearseStages(fixture));
});

test("PS-400-T01 selects a prioritized conditional branch", () => {
  const base = { name: "Stage", stageType: "phase", allowedActivityIds: [], operatorControls: {
    allowStart: true, allowEnd: true, allowReopen: false, allowExtend: false, allowSkip: false,
    allowReturnToPrevious: false, requireReason: true
  } };
  const result = rehearseStages({ seed: 1, startedAt: "2026-10-22T12:00:00Z", facts: { "state.risk": 8 }, stages: [
    { ...base, id: "start", transitionMode: "exclusive", transitions: [
      { id: "high", targetStageId: "escalate", mode: "automatic", priority: 10,
        gate: { operator: "all", conditions: [{ fact: "state.risk", operator: "greater_or_equal", value: 7 }] } },
      { id: "fallback", targetStageId: "monitor", mode: "automatic", priority: 0 }
    ] },
    { ...base, id: "escalate", transitions: [] },
    { ...base, id: "monitor", transitions: [] }
  ] });
  assert.deepEqual(result.finalStageIds, ["escalate"]);
  assert.equal(result.trace.find(({ triggerId }) => triggerId === "fallback")?.fired, false);
});

test("PS-400-T01 runs parallel branches and an all-branches join once", () => {
  const base = { name: "Stage", stageType: "phase", allowedActivityIds: [], operatorControls: {
    allowStart: true, allowEnd: true, allowReopen: false, allowExtend: false, allowSkip: false,
    allowReturnToPrevious: false, requireReason: true
  } };
  const result = rehearseStages({ seed: 2, startedAt: "2026-10-22T12:00:00Z", facts: {}, stages: [
    { ...base, id: "fork", transitionMode: "parallel", transitions: [
      { id: "fork-a", targetStageId: "a", mode: "automatic" },
      { id: "fork-b", targetStageId: "b", mode: "automatic" }
    ] },
    { ...base, id: "a", transitions: [{ id: "a-join", targetStageId: "join", mode: "automatic" }] },
    { ...base, id: "b", transitions: [{ id: "b-join", targetStageId: "join", mode: "automatic" }] },
    { ...base, id: "join", joinMode: "all", transitions: [] }
  ] });
  assert.deepEqual(result.finalStageIds, ["join"]);
  assert.equal(result.trace.filter(({ triggerId }) => triggerId === "join.entry").length, 1);
});

test("PS-400-T01 cancels outstanding parallel work after a first-branch join", () => {
  const base = { name: "Stage", stageType: "phase", allowedActivityIds: [], operatorControls: {
    allowStart: true, allowEnd: true, allowReopen: false, allowExtend: false, allowSkip: false,
    allowReturnToPrevious: false, requireReason: true
  } };
  const result = rehearseStages({ seed: 3, startedAt: "2026-10-22T12:00:00Z", facts: { "state.count": 0 }, stages: [
    { ...base, id: "fork", transitionMode: "parallel", transitions: [
      { id: "fork-a", targetStageId: "a", mode: "automatic" },
      { id: "fork-b", targetStageId: "b", mode: "automatic" }
    ] },
    { ...base, id: "a", transitions: [{ id: "a-join", targetStageId: "join", mode: "automatic" }] },
    { ...base, id: "b", transitions: [{ id: "b-next", targetStageId: "b-next", mode: "automatic" }] },
    { ...base, id: "b-next", onEnter: [{ type: "apply_effect", parameters: {
      stateVariableId: "count", operation: "increment", value: 1
    } }], transitions: [{ id: "b-join", targetStageId: "join", mode: "automatic" }] },
    { ...base, id: "join", joinMode: "first", transitions: [] }
  ] });
  assert.deepEqual(result.finalStageIds, ["join"]);
  assert.equal(result.facts["state.count"], 0);
  assert.equal(result.trace.some(({ triggerId }) => triggerId === "b-next.entry"), false);
});
