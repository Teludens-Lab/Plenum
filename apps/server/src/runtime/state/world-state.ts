import { randomUUID } from "node:crypto";
import {
  STATE_TRANSACTION_CONTRACT_ID,
  type JsonValue,
  type StateTransactionV1
} from "@plenum/event-contracts";
import type { StateEffectV1, StateVariableDefinitionV1 } from "@plenum/simulation-schema";
import type { PoolClient } from "pg";

export interface StateChangeSourceV1 {
  type: StateTransactionV1["sourceType"];
  reference: string;
  commandId: string;
  actorPersonId: string;
  rationale: string;
}

interface WorldStateContext {
  organizationId: string;
  sessionId: string;
  governingReleaseId: string;
}

interface WorldStateDefinitionSet {
  stateVariables?: StateVariableDefinitionV1[];
  capabilities?: Array<{ id: string; initialState: string; mode?: "boolean" | "counted"; initialQuantity?: number; maximumQuantity?: number }>;
  resourceDefinitions?: Array<{ id: string }>;
}

interface InitialWorldState {
  initialState?: Array<{ stateVariableId: string; scopeReference?: string; value: boolean | number | string }>;
  initialCapabilities?: Array<{ capabilityId: string; scopeReference?: string; state: string; quantity?: number }>;
  initialResources?: Array<{ resourceId: string; scopeReference?: string; balance: number }>;
}

export async function initializeWorldState(
  client: PoolClient,
  context: WorldStateContext,
  definitions: WorldStateDefinitionSet,
  initial: InitialWorldState
): Promise<void> {
  for (const value of initial.initialState ?? []) {
    const definition = definitions.stateVariables?.find(({ id }) => id === value.stateVariableId);
    assertStateValue(definition, value.value);
    await client.query(
      `INSERT INTO runtime.state_values
         (id,organization_id,session_id,governing_release_id,state_variable_id,scope_reference,value,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,1) ON CONFLICT (session_id,state_variable_id,scope_reference) DO NOTHING`,
      [randomUUID(), context.organizationId, context.sessionId, context.governingReleaseId,
        value.stateVariableId, value.scopeReference ?? "", JSON.stringify(value.value)]
    );
  }
  const capabilities = [...(initial.initialCapabilities ?? [])];
  for (const definition of definitions.capabilities ?? []) {
    if (!capabilities.some(({ capabilityId, scopeReference }) => capabilityId === definition.id && (scopeReference ?? "") === "")) {
      capabilities.push({ capabilityId: definition.id, state: definition.initialState,
        ...(definition.mode === "counted" ? { quantity: definition.initialQuantity } : {}) });
    }
  }
  for (const capability of capabilities) {
    const definition = definitions.capabilities?.find(({ id }) => id === capability.capabilityId);
    if (definition === undefined) continue;
    const quantity = capability.quantity ?? (definition.mode === "counted" ? definition.initialQuantity : undefined);
    if (definition.mode === "counted" && (!Number.isSafeInteger(quantity) || Number(quantity) < 0 || Number(quantity) > Number(definition.maximumQuantity)) ||
        definition.mode !== "counted" && quantity !== undefined) throw new Error(`Capability ${capability.capabilityId} quantity is invalid`);
    await client.query(
      `INSERT INTO runtime.capability_instances
         (id,organization_id,session_id,governing_release_id,capability_id,scope_reference,state,quantity,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1) ON CONFLICT (session_id,capability_id,scope_reference) DO NOTHING`,
      [randomUUID(), context.organizationId, context.sessionId, context.governingReleaseId,
        capability.capabilityId, capability.scopeReference ?? "", capability.state, quantity ?? null]
    );
  }
  for (const resource of initial.initialResources ?? []) {
    if (!definitions.resourceDefinitions?.some(({ id }) => id === resource.resourceId)) continue;
    await client.query(
      `INSERT INTO runtime.resource_balances
         (id,organization_id,session_id,governing_release_id,resource_id,scope_reference,balance,version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1) ON CONFLICT (session_id,resource_id,scope_reference) DO NOTHING`,
      [randomUUID(), context.organizationId, context.sessionId, context.governingReleaseId,
        resource.resourceId, resource.scopeReference ?? "", resource.balance]
    );
  }
}

export async function readWorldStateFacts(
  client: PoolClient,
  context: Pick<WorldStateContext, "organizationId" | "sessionId">,
  visible: { stateVariableIds: ReadonlySet<string>; capabilityIds: ReadonlySet<string>; resourceIds: ReadonlySet<string> }
): Promise<Record<string, boolean | number | string>> {
  const facts: Record<string, boolean | number | string> = {};
  const states = await client.query<{ state_variable_id: string; scope_reference: string; value: JsonValue }>(
    "SELECT state_variable_id,scope_reference,value FROM runtime.state_values WHERE organization_id=$1 AND session_id=$2",
    [context.organizationId, context.sessionId]
  );
  for (const row of states.rows) {
    if (!visible.stateVariableIds.has(row.state_variable_id) || !["boolean", "number", "string"].includes(typeof row.value)) continue;
    facts[row.scope_reference.length === 0 ? `state.${row.state_variable_id}` :
      `state.${row.state_variable_id}.team.${row.scope_reference}`] = row.value as boolean | number | string;
  }
  const capabilities = await client.query<{ capability_id: string; state: string; quantity: string | null }>(
    "SELECT capability_id,state,quantity FROM runtime.capability_instances WHERE organization_id=$1 AND session_id=$2 AND scope_reference=''",
    [context.organizationId, context.sessionId]
  );
  capabilities.rows.forEach((row) => {
    if (!visible.capabilityIds.has(row.capability_id)) return;
    facts[`capability.${row.capability_id}.status`] = row.state;
    if (row.quantity !== null) facts[`capability.${row.capability_id}.quantity`] = Number(row.quantity);
  });
  const resources = await client.query<{ resource_id: string; balance: string }>(
    "SELECT resource_id,balance FROM runtime.resource_balances WHERE organization_id=$1 AND session_id=$2 AND scope_reference=''",
    [context.organizationId, context.sessionId]
  );
  resources.rows.forEach((row) => {
    if (visible.resourceIds.has(row.resource_id)) facts[`resource.${row.resource_id}.balance`] = Number(row.balance);
  });
  return facts;
}

async function insertTransaction(
  client: PoolClient,
  context: WorldStateContext,
  input: Omit<StateTransactionV1, "contractId" | "id" | "sessionId" | "governingReleaseId" | "occurredAt">
): Promise<StateTransactionV1> {
  const id = randomUUID();
  const result = await client.query<{ occurred_at: Date }>(
    `INSERT INTO runtime.state_transactions
       (id,organization_id,session_id,governing_release_id,target_kind,target_id,definition_id,scope_reference,operation,
        previous_value,new_value,source_type,source_reference,source_command_id,actor_person_id,rationale,version,occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17,transaction_timestamp())
     RETURNING occurred_at`,
    [id, context.organizationId, context.sessionId, context.governingReleaseId, input.targetKind, input.targetId,
      input.definitionId, input.scopeReference, input.operation, JSON.stringify(input.previousValue), JSON.stringify(input.newValue),
      input.sourceType, input.sourceReference, input.sourceCommandId, input.actorPersonId, input.rationale, input.version]
  );
  const occurredAt = result.rows[0]?.occurred_at;
  if (occurredAt === undefined) throw new Error("State Transaction was not recorded");
  return { contractId: STATE_TRANSACTION_CONTRACT_ID, id, sessionId: context.sessionId,
    governingReleaseId: context.governingReleaseId, ...input, occurredAt: occurredAt.toISOString() };
}

function nextStateValue(previous: JsonValue, effect: StateEffectV1): JsonValue {
  if (effect.operation === "set") return effect.value;
  if (typeof previous !== "number" || typeof effect.value !== "number" || !Number.isFinite(previous) || !Number.isFinite(effect.value)) {
    throw new Error(`State Effect ${effect.stateVariableId} requires numeric values`);
  }
  const next = effect.operation === "increment" ? previous + effect.value :
    effect.operation === "decrement" ? previous - effect.value : previous * effect.value;
  if (!Number.isFinite(next)) throw new Error(`State Effect ${effect.stateVariableId} exceeds numeric bounds`);
  return next;
}

function assertStateValue(definition: StateVariableDefinitionV1 | undefined, value: JsonValue): void {
  if (definition === undefined) return;
  const validType = definition.type === "integer" ? typeof value === "number" && Number.isSafeInteger(value) :
    definition.type === "decimal" ? typeof value === "number" && Number.isFinite(value) :
      definition.type === "boolean" ? typeof value === "boolean" : typeof value === "string";
  if (!validType || typeof value === "number" && (definition.minimum !== undefined && value < definition.minimum ||
      definition.maximum !== undefined && value > definition.maximum) || definition.type === "enum" &&
      !definition.options?.some(({ value: option }) => option === value)) {
    throw new Error(`State Effect ${definition.id} produces a value outside its definition`);
  }
}

export async function applyStateValueChange(
  client: PoolClient,
  context: WorldStateContext,
  effect: StateEffectV1,
  source: StateChangeSourceV1,
  options: { targetId?: string; expectedVersion?: number; definition?: StateVariableDefinitionV1 } = {}
): Promise<StateTransactionV1> {
  const result = await client.query<{ id: string; value: JsonValue; version: string }>(
    `SELECT id,value,version FROM runtime.state_values
      WHERE organization_id=$1 AND session_id=$2 AND state_variable_id=$3 AND scope_reference=$4
        AND ($5::uuid IS NULL OR id=$5) FOR UPDATE`,
    [context.organizationId, context.sessionId, effect.stateVariableId, effect.scopeReference ?? "", options.targetId ?? null]
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error(`State Value ${effect.stateVariableId} is unavailable`);
  const version = Number(row.version);
  if (options.expectedVersion !== undefined && version !== options.expectedVersion) throw new Error(`State Value ${effect.stateVariableId} is stale`);
  const next = nextStateValue(row.value, effect);
  assertStateValue(options.definition, next);
  const nextVersion = version + 1;
  await client.query(
    "UPDATE runtime.state_values SET value=$1::jsonb,version=$2,updated_at=transaction_timestamp() WHERE organization_id=$3 AND id=$4",
    [JSON.stringify(next), nextVersion, context.organizationId, row.id]
  );
  return insertTransaction(client, context, { targetKind: "state_value", targetId: row.id,
    definitionId: effect.stateVariableId, scopeReference: effect.scopeReference ?? "", operation: effect.operation,
    previousValue: row.value, newValue: next, sourceType: source.type, sourceReference: source.reference,
    sourceCommandId: source.commandId, actorPersonId: source.actorPersonId, rationale: source.rationale, version: nextVersion });
}

export async function scheduleStateValueChange(
  client: PoolClient,
  context: WorldStateContext,
  effect: StateEffectV1,
  effectIndex: number,
  source: StateChangeSourceV1
): Promise<string> {
  if (!Number.isSafeInteger(effect.delaySeconds) || Number(effect.delaySeconds) <= 0 || Number(effect.delaySeconds) > 604_800 ||
      !Number.isSafeInteger(effectIndex) || effectIndex < 0) throw new Error(`State Effect ${effect.stateVariableId} has an invalid delay`);
  const id = randomUUID();
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO runtime.scheduled_state_effects
       (id,organization_id,session_id,governing_release_id,effect,due_at,source_type,source_reference,
        source_command_id,effect_index,actor_person_id,rationale)
     VALUES ($1,$2,$3,$4,$5::jsonb,transaction_timestamp()+($6::integer*interval '1 second'),$7,$8,$9,$10,$11,$12)
     ON CONFLICT (session_id,source_command_id,source_reference,effect_index)
     DO UPDATE SET source_reference=EXCLUDED.source_reference RETURNING id`,
    [id, context.organizationId, context.sessionId, context.governingReleaseId, JSON.stringify(effect), effect.delaySeconds,
      source.type, source.reference, source.commandId, effectIndex, source.actorPersonId, source.rationale]
  );
  const scheduledId = inserted.rows[0]?.id;
  if (scheduledId === undefined) throw new Error("State Effect was not scheduled");
  return scheduledId;
}

export async function applyDueStateValueChanges(
  client: PoolClient,
  context: Pick<WorldStateContext, "organizationId" | "sessionId">,
  definitions: readonly StateVariableDefinitionV1[] = []
): Promise<string[]> {
  const due = await client.query<{
    id: string; governing_release_id: string; effect: StateEffectV1; source_type: StateChangeSourceV1["type"];
    source_reference: string; source_command_id: string; actor_person_id: string; rationale: string;
  }>(
    `SELECT id,governing_release_id,effect,source_type,source_reference,source_command_id,actor_person_id,rationale
       FROM runtime.scheduled_state_effects
      WHERE organization_id=$1 AND session_id=$2 AND status='scheduled' AND due_at<=transaction_timestamp()
      ORDER BY due_at,id FOR UPDATE SKIP LOCKED`,
    [context.organizationId, context.sessionId]
  );
  const transactionIds: string[] = [];
  for (const row of due.rows) {
    const transaction = await applyStateValueChange(client, {
      ...context, governingReleaseId: row.governing_release_id
    }, row.effect, {
      type: row.source_type, reference: row.source_reference, commandId: row.source_command_id,
      actorPersonId: row.actor_person_id, rationale: row.rationale
    }, (() => {
      const definition = definitions.find(({ id }) => id === row.effect.stateVariableId);
      return definition === undefined ? {} : { definition };
    })());
    await client.query(
      "UPDATE runtime.scheduled_state_effects SET status='applied',applied_at=transaction_timestamp() WHERE organization_id=$1 AND id=$2 AND status='scheduled'",
      [context.organizationId, row.id]
    );
    transactionIds.push(transaction.id);
  }
  return transactionIds;
}

export async function cancelScheduledStateValueChange(
  client: PoolClient,
  context: Pick<WorldStateContext, "organizationId" | "sessionId">,
  scheduledEffectId: string
): Promise<boolean> {
  const result = await client.query(
    `UPDATE runtime.scheduled_state_effects SET status='cancelled',cancelled_at=transaction_timestamp()
      WHERE organization_id=$1 AND session_id=$2 AND id=$3 AND status='scheduled' AND due_at>transaction_timestamp()`,
    [context.organizationId, context.sessionId, scheduledEffectId]
  );
  return result.rowCount === 1;
}

export async function applyCapabilityTransition(
  client: PoolClient,
  context: WorldStateContext,
  input: { capabilityId: string; scopeReference?: string; state: string; allowedStates: readonly string[] },
  source: StateChangeSourceV1
): Promise<StateTransactionV1> {
  if (!input.allowedStates.includes(input.state)) throw new Error(`Capability ${input.capabilityId} state is invalid`);
  const result = await client.query<{ id: string; state: string; version: string }>(
    `SELECT id,state,version FROM runtime.capability_instances
      WHERE organization_id=$1 AND session_id=$2 AND capability_id=$3 AND scope_reference=$4 FOR UPDATE`,
    [context.organizationId, context.sessionId, input.capabilityId, input.scopeReference ?? ""]
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Capability ${input.capabilityId} is unavailable`);
  const version = Number(row.version) + 1;
  await client.query("UPDATE runtime.capability_instances SET state=$1,version=$2,updated_at=transaction_timestamp() WHERE organization_id=$3 AND id=$4",
    [input.state, version, context.organizationId, row.id]);
  return insertTransaction(client, context, { targetKind: "capability", targetId: row.id, definitionId: input.capabilityId,
    scopeReference: input.scopeReference ?? "", operation: "transition", previousValue: row.state, newValue: input.state,
    sourceType: source.type, sourceReference: source.reference, sourceCommandId: source.commandId,
    actorPersonId: source.actorPersonId, rationale: source.rationale, version });
}

export async function applyCapabilityQuantityChange(
  client: PoolClient,
  context: WorldStateContext,
  input: { capabilityId: string; scopeReference?: string; operation: "consume" | "renew"; amount: number; maximumQuantity: number },
  source: StateChangeSourceV1
): Promise<StateTransactionV1> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || !Number.isSafeInteger(input.maximumQuantity) || input.maximumQuantity < 0) {
    throw new Error(`Capability ${input.capabilityId} amount is invalid`);
  }
  const result = await client.query<{ id: string; quantity: string | null; version: string }>(
    `SELECT id,quantity,version FROM runtime.capability_instances
      WHERE organization_id=$1 AND session_id=$2 AND capability_id=$3 AND scope_reference=$4 FOR UPDATE`,
    [context.organizationId, context.sessionId, input.capabilityId, input.scopeReference ?? ""]
  );
  const row = result.rows[0];
  if (row === undefined || row.quantity === null) throw new Error(`Capability ${input.capabilityId} is not counted`);
  const previous = Number(row.quantity);
  const next = input.operation === "consume" ? previous - input.amount : Math.min(input.maximumQuantity, previous + input.amount);
  if (!Number.isSafeInteger(next) || next < 0) throw new Error(`Capability ${input.capabilityId} quantity is insufficient`);
  const version = Number(row.version) + 1;
  await client.query("UPDATE runtime.capability_instances SET quantity=$1,version=$2,updated_at=transaction_timestamp() WHERE organization_id=$3 AND id=$4",
    [next, version, context.organizationId, row.id]);
  return insertTransaction(client, context, { targetKind: "capability", targetId: row.id, definitionId: input.capabilityId,
    scopeReference: input.scopeReference ?? "", operation: input.operation, previousValue: previous, newValue: next,
    sourceType: source.type, sourceReference: source.reference, sourceCommandId: source.commandId,
    actorPersonId: source.actorPersonId, rationale: source.rationale, version });
}

export async function applyResourceTransaction(
  client: PoolClient,
  context: WorldStateContext,
  input: { resourceId: string; scopeReference?: string; operation: "credit" | "debit"; amount: number },
  source: StateChangeSourceV1
): Promise<StateTransactionV1> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error(`Resource ${input.resourceId} amount must be positive`);
  const result = await client.query<{ id: string; balance: string; version: string }>(
    `SELECT id,balance,version FROM runtime.resource_balances
      WHERE organization_id=$1 AND session_id=$2 AND resource_id=$3 AND scope_reference=$4 FOR UPDATE`,
    [context.organizationId, context.sessionId, input.resourceId, input.scopeReference ?? ""]
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Resource ${input.resourceId} is unavailable`);
  const previous = Number(row.balance);
  const next = input.operation === "credit" ? previous + input.amount : previous - input.amount;
  if (!Number.isFinite(next) || next < 0) throw new Error(`Resource ${input.resourceId} balance is insufficient`);
  const version = Number(row.version) + 1;
  await client.query("UPDATE runtime.resource_balances SET balance=$1,version=$2,updated_at=transaction_timestamp() WHERE organization_id=$3 AND id=$4",
    [next, version, context.organizationId, row.id]);
  return insertTransaction(client, context, { targetKind: "resource", targetId: row.id, definitionId: input.resourceId,
    scopeReference: input.scopeReference ?? "", operation: input.operation, previousValue: previous, newValue: next,
    sourceType: source.type, sourceReference: source.reference, sourceCommandId: source.commandId,
    actorPersonId: source.actorPersonId, rationale: source.rationale, version });
}
