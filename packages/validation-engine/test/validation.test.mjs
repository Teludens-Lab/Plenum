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
    ["missing effect target", "effect.reference_missing", (draft) => { draft.scenario.injects[0].effects = [{ targetStateVariableId: "missing-state" }]; }],
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
