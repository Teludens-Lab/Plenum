import type { CoreDesignV1, MethodologyConceptV1, ScenarioV1 } from "./index.js";

/** OPEN-004. Labels and legacy dependsOn hints never confer execution authority. */
export const METHODOLOGY_CONTRACT_ID = "methodology-concepts-v1";
export const METHODOLOGY_CONCEPT_REGISTRY = [
  { key: "identity", label: "Identity and permissions", mandatory: true },
  { key: "information_policy", label: "Information Policy", mandatory: true },
  { key: "release", label: "Versioned Releases", mandatory: true },
  { key: "evidence", label: "Evidence and audit", mandatory: true },
  { key: "session_authority", label: "Session Authority", mandatory: true },
  { key: "stage", label: "Stage", mandatory: true },
  { key: "session_role", label: "Session Role", mandatory: true },
  { key: "seat", label: "Seat", mandatory: true },
  { key: "artifact_type", label: "Artifact Type", mandatory: false },
  { key: "form", label: "Form", mandatory: false },
  { key: "workflow_definition", label: "Workflow Definition", mandatory: false },
  { key: "team", label: "Team", mandatory: false },
  { key: "decision_record", label: "Decision Record", mandatory: false },
  { key: "inject", label: "Inject", mandatory: false },
  { key: "communication", label: "Communication", mandatory: false },
  { key: "voice", label: "Voice", mandatory: false },
  { key: "poll", label: "Poll", mandatory: false },
  { key: "resource", label: "Resource", mandatory: false },
  { key: "capability", label: "Capability", mandatory: false },
  { key: "state_variable", label: "State Variable", mandatory: false },
  { key: "adjudication", label: "Adjudication", mandatory: false },
  { key: "effect", label: "Effect", mandatory: false },
  { key: "research_question", label: "Research Question", mandatory: false }
] as const;
export type MethodologyConceptKey = typeof METHODOLOGY_CONCEPT_REGISTRY[number]["key"];
export const methodologyConceptsV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: METHODOLOGY_CONTRACT_ID,
  title: "Methodology Concepts v1", type: "object", required: ["methodologyContractId", "methodologyConcepts"],
  properties: {
    methodologyContractId: { const: METHODOLOGY_CONTRACT_ID },
    methodologyConcepts: { type: "array", maxItems: METHODOLOGY_CONCEPT_REGISTRY.length, items: {
      type: "object", additionalProperties: false, required: ["key", "label", "enabled", "dependsOn"],
      properties: { key: { enum: METHODOLOGY_CONCEPT_REGISTRY.map(({ key }) => key) }, label: { type: "string" },
        enabled: { type: "boolean" }, dependsOn: { type: "array", items: { type: "string" } } }
    } }
  }
} as const;
export interface ConceptIssue {
  code: string;
  message: string;
  path: string;
  elementId: string | null;
}
type Materialization = { coreDesign: CoreDesignV1; scenario: ScenarioV1 };
const collectionConcepts: Record<string, MethodologyConceptKey> = {
  teams: "team", teamCells: "team", forms: "form", workflows: "workflow_definition",
  artifactTypes: "artifact_type", decisionTraceability: "decision_record", injects: "inject",
  messageChannels: "communication", routes: "communication", voiceChannels: "voice", polls: "poll",
  resourceDefinitions: "resource", initialResources: "resource", capabilities: "capability",
  initialCapabilities: "capability", stateVariables: "state_variable", initialState: "state_variable",
  adjudicationModels: "adjudication", researchQuestions: "research_question"
};
const referenceConcepts: Record<string, MethodologyConceptKey> = {
  teamId: "team", teamIds: "team", allowedTeamIds: "team", ownerTeamId: "team", targetTeamId: "team",
  formId: "form", workflowId: "workflow_definition", approvalWorkflowId: "workflow_definition",
  onCertifiedWorkflowId: "workflow_definition", artifactTypeId: "artifact_type", artifactTypeIds: "artifact_type",
  sourceArtifactTypeIds: "artifact_type", appliesToArtifactTypeIds: "artifact_type",
  requiredResponseArtifactTypeId: "artifact_type", structuredArtifactTypeId: "artifact_type",
  stateVariableId: "state_variable", affectedStateVariableIds: "state_variable",
  resourceId: "resource", resourceDefinitionIds: "resource", capabilityId: "capability",
  injectId: "inject", followOnInjectIds: "inject", researchQuestionIds: "research_question",
  modelId: "adjudication", channelId: "communication"
};
const moduleConcepts: Record<string, MethodologyConceptKey> = {
  artifact_form: "artifact_type", artifact_presentation: "artifact_type", task_list: "workflow_definition",
  message_inbox: "communication", proposal_thread: "communication", inject_inbox: "inject",
  voice: "voice", voice_channel: "voice", poll: "poll", voting: "poll", adjudication: "adjudication"
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Missing keys preserve pre-contract behavior; enabling controls must not disable authored mechanics. */
export function methodologyControls(core: CoreDesignV1): MethodologyConceptV1[] {
  const authored = Array.isArray(core.methodologyConcepts) ? core.methodologyConcepts : [];
  return METHODOLOGY_CONCEPT_REGISTRY.map(({ key, label, mandatory }) => ({
    key, label, enabled: mandatory || authored.find((item) => item?.key === key)?.enabled !== false,
    dependsOn: []
  }));
}

/** Produces a separate executable snapshot. Never mutates Drafts or historical Releases. */
export function projectEnabledConcepts(materialization: Materialization): Materialization {
  const copy = structuredClone(materialization);
  if (copy.coreDesign.methodologyContractId !== METHODOLOGY_CONTRACT_ID) return copy;
  const authored = Array.isArray(copy.coreDesign.methodologyConcepts) ? copy.coreDesign.methodologyConcepts : [];
  const disabled = new Set(authored.filter((item) => item?.enabled === false).map(({ key }) => key));
  // Collection ownership is structural: a Workflow's initialState is not Scenario.initialState.
  for (const owner of [copy.coreDesign, copy.scenario, copy.coreDesign.communications]) {
    if (!isRecord(owner)) continue;
    for (const key of Object.keys(owner)) {
      if (Object.hasOwn(collectionConcepts, key) && disabled.has(collectionConcepts[key]!)) (owner as Record<string, unknown>)[key] = [];
    }
  }
  if (disabled.has("decision_record") && Array.isArray(copy.coreDesign.artifactTypes)) {
    copy.coreDesign.artifactTypes = copy.coreDesign.artifactTypes.filter((item) => !item.decisionBearing);
  }
  // A Form owned only by an inactive Artifact Type is inactive too. Shared Forms remain executable.
  const activeTypes = copy.coreDesign.artifactTypes ?? [];
  const removedTypes = (materialization.coreDesign.artifactTypes ?? []).filter(({ id }) => !activeTypes.some((item) => item.id === id));
  for (const [collection, reference] of [["forms", "formId"], ["workflows", "workflowId"]] as const) {
    const removed = new Set(removedTypes.map((item) => item[reference]).filter((id) => !activeTypes.some((item) => item[reference] === id)));
    if (collection === "forms" && copy.coreDesign.forms) copy.coreDesign.forms = copy.coreDesign.forms.filter(({ id }) => !removed.has(id));
    if (collection === "workflows" && copy.coreDesign.workflows) copy.coreDesign.workflows = copy.coreDesign.workflows.filter(({ id }) => !removed.has(id));
  }
  return copy;
}

/** References in enabled elements are checked, rather than authored collection counts or display labels. */
export function validateMethodologyConcepts(materialization: Materialization): ConceptIssue[] {
  const core = materialization.coreDesign;
  const issues: ConceptIssue[] = [];
  const registry = new Map<string, typeof METHODOLOGY_CONCEPT_REGISTRY[number]>(METHODOLOGY_CONCEPT_REGISTRY.map((entry) => [entry.key, entry]));
  const disabled = new Set<string>();
  const seen = new Set<string>();
  const add = (code: string, message: string, path: string, elementId: string | null = null) =>
    issues.push({ code, message, path: path.replace(/^coreDesign\./u, ""), elementId });
  if (core.methodologyContractId !== undefined && core.methodologyContractId !== METHODOLOGY_CONTRACT_ID) {
    add("methodology.contract_invalid", "The methodology contract version is unsupported.", "methodologyContractId");
  }
  if (core.methodologyConcepts !== undefined && !Array.isArray(core.methodologyConcepts)) {
    add("methodology.concept_invalid", "Methodology controls must be a list of supported concepts.", "methodologyConcepts");
    return issues;
  }
  for (const concept of core.methodologyConcepts ?? []) {
    if (!isRecord(concept)) {
      add("methodology.concept_invalid", "Choose a supported Methodology Concept.", "methodologyConcepts");
      continue;
    }
    const definition = registry.get(concept.key);
    const path = `methodologyConcepts.${concept.key}`;
    if (!definition || seen.has(concept.key) || typeof concept.enabled !== "boolean") {
      add("methodology.concept_invalid", "Choose a unique supported Methodology Concept with an enabled state.", path, concept.key);
    } else if (!concept.enabled) {
      if (definition.mandatory) add("methodology.foundation_required", `${definition.label} is a mandatory foundation and cannot be disabled.`, path, concept.key);
      else disabled.add(concept.key);
    }
    seen.add(concept.key);
  }
  const active = projectEnabledConcepts(materialization);
  const labels = new Map<string, string>();
  const collectLabels = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(collectLabels); return; }
    if (!isRecord(value)) return;
    const label = value.name ?? value.label ?? value.title;
    if (typeof value.id === "string" && typeof label === "string") labels.set(value.id, label);
    for (const [key, child] of Object.entries(value)) if (key !== "resources") collectLabels(child);
  };
  collectLabels(active);
  const depend = (concept: MethodologyConceptKey, path: string, elementId: string | null) => {
    const owner = elementId === null ? "This setting" : labels.get(elementId) ?? "This element";
    if (disabled.has(concept)) add("methodology.disabled_dependency",
      `${owner} requires ${registry.get(concept)!.label}. Enable that concept or remove this reference. Authored content is retained.`, path, elementId);
  };
  const removedDecisionIds = new Set((core.artifactTypes ?? []).filter((item) => item.decisionBearing && disabled.has("decision_record")).map(({ id }) => id));
  const visit = (value: unknown, path: string, elementId: string | null): void => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}.${isRecord(child) && typeof child.id === "string" ? child.id : index}`, elementId));
      return;
    }
    if (!isRecord(value)) return;
    const id = typeof value.id === "string" ? value.id : elementId;
    for (const [key, child] of Object.entries(value)) {
      if (["methodologyConcepts", "resources", "terminology", "presentation", "identity"].includes(key)) continue;
      const location = `${path}.${key}`;
      const populated = child !== undefined && child !== null && child !== "" && (!Array.isArray(child) || child.length > 0);
      if (populated && Object.hasOwn(referenceConcepts, key)) {
        depend(referenceConcepts[key]!, location, id);
        if (["artifactTypeId", "artifactTypeIds", "sourceArtifactTypeIds", "appliesToArtifactTypeIds", "requiredResponseArtifactTypeId", "structuredArtifactTypeId"].includes(key) &&
            (Array.isArray(child) ? child : [child]).some((target) => typeof target === "string" && removedDecisionIds.has(target))) depend("decision_record", location, id);
      }
      if ((key === "ownership" && child === "team") || (key === "relation" && child === "creator_team") ||
          (key === "ownerTeam" && child === true) || (key === "payloadTeamField" && populated)) depend("team", location, id);
      if (key === "moduleType" && typeof child === "string" && Object.hasOwn(moduleConcepts, child)) depend(moduleConcepts[child]!, location, id);
      if (["effects", "stateEffects", "degradationEffects"].includes(key) && populated) depend("effect", location, id);
      if (key === "type" && child === "apply_effect") depend("effect", location, id);
      if (key === "type" && child === "release_inject") depend("inject", location, id);
      if (key === "type" && child === "request_adjudication") depend("adjudication", location, id);
      if (key === "entityReference" && isRecord(child)) {
        const kinds: Record<string, MethodologyConceptKey> = { artifact: "artifact_type", team: "team", resource: "resource", capability: "capability", state_variable: "state_variable" };
        if (typeof child.kind === "string" && Object.hasOwn(kinds, child.kind)) depend(kinds[child.kind]!, location, id);
      }
      if ((key === "fact" || key === "compareTo" || key === "source") && typeof child === "string") {
        const factConcept: Record<string, MethodologyConceptKey> = { state: "state_variable", resource: "resource", capability: "capability", inject: "inject", teams: "team", artifacts: "artifact_type", polls: "poll", messages: "communication", voice: "voice" };
        const concept = factConcept[child.split(".")[0]!];
        if (concept) depend(concept, location, id);
      }
      visit(child, location, id);
    }
  };
  visit(active.coreDesign, "coreDesign", null);
  visit(active.scenario, "scenario", null);
  if (core.methodologyContractId === METHODOLOGY_CONTRACT_ID) {
    for (const [collection, label] of [["stages", "Stage"], ["sessionRoles", "Session Role"], ["seats", "Seat"]] as const) {
      if (!(core[collection]?.length)) add("methodology.minimum_structure", `Define at least one ${label}.`, collection);
    }
    for (const model of active.coreDesign.adjudicationModels ?? []) {
      depend("decision_record", `coreDesign.adjudicationModels.${model.id}`, model.id);
      if (!model.output) add("methodology.output_required", `Adjudication Model ${model.name} needs a resolution/output contract.`, `adjudicationModels.${model.id}.output`, model.id);
    }
    for (const measurement of active.coreDesign.measurementDefinitions ?? []) {
      if (measurement.researchQuestionIds.length === 0) add("methodology.research_question_required", `Measurement ${measurement.label} needs a Research Question.`, `measurementDefinitions.${measurement.id}.researchQuestionIds`, measurement.id);
    }
  }
  return issues;
}
