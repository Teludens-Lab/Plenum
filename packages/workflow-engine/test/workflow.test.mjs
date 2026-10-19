import assert from "node:assert/strict";
import test from "node:test";

import { nextStage, remainingSeconds, requiredFieldsMissing, resolveWorkflowTransition } from "../dist/index.js";

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
