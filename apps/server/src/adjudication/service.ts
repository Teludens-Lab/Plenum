import { createHash, randomUUID } from "node:crypto";

import {
  ADJUDICATION_RECORD_CONTRACT_ID,
  ADJUDICATION_REQUEST_CONTRACT_ID,
  canonicalizeJson,
  type AdjudicationMechanismV1,
  type AdjudicationOptionV1,
  type AdjudicationRequestV1,
  type AdjudicationTraceEntryV1,
  type JsonObject,
  type JsonValue
} from "@plenum/event-contracts";
import type { AdjudicationModelDefinitionV1, RuntimeArtifactTypeDefinitionV1, RuntimeScalarV1, StateEffectV1, StateVariableDefinitionV1 } from "@plenum/simulation-schema";
import { evaluateGate } from "@plenum/workflow-engine";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import type { SessionAccessContextV1 } from "../identity/context.js";
import { applyStateValueChange, scheduleStateValueChange } from "../runtime/state/world-state.js";
import type { CommandDecision, CommandExecutionContext } from "../runtime/commands/processor.js";

type ReleaseAdjudicationDefinition = {
  models: AdjudicationModelDefinitionV1[];
  artifactTypes: RuntimeArtifactTypeDefinitionV1[];
  stateVariables: StateVariableDefinitionV1[];
};

type RequestRow = {
  id: string; adjudication_model_id: string; status: AdjudicationRequestV1["status"];
  version: string; governing_release_id: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, maximum = 8_000): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
    ? [...new Set(value)] : undefined;
}

function confidence(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}

function stateEffects(value: unknown): StateEffectV1[] | undefined {
  if (!Array.isArray(value) || value.length > 100) return undefined;
  const effects: StateEffectV1[] = [];
  for (const candidate of value) {
    if (!record(candidate) || typeof candidate.stateVariableId !== "string" || candidate.stateVariableId.length === 0 ||
        !["set", "increment", "decrement", "multiply"].includes(String(candidate.operation)) ||
        !["boolean", "number", "string"].includes(typeof candidate.value) ||
        (candidate.scopeReference !== undefined && typeof candidate.scopeReference !== "string") ||
        (candidate.rationale !== undefined && text(candidate.rationale, 8_000) === undefined) ||
        (candidate.delaySeconds !== undefined && (!Number.isSafeInteger(candidate.delaySeconds) ||
          Number(candidate.delaySeconds) < 0 || Number(candidate.delaySeconds) > 604_800))) return undefined;
    effects.push(candidate as unknown as StateEffectV1);
  }
  return effects;
}

function jsonValue(value: unknown): JsonValue | undefined {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return value as JsonValue;
  if (Array.isArray(value)) {
    const items = value.map(jsonValue);
    return items.every((item) => item !== undefined) ? items as JsonValue[] : undefined;
  }
  if (!record(value)) return undefined;
  const result: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = jsonValue(item);
    if (parsed === undefined) return undefined;
    result[key] = parsed;
  }
  return result;
}

async function releaseDefinition(client: PoolClient, organizationId: string, releaseId: string): Promise<ReleaseAdjudicationDefinition> {
  const result = await client.query<{ snapshot: unknown }>(
    `SELECT revision.snapshot FROM registry.releases release
       JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id
        AND revision.id=release.definition_revision_id
      WHERE release.organization_id=$1 AND release.id=$2`, [organizationId, releaseId]
  );
  const snapshot = result.rows[0]?.snapshot;
  const design = record(snapshot) && record(snapshot.coreDesign) ? snapshot.coreDesign : snapshot;
  if (!record(design)) return { models: [], artifactTypes: [], stateVariables: [] };
  return {
    models: Array.isArray(design.adjudicationModels) ? design.adjudicationModels as AdjudicationModelDefinitionV1[] : [],
    artifactTypes: Array.isArray(design.artifactTypes) ? design.artifactTypes as RuntimeArtifactTypeDefinitionV1[] : [],
    stateVariables: Array.isArray(design.stateVariables) ? design.stateVariables as StateVariableDefinitionV1[] : []
  };
}

function modelFor(definition: ReleaseAdjudicationDefinition, id: string): AdjudicationModelDefinitionV1 | undefined {
  return definition.models.find((model) => model.id === id);
}

function isReviewer(model: AdjudicationModelDefinitionV1, sessionRoleId: string): boolean {
  return model.reviewerSessionRoleIds.includes(sessionRoleId) || model.leadReviewerSessionRoleIds.includes(sessionRoleId) ||
    model.perspectives.some((perspective) => perspective.reviewerSessionRoleIds.includes(sessionRoleId));
}

function isLead(model: AdjudicationModelDefinitionV1, sessionRoleId: string): boolean {
  return model.leadReviewerSessionRoleIds.includes(sessionRoleId);
}

export function evaluateAdjudicationModel(
  model: AdjudicationModelDefinitionV1,
  input: { facts?: Record<string, RuntimeScalarV1 | RuntimeScalarV1[] | undefined>; rubricScores?: Record<string, number>;
    pluginSuggestions?: Array<{ proposalId: string; proposalHash: string; value: JsonValue }>; reviewRecommendations?: JsonValue[] }
): { mechanism: AdjudicationMechanismV1; suggestion: JsonValue | null; explanationTrace: AdjudicationTraceEntryV1[] } {
  const trace: AdjudicationTraceEntryV1[] = [];
  let rulesSuggestion: JsonValue | null = null;
  for (const rule of model.rules ?? []) {
    const evaluation = evaluateGate(rule.when, input.facts ?? {});
    trace.push({ source: "rule", referenceId: rule.id, passed: evaluation.passed, explanation: rule.label,
      details: evaluation.explanations as unknown as JsonValue });
    if (rulesSuggestion === null && evaluation.passed) rulesSuggestion = rule.outcome;
  }
  let rubricSuggestion: JsonValue | null = null;
  if ((model.rubric?.length ?? 0) > 0) {
    let weighted = 0, weight = 0;
    for (const criterion of model.rubric ?? []) {
      const score = input.rubricScores?.[criterion.id];
      const valid = typeof score === "number" && score >= criterion.minimum && score <= criterion.maximum;
      trace.push({ source: "rubric", referenceId: criterion.id, passed: valid, explanation: criterion.label,
        details: valid ? { score, weight: criterion.weight } : { reason: "score_missing_or_out_of_range" } });
      if (valid) { weighted += score * criterion.weight; weight += criterion.weight; }
    }
    if (weight > 0 && trace.filter(({ source }) => source === "rubric").every(({ passed }) => passed)) {
      rubricSuggestion = { weightedScore: weighted / weight };
    }
  }
  const plugins = input.pluginSuggestions ?? [];
  for (const plugin of plugins) trace.push({ source: "plugin", referenceId: plugin.proposalId, passed: true,
    explanation: "Approved, pinned Plugin proposal", details: { proposalHash: plugin.proposalHash } });
  const reviews = input.reviewRecommendations ?? [];
  reviews.forEach((recommendation, index) => trace.push({ source: "review", referenceId: String(index + 1), passed: null,
    explanation: "Reviewer recommendation retained for lead synthesis", details: recommendation }));
  if (model.mechanism === "manual") {
    trace.push({ source: "manual", referenceId: model.id, passed: null, explanation: "Authorized human judgment required", details: null });
    return { mechanism: model.mechanism, suggestion: null, explanationTrace: trace };
  }
  if (model.mechanism === "rules") return { mechanism: model.mechanism, suggestion: rulesSuggestion, explanationTrace: trace };
  if (model.mechanism === "rubric") return { mechanism: model.mechanism, suggestion: rubricSuggestion, explanationTrace: trace };
  if (model.mechanism === "plugin") return { mechanism: model.mechanism,
    suggestion: plugins.length === 0 ? null : { proposals: plugins.map(({ proposalId, proposalHash, value }) => ({ proposalId, proposalHash, value })) },
    explanationTrace: trace };
  return { mechanism: model.mechanism, suggestion: { rules: rulesSuggestion, rubric: rubricSuggestion,
    plugins: plugins.map(({ proposalId, proposalHash, value }) => ({ proposalId, proposalHash, value })), reviews }, explanationTrace: trace };
}

async function identitySnapshot(client: PoolClient, context: SessionAccessContextV1): Promise<{ displayName: string; organizationName: string }> {
  const result = await client.query<{ display_name: string; organization_name: string }>(
    `SELECT person.display_name,organization.name AS organization_name FROM identity.persons person
       JOIN identity.organizations organization ON organization.id=$2 WHERE person.id=$1`,
    [context.principalId, context.organizationId]
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("The adjudication actor identity is unavailable");
  return { displayName: row.display_name, organizationName: row.organization_name };
}

async function lockedRequest(client: PoolClient, context: SessionAccessContextV1, id: string): Promise<RequestRow | undefined> {
  const result = await client.query<RequestRow>(
    `SELECT id,adjudication_model_id,status,version,governing_release_id FROM runtime.adjudication_requests
      WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE`, [context.organizationId, context.sessionId, id]
  );
  return result.rows[0];
}

async function hasCurrentActionAccess(client: PoolClient, context: SessionAccessContextV1, requestId: string): Promise<boolean> {
  const result = await client.query<{ total: string; visible: string }>(
    `SELECT count(*) AS total,count(*) FILTER (WHERE artifact.creator_participant_id=$3 OR $4=ANY(artifact.visible_role_ids)) AS visible
       FROM runtime.adjudication_request_actions snapshot JOIN runtime.artifact_instances artifact
         ON artifact.organization_id=snapshot.organization_id AND artifact.id=snapshot.artifact_id
      WHERE snapshot.organization_id=$1 AND snapshot.request_id=$2`,
    [context.organizationId, requestId, context.participantId, context.activeSessionRoleId]
  );
  const total = Number(result.rows[0]?.total ?? 0);
  return total > 0 && total === Number(result.rows[0]?.visible ?? 0);
}

async function createRequest(input: CommandExecutionContext, definition: ReleaseAdjudicationDefinition): Promise<CommandDecision> {
  const { client, context, command } = input;
  const modelId = text(command.payload.modelId, 200), actionIds = stringArray(command.payload.actionIds);
  const model = modelId === undefined ? undefined : modelFor(definition, modelId);
  if (model === undefined || actionIds === undefined || actionIds.length === 0 || actionIds.length > 100 ||
      !Array.isArray(command.payload.actionIds) || command.payload.actionIds.length !== actionIds.length) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "An Adjudication Model and one or more Actions are required." };
  }
  if (!isReviewer(model, context.activeSessionRoleId)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Active Role Context cannot request this adjudication." };
  }
  const allowedTypeKeys = model.appliesToArtifactTypeIds.map((id) => definition.artifactTypes.find((type) => type.id === id))
    .filter((type): type is RuntimeArtifactTypeDefinitionV1 => type?.decisionBearing === true).map(({ key }) => key);
  if (allowedTypeKeys.length !== model.appliesToArtifactTypeIds.length || allowedTypeKeys.length === 0) {
    return { status: "rejected", errorCode: "REFERENCE_INVALID", message: "The Adjudication Model has no valid Action Artifact Types." };
  }
  const actions = await client.query<{ id: string; version: string; artifact_type_key: string; payload: JsonObject }>(
    `SELECT id,version,artifact_type_key,payload FROM runtime.artifact_instances
      WHERE organization_id=$1 AND session_id=$2 AND governing_release_id=$3 AND id=ANY($4::uuid[])
        AND (creator_participant_id=$5 OR $6=ANY(visible_role_ids)) AND artifact_type_key=ANY($7::text[]) FOR SHARE`,
    [context.organizationId, context.sessionId, input.activeReleaseId, actionIds, context.participantId,
      context.activeSessionRoleId, allowedTypeKeys]
  );
  if (actions.rowCount !== actionIds.length) {
    return { status: "rejected", errorCode: "REFERENCE_INVALID", message: "At least one Action is unavailable under the current Information Policy." };
  }
  const identity = await identitySnapshot(client, context);
  await client.query(
    `INSERT INTO runtime.adjudication_requests
       (id,organization_id,session_id,governing_release_id,adjudication_model_id,requested_by_person_id,
        requested_by_participant_id,requested_by_display_name,requested_by_organization_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [command.aggregateId, context.organizationId, context.sessionId, input.activeReleaseId, model.id, context.principalId,
      context.participantId, identity.displayName, identity.organizationName]
  );
  // DEC-63: the whole decision-bearing Artifact payload is its single Action.
  // Never expand Form arrays/repeating groups into executable Actions. The database
  // also enforces one snapshot per (request_id, artifact_id).
  for (const action of actions.rows) {
    const digest = createHash("sha256").update(canonicalizeJson(action.payload)).digest("hex");
    await client.query(
      `INSERT INTO runtime.adjudication_request_actions
         (id,organization_id,session_id,request_id,artifact_id,artifact_version,artifact_type_key,payload_sha256,payload_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [randomUUID(), context.organizationId, context.sessionId, command.aggregateId, action.id, Number(action.version),
        action.artifact_type_key, digest, JSON.stringify(action.payload)]
    );
  }
  return { status: "accepted", aggregateVersion: 1, eventType: "adjudication.requested",
    eventPayload: { requestId: command.aggregateId, modelId: model.id, actionIds, actionVersions: actions.rows.map(({ id, version }) => ({ id, version: Number(version) })) } };
}

async function submitReview(input: CommandExecutionContext, request: RequestRow, model: AdjudicationModelDefinitionV1): Promise<CommandDecision> {
  const { client, context, command } = input;
  if (!isReviewer(model, context.activeSessionRoleId)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The Active Role Context cannot review this adjudication." };
  }
  const perspectiveId = text(command.payload.perspectiveId, 200);
  const perspective = model.perspectives.find(({ id, reviewerSessionRoleIds }) => id === perspectiveId && reviewerSessionRoleIds.includes(context.activeSessionRoleId));
  const recommendation = jsonValue(command.payload.recommendation), rationale = text(command.payload.rationale);
  const evidenceIds = stringArray(command.payload.evidenceArtifactIds) ?? [];
  const certainty = confidence(command.payload.confidence);
  const hiddenNotes = command.payload.hiddenAnalyticalNotes === undefined ? undefined : text(command.payload.hiddenAnalyticalNotes, 20_000);
  if (perspective === undefined || recommendation === undefined || rationale === undefined || certainty === undefined ||
      (command.payload.hiddenAnalyticalNotes !== undefined && hiddenNotes === undefined)) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "The reviewer input is incomplete or invalid." };
  }
  const allowedEvidence = await client.query<{ artifact_id: string }>(
    `SELECT artifact_id FROM runtime.adjudication_request_actions WHERE organization_id=$1 AND request_id=$2 AND artifact_id=ANY($3::uuid[])`,
    [context.organizationId, request.id, evidenceIds]
  );
  if (allowedEvidence.rowCount !== evidenceIds.length) {
    return { status: "rejected", errorCode: "REFERENCE_INVALID", message: "Evidence must be an Action in this adjudication request." };
  }
  const identity = await identitySnapshot(client, context), reviewId = randomUUID(), version = Number(request.version) + 1;
  const inserted = await client.query(
    `INSERT INTO runtime.adjudication_reviews
         (id,organization_id,session_id,request_id,perspective_id,recommendation,rationale,evidence_artifact_ids,
          hidden_analytical_notes,confidence,reviewer_person_id,reviewer_participant_id,reviewer_session_role_id,
          reviewer_display_name,reviewer_organization_name,authority_epoch)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::uuid[],$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (request_id,perspective_id,reviewer_person_id) DO NOTHING RETURNING id`,
    [reviewId, context.organizationId, context.sessionId, request.id, perspective.id, JSON.stringify(recommendation), rationale,
      evidenceIds, hiddenNotes ?? null, certainty, context.principalId, context.participantId, context.activeSessionRoleId,
      identity.displayName, identity.organizationName, context.authorityEpoch]
  );
  if (inserted.rowCount === 0) {
    return { status: "rejected", errorCode: "CONFLICT", message: "This reviewer already submitted that perspective." };
  }
  await client.query("UPDATE runtime.adjudication_requests SET status='in_progress',version=$1,updated_at=transaction_timestamp() WHERE organization_id=$2 AND id=$3",
    [version, context.organizationId, request.id]);
  return { status: "accepted", aggregateVersion: version, eventType: "adjudication.reviewed",
    eventPayload: { requestId: request.id, reviewId, perspectiveId: perspective.id, reviewerSessionRoleId: context.activeSessionRoleId } };
}

async function approvedPluginSuggestions(client: PoolClient, context: SessionAccessContextV1, releaseId: string, ids: string[]): Promise<Array<{ proposalId: string; proposalHash: string; value: JsonValue }>> {
  if (ids.length === 0) return [];
  const result = await client.query<{ id: string; proposal_hash: string; value: JsonValue }>(
    `SELECT id,proposal_hash,value FROM extension.effect_proposals
      WHERE organization_id=$1 AND session_id=$2 AND governing_release_id=$3 AND id=ANY($4::uuid[])
        AND lifecycle_status='applied' AND authority_epoch=$5`,
    [context.organizationId, context.sessionId, releaseId, ids, context.authorityEpoch]
  );
  if (result.rowCount !== ids.length) throw new Error("PLUGIN_PROPOSAL_INVALID");
  return result.rows.map((row) => ({ proposalId: row.id, proposalHash: row.proposal_hash, value: row.value }));
}

async function draftRecord(input: CommandExecutionContext, request: RequestRow, model: AdjudicationModelDefinitionV1): Promise<CommandDecision> {
  const { client, context, command } = input;
  if (!isLead(model, context.activeSessionRoleId)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only an authorized lead reviewer may synthesize the final record." };
  }
  const outcome = jsonValue(command.payload.outcome), rationale = text(command.payload.rationale), participantRationale = text(command.payload.participantRationale);
  const synthesis = text(command.payload.synthesis), certainty = confidence(command.payload.confidence);
  const overrideRationale = command.payload.overrideRationale === undefined ? undefined : text(command.payload.overrideRationale);
  const effects = stateEffects(command.payload.effects);
  const facts = record(command.payload.facts) ? command.payload.facts as Record<string, RuntimeScalarV1> : {};
  const rubricScores = record(command.payload.rubricScores) ? command.payload.rubricScores as Record<string, number> : {};
  const pluginProposalIds = stringArray(command.payload.pluginProposalIds) ?? [];
  if (outcome === undefined || rationale === undefined || participantRationale === undefined || synthesis === undefined || certainty === undefined ||
      effects === undefined ||
      (command.payload.overrideRationale !== undefined && overrideRationale === undefined)) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "The final adjudication record is incomplete or invalid." };
  }
  let plugins: Array<{ proposalId: string; proposalHash: string; value: JsonValue }>;
  try { plugins = await approvedPluginSuggestions(client, context, request.governing_release_id, pluginProposalIds); }
  catch { return { status: "rejected", errorCode: "REFERENCE_INVALID", message: "A Plugin suggestion is failed, stale, unapproved, or unpinned." }; }
  if ((model.mechanism === "plugin" || model.mechanism === "hybrid") && plugins.length === 0) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "This Adjudication Model requires an approved Plugin proposal." };
  }
  const reviewRows = await client.query<{ recommendation: JsonValue }>(
    "SELECT recommendation FROM runtime.adjudication_reviews WHERE organization_id=$1 AND request_id=$2 ORDER BY submitted_at,id",
    [context.organizationId, request.id]
  );
  const evaluation = evaluateAdjudicationModel(model, { facts, rubricScores, pluginSuggestions: plugins,
    reviewRecommendations: reviewRows.rows.map(({ recommendation }) => recommendation) });
  if ((model.mechanism === "rubric" || model.mechanism === "hybrid") &&
      evaluation.explanationTrace.some((entry) => entry.source === "rubric" && !entry.passed)) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Score every rubric criterion within its configured range before saving the synthesis." };
  }
  if (evaluation.suggestion !== null && canonicalizeJson(evaluation.suggestion) !== canonicalizeJson(outcome) && overrideRationale === undefined) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "An override rationale is required when the final outcome differs from the system suggestion." };
  }
  const identity = await identitySnapshot(client, context), version = Number(request.version) + 1;
  const existing = await client.query<{ id: string; lifecycle_status: string }>(
    "SELECT id,lifecycle_status FROM runtime.adjudication_records WHERE organization_id=$1 AND request_id=$2 FOR UPDATE",
    [context.organizationId, request.id]
  );
  if (existing.rows[0]?.lifecycle_status === "published") {
    return { status: "rejected", errorCode: "ALREADY_PUBLISHED", message: "Published adjudication records are immutable." };
  }
  const recordId = existing.rows[0]?.id ?? randomUUID();
  const values = [JSON.stringify(outcome), rationale, participantRationale, certainty, synthesis,
    JSON.stringify(evaluation.explanationTrace), evaluation.suggestion === null ? null : JSON.stringify(evaluation.suggestion),
    overrideRationale ?? null, JSON.stringify(effects), JSON.stringify(model.publicationScope), context.principalId,
    context.participantId, context.activeSessionRoleId, identity.displayName, identity.organizationName, context.authorityEpoch, version];
  if (existing.rows[0] === undefined) {
    await client.query(
      `INSERT INTO runtime.adjudication_records
         (id,organization_id,session_id,request_id,governing_release_id,mechanism,outcome,rationale,participant_rationale,
          confidence,synthesis,explanation_trace,suggestion,override_rationale,effects,publication_scope,lead_person_id,
          lead_participant_id,lead_session_role_id,lead_display_name,lead_organization_name,authority_epoch,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17,$18,$19,$20,$21,$22,$23)`,
      [recordId, context.organizationId, context.sessionId, request.id, request.governing_release_id, model.mechanism, ...values]
    );
  } else {
    await client.query(
      `UPDATE runtime.adjudication_records SET outcome=$1::jsonb,rationale=$2,participant_rationale=$3,confidence=$4,synthesis=$5,
        explanation_trace=$6::jsonb,suggestion=$7::jsonb,override_rationale=$8,effects=$9::jsonb,publication_scope=$10::jsonb,
        lead_person_id=$11,lead_participant_id=$12,lead_session_role_id=$13,lead_display_name=$14,lead_organization_name=$15,
        authority_epoch=$16,version=$17,drafted_at=transaction_timestamp() WHERE organization_id=$18 AND id=$19`,
      [...values, context.organizationId, recordId]
    );
  }
  await client.query("UPDATE runtime.adjudication_requests SET status='drafted',version=$1,updated_at=transaction_timestamp() WHERE organization_id=$2 AND id=$3",
    [version, context.organizationId, request.id]);
  return { status: "accepted", aggregateVersion: version, eventType: "adjudication.drafted",
    eventPayload: { requestId: request.id, recordId, mechanism: model.mechanism, explanationTrace: evaluation.explanationTrace,
      suggestion: evaluation.suggestion, overrideRationale: overrideRationale ?? null } };
}

async function publishRecord(input: CommandExecutionContext, request: RequestRow, model: AdjudicationModelDefinitionV1, definition: ReleaseAdjudicationDefinition): Promise<CommandDecision> {
  const { client, context, command } = input;
  if (!isLead(model, context.activeSessionRoleId)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Only an authorized lead reviewer may publish this adjudication." };
  }
  const result = await client.query<{ id: string; lifecycle_status: string; effects: StateEffectV1[]; rationale: string; version: string }>(
    "SELECT id,lifecycle_status,effects,rationale,version FROM runtime.adjudication_records WHERE organization_id=$1 AND request_id=$2 FOR UPDATE",
    [context.organizationId, request.id]
  );
  const adjudication = result.rows[0];
  if (adjudication === undefined || request.status !== "drafted") {
    return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "A complete draft is required before publication." };
  }
  if (adjudication.lifecycle_status === "published") return { status: "rejected", errorCode: "ALREADY_PUBLISHED", message: "The adjudication is already published." };
  const stateTransactionIds: string[] = [], scheduledEffectIds: string[] = [];
  for (const [index, effect] of adjudication.effects.entries()) {
    const stateDefinition = definition.stateVariables.find(({ id }) => id === effect.stateVariableId);
    if (stateDefinition === undefined || !["set", "increment", "decrement", "multiply"].includes(effect.operation)) {
      return { status: "rejected", errorCode: "REFERENCE_INVALID", message: "An adjudication effect does not reference a governed State Variable." };
    }
    const worldContext = { organizationId: context.organizationId, sessionId: context.sessionId, governingReleaseId: request.governing_release_id };
    const source = { type: "outcome" as const, reference: adjudication.id, commandId: command.commandId,
      actorPersonId: context.principalId, rationale: effect.rationale ?? adjudication.rationale };
    if ((effect.delaySeconds ?? 0) > 0) scheduledEffectIds.push(await scheduleStateValueChange(client, worldContext, effect, index, source));
    else stateTransactionIds.push((await applyStateValueChange(client, worldContext, effect, source, { definition: stateDefinition })).id);
  }
  const version = Number(request.version) + 1;
  await client.query("UPDATE runtime.adjudication_records SET lifecycle_status='published',published_at=transaction_timestamp(),version=$1 WHERE organization_id=$2 AND id=$3",
    [version, context.organizationId, adjudication.id]);
  await client.query("UPDATE runtime.adjudication_requests SET status='published',version=$1,updated_at=transaction_timestamp() WHERE organization_id=$2 AND id=$3",
    [version, context.organizationId, request.id]);
  await client.query(
    `INSERT INTO runtime.adjudication_deliveries
       (id,organization_id,session_id,adjudication_record_id,record_version,recipient_participant_id)
     SELECT gen_random_uuid(),$1,$2,$3,$4,participant.id FROM runtime.participants participant
       LEFT JOIN runtime.seat_assignments assignment ON assignment.organization_id=participant.organization_id
        AND assignment.session_id=participant.session_id AND assignment.participant_id=participant.id AND assignment.valid_to IS NULL
      WHERE participant.organization_id=$1 AND participant.session_id=$2
        AND ($5::boolean OR assignment.session_role_id=ANY($6::text[]) OR assignment.team_id=ANY($7::text[]))
     ON CONFLICT (adjudication_record_id,record_version,recipient_participant_id) DO NOTHING`,
    [context.organizationId, context.sessionId, adjudication.id, version, model.publicationScope.public === true,
      model.publicationScope.sessionRoleIds ?? [], model.publicationScope.teamIds ?? []]
  );
  return { status: "accepted", aggregateVersion: version, eventType: "adjudication.published",
    eventPayload: { requestId: request.id, recordId: adjudication.id, stateTransactionIds, scheduledEffectIds },
    followUpEvents: [...stateTransactionIds.map((stateTransactionId) => ({ eventType: "effect.applied", eventPayload: { stateTransactionId } })),
      ...scheduledEffectIds.map((scheduledEffectId) => ({ eventType: "effect.scheduled", eventPayload: { scheduledEffectId } }))] };
}

export async function executeAdjudicationCommand(input: CommandExecutionContext): Promise<CommandDecision> {
  const definition = await releaseDefinition(input.client, input.context.organizationId, input.activeReleaseId);
  if (input.command.operationType === "adjudication.request") return createRequest(input, definition);
  const request = await lockedRequest(input.client, input.context, input.command.aggregateId);
  if (request === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The adjudication request was not found." };
  if (request.governing_release_id !== input.activeReleaseId) return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "The adjudication is governed by another Release." };
  if (Number(request.version) !== input.command.expectedAggregateVersion) return { status: "needs_reconciliation", errorCode: "STALE_AGGREGATE_VERSION", message: `The adjudication is at version ${request.version}.` };
  const model = modelFor(definition, request.adjudication_model_id);
  if (model === undefined) return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "The governing Adjudication Model is unavailable." };
  if (!await hasCurrentActionAccess(input.client, input.context, request.id)) {
    return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "Current Information Policy does not authorize every Action in this adjudication." };
  }
  if (input.command.operationType === "adjudication.review") return submitReview(input, request, model);
  if (input.command.operationType === "adjudication.draft") return draftRecord(input, request, model);
  if (input.command.operationType === "adjudication.publish") return publishRecord(input, request, model, definition);
  return { status: "rejected", errorCode: "INVALID_TRANSITION", message: "The adjudication operation is unsupported." };
}

export async function getAdjudicationOptions(pool: Pool, context: SessionAccessContextV1): Promise<AdjudicationOptionV1[]> {
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const definition = await releaseDefinition(client, context.organizationId, context.activeReleaseId);
    const models = definition.models.filter((model) => isReviewer(model, context.activeSessionRoleId));
    if (models.length === 0) return [];
    const typeKeys = definition.artifactTypes.filter(({ decisionBearing }) => decisionBearing).map(({ key }) => key);
    const actions = await client.query<{ id: string; artifact_type_key: string; title: string | null }>(
      `SELECT id,artifact_type_key,LEFT(payload->>'title',200) AS title FROM runtime.artifact_instances
        WHERE organization_id=$1 AND session_id=$2 AND governing_release_id=$3
          AND (creator_participant_id=$4 OR $5=ANY(visible_role_ids)) AND artifact_type_key=ANY($6::text[])
        ORDER BY created_at DESC,id LIMIT 100`,
      [context.organizationId, context.sessionId, context.activeReleaseId, context.participantId, context.activeSessionRoleId, typeKeys]
    );
    return models.map((model) => {
      const types = definition.artifactTypes.filter(({ id, decisionBearing }) => decisionBearing && model.appliesToArtifactTypeIds.includes(id));
      return { modelId: model.id, modelName: model.name, actions: actions.rows.filter((action) =>
        types.some(({ key }) => key === action.artifact_type_key)).map((action) => ({ id: action.id,
        label: action.title || `${action.artifact_type_key.replaceAll("_", " ")} · ${action.id.slice(0, 8)}` })) };
    });
  });
}

export async function getAdjudications(pool: Pool, context: SessionAccessContextV1): Promise<AdjudicationRequestV1[]> {
  return withOrganizationTransaction(pool, context.organizationId, (client) => readAdjudications(client, context));
}

export async function readAdjudications(client: PoolClient, context: SessionAccessContextV1): Promise<AdjudicationRequestV1[]> {
    const definition = await releaseDefinition(client, context.organizationId, context.activeReleaseId);
    const activeAssignment = await client.query<{ team_id: string | null }>(
      `SELECT team_id FROM runtime.seat_assignments WHERE organization_id=$1 AND session_id=$2 AND participant_id=$3
        AND session_role_id=$4 AND valid_to IS NULL ORDER BY valid_from DESC LIMIT 1`,
      [context.organizationId, context.sessionId, context.participantId, context.activeSessionRoleId]
    );
    const activeTeamId = activeAssignment.rows[0]?.team_id ?? undefined;
    const rows = await client.query<RequestRow>(
      `SELECT id,adjudication_model_id,status,version,governing_release_id FROM runtime.adjudication_requests
        WHERE organization_id=$1 AND session_id=$2 AND governing_release_id=$3 ORDER BY created_at,id`,
      [context.organizationId, context.sessionId, context.activeReleaseId]
    );
    const result: AdjudicationRequestV1[] = [];
    for (const request of rows.rows) {
      const model = modelFor(definition, request.adjudication_model_id);
      if (model === undefined) continue;
      const assignedReviewer = isReviewer(model, context.activeSessionRoleId), assignedLead = isLead(model, context.activeSessionRoleId);
      const publicScope = model.publicationScope.public === true ||
        model.publicationScope.sessionRoleIds?.includes(context.activeSessionRoleId) === true ||
        (activeTeamId !== undefined && model.publicationScope.teamIds?.includes(activeTeamId) === true);
      const actionRows = await client.query<{ artifact_id: string; artifact_version: string; artifact_type_key: string; payload_snapshot: JsonObject; visible: boolean }>(
        `SELECT snapshot.artifact_id,snapshot.artifact_version,snapshot.artifact_type_key,snapshot.payload_snapshot,
                (artifact.creator_participant_id=$3 OR $4=ANY(artifact.visible_role_ids)) AS visible
           FROM runtime.adjudication_request_actions snapshot JOIN runtime.artifact_instances artifact
             ON artifact.organization_id=snapshot.organization_id AND artifact.id=snapshot.artifact_id
          WHERE snapshot.organization_id=$1 AND snapshot.request_id=$2 ORDER BY snapshot.artifact_id`,
        [context.organizationId, request.id, context.participantId, context.activeSessionRoleId]
      );
      const reviewer = assignedReviewer && actionRows.rows.length > 0 && actionRows.rows.every(({ visible }) => visible);
      const lead = assignedLead && reviewer;
      if (!reviewer && !(request.status === "published" && publicScope)) continue;
      const actions = actionRows.rows.filter(({ visible }) => visible);
      const visibleActionIds = new Set(actions.map(({ artifact_id }) => artifact_id));
      const reviews = reviewer ? await client.query<{
        id: string; perspective_id: string; recommendation: JsonValue; rationale: string; evidence_artifact_ids: string[];
        hidden_analytical_notes: string | null; confidence: string; reviewer_person_id: string; reviewer_session_role_id: string;
        reviewer_display_name: string; reviewer_organization_name: string; submitted_at: Date;
      }>(`SELECT id,perspective_id,recommendation,rationale,evidence_artifact_ids,hidden_analytical_notes,confidence,
              reviewer_person_id,reviewer_session_role_id,reviewer_display_name,reviewer_organization_name,submitted_at
            FROM runtime.adjudication_reviews WHERE organization_id=$1 AND request_id=$2 ORDER BY submitted_at,id`,
        [context.organizationId, request.id]) : { rows: [] };
      const recordResult = await client.query<{
        id: string; lifecycle_status: "draft" | "published"; mechanism: AdjudicationMechanismV1; outcome: JsonValue;
        rationale: string; participant_rationale: string; confidence: string; synthesis: string; explanation_trace: AdjudicationTraceEntryV1[];
        suggestion: JsonValue | null; override_rationale: string | null; effects: JsonValue[]; publication_scope: JsonObject;
        lead_display_name: string; lead_organization_name: string; version: string; published_at: Date | null;
      }>("SELECT * FROM runtime.adjudication_records WHERE organization_id=$1 AND request_id=$2", [context.organizationId, request.id]);
      const final = recordResult.rows[0];
      if (final?.lifecycle_status === "published") {
        await client.query(
          `INSERT INTO runtime.adjudication_deliveries
             (id,organization_id,session_id,adjudication_record_id,record_version,recipient_participant_id,delivered_at)
           VALUES ($1,$2,$3,$4,$5,$6,transaction_timestamp()) ON CONFLICT (adjudication_record_id,record_version,recipient_participant_id)
           DO UPDATE SET delivered_at=COALESCE(runtime.adjudication_deliveries.delivered_at,EXCLUDED.delivered_at)`,
          [randomUUID(), context.organizationId, context.sessionId, final.id, Number(final.version), context.participantId]
        );
      }
      result.push({ contractId: ADJUDICATION_REQUEST_CONTRACT_ID, id: request.id, modelId: model.id, modelName: model.name,
        mechanism: model.mechanism, status: request.status, version: Number(request.version),
        ...(lead && (model.mechanism === "rubric" || model.mechanism === "hybrid") ? {
          rubric: (model.rubric ?? []).map(({ id, label, weight, minimum, maximum, anchors }) => ({
            id, label, weight, minimum, maximum, ...(anchors === undefined ? {} : { anchors })
          }))
        } : {}),
        actionSnapshots: actions.map((action) => ({ artifactId: action.artifact_id, artifactVersion: Number(action.artifact_version),
          artifactTypeKey: action.artifact_type_key, payload: action.payload_snapshot })),
        perspectives: model.perspectives.filter(({ reviewerSessionRoleIds }) => reviewerSessionRoleIds.includes(context.activeSessionRoleId)),
        reviews: reviews.rows.map((review) => ({ id: review.id, perspectiveId: review.perspective_id, recommendation: review.recommendation,
          rationale: review.rationale, evidenceArtifactIds: review.evidence_artifact_ids.filter((id) => visibleActionIds.has(id)),
          ...((lead || review.reviewer_person_id === context.principalId) && review.hidden_analytical_notes !== null
            ? { hiddenAnalyticalNotes: review.hidden_analytical_notes } : {}), confidence: Number(review.confidence),
          reviewerPersonId: review.reviewer_person_id, reviewerSessionRoleId: review.reviewer_session_role_id,
          reviewerDisplayName: review.reviewer_display_name, reviewerOrganizationName: review.reviewer_organization_name,
          submittedAt: review.submitted_at.toISOString() })),
        record: final === undefined || (!reviewer && final.lifecycle_status !== "published") ? null : {
          contractId: ADJUDICATION_RECORD_CONTRACT_ID, id: final.id, requestId: request.id, status: final.lifecycle_status,
          mechanism: final.mechanism, outcome: final.outcome, rationale: reviewer ? final.rationale : final.participant_rationale,
          participantRationale: final.participant_rationale, confidence: Number(final.confidence),
          synthesis: reviewer ? final.synthesis : final.participant_rationale,
          explanationTrace: reviewer ? final.explanation_trace : [], suggestion: reviewer ? final.suggestion : null,
          overrideRationale: reviewer ? final.override_rationale : null, effects: reviewer ? final.effects : [],
          publicationScope: final.publication_scope, leadDisplayName: final.lead_display_name,
          leadOrganizationName: final.lead_organization_name, version: Number(final.version), publishedAt: final.published_at?.toISOString() ?? null },
        canReview: reviewer && request.status !== "published", canSynthesize: lead && request.status !== "published" });
    }
    return result;
}
