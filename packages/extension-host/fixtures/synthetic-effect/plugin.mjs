// Deterministic PS-230 fixture only; not a production model.
export function execute(input) {
  const nextValue = Math.min(100, input.pressure + (input.seed % 7));
  return {
    outputs: { syntheticScore: nextValue },
    effectProposals: [{
      effectId: input.effectId,
      targetAggregateId: input.targetAggregateId,
      targetStateVariableId: "synthetic_risk",
      scopeReference: "",
      operation: "set",
      value: nextValue,
      rationale: "Deterministic synthetic fixture result"
    }]
  };
}
