import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateStudioDraft } from "../dist/index.js";
import { copySimulationTemplate } from "../../simulation-schema/dist/index.js";

async function fixture() {
  const release = JSON.parse(await readFile(new URL("../../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"));
  return { coreDesign: release.coreDesign, scenario: release.scenario };
}

test("SYNC-01 validation blocks an invalid merged workflow with a source link", async () => {
  const invalid = structuredClone(await fixture());
  invalid.coreDesign.workflows[0].initialState = "missing-state";
  const report = validateStudioDraft(invalid);
  assert.equal(report.valid, false);
  assert.equal(report.issues.length > 0, true);
  assert.match(report.issues[0].message, /Workflow/u);
  assert.match(report.issues[0].path, /^workflows\./u);
  assert.match(report.reportDigest, /^[0-9a-f]{64}$/u);
});

test("PS-310-T01 REQ-011 defect catalog blocks Publication with targeted messages", async (context) => {
  const cases = [
    ["duplicate identifier", "core_design.invalid", (draft) => { draft.coreDesign.teams[1].id = draft.coreDesign.teams[0].id; }],
    ["missing reference", "core_design.invalid", (draft) => { draft.coreDesign.seats[0].sessionRoleIds = ["missing-role"]; }],
    ["Stage with no exit", "stage.no_exit", (draft) => { draft.coreDesign.stages[0].transitions = []; }],
    ["circular automatic Stages", "stage.automatic_cycle", (draft) => {
      draft.coreDesign.stages[0].transitions = [{ id: "cycle-a", targetStageId: draft.coreDesign.stages[1].id, mode: "automatic" }];
      draft.coreDesign.stages[1].transitions = [{ id: "cycle-b", targetStageId: draft.coreDesign.stages[0].id, mode: "automatic" }];
    }],
    ["workflow without terminal state", "core_design.invalid", (draft) => { draft.coreDesign.workflows[0].states.forEach((state) => { state.kind = "review"; }); }],
    ["unassigned task", "workflow.task_unassigned", (draft) => { draft.coreDesign.workflows[0].states[1] = { key: "with_facilitator", label: "Unassigned", kind: "task" }; }],
    ["approval without approver", "workflow.approver_required", (draft) => { draft.coreDesign.workflows[0].states[1] = { key: "with_facilitator", label: "Approval", kind: "approval" }; }],
    ["impossible Inject condition", "scenario.invalid", (draft) => { draft.scenario.injects[0].releaseMode = "gate"; delete draft.scenario.injects[0].releaseGate; }],
    ["inaccessible interface module", "interface.policy_inaccessible", (draft) => { draft.coreDesign.interfaces[0].layout.regions[0].modules[0].configuration.informationPolicyId = "policy-team-control"; }],
    ["missing effect target", "effect.reference_missing", (draft) => { draft.scenario.injects[0].effects = [{ stateVariableId: "missing-state", operation: "set", value: 1 }]; }],
    ["route without recipient", "core_design.invalid", (draft) => { draft.coreDesign.communications.routes[0].recipient = {}; }],
    ["report source unavailable", "report.data_unavailable", (draft) => { draft.coreDesign.reports[0].sections[0].source = "missing-source"; }],
    ["permission contradiction", "permission.contradiction", (draft) => {
      const roleId = draft.coreDesign.seats[0].sessionRoleIds[0];
      draft.coreDesign.sessionRoles.find(({ id }) => id === roleId).enabled = false;
    }],
    ["Information Policy leakage", "information_policy.leakage", (draft) => { draft.coreDesign.communications.routes[0].recipient = { public: true }; }],
    ["disabled concept dependency", "methodology.disabled_dependency", (draft) => { draft.coreDesign.methodologyConcepts = [{ key: "team", label: "Team", enabled: false, dependsOn: ["seat"] }]; }],
    ["missing decision trace", "research.traceability_missing", (draft) => { draft.coreDesign.decisionTraceability = []; }]
  ];
  for (const [name, code, mutate] of cases) await context.test(name, async () => {
    const draft = structuredClone(await fixture());
    mutate(draft);
    const report = validateStudioDraft(draft);
    assert.equal(report.valid, false);
    assert.ok(report.issues.some((item) => item.code === code), `${name} should report ${code}: ${JSON.stringify(report.issues)}`);
    assert.ok(report.issues.every((item) => item.message.length > 0 && item.path.length > 0));
  });
});

test("PS-310-T02 INV-007 template copies omit Scenario content unless explicitly selected", async () => {
  const source = await fixture();
  const omitted = copySimulationTemplate(source.coreDesign, source.scenario, "project-copy-default", "scenario-copy-default");
  assert.equal(omitted.projectId, "project-copy-default");
  assert.deepEqual(omitted.scenario, { id: "scenario-copy-default", name: "Untitled Scenario", description: "", deliveryModes: [], tags: [] });
  assert.notEqual(omitted.coreDesign, source.coreDesign);
  const included = copySimulationTemplate(source.coreDesign, source.scenario, "project-copy-explicit", "scenario-copy-explicit", true);
  assert.equal(included.projectId, "project-copy-explicit");
  assert.equal(included.scenario.id, "scenario-copy-explicit");
  assert.deepEqual(included.scenario.content, source.scenario.content);
  assert.notEqual(included.scenario.content, source.scenario.content);
});

test("PS-320 VOTE-15 rejects implicit Poll rules and gated ballot modes", async (context) => {
  const cases = [
    ["implicit denominator", "poll.counting_rule_incomplete", (poll) => { delete poll.thresholdRule.denominator; }],
    ["implicit tie rule", "poll.counting_rule_incomplete", (poll) => { delete poll.tieRule; }],
    ["secret ballot", "poll.secret_ballot_policy_pending", (poll) => { poll.secrecy = "secret_ballot"; }],
    ["anonymous survey", "poll.anonymous_survey_unavailable", (poll) => { poll.secrecy = "anonymous_survey"; }]
  ];
  for (const [name, code, mutate] of cases) await context.test(name, async () => {
    const draft = structuredClone(await fixture());
    const poll = {
      id: "vote-proof", scope: "session", question: "Proceed?", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
      pollType: "single_choice", minSelections: 1, maxSelections: 1, tallyMethod: "builtin_count", tallyMethodVersion: "1",
      electoratePolicyId: draft.coreDesign.informationPolicies[0].id, oneBallotPer: "seat_assignment", allowRevote: false, secrecy: "open",
      thresholdRule: { kind: "simple_majority", denominator: "valid_votes", abstentionCountsTowardDenominator: false },
      quorumRule: { basis: "electorate_at_open", minimum: 0, abstentionCountsTowardParticipation: true }, weights: [], vetoRule: { holderSeatIds: [] },
      tieRule: "no_decision", openTrigger: { mode: "manual" }, closeTrigger: { mode: "manual" }, deadlinePolicy: { graceSeconds: 0 },
      resultVisibilityPolicyId: draft.coreDesign.informationPolicies[0].id, certificationPolicy: {}
    };
    mutate(poll);
    draft.coreDesign.polls = [poll];
    const report = validateStudioDraft(draft);
    assert.ok(report.issues.some((item) => item.code === code), `${name} should report ${code}: ${JSON.stringify(report.issues)}`);
  });
});

test("PS-320 VOICE-09 validates Media Provider capability per target profile", async () => {
  const draft = structuredClone(await fixture());
  const adapterId = draft.coreDesign.communications.voiceChannels[0].mediaProviderAdapterBindingId;
  const adapter = draft.coreDesign.platformAdapters.find(({ id }) => id === adapterId);
  adapter.kind = "media_provider";
  adapter.voiceCapabilities = [
    { profile: "cloud", modes: ["radio_ptt"], recording: false, transcription: false },
    { profile: "institutional", modes: [], recording: false, transcription: false },
    { profile: "air_gapped", modes: ["radio_ptt"], recording: false, transcription: false }
  ];
  const report = validateStudioDraft(draft);
  assert.ok(report.issues.some(({ code, message }) => code === "voice.adapter_capability_missing" && /institutional/u.test(message)));
});

test("PS-400-T01/T02 validates typed Gates and rejects unknown Facts", async () => {
  const rehearsal = JSON.parse(await readFile(new URL("../../../definitions/crisis-response/ps-400-rehearsal.json", import.meta.url), "utf8"));
  const valid = structuredClone(await fixture());
  valid.coreDesign.stateVariables = [{ ...rehearsal.stateVariable,
    informationPolicyId: valid.coreDesign.informationPolicies[0].id }];
  valid.coreDesign.stages[0].completionGate = rehearsal.stages[0].completionGate;
  assert.equal(validateStudioDraft(valid).valid, true);

  valid.coreDesign.stages[0].completionGate.conditions[0].fact = "state.not-in-the-release";
  const report = validateStudioDraft(valid);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ message }) => /unknown Fact state\.not-in-the-release/u.test(message)));
});

test("PS-400-T01 validates bounded parallel branches with an explicit join", async () => {
  const draft = structuredClone(await fixture());
  const fork = draft.coreDesign.stages[0];
  const join = draft.coreDesign.stages[1];
  const controls = { allowStart: false, allowEnd: false, allowReopen: false, allowExtend: false,
    allowSkip: false, allowReturnToPrevious: false, requireReason: true };
  const branch = (id) => ({ id, name: id, stageType: "phase", order: 1, timerMode: "none", allowedActivityIds: [],
    transitions: [{ id: `${id}-join`, targetStageId: join.id, mode: "automatic" }], operatorControls: controls });
  fork.transitionMode = "parallel";
  fork.parallelJoinStageId = join.id;
  fork.transitions = [
    { id: "fork-a", targetStageId: "bounded-a", mode: "automatic" },
    { id: "fork-b", targetStageId: "bounded-b", mode: "automatic" }
  ];
  join.joinMode = "all";
  draft.coreDesign.stages.splice(1, 0, branch("bounded-a"), branch("bounded-b"));
  assert.equal(validateStudioDraft(draft).valid, true);

  draft.coreDesign.stages.find(({ id }) => id === "bounded-b").transitions[0].mode = "manual";
  const report = validateStudioDraft(draft);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ message }) => /bounded automatic logic/u.test(message)));
});

test("PS-730-T01 foundational Activities, nested Stage Groups, and role restrictions validate as one Runtime model", async () => {
  const draft = structuredClone(await fixture());
  const role = draft.coreDesign.sessionRoles[0];
  const artifact = draft.coreDesign.artifactTypes[0];
  const stage = draft.coreDesign.stages[0];
  draft.coreDesign.activities = [{
    id: "activity-foundation", name: "Foundation activity", description: "A guided activity",
    instructions: "Complete the governed work.", sessionRoleIds: [role.id], artifactTypeIds: [artifact.id], required: true
  }];
  stage.allowedActivityIds = ["activity-foundation"];
  role.allowedStageIds = [stage.id];
  draft.coreDesign.stageGroups.push(
    { id: "group-parent", name: "Parent", stageType: "phase", order: 0 },
    { id: "group-child", name: "Child", stageType: "round", order: 0, parentGroupId: "group-parent" }
  );
  stage.stageGroupId = "group-child";
  assert.equal(validateStudioDraft(draft).valid, true);

  draft.coreDesign.activities[0].sessionRoleIds = ["missing-role"];
  const report = validateStudioDraft(draft);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ path, message }) => path === "activities.activity-foundation" && /missing-role/u.test(message)));
});

test("PS-730 validation links identify the exact Team with a missing Objective", async () => {
  const draft = structuredClone(await fixture());
  draft.coreDesign.teams[0].objectiveIds = ["missing-objective"];
  const report = validateStudioDraft(draft);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ path, message }) => path === `teams.${draft.coreDesign.teams[0].id}` && /missing-objective/u.test(message)));
});

test("PS-750-T01 validates an explicit world-state adjudication contract and rejects unknown Facts", async () => {
  const draft = structuredClone(await fixture());
  draft.coreDesign.stateVariables = [{
    id: "ps750-pressure", name: "Operational pressure", description: "Synthetic adjudication input",
    scope: "global", type: "integer", minimum: 0, maximum: 10, unit: "points",
    informationPolicyId: "policy-public", editableBySessionRoleIds: ["white_cell"],
    historyMode: "full", display: "gauge"
  }];
  draft.scenario.initialState = [{ stateVariableId: "ps750-pressure", value: 2 }];
  draft.coreDesign.adjudicationModels = [{
    id: "ps750-model", name: "PS-750 rules preview", doctrine: "rules_based", mechanism: "rules",
    appliesToArtifactTypeIds: ["blue-action"], reviewerSessionRoleIds: ["white_cell"],
    leadReviewerSessionRoleIds: ["white_cell"], perspectives: [{
      id: "ps750-control-perspective", label: "Control perspective", reviewerSessionRoleIds: ["white_cell"]
    }],
    rules: [{
      id: "ps750-pressure-rule", label: "Pressure is elevated",
      when: { operator: "all", conditions: [{ fact: "state.ps750-pressure", operator: "greater_than", value: 1 }] },
      outcome: "review", explanation: "Suggest review when operational pressure exceeds one point."
    }],
    timeoutSeconds: 300, approvingSessionRoleIds: ["white_cell"],
    output: {
      outcomeCategories: ["accept", "revise", "reject"], rationaleRequired: true, confidenceRequired: true,
      revealedInformationPolicyId: "policy-public",
      stateEffects: [{ stateVariableId: "ps750-pressure", operation: "increment", value: 1, rationale: "Approved synthetic fixture" }],
      followOnInjectIds: ["opening-briefing"]
    },
    publicationScope: { public: true }, precedent: "advisory"
  }];

  const validReport = validateStudioDraft(draft);
  assert.equal(validReport.valid, true, JSON.stringify(validReport.issues));
  draft.coreDesign.adjudicationModels[0].rules[0].when.conditions[0].fact = "state.missing";
  const report = validateStudioDraft(draft);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ path, message }) => path === "adjudicationModels.ps750-model" && /state\.missing/u.test(message)));
});
