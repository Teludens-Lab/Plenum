import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runtimeSourceHash } from "./source-evidence.mjs";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { projectResource, PolicyDeniedError } from "@plenum/policy-engine";
import { compileRelease, RELEASE_COMPILER_VERSION } from "@plenum/release-compiler";
import { SIMULATION_SCHEMA_VERSION } from "@plenum/simulation-schema";
import { validateStudioDraft } from "@plenum/validation-engine";
import { evaluateGate, rehearseStages, resolveWorkflowTransition } from "@plenum/workflow-engine";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const evidencePath = path.join(repoRoot, "test-results/generalization/ps-430-evidence.json");
async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

function initialFacts(scenario) {
  return Object.fromEntries((scenario.initialState ?? []).map((value) => [
    value.scopeReference === undefined
      ? `state.${value.stateVariableId}`
      : `state.${value.stateVariableId}.team.${value.scopeReference}`,
    value.value
  ]));
}

function traceDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function runValidationSimulation(id) {
  const base = `definitions/validation/${id}`;
  const [source, session] = await Promise.all([
    readJson(`${base}/release-source.json`),
    readJson(`${base}/session.json`)
  ]);
  const validation = validateStudioDraft(source.materialization);
  assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));
  const compiled = compileRelease(source);
  const rehearsalInput = {
    stages: compiled.release.coreDesign.stages,
    facts: initialFacts(compiled.release.scenario),
    startedAt: session.startedAt,
    seed: session.seed
  };
  const first = rehearseStages(rehearsalInput);
  const repeated = rehearseStages(rehearsalInput);
  assert.deepEqual(repeated, first);
  assert.deepEqual(first.finalStageIds, session.expectedFinalStageIds);

  const workflow = compiled.release.coreDesign.workflows.find(({ id: workflowId }) => workflowId === session.workflow.id);
  assert.ok(workflow, `missing Workflow ${session.workflow.id}`);
  let workflowState = null;
  for (const step of session.workflow.steps) {
    const result = resolveWorkflowTransition(workflow, workflowState, step.operationType, step.sessionRoleId, first.facts);
    assert.equal(result.allowed, true, `${id}: ${step.operationType} was denied`);
    workflowState = result.transition.to;
    assert.equal(workflowState, step.expectedState);
  }
  assert.equal(workflowState, session.workflow.expectedFinalState);
  const denied = resolveWorkflowTransition(
    workflow,
    session.workflow.denied.state,
    session.workflow.denied.operationType,
    session.workflow.denied.sessionRoleId,
    first.facts
  );
  assert.deepEqual(denied, { allowed: false, reason: session.workflow.denied.reason });

  const resource = {
    ...session.projection.resource,
    organizationId: session.tenantId,
    sessionId: session.sessionId
  };
  const context = (candidate) => ({
    organizationId: session.tenantId,
    sessionId: session.sessionId,
    organizationRoles: [],
    ...candidate
  });
  const authorized = projectResource(context(session.projection.authorizedContext), resource);
  const unauthorized = projectResource(context(session.projection.unauthorizedContext), resource);
  assert.deepEqual(Object.keys(authorized).sort(), [...session.projection.authorizedFields].sort());
  assert.deepEqual(Object.keys(unauthorized).sort(), [...session.projection.unauthorizedFields].sort());
  assert.throws(
    () => projectResource({ ...context(session.projection.authorizedContext), organizationId: "70000000-0000-4000-8000-000000009999" }, resource),
    (error) => error instanceof PolicyDeniedError && error.code === "TARGET_NOT_FOUND"
  );

  const conditionalInjects = (compiled.release.scenario.injects ?? [])
    .filter(({ releaseMode, releaseGate }) => releaseMode === "gate" && releaseGate !== undefined);
  const gateFacts = initialFacts(compiled.release.scenario);
  const conditionalInjectIds = new Set();
  for (const entry of first.trace) {
    for (const change of entry.stateChanges) {
      const key = change.scopeReference === ""
        ? `state.${change.stateVariableId}`
        : `state.${change.stateVariableId}.team.${change.scopeReference}`;
      gateFacts[key] = change.newValue;
    }
    conditionalInjects.filter(({ releaseGate }) => evaluateGate(releaseGate, gateFacts).passed)
      .forEach(({ id: injectId }) => conditionalInjectIds.add(injectId));
  }
  return {
    source,
    validation,
    evidence: {
      id,
      releaseId: compiled.release.manifest.releaseId,
      tenantId: session.tenantId,
      packageDigest: compiled.packageDigest,
      seed: session.seed,
      startedAt: session.startedAt,
      traceDigest: traceDigest(first),
      finalStageIds: first.finalStageIds,
      finalWorkflowState: workflowState,
      conditionalInjectIds: [...conditionalInjectIds],
      protectedFieldOmissions: Object.keys(resource.fields).filter((field) => !(field in unauthorized)).sort(),
      status: "completed"
    }
  };
}

test("PS-430-T01/T02 two-simulation generalization gate", async () => {
  await rm(evidencePath, { force: true });
  const before = await runtimeSourceHash();
  const policy = await runValidationSimulation("policy-negotiation");
  const afterPolicy = await runtimeSourceHash();
  const crisis = await runValidationSimulation("crisis-response");
  const afterCrisis = await runtimeSourceHash();
  assert.equal(policy.evidence.status, "completed", "PS-430-T01 policy Session did not complete");
  assert.equal(crisis.evidence.status, "completed", "PS-430-T01 crisis Session did not complete");
  assert.deepEqual(crisis.evidence.conditionalInjectIds, ["conditional-sensor-alert"]);

  assert.equal(afterPolicy.digest, before.digest, "PS-430-T02 Runtime source changed after policy negotiation");
  assert.equal(afterCrisis.digest, before.digest, "PS-430-T02 Runtime source changed after crisis response");
  assert.notEqual(policy.evidence.packageDigest, crisis.evidence.packageDigest);
  assert.equal(policy.source.materialization.coreDesign.stateVariables?.length ?? 0, 0);
  assert.equal(crisis.source.materialization.coreDesign.stateVariables.length, 3);
  assert.equal(policy.source.materialization.coreDesign.communications.routes.length, 2);
  assert.equal(crisis.source.materialization.coreDesign.communications.routes.length, 0);

  const leaked = structuredClone(policy.source.materialization);
  leaked.coreDesign.communications.routes.find(({ id }) => id === "delegate-counterproposal").recipient = { public: true };
  const report = validateStudioDraft(leaked);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some(({ code }) => code === "information_policy.leakage"));

  const evidence = {
    contractId: "validation-simulation-v1",
    generatedAt: new Date().toISOString(),
    runtimeBuild: {
      nodeVersion: process.version,
      sourceHash: before.digest,
      sourceFileCount: before.fileCount,
      schemaVersion: SIMULATION_SCHEMA_VERSION,
      compilerVersion: RELEASE_COMPILER_VERSION
    },
    sourceHashes: {
      before: before.digest,
      afterPolicyNegotiation: afterPolicy.digest,
      afterCrisisResponse: afterCrisis.digest
    },
    sourceUnchanged: true,
    configurationOnly: true,
    simulations: [policy.evidence, crisis.evidence],
    nondeterministicAdapterExclusions: ["external-network", "media", "model", "plugin"],
    semanticGaps: ["OPEN-004 was resolved by Decision Register v1.0.16; this fixture-level test does not prove UI concept activation or target-user acceptance."],
    clientMutationState: "not_applicable_no_client_mutation",
    testIds: ["PS-430-T01", "PS-430-T02"]
  };
  const schema = await readJson("tests/e2e/generalization/validation-simulation-v1.schema.json");
  const validateEvidence = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validateEvidence(evidence), true, JSON.stringify(validateEvidence.errors, null, 2));
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
});
