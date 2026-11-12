import { availableFormAttachmentSql } from "../reporting/form-retention.js";
import {
  type CommandEnvelopeV1,
  type JsonObject,
  type JsonValue,
  type RuntimeActionV1,
  type RuntimeArtifactV1,
  type RuntimeArtifactHistoryV1,
  type RuntimeCreateTaskV1,
  type RuntimeFormV1,
  type RuntimeModuleV1,
  type RuntimeProjectionV1,
  type RuntimeResourceV1,
  RUNTIME_NAVIGATION_CONTRACT_ID,
  RUNTIME_PROJECTION_CONTRACT_ID
} from "@plenum/event-contracts";
import { randomUUID } from "node:crypto";
import { stageControlPresentation } from "./stage-control-presentation.js";
import { readParticipantTimeline } from "./participant-timeline.js";
import { artifactFieldAccess, visibleArtifactForm, visibleArtifactPayload, preserveProtectedArtifactValues } from "./artifact-visibility.js";
import { FORM_INTERCHANGE_CONTRACT_ID, formRecordTables, type FormRecordExportV1 } from "@plenum/simulation-schema";
import { createStoredZip, createTextPdf } from "../reporting/formats.js";
import type { Pool, PoolClient } from "pg";
import { audienceAllows, type FieldAudience } from "@plenum/policy-engine";
import { runtimeFormValue, setRuntimeFormValue, validateRuntimeFormPayload, resolveTeamCellFieldOptions, type AutomationActionV1, type GateV1,
  STRUCTURED_FORM_CONTRACT_ID, fieldEditable, recomputeFormValues, structuredPayloadIssues, type RuntimeFormDefinitionV1, type RuntimeFormFieldDefinitionV1, type RuntimeStageDefinitionV1,
  type StateVariableDefinitionV1 } from "@plenum/simulation-schema";
import { evaluateGate, nextStage, rehearseStages, remainingSeconds, resolveWorkflowTransition, type GateExplanationV1 } from "@plenum/workflow-engine";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import {
  resolveSessionAccessContext,
  type SessionAccessContextV1
} from "../identity/context.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { createCompositionRunExecutor, executeEffectProposalCommand, type ExtensionPlanRegistry } from "../extensions/runtime.js";
import { executeAdjudicationCommand } from "../adjudication/service.js";
import {
  processSessionCommand,
  type CommandDecision,
  type CommandExecutionContext,
  type PrincipalCommandExecutionContext
} from "./commands/processor.js";
import { executeInformationCommand, getInformationProjection, releaseGateInjects, releaseStageInjects } from "./information-flow.js";
import { applyCapabilityQuantityChange, applyDueStateValueChanges, applyResourceTransaction, applyStateValueChange,
  initializeWorldState, readWorldStateFacts, scheduleStateValueChange } from "./state/world-state.js";
import { executeVotingCommand, getPollProjection } from "../voting/polls.js";
import { createVoiceCommandExecutor, getVoiceProjection } from "../comms/voice.js";
import type { MediaProviderAdapter } from "@plenum/media-adapter";

type RuntimeFieldDefinition = RuntimeFormFieldDefinitionV1;
type RuntimeFormDefinition = RuntimeFormDefinitionV1 & { fields: RuntimeFieldDefinition[] };

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
  exportable?: boolean;
  retentionPolicyId?: string;
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
  teamIds?: string[];
  stageIds?: string[];
  layout: RuntimeProjectionV1["layout"];
  modules: RuntimeModuleV1[];
  regions: Array<{ id: string; moduleIds: string[] }>;
  navigationItems: Array<{ id: string; label: string; order: number; regionId: string; moduleId: string }>;
  defaultNavigationItemId?: string;
}

interface RuntimeDefinition {
  teams: Array<{ id: string; name: string }>;
  teamCells?: Array<{ id: string; name?: string; teamId: string; kind: string; enabled: boolean }>;
  sessionRoles: Array<{ id: string; name: string; capabilities?: Array<{ capability: string }>; isControlRole?: boolean }>;
  seats: Array<{ id: string; name?: string; sessionRoleIds: string[]; teamId?: string }>;
  informationPolicies: Array<{ id: string; grants: Array<{ audience: FieldAudience; fieldsExcluded?: string[] }> }>;
  stateVariables?: StateVariableDefinitionV1[];
  capabilities?: Array<{ id: string; name?: string; informationPolicyId: string; initialState: string; mode?: "boolean" | "counted";
    initialQuantity?: number; maximumQuantity?: number; renewal?: { everyStageType: string; amount: number } }>;
  resourceDefinitions?: Array<{ id: string; name?: string; informationPolicyId: string; replenishment?: { everyStageType?: string; amount: number } }>;
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
  simulationTitle: string;
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
    const selectors = isRecord(profile.selectors) ? profile.selectors : {};
    const layout = isRecord(profile.layout) ? profile.layout : {};
    const template = layout.template;
    const layoutName = template === "main_sidebar" ? "main_with_sidebar" :
      template === "dashboard" ? "dashboard_grid" : template === "workspace" ? "workspace_tabs" : "single_column";
    const sourceRegions = Array.isArray(layout.regions) ? layout.regions.filter(isRecord) : [];
    const modules = sourceRegions.flatMap((region) => Array.isArray(region.modules) ? region.modules.filter(isRecord).map((module) => {
      const configuration = isRecord(module.configuration) ? module.configuration : {};
      return {
        id: module.id,
        type: module.moduleType,
        title: module.title ?? module.id,
        mode: configuration.mode ?? "read",
        emptyStateText: configuration.emptyStateText ?? "Nothing is available.",
        configuration
      };
    }) : []);
    const regions = sourceRegions.map((region, index) => ({
      id: typeof region.id === "string" && region.id.length > 0 ? region.id : `region-${index + 1}`,
      moduleIds: Array.isArray(region.modules) ? region.modules.filter(isRecord)
        .flatMap((module) => typeof module.id === "string" ? [module.id] : []) : []
    }));
    const navigation = isRecord(profile.navigation) ? profile.navigation : {};
    const navigationItems = (Array.isArray(navigation.items) ? navigation.items.filter(isRecord) : []).flatMap((item, index) => {
      const target = isRecord(item.target) ? item.target : {};
      const regionId = typeof target.regionId === "string" ? target.regionId : regions[0]?.id;
      const region = regions.find((candidateRegion) => candidateRegion.id === regionId);
      const moduleId = typeof target.moduleId === "string" ? target.moduleId : region?.moduleIds[0];
      return typeof item.id === "string" && typeof item.label === "string" && regionId !== undefined && moduleId !== undefined
        ? [{ id: item.id, label: item.label, order: typeof item.order === "number" ? item.order : index + 1, regionId, moduleId }]
        : [];
    }).sort((left, right) => left.order - right.order);
    return {
      id: profile.id,
      sessionRoleIds: selectors.sessionRoleIds,
      teamIds: selectors.teamIds,
      stageIds: selectors.stageIds,
      layout: layoutName,
      modules,
      regions,
      navigationItems: navigationItems.length > 0 ? navigationItems : modules.slice(0, 1).map((module) => ({
        id: `navigation-${String(module.id)}`, label: String(module.title), order: 1,
        regionId: regions[0]?.id ?? "main", moduleId: String(module.id)
      })),
      defaultNavigationItemId: navigation.defaultItemId
    };
  }) : Array.isArray(design.interfaceProfiles) ? design.interfaceProfiles.map((candidate) => {
    const profile = candidate as Record<string, unknown>;
    const modules: Array<Record<string, unknown>> = Array.isArray(profile.modules) ? profile.modules.map((candidateModule) => {
      const module = candidateModule as Record<string, unknown>;
      return { ...module, configuration: isRecord(module.configuration) ? module.configuration : {} };
    }) : [];
    return {
      ...profile,
      modules,
      regions: [{ id: "main", moduleIds: modules.flatMap((module) => typeof module.id === "string" ? [module.id] : []) }],
      navigationItems: modules.flatMap((module, index) => typeof module.id === "string" && typeof module.title === "string"
        ? [{ id: `navigation-${module.id}`, label: module.title, order: index + 1, regionId: "main", moduleId: module.id }] : [])
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
    const identity = isRecord(snapshot.identity) ? snapshot.identity : {};
    return {
      definition: runtimeDefinition(row.snapshot, correlationId),
      releaseLabel: row.release_label,
      simulationTitle: typeof identity.title === "string" && identity.title.length > 0 ? identity.title
        : typeof scenario.name === "string" && scenario.name.length > 0 ? scenario.name : row.release_label,
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
  return { ...form, fields: form.fields.map((field) => resolveTeamCellFieldOptions(field, definition.teamCells ?? [])),
    sections: form.sections.map((section) => ({ ...section, fields: section.fields.map((field) => resolveTeamCellFieldOptions(field, definition.teamCells ?? [])) })) };
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
  context: SessionAccessContextV1 | PrincipalCommandExecutionContext["context"],
  artifact?: { state: string; typeKey: string; payload: JsonObject; ownerTeamId?: string },
  governingReleaseId?: string
): Promise<Record<string, boolean | number | string>> {
  await initializeWorldState(client, {
    organizationId: context.organizationId, sessionId: context.sessionId,
    governingReleaseId: "activeReleaseId" in context ? context.activeReleaseId : governingReleaseId ?? ""
  }, definition, initial);
  await applyDueStateValueChanges(client, context, definition.stateVariables ?? []);
  const actor = "activeSessionRoleId" in context ? actorFor(definition, context) : undefined;
  const visible = (policyId: string): boolean => {
    if (!("activeSessionRoleId" in context)) return true;
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
  if ("activeSessionRoleId" in context) facts["actor.sessionRoleId"] = context.activeSessionRoleId;
  if (actor?.teamId !== undefined) facts["actor.teamId"] = actor.teamId;
  facts["time.wallClock"] = clock.rows[0]?.now.toISOString() ?? new Date(0).toISOString();
  if (artifact !== undefined) {
    facts["artifact.status"] = artifact.state;
    facts["artifact.typeKey"] = artifact.typeKey;
    const artifactPolicyId = definition.artifactTypes.find(({ key }) => key === artifact.typeKey)?.informationPolicyId;
    const artifactGrants = !("activeSessionRoleId" in context) ? [] : definition.informationPolicies.find(({ id }) => id === artifactPolicyId)?.grants.filter(({ audience }) =>
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

function artifactGrants(
  definition: RuntimeDefinition,
  type: ArtifactTypeDefinition,
  context: SessionAccessContextV1,
  ownerTeamId: string | null,
  payload: JsonObject,
  actor: { teamId?: string; isControlRole: boolean }
): Array<{ fieldsExcluded?: string[] }> {
  const policy = definition.informationPolicies.find((candidate) => candidate.id === type.informationPolicyId);
  if (policy === undefined) return [];
  return policy.grants.filter((grant) => audienceAllows({
    organizationId: context.organizationId,
    sessionId: context.sessionId,
    participantId: context.participantId,
    activeSessionRoleId: context.activeSessionRoleId,
    ...(actor.teamId === undefined ? {} : { activeTeamId: actor.teamId }),
    isControlRole: actor.isControlRole,
    organizationRoles: []
  }, grant.audience, ownerTeamId ?? undefined, payload));
}

function artifactAllowed(...args: Parameters<typeof artifactGrants>): boolean { return artifactGrants(...args).length > 0; }

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
  input: CommandExecutionContext | PrincipalCommandExecutionContext,
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
  input: CommandExecutionContext | PrincipalCommandExecutionContext,
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

function asForm(form: RuntimeFormDefinition, cells: NonNullable<RuntimeDefinition["teamCells"]> = [], sessionRoleId = "", state = ""): RuntimeFormV1 {
  const field = (source: RuntimeFieldDefinition): RuntimeFormV1["fields"][number] => {
    const item = resolveTeamCellFieldOptions(source, cells);
    return ({
    key: item.key,
    label: item.label,
    type: item.type === "short_text" ? "text" : item.type,
    required: item.required === true,
    ...(form.contractId === undefined || item.defaultValue === undefined ? {} : { defaultValue: item.defaultValue }),
    ...(item.requiredWhen === undefined ? {} : { requiredWhen: item.requiredWhen }),
    ...(item.visibleWhen === undefined ? {} : { visibleWhen: item.visibleWhen }),
    ...(item.helpText === undefined ? {} : { helpText: item.helpText }),
    ...(item.control === undefined ? {} : { control: item.control }),
    ...(item.options === undefined ? {} : { options: item.options }),
    ...(form.contractId === undefined ? item.readOnly === undefined ? {} : { readOnly: item.readOnly } : { readOnly: !fieldEditable(item, sessionRoleId, state) }),
    ...(item.numeric === undefined ? {} : { numeric: item.numeric }),
    ...(item.computation === undefined ? {} : { computation: item.computation }),
    ...(item.formattedTextContractId === undefined ? {} : { formattedTextContractId: item.formattedTextContractId }),
    ...(item.entityReference === undefined ? {} : { entityReference: item.entityReference }),
    ...(item.validation === undefined ? {} : { validation: item.validation })
  }); };
  return {
    id: form.id,
    name: form.name,
    formVersion: form.formVersion,
    ...(form.attachments ? { attachments: form.attachments } : {}),
    ...(form.contractId === undefined ? {} : { contractId: form.contractId }),
    ...(form.layout === undefined ? {} : { layout: form.layout }),
    fields: form.fields.map(field),
    sections: form.sections.map((section) => ({
      id: section.id,
      ...(section.title === undefined ? {} : { title: section.title }),
      ...(section.description === undefined ? {} : { description: section.description }),
      ...(section.page === undefined ? {} : { page: section.page }),
      ...(section.columns === undefined ? {} : { columns: section.columns }),
      ...(section.collapsed === undefined ? {} : { collapsed: section.collapsed }),
      ...(section.table === undefined ? {} : { table: section.table }),
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

async function authorizedForm(client: PoolClient, context: SessionAccessContextV1, definition: RuntimeDefinition,
  type: ArtifactTypeDefinition, actor: { teamId?: string; isControlRole: boolean }): Promise<RuntimeFormDefinition> {
  const authored = formFor(definition, type);
  if (authored.contractId !== STRUCTURED_FORM_CONTRACT_ID) return authored;
  const form = structuredClone(authored);
  let references: ArtifactRow[] = [];
  if (form.fields.some((field) => field.entityReference?.kind === "artifact" || field.type === "artifact_reference")) {
    references = (await client.query<ArtifactRow>(`SELECT id,artifact_type_key,state,payload,version,governing_release_id,form_version,
      creator_participant_id,visible_role_ids,owner_team_id FROM runtime.artifact_instances
      WHERE organization_id=$1 AND session_id=$2 AND (creator_participant_id=$3 OR visible_role_ids && $4::text[])
      ORDER BY created_at,id LIMIT 1000`, [context.organizationId, context.sessionId, context.participantId, [context.activeSessionRoleId]])).rows;
  }
  const acceptedSources = form.fields.some((field) => field.type === "artifact_reference") ? new Set((await client.query<{ source_artifact_id: string }>(
    `SELECT DISTINCT source_artifact_id FROM runtime.message_threads WHERE organization_id=$1 AND session_id=$2
      AND recipient_team_id=$3 AND accepted_at IS NOT NULL`, [context.organizationId, context.sessionId, actor.teamId ?? null])).rows.map(({ source_artifact_id }) => source_artifact_id)) : new Set<string>();
  for (const field of form.sections.flatMap((section) => section.fields)) {
    if (field.type !== "artifact_reference" && (field.type !== "entity_reference" || !field.entityReference)) continue;
    const kind = field.type === "artifact_reference" ? "artifact" : field.entityReference!.kind;
    if (kind === "artifact") {
      field.options = references.flatMap((row) => {
        const source = typeFor(definition, row.artifact_type_key);
        return source && (field.type !== "artifact_reference" || (acceptedSources.has(row.id) && field.reference?.sourceArtifactTypeIds.includes(source.id))) && artifactAllowed(definition, source, context, row.owner_team_id, row.payload, actor)
          ? [{ value: row.id, label: `${source.name} (${row.state})` }] : [];
      });
    } else {
      const candidates = kind === "team" ? definition.teams : kind === "session_role" ? definition.sessionRoles : kind === "stage" ? definition.stages
        : kind === "resource" ? definition.resourceDefinitions ?? [] : kind === "capability" ? definition.capabilities ?? [] : definition.stateVariables ?? [];
      field.options = candidates.filter((candidate) => !("informationPolicyId" in candidate) || artifactAllowed(definition,
        { ...type, informationPolicyId: candidate.informationPolicyId }, context, actor.teamId ?? null, {}, actor))
        .map((candidate) => ({ value: candidate.id, label: candidate.name ?? ("label" in candidate ? candidate.label : candidate.id) }));
    }
  }
  form.fields = form.sections.flatMap((section) => section.fields);
  return form;
}

function formEditIssues(form: RuntimeFormDefinition, before: JsonObject, after: JsonObject, sessionRoleId: string, state: string): string[] {
  if (form.contractId !== STRUCTURED_FORM_CONTRACT_ID) return [];
  const issues: string[] = [];
  for (const section of form.sections) {
    const oldEntries = section.repeatable ? (Array.isArray(before[section.id]) ? before[section.id] as JsonObject[] : []) : [before];
    const newEntries = section.repeatable ? (Array.isArray(after[section.id]) ? after[section.id] as JsonObject[] : []) : [after];
    for (const field of section.fields.filter((field) => !field.computation && !fieldEditable(field, sessionRoleId, state))) {
      for (let index = 0; index < Math.max(oldEntries.length, newEntries.length); index += 1) {
        const previous = runtimeFormValue(oldEntries[index] ?? {}, field.key) ?? field.defaultValue ?? "";
        const next = runtimeFormValue(newEntries[index] ?? {}, field.key) ?? field.defaultValue ?? "";
        if (JSON.stringify(previous) !== JSON.stringify(next)) issues.push(`${field.label} cannot be changed in this Role and Workflow state`);
      }
    }
  }
  return issues;
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
  if (command.payload.content !== undefined && jsonPayload(command.payload.content) === undefined) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Record content must be one object. Create separate Decision Records for separate Actions." };
  }
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
    let content = jsonPayload(command.payload.content) ?? {};
    try { content = preserveProtectedArtifactValues({}, content, artifactFieldAccess(artifactGrants(definition, artifactType, context, actor.teamId ?? null, content, actor))); }
    catch { return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "A supplied field is unavailable in this role context." }; }
    const form = await authorizedForm(client, context, definition, artifactType, actor);
    if (form.contractId !== undefined) {
      const structureIssues = structuredPayloadIssues(form, content);
      if (structureIssues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: structureIssues.map(({ message }) => message).join("; ") };
      for (const section of form.sections) {
        const entries = section.repeatable ? (Array.isArray(content[section.id]) ? content[section.id] as JsonObject[] : []) : [content];
        for (const entry of entries) if (isRecord(entry)) for (const field of section.fields) {
          if (runtimeFormValue(entry, field.key) === undefined && field.defaultValue !== undefined) setRuntimeFormValue(entry, field.key, structuredClone(field.defaultValue));
        }
      }
      const computed = recomputeFormValues(form, content);
      if (computed.issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: computed.issues.map(({ message }) => message).join("; ") };
      content = computed.payload as JsonObject;
      const edits = formEditIssues(form, {}, content, context.activeSessionRoleId, transition.to);
      if (edits.length > 0) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: edits.join("; ") };
      const issues = validateRuntimeFormPayload(form, content, { draft: workflow.states.find((state) => state.key === transition.to)?.kind === "draft" });
      if (issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: issues.map((issue) => issue.message).join("; ") };
    }
    if (workflow.states.find((state) => state.key === transition.to)?.kind !== "draft") {
      const issues = validateRuntimeFormPayload(form, content);
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
  if (!mayMutateArtifact(actor, artifact, context.participantId)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only the record owner or Control may change this Artifact." };
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
  const suppliedContent = jsonPayload(command.payload.content);
  let authorizedContent: JsonObject | undefined;
  if (suppliedContent !== undefined) {
    try { authorizedContent = preserveProtectedArtifactValues(artifact.payload, suppliedContent,
      artifactFieldAccess(artifactGrants(definition, artifactType, context, artifact.owner_team_id, artifact.payload, actor))); }
    catch (error) { return { status: "rejected", errorCode: "PERMISSION_DENIED", message: error instanceof Error ? error.message : "A supplied field is unavailable." }; }
  }
  if (transition.editableFieldKeys !== undefined) {
    const content = authorizedContent;
    if (content === undefined) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Artifact content must be an object." };
    payload = structuredClone(artifact.payload);
    for (const key of transition.editableFieldKeys) {
      const value = runtimeFormValue(content, key);
      if (value === undefined || value === null || value === "") {
        return { status: "rejected", errorCode: "VALIDATION_FAILED", message: `${key} is required.` };
      }
      setRuntimeFormValue(payload, key, value);
    }
    const issues = formFor(definition, artifactType).contractId === undefined ? validateRuntimeFormPayload(formFor(definition, artifactType), payload)
      .filter((issue) => transition.editableFieldKeys?.includes(issue.field)) : [];
    if (issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: issues.map((issue) => issue.message).join("; ") };
  } else if (transition.contentOnly === true) {
    const content = authorizedContent;
    if (content === undefined) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Artifact content must be an object." };
    payload = content;
  } else {
    const state = workflow.states.find((candidate) => candidate.key === artifact.state);
    if (state?.kind === "draft" && formFor(definition, artifactType).contractId === undefined) {
      const issues = validateRuntimeFormPayload(formFor(definition, artifactType), payload);
      if (issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: issues.map((issue) => issue.message).join("; ") };
    }
  }
  if (!await acceptedProposalReferencesValid(client, context, definition, artifactType, actor.teamId, payload)) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "An accepted proposal reference is invalid or unavailable to this Team." };
  }
  const form = await authorizedForm(client, context, definition, artifactType, actor);
  if (form.contractId !== undefined) {
    const structureIssues = structuredPayloadIssues(form, payload);
    if (structureIssues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: structureIssues.map(({ message }) => message).join("; ") };
    const computed = recomputeFormValues(form, payload);
    if (computed.issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: computed.issues.map(({ message }) => message).join("; ") };
    payload = computed.payload as JsonObject;
    const edits = formEditIssues(form, artifact.payload, payload, context.activeSessionRoleId, artifact.state);
    if (edits.length > 0) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: edits.join("; ") };
    const issues = validateRuntimeFormPayload(form, payload, { draft: workflow.states.find((state) => state.key === transition.to)?.kind === "draft" });
    if (issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: issues.map((issue) => issue.message).join("; ") };
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

export async function executeStageCommand(
  input: CommandExecutionContext | PrincipalCommandExecutionContext,
  operatorAuthority = false
): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (command.governingReleaseId !== activeReleaseId) {
    return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "Stage controls use the active Release." };
  }
  if (command.aggregateId !== context.sessionId) {
    return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Stage aggregate was not found." };
  }
  const { definition, initial } = await readRelease(client, context.organizationId, activeReleaseId, command.commandId);
  const role = definition.sessionRoles.find((candidate) => candidate.id === ("activeSessionRoleId" in context ? context.activeSessionRoleId : undefined));
  const capability = command.operationType === "stage.advance" || command.operationType === "stage.return"
    ? "stage.advance" : "timer.control";
  if (!operatorAuthority && !role?.capabilities?.some((grant) => grant.capability === capability)) {
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
    const evaluation = evaluateGate(gate, await runtimeGateFacts(client, definition, initial, context, undefined, activeReleaseId));
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
    if (!await completionRequirementsSatisfied(client, context as SessionAccessContextV1, definition, stage)) {
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
    if (!stage.operatorControls?.allowSkip && !await completionRequirementsSatisfied(client, context as SessionAccessContextV1, definition, stage)) {
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
        facts: await runtimeGateFacts(client, definition, initial, context, undefined, activeReleaseId), startedAt: now.toISOString(), seed: 0 });
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
      if (triggeredStage !== undefined) automationResults.push(await applyAutomationEffects(input as CommandExecutionContext, definition,
        match?.[2] === "entry" ? triggeredStage.onEnter : triggeredStage.onExit, "stage", trigger, reason));
    }
    enteredStageIds.push(...parallelEntryStageIds);
  } else if (command.operationType === "stage.advance" || command.operationType === "stage.return") {
    automationResults.push(await applyAutomationEffects(input as CommandExecutionContext, definition, stage.onExit, "stage", `${stage.id}.exit`, reason));
    automationResults.push(await applyAutomationEffects(input as CommandExecutionContext, definition,
      definition.stages.find(({ id }) => id === targetStageId)?.onEnter, "stage", `${targetStageId}.entry`, reason));
    enteredStageIds.push(targetStageId);
  } else if (command.operationType === "stage.start") {
    automationResults.push(await applyAutomationEffects(input as CommandExecutionContext, definition, stage.onEnter, "stage", `${stage.id}.entry`, reason));
    enteredStageIds.push(stage.id);
  }
  const stateTransactionIds = [
    ...automationResults.flatMap(({ transactionIds }) => transactionIds),
    ...await applyStageRenewals(input as CommandExecutionContext, definition, enteredStageIds, reason)
  ];
  const scheduledEffectIds = automationResults.flatMap((result) => result.scheduledEffectIds);
  const releaseParallelInjects = async (): Promise<string[]> => {
    const ids: string[] = [];
    for (const stageId of parallelExitStageIds) ids.push(...await releaseStageInjects(input as CommandExecutionContext, "stage_exit", stageId));
    for (const stageId of parallelEntryStageIds) ids.push(...await releaseStageInjects(input as CommandExecutionContext, "stage_entry", stageId));
    ids.push(...await releaseGateInjects(input));
    return ids;
  };
  const releasedInjectIds = parallelExecution
    ? await releaseParallelInjects()
    : command.operationType === "stage.advance" || command.operationType === "stage.return"
    ? [
        ...await releaseStageInjects(input as CommandExecutionContext, "stage_exit", current.stage_id),
        ...await releaseStageInjects(input as CommandExecutionContext, "stage_entry", targetStageId),
        ...await releaseGateInjects(input)
      ]
    : command.operationType === "stage.start"
      ? [...await releaseStageInjects(input as CommandExecutionContext, "stage_entry", targetStageId), ...await releaseGateInjects(input)]
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
      activeSessionRoleId: "activeSessionRoleId" in context ? context.activeSessionRoleId : null, version, releasedInjectIds, stateTransactionIds,
      scheduledEffectIds,
      gateExplanations: gateExplanations as unknown as JsonValue } };
}

export function mayMutateArtifact(
  actor: { isControlRole: boolean; teamId?: string },
  artifact: { owner_team_id: string | null; creator_participant_id: string },
  participantId: string
): boolean {
  return actor.isControlRole || (artifact.owner_team_id === null
    ? actor.teamId === undefined && artifact.creator_participant_id === participantId
    : actor.teamId === artifact.owner_team_id);
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
  correlationId: string,
  activeTeamId: string | null = null
): RuntimeInterfaceProjectionProfile | undefined {
  const definition = runtimeDefinition(value, correlationId);
  return definition.interfaceProfiles.find((profile) => profile.sessionRoleIds.includes(activeSessionRoleId) &&
    (profile.teamIds === undefined || (activeTeamId !== null && profile.teamIds.includes(activeTeamId))) &&
    (profile.stageIds === undefined || (stageId !== null && profile.stageIds.includes(stageId))));
}

function profileResourceIds(profile: RuntimeInterfaceProjectionProfile): string[] {
  return [...new Set(profile.modules.flatMap((module) => {
    const releaseResourceId = module.configuration.releaseResourceId;
    const resourceIds = module.configuration.resourceIds;
    return [
      ...(typeof releaseResourceId === "string" ? [releaseResourceId] : []),
      ...(Array.isArray(resourceIds) ? resourceIds.filter((id): id is string => typeof id === "string") : [])
    ];
  }))];
}

async function readRuntimeResourceMetadata(
  client: PoolClient,
  organizationId: string,
  releaseId: string,
  resourceIds: string[]
): Promise<RuntimeResourceV1[]> {
  if (resourceIds.length === 0) return [];
  const result = await client.query<{ id: string; name: string; type: string; media_type: string; alt_text: string | null }>(
    `SELECT resource->>'id' AS id,resource->>'name' AS name,resource->>'type' AS type,
            resource->>'mediaType' AS media_type,resource->>'altText' AS alt_text
       FROM registry.releases release
       JOIN studio.definition_revisions revision
         ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
       CROSS JOIN LATERAL jsonb_array_elements(
         COALESCE(revision.snapshot #> '{coreDesign,resources}',revision.snapshot->'resources','[]'::jsonb)
       ) resource
      WHERE release.organization_id=$1 AND release.id=$2 AND resource->>'id'=ANY($3::text[])
      ORDER BY resource->>'name',resource->>'id'`,
    [organizationId, releaseId, resourceIds]
  );
  return result.rows.map((resource) => ({
    id: resource.id,
    name: resource.name,
    type: resource.type,
    mediaType: resource.media_type,
    ...(resource.alt_text === null ? {} : { altText: resource.alt_text })
  }));
}

export interface RuntimeProjectionInput {
  pool: Pool;
  principal: AuthenticatedPrincipal;
  sessionId: string;
  deviceId: string;
  correlationId: string;
  activeSessionRoleId?: string;
  timelineBefore?: number;
}

/** File operations reuse the record's pinned Release, Information Policy and normal edit transition. */
export async function authorizeArtifactFile(client: PoolClient, context: SessionAccessContextV1, artifactId: string, correlationId: string, write = false) {
  const rows = await client.query<ArtifactRow>("SELECT * FROM runtime.artifact_instances WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE",
    [context.organizationId, context.sessionId, artifactId]);
  const artifact = rows.rows[0];
  if (!artifact || (artifact.creator_participant_id !== context.participantId && !artifact.visible_role_ids.includes(context.activeSessionRoleId))) throw authorizationError("TARGET_NOT_FOUND", "The Artifact was not found.", correlationId);
  const { definition, initial } = await readRelease(client, context.organizationId, artifact.governing_release_id, correlationId);
  const type = typeFor(definition, artifact.artifact_type_key), actor = actorFor(definition, context);
  if (!type || !actor || !artifactAllowed(definition, type, context, artifact.owner_team_id, artifact.payload, actor)) throw authorizationError("TARGET_NOT_FOUND", "The Artifact was not found.", correlationId);
  const form = formFor(definition, type);
  if (!form.attachments || !type.retentionPolicyId) throw authorizationError("CAPABILITY_UNAVAILABLE", "Attachments are not enabled for this Form version.", correlationId);
  if (write) {
    if (context.sessionStatus !== "active" || !mayMutateArtifact(actor, artifact, context.participantId)) throw authorizationError("PERMISSION_DENIED", "This record cannot be changed in the current context.", correlationId);
    const transition = transitionFor(workflowFor(definition, type), artifact.state, "artifact.edit", context.activeSessionRoleId,
      await runtimeGateFacts(client, definition, initial, context, { state: artifact.state, typeKey: artifact.artifact_type_key, payload: artifact.payload,
        ...(artifact.owner_team_id ? { ownerTeamId: artifact.owner_team_id } : {}) }));
    if (isDecision(transition) || !transition.contentOnly || transition.editableFieldKeys !== undefined ||
        (artifact.creator_participant_id !== context.participantId && !transition.allowNonCreatorEdit)) throw authorizationError("PERMISSION_DENIED", "Attachments require permission to edit this record.", correlationId);
  }
  const session = await client.query<{ project_id: string }>("SELECT project_id FROM runtime.sessions WHERE organization_id=$1 AND id=$2", [context.organizationId, context.sessionId]);
  return { artifact, form, retentionPolicyId: type.retentionPolicyId, artifactTypeId: type.id, projectId: session.rows[0]!.project_id };
}

export async function executeArtifactFileCommand(input: CommandExecutionContext, scan: { status: "clean" | "infected" | "failed"; detail: string }): Promise<CommandDecision> {
  const { client, context, command } = input;
  let access: Awaited<ReturnType<typeof authorizeArtifactFile>>;
  try { access = await authorizeArtifactFile(client, context, command.aggregateId, command.commandId, true); }
  catch (error) {
    if (error instanceof Error && "envelope" in error) {
      const envelope = (error as import("../errors.js").AuthorizationError).envelope;
      return { status: "rejected", errorCode: envelope.error.code, message: envelope.error.message };
    }
    throw error;
  }
  const { artifact } = access;
  if (artifact.governing_release_id !== command.governingReleaseId) return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "The Artifact is governed by another Release." };
  if (Number(artifact.version) !== command.expectedAggregateVersion) return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: "Refresh the record before attaching this file." };
  const rescan = command.operationType === "artifact.rescan_file";
  const updated = await client.query(
    `UPDATE runtime.form_attachments SET upload_state='attached',scan_status=$1,scan_detail=$2,attached_at=coalesce(attached_at,transaction_timestamp())
      WHERE organization_id=$3 AND artifact_id=$4 AND id=$5 AND sha256=$6 AND created_by=$7
        AND (($8::boolean AND upload_state='attached' AND scan_status='failed') OR (NOT $8 AND upload_state='pending')) RETURNING id`,
    [scan.status, scan.detail, context.organizationId, artifact.id, command.payload.attachmentId, command.payload.sha256, context.principalId, rescan]);
  if (updated.rowCount !== 1) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "This upload is already attached, unavailable, or awaiting recovery." };
  const version = Number(artifact.version) + 1;
  await client.query("UPDATE runtime.artifact_instances SET version=$1,updated_at=transaction_timestamp() WHERE organization_id=$2 AND id=$3", [version, context.organizationId, artifact.id]);
  await recordArtifactRevision(client, context, command, { id: artifact.id, version, governingReleaseId: artifact.governing_release_id, state: artifact.state, payload: artifact.payload }, [context.participantId]);
  return { status: "accepted", aggregateVersion: version, eventType: rescan ? "artifact.attachment_rescanned" : "artifact.attachment_added",
    eventPayload: { artifactId: artifact.id, attachmentId: command.payload.attachmentId!, sha256: command.payload.sha256!, scanStatus: scan.status, version } };
}

export async function exportRuntimeArtifact(input: RuntimeProjectionInput & { artifactId: string; format: "json" | "csv" | "pdf" }): Promise<{ bytes: Uint8Array; mediaType: string; fileName: string }> {
  return withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolveSessionAccessContext(client, input.principal, { sessionId: input.sessionId, deviceId: input.deviceId,
      correlationId: input.correlationId, ...(input.activeSessionRoleId ? { requestedActiveSessionRoleId: input.activeSessionRoleId } : {}) });
    const row = await client.query<ArtifactRow>("SELECT * FROM runtime.artifact_instances WHERE organization_id=$1 AND session_id=$2 AND id=$3",
      [context.organizationId, context.sessionId, input.artifactId]);
    const artifact = row.rows[0];
    if (!artifact || (artifact.creator_participant_id !== context.participantId && !artifact.visible_role_ids.includes(context.activeSessionRoleId))) {
      throw authorizationError("TARGET_NOT_FOUND", "The Artifact was not found.", input.correlationId);
    }
    const { definition } = await readRelease(client, context.organizationId, artifact.governing_release_id, input.correlationId);
    const type = typeFor(definition, artifact.artifact_type_key), actor = actorFor(definition, context);
    if (!type || !actor || type.exportable !== true || !artifactAllowed(definition, type, context, artifact.owner_team_id, artifact.payload, actor)) {
      throw authorizationError("PERMISSION_DENIED", "Export is unavailable in this role context.", input.correlationId);
    }
    const allows = artifactFieldAccess(artifactGrants(definition, type, context, artifact.owner_team_id, artifact.payload, actor));
    const form = visibleArtifactForm(await authorizedForm(client, context, definition, type, actor), allows);
    const record: FormRecordExportV1 = { contractId: FORM_INTERCHANGE_CONTRACT_ID, kind: "record", artifactId: artifact.id,
      governingReleaseId: artifact.governing_release_id, formId: form.id, formVersion: artifact.form_version,
      payload: visibleArtifactPayload(artifact.payload, allows) };
    if (form.attachments) {
      const files = await client.query<{ id: string; file_name: string; media_type: string; size_bytes: number; sha256: string; scan_status: "clean" | "infected" | "failed"; retention_policy_id: string; expires_at: Date }>(
        `SELECT id,file_name,media_type,size_bytes,sha256,scan_status,retention_policy_id,expires_at FROM runtime.form_attachments WHERE organization_id=$1 AND artifact_id=$2 AND ${availableFormAttachmentSql} ORDER BY created_at,id`,
        [context.organizationId, artifact.id]);
      if (files.rows.length) record.attachmentManifest = { bytesIncluded: false, files: files.rows.map((file) => ({ id: file.id, fileName: file.file_name,
        mediaType: file.media_type, sizeBytes: file.size_bytes, sha256: file.sha256, scanStatus: file.scan_status, retentionPolicyId: file.retention_policy_id, expiresAt: file.expires_at.toISOString() })) };
    }
    const json = new TextEncoder().encode(JSON.stringify(record, null, 2));
    if (input.format === "json") return { bytes: json, mediaType: "application/json", fileName: "record.json" };
    if (input.format === "csv") return { bytes: createStoredZip([
      { path: "record.json", bytes: json },
      ...formRecordTables(form, [record]).map((table) => ({ path: table.name, bytes: new TextEncoder().encode(table.csv) }))
    ]), mediaType: "application/zip", fileName: "record-tables.zip" };
    const lines = [type.name, `Record: ${artifact.id}`, `Form: ${form.name} / ${record.formVersion}`, `Release: ${record.governingReleaseId}`, ""];
    if (record.attachmentManifest) lines.push("Attachments (download clean files separately)", ...record.attachmentManifest.files.map((file) => `${file.fileName}: ${file.sizeBytes} bytes, ${file.scanStatus}, SHA-256 ${file.sha256}`), "");
    for (const section of form.sections) {
      lines.push(section.title ?? "Details");
      const entries = section.repeatable ? record.payload[section.id] : [record.payload];
      if (Array.isArray(entries)) entries.forEach((entry, index) => {
        if (!isRecord(entry)) return;
        if (section.repeatable) lines.push(`${section.itemLabel ?? "Entry"} ${index + 1}`);
        for (const field of section.fields) {
          const value = runtimeFormValue(entry, field.key);
          lines.push(`${field.label}: ${typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "")}`);
        }
      });
      lines.push("");
    }
    if (lines.some((line) => /[^\x20-\x7e\n\r\t]/u.test(line))) throw authorizationError("CAPABILITY_UNAVAILABLE", "PDF cannot render this record’s characters. Use JSON or linked CSV tables to preserve the text.", input.correlationId);
    return { bytes: createTextPdf(lines.flatMap((line) => line.replaceAll("\t", "    ").split(/\r?\n/u))), mediaType: "application/pdf", fileName: "record.pdf" };
  });
}

export async function getRuntimeArtifactHistory(input: RuntimeProjectionInput & { artifactId: string; beforeVersion?: number }): Promise<RuntimeArtifactHistoryV1> {
  return withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolveSessionAccessContext(client, input.principal, {
      sessionId: input.sessionId, deviceId: input.deviceId, correlationId: input.correlationId,
      ...(input.activeSessionRoleId === undefined ? {} : { requestedActiveSessionRoleId: input.activeSessionRoleId })
    });
    const { definition } = await readRelease(client, context.organizationId, context.activeReleaseId, input.correlationId);
    const actor = actorFor(definition, context);
    const stage = await client.query<{ stage_id: string }>(`SELECT stage_id FROM runtime.session_stage_state WHERE organization_id=$1 AND session_id=$2`, [context.organizationId, context.sessionId]);
    const profile = resolveRuntimeInterfaceProfile(definition, context.activeSessionRoleId, stage.rows[0]?.stage_id ?? null, input.correlationId, actor?.teamId ?? null);
    const history = profile?.modules.find((module) => module.configuration.presentation === "history");
    const states = history?.configuration.historyStates;
    const result = await client.query<ArtifactRow>(`SELECT * FROM runtime.artifact_instances WHERE organization_id=$1 AND session_id=$2 AND id=$3`,
      [context.organizationId, context.sessionId, input.artifactId]);
    const artifact = result.rows[0];
    const type = artifact === undefined ? undefined : typeFor(definition, artifact.artifact_type_key);
    const keys = history?.configuration.artifactTypeKeys;
    if (!actor?.isControlRole || !Array.isArray(states) || !states.every((state) => typeof state === "string") ||
      artifact === undefined || type === undefined || (Array.isArray(keys) && !keys.includes(artifact.artifact_type_key)) ||
      !artifact.visible_role_ids.includes(context.activeSessionRoleId) || !artifactAllowed(definition, type, context, artifact.owner_team_id, artifact.payload, actor)) {
      throw authorizationError("PERMISSION_DENIED", "Revision history is unavailable in this role context.", input.correlationId);
    }
    const rows = await client.query<{ artifact_version: string; governing_release_id: string; state: string; payload: JsonObject; author_display_name: string; created_at: Date }>(
      `SELECT artifact_version,governing_release_id,state,payload,author_display_name,created_at FROM runtime.artifact_revisions revision
        WHERE organization_id=$1 AND session_id=$2 AND artifact_id=$3 AND state=ANY($4::text[])
          AND ($5::bigint IS NULL OR artifact_version<$5)
          AND EXISTS (SELECT 1 FROM evidence.events event WHERE event.organization_id=revision.organization_id
            AND event.session_id=revision.session_id AND event.aggregate_id=revision.artifact_id
            AND event.aggregate_version=revision.artifact_version
            AND event.event_type IN ('artifact.forwarded','artifact.returned','artifact.accepted','artifact.created'))
        ORDER BY artifact_version DESC LIMIT 51`,
      [context.organizationId, context.sessionId, input.artifactId, states, input.beforeVersion ?? null]);
    const releases = new Map<string, RuntimeDefinition>([[context.activeReleaseId, definition]]);
    const revisions: RuntimeArtifactHistoryV1["revisions"] = [];
    for (const row of rows.rows.slice(0, 50)) {
      let revisionDefinition = releases.get(row.governing_release_id);
      if (revisionDefinition === undefined) {
        revisionDefinition = (await readRelease(client, context.organizationId, row.governing_release_id, input.correlationId)).definition;
        releases.set(row.governing_release_id, revisionDefinition);
      }
      const revisionType = typeFor(revisionDefinition, artifact.artifact_type_key);
      if (revisionType === undefined) continue;
      const grants = artifactGrants(revisionDefinition, revisionType, context, artifact.owner_team_id, row.payload, actor);
      if (!grants.length) continue;
      const allows = artifactFieldAccess(grants);
      revisions.push({ version: Number(row.artifact_version), state: row.state,
        stateLabel: workflowFor(revisionDefinition, revisionType).states.find((state) => state.key === row.state)?.label ?? row.state,
        payload: visibleArtifactPayload(row.payload, allows), form: asForm(visibleArtifactForm(await authorizedForm(client, context, revisionDefinition, revisionType, actor), allows), revisionDefinition.teamCells, context.activeSessionRoleId, row.state),
        authorDisplayName: row.author_display_name, recordedAt: row.created_at.toISOString() });
    }
    return { artifactId: input.artifactId, revisions,
      nextBeforeVersion: rows.rows.length > 50 ? Number(rows.rows[49]!.artifact_version) : null };
  });
}

export async function getRuntimeProjection(input: RuntimeProjectionInput): Promise<RuntimeProjectionV1> {
  return withOrganizationTransaction(input.pool, input.principal.organizationId, async (client) => {
    const context = await resolveSessionAccessContext(client, input.principal, {
      sessionId: input.sessionId,
      deviceId: input.deviceId,
      correlationId: input.correlationId,
      ...(input.activeSessionRoleId === undefined ? {} : { requestedActiveSessionRoleId: input.activeSessionRoleId })
    });
    return readRuntimeProjection(client, context, input);
  });
}

/** Shared authoritative projection for HTTP reads and authorized delta selection. */
export async function readRuntimeProjection(client: PoolClient, context: SessionAccessContextV1,
  input: Pick<RuntimeProjectionInput, "principal" | "correlationId" | "timelineBefore">): Promise<RuntimeProjectionV1> {
    const { definition, releaseLabel, simulationTitle } = await readRelease(
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
    const profile = resolveRuntimeInterfaceProfile(
      definition, context.activeSessionRoleId, stage?.id ?? null, input.correlationId, actor.teamId ?? null
    );
    if (profile === undefined) {
      throw authorizationError("PERMISSION_DENIED", "No Interface Profile is available for the Active Role Context.", input.correlationId);
    }
    const resources = await readRuntimeResourceMetadata(
      client, context.organizationId, context.activeReleaseId, profileResourceIds(profile)
    );
    const rows = await client.query<ArtifactRow>(
      `SELECT id,artifact_type_key,state,payload,version,governing_release_id,form_version,
              creator_participant_id,visible_role_ids,owner_team_id
         FROM runtime.artifact_instances
        WHERE organization_id=$1 AND session_id=$2
          AND (creator_participant_id=$3 OR visible_role_ids && $4::text[])
        ORDER BY created_at,id`,
      [context.organizationId, context.sessionId, context.participantId, [context.activeSessionRoleId]]
    );
    const authorizedForms = new Map<string, Promise<RuntimeFormDefinition>>();
    const projectedForm = (releaseId: string, source: RuntimeDefinition, type: ArtifactTypeDefinition) => {
      const key = `${releaseId}:${type.id}`;
      let form = authorizedForms.get(key);
      if (!form) { form = authorizedForm(client, context, source, type, actor); authorizedForms.set(key, form); }
      return form;
    };
    const artifacts: RuntimeArtifactV1[] = [];
    for (const artifact of rows.rows) {
      const pinned = (await readRelease(client, context.organizationId, artifact.governing_release_id, input.correlationId)).definition;
      const artifactType = typeFor(pinned, artifact.artifact_type_key);
      if (artifactType === undefined) throw new Error(`Release lacks Artifact Type ${artifact.artifact_type_key}`);
      if (!artifactAllowed(pinned, artifactType, context, artifact.owner_team_id, artifact.payload, actor)) continue;
      const workflow = workflowFor(pinned, artifactType);
      const state = workflow.states.find((candidate) => candidate.key === artifact.state);
      const createdByMe = artifact.creator_participant_id === context.participantId;
      const allows = artifactFieldAccess(artifactGrants(pinned, artifactType, context, artifact.owner_team_id, artifact.payload, actor));
      artifacts.push({
        id: artifact.id,
        artifactTypeKey: artifact.artifact_type_key,
        title: artifactType.name,
        state: artifact.state,
        stateLabel: state?.label ?? artifact.state,
        payload: visibleArtifactPayload(artifact.payload, allows),
        version: Number(artifact.version),
        governingReleaseId: artifact.governing_release_id,
        form: asForm(visibleArtifactForm(await projectedForm(artifact.governing_release_id, pinned, artifactType), allows), pinned.teamCells, context.activeSessionRoleId, artifact.state),
        exportable: artifactType.exportable === true,
        createdByMe,
        actions: actionsFor(workflow, artifact.state, context.activeSessionRoleId, createdByMe,
          mayMutateArtifact(actor, artifact, context.participantId))
      });
    }
    const createTasks: RuntimeCreateTaskV1[] = [];
    for (const artifactType of definition.artifactTypes) {
      if (!artifactType.allowedCreatorSessionRoleIds.includes(context.activeSessionRoleId) ||
          (artifactType.allowedTeamIds !== undefined && (actor.teamId === undefined || !artifactType.allowedTeamIds.includes(actor.teamId))) ||
          (artifactType.availableStageIds !== undefined && (stage === null || !artifactType.availableStageIds.includes(stage.id)))) continue;
      const workflow = workflowFor(definition, artifactType);
      const transition = workflow.transitions.find((candidate) => candidate.from === null &&
        candidate.allowedSessionRoleIds.includes(context.activeSessionRoleId));
      if (transition === undefined) continue;
      const form = asForm(visibleArtifactForm(await projectedForm(context.activeReleaseId, definition, artifactType),
        artifactFieldAccess(artifactGrants(definition, artifactType, context, actor.teamId ?? null, {}, actor))), definition.teamCells, context.activeSessionRoleId, transition.to);
      const task: RuntimeCreateTaskV1 = {
        artifactTypeKey: artifactType.key,
        title: artifactType.name,
        action: asAction(transition),
        form
      };
      const scoped = profile.modules.some((module) => Array.isArray(module.configuration.scopedModalArtifacts) &&
        module.configuration.scopedModalArtifacts.some((entry) => isRecord(entry) && entry.artifactTypeId === artifactType.id && entry.oneModalPerScope === true));
      const scopeField = form.fields.find((field) => field.key === "industryCellId" && field.readOnly);
      createTasks.push(...(scoped && scopeField !== undefined ? (scopeField.options ?? []).map((option) => ({
        ...task, title: `${task.title} · ${option.label}`, initialValues: { industryCellId: option.value }
      })) : [task]));
    }
    const role = definition.sessionRoles.find((candidate) => candidate.id === context.activeSessionRoleId);
    if (role === undefined) throw new Error(`Release lacks Session Role ${context.activeSessionRoleId}`);
    const information = await getInformationProjection(client, context, actor, input.correlationId);
    const polls = await getPollProjection(client, context);
    const voiceChannels = await getVoiceProjection(client, context);
    const assignments = await client.query<{ session_role_id: string; seat_id: string; team_id: string | null }>(
      `SELECT session_role_id,seat_id,team_id FROM runtime.seat_assignments
        WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3 AND valid_to IS NULL
        ORDER BY seat_id,session_role_id`,
      [context.organizationId, context.sessionId, context.participantId]
    );
    const roleContexts = assignments.rows.map((assignment) => ({
      sessionRoleId: assignment.session_role_id,
      sessionRoleLabel: definition.sessionRoles.find((candidate) => candidate.id === assignment.session_role_id)?.name
        ?? assignment.session_role_id,
      teamLabel: assignment.team_id === null ? null
        : definition.teams.find((candidate) => candidate.id === assignment.team_id)?.name ?? assignment.team_id,
      seatLabel: definition.seats.find((seat) => seat.id === assignment.seat_id)?.name ?? assignment.seat_id,
      runtimeUrl: `/sessions/${context.sessionId}/runtime?role=${encodeURIComponent(assignment.session_role_id)}`
    }));
    const sessionIdentity = await client.query<{ title: string }>(
      "SELECT title FROM runtime.sessions WHERE organization_id=$1 AND id=$2",
      [context.organizationId, context.sessionId]
    );
    const operatorAccess = profile.modules.some((module) => module.type === "session_status" && module.mode === "write")
      ? await client.query(`SELECT 1 FROM runtime.session_operators operator
          JOIN identity.memberships membership ON membership.organization_id=operator.organization_id AND membership.person_id=operator.person_id
          WHERE operator.organization_id=$1 AND operator.session_id=$2 AND operator.person_id=$3
            AND operator.revoked_at IS NULL AND membership.organization_role='operator' LIMIT 1`,
        [context.organizationId, context.sessionId, input.principal.principalId]) : null;
    return {
      contractId: RUNTIME_PROJECTION_CONTRACT_ID,
      sessionId: context.sessionId,
      sessionStatus: context.sessionStatus,
      releaseId: context.activeReleaseId,
      releaseLabel,
      simulationTitle,
      sessionTitle: sessionIdentity.rows[0]?.title ?? simulationTitle,
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
      navigation: {
        contractId: RUNTIME_NAVIGATION_CONTRACT_ID,
        items: profile.navigationItems.map((item) => ({
          id: item.id, label: item.label, moduleId: item.moduleId, regionId: item.regionId
        })),
        ...(profile.defaultNavigationItemId === undefined ? {} : { defaultItemId: profile.defaultNavigationItemId })
      },
      regions: profile.regions,
      roleContexts,
      modules: profile.modules.map((module) => module.type !== "session_status" ? module : {
        ...module, configuration: { ...module.configuration,
          operatorAccess: input.principal.organizationRoles.includes("operator") && operatorAccess?.rowCount === 1,
          stageSchedule: definition.stages.map((item) => ({ id: item.id, label: item.label ?? item.name ?? item.id, durationSeconds: item.durationSeconds ?? null })),
          stageControl: stageControlPresentation(role.capabilities ?? [], stage, stageState?.status ?? "not_started",
            Number(stageState?.version ?? 0), definition.stages) }
      }),
      resources,
      createTasks,
      artifacts,
      ...information,
      ...(profile.modules.some((module) => module.type === "session_timeline") ? {
        timeline: await readParticipantTimeline(client, context.organizationId, context.sessionId, { artifacts, ...information }, definition.stages, input.timelineBefore)
      } : {}),
      polls,
      voiceChannels
    };
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
  extensionRunPlans: ExtensionPlanRegistry = new Map(),
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
