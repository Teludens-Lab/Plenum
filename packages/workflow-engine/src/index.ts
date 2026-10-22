import type {
  GateConditionV1,
  GateV1,
  RuntimeScalarV1,
  RuntimeStageDefinitionV1,
  StateEffectV1
} from "@plenum/simulation-schema";

export interface WorkflowTransitionLike {
  from: string | null;
  command: string;
  to: string;
  allowedSessionRoleIds: string[];
  label?: string;
  notifySessionRoleIds?: string[];
  notifyCreator?: boolean;
  contentOnly?: boolean;
  editableFieldKeys?: string[];
  gate?: GateV1;
  priority?: number;
}
type WorkflowLike = { transitions: WorkflowTransitionLike[] };
type FormLike = { sections?: Array<{ fields: Array<{ key: string; label: string; required?: boolean }> }>; fields?: Array<{ key: string; label: string; required?: boolean }> };

export type TransitionResult =
  | { allowed: true; transition: WorkflowTransitionLike }
  | { allowed: false; reason: "INVALID_TRANSITION" | "PERMISSION_DENIED" | "GATE_NOT_SATISFIED" };

export function resolveWorkflowTransition(
  workflow: WorkflowLike,
  state: string | null,
  operationType: string,
  activeSessionRoleId: string,
  facts: Readonly<Record<string, RuntimeScalarV1 | RuntimeScalarV1[] | undefined>> = {}
): TransitionResult {
  const operation = workflow.transitions.filter((transition) =>
    transition.from === state && transition.command === operationType);
  const permitted = operation.filter((candidate) => candidate.allowedSessionRoleIds.includes(activeSessionRoleId));
  const transition = permitted.filter((candidate) => candidate.gate === undefined || evaluateGate(candidate.gate, facts).passed)
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0];
  return transition === undefined
    ? { allowed: false, reason: operation.length === 0 ? "INVALID_TRANSITION" : permitted.length === 0 ? "PERMISSION_DENIED" : "GATE_NOT_SATISFIED" }
    : { allowed: true, transition };
}

export interface GateExplanationV1 {
  path: string;
  fact: string | null;
  operator: string;
  passed: boolean;
  reason: "matched" | "not_matched" | "fact_unavailable";
}

export interface GateEvaluationV1 {
  passed: boolean;
  explanations: GateExplanationV1[];
}

function compare(condition: GateConditionV1, left: RuntimeScalarV1 | RuntimeScalarV1[] | undefined,
  right: RuntimeScalarV1 | RuntimeScalarV1[] | undefined): boolean {
  if (condition.operator === "exists") return left !== undefined;
  if (left === undefined || right === undefined) return false;
  if (condition.operator === "equals" || condition.operator === "not_equals") {
    const equal = JSON.stringify(left) === JSON.stringify(right);
    return condition.operator === "equals" ? equal : !equal;
  }
  if (condition.operator === "contains") {
    const contains = typeof left === "string" ? typeof right === "string" && left.includes(right) :
      Array.isArray(left) && !Array.isArray(right) && left.includes(right);
    return contains;
  }
  if (condition.operator === "in" || condition.operator === "not_in") {
    const present = Array.isArray(right) && !Array.isArray(left) && right.includes(left);
    return condition.operator === "in" ? present : !present;
  }
  if (typeof left !== "number" || typeof right !== "number") return false;
  if (condition.operator === "greater_than") return left > right;
  if (condition.operator === "less_than") return left < right;
  if (condition.operator === "greater_or_equal") return left >= right;
  return left <= right;
}

/** Evaluates a validated Gate with no authored-code execution or access outside the supplied Fact map. */
export function evaluateGate(
  gate: GateV1,
  facts: Readonly<Record<string, RuntimeScalarV1 | RuntimeScalarV1[] | undefined>>
): GateEvaluationV1 {
  const explanations: GateExplanationV1[] = [];
  let visited = 0;
  const visit = (candidate: GateV1, path: string, depth: number): boolean => {
    if (++visited > 64 || depth > 8) throw new Error("Gate exceeds the bounded evaluator limits");
    const results = candidate.conditions.map((item, index) => {
      const itemPath = `${path}.${index}`;
      if ("conditions" in item) return visit(item, itemPath, depth + 1);
      visited += 1;
      if (visited > 64) throw new Error("Gate exceeds the bounded evaluator limits");
      const left = facts[item.fact];
      const right = item.compareTo === undefined ? item.value : facts[item.compareTo];
      const passed = compare(item, left, right);
      explanations.push({ path: itemPath, fact: item.fact, operator: item.operator, passed,
        reason: left === undefined ? "fact_unavailable" : passed ? "matched" : "not_matched" });
      return passed;
    });
    const passed = candidate.operator === "all" ? results.every(Boolean) :
      candidate.operator === "any" ? results.some(Boolean) : results.every((result) => !result);
    explanations.push({ path, fact: null, operator: candidate.operator, passed, reason: passed ? "matched" : "not_matched" });
    return passed;
  };
  return { passed: visit(gate, "gate", 1), explanations };
}

export interface RehearsalTraceV1 {
  triggerId: string;
  kind: "entry" | "completion" | "transition" | "effect";
  fired: boolean;
  explanations: GateExplanationV1[];
  stateChanges: Array<{ stateVariableId: string; scopeReference: string; previousValue: RuntimeScalarV1; newValue: RuntimeScalarV1; operation: StateEffectV1["operation"] }>;
}

export interface StageRehearsalV1 {
  seed: number;
  startedAt: string;
  finalStageId: string | null;
  finalStageIds: string[];
  facts: Record<string, RuntimeScalarV1 | RuntimeScalarV1[]>;
  trace: RehearsalTraceV1[];
}

export interface StageTransitionSelectionV1 {
  selected: RuntimeStageDefinitionV1["transitions"];
  evaluations: Array<{ transitionId: string; passed: boolean; explanations: GateExplanationV1[] }>;
}

/** Selects one prioritized conditional branch or every passing parallel branch. */
export function selectStageTransitions(
  stage: RuntimeStageDefinitionV1,
  facts: Readonly<Record<string, RuntimeScalarV1 | RuntimeScalarV1[] | undefined>>,
  requestedTargetStageId?: string
): StageTransitionSelectionV1 {
  const ordered = stage.transitions.map((transition, index) => ({ transition, index }))
    .sort((left, right) => (right.transition.priority ?? 0) - (left.transition.priority ?? 0) || left.index - right.index);
  const evaluations = ordered.map(({ transition }) => {
    const evaluation = transition.gate === undefined ? { passed: true, explanations: [] } : evaluateGate(transition.gate, facts);
    return { transitionId: transition.id, ...evaluation };
  });
  const passing = ordered.filter(({ transition }) => evaluations.find(({ transitionId }) => transitionId === transition.id)?.passed === true)
    .map(({ transition }) => transition);
  if (requestedTargetStageId !== undefined) {
    const requested = passing.find(({ targetStageId }) => targetStageId === requestedTargetStageId);
    return { selected: requested === undefined ? [] : [requested], evaluations };
  }
  return { selected: stage.transitionMode === "parallel" ? passing : passing.slice(0, 1), evaluations };
}

function applyRehearsalEffects(
  actions: RuntimeStageDefinitionV1["onEnter"] | RuntimeStageDefinitionV1["onExit"],
  facts: Record<string, RuntimeScalarV1 | RuntimeScalarV1[]>,
  trace: RehearsalTraceV1[],
  triggerId: string
): void {
  for (const [index, action] of (actions ?? []).entries()) {
    if (action.type !== "apply_effect") continue;
    const effect = action.parameters as unknown as StateEffectV1;
    const key = effect.scopeReference === undefined ? `state.${effect.stateVariableId}` :
      `state.${effect.stateVariableId}.team.${effect.scopeReference}`;
    const previous = facts[key];
    if (Array.isArray(previous) || previous === undefined) throw new Error(`Rehearsal Effect ${key} has no initial State Value`);
    const next = effect.operation === "set" ? effect.value : typeof previous === "number" && typeof effect.value === "number" ?
      effect.operation === "increment" ? previous + effect.value : effect.operation === "decrement" ? previous - effect.value : previous * effect.value :
      (() => { throw new Error(`Rehearsal Effect ${key} requires numeric State Values`); })();
    facts[key] = next;
    trace.push({ triggerId: `${triggerId}.effect.${index}`, kind: "effect", fired: true, explanations: [],
      stateChanges: [{ stateVariableId: effect.stateVariableId, scopeReference: effect.scopeReference ?? "", previousValue: previous,
        newValue: next, operation: effect.operation }] });
  }
}

/** Runs one bounded acyclic Stage graph with deterministic conditional and parallel fork/join semantics. */
export function rehearseStages(input: {
  stages: readonly RuntimeStageDefinitionV1[];
  facts: Readonly<Record<string, RuntimeScalarV1 | RuntimeScalarV1[]>>;
  startedAt: string;
  seed: number;
}): StageRehearsalV1 {
  if (!Number.isSafeInteger(input.seed) || input.seed < 0 || Number.isNaN(Date.parse(input.startedAt))) {
    throw new Error("Rehearsal requires a fixed UTC clock and non-negative integer seed");
  }
  const facts = structuredClone(input.facts) as Record<string, RuntimeScalarV1 | RuntimeScalarV1[]>;
  facts["time.wallClock"] = new Date(input.startedAt).toISOString();
  const trace: RehearsalTraceV1[] = [];
  const byId = new Map(input.stages.map((stage) => [stage.id, stage]));
  const incoming = new Map<string, number>();
  input.stages.forEach((stage) => stage.transitions.forEach(({ targetStageId }) =>
    incoming.set(targetStageId, (incoming.get(targetStageId) ?? 0) + 1)));
  const queue: Array<{ stageId: string; fromStageId?: string; parallelGroup?: string }> = input.stages[0] === undefined ? [] : [{ stageId: input.stages[0].id }];
  const arrivals = new Map<string, Set<string>>();
  const entered = new Set<string>();
  const cancelledParallelGroups = new Set<string>();
  const finalStageIds = new Set<string>();
  let steps = 0;
  while (queue.length > 0) {
    if (++steps > Math.max(64, input.stages.length * 4)) throw new Error("Rehearsal Stage graph is cyclic or exceeds the bounded execution limit");
    const token = queue.shift()!;
    if (token.parallelGroup !== undefined && cancelledParallelGroups.has(token.parallelGroup)) continue;
    const current = byId.get(token.stageId);
    if (current === undefined) throw new Error(`Rehearsal transition references missing Stage ${token.stageId}`);
    if (current.joinMode !== undefined) {
      const stageArrivals = arrivals.get(current.id) ?? new Set<string>();
      if (token.fromStageId !== undefined) stageArrivals.add(token.fromStageId);
      arrivals.set(current.id, stageArrivals);
      if (entered.has(current.id) || current.joinMode === "all" && stageArrivals.size < (incoming.get(current.id) ?? 0)) continue;
      if (current.joinMode === "first" && token.parallelGroup !== undefined) cancelledParallelGroups.add(token.parallelGroup);
    } else if (entered.has(current.id)) {
      throw new Error(`Rehearsal Stage ${current.id} is reached more than once without an explicit join`);
    }
    entered.add(current.id);
    const entry = current.entryGate === undefined ? { passed: true, explanations: [] } : evaluateGate(current.entryGate, facts);
    trace.push({ triggerId: `${current.id}.entry`, kind: "entry", fired: entry.passed, explanations: entry.explanations, stateChanges: [] });
    if (!entry.passed) continue;
    facts["session.stage.id"] = current.id;
    applyRehearsalEffects(current.onEnter, facts, trace, `${current.id}.entry`);
    const completion = current.completionGate === undefined ? { passed: true, explanations: [] } : evaluateGate(current.completionGate, facts);
    trace.push({ triggerId: `${current.id}.completion`, kind: "completion", fired: completion.passed, explanations: completion.explanations, stateChanges: [] });
    if (!completion.passed) continue;
    if (current.transitions.length === 0) {
      finalStageIds.add(current.id);
      continue;
    }
    const selection = selectStageTransitions(current, facts);
    for (const evaluation of selection.evaluations) {
      trace.push({ triggerId: evaluation.transitionId, kind: "transition",
        fired: selection.selected.some(({ id }) => id === evaluation.transitionId), explanations: evaluation.explanations, stateChanges: [] });
    }
    if (selection.selected.length === 0) continue;
    applyRehearsalEffects(current.onExit, facts, trace, `${current.id}.exit`);
    const parallelGroup = current.joinMode !== undefined ? undefined :
      current.transitionMode === "parallel" ? current.id : token.parallelGroup;
    selection.selected.forEach(({ targetStageId }) => queue.push({ stageId: targetStageId, fromStageId: current.id,
      ...(parallelGroup === undefined ? {} : { parallelGroup }) }));
  }
  const terminals = [...finalStageIds].sort();
  return { seed: input.seed, startedAt: new Date(input.startedAt).toISOString(),
    finalStageId: terminals.length === 1 ? terminals[0]! : null, finalStageIds: terminals, facts, trace };
}

export function requiredFieldsMissing(form: FormLike, payload: Record<string, unknown>): string[] {
  const fields = form.sections?.flatMap((section) => section.fields) ?? form.fields ?? [];
  return fields.filter((field) => {
    if (field.required !== true) return false;
    const value = payload[field.key];
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return value === undefined || value === null;
  }).map((field) => field.label);
}

export function nextStage(
  stages: readonly RuntimeStageDefinitionV1[],
  currentStageId: string,
  targetStageId: string
): RuntimeStageDefinitionV1 | undefined {
  const current = stages.find((stage) => stage.id === currentStageId);
  if (current === undefined || !current.transitions.some((transition) => transition.targetStageId === targetStageId)) return undefined;
  return stages.find((stage) => stage.id === targetStageId);
}

export function remainingSeconds(
  stage: RuntimeStageDefinitionV1,
  startedAt: Date | null,
  pausedAt: Date | null,
  accumulatedPauseSeconds: number,
  now: Date
): number | null {
  if (stage.timerMode !== "countdown" || stage.durationSeconds === undefined || startedAt === null) return null;
  const end = pausedAt ?? now;
  const elapsed = Math.max(0, Math.floor((end.getTime() - startedAt.getTime()) / 1000) - accumulatedPauseSeconds);
  return Math.max(0, stage.durationSeconds - elapsed);
}
