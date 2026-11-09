import type { RuntimeInjectDefinitionV1 } from "./index.js";

export const INJECT_COMPLETION_CONTRACT_ID = "inject-completion-v1";
export interface InjectCompletionRequirementsV1 {
  contractId: typeof INJECT_COMPLETION_CONTRACT_ID;
  acknowledgementRequired: boolean;
}

export const injectCompletionV1Schema = {
  $id: INJECT_COMPLETION_CONTRACT_ID, type: "object", additionalProperties: false,
  required: ["contractId", "acknowledgementRequired"],
  properties: { contractId: { const: INJECT_COMPLETION_CONTRACT_ID }, acknowledgementRequired: { type: "boolean" } }
} as const;

/** Historical definitions retain their acknowledgement step and terminal progress labels. */
export function injectCompletion(definition: Pick<RuntimeInjectDefinitionV1, "completionRequirements" | "requiredResponseArtifactTypeId">,
  counts: { total: number; acknowledged: number; responded: number }) {
  const acknowledgementRequired = definition.completionRequirements?.acknowledgementRequired ?? true;
  const responseRequired = definition.requiredResponseArtifactTypeId !== undefined;
  const allAcknowledged = counts.total > 0 && counts.acknowledged === counts.total;
  const allResponded = counts.total > 0 && counts.responded === counts.total;
  const complete = counts.total > 0 && (!acknowledgementRequired || allAcknowledged) && (!responseRequired || allResponded);
  const state: "closed" | "responded" | "acknowledged" | "released" = definition.completionRequirements && complete
    ? "closed" : responseRequired && allResponded ? "responded" : allAcknowledged ? "acknowledged" : "released";
  return { acknowledgementRequired, responseRequired, complete, state, allAcknowledged, allResponded };
}

export function assertInjectCompletion(definition: RuntimeInjectDefinitionV1): void {
  const rules = definition.completionRequirements;
  if (rules === undefined) return;
  if (rules === null || typeof rules !== "object" || Array.isArray(rules) ||
      rules.contractId !== INJECT_COMPLETION_CONTRACT_ID || typeof rules.acknowledgementRequired !== "boolean" ||
      Object.keys(rules).some((key) => !["contractId", "acknowledgementRequired"].includes(key))) {
    throw new Error(`Inject ${definition.id} has invalid inject-completion-v1 requirements`);
  }
}
