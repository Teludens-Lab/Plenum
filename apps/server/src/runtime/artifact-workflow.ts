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
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import {
  resolveSessionAccessContext,
  type SessionAccessContextV1
} from "../identity/context.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import {
  processSessionCommand,
  type CommandDecision,
  type CommandExecutionContext
} from "./commands/processor.js";

interface RuntimeFieldDefinition {
  key: string;
  label: string;
  type: "text" | "long_text";
  required: boolean;
  helpText?: string;
}

interface RuntimeFormDefinition {
  id: string;
  name: string;
  formVersion: string;
  fields: RuntimeFieldDefinition[];
}

interface ArtifactTypeDefinition {
  key: string;
  name: string;
  formId: string;
  workflowId: string;
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
}

interface WorkflowDefinition {
  id: string;
  key: string;
  states: WorkflowStateDefinition[];
  transitions: WorkflowTransitionDefinition[];
}

interface InterfaceProfileDefinition {
  id: string;
  sessionRoleIds: string[];
  stageIds?: string[];
  layout: RuntimeProjectionV1["layout"];
  modules: RuntimeModuleV1[];
}

interface RuntimeDefinition {
  sessionRoles: Array<{ id: string; name: string }>;
  stages: Array<{ id: string; label: string }>;
  forms: RuntimeFormDefinition[];
  artifactTypes: ArtifactTypeDefinition[];
  workflows: WorkflowDefinition[];
  interfaceProfiles: InterfaceProfileDefinition[];
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
  if (!isRecord(value) || !Array.isArray(value.sessionRoles) || !Array.isArray(value.stages) ||
      !Array.isArray(value.forms) || !Array.isArray(value.artifactTypes) ||
      !Array.isArray(value.workflows) || !Array.isArray(value.interfaceProfiles)) {
    throw authorizationError("INCOMPATIBLE_RELEASE", "The Release lacks a Runtime Interface Profile.", correlationId);
  }
  return value as unknown as RuntimeDefinition;
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

function transitionFor(
  workflow: WorkflowDefinition,
  state: string | null,
  operationType: string,
  activeSessionRoleId: string
): WorkflowTransitionDefinition | CommandDecision {
  const fromState = workflow.transitions.filter((transition) => transition.from === state);
  const operation = fromState.filter((transition) => transition.command === operationType);
  const allowed = operation.find((transition) => transition.allowedSessionRoleIds.includes(activeSessionRoleId));
  if (allowed !== undefined) return allowed;
  return operation.length > 0
    ? { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Active Role Context cannot perform this transition." }
    : { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The workflow does not allow this transition." };
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
  return {
    id: form.id,
    name: form.name,
    formVersion: form.formVersion,
    fields: form.fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      ...(field.helpText === undefined ? {} : { helpText: field.helpText })
    }))
  };
}

function asAction(transition: WorkflowTransitionDefinition): RuntimeActionV1 {
  return {
    operationType: transition.command,
    label: actionLabel(transition),
    requiresForm: transition.command === "artifact.create" || transition.contentOnly === true
  };
}

function missingRequired(form: RuntimeFormDefinition, payload: JsonObject): string[] {
  return form.fields.filter((field) => field.required &&
    (typeof payload[field.key] !== "string" || (payload[field.key] as string).trim().length === 0))
    .map((field) => field.label);
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
    const workflow = workflowFor(definition, artifactType);
    const transition = transitionFor(workflow, null, command.operationType, context.activeSessionRoleId);
    if (isDecision(transition)) return transition;
    const content = jsonPayload(command.payload.content) ?? {};
    await client.query(
      `INSERT INTO runtime.artifact_instances
         (id,organization_id,session_id,governing_release_id,artifact_type_key,workflow_key,
          form_version,creator_participant_id,state,payload,visible_role_ids,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,1)`,
      [command.aggregateId, context.organizationId, context.sessionId, activeReleaseId,
        artifactType.key, workflow.key, formFor(definition, artifactType).formVersion,
        context.participantId, transition.to, JSON.stringify(content), visibleRoles([], workflow, transition)]
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
            creator_participant_id,visible_role_ids
       FROM runtime.artifact_instances
      WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE`,
    [context.organizationId, context.sessionId, command.aggregateId]
  );
  const artifact = result.rows[0];
  if (artifact === undefined || (artifact.creator_participant_id !== context.participantId &&
      !artifact.visible_role_ids.includes(context.activeSessionRoleId))) {
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
  const workflow = workflowFor(definition, artifactType);
  const transition = transitionFor(workflow, artifact.state, command.operationType, context.activeSessionRoleId);
  if (isDecision(transition)) return transition;
  if (transition.contentOnly === true && artifact.creator_participant_id !== context.participantId) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only the creator may edit this Artifact." };
  }
  let payload = artifact.payload;
  if (transition.contentOnly === true) {
    const content = jsonPayload(command.payload.content);
    if (content === undefined) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Artifact content must be an object." };
    payload = content;
  } else {
    const state = workflow.states.find((candidate) => candidate.key === artifact.state);
    if (state?.kind === "draft") {
      const missing = missingRequired(formFor(definition, artifactType), payload);
      if (missing.length > 0) return { status: "rejected", errorCode: "VALIDATION_FAILED", message: `Required fields are empty: ${missing.join(", ")}` };
    }
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

function actionsFor(
  workflow: WorkflowDefinition,
  state: string,
  activeSessionRoleId: string,
  createdByMe: boolean
): RuntimeActionV1[] {
  return workflow.transitions
    .filter((transition) => transition.from === state && transition.allowedSessionRoleIds.includes(activeSessionRoleId) &&
      (transition.contentOnly !== true || createdByMe))
    .map(asAction);
}

function profileFor(definition: RuntimeDefinition, activeSessionRoleId: string, stageId: string | null): InterfaceProfileDefinition | undefined {
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
    const stage = definition.stages[0] ?? null;
    const profile = profileFor(definition, context.activeSessionRoleId, stage?.id ?? null);
    if (profile === undefined) {
      throw authorizationError("PERMISSION_DENIED", "No Interface Profile is available for the Active Role Context.", input.correlationId);
    }
    const rows = await client.query<ArtifactRow>(
      `SELECT id,artifact_type_key,state,payload,version,governing_release_id,form_version,
              creator_participant_id,visible_role_ids
         FROM runtime.artifact_instances
        WHERE organization_id=$1 AND session_id=$2
          AND (creator_participant_id=$3 OR visible_role_ids && $4::text[])
        ORDER BY created_at,id`,
      [context.organizationId, context.sessionId, context.participantId, [context.activeSessionRoleId]]
    );
    const artifacts: RuntimeArtifactV1[] = rows.rows.map((artifact) => {
      const artifactType = typeFor(definition, artifact.artifact_type_key);
      if (artifactType === undefined) throw new Error(`Release lacks Artifact Type ${artifact.artifact_type_key}`);
      const workflow = workflowFor(definition, artifactType);
      const state = workflow.states.find((candidate) => candidate.key === artifact.state);
      const createdByMe = artifact.creator_participant_id === context.participantId;
      return {
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
        actions: actionsFor(workflow, artifact.state, context.activeSessionRoleId, createdByMe)
      };
    });
    const createTasks: RuntimeCreateTaskV1[] = definition.artifactTypes.flatMap((artifactType) => {
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
    return {
      contractId: RUNTIME_PROJECTION_CONTRACT_ID,
      sessionId: context.sessionId,
      sessionStatus: context.sessionStatus,
      releaseId: context.activeReleaseId,
      releaseLabel,
      participantId: context.participantId,
      activeSessionRoleId: context.activeSessionRoleId,
      activeSessionRoleLabel: role.name,
      currentStageId: stage?.id ?? null,
      currentStageLabel: stage?.label ?? null,
      interfaceProfileId: profile.id,
      layout: profile.layout,
      modules: [...profile.modules].sort((left, right) => left.id.localeCompare(right.id)),
      createTasks,
      artifacts
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
