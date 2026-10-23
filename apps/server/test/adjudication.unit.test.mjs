import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAdjudicationModel } from "../dist/index.js";

const base = {
  id: "resolution", name: "Resolution", appliesToArtifactTypeIds: ["action"], reviewerSessionRoleIds: ["reviewer"],
  leadReviewerSessionRoleIds: ["lead"], perspectives: [], publicationScope: { public: true }
};

test("PS-410-T01 every adjudication mechanism returns the unified suggestion contract", () => {
  const models = [
    { ...base, mechanism: "manual" },
    { ...base, mechanism: "rubric", rubric: [{ id: "fit", label: "Fit", weight: 2, minimum: 0, maximum: 10 }] },
    { ...base, mechanism: "rules", rules: [{ id: "ready", label: "Ready", when: { operator: "all", conditions: [
      { fact: "action.ready", operator: "equals", value: true }
    ] }, outcome: "accept" }] },
    { ...base, mechanism: "plugin", pluginBindingIds: ["model"] },
    { ...base, mechanism: "hybrid", rubric: [{ id: "fit", label: "Fit", weight: 1, minimum: 0, maximum: 10 }],
      rules: [{ id: "ready", label: "Ready", when: { operator: "all", conditions: [{ fact: "action.ready", operator: "equals", value: true }] }, outcome: "accept" }],
      pluginBindingIds: ["model"] }
  ];
  const pluginSuggestions = [{ proposalId: "proposal", proposalHash: "hash", value: "adjust" }];
  for (const model of models) {
    const result = evaluateAdjudicationModel(model, { facts: { "action.ready": true }, rubricScores: { fit: 8 }, pluginSuggestions,
      reviewRecommendations: ["approve"] });
    assert.equal(result.mechanism, model.mechanism);
    assert.ok(Array.isArray(result.explanationTrace));
    assert.ok(Object.hasOwn(result, "suggestion"));
  }
});

test("AC-12 rules trace records every evaluated condition, including failures", () => {
  const result = evaluateAdjudicationModel({ ...base, mechanism: "rules", rules: [{ id: "bounded", label: "Bounded rule",
    when: { operator: "all", conditions: [
      { fact: "action.ready", operator: "equals", value: true },
      { fact: "action.cost", operator: "less_or_equal", value: 5 }
    ] }, outcome: "accept" }] }, { facts: { "action.ready": true, "action.cost": 9 } });
  const conditionTrace = result.explanationTrace[0].details;
  assert.equal(Array.isArray(conditionTrace), true);
  assert.equal(conditionTrace.length, 3);
  assert.deepEqual(conditionTrace.map(({ passed }) => passed), [true, false, false]);
  assert.equal(result.suggestion, null);
});
