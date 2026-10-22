import { createHash, randomUUID } from "node:crypto";

import {
  EFFECT_PROPOSAL_CONTRACT_ID,
  canonicalizeJson,
  type EffectProposalV1,
  type JsonObject,
  type JsonValue
} from "@plenum/event-contracts";
import type { PluginManifestV1, PluginRevocationsV1 } from "@plenum/plugin-sdk";
import type { Pool, PoolClient } from "pg";

import { withOrganizationTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { SessionAccessContextV1 } from "../identity/context.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import type { CommandDecision, CommandExecutionContext } from "../runtime/commands/processor.js";
import { applyStateValueChange } from "../runtime/state/world-state.js";

const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ExtensionRunPlan {
  id: string;
  governingReleaseId: string;
  bindingId: string;
  graphDigest: string;
  seed: number;
  triggerSessionRoleIds: string[];
  reviewerSessionRoleIds: string[];
  inputMappings: Array<{ inputKey: string; stateVariableId: string; scopeReference: string }>;
  allowedEffects: Array<{ stateVariableId: string; scopeReference: string; operations: Array<"set" | "adjust"> }>;
}

export interface PreparedPluginArtifact {
  manifest: PluginManifestV1;
  pluginDirectory: string;
  inputSchema: unknown;
  outputSchema: unknown;
}

export interface ExtensionExecutorResult {
  outputs: JsonObject;
  outputDigest: string;
  environmentDigest: string;
  durationMs: number;
}

export interface ExtensionRuntime {
  plans: ReadonlyMap<string, ExtensionRunPlan>;
  loadArtifact(artifactId: string): Promise<PreparedPluginArtifact>;
  execute(input: PreparedPluginArtifact & { inputs: JsonObject }): Promise<ExtensionExecutorResult>;
}

function sha256(value: JsonValue): string {
  return `sha256:${createHash("sha256").update(canonicalizeJson(value)).digest("hex")}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function validatePlan(plan: ExtensionRunPlan): void {
  if (!uuidPattern.test(plan.governingReleaseId) || !uuidPattern.test(plan.bindingId) || !digestPattern.test(plan.graphDigest) ||
      !Number.isSafeInteger(plan.seed) || plan.seed < 0 || plan.triggerSessionRoleIds.length === 0 ||
      plan.reviewerSessionRoleIds.length === 0 || plan.allowedEffects.length === 0 ||
      plan.inputMappings.some((mapping) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(mapping.inputKey))) {
    throw new Error(`Extension Run Plan ${plan.id} is invalid`);
  }
}

export function createCompositionRunExecutor(plans: ReadonlyMap<string, ExtensionRunPlan>) {
  return async ({ client, context, command, activeReleaseId }: CommandExecutionContext): Promise<CommandDecision> => {
    const payload = asRecord(command.payload);
    const planId = payload?.planId;
    const plan = typeof planId === "string" ? plans.get(planId) : undefined;
    if (plan === undefined) return { status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE", message: "The configured Model Run Plan is unavailable." };
    validatePlan(plan);
    if (plan.governingReleaseId !== activeReleaseId || command.governingReleaseId !== activeReleaseId) {
      return { status: "needs_reconciliation", errorCode: "INCOMPATIBLE_RELEASE", message: "The Model Run Plan is not pinned to the active Release." };
    }
    if (!plan.triggerSessionRoleIds.includes(context.activeSessionRoleId)) {
      return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The active Session Role cannot start this Model Run." };
    }
    const binding = await client.query<{
      artifact_id: string; artifact_digest: string; configuration_digest: string; publisher_id: string; manifest: PluginManifestV1;
    }>(
      `SELECT artifact.id AS artifact_id,binding.artifact_digest,binding.configuration_digest,artifact.publisher_id,artifact.manifest
         FROM extension.plugin_bindings binding
         JOIN extension.plugin_installations installation ON installation.organization_id=binding.organization_id AND installation.id=binding.installation_id
         JOIN extension.plugin_artifacts artifact ON artifact.organization_id=installation.organization_id AND artifact.id=installation.artifact_id
         JOIN registry.releases release ON release.organization_id=binding.organization_id AND release.definition_revision_id=binding.definition_revision_id
        WHERE binding.organization_id=$1 AND binding.id=$2 AND release.id=$3
          AND binding.status='enabled' AND installation.status='enabled' AND artifact.lifecycle_status='approved'
        FOR SHARE OF artifact`,
      [context.organizationId, plan.bindingId, activeReleaseId]
    );
    const bindingRow = binding.rows[0];
    if (bindingRow === undefined) return { status: "rejected", errorCode: "PLUGIN_NOT_APPROVED", message: "The pinned Plugin Binding is not authorized for a new run." };
    const publisher = await client.query(
      "SELECT 1 FROM extension.publishers WHERE organization_id=$1 AND id=$2 AND status='approved' FOR SHARE",
      [context.organizationId, bindingRow.publisher_id]
    );
    const revocations = await client.query<{ document: PluginRevocationsV1 }>(
      "SELECT document FROM extension.revocation_lists WHERE organization_id=$1 AND publisher_id=$2 ORDER BY generated_at DESC LIMIT 1",
      [context.organizationId, bindingRow.publisher_id]
    );
    const revocation = revocations.rows[0]?.document;
    if (publisher.rowCount !== 1 || revocation === undefined ||
        revocation.revokedKeyIds.includes(bindingRow.manifest.publisher.signatureKeyId) ||
        revocation.revokedDigests.includes(bindingRow.artifact_digest)) {
      return { status: "rejected", errorCode: "PLUGIN_NOT_APPROVED", message: "The Plugin is revoked or current revocation data is unavailable." };
    }

    const snapshot: JsonObject = { seed: plan.seed };
    for (const mapping of plan.inputMappings) {
      const state = await client.query<{ value: JsonValue }>(
        `SELECT value FROM runtime.state_values WHERE organization_id=$1 AND session_id=$2
          AND state_variable_id=$3 AND scope_reference=$4`,
        [context.organizationId, context.sessionId, mapping.stateVariableId, mapping.scopeReference]
      );
      if (state.rows[0] === undefined) return { status: "rejected", errorCode: "REFERENCE_INVALID", message: `Mapped state input ${mapping.inputKey} is unavailable.` };
      snapshot[mapping.inputKey] = state.rows[0].value;
    }
    const snapshotId = randomUUID();
    const modelRunId = randomUUID();
    const inputDigest = sha256(snapshot);
    await client.query(
      `INSERT INTO extension.composition_runs
         (id,organization_id,session_id,governing_release_id,trigger_command_id,graph_digest,input_snapshot_id,input_snapshot,input_digest,execution_policy,authority_epoch,status,correlation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,'pending',$12)`,
      [command.aggregateId, context.organizationId, context.sessionId, activeReleaseId, command.commandId, plan.graphDigest,
        snapshotId, JSON.stringify(snapshot), inputDigest, JSON.stringify({ reviewerSessionRoleIds: plan.reviewerSessionRoleIds, allowedEffects: plan.allowedEffects }),
        context.authorityEpoch, randomUUID()]
    );
    await client.query(
      `INSERT INTO extension.model_runs
         (id,organization_id,session_id,composition_run_id,binding_id,artifact_digest,configuration_digest,governing_release_id,input_snapshot_id,input_digest,seed,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')`,
      [modelRunId, context.organizationId, context.sessionId, command.aggregateId, plan.bindingId, bindingRow.artifact_digest,
        bindingRow.configuration_digest, activeReleaseId, snapshotId, inputDigest, plan.seed]
    );
    return { status: "accepted", aggregateVersion: 1, eventType: "composition_run.started", eventPayload: {
      compositionRunId: command.aggregateId, modelRunId, bindingId: plan.bindingId, pluginDigest: bindingRow.artifact_digest,
      configurationDigest: bindingRow.configuration_digest, inputSnapshotId: snapshotId, inputDigest
    } };
  };
}

type PendingRun = {
  id: string; artifact_id: string; artifact_digest: string; configuration_digest: string; input_snapshot: JsonObject;
  input_digest: string; governing_release_id: string; authority_epoch: string; execution_policy: {
    reviewerSessionRoleIds: string[]; allowedEffects: ExtensionRunPlan["allowedEffects"];
  };
};

function pluginEffects(outputs: JsonObject): Array<Record<string, unknown>> {
  const effects = outputs.effectProposals;
  if (!Array.isArray(effects) || effects.length === 0 || effects.length > 32) throw new Error("Plugin output has no bounded Effect Proposal set");
  return effects.map((effect) => {
    const record = asRecord(effect);
    if (record === undefined) throw new Error("Plugin Effect Proposal is malformed");
    return record;
  });
}

function failureCode(error: unknown): "timeout" | "output_invalid" | "execution_failed" {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("timed out") ? "timeout" : message.includes("output") || message.includes("schema") ? "output_invalid" : "execution_failed";
}

export async function executePendingModelRun(pool: Pool, organizationId: string, compositionRunId: string, runtime: ExtensionRuntime): Promise<void> {
  const pending = await withOrganizationTransaction(pool, organizationId, async (client) => {
    const result = await client.query<PendingRun>(
      `SELECT run.id,artifact.id AS artifact_id,run.artifact_digest,run.configuration_digest,composition.input_snapshot,
              run.input_digest,run.governing_release_id,composition.authority_epoch,composition.execution_policy
         FROM extension.model_runs run JOIN extension.composition_runs composition
           ON composition.organization_id=run.organization_id AND composition.id=run.composition_run_id
         JOIN extension.plugin_bindings binding ON binding.organization_id=run.organization_id AND binding.id=run.binding_id
         JOIN extension.plugin_installations installation ON installation.organization_id=binding.organization_id AND installation.id=binding.installation_id
         JOIN extension.plugin_artifacts artifact ON artifact.organization_id=installation.organization_id AND artifact.id=installation.artifact_id
        WHERE run.organization_id=$1 AND run.composition_run_id=$2 AND run.status='pending'
        FOR UPDATE OF run,composition`,
      [organizationId, compositionRunId]
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    await client.query("UPDATE extension.model_runs SET status='running',started_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2", [organizationId, row.id]);
    await client.query("UPDATE extension.composition_runs SET status='running' WHERE organization_id=$1 AND id=$2", [organizationId, compositionRunId]);
    return row;
  });
  if (pending === undefined) return;
  try {
    const artifact = await runtime.loadArtifact(pending.artifact_id);
    if (artifact.manifest.digest !== pending.artifact_digest) throw new Error("Plugin Artifact digest changed after run authorization");
    const result = await runtime.execute({ ...artifact, inputs: pending.input_snapshot });
    if (!digestPattern.test(result.outputDigest) || !digestPattern.test(result.environmentDigest)) throw new Error("Extension Host provenance is invalid");
    const effects = pluginEffects(result.outputs);
    await withOrganizationTransaction(pool, organizationId, async (client) => {
      const run = await client.query<{ status: string }>("SELECT status FROM extension.model_runs WHERE organization_id=$1 AND id=$2 FOR UPDATE", [organizationId, pending.id]);
      if (run.rows[0]?.status !== "running") throw new Error("Model Run is not running");
      for (const effect of effects) {
        const effectId = effect.effectId;
        const targetAggregateId = effect.targetAggregateId;
        const stateVariableId = effect.targetStateVariableId;
        const scopeReference = effect.scopeReference;
        const operation = effect.operation;
        const rationale = effect.rationale;
        if (typeof effectId !== "string" || !uuidPattern.test(effectId) || typeof targetAggregateId !== "string" || !uuidPattern.test(targetAggregateId) ||
            typeof stateVariableId !== "string" || typeof scopeReference !== "string" || (operation !== "set" && operation !== "adjust") ||
            typeof rationale !== "string" || rationale.length === 0 || !pending.execution_policy.allowedEffects.some((allowed) =>
              allowed.stateVariableId === stateVariableId && allowed.scopeReference === scopeReference && allowed.operations.includes(operation))) {
          throw new Error("Plugin proposed an effect outside the compiled allowlist");
        }
        const target = await client.query<{ version: string }>(
          `SELECT version FROM runtime.state_values WHERE organization_id=$1 AND id=$2 AND session_id=(SELECT session_id FROM extension.model_runs WHERE organization_id=$1 AND id=$3)
            AND state_variable_id=$4 AND scope_reference=$5 FOR SHARE`,
          [organizationId, targetAggregateId, pending.id, stateVariableId, scopeReference]
        );
        const targetVersion = Number(target.rows[0]?.version);
        if (!Number.isSafeInteger(targetVersion)) throw new Error("Plugin Effect Proposal target is unavailable");
        const proposalValue = effect.value as JsonValue;
        const proposalHash = sha256({ effectId, targetAggregateId, stateVariableId, scopeReference, operation, value: proposalValue,
          governingReleaseId: pending.governing_release_id, authorityEpoch: Number(pending.authority_epoch), expectedStateVersion: targetVersion,
          modelRunId: pending.id, artifactDigest: pending.artifact_digest, configurationDigest: pending.configuration_digest,
          inputDigest: pending.input_digest, outputDigest: result.outputDigest });
        await client.query(
          `INSERT INTO extension.effect_proposals
             (id,organization_id,session_id,model_run_id,proposal_hash,target_aggregate_id,target_state_variable_id,scope_reference,operation,value,rationale,
              reviewer_role_ids,lifecycle_status,expected_state_version,governing_release_id,authority_epoch,artifact_digest,configuration_digest,input_digest,output_digest)
           SELECT $1,$2,session_id,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,'in_review',$12,$13,$14,$15,$16,$17,$18
             FROM extension.model_runs WHERE organization_id=$2 AND id=$3`,
          [effectId, organizationId, pending.id, proposalHash, targetAggregateId, stateVariableId, scopeReference, operation,
            JSON.stringify(proposalValue), rationale, pending.execution_policy.reviewerSessionRoleIds, targetVersion,
            pending.governing_release_id, Number(pending.authority_epoch), pending.artifact_digest, pending.configuration_digest,
            pending.input_digest, result.outputDigest]
        );
      }
      await client.query(
        "UPDATE extension.model_runs SET status='completed',output_digest=$1,environment_digest=$2,duration_ms=$3,completed_at=transaction_timestamp() WHERE organization_id=$4 AND id=$5",
        [result.outputDigest, result.environmentDigest, result.durationMs, organizationId, pending.id]
      );
      await client.query("UPDATE extension.composition_runs SET status='completed',completed_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2", [organizationId, compositionRunId]);
    });
  } catch (error) {
    await withOrganizationTransaction(pool, organizationId, async (client) => {
      await client.query(
        "UPDATE extension.model_runs SET status='failed',failure_code=$1,completed_at=transaction_timestamp() WHERE organization_id=$2 AND id=$3 AND status='running'",
        [failureCode(error), organizationId, pending.id]
      );
      await client.query("UPDATE extension.composition_runs SET status='failed',completed_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2 AND status='running'", [organizationId, compositionRunId]);
    });
  }
}

export async function executeEffectProposalCommand({ client, context, command, activeReleaseId }: CommandExecutionContext): Promise<CommandDecision> {
  const action = command.operationType.slice("effect_proposal.".length);
  if (!(["approve", "reject", "return"] as const).includes(action as "approve" | "reject" | "return")) {
    return { status: "rejected", errorCode: "CAPABILITY_UNAVAILABLE", message: "The Effect Proposal action is unavailable." };
  }
  const payload = asRecord(command.payload);
  const proposalHash = payload?.proposalHash;
  const reason = typeof payload?.reason === "string" ? payload.reason.trim() : undefined;
  if (typeof proposalHash !== "string" || !digestPattern.test(proposalHash) || typeof reason !== "string" || reason.length < 1 || reason.length > 2000) {
    return { status: "rejected", errorCode: "VALIDATION_FAILED", message: "Proposal hash and decision reason are required." };
  }
  const result = await client.query<{
    proposal_hash: string; lifecycle_status: string; reviewer_role_ids: string[]; expected_state_version: string;
    governing_release_id: string; authority_epoch: string; target_aggregate_id: string; target_state_variable_id: string;
    scope_reference: string; operation: "set" | "adjust";
    value: JsonValue; version: string;
  }>(
    `SELECT proposal_hash,lifecycle_status,reviewer_role_ids,expected_state_version,governing_release_id,authority_epoch,
            target_aggregate_id,target_state_variable_id,scope_reference,operation,value,version
       FROM extension.effect_proposals WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE`,
    [context.organizationId, context.sessionId, command.aggregateId]
  );
  const proposal = result.rows[0];
  if (proposal === undefined) return { status: "rejected", errorCode: "TARGET_NOT_FOUND", message: "The Effect Proposal was not found." };
  if (!proposal.reviewer_role_ids.includes(context.activeSessionRoleId)) return { status: "rejected", errorCode: "PERMISSION_DENIED", message: "The active Session Role cannot review this Effect Proposal." };
  if (proposal.lifecycle_status !== "in_review") return { status: "rejected", errorCode: "CONFLICT", message: "The Effect Proposal already has a decision." };
  const stale = proposal.proposal_hash !== proposalHash || proposal.governing_release_id !== activeReleaseId ||
    proposal.governing_release_id !== command.governingReleaseId || Number(proposal.authority_epoch) !== context.authorityEpoch ||
    Number(proposal.version) !== command.expectedAggregateVersion;
  const state = await client.query<{ version: string; value: JsonValue }>(
    "SELECT version,value FROM runtime.state_values WHERE organization_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE",
    [context.organizationId, context.sessionId, proposal.target_aggregate_id]
  );
  if (stale || state.rows[0] === undefined || Number(state.rows[0].version) !== Number(proposal.expected_state_version)) {
    await client.query("UPDATE extension.effect_proposals SET lifecycle_status='stale',version=version+1,decided_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2", [context.organizationId, command.aggregateId]);
    return { status: "needs_reconciliation", errorCode: "STALE_PROPOSAL", message: "The Effect Proposal no longer matches authoritative state." };
  }
  const decisionId = randomUUID();
  await client.query(
    `INSERT INTO extension.approval_decisions
       (id,organization_id,session_id,proposal_id,proposal_hash,reviewer_person_id,reviewer_participant_id,reviewer_session_role_id,decision,reason,
        governing_release_id,authority_epoch,expected_state_version,command_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [decisionId, context.organizationId, context.sessionId, command.aggregateId, proposalHash, context.principalId, context.participantId,
      context.activeSessionRoleId, action, reason, activeReleaseId, context.authorityEpoch, Number(proposal.expected_state_version), command.commandId]
  );
  if (action !== "approve") {
    const status = action === "reject" ? "rejected" : "returned";
    await client.query("UPDATE extension.effect_proposals SET lifecycle_status=$1,version=version+1,decided_at=transaction_timestamp() WHERE organization_id=$2 AND id=$3", [status, context.organizationId, command.aggregateId]);
    return { status: "accepted", aggregateVersion: Number(proposal.version) + 1, eventType: `effect_proposal.${status}`, eventPayload: {
      proposalId: command.aggregateId, proposalHash, approvalDecisionId: decisionId, decision: action
    } };
  }
  const transaction = await applyStateValueChange(client, {
    organizationId: context.organizationId, sessionId: context.sessionId, governingReleaseId: activeReleaseId
  }, {
    stateVariableId: proposal.target_state_variable_id,
    scopeReference: proposal.scope_reference,
    operation: proposal.operation === "adjust" ? "increment" : "set",
    value: proposal.value as boolean | number | string,
    rationale: reason
  }, {
    type: "plugin", reference: command.aggregateId, commandId: command.commandId,
    actorPersonId: context.principalId, rationale: reason
  }, { targetId: proposal.target_aggregate_id, expectedVersion: Number(proposal.expected_state_version) });
  const appliedVersion = transaction.version;
  await client.query("UPDATE extension.effect_proposals SET lifecycle_status='applied',version=version+1,decided_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2", [context.organizationId, command.aggregateId]);
  await client.query(
    `INSERT INTO extension.effect_receipts(id,organization_id,session_id,proposal_id,approval_decision_id,command_id,applied_state_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [randomUUID(), context.organizationId, context.sessionId, command.aggregateId, decisionId, command.commandId, appliedVersion]
  );
  return { status: "accepted", aggregateVersion: Number(proposal.version) + 1, eventType: "effect_proposal.applied", eventPayload: {
    proposalId: command.aggregateId, proposalHash, approvalDecisionId: decisionId, effectReceiptCommandId: command.commandId,
    targetAggregateId: proposal.target_aggregate_id, appliedStateVersion: appliedVersion
  } };
}

export async function getEffectProposals(pool: Pool, context: SessionAccessContextV1): Promise<EffectProposalV1[]> {
  return withOrganizationTransaction(pool, context.organizationId, async (client) => {
    const result = await client.query<{
      id: string; model_run_id: string; proposal_hash: string; target_aggregate_id: string; target_state_variable_id: string;
      scope_reference: string; operation: "set" | "adjust"; value: JsonValue; rationale: string; lifecycle_status: EffectProposalV1["status"];
      expected_state_version: string; governing_release_id: string; authority_epoch: string; artifact_digest: string;
      configuration_digest: string; input_digest: string; output_digest: string; version: string;
    }>(
      `SELECT id,model_run_id,proposal_hash,target_aggregate_id,target_state_variable_id,scope_reference,operation,value,rationale,
              lifecycle_status,expected_state_version,governing_release_id,authority_epoch,artifact_digest,configuration_digest,input_digest,output_digest,version
         FROM extension.effect_proposals
        WHERE organization_id=$1 AND session_id=$2 AND $3=ANY(reviewer_role_ids)
        ORDER BY staged_at,id LIMIT 100`,
      [context.organizationId, context.sessionId, context.activeSessionRoleId]
    );
    return result.rows.map((row) => ({
      contractId: EFFECT_PROPOSAL_CONTRACT_ID, id: row.id, modelRunId: row.model_run_id, proposalHash: row.proposal_hash,
      targetAggregateId: row.target_aggregate_id, targetStateVariableId: row.target_state_variable_id, scopeReference: row.scope_reference,
      operation: row.operation, value: row.value, rationale: row.rationale, status: row.lifecycle_status,
      expectedStateVersion: Number(row.expected_state_version), governingReleaseId: row.governing_release_id,
      authorityEpoch: Number(row.authority_epoch), pluginDigest: row.artifact_digest, configurationDigest: row.configuration_digest,
      inputDigest: row.input_digest, outputDigest: row.output_digest, version: Number(row.version)
    }));
  });
}

export async function exportExtensionProvenance(
  pool: Pool,
  principal: AuthenticatedPrincipal,
  sessionId: string,
  correlationId: string
): Promise<JsonObject> {
  if (!principal.organizationRoles.includes("operator")) throw authorizationError("PERMISSION_DENIED", "Operator access is required for provenance export.", correlationId);
  return withOrganizationTransaction(pool, principal.organizationId, async (client: PoolClient) => {
    const currentRole = await client.query(
      "SELECT 1 FROM identity.memberships WHERE organization_id=$1 AND person_id=$2 AND organization_role='operator'",
      [principal.organizationId, principal.principalId]
    );
    if (currentRole.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Operator access is no longer active.", correlationId);
    const session = await client.query("SELECT 1 FROM runtime.sessions WHERE organization_id=$1 AND id=$2", [principal.organizationId, sessionId]);
    if (session.rowCount !== 1) throw authorizationError("TARGET_NOT_FOUND", "The Session was not found.", correlationId);
    const runs = await client.query(
      `SELECT run.id AS model_run_id,run.composition_run_id,run.binding_id,run.artifact_digest,run.configuration_digest,
              run.input_digest,run.output_digest,run.environment_digest,run.governing_release_id,run.seed,run.attempt,
              run.duration_ms,run.status,run.failure_code,run.started_at,run.completed_at
         FROM extension.model_runs run
        WHERE run.organization_id=$1 AND run.session_id=$2 ORDER BY run.composition_run_id,run.attempt,run.id`,
      [principal.organizationId, sessionId]
    );
    const proposals = await client.query(
      `SELECT proposal.id AS proposal_id,proposal.proposal_hash,proposal.lifecycle_status,proposal.artifact_digest,proposal.configuration_digest,
              proposal.input_digest,proposal.output_digest,proposal.governing_release_id,proposal.authority_epoch,run.environment_digest,
              decision.id AS decision_id,decision.decision,decision.reviewer_person_id,decision.command_id,
              receipt.applied_state_version,command.evidence_sequence
         FROM extension.effect_proposals proposal
         JOIN extension.model_runs run ON run.organization_id=proposal.organization_id AND run.id=proposal.model_run_id
         LEFT JOIN extension.approval_decisions decision ON decision.organization_id=proposal.organization_id AND decision.proposal_id=proposal.id
         LEFT JOIN extension.effect_receipts receipt ON receipt.organization_id=proposal.organization_id AND receipt.proposal_id=proposal.id
         LEFT JOIN sync.command_receipts command ON command.organization_id=proposal.organization_id AND command.session_id=proposal.session_id AND command.command_id=decision.command_id
        WHERE proposal.organization_id=$1 AND proposal.session_id=$2 ORDER BY proposal.staged_at,proposal.id`,
      [principal.organizationId, sessionId]
    );
    return {
      contractId: "extension-provenance-export-v1",
      sessionId,
      runs: runs.rows as JsonValue[],
      proposals: proposals.rows as JsonValue[]
    };
  });
}
