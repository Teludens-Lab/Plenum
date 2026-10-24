import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { compileRelease } from "@plenum/release-compiler";
import { rehearseStages, resolveWorkflowTransition } from "@plenum/workflow-engine";

const readJson = async (path) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), "utf8"));
const [source, session] = await Promise.all([
  readJson("definitions/validation/crisis-response/release-source.json"),
  readJson("definitions/validation/crisis-response/session.json")
]);
const { release, packageDigest } = compileRelease(source);
const facts = Object.fromEntries((release.scenario.initialState ?? []).map((value) => [
  value.scopeReference === undefined
    ? `state.${value.stateVariableId}`
    : `state.${value.stateVariableId}.team.${value.scopeReference}`,
  value.value
]));
const rehearsal = rehearseStages({ stages: release.coreDesign.stages, facts, startedAt: session.startedAt, seed: session.seed });
assert.deepEqual(rehearsal.finalStageIds, session.expectedFinalStageIds);

const workflow = release.coreDesign.workflows.find(({ id }) => id === session.workflow.id);
assert.ok(workflow);
let state = null;
for (const step of session.workflow.steps) {
  const transition = resolveWorkflowTransition(workflow, state, step.operationType, step.sessionRoleId, rehearsal.facts);
  assert.equal(transition.allowed, true);
  state = transition.transition.to;
}
assert.equal(state, session.workflow.expectedFinalState);

console.log(JSON.stringify({
  contractId: "airgap-session-smoke-v1",
  sessionId: session.sessionId,
  packageDigest,
  finalStageIds: rehearsal.finalStageIds,
  finalWorkflowState: state,
  status: "completed"
}));
