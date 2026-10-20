import {
  type CommandEnvelopeV1,
  type JsonObject,
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
import { runtimeFormValue, setRuntimeFormValue, validateRuntimeFormPayload, type RuntimeFieldConditionV1, type RuntimeFieldValidationV1 } from "@plenum/simulation-schema";
import { nextStage, remainingSeconds, resolveWorkflowTransition } from "@plenum/workflow-engine";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import {
  resolveSessionAccessContext,
  type SessionAccessContextV1
} from "../identity/context.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { createCompositionRunExecutor, executeEffectProposalCommand, type ExtensionRunPlan } from "../extensions/runtime.js";
import {
  processSessionCommand,
  type CommandDecision,
  type CommandExecutionContext
} from "./commands/processor.js";
import { executeInformationCommand, getInformationProjection, releaseStageInjects } from "./information-flow.js";
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
  editableFieldKeys?: string[];
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
  sessionRoles: Array<{ id: string; name: string; capabilities?: Array<{ capability: string }>; isControlRole?: boolean }>;
  seats: Array<{ id: string; sessionRoleIds: string[]; teamId?: string }>;
  informationPolicies: Array<{ id: string; grants: Array<{ audience: FieldAudience }> }>;
  stages: Array<{
    id: string; label: string; name?: string; durationSeconds?: number; timerMode?: "countdown" | "countup" | "none";
    transitions?: Array<{ id: string; targetStageId: string; mode: "automatic" | "manual" | "automatic_or_manual" }>;
    allowedActivityIds?: string[];
    operatorControls?: { allowStart: boolean; allowEnd: boolean; allowReopen: boolean; allowExtend: boolean; allowSkip: boolean; allowReturnToPrevious: boolean; requireReason: boolean };
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
): Promise<{ definition: RuntimeDefinition; releaseLabel: string }> {
  const result = await client.query<{ snapshot: unknown; release_label: string }>(
    `SELECT revision.snapshot, release.release_label
       FROM registry.releases release
       JOIN studio.definition_revisions revision
         ON revision.organization_id=release.organization_id
        AND revision.id=release.definition_revision_id
      WHERE release.organization_id=$1 AND release.id=$2`,
    [organizationId, releaseId]
  );
  const row = result.rows[0];
  if (row === undefined) throw authorizationError("NOT_FOUND", "The Release was not found.", correlationId);
  return { definition: runtimeDefinition(row.snapshot, correlationId), releaseLabel: row.release_label };
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

function transitionFor(
  workflow: WorkflowDefinition,
  state: string | null,
  operationType: string,
  activeSessionRoleId: string
): WorkflowTransitionDefinition | CommandDecision {
  const result = resolveWorkflowTransition(workflow, state, operationType, activeSessionRoleId);
  if (result.allowed) return result.transition;
  return result.reason === "PERMISSION_DENIED"
    ? { status: "rejected", errorCode: result.reason, message: "The Active Role Context cannot perform this transition." }
    : { status: "rejected", errorCode: result.reason, message: "The workflow does not allow this transition." };
}

function isDecision(value: WorkflowTransitionDefinition | CommandDecision): value is CommandDecision {
  return "status" in value;
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

export async function executeArtifactCommand(input: CommandExecutionContext): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (command.operationType === "artifact.create") {
    if (command.governingReleaseId !== activeReleaseId) {
      return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "New Artifacts use the active Release." };
    }
    if (command.expectedAggregateVersion !== 0) {
      return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: "A new Artifact starts at version zero." };
    }
    const exists = await client.query("SELECT 1 FROM runtime.artifact_instances WHERE organization_id=$1 AND id=$2", [context.organizationId, command.aggregateId]);
    if (exists.rowCount !== 0) return { status: "rejected", errorCode: "TARGET_EXISTS", message: "The Artifact already exists." };
    const { definition } = await readRelease(client, context.organizationId, activeReleaseId, command.commandId);
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
    const transition = transitionFor(workflow, null, command.operationType, context.activeSessionRoleId);
    if (isDecision(transition)) return transition;
    const content = jsonPayload(command.payload.content) ?? {};
    if (workflow.states.find((state) => state.key === transition.to)?.kind !== "draft") {
      const issues = validateRuntimeFormPayload(formFor(definition, artifactType), content);
      if (issues.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: issues.map((issue) => issue.message).join("; ") };
    }
    if (!await acceptedProposalReferencesValid(client, context, definition, artifactType, actor.teamId, content)) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "An accepted proposal reference is invalid or unavailable to this Team." };
    }
    await client.query(
      `INSERT INTO runtime.artifact_instances
         (id,organization_id,session_id,governing_release_id,artifact_type_key,workflow_key,
          form_version,creator_participant_id,owner_team_id,state,payload,visible_role_ids,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,1)`,
      [command.aggregateId, context.organizationId, context.sessionId, activeReleaseId,
        artifactType.key, workflow.key, formFor(definition, artifactType).formVersion,
        context.participantId, actor.teamId ?? null, transition.to, JSON.stringify(content), visibleRoles([], workflow, transition)]
    );
    return {
      status: "accepted",
      aggregateVersion: 1,
      eventType: eventType(command.operationType),
      eventPayload: { artifactId: command.aggregateId, artifactTypeKey: artifactType.key, fromState: null,
        toState: transition.to, activeSessionRoleId: context.activeSessionRoleId, version: 1 }
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
  if (command.expectedAggregateVersion !== currentVersion) {
    return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The Artifact is at version ${currentVersion}.` };
  }
  const { definition } = await readRelease(client, context.organizationId, artifact.governing_release_id, command.commandId);
  const artifactType = typeFor(definition, artifact.artifact_type_key);
  if (artifactType === undefined) throw new Error(`Release lacks Artifact Type ${artifact.artifact_type_key}`);
  const actor = actorFor(definition, context);
  if (actor === undefined || !artifactAllowed(definition, artifactType, context, artifact.owner_team_id, artifact.payload, actor) ||
      (artifact.creator_participant_id !== context.participantId && !artifact.visible_role_ids.includes(context.activeSessionRoleId))) {
    return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Artifact was not found." };
  }
  const workflow = workflowFor(definition, artifactType);
  if (!actor.isControlRole && actor.teamId !== artifact.owner_team_id) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only the owning Team or Control may change this Artifact." };
  }
  const transition = transitionFor(workflow, artifact.state, command.operationType, context.activeSessionRoleId);
  if (isDecision(transition)) return transition;
  if (transition.contentOnly === true && artifact.creator_participant_id !== context.participantId) {
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
  return {
    status: "accepted",
    aggregateVersion: version,
    eventType: eventType(command.operationType),
    eventPayload: { artifactId: artifact.id, artifactTypeKey: artifact.artifact_type_key,
      fromState: artifact.state, toState: transition.to, activeSessionRoleId: context.activeSessionRoleId, version }
  };
}

function textPayload(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export async function executeStageCommand(input: CommandExecutionContext): Promise<CommandDecision> {
  const { client, context, command, activeReleaseId } = input;
  if (command.governingReleaseId !== activeReleaseId) {
    return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "Stage controls use the active Release." };
  }
  if (command.aggregateId !== context.sessionId) {
    return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Stage aggregate was not found." };
  }
  const { definition } = await readRelease(client, context.organizationId, activeReleaseId, command.commandId);
  const role = definition.sessionRoles.find((candidate) => candidate.id === context.activeSessionRoleId);
  const capability = command.operationType === "stage.advance" ? "stage.advance" : "timer.control";
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
  const now = new Date();

  if (command.operationType === "stage.start" && current.status === "not_started" && stage.operatorControls?.allowStart) {
    status = "active"; startedAt = now;
  } else if (command.operationType === "stage.pause" && current.status === "active") {
    status = "paused"; pausedAt = now;
  } else if (command.operationType === "stage.resume" && current.status === "paused" && pausedAt !== null) {
    status = "active"; pauseSeconds += Math.max(0, Math.floor((now.getTime() - pausedAt.getTime()) / 1000)); pausedAt = null;
  } else if (command.operationType === "stage.extend" && stage.operatorControls?.allowExtend &&
      (current.status === "active" || current.status === "paused")) {
    const seconds = command.payload.seconds;
    if (!Number.isSafeInteger(seconds) || Number(seconds) <= 0) {
      return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Extension seconds must be a positive integer." };
    }
    extensionSeconds += Number(seconds);
  } else if (command.operationType === "stage.advance" &&
      (current.status !== "not_started" || stage.operatorControls?.allowSkip === true)) {
    const target = textPayload(command.payload.targetStageId);
    const next = target === undefined ? undefined : nextStage(definition.stages.map((item) => ({
      ...item, name: item.name ?? item.label, stageType: "stage", allowedActivityIds: item.allowedActivityIds ?? [],
      transitions: item.transitions ?? [], operatorControls: item.operatorControls ?? {
        allowStart: false, allowEnd: false, allowReopen: false, allowExtend: false, allowSkip: false, allowReturnToPrevious: false, requireReason: true
      }
    })), current.stage_id, target);
    if (next === undefined) return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The Release does not allow this Stage transition." };
    targetStageId = next.id; status = "active"; startedAt = now; pausedAt = null; pauseSeconds = 0; extensionSeconds = 0;
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
  const releasedInjectIds = command.operationType === "stage.advance"
    ? [
        ...await releaseStageInjects(input, "stage_exit", current.stage_id),
        ...await releaseStageInjects(input, "stage_entry", targetStageId)
      ]
    : command.operationType === "stage.start"
      ? await releaseStageInjects(input, "stage_entry", targetStageId)
      : [];
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
  const eventAction = command.operationType.slice("stage.".length);
  return { status: "accepted", aggregateVersion: version, eventType: `stage.${eventAction === "pause" ? "paused" : eventAction === "resume" ? "resumed" : eventAction === "advance" ? "advanced" : eventAction === "extend" ? "extended" : "started"}`,
    eventPayload: { fromStageId: current.stage_id, toStageId: targetStageId, status,
      activeSessionRoleId: context.activeSessionRoleId, version, releasedInjectIds } };
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
      (transition.contentOnly !== true || createdByMe))
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
  const execute = command.operationType.startsWith("stage.") ? executeStageCommand :
    command.operationType.startsWith("artifact.") ? executeArtifactCommand :
      command.operationType.startsWith("message.") || command.operationType.startsWith("inject.") ? executeInformationCommand :
      command.operationType === "composition_run.start" ? createCompositionRunExecutor(extensionRunPlans) :
      command.operationType.startsWith("effect_proposal.") ? executeEffectProposalCommand :
      command.operationType.startsWith("poll.") || command.operationType === "ballot.cast" ? executeVotingCommand :
      command.operationType.startsWith("voice_") && mediaAdapter !== undefined ? createVoiceCommandExecutor(mediaAdapter) :
      async (): Promise<CommandDecision> => ({ status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE",
        message: "This configured capability is not available in the current Runtime." });
  return processSessionCommand({ pool, context, command, correlationId, deploymentId, lockAggregateAndExecute: execute });
}
