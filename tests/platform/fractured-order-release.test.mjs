import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compileRelease } from "../../packages/release-compiler/dist/index.js";
import { assertRuntimeCoreDesign, validateRuntimeFormPayload, resolveTeamCellFieldOptions } from "../../packages/simulation-schema/dist/index.js";
import { hydrateReleaseSourceAssets } from "../../scripts/release-source-assets.mjs";

const sourceUrl = new URL("../../definitions/fractured-order/fractured-order-release-source.json", import.meta.url);
const authoringSource = JSON.parse(await readFile(sourceUrl, "utf8"));
const source = await hydrateReleaseSourceAssets(authoringSource, sourceUrl);
const compiledArtifact = await readFile(
  new URL("../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"
);

test("PS-830-T08 added cells replace stale compiled choices only under their Governing Release", () => {
  const original = JSON.parse(compiledArtifact).coreDesign;
  const form = original.forms.find(({ id }) => id === "form-industry-orientation");
  const field = form.sections[0].fields[0];
  const snapshot = structuredClone(field);
  const energy = { id: "synthetic-energy", teamId: "industry", kind: "industry_sector", name: "Energy", enabled: true };
  const cells = [...original.teamCells, energy, { ...energy, id: "disabled", enabled: false },
    { ...energy, id: "other-team", teamId: "blue" }, { ...energy, id: "other-kind", kind: "department" }];
  const oldField = resolveTeamCellFieldOptions(field, original.teamCells);
  const newField = resolveTeamCellFieldOptions(field, cells);
  const definition = (resolved) => ({ ...form, sections: [{ ...form.sections[0], fields: [resolved] }] });
  assert.equal(validateRuntimeFormPayload(definition(newField), { industryCellId: energy.id }).length, 0);
  assert.ok(validateRuntimeFormPayload(definition(oldField), { industryCellId: energy.id }).length > 0);
  assert.deepEqual(newField.options.map(({ value }) => value), [...oldField.options.map(({ value }) => value), energy.id]);
  assert.deepEqual(field, snapshot);
  const staticField = { ...field, optionSource: undefined };
  assert.equal(resolveTeamCellFieldOptions(staticField, cells), staticField);
});

test("PS-830-T08 Stage coverage requirements reject fractional and unsupported completion rules", () => {
  const { coreDesign, scenario } = source.materialization;
  for (const minimumPerScope of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const core = structuredClone(coreDesign);
    core.stages[0].completionRequirements[0].minimumPerScope = minimumPerScope;
    assert.throws(() => assertRuntimeCoreDesign(core), /positive whole-number minimum/u);
  }
  for (const [key, value] of [["kind", "anything"], ["qualifyingMilestone", "draft_saved"]]) {
    const core = structuredClone(coreDesign);
    core.stages[0].completionRequirements[0][key] = value;
    assert.throws(() => assertRuntimeCoreDesign(core), /supported coverage semantics/u);
  }
  assert.doesNotThrow(() => assertRuntimeCoreDesign(coreDesign));
});

test("PS-200-T01 compiles the complete Fractured Order Runtime configuration", () => {
  const compiled = compileRelease(source);
  assert.equal(compiledArtifact, new TextDecoder().decode(compiled.bytes));
  assert.equal(compiled.release.coreDesign.teams.length, 4);
  assert.equal(compiled.release.coreDesign.stages.length, 16);
  assert.deepEqual(compiled.release.coreDesign.artifactTypes.map(({ id }) => id), [
    "blue-strategic-orientation", "red-strategic-orientation", "green-strategic-orientation",
    "industry-strategic-plan", "blue-action", "red-move-response", "green-proposal",
    "industry-turn-sheet", "rfi", "note", "team-dynamics", "alliance-tracking"
  ]);
  assert.equal(compiled.release.coreDesign.seats.length, 13);
  assert.equal(compiled.release.coreDesign.identity.developer, "Statecraft Simulation Group");
  assert.equal(compiled.release.coreDesign.identity.developerLogoResourceId, "statecraft-simulation-group-logo");
  assert.equal(compiled.release.coreDesign.terminology.customLabels.sessionOperator, "Game Master");
  assert.equal(compiled.release.coreDesign.presentation.login.imageResourceId, "fractured-order-login-poster");
  assert.match(compiled.release.coreDesign.resources[0].dataUri, /^data:image\/png;base64,/);
  assert.match(compiled.release.coreDesign.resources.find(({ id }) => id === "statecraft-simulation-group-logo").dataUri, /^data:image\/png;base64,/);
  assert.match(compiled.release.coreDesign.resources.find(({ id }) => id === "fractured-order-session-deck").dataUri, /^data:text\/html;base64,/);
  assert.equal(authoringSource.materialization.coreDesign.resources[0].contentDigest,
    "da8ceecbd6ca51fb51c4fd06438ef06138da341bb2fe3a4500d482eb0d121e81");
  for (const team of ["blue", "red", "green", "industry"]) {
    assert.equal(compiled.release.coreDesign.seats.find(({ id }) => id === `${team}-scribe`).maxOccupancy, null);
    assert.equal(compiled.release.coreDesign.seats.find(({ id }) => id === `${team}-facilitator`).maxOccupancy, null);
  }
  const role = (id) => compiled.release.coreDesign.sessionRoles.find((candidate) => candidate.id === id);
  assert.match(role("scribe").description, /submit them into Team Facilitator custody/);
  assert.ok(role("facilitator").capabilities.some(({ capability }) => capability === "proposal.respond"));
  assert.match(role("white_cell").description, /separately approves every proposal recipient/);
  assert.deepEqual(compiled.release.coreDesign.artifactTypes.find(({ id }) => id === "blue-action").allowedTeamIds, ["blue"]);
  for (const id of ["green-proposal", "industry-turn-sheet"]) {
    const artifactType = compiled.release.coreDesign.artifactTypes.find((candidate) => candidate.id === id);
    assert.equal(artifactType.workflowId, "workflow-proposal");
    assert.equal(artifactType.informationPolicyId, "policy-proposal");
  }
  assert.deepEqual(compiled.release.coreDesign.informationPolicies.find(({ id }) => id === "policy-team-workflow").grants,
    [{ audience: { ownerTeam: true, sessionRoleIds: ["scribe", "facilitator", "notetaker"] } }, { audience: { includeControlRoles: true } }]);
  assert.equal(compiled.release.coreDesign.communications.messageChannels.length, 6);
  const proposalProtocol = compiled.release.coreDesign.communications.messageChannels
    .find(({ id }) => id === "proposal-thread").threadProtocol;
  assert.equal(proposalProtocol.isolation, "one_thread_per_recipient");
  assert.equal(proposalProtocol.appendOnly, true);
  assert.equal(proposalProtocol.approvalRequiredForEveryMessage, true);
  assert.deepEqual(proposalProtocol.actions.map(({ command }) => command), [
    "message.proposal_forward", "message.proposal_accept", "message.proposal_reject",
    "message.proposal_negotiate", "message.proposal_reply", "message.proposal_approve_round",
    "message.proposal_close_source", "message.proposal_close_recipient"
  ]);
  assert.deepEqual(Object.fromEntries(proposalProtocol.actions.filter(({ routeId }) => routeId !== undefined)
    .map(({ command, routeId, approvalRouteId }) => [command, { routeId, approvalRouteId }])), {
    "message.proposal_forward": { routeId: "proposal-control-to-recipient", approvalRouteId: undefined },
    "message.proposal_accept": { routeId: "proposal-recipient-to-control", approvalRouteId: "proposal-control-to-source" },
    "message.proposal_reject": { routeId: "proposal-recipient-to-control", approvalRouteId: "proposal-control-to-source" },
    "message.proposal_negotiate": { routeId: "proposal-recipient-to-control", approvalRouteId: "proposal-control-to-source" },
    "message.proposal_reply": { routeId: "proposal-source-to-control", approvalRouteId: "proposal-control-to-recipient" },
    "message.proposal_close_source": { routeId: "proposal-source-to-control", approvalRouteId: "proposal-control-to-recipient" },
    "message.proposal_close_recipient": { routeId: "proposal-recipient-to-control", approvalRouteId: "proposal-control-to-source" }
  });
  const interfaceModules = Object.fromEntries(compiled.release.coreDesign.interfaces.map((profile) => [profile.id,
    profile.layout.regions.flatMap(({ modules }) => modules.map(({ moduleType }) => moduleType))]));
  assert.ok(interfaceModules["participant-author"].includes("message_inbox"));
  assert.ok(interfaceModules["participant-author"].includes("inject_inbox"));
  assert.ok(interfaceModules["participant-review"].includes("proposal_thread"));
  assert.ok(interfaceModules.control.includes("message_inbox"));
  assert.ok(interfaceModules.control.includes("proposal_thread"));
  assert.ok(interfaceModules.control.includes("inject_inbox"));
  assert.equal(compiled.release.scenario.injects.length, 1);
});

test("PS-200-T01 configures Game Master readiness and evidence access without a Session Role or Seat", () => {
  const core = source.materialization.coreDesign;
  assert.equal(core.terminology.customLabels.sessionOperator, "Game Master");
  assert.equal(core.sessionRoles.some(({ id, name }) => id === "game_master" || name === "Game Master"), false);
  assert.equal(core.seats.some(({ id, name }) => id === "game-master" || name === "Game Master"), false);
  assert.deepEqual(core.accessPolicy.readiness.map(({ key }) => key), [
    "release_version", "industry_configuration", "seat_assignments", "permissions", "timers", "injects",
    "adjudication", "plugins", "exports", "connectivity", "recovery"
  ]);
  assert.ok(core.accessPolicy.readiness.every(({ blocking }) => blocking === true));
  assert.deepEqual(core.reports.find(({ id }) => id === "after-action-report").availableToOrganizationRoles, ["Operator"]);
  assert.deepEqual(core.pluginBindings, []);
  assert.match(authoringSource.releaseNotes, /Intercom and Session Recorder remain unbound/);
});

test("PS-200-T03 rejects invalid report roles and incomplete readiness definitions", async () => {
  const invalidRole = structuredClone(authoringSource);
  invalidRole.materialization.coreDesign.reports[0].availableToOrganizationRoles = ["Game Master"];
  await assert.rejects(
    async () => compileRelease(await hydrateReleaseSourceAssets(invalidRole, sourceUrl)),
    /invalid Organization Role/
  );

  const invalidReadiness = structuredClone(authoringSource);
  invalidReadiness.materialization.coreDesign.accessPolicy.readiness[0].label = "";
  await assert.rejects(
    async () => compileRelease(await hydrateReleaseSourceAssets(invalidReadiness, sourceUrl)),
    /Readiness check release_version is incomplete/
  );
});

test("PS-200-T01 gives every configured Industry its own complete modal contracts", async () => {
  const forms = authoringSource.materialization.coreDesign.forms;
  const plan = forms.find(({ id }) => id === "form-industry-orientation");
  const industryPlan = { fields: plan.sections.flatMap(section => section.fields), repeatable: undefined };
  assert.equal(plan.sections.some(section => section.repeatable), false);
  assert.equal(industryPlan.repeatable, undefined);
  assert.equal(plan.presentation.mode, "modal_per_scope");
  assert.ok(industryPlan.fields.length >= 35);
  for (const key of [
    "businessOverview", "risks.2.tiedCell", "partners.2.likelyWant",
    "firstAmbassadorTarget.reason", "strategicPriorities.2.successLooksLike", "strategicStance", "redLine"
  ]) assert.ok(industryPlan.fields.some((field) => field.key === key), `missing Industry plan field ${key}`);

  const scopeField = industryPlan.fields.find(({ key }) => key === "industryCellId");
  assert.deepEqual(scopeField.optionSource, { kind: "team_cells", teamId: "industry", cellKind: "industry_sector" });
  assert.deepEqual(source.materialization.coreDesign.forms.find(({ id }) => id === plan.id)
    .sections.flatMap(section => section.fields).find(({ key }) => key === "industryCellId").options.map(({ label }) => label),
  ["Agriculture", "Telecommunications", "Biotechnology"]);

  const turn = forms.find(({ id }) => id === "form-industry-turn-sheet");
  const keys = new Set(turn.sections.flatMap(({ fields }) => fields.map(({ key }) => key)));
  assert.ok(keys.size >= 100);
  for (const key of [
    "environment.actors.red_china.actionCodes", "supplyChain.stages.end_market_customers.plannedActions",
    "decision.coordinatedSectors",
    "decision.stakeholderValue.counterparty.giveUpOrRisk", "expectedEffects.capacitySupplySecurity.pattern",
    "risks.2.movementStatus", "otherSectorSpillover.entries.2.explanation",
    "nextMoveForecasts.green_europe.explanation", "positionChangeTrigger"
  ]) assert.ok(keys.has(key), `missing Industry turn-sheet field ${key}`);
  assert.ok(keys.has("industryCellId"));

  const expanded = structuredClone(authoringSource);
  expanded.materialization.coreDesign.teamCells.push({
    id: "industry-energy", teamId: "industry", kind: "industry_sector", name: "Energy", enabled: true
  });
  const expandedRelease = compileRelease(await hydrateReleaseSourceAssets(expanded, sourceUrl)).release;
  const expandedOptions = expandedRelease.coreDesign.forms.find(({ id }) => id === "form-industry-turn-sheet")
    .sections.flatMap(({ fields }) => fields).find(({ key }) => key === "industryCellId").options;
  assert.ok(expandedOptions.some(({ value, label }) => value === "industry-energy" && label === "Energy"));
});

test("PS-200-T03 validates each scoped Industry Strategic Orientation", () => {
  const form = source.materialization.coreDesign.forms.find(({ id }) => id === "form-industry-orientation");
  const issues = validateRuntimeFormPayload(form, {
    blueForecast: "pressure"
  });
  assert.ok(issues.some(({ field }) => field === "industryCellId"));
  assert.ok(issues.some(({ field }) => field === "risks.0.type"));
  assert.ok(issues.some(({ field }) => field === "redLine"));
  assert.equal(issues.some(({ field }) => field === "businessOverview"), false, "Legacy business context is optional in the reference form");
});

test("PS-410 makes Facilitator-owned Action revision/resubmission and accepted-proposal evidence explicit", () => {
  const core = source.materialization.coreDesign;
  const workflow = core.workflows.find(({ id }) => id === "workflow-action");
  assert.deepEqual(workflow.custodyChain, ["scribe", "facilitator", "white_cell"]);
  assert.ok(workflow.transitions.some(({ from, command, to, allowedSessionRoleIds }) => from === "with_facilitator" &&
    command === "artifact.edit" && to === "with_facilitator" && allowedSessionRoleIds.includes("facilitator")));
  assert.ok(workflow.transitions.some(({ from, command, to, allowedSessionRoleIds }) => from === "returned" &&
    command === "artifact.edit" && to === "returned" && allowedSessionRoleIds.includes("facilitator")));
  assert.ok(workflow.transitions.some(({ from, command, to, allowedSessionRoleIds }) => from === "returned" &&
    command === "artifact.submit" && to === "with_white_cell" && allowedSessionRoleIds.includes("facilitator")));
  for (const id of ["blue-action", "red-move-response"]) {
    const type = core.artifactTypes.find((candidate) => candidate.id === id);
    assert.equal(type.workflowId, "workflow-action");
    assert.equal(type.evidenceLinks[0].requiredOutcome, "accepted_terms");
    const field = core.forms.find(({ id: formId }) => formId === type.formId).sections
      .flatMap(({ fields }) => fields).find(({ key }) => key === "engagement.acceptedProposalIds");
    assert.equal(field.type, "artifact_reference");
    assert.equal(field.reference.relationship, "active_team_is_recipient");
  }
  const outcome = core.communications.messageChannels.find(({ id }) => id === "proposal-thread").threadProtocol.acceptanceOutcome;
  assert.deepEqual(outcome.eligibleActionArtifactTypeByRecipientTeam, { blue: "blue-action", red: "red-move-response" });
});

test("PS-200-T01 declares progression requirements for every enabled Industry cell", () => {
  const stages = source.materialization.coreDesign.stages;
  const orientation = stages.find(({ id }) => id === "orientation").completionRequirements[0];
  assert.equal(orientation.artifactTypeId, "industry-strategic-plan");
  assert.equal(orientation.minimumPerScope, 1);
  assert.equal(orientation.qualifyingMilestone, "submitted_to_control");
  for (const move of [1, 2, 3]) {
    const requirement = stages.find(({ id }) => id === `m${move}-results`).completionRequirements[0];
    assert.equal(requirement.artifactTypeId, "industry-turn-sheet");
    assert.equal(requirement.stageGroupId, `move-${move}`);
    assert.equal(requirement.minimumPerScope, 1);
  }
});

test("PS-200-T01 defines an accessible Facilitator present mode for artifacts and the session deck", () => {
  const core = source.materialization.coreDesign;
  const profile = core.interfaces.find(({ id }) => id === "participant-review");
  const modules = profile.layout.regions.flatMap(({ modules }) => modules);
  const present = modules.find(({ id }) => id === "artifact-presentation").configuration;
  assert.equal(present.source, "artifacts_received_from_same_team_scribes");
  assert.deepEqual(present.presentationMode.keyboard.exit, ["Escape"]);
  assert.equal(present.presentationMode.restoreFocusOnExit, true);
  assert.equal(present.presentationMode.reducedMotion, "respect_user_preference");
  assert.equal(modules.find(({ id }) => id === "session-slide-deck").configuration.releaseResourceId, "fractured-order-session-deck");
  assert.deepEqual(core.presentation.branding.placements, ["login", "session_header", "facilitator_present_mode"]);
});

test("PARITY-SCENARIO-01 packages hashed scenario media for only its configured surface", () => {
  const core = source.materialization.coreDesign;
  const deck = core.resources.find(({ id }) => id === "fractured-order-session-deck");
  assert.match(deck.contentDigest, /^[0-9a-f]{64}$/u);
  assert.match(deck.dataUri, /^data:text\/html;base64,/u);
  const modules = (profile) => profile.layout.regions.flatMap(({ modules: items }) => items);
  assert.equal(modules(core.interfaces.find(({ id }) => id === "participant-review"))
    .some(({ configuration }) => configuration.releaseResourceId === deck.id), true);
  assert.equal(modules(core.interfaces.find(({ id }) => id === "participant-author"))
    .some(({ configuration }) => configuration.releaseResourceId === deck.id), false);
  const missing = structuredClone(source);
  missing.materialization.coreDesign.resources = missing.materialization.coreDesign.resources.filter(({ id }) => id !== deck.id);
  assert.throws(() => compileRelease(missing), /missing identifier|missing Resource/u);
  assert.equal(JSON.stringify(compileRelease(source).release.coreDesign.resources).includes("https://"), false);
  assert.equal(modules(core.interfaces.find(({ id }) => id === "control"))
    .some(({ configuration }) => configuration.releaseResourceId === deck.id), true);
});

test("ROLE-RESOURCE-01 validates governed role resource libraries", () => {
  const configured = structuredClone(source);
  const author = configured.materialization.coreDesign.interfaces.find(({ id }) => id === "participant-author");
  author.layout.regions[0].modules.push({
    id: "author-role-resources",
    moduleType: "resource_library",
    title: "Role resources",
    configuration: {
      mode: "read",
      emptyStateText: "No role resources are available.",
      resourceIds: ["fractured-order-session-deck"]
    }
  });
  assert.doesNotThrow(() => compileRelease(configured));

  const missingSelection = structuredClone(configured);
  missingSelection.materialization.coreDesign.interfaces.find(({ id }) => id === "participant-author")
    .layout.regions[0].modules.find(({ id }) => id === "author-role-resources").configuration.resourceIds = [];
  assert.throws(() => compileRelease(missingSelection), /no valid role Resources/u);

  const missingResource = structuredClone(configured);
  missingResource.materialization.coreDesign.interfaces.find(({ id }) => id === "participant-author")
    .layout.regions[0].modules.find(({ id }) => id === "author-role-resources").configuration.resourceIds = ["missing-resource"];
  assert.throws(() => compileRelease(missingResource), /missing identifier|missing Resource/u);
});

test("PS-200-T01 preserves the reference RFI category contract", () => {
  const form = authoringSource.materialization.coreDesign.forms.find(({ id }) => id === "form-rfi");
  const categories = form.sections.flatMap(({ fields }) => fields).find(({ key }) => key === "categories");
  assert.equal(categories.type, "multi_select");
  assert.equal(categories.validation.minItems, 1);
  assert.deepEqual(categories.options.map(({ value }) => value), [
    "Economic Impact", "Political Feasibility", "Alliance Response", "Implementation Timeline",
    "Resource Requirements", "Legal Considerations", "Historical Precedent", "Other"
  ]);
});

test("PS-200-T03 enforces conditional choices and bounded artifact fields", () => {
  const form = source.materialization.coreDesign.forms.find(({ id }) => id === "form-blue-action");
  const issues = validateRuntimeFormPayload(form, {
    title: "Supply resilience", goal: "Protect capacity", objective: "Reduce dependency",
    instruments: ["economic"], levers: ["not-a-choice"], sectors: ["agriculture"],
    supplyChainFocusDecision: "yes", implementationPath: "legislative", legislativeVehicle: ["not-a-route"], focusCountries: ["EU"],
    coordinatedDecision: "no", informedEngagedDecision: ["allies"], expectedOutcomes: "More resilience"
  });
  assert.ok(issues.some(({ field }) => field === "levers"));
  assert.ok(issues.some(({ field }) => field === "supplyChainAngles"));
  assert.ok(issues.some(({ field }) => field === "legislativeVehicle"));
});

test("AC-04/AC-05/AC-06 Team, Session Role, Stage and Form changes require data edits only", () => {
  const changed = structuredClone(source);
  changed.materialization.coreDesign.teams[0].name = "Renamed team";
  changed.materialization.coreDesign.sessionRoles[0].name = "Renamed role";
  changed.materialization.coreDesign.stages.at(-1).transitions.push({
    id: "epilogue-next", targetStageId: "epilogue", mode: "manual"
  });
  changed.materialization.coreDesign.stages.push({
    id: "epilogue", name: "Epilogue", stageType: "brief", order: 99, timerMode: "none", allowedActivityIds: [], transitions: [],
    operatorControls: { allowStart: true, allowEnd: true, allowReopen: false, allowExtend: false, allowSkip: false, allowReturnToPrevious: false, requireReason: true }
  });
  changed.materialization.coreDesign.forms[0].sections[0].fields.push({
    id: "decision", key: "decision", label: "Decision", type: "short_text", required: false
  });
  const compiled = compileRelease(changed);
  assert.equal(compiled.release.coreDesign.teams[0].name, "Renamed team");
  assert.equal(compiled.release.coreDesign.sessionRoles[0].name, "Renamed role");
  assert.equal(compiled.release.coreDesign.stages.at(-1).id, "epilogue");
  assert.equal(compiled.release.coreDesign.forms[0].sections[0].fields.at(-1).key, "decision");
});

test("PS-200-T01 rejects a missing Release reference", () => {
  const invalid = structuredClone(source);
  invalid.materialization.coreDesign.artifactTypes[0].formId = "missing";
  assert.throws(() => compileRelease(invalid), /missing identifier|not used/);
});

test("PS-210-T01 rejects ungoverned routes and empty default-deny selectors", () => {
  const missingPolicy = structuredClone(source);
  delete missingPolicy.materialization.coreDesign.communications.routes[0].informationPolicyId;
  assert.throws(() => compileRelease(missingPolicy), /Communication Route .* has no Information Policy/);

  const emptyRecipient = structuredClone(source);
  emptyRecipient.materialization.coreDesign.communications.routes[0].recipient = {};
  assert.throws(() => compileRelease(emptyRecipient), /empty default-deny selector/);
});

test("PS-210-T03 rejects broken Inject content, Stage and response references", () => {
  const missingContent = structuredClone(source);
  missingContent.materialization.scenario.injects[0].contentId = "missing";
  assert.throws(() => compileRelease(missingContent), /references missing content/);

  const missingStage = structuredClone(source);
  missingStage.materialization.scenario.injects[0].stageId = "missing";
  assert.throws(() => compileRelease(missingStage), /references a missing Stage/);

  const missingResponse = structuredClone(source);
  missingResponse.materialization.scenario.injects[0].requiredResponseArtifactTypeId = "missing";
  assert.throws(() => compileRelease(missingResponse), /references missing response Artifact Type/);

  const scheduled = structuredClone(source);
  Object.assign(scheduled.materialization.scenario.injects[0], { releaseMode: "scheduled", scheduledOffsetSeconds: 30 });
  assert.doesNotThrow(() => compileRelease(scheduled));
  for (const offset of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    scheduled.materialization.scenario.injects[0].scheduledOffsetSeconds = offset;
    assert.throws(() => compileRelease(scheduled), /invalid scheduled offset/);
  }

  const malformedGate = structuredClone(source);
  Object.assign(malformedGate.materialization.scenario.injects[0], { releaseMode: "gate", releaseGate: { condition: "unspecified" } });
  assert.throws(() => compileRelease(malformedGate), /bounded Gate contract/);
});

test("PS-210-T01 rejects proposal actions without explicit valid Routes", () => {
  const missingRoute = structuredClone(source);
  delete missingRoute.materialization.coreDesign.communications.messageChannels[0].threadProtocol.actions[0].routeId;
  assert.throws(() => compileRelease(missingRoute), /has no Route/);

  const missingApprovalRoute = structuredClone(source);
  delete missingApprovalRoute.materialization.coreDesign.communications.messageChannels[0].threadProtocol.actions[1].approvalRouteId;
  assert.throws(() => compileRelease(missingApprovalRoute), /has no approval Route/);
});
