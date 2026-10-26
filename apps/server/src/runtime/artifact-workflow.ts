import {
  type CommandEnvelopeV1,
  type JsonObject,
  type JsonValue,
  type RuntimeActionV1,
  type RuntimeArtifactV1,
  type RuntimeCreateTaskV1,
  type RuntimeFormV1,
  type RuntimeModuleV1,
  type RuntimeProjectionV1,
  RUNTIME_PROJECTION_CONTRACT_ID
} from "@plenum/event-contracts";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { audienceAllows, type FieldAudience } from "@plenum/policy-engine";
import { runtimeFormValue, setRuntimeFormValue, validateRuntimeFormPayload, type AutomationActionV1, type GateV1,
  type RuntimeFieldConditionV1, type RuntimeFieldValidationV1, type RuntimeStageDefinitionV1,
  type StateVariableDefinitionV1 } from "@plenum/simulation-schema";
import { evaluateGate, nextStage, rehearseStages, remainingSeconds, resolveWorkflowTransition, type GateExplanationV1 } from "@plenum/workflow-engine";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import {
  resolveSessionAccessContext,
  type SessionAccessContextV1
} from "../identity/context.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { createCompositionRunExecutor, executeEffectProposalCommand, type ExtensionRunPlan } from "../extensions/runtime.js";
import { executeAdjudicationCommand } from "../adjudication/service.js";
import {
  processSessionCommand,
  type CommandDecision,
  type CommandExecutionContext
} from "./commands/processor.js";
import { executeInformationCommand, getInformationProjection, releaseGateInjects, releaseStageInjects } from "./information-flow.js";
import { applyCapabilityQuantityChange, applyDueStateValueChanges, applyResourceTransaction, applyStateValueChange,
  initializeWorldState, readWorldStateFacts, scheduleStateValueChange } from "./state/world-state.js";
import { executeVotingCommand, getPollProjection } from "../voting/polls.js";
import { createVoiceCommandExecutor, getVoiceProjection } from "../comms/voice.js";
import type { MediaProviderAdapter } from "@plenum/media-adapter";

interface RuntimeFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: "short_text" | "long_text" | "number" | "single_select" | "multi_select" | "artifact_reference";
  required: boolean;
  requiredWhen?: RuntimeFieldConditionV1;
  visibleWhen?: RuntimeFieldConditionV1;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  readOnly?: boolean;
  validation?: RuntimeFieldValidationV1;
}

interface RuntimeFormDefinition {
  id: string;
  name: string;
  formVersion: string;
  fields: RuntimeFieldDefinition[];
  sections: Array<{
    id: string; title?: string; description?: string; fields: RuntimeFieldDefinition[];
    repeatable?: boolean; itemLabel?: string; itemKeyField?: string; minItems?: number; maxItems?: number;
  }>;
  rules?: Array<{ kind: "distinct"; fields: string[]; message: string }>;
}

interface ArtifactTypeDefinition {
  id: string;
  key: string;
  name: string;
  formId: string;
  workflowId: string;
  informationPolicyId: string;
  allowedCreatorSessionRoleIds: string[];
  allowedTeamIds?: string[];
  availableStageIds?: string[];
  evidenceLinks?: Array<{
    field: string;
    sourceArtifactTypeIds: string[];
    requiredOutcome: "accepted_terms";
    eligibleSourceRelation: "active_team_is_recipient";
    required: boolean;
  }>;
}

interface WorkflowStateDefinition {
  key: string;
  label: string;
  kind: "draft" | "review" | "terminal";
  holderSessionRoleIds?: string[];
}

interface WorkflowTransitionDefinition {
  from: string | null;
  command: string;
  label?: string;
  to: string;
  allowedSessionRoleIds: string[];
  notifySessionRoleIds?: string[];
  contentOnly?: boolean;
  allowNonCreatorEdit?: boolean;
  editableFieldKeys?: string[];
  gate?: GateV1;
  actions?: AutomationActionV1[];
}

interface WorkflowDefinition {
  id: string;
  key: string;
  states: WorkflowStateDefinition[];
  transitions: WorkflowTransitionDefinition[];
}

export interface RuntimeInterfaceProjectionProfile {
  id: string;
  sessionRoleIds: string[];
  stageIds?: string[];
  layout: RuntimeProjectionV1["layout"];
  modules: RuntimeModuleV1[];
}

interface RuntimeDefinition {
  teams: Array<{ id: string; name: string }>;
  teamCells?: Array<{ id: string; teamId: string; kind: string; enabled: boolean }>;
  sessionRoles: Array<{ id: string; name: string; capabilities?: Array<{ capability: string }>; isControlRole?: boolean }>;
  seats: Array<{ id: string; sessionRoleIds: string[]; teamId?: string }>;
  informationPolicies: Array<{ id: string; grants: Array<{ audience: FieldAudience; fieldsExcluded?: string[] }> }>;
  stateVariables?: StateVariableDefinitionV1[];
  capabilities?: Array<{ id: string; informationPolicyId: string; initialState: string; mode?: "boolean" | "counted";
    initialQuantity?: number; maximumQuantity?: number; renewal?: { everyStageType: string; amount: number } }>;
  resourceDefinitions?: Array<{ id: string; informationPolicyId: string; replenishment?: { everyStageType?: string; amount: number } }>;
  stages: Array<{
    id: string; label: string; name?: string; stageType?: string; durationSeconds?: number; timerMode?: "countdown" | "countup" | "none";
    entryGate?: GateV1;
    completionGate?: GateV1;
    transitionMode?: "exclusive" | "parallel";
    parallelJoinStageId?: string;
    joinMode?: "all" | "first";
    transitions?: Array<{ id: string; targetStageId: string; mode: "automatic" | "manual" | "automatic_or_manual"; gate?: GateV1; priority?: number }>;
    onEnter?: AutomationActionV1[];
    onExit?: AutomationActionV1[];
    allowedActivityIds?: string[];
    operatorControls?: { allowStart: boolean; allowEnd: boolean; allowReopen: boolean; allowExtend: boolean; allowSkip: boolean; allowReturnToPrevious: boolean; requireReason: boolean };
    completionRequirements?: Array<{
      id: string;
      kind: "artifact_coverage";
      artifactTypeId: string;
      scope: { kind: "team_cell"; teamId: string; cellKind: string; field: string };
      minimumPerScope: number;
      qualifyingMilestone: "submitted_to_control";
      stageGroupId?: string;
    }>;
  }>;
  forms: RuntimeFormDefinition[];
  artifactTypes: ArtifactTypeDefinition[];
  workflows: WorkflowDefinition[];
  interfaceProfiles: RuntimeInterfaceProjectionProfile[];
}

interface ArtifactRow {
  id: string;
  artifact_type_key: string;
  state: string;
  payload: JsonObject;
  version: string;
  governing_release_id: string;
  form_version: string;
  creator_participant_id: string;
  visible_role_ids: string[];
  owner_team_id: string | null;
}

interface StageStateRow {
  stage_id: string;
  status: "not_started" | "active" | "paused" | "completed";
  started_at: Date | null;
  paused_at: Date | null;
  accumulated_pause_seconds: string;
  extension_seconds: string;
  version: string;
}

type ReleasedDefinition = {
  definition: RuntimeDefinition;
  releaseLabel: string;
  initial: {
    initialState?: Array<{ stateVariableId: string; scopeReference?: string; value: boolean | number | string }>;
    initialCapabilities?: Array<{ capabilityId: string; scopeReference?: string; state: string; quantity?: number }>;
    initialResources?: Array<{ resourceId: string; scopeReference?: string; balance: number }>;
  };
};

const releasedDefinitions = new Map<string, Promise<ReleasedDefinition>>();

const operationEvents: Readonly<Record<string, string>> = {
  "artifact.create": "artifact.created",
  "artifact.edit": "artifact.edited",
  "artifact.submit": "artifact.submitted",
  "artifact.forward": "artifact.forwarded",
  "artifact.return": "artifact.returned",
  "artifact.accept": "artifact.accepted"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

function runtimeDefinition(value: unknown, correlationId: string): RuntimeDefinition {
  if (!isRecord(value)) {
    throw authorizationError("INCOMPATIBLE_RELEASE", "The Release lacks a Runtime Interface Profile.", correlationId);
  }
  // shortcut: historical PS-150 snapshots are flat; remove after their Sessions are migrated and AC-09 passes.
  const design = isRecord(value.coreDesign) ? value.coreDesign : value;
  const profiles = Array.isArray(design.interfaces) ? design.interfaces.map((candidate) => {
    const profile = candidate as Record<string, unknown>;
    const selectors = profile.selectors as Record<string, unknown>;
    const layout = profile.layout as Record<string, unknown>;
    const template = layout.template;
    const layoutName = template === "main_sidebar" ? "main_with_sidebar" :
      template === "dashboard" ? "dashboard_grid" : template === "workspace" ? "workspace_tabs" : "single_column";
    const regions = layout.regions as Array<{ modules: Array<Record<string, unknown>> }>;
    return {
      id: profile.id,
      sessionRoleIds: selectors.sessionRoleIds,
      stageIds: selectors.stageIds,
      layout: layoutName,
      modules: regions.flatMap((region) => region.modules.map((module) => ({
        id: module.id,
        type: module.moduleType,
        title: module.title ?? module.id,
        mode: (module.configuration as Record<string, unknown>).mode ?? "read",
        emptyStateText: (module.configuration as Record<string, unknown>).emptyStateText ?? "Nothing is available.",
        configuration: module.configuration
      })))
    };
  }) : Array.isArray(design.interfaceProfiles) ? design.interfaceProfiles.map((candidate) => {
    const profile = candidate as Record<string, unknown>;
    return {
      ...profile,
      modules: Array.isArray(profile.modules) ? profile.modules.map((candidateModule) => {
        const module = candidateModule as Record<string, unknown>;
        return { ...module, configuration: isRecord(module.configuration) ? module.configuration : {} };
      }) : profile.modules
    };
  }) : design.interfaceProfiles;
  const forms = Array.isArray(design.forms) ? design.forms.map((candidate) => {
    const form = candidate as Record<string, unknown>;
    return Array.isArray(form.sections) ? {
      ...form,
      fields: (form.sections as Array<{ fields: unknown[] }>).flatMap((section) => section.fields)
    } : form;
  }) : design.forms;
  const stages = Array.isArray(design.stages) ? design.stages.map((candidate) => {
    const stage = candidate as Record<string, unknown>;
    return { ...stage, label: stage.label ?? stage.name };
  }) : design.stages;
  const normalized: Record<string, unknown> = { ...design, forms, stages, interfaceProfiles: profiles };
  if (!Array.isArray(normalized.sessionRoles) || !Array.isArray(normalized.stages) ||
      !Array.isArray(normalized.forms) || !Array.isArray(normalized.artifactTypes) ||
      !Array.isArray(normalized.workflows) || !Array.isArray(normalized.interfaceProfiles) ||
      !Array.isArray(normalized.teams) || !Array.isArray(normalized.seats) || !Array.isArray(normalized.informationPolicies)) {
    throw authorizationError("INCOMPATIBLE_RELEASE", "The Release lacks a Runtime Interface Profile.", correlationId);
  }
  return normalized as unknown as RuntimeDefinition;
}

async function readRelease(
  client: PoolClient,
  organizationId: string,
  releaseId: string,
  correlationId: string
): Promise<ReleasedDefinition> {
  const cacheKey = `${organizationId}:${releaseId}`;
  const cached = releasedDefinitions.get(cacheKey);
  if (cached !== undefined) return cached;
  const loaded = (async () => {
    const result = await client.query<{ snapshot: unknown; release_label: string }>(
      `SELECT (revision.snapshot - 'resources') #- '{coreDesign,resources}' AS snapshot, release.release_label
         FROM registry.releases release
         JOIN studio.definition_revisions revision
           ON revision.organization_id=release.organization_id
          AND revision.id=release.definition_revision_id
        WHERE release.organization_id=$1 AND release.id=$2`,
      [organizationId, releaseId]
    );
    const row = result.rows[0];
    if (row === undefined) throw authorizationError("NOT_FOUND", "The Release was not found.", correlationId);
    const snapshot = row.snapshot as Record<string, unknown>;
    const scenario = isRecord(snapshot.scenario) ? snapshot.scenario : {};
    return {
      definition: runtimeDefinition(row.snapshot, correlationId),
      releaseLabel: row.release_label,
      initial: {
        ...(Array.isArray(scenario.initialState) ? { initialState: scenario.initialState as Array<{ stateVariableId: string; scopeReference?: string; value: boolean | number | string }> } : {}),
        ...(Array.isArray(scenario.initialCapabilities) ? { initialCapabilities: scenario.initialCapabilities as Array<{ capabilityId: string; scopeReference?: string; state: string; quantity?: number }> } : {}),
        ...(Array.isArray(scenario.initialResources) ? { initialResources: scenario.initialResources as Array<{ resourceId: string; scopeReference?: string; balance: number }> } : {})
      }
    };
  })();
  if (releasedDefinitions.size >= 64) releasedDefinitions.delete(releasedDefinitions.keys().next().value as string);
  releasedDefinitions.set(cacheKey, loaded);
  try {
    return await loaded;
  } catch (error) {
    if (releasedDefinitions.get(cacheKey) === loaded) releasedDefinitions.delete(cacheKey);
    throw error;
  }
}

function formFor(definition: RuntimeDefinition, type: ArtifactTypeDefinition): RuntimeFormDefinition {
  const form = definition.forms.find((candidate) => candidate.id === type.formId);
  if (form === undefined) throw new Error(`Release Artifact Type ${type.key} has no Form`);
  return form;
}

function workflowFor(definition: RuntimeDefinition, type: ArtifactTypeDefinition): WorkflowDefinition {
  const workflow = definition.workflows.find((candidate) => candidate.id === type.workflowId);
  if (workflow === undefined) throw new Error(`Release Artifact Type ${type.key} has no Workflow Definition`);
  return workflow;
}

function typeFor(definition: RuntimeDefinition, artifactTypeKey: unknown): ArtifactTypeDefinition | undefined {
  return typeof artifactTypeKey === "string"
    ? definition.artifactTypes.find((candidate) => candidate.key === artifactTypeKey)
    : undefined;
}

function actorFor(definition: RuntimeDefinition, context: SessionAccessContextV1): { teamId?: string; teamLabel?: string; seatId: string; isControlRole: boolean } | undefined {
  const role = definition.sessionRoles.find((candidate) => candidate.id === context.activeSessionRoleId);
  const seat = context.seatId === undefined ? undefined : definition.seats.find((candidate) => candidate.id === context.seatId);
  if (role === undefined || seat === undefined || !seat.sessionRoleIds.includes(role.id)) return undefined;
  const team = seat.teamId === undefined ? undefined : definition.teams.find((candidate) => candidate.id === seat.teamId);
  return { ...(team === undefined ? {} : { teamId: team.id, teamLabel: team.name }), seatId: seat.id, isControlRole: role.isControlRole === true };
}

async function runtimeGateFacts(
  client: PoolClient,
  definition: RuntimeDefinition,
  initial: Awaited<ReturnType<typeof readRelease>>["initial"],
  context: SessionAccessContextV1,
  artifact?: { state: string; typeKey: string; payload: JsonObject; ownerTeamId?: string }
): Promise<Record<string, boolean | number | string>> {
  await initializeWorldState(client, {
    organizationId: context.organizationId, sessionId: context.sessionId, governingReleaseId: context.activeReleaseId
  }, definition, initial);
  await applyDueStateValueChanges(client, context, definition.stateVariables ?? []);
  const actor = actorFor(definition, context);
  const visible = (policyId: string): boolean => {
    const policy = definition.informationPolicies.find(({ id }) => id === policyId);
    return actor !== undefined && policy?.grants.some(({ audience }) => audienceAllows({
      organizationId: context.organizationId, sessionId: context.sessionId, participantId: context.participantId,
      activeSessionRoleId: context.activeSessionRoleId, ...(actor.teamId === undefined ? {} : { activeTeamId: actor.teamId }),
      isControlRole: actor.isControlRole, organizationRoles: context.organizationRoles
    }, audience)) === true;
  };
  const facts = await readWorldStateFacts(client, context, {
    stateVariableIds: new Set((definition.stateVariables ?? []).filter(({ informationPolicyId }) => visible(informationPolicyId)).map(({ id }) => id)),
    capabilityIds: new Set((definition.capabilities ?? []).filter(({ informationPolicyId }) => visible(informationPolicyId)).map(({ id }) => id)),
    resourceIds: new Set((definition.resourceDefinitions ?? []).filter(({ informationPolicyId }) => visible(informationPolicyId)).map(({ id }) => id))
  });
  const stage = await client.query<{ stage_id: string; status: string; elapsed_seconds: string }>(
    `SELECT stage_id,status,GREATEST(0,extract(epoch FROM (transaction_timestamp()-COALESCE(started_at,transaction_timestamp())))
       - accumulated_pause_seconds)::bigint AS elapsed_seconds
       FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2`,
    [context.organizationId, context.sessionId]
  );
  const clock = await client.query<{ now: Date }>("SELECT transaction_timestamp() AS now");
  facts["session.status"] = stage.rows[0]?.status ?? "not_started";
  if (stage.rows[0] !== undefined) {
    facts["session.stage.id"] = stage.rows[0].stage_id;
    facts["session.stage.elapsedSeconds"] = Number(stage.rows[0].elapsed_seconds);
    facts[`stage.${stage.rows[0].stage_id}.status`] = stage.rows[0].status;
  }
  facts["actor.sessionRoleId"] = context.activeSessionRoleId;
  if (actor?.teamId !== undefined) facts["actor.teamId"] = actor.teamId;
  facts["time.wallClock"] = clock.rows[0]?.now.toISOString() ?? new Date(0).toISOString();
  if (artifact !== undefined) {
    facts["artifact.status"] = artifact.state;
    facts["artifact.typeKey"] = artifact.typeKey;
    const artifactPolicyId = definition.artifactTypes.find(({ key }) => key === artifact.typeKey)?.informationPolicyId;
    const artifactGrants = definition.informationPolicies.find(({ id }) => id === artifactPolicyId)?.grants.filter(({ audience }) =>
      actor !== undefined && audienceAllows({
        organizationId: context.organizationId, sessionId: context.sessionId, participantId: context.participantId,
        activeSessionRoleId: context.activeSessionRoleId, ...(actor.teamId === undefined ? {} : { activeTeamId: actor.teamId }),
        isControlRole: actor.isControlRole, organizationRoles: context.organizationRoles
      }, audience, artifact.ownerTeamId, artifact.payload)) ?? [];
    for (const [key, value] of Object.entries(artifact.payload)) {
      if (artifactGrants.some(({ fieldsExcluded }) => fieldsExcluded?.includes(key) !== true) &&
          ["boolean", "number", "string"].includes(typeof value)) facts[`artifact.field.${key}`] = value as boolean | number | string;
    }
  }
  return facts;
}

function artifactAllowed(
  definition: RuntimeDefinition,
  type: ArtifactTypeDefinition,
  context: SessionAccessContextV1,
  ownerTeamId: string | null,
  payload: JsonObject,
  actor: { teamId?: string; isControlRole: boolean }
): boolean {
  const policy = definition.informationPolicies.find((candidate) => candidate.id === type.informationPolicyId);
  if (policy === undefined) return false;
  return policy.grants.some((grant) => audienceAllows({
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    participantId: context.participantId,
    activeSessionRoleId: context.activeSessionRoleId,
    ...(actor.teamId === undefined ? {} : { activeTeamId: actor.teamId }),
    isControlRole: actor.isControlRole,
    organizationRoles: []
  }, grant.audience, ownerTeamId ?? undefined, payload));
}

async function activeStageId(client: PoolClient, definition: RuntimeDefinition, context: SessionAccessContextV1): Promise<string | undefined> {
  const result = await client.query<{ stage_id: string }>(
    "SELECT stage_id FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2",
    [context.organizationId, context.sessionId]
  );
  return result.rows[0]?.stage_id ?? definition.stages[0]?.id;
}

function executableStages(definition: RuntimeDefinition): RuntimeStageDefinitionV1[] {
  return definition.stages.map((stage) => ({
    ...stage,
    name: stage.name ?? stage.label,
    stageType: stage.stageType ?? "stage",
    allowedActivityIds: stage.allowedActivityIds ?? [],
    transitions: stage.transitions ?? [],
    operatorControls: stage.operatorControls ?? {
      allowStart: false, allowEnd: false, allowReopen: false, allowExtend: false,
      allowSkip: false, allowReturnToPrevious: false, requireReason: true
    }
  }));
}

function transitionFor(
  workflow: WorkflowDefinition,
  state: string | null,
  operationType: string,
  activeSessionRoleId: string,
  facts: Readonly<Record<string, boolean | number | string>>
): WorkflowTransitionDefinition | CommandDecision {
  const result = resolveWorkflowTransition(workflow, state, operationType, activeSessionRoleId, facts);
  if (result.allowed) return result.transition;
  return result.reason === "PERMISSION_DENIED"
    ? { status: "rejected", errorCode: result.reason, message: "The Active Role Context cannot perform this transition." }
    : { status: "rejected", errorCode: "INVALID_TRANSITION", message: result.reason === "GATE_NOT_SATISFIED"
      ? "The workflow Gate is not satisfied." : "The workflow does not allow this transition." };
}

function isDecision(value: WorkflowTransitionDefinition | CommandDecision): value is CommandDecision {
  return "status" in value;
}

async function applyAutomationEffects(
  input: CommandExecutionContext,
  definition: RuntimeDefinition,
  actions: readonly AutomationActionV1[] | undefined,
  sourceType: "stage" | "workflow",
  sourceReference: string,
  rationale: string
): Promise<{ transactionIds: string[]; scheduledEffectIds: string[] }> {
  const transactionIds: string[] = [];
  const scheduledEffectIds: string[] = [];
  for (const [effectIndex, action] of (actions ?? []).entries()) {
    if (action.type !== "apply_effect") continue;
    const effect = action.parameters as unknown as Parameters<typeof applyStateValueChange>[2];
    const context = {
      organizationId: input.context.organizationId, sessionId: input.context.sessionId,
      governingReleaseId: input.activeReleaseId
    };
    const source = {
      type: sourceType, reference: sourceReference, commandId: input.command.commandId,
      actorPersonId: input.context.principalId, rationale: effect.rationale ?? rationale
    } as const;
    if ((effect.delaySeconds ?? 0) > 0) {
      scheduledEffectIds.push(await scheduleStateValueChange(input.client, context, effect, effectIndex, source));
      continue;
    }
    const transaction = await applyStateValueChange(input.client, context, effect, source, (() => {
      const stateDefinition = definition.stateVariables?.find(({ id }) => id === effect.stateVariableId);
      return stateDefinition === undefined ? {} : { definition: stateDefinition };
    })());
    transactionIds.push(transaction.id);
  }
  return { transactionIds, scheduledEffectIds };
}

async function applyStageRenewals(
  input: CommandExecutionContext,
  definition: RuntimeDefinition,
  stageIds: readonly string[],
  rationale: string
): Promise<string[]> {
  const transactionIds: string[] = [];
  const context = { organizationId: input.context.organizationId, sessionId: input.context.sessionId, governingReleaseId: input.activeReleaseId };
  for (const stageId of stageIds) {
    const stage = definition.stages.find(({ id }) => id === stageId);
    if (stage === undefined) continue;
    const source = { type: "stage", reference: `${stageId}.entry`, commandId: input.command.commandId,
      actorPersonId: input.context.principalId, rationale } as const;
    for (const capability of definition.capabilities ?? []) {
      if (capability.renewal?.everyStageType !== (stage.stageType ?? "stage") || capability.maximumQuantity === undefined) continue;
      transactionIds.push((await applyCapabilityQuantityChange(input.client, context, {
        capabilityId: capability.id, operation: "renew", amount: capability.renewal.amount,
        maximumQuantity: capability.maximumQuantity
      }, source)).id);
    }
    for (const resource of definition.resourceDefinitions ?? []) {
      if (resource.replenishment === undefined || resource.replenishment.amount <= 0 ||
          resource.replenishment.everyStageType !== undefined && resource.replenishment.everyStageType !== (stage.stageType ?? "stage")) continue;
      transactionIds.push((await applyResourceTransaction(input.client, context, {
        resourceId: resource.id, operation: "credit", amount: resource.replenishment.amount
      }, source)).id);
    }
  }
  return transactionIds;
}

function actionLabel(transition: WorkflowTransitionDefinition): string {
  if (transition.label !== undefined && transition.label.length > 0) return transition.label;
  const action = transition.command.slice(transition.command.indexOf(".") + 1);
  return `${action[0]?.toUpperCase() ?? ""}${action.slice(1).replaceAll("_", " ")}`;
}

function asForm(form: RuntimeFormDefinition): RuntimeFormV1 {
  const field = (item: RuntimeFieldDefinition): RuntimeFormV1["fields"][number] => ({
    key: item.key,
    label: item.label,
    type: item.type === "short_text" ? "text" : item.type,
    required: item.required === true,
    ...(item.requiredWhen === undefined ? {} : { requiredWhen: item.requiredWhen }),
    ...(item.visibleWhen === undefined ? {} : { visibleWhen: item.visibleWhen }),
    ...(item.helpText === undefined ? {} : { helpText: item.helpText }),
    ...(item.options === undefined ? {} : { options: item.options }),
    ...(item.readOnly === undefined ? {} : { readOnly: item.readOnly }),
    ...(item.validation === undefined ? {} : { validation: item.validation })
  });
  return {
    id: form.id,
    name: form.name,
    formVersion: form.formVersion,
    fields: form.fields.map(field),
    sections: form.sections.map((section) => ({
      id: section.id,
      ...(section.title === undefined ? {} : { title: section.title }),
      ...(section.description === undefined ? {} : { description: section.description }),
      ...(section.repeatable === undefined ? {} : { repeatable: section.repeatable }),
      ...(section.itemLabel === undefined ? {} : { itemLabel: section.itemLabel }),
      ...(section.itemKeyField === undefined ? {} : { itemKeyField: section.itemKeyField }),
      ...(section.minItems === undefined ? {} : { minItems: section.minItems }),
      ...(section.maxItems === undefined ? {} : { maxItems: section.maxItems }),
      fields: section.fields.map(field)
    })),
    ...(form.rules === undefined ? {} : { rules: form.rules })
  };
}

function asAction(transition: WorkflowTransitionDefinition): RuntimeActionV1 {
  return {
    operationType: transition.command,
    label: actionLabel(transition),
    requiresForm: transition.command === "artifact.create" || transition.contentOnly === true || transition.editableFieldKeys !== undefined,
    ...(transition.editableFieldKeys === undefined ? {} : { editableFieldKeys: transition.editableFieldKeys })
  };
}

function visibleRoles(
  existing: readonly string[],
  workflow: WorkflowDefinition,
  transition: WorkflowTransitionDefinition
): string[] {
  const next = workflow.states.find((state) => state.key === transition.to);
  return [...new Set([
    ...existing,
    ...(next?.holderSessionRoleIds ?? []),
    ...(transition.notifySessionRoleIds ?? [])
  ])].sort();
}

function eventType(operationType: string): string {
  const value = operationEvents[operationType];
  if (value === undefined) throw new Error(`Artifact Command has no registered event type: ${operationType}`);
  return value;
}

function jsonPayload(value: unknown): JsonObject | undefined {
  return isRecord(value) ? value as JsonObject : undefined;
}

async function acceptedProposalReferencesValid(
  client: PoolClient,
  context: SessionAccessContextV1,
  definition: RuntimeDefinition,
  artifactType: ArtifactTypeDefinition,
  ownerTeamId: string | undefined,
  payload: JsonObject
): Promise<boolean> {
  for (const link of artifactType.evidenceLinks ?? []) {
    const value = runtimeFormValue(payload, link.field);
    const references = value === undefined || value === null || value === "" ? [] : Array.isArray(value) ? value : [value];
    if (references.length === 0) {
      if (link.required) return false;
      continue;
    }
    if (ownerTeamId === undefined || !references.every((reference) => typeof reference === "string" && reference.length > 0)) return false;
    const uniqueReferences = [...new Set(references as string[])];
    if (uniqueReferences.length !== references.length) return false;
    const sourceKeys = definition.artifactTypes
      .filter(({ id }) => link.sourceArtifactTypeIds.includes(id))
      .map(({ key }) => key);
    const result = await client.query<{ count: string }>(
      `SELECT count(DISTINCT thread.source_artifact_id) AS count
         FROM runtime.message_threads thread
         JOIN runtime.artifact_instances source
           ON source.organization_id=thread.organization_id AND source.id=thread.source_artifact_id
        WHERE thread.organization_id=$1 AND thread.session_id=$2 AND thread.recipient_team_id=$3
          AND thread.accepted_at IS NOT NULL AND thread.source_artifact_id::text=ANY($4::text[])
          AND source.artifact_type_key=ANY($5::text[])`,
      [context.organizationId, context.sessionId, ownerTeamId, uniqueReferences, sourceKeys]
    );
    if (Number(result.rows[0]?.count ?? 0) !== uniqueReferences.length) return false;
  }
  return true;
}

async function recordArtifactRevision(
  client: PoolClient,
  context: SessionAccessContextV1,
  command: CommandEnvelopeV1,
  artifact: { id: string; version: number; governingReleaseId: string; state: string; payload: JsonObject },
  authorParticipantIds: string[]
): Promise<void> {
  const revisionId = randomUUID();
  await client.query(
    `WITH revision AS (
       INSERT INTO runtime.artifact_revisions
       (id,organization_id,session_id,artifact_id,artifact_version,governing_release_id,state,payload,
        author_person_id,author_participant_id,author_display_name,author_organization_name,command_id)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,person.display_name,organization.name,$11
         FROM identity.persons person JOIN identity.organizations organization ON organization.id=$2
        WHERE person.id=$9
       RETURNING id
     )
     INSERT INTO runtime.artifact_revision_authors
       (id,organization_id,session_id,artifact_revision_id,person_id,participant_id,display_name,organization_name,
        is_command_actor,author_order)
     SELECT gen_random_uuid(),$2,$3,revision.id,participant.person_id,participant.id,person.display_name,organization.name,
       participant.id=$10,authors.ordinality-1
       FROM revision
       CROSS JOIN unnest($12::uuid[]) WITH ORDINALITY AS authors(participant_id,ordinality)
       JOIN runtime.participants participant ON participant.organization_id=$2 AND participant.session_id=$3
        AND participant.id=authors.participant_id
       JOIN identity.persons person ON person.id=participant.person_id
       JOIN identity.organizations organization ON organization.id=$2`,
    [revisionId, context.organizationId, context.sessionId, artifact.id, artifact.version, artifact.governingReleaseId,
      artifact.state, JSON.stringify(artifact.payload), context.principalId, context.participantId, command.commandId,
      authorParticipantIds]
  );
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

async function revisionAuthorParticipantIds(client: PoolClient, context: SessionAccessContextV1, command: CommandEnvelopeV1): Promise<string[] | undefined> {
  const requested = command.payload.coauthorParticipantIds;
  if (requested === undefined) return [context.participantId];
  if (!Array.isArray(requested) || requested.length > 20 || requested.some((id) => typeof id !== "string" || !uuid.test(id))) return undefined;
  if (!command.operationType.startsWith("artifact.") || !["artifact.create", "artifact.edit"].includes(command.operationType)) return undefined;
  const coauthors = [...new Set(requested as string[])].filter((id) => id !== context.participantId);
  if (coauthors.length > 0) {
    const participants = await client.query(
      `SELECT id FROM runtime.participants WHERE organization_id=$1 AND session_id=$2 AND id=ANY($3::uuid[])`,
      [context.organizationId, context.sessionId, coauthors]
    );
    if (participants.rowCount !== coauthors.length) return undefined;
  }
  return [context.participantId, ...coauthors];
}

export async function executeArtifactCommand(input: CommandExecutionContext): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  const revisionAuthors = await revisionAuthorParticipantIds(client, context, command);
  if (revisionAuthors === undefined) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Artifact co-authors must be current Participants in this Session." };
  }
  if (command.operationType === "artifact.create") {
    if (command.governingReleaseId !== activeReleaseId) {
      return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "New Artifacts use the active Release." };
    }
    if (command.expectedAggregateVersion !== 0) {
      return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: "A new Artifact starts at version zero." };
    }
    const { definition, initial } = await readRelease(client, context.organizationId, activeReleaseId, command.commandId);
    const artifactType = typeFor(definition, command.payload.artifactTypeKey);
    if (artifactType === undefined) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "The Artifact Type is not in the Release." };
    const actor = actorFor(definition, context);
    if (actor === undefined || !artifactType.allowedCreatorSessionRoleIds.includes(context.activeSessionRoleId) ||
        (artifactType.allowedTeamIds !== undefined && (actor.teamId === undefined || !artifactType.allowedTeamIds.includes(actor.teamId)))) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Active Role Context cannot create this Artifact Type." };
    }
    const stageId = await activeStageId(client, definition, context);
    if (artifactType.availableStageIds !== undefined && (stageId === undefined || !artifactType.availableStageIds.includes(stageId))) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "This Artifact Type is not available in the current Stage." };
    }
    const workflow = workflowFor(definition, artifactType);
    const transition = transitionFor(workflow, null, command.operationType, context.activeSessionRoleId,
      await runtimeGateFacts(client, definition, initial, context,
        { state: "", typeKey: artifactType.key, payload: {}, ...(actor.teamId === undefined ? {} : { ownerTeamId: actor.teamId }) }));
    if (isDecision(transition)) return transition;
    const content = jsonPayload(command.payload.content) ?? {};
    if (workflow.states.find((state) => state.key === transition.to)?.kind !== "draft") {
      const issues = validateRuntimeFormPayload(formFor(definition, artifactType), content);
      if (issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: issues.map((issue) => issue.message).join("; ") };
    }
    if (!await acceptedProposalReferencesValid(client, context, definition, artifactType, actor.teamId, content)) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "An accepted proposal reference is invalid or unavailable to this Team." };
    }
    const inserted = await client.query(
      `INSERT INTO runtime.artifact_instances
         (id,organization_id,session_id,governing_release_id,artifact_type_key,workflow_key,
          form_version,creator_participant_id,owner_team_id,state,payload,visible_role_ids,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,1)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [command.aggregateId, context.organizationId, context.sessionId, activeReleaseId,
        artifactType.key, workflow.key, formFor(definition, artifactType).formVersion,
        context.participantId, actor.teamId ?? null, transition.to, JSON.stringify(content), visibleRoles([], workflow, transition)]
    );
    if (inserted.rowCount !== 1) return { status: "rejected", errorCode: "TARGET_EXISTS", message: "The Artifact already exists." };
    await recordArtifactRevision(client, context, command, { id: command.aggregateId, version: 1,
      governingReleaseId: activeReleaseId, state: transition.to, payload: content }, revisionAuthors);
    const automation = await applyAutomationEffects(input, definition, transition.actions, "workflow",
      `${workflow.id}:${transition.from ?? "initial"}->${transition.to}`, `Workflow transition ${transition.command}`);
    return {
      status: "accepted",
      aggregateVersion: 1,
      eventType: eventType(command.operationType),
      eventPayload: { artifactId: command.aggregateId, artifactTypeKey: artifactType.key, fromState: null,
        toState: transition.to, activeSessionRoleId: context.activeSessionRoleId, version: 1,
        revisionAuthorParticipantIds: revisionAuthors,
        stateTransactionIds: automation.transactionIds, scheduledEffectIds: automation.scheduledEffectIds }
    };
  }

  const result = await client.query<ArtifactRow>(
    `SELECT id,artifact_type_key,state,payload,version,governing_release_id,form_version,
            creator_participant_id,visible_role_ids,owner_team_id
       FROM runtime.artifact_instances
      WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE`,
    [context.organizationId, context.sessionId, command.aggregateId]
  );
  const artifact = result.rows[0];
  if (artifact === undefined) {
    return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Artifact was not found." };
  }
  if (command.governingReleaseId !== artifact.governing_release_id) {
    return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "The Artifact is governed by another Release." };
  }
  const currentVersion = Number(artifact.version);
  const { definition, initial } = await readRelease(client, context.organizationId, artifact.governing_release_id, command.commandId);
  const artifactType = typeFor(definition, artifact.artifact_type_key);
  if (artifactType === undefined) throw new Error(`Release lacks Artifact Type ${artifact.artifact_type_key}`);
  const actor = actorFor(definition, context);
  if (actor === undefined || !artifactAllowed(definition, artifactType, context, artifact.owner_team_id, artifact.payload, actor) ||
      (artifact.creator_participant_id !== context.participantId && !artifact.visible_role_ids.includes(context.activeSessionRoleId))) {
    return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Artifact was not found." };
  }
  if (command.expectedAggregateVersion !== currentVersion) {
    return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The Artifact is at version ${currentVersion}.` };
  }
  const workflow = workflowFor(definition, artifactType);
  if (!actor.isControlRole && actor.teamId !== artifact.owner_team_id) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only the owning Team or Control may change this Artifact." };
  }
  const transition = transitionFor(workflow, artifact.state, command.operationType, context.activeSessionRoleId,
    await runtimeGateFacts(client, definition, initial, context,
      { state: artifact.state, typeKey: artifact.artifact_type_key, payload: artifact.payload,
        ...(artifact.owner_team_id === null ? {} : { ownerTeamId: artifact.owner_team_id }) }));
  if (isDecision(transition)) return transition;
  if (transition.contentOnly === true && artifact.creator_participant_id !== context.participantId && transition.allowNonCreatorEdit !== true) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only the creator may edit this Artifact." };
  }
  let payload = artifact.payload;
  if (transition.editableFieldKeys !== undefined) {
    const content = jsonPayload(command.payload.content);
    if (content === undefined) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Artifact content must be an object." };
    payload = structuredClone(artifact.payload);
    for (const key of transition.editableFieldKeys) {
      const value = runtimeFormValue(content, key);
      if (value === undefined || value === null || value === "") {
        return { status: "rejected", errorCode: "VALIDATION_FAILED", message: `${key} is required.` };
      }
      setRuntimeFormValue(payload, key, value);
    }
    const issues = validateRuntimeFormPayload(formFor(definition, artifactType), payload)
      .filter((issue) => transition.editableFieldKeys?.includes(issue.field));
    if (issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: issues.map((issue) => issue.message).join("; ") };
  } else if (transition.contentOnly === true) {
    const content = jsonPayload(command.payload.content);
    if (content === undefined) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Artifact content must be an object." };
    payload = content;
  } else {
    const state = workflow.states.find((candidate) => candidate.key === artifact.state);
    if (state?.kind === "draft") {
      const issues = validateRuntimeFormPayload(formFor(definition, artifactType), payload);
      if (issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: issues.map((issue) => issue.message).join("; ") };
    }
  }
  if (!await acceptedProposalReferencesValid(client, context, definition, artifactType, actor.teamId, payload)) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "An accepted proposal reference is invalid or unavailable to this Team." };
  }
  const version = currentVersion + 1;
  await client.query(
    `UPDATE runtime.artifact_instances
        SET state=$1,payload=$2::jsonb,visible_role_ids=$3,version=$4,updated_at=transaction_timestamp()
      WHERE organization_id=$5 AND id=$6`,
    [transition.to, JSON.stringify(payload), visibleRoles(artifact.visible_role_ids, workflow, transition),
      version, context.organizationId, artifact.id]
  );
  await recordArtifactRevision(client, context, command, { id: artifact.id, version,
    governingReleaseId: artifact.governing_release_id, state: transition.to, payload }, revisionAuthors);
  const automation = await applyAutomationEffects(input, definition, transition.actions, "workflow",
    `${workflow.id}:${artifact.state}->${transition.to}`, `Workflow transition ${transition.command}`);
  return {
    status: "accepted",
    aggregateVersion: version,
    eventType: eventType(command.operationType),
    eventPayload: { artifactId: artifact.id, artifactTypeKey: artifact.artifact_type_key,
      fromState: artifact.state, toState: transition.to, activeSessionRoleId: context.activeSessionRoleId, version,
      revisionAuthorParticipantIds: revisionAuthors,
      stateTransactionIds: automation.transactionIds, scheduledEffectIds: automation.scheduledEffectIds }
  };
}

function textPayload(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function completionRequirementsSatisfied(
  client: PoolClient,
  context: SessionAccessContextV1,
  definition: RuntimeDefinition,
  stage: RuntimeDefinition["stages"][number]
): Promise<boolean> {
  for (const requirement of stage.completionRequirements ?? []) {
    const artifactType = definition.artifactTypes.find(({ id }) => id === requirement.artifactTypeId);
    if (artifactType === undefined) return false;
    const workflow = workflowFor(definition, artifactType);
    const controlRoleIds = new Set(definition.sessionRoles.filter(({ isControlRole }) => isControlRole).map(({ id }) => id));
    const qualifyingStates = workflow.states.filter((state) => state.kind === "terminal" ||
      state.holderSessionRoleIds?.some((sessionRoleId) => controlRoleIds.has(sessionRoleId))).map(({ key }) => key);
    const cells = (definition.teamCells ?? []).filter((cell) => cell.enabled &&
      cell.teamId === requirement.scope.teamId && cell.kind === requirement.scope.cellKind);
    for (const cell of cells) {
      const result = await client.query<{ count: string }>(
        `SELECT count(*) AS count FROM runtime.artifact_instances
          WHERE organization_id=$1 AND session_id=$2 AND artifact_type_key=$3
            AND state=ANY($4::text[]) AND payload #>> string_to_array($5,'.')=$6`,
        [context.organizationId, context.sessionId, artifactType.key, qualifyingStates, requirement.scope.field, cell.id]
      );
      if (Number(result.rows[0]?.count ?? 0) < requirement.minimumPerScope) return false;
    }
  }
  return true;
}

export async function executeStageCommand(input: CommandExecutionContext): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (command.governingReleaseId !== activeReleaseId) {
    return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "Stage controls use the active Release." };
  }
  if (command.aggregateId !== context.sessionId) {
    return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Stage aggregate was not found." };
  }
  const { definition, initial } = await readRelease(client, context.organizationId, activeReleaseId, command.commandId);
  const role = definition.sessionRoles.find((candidate) => candidate.id === context.activeSessionRoleId);
  const capability = command.operationType === "stage.advance" || command.operationType === "stage.return"
    ? "stage.advance" : "timer.control";
  if (!role?.capabilities?.some((grant) => grant.capability === capability)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Active Role Context cannot control this Stage." };
  }
  const reason = textPayload(command.payload.reason);
  if (reason === undefined) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "A Control Intervention reason is required." };

  let result = await client.query<StageStateRow>(
    `SELECT stage_id,status,started_at,paused_at,accumulated_pause_seconds,extension_seconds,version
       FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2 FOR UPDATE`,
    [context.organizationId, context.sessionId]
  );
  if (result.rows[0] === undefined) {
    const first = definition.stages[0];
    if (first === undefined) throw new Error("Release has no Stage");
    await client.query(
      `INSERT INTO runtime.session_stage_state
         (session_id,organization_id,governing_release_id,stage_id,status,version)
       VALUES ($1,$2,$3,$4,'not_started',0)`,
      [context.sessionId, context.organizationId, activeReleaseId, first.id]
    );
    result = await client.query<StageStateRow>(
      `SELECT stage_id,status,started_at,paused_at,accumulated_pause_seconds,extension_seconds,version
         FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2 FOR UPDATE`,
      [context.organizationId, context.sessionId]
    );
  }
  const current = result.rows[0];
  if (current === undefined) throw new Error("Stage state initialization failed");
  const currentVersion = Number(current.version);
  if (command.expectedAggregateVersion !== currentVersion) {
    return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The Stage is at version ${currentVersion}.` };
  }
  const stage = definition.stages.find((candidate) => candidate.id === current.stage_id);
  if (stage === undefined) throw new Error(`Release lacks Stage ${current.stage_id}`);
  const before = { stageId: current.stage_id, status: current.status, version: currentVersion };
  let targetStageId = current.stage_id;
  let status = current.status;
  let startedAt = current.started_at;
  let pausedAt = current.paused_at;
  let pauseSeconds = Number(current.accumulated_pause_seconds);
  let extensionSeconds = Number(current.extension_seconds);
  const serverClock = await client.query<{ now: Date }>("SELECT transaction_timestamp() AS now");
  const now = serverClock.rows[0]?.now;
  if (now === undefined) throw new Error("Server time is unavailable");
  const gateExplanations: Array<{ trigger: string; passed: boolean; explanations: GateExplanationV1[] }> = [];
  let parallelExecution = false;
  let parallelActionTriggers: string[] | undefined;
  let parallelEntryStageIds: string[] = [];
  let parallelExitStageIds: string[] = [];
  const checkGate = async (trigger: string, gate: GateV1 | undefined): Promise<boolean> => {
    if (gate === undefined) return true;
    const evaluation = evaluateGate(gate, await runtimeGateFacts(client, definition, initial, context));
    gateExplanations.push({ trigger, ...evaluation });
    return evaluation.passed;
  };

  if (command.operationType === "stage.start" && current.status === "not_started" && stage.operatorControls?.allowStart) {
    if (!await checkGate(`${stage.id}.entry`, stage.entryGate)) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Stage entry Gate is not satisfied." };
    }
    status = "active"; startedAt = now;
  } else if ((command.operationType === "stage.pause" || command.operationType === "timer.pause") && current.status === "active") {
    status = "paused"; pausedAt = now;
  } else if ((command.operationType === "stage.resume" || command.operationType === "timer.resume") && current.status === "paused" && pausedAt !== null) {
    status = "active"; pauseSeconds += Math.max(0, Math.floor((now.getTime() - pausedAt.getTime()) / 1000)); pausedAt = null;
  } else if ((command.operationType === "stage.extend" || command.operationType === "timer.extend") && stage.operatorControls?.allowExtend &&
      (current.status === "active" || current.status === "paused")) {
    const seconds = command.payload.seconds;
    if (!Number.isSafeInteger(seconds) || Number(seconds) <= 0) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Extension seconds must be a positive integer." };
    }
    extensionSeconds += Number(seconds);
  } else if (command.operationType === "stage.end" && current.status !== "not_started" && stage.operatorControls?.allowEnd) {
    if (!await completionRequirementsSatisfied(client, context, definition, stage)) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Stage completion requirements are not satisfied." };
    }
    if (!await checkGate(`${stage.id}.completion`, stage.completionGate)) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Stage completion Gate is not satisfied." };
    }
    status = "completed"; pausedAt = null;
  } else if (command.operationType === "stage.reopen" && current.status === "completed" && stage.operatorControls?.allowReopen) {
    status = "active"; startedAt = now; pausedAt = null; pauseSeconds = 0; extensionSeconds = 0;
  } else if (command.operationType === "stage.return" && stage.operatorControls?.allowReturnToPrevious) {
    const target = textPayload(command.payload.targetStageId);
    const previous = target === undefined ? undefined : definition.stages.find((candidate) => candidate.id === target &&
      candidate.transitions?.some((transition) => transition.targetStageId === current.stage_id));
    if (previous === undefined) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Release does not allow return to that Stage." };
    }
    targetStageId = previous.id; status = "active"; startedAt = now; pausedAt = null; pauseSeconds = 0; extensionSeconds = 0;
  } else if (command.operationType === "stage.advance" &&
      (current.status !== "not_started" || stage.operatorControls?.allowSkip === true)) {
    if (!stage.operatorControls?.allowSkip && !await completionRequirementsSatisfied(client, context, definition, stage)) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Stage completion requirements are not satisfied." };
    }
    if (!stage.operatorControls?.allowSkip && !await checkGate(`${stage.id}.completion`, stage.completionGate)) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Stage completion Gate is not satisfied." };
    }
    const target = textPayload(command.payload.targetStageId);
    const stages = executableStages(definition);
    if (stage.transitionMode === "parallel") {
      parallelExecution = true;
      if (target === undefined || target !== stage.parallelJoinStageId) {
        return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "A parallel fork must advance to its configured join Stage." };
      }
      const join = stages.find(({ id }) => id === target);
      if (join === undefined) throw new Error(`Release lacks parallel join Stage ${target}`);
      const rehearsalStages = stages.map((candidate) => candidate.id === join.id ? { ...candidate, transitions: [] } : candidate);
      const start = rehearsalStages.findIndex(({ id }) => id === stage.id);
      const ordered = [rehearsalStages[start]!, ...rehearsalStages.filter((_, index) => index !== start)];
      const { onEnter: _alreadyApplied, ...forkWithoutEntryActions } = ordered[0]!;
      ordered[0] = forkWithoutEntryActions;
      const rehearsal = rehearseStages({ stages: ordered,
        facts: await runtimeGateFacts(client, definition, initial, context), startedAt: now.toISOString(), seed: 0 });
      if (rehearsal.finalStageId !== join.id) {
        return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The parallel Stage branches did not satisfy their configured join." };
      }
      parallelActionTriggers = [...new Set(rehearsal.trace.filter(({ kind, fired }) => kind === "effect" && fired)
        .map(({ triggerId }) => triggerId.replace(/\.effect\.\d+$/u, "")))];
      parallelEntryStageIds = [...new Set(rehearsal.trace.filter(({ kind, fired }) => kind === "entry" && fired)
        .map(({ triggerId }) => triggerId.replace(/\.entry$/u, "")).filter((id) => id !== stage.id))];
      parallelExitStageIds = [...new Set(rehearsal.trace.filter(({ kind, fired }) => kind === "transition" && fired)
        .flatMap(({ triggerId }) => stages.filter((candidate) => candidate.transitions.some(({ id }) => id === triggerId)).map(({ id }) => id)))];
      for (const item of rehearsal.trace.filter(({ kind }) => kind !== "effect")) {
        gateExplanations.push({ trigger: item.triggerId, passed: item.fired, explanations: item.explanations });
      }
      targetStageId = join.id; status = "active"; startedAt = now; pausedAt = null; pauseSeconds = 0; extensionSeconds = 0;
    }
    const next = stage.transitionMode === "parallel" ? stages.find(({ id }) => id === targetStageId) :
      target === undefined ? undefined : nextStage(stages, current.stage_id, target);
    if (next === undefined) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Release does not allow this Stage transition." };
    const selectedTransition = stage.transitionMode === "parallel" ? undefined : stage.transitions?.find(({ targetStageId: candidate }) => candidate === next.id);
    if (stage.transitionMode !== "parallel" && (!await checkGate(selectedTransition?.id ?? `${stage.id}->${next.id}`, selectedTransition?.gate) ||
        !await checkGate(`${next.id}.entry`, next.entryGate))) {
      return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Stage transition Gate is not satisfied." };
    }
    if (stage.transitionMode !== "parallel") {
      targetStageId = next.id; status = "active"; startedAt = now; pausedAt = null; pauseSeconds = 0; extensionSeconds = 0;
    }
  } else {
    return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Stage control is not valid in its current state." };
  }

  const version = currentVersion + 1;
  await client.query(
    `UPDATE runtime.session_stage_state SET stage_id=$1,status=$2,started_at=$3,paused_at=$4,
       accumulated_pause_seconds=$5,extension_seconds=$6,version=$7,updated_at=transaction_timestamp()
     WHERE organization_id=$8 AND session_id=$9`,
    [targetStageId, status, startedAt, pausedAt, pauseSeconds, extensionSeconds, version, context.organizationId, context.sessionId]
  );
  const automationResults: Array<Awaited<ReturnType<typeof applyAutomationEffects>>> = [];
  const enteredStageIds: string[] = [];
  if (parallelExecution) {
    for (const trigger of parallelActionTriggers ?? []) {
      const match = /^(.*)\.(entry|exit)$/u.exec(trigger);
      const triggeredStage = definition.stages.find(({ id }) => id === match?.[1]);
      if (triggeredStage !== undefined) automationResults.push(await applyAutomationEffects(input, definition,
        match?.[2] === "entry" ? triggeredStage.onEnter : triggeredStage.onExit, "stage", trigger, reason));
    }
    enteredStageIds.push(...parallelEntryStageIds);
  } else if (command.operationType === "stage.advance" || command.operationType === "stage.return") {
    automationResults.push(await applyAutomationEffects(input, definition, stage.onExit, "stage", `${stage.id}.exit`, reason));
    automationResults.push(await applyAutomationEffects(input, definition,
      definition.stages.find(({ id }) => id === targetStageId)?.onEnter, "stage", `${targetStageId}.entry`, reason));
    enteredStageIds.push(targetStageId);
  } else if (command.operationType === "stage.start") {
    automationResults.push(await applyAutomationEffects(input, definition, stage.onEnter, "stage", `${stage.id}.entry`, reason));
    enteredStageIds.push(stage.id);
  }
  const stateTransactionIds = [
    ...automationResults.flatMap(({ transactionIds }) => transactionIds),
    ...await applyStageRenewals(input, definition, enteredStageIds, reason)
  ];
  const scheduledEffectIds = automationResults.flatMap((result) => result.scheduledEffectIds);
  const releaseParallelInjects = async (): Promise<string[]> => {
    const ids: string[] = [];
    for (const stageId of parallelExitStageIds) ids.push(...await releaseStageInjects(input, "stage_exit", stageId));
    for (const stageId of parallelEntryStageIds) ids.push(...await releaseStageInjects(input, "stage_entry", stageId));
    ids.push(...await releaseGateInjects(input));
    return ids;
  };
  const releasedInjectIds = parallelExecution
    ? await releaseParallelInjects()
    : command.operationType === "stage.advance" || command.operationType === "stage.return"
    ? [
        ...await releaseStageInjects(input, "stage_exit", current.stage_id),
        ...await releaseStageInjects(input, "stage_entry", targetStageId),
        ...await releaseGateInjects(input)
      ]
    : command.operationType === "stage.start"
      ? [...await releaseStageInjects(input, "stage_entry", targetStageId), ...await releaseGateInjects(input)]
      : await releaseGateInjects(input);
  const after = { stageId: targetStageId, status, version };
  await client.query(
    `INSERT INTO runtime.control_interventions
       (id,organization_id,session_id,governing_release_id,category,reason,before_state,after_state,actor_person_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
    [randomUUID(), context.organizationId, context.sessionId, activeReleaseId, command.operationType, reason,
      JSON.stringify(before), JSON.stringify(after), context.principalId]
  );
  await client.query(
    `INSERT INTO runtime.stage_transition_history
       (id,organization_id,session_id,governing_release_id,from_stage_id,to_stage_id,operation_type,reason,actor_person_id,stage_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [randomUUID(), context.organizationId, context.sessionId, activeReleaseId, current.stage_id, targetStageId,
      command.operationType, reason, context.principalId, version]
  );
  const action = command.operationType.slice(command.operationType.indexOf(".") + 1);
  const eventAction = action === "pause" ? "paused" : action === "resume" ? "resumed" : action === "advance" ? "advanced" :
    action === "extend" ? "extended" : action === "return" ? "returned" : action === "end" ? "ended" :
      action === "reopen" ? "reopened" : "started";
  return { status: "accepted", aggregateVersion: version, eventType: `stage.${eventAction}`,
    eventPayload: { fromStageId: current.stage_id, toStageId: targetStageId, status,
      activeSessionRoleId: context.activeSessionRoleId, version, releasedInjectIds, stateTransactionIds,
      scheduledEffectIds,
      gateExplanations: gateExplanations as unknown as JsonValue } };
}

function actionsFor(
  workflow: WorkflowDefinition,
  state: string,
  activeSessionRoleId: string,
  createdByMe: boolean,
  mayMutate: boolean
): RuntimeActionV1[] {
  return workflow.transitions
    .filter((transition) => mayMutate && transition.from === state && transition.allowedSessionRoleIds.includes(activeSessionRoleId) &&
      (transition.contentOnly !== true || createdByMe || transition.allowNonCreatorEdit === true))
    .map(asAction);
}

export function resolveRuntimeInterfaceProfile(
  value: unknown,
  activeSessionRoleId: string,
  stageId: string | null,
  correlationId: string
): RuntimeInterfaceProjectionProfile | undefined {
  const definition = runtimeDefinition(value, correlationId);
  return definition.interfaceProfiles.find((profile) => profile.sessionRoleIds.includes(activeSessionRoleId) &&
    (profile.stageIds === undefined || (stageId !== null && profile.stageIds.includes(stageId))));
}

export interface RuntimeProjectionInput {
  pool: Pool;
  principal: AuthenticatedPrincipal;
  sessionId: string;
  deviceId: string;
  correlationId: string;
}

export async function getRuntimeProjection(input: RuntimeProjectionInput): Promise<RuntimeProjectionV1> {
  return withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolveSessionAccessContext(client, input.principal, {
      sessionId: input.sessionId,
      deviceId: input.deviceId,
      correlationId: input.correlationId
    });
    const { definition, releaseLabel } = await readRelease(
      client, context.organizationId, context.activeReleaseId, input.correlationId
    );
    const actor = actorFor(definition, context);
    if (actor === undefined) {
      throw authorizationError("PERMISSION_DENIED", "The selected Seat does not grant the Active Role Context.", input.correlationId);
    }
    const stageStateResult = await client.query<StageStateRow>(
      `SELECT stage_id,status,started_at,paused_at,accumulated_pause_seconds,extension_seconds,version
         FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2`,
      [context.organizationId, context.sessionId]
    );
    const stageState = stageStateResult.rows[0];
    const stage = definition.stages.find((candidate) => candidate.id === stageState?.stage_id) ?? definition.stages[0] ?? null;
    const profile = resolveRuntimeInterfaceProfile(definition, context.activeSessionRoleId, stage?.id ?? null, input.correlationId);
    if (profile === undefined) {
      throw authorizationError("PERMISSION_DENIED", "No Interface Profile is available for the Active Role Context.", input.correlationId);
    }
    const rows = await client.query<ArtifactRow>(
      `SELECT id,artifact_type_key,state,payload,version,governing_release_id,form_version,
              creator_participant_id,visible_role_ids,owner_team_id
         FROM runtime.artifact_instances
        WHERE organization_id=$1 AND session_id=$2
          AND (creator_participant_id=$3 OR visible_role_ids && $4::text[])
        ORDER BY created_at,id`,
      [context.organizationId, context.sessionId, context.participantId, [context.activeSessionRoleId]]
    );
    const artifacts: RuntimeArtifactV1[] = rows.rows.flatMap((artifact) => {
      const artifactType = typeFor(definition, artifact.artifact_type_key);
      if (artifactType === undefined) throw new Error(`Release lacks Artifact Type ${artifact.artifact_type_key}`);
      if (!artifactAllowed(definition, artifactType, context, artifact.owner_team_id, artifact.payload, actor)) return [];
      const workflow = workflowFor(definition, artifactType);
      const state = workflow.states.find((candidate) => candidate.key === artifact.state);
      const createdByMe = artifact.creator_participant_id === context.participantId;
      return [{
        id: artifact.id,
        artifactTypeKey: artifact.artifact_type_key,
        title: artifactType.name,
        state: artifact.state,
        stateLabel: state?.label ?? artifact.state,
        payload: artifact.payload,
        version: Number(artifact.version),
        governingReleaseId: artifact.governing_release_id,
        form: asForm(formFor(definition, artifactType)),
        createdByMe,
        actions: actionsFor(workflow, artifact.state, context.activeSessionRoleId, createdByMe,
          actor.isControlRole || actor.teamId === artifact.owner_team_id)
      }];
    });
    const createTasks: RuntimeCreateTaskV1[] = definition.artifactTypes.flatMap((artifactType) => {
      if (!artifactType.allowedCreatorSessionRoleIds.includes(context.activeSessionRoleId) ||
          (artifactType.allowedTeamIds !== undefined && (actor.teamId === undefined || !artifactType.allowedTeamIds.includes(actor.teamId))) ||
          (artifactType.availableStageIds !== undefined && (stage === null || !artifactType.availableStageIds.includes(stage.id)))) return [];
      const workflow = workflowFor(definition, artifactType);
      const transition = workflow.transitions.find((candidate) => candidate.from === null &&
        candidate.allowedSessionRoleIds.includes(context.activeSessionRoleId));
      return transition === undefined ? [] : [{
        artifactTypeKey: artifactType.key,
        title: artifactType.name,
        action: asAction(transition),
        form: asForm(formFor(definition, artifactType))
      }];
    });
    const role = definition.sessionRoles.find((candidate) => candidate.id === context.activeSessionRoleId);
    if (role === undefined) throw new Error(`Release lacks Session Role ${context.activeSessionRoleId}`);
    const information = await getInformationProjection(client, context, actor, input.correlationId);
    const polls = await getPollProjection(client, context);
    const voiceChannels = await getVoiceProjection(client, context);
    return {
      contractId: RUNTIME_PROJECTION_CONTRACT_ID,
      sessionId: context.sessionId,
      sessionStatus: context.sessionStatus,
      releaseId: context.activeReleaseId,
      releaseLabel,
      participantId: context.participantId,
      activeSessionRoleId: context.activeSessionRoleId,
      activeSessionRoleLabel: role.name,
      authorityEpoch: context.authorityEpoch,
      activeTeamId: actor.teamId ?? null,
      activeTeamLabel: actor.teamLabel ?? null,
      currentStageId: stage?.id ?? null,
      currentStageLabel: stage?.label ?? null,
      currentStageStatus: stageState?.status ?? "not_started",
      stageStartedAt: stageState?.started_at?.toISOString() ?? null,
      stageDeadlineAt: stageState?.status === "active" && stageState.started_at !== null && stage?.durationSeconds !== undefined
        ? new Date(stageState.started_at.getTime() + (stage.durationSeconds + Number(stageState.extension_seconds) +
          Number(stageState.accumulated_pause_seconds)) * 1000).toISOString() : null,
      stageRemainingSeconds: stage === null ? null : remainingSeconds({
        ...stage, name: stage.name ?? stage.label, stageType: "stage", allowedActivityIds: stage.allowedActivityIds ?? [],
        transitions: stage.transitions ?? [], operatorControls: stage.operatorControls ?? {
          allowStart: false, allowEnd: false, allowReopen: false, allowExtend: false, allowSkip: false, allowReturnToPrevious: false, requireReason: true
        }, ...(stage.durationSeconds === undefined ? {} : {
          durationSeconds: stage.durationSeconds + Number(stageState?.extension_seconds ?? 0)
        })
      }, stageState?.started_at ?? null, stageState?.paused_at ?? null,
      Number(stageState?.accumulated_pause_seconds ?? 0), new Date()),
      interfaceProfileId: profile.id,
      layout: profile.layout,
      modules: [...profile.modules].sort((left, right) => left.id.localeCompare(right.id)),
      createTasks,
      artifacts,
      ...information,
      polls,
      voiceChannels
    };
  });
}

export async function submitArtifactCommand(
  pool: Pool,
  context: SessionAccessContextV1,
  command: CommandEnvelopeV1,
  correlationId: string,
  deploymentId: string
) {
  return processSessionCommand({
    pool,
    context,
    command,
    correlationId,
    deploymentId,
    lockAggregateAndExecute: executeArtifactCommand
  });
}

export async function submitRuntimeCommand(
  pool: Pool,
  context: SessionAccessContextV1,
  command: CommandEnvelopeV1,
  correlationId: string,
  deploymentId: string,
  extensionRunPlans: ReadonlyMap<string, ExtensionRunPlan> = new Map(),
  mediaAdapter?: MediaProviderAdapter
) {
  const execute = command.operationType.startsWith("stage.") || command.operationType.startsWith("timer.") ? executeStageCommand :
    command.operationType.startsWith("artifact.") ? executeArtifactCommand :
      command.operationType.startsWith("adjudication.") ? executeAdjudicationCommand :
      command.operationType.startsWith("message.") || command.operationType.startsWith("inject.") ? executeInformationCommand :
      command.operationType === "composition_run.start" ? createCompositionRunExecutor(extensionRunPlans) :
      command.operationType.startsWith("effect_proposal.") ? executeEffectProposalCommand :
      command.operationType.startsWith("poll.") || command.operationType === "ballot.cast" ? executeVotingCommand :
      command.operationType.startsWith("voice_") ? createVoiceCommandExecutor(mediaAdapter) :
      async (): Promise<CommandDecision> => ({ status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE",
        message: "This configured capability is not available in the current Runtime." });
  return processSessionCommand({ pool, context, command, correlationId, deploymentId, lockAggregateAndExecute: execute });
}
