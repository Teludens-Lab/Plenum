import { createHash } from "node:crypto";

import {
  canonicalizeJson,
  type JsonObject,
  type JsonValue,
  type StudioValidationIssueV1,
  type StudioValidationReportV1
} from "@plenum/event-contracts";
import {
  assertRuntimeCoreDesign,
  assertRuntimeScenario,
  type CoreDesignV1,
  type ScenarioV1
} from "@plenum/simulation-schema";

export interface StudioMaterialization {
  coreDesign: CoreDesignV1;
  scenario: ScenarioV1;
}

export class StudioValidationError extends Error {
  constructor(readonly report: StudioValidationReportV1) {
    super("The Draft has validation errors.");
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceFor(message: string): { path: string; elementId: string | null } {
  const match = message.match(/^(Workflow|Stage|Form|Artifact Type|Information Policy|Interface Profile|Communication Route|Message Channel|Voice Channel|Poll|Inject|Report|Seat|Team Cell|Scenario content|Readiness check) ([^ ]+)/u);
  if (match === null) return { path: "coreDesign", elementId: null };
  const collections: Record<string, string> = {
    "Workflow": "workflows", "Stage": "stages", "Form": "forms", "Artifact Type": "artifactTypes",
    "Information Policy": "informationPolicies", "Interface Profile": "interfaceProfiles",
    "Communication Route": "communications.routes", "Message Channel": "communications.messageChannels",
    "Voice Channel": "communications.voiceChannels", "Poll": "polls", "Inject": "scenario.injects",
    "Report": "reports", "Seat": "seats", "Team Cell": "teams", "Scenario content": "scenario.content",
    "Readiness check": "readinessChecks"
  };
  const label = match[1] ?? "";
  const elementId = match[2] ?? null;
  const prefix = collections[label] ?? "coreDesign";
  return { path: `${prefix}.${elementId ?? ""}`, elementId };
}

function issue(code: string, message: string, path: string, elementId: string | null): StudioValidationIssueV1 {
  return { code, severity: "error", message, path, elementId };
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(record) : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function selectorAllowsRole(selector: unknown, sessionRoleId: string, isControlRole: boolean): boolean {
  if (!record(selector)) return false;
  return selector.public === true || (selector.includeControlRoles === true && isControlRole) || stringList(selector.sessionRoleIds).includes(sessionRoleId);
}

function hasAutomaticCycle(stages: Array<Record<string, unknown>>): boolean {
  const edges = new Map(stages.map((stage) => [String(stage.id), records(stage.transitions)
    .filter((transition) => transition.mode === "automatic")
    .map((transition) => String(transition.targetStageId))]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((edges.get(id) ?? []).some(visit)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...edges.keys()].some(visit);
}

function catalogIssues(materialization: StudioMaterialization): StudioValidationIssueV1[] {
  const core = materialization.coreDesign as Record<string, unknown>;
  const scenario = materialization.scenario as unknown as Record<string, unknown>;
  const issues: StudioValidationIssueV1[] = [];
  const stages = records(core.stages);
  stages.slice(0, -1).filter((stage) => records(stage.transitions).length === 0).forEach((stage) => {
    issues.push(issue("stage.no_exit", `Stage ${String(stage.id)} has no exit. Add a next Stage or make it the final Stage.`, `stages.${String(stage.id)}`, String(stage.id)));
  });
  if (hasAutomaticCycle(stages)) {
    issues.push(issue("stage.automatic_cycle", "Automatic Stage transitions form a circular path. Change at least one transition to manual.", "stages", null));
  }
  for (const workflow of records(core.workflows)) {
    for (const state of records(workflow.states)) {
      if (!["task", "review", "approval"].includes(String(state.kind))) continue;
      if (state.holderRelation !== "creator" && stringList(state.holderSessionRoleIds).length === 0) {
        const id = String(workflow.id);
        issues.push(issue(state.kind === "approval" ? "workflow.approver_required" : "workflow.task_unassigned",
          `Workflow ${id} state ${String(state.key)} needs an eligible Session Role or the creator as holder.`, `workflows.${id}`, id));
      }
    }
  }
  const concepts = records(core.methodologyConcepts);
  const conceptCollections: Record<string, string> = {
    Team: "teams", "Decision Record": "decisionTraceability", Inject: "injects", Communication: "communications",
    "Research Question": "researchQuestions"
  };
  for (const concept of concepts.filter((item) => item.enabled === false)) {
    const collection = conceptCollections[String(concept.label)];
    const referenced = collection === "injects" ? records(scenario.injects).length > 0 :
      collection === "communications" ? records((core.communications as Record<string, unknown> | undefined)?.routes).length > 0 :
        collection !== undefined && records(core[collection]).length > 0;
    if (referenced) issues.push(issue("methodology.disabled_dependency",
      `${String(concept.label)} is disabled but enabled design elements still depend on it. Re-enable the concept or remove those dependencies.`,
      `methodologyConcepts.${String(concept.key)}`, String(concept.key)));
  }
  const policies = records(core.informationPolicies);
  const policyById = new Map(policies.map((policy) => [String(policy.id), policy]));
  const roleControlById = new Map(records(core.sessionRoles).map((role) => [String(role.id), role.isControlRole === true]));
  for (const route of records((core.communications as Record<string, unknown> | undefined)?.routes)) {
    const policy = policyById.get(String(route.informationPolicyId));
    const recipients = record(route.recipient) ? route.recipient : {};
    const grants = records(policy?.grants);
    const recipientRoles = stringList(recipients.sessionRoleIds);
    const exposed = recipients.public === true
      ? !grants.some((grant) => record(grant.audience) && grant.audience.public === true)
      : recipientRoles.some((role) => !grants.some((grant) => selectorAllowsRole(grant.audience, role, roleControlById.get(role) === true)));
    if (exposed) {
      const id = String(route.id);
      issues.push(issue("information_policy.leakage", `Communication Route ${id} can deliver information outside its Information Policy.`, `communications.routes.${id}`, id));
    }
  }
  for (const profile of records(core.interfaces)) {
    const roles = stringList((profile.selectors as Record<string, unknown> | undefined)?.sessionRoleIds);
    const modules = records((profile.layout as Record<string, unknown> | undefined)?.regions)
      .flatMap((region) => records(region.modules));
    for (const module of modules) {
      const policyId = (module.configuration as Record<string, unknown> | undefined)?.informationPolicyId;
      if (typeof policyId !== "string") continue;
      const grants = records(policyById.get(policyId)?.grants);
      if (roles.some((role) => !grants.some((grant) => selectorAllowsRole(grant.audience, role, roleControlById.get(role) === true)))) {
        const id = String(profile.id);
        issues.push(issue("interface.policy_inaccessible", `Interface Profile ${id} includes a module its Session Role cannot access.`, `interfaces.${id}`, id));
      }
    }
  }
  const stateVariables = new Set(records(core.stateVariables).map((item) => String(item.id)));
  for (const inject of records(scenario.injects)) {
    for (const effect of records(inject.effects)) {
      if (typeof effect.targetStateVariableId === "string" && !stateVariables.has(effect.targetStateVariableId)) {
        const id = String(inject.id);
        issues.push(issue("effect.reference_missing", `Inject ${id} has an effect that references a missing State Variable.`, `scenario.injects.${id}`, id));
      }
    }
  }
  const reportSources = new Set(["evidence", "artifacts", "state", "polls", "messages", "voice", "plugins"]);
  for (const report of records(core.reports)) {
    for (const section of records(report.sections)) {
      if (typeof section.source === "string" && !reportSources.has(section.source)) {
        const id = String(report.id);
        issues.push(issue("report.data_unavailable", `Report ${id} references unavailable data source ${section.source}.`, `reports.${id}`, id));
      }
    }
  }
  for (const poll of records(core.polls)) {
    const id = String(poll.id);
    const threshold = record(poll.thresholdRule) ? poll.thresholdRule : {};
    if (typeof threshold.denominator !== "string" || typeof poll.tieRule !== "string" ||
        typeof threshold.abstentionCountsTowardDenominator !== "boolean") {
      issues.push(issue("poll.counting_rule_incomplete", `Poll ${id} must explicitly define its denominator, abstention treatment and tie rule.`, `polls.${id}`, id));
    }
    if (poll.secrecy === "secret_ballot") {
      issues.push(issue("poll.secret_ballot_policy_pending", `Poll ${id} uses secret ballot, which remains blocked for production by OPEN-028.`, `polls.${id}`, id));
    }
    if (poll.secrecy === "anonymous_survey") {
      issues.push(issue("poll.anonymous_survey_unavailable", `Poll ${id} uses anonymous survey, which is not available in the first Runtime proof.`, `polls.${id}`, id));
    }
  }
  const adapters = new Map(records(core.platformAdapters).map((adapter) => [String(adapter.id), adapter]));
  for (const channel of records((core.communications as Record<string, unknown> | undefined)?.voiceChannels)) {
    const id = String(channel.id);
    if (channel.recordingPolicy !== "off" || channel.transcriptionPolicy !== "off") {
      issues.push(issue("voice.consent_policy_pending", `Voice Channel ${id} enables recording or transcription, which remains blocked for production by OPEN-027.`, `communications.voiceChannels.${id}`, id));
    }
    const adapter = adapters.get(String(channel.mediaProviderAdapterBindingId));
    const capabilities = records(adapter?.voiceCapabilities);
    const unsupported = capabilities.find((profile) => !stringList(profile.modes).includes(String(channel.mode)) ||
      (channel.recordingPolicy !== "off" && profile.recording !== true) ||
      (channel.transcriptionPolicy !== "off" && profile.transcription !== true));
    if (unsupported !== undefined) {
      issues.push(issue("voice.adapter_capability_missing",
        `Voice Channel ${id} is unsupported by its Media Provider Adapter in the ${String(unsupported.profile)} target profile.`,
        `communications.voiceChannels.${id}`, id));
    }
  }
  const disabledRoles = new Set(records(core.sessionRoles).filter((role) => role.enabled === false).map((role) => String(role.id)));
  for (const seat of records(core.seats)) {
    const role = stringList(seat.sessionRoleIds).find((id) => disabledRoles.has(id));
    if (role !== undefined) {
      const id = String(seat.id);
      issues.push(issue("permission.contradiction", `Seat ${id} assigns disabled Session Role ${role}.`, `seats.${id}`, id));
    }
  }
  if (Array.isArray(core.decisionTraceability)) {
    const traces = records(core.decisionTraceability);
    for (const artifact of records(core.artifactTypes).filter((item) => item.decisionBearing === true)) {
      if (!traces.some((trace) => trace.artifactTypeId === artifact.id)) {
        const id = String(artifact.id);
        issues.push(issue("research.traceability_missing", `Decision-bearing Artifact Type ${id} needs a decision traceability entry.`, `artifactTypes.${id}`, id));
      }
    }
  }
  return issues;
}

function digestReport(valid: boolean, issues: StudioValidationIssueV1[]): StudioValidationReportV1 {
  const payload = { contractId: "studio-validation-v1", valid, issues } as const;
  return {
    ...payload,
    reportDigest: createHash("sha256").update(canonicalizeJson(payload as unknown as JsonValue)).digest("hex")
  };
}

export function validateStudioDraft(value: unknown): StudioValidationReportV1 {
  if (!record(value)) return digestReport(false, [issue("draft.required", "The Draft materialization is missing.", "draft", null)]);
  if (!record(value.coreDesign) || !record(value.scenario)) {
    return digestReport(false, [issue("draft.structure", "The Draft needs both a Core Design and a Scenario.", "draft", null)]);
  }
  const materialization = value as unknown as StudioMaterialization;
  const issues: StudioValidationIssueV1[] = catalogIssues(materialization);
  try {
    assertRuntimeCoreDesign(materialization.coreDesign);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Core Design is invalid.";
    const source = sourceFor(message);
    issues.push(issue("core_design.invalid", message, source.path, source.elementId));
  }
  try {
    assertRuntimeScenario(materialization.coreDesign, materialization.scenario);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The Scenario is invalid.";
    const source = sourceFor(message);
    issues.push(issue("scenario.invalid", message, source.path.startsWith("coreDesign") ? "scenario" : source.path, source.elementId));
  }
  return digestReport(issues.length === 0, issues);
}

export function requireValidStudioDraft(value: unknown): StudioMaterialization {
  const report = validateStudioDraft(value);
  if (!report.valid) throw new StudioValidationError(report);
  return value as StudioMaterialization;
}

export function asJsonMaterialization(value: StudioMaterialization): JsonObject {
  return value as unknown as JsonObject;
}
