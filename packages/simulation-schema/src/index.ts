/** Canonical release types owned by Simulation Schema v1.3.1. */

export const SIMULATION_SCHEMA_VERSION = "1.3.1";
export const RELEASE_MANIFEST_CONTRACT_ID = "release-manifest-v1";
export const RELEASE_MANIFEST_SCHEMA_ID = RELEASE_MANIFEST_CONTRACT_ID;
export const PLUGIN_BINDING_CONTRACT_ID = "plugin-binding-v1";
export const COMPOSITION_DEFINITION_CONTRACT_ID = "composition-definition-v1";
export const GATE_EXPRESSION_CONTRACT_ID = "gate-expression-v1";

export type RuntimeScalarV1 = boolean | number | string;
export type GateOperatorV1 = "equals" | "not_equals" | "greater_than" | "less_than" | "greater_or_equal" |
  "less_or_equal" | "contains" | "exists" | "in" | "not_in";

export interface GateConditionV1 {
  fact: string;
  operator: GateOperatorV1;
  value?: RuntimeScalarV1 | RuntimeScalarV1[];
  compareTo?: string;
}

export interface GateV1 {
  contractId?: typeof GATE_EXPRESSION_CONTRACT_ID;
  operator: "all" | "any" | "none";
  conditions: Array<GateConditionV1 | GateV1>;
}

export interface AutomationActionV1 {
  type: "notify" | "release_inject" | "unlock_stage" | "apply_effect" | "request_adjudication" | "start_timer" | "custom";
  target?: string;
  parameters?: Record<string, unknown>;
}

export interface StateEffectV1 {
  stateVariableId: string;
  scopeReference?: string;
  operation: "set" | "increment" | "decrement" | "multiply";
  value: RuntimeScalarV1;
  delaySeconds?: number;
  rationale?: string;
}

export interface StateVariableDefinitionV1 {
  id: string;
  name: string;
  description?: string;
  scope: "global" | "team" | "relationship" | "location" | "sector" | "asset" | "session_role";
  type: "integer" | "decimal" | "boolean" | "text" | "enum";
  minimum?: number;
  maximum?: number;
  unit?: string;
  options?: Array<{ value: string; label: string }>;
  informationPolicyId: string;
  editableBySessionRoleIds?: string[];
  historyMode: "full" | "final_only";
  display?: "number" | "progress_bar" | "gauge" | "trend" | "status_label" | "hidden";
}

export interface CapabilityDefinitionV1 {
  id: string;
  name: string;
  ownerTeamId?: string;
  states: Array<"available" | "ready" | "committed" | "degraded" | "exhausted" | "recovering" | "unavailable">;
  initialState: string;
  mode?: "boolean" | "counted";
  initialQuantity?: number;
  maximumQuantity?: number;
  consumable?: boolean;
  renewal?: { everyStageType: string; amount: number };
  activationGate?: GateV1;
  degradationEffects?: StateEffectV1[];
  recoverySeconds?: number;
  costs?: Array<{ resourceId: string; amount: number }>;
  informationPolicyId: string;
}

export interface ResourceDefinitionV1 {
  id: string;
  name: string;
  unit: string;
  ownership: "team" | "global";
  replenishment?: { everyStageType?: string; amount: number };
  informationPolicyId: string;
}

export interface ReleaseManifestV1 {
  schemaVersion: string;
  releaseId: string;
  projectId: string;
  definitionRevisionId: string;
  releaseLabel: string;
  semanticVersion: string;
  methodologyVersion: string;
  compilerVersion: string;
  contentDigest: string;
  publishedBy: string;
  approvedBy: string[];
  publishedAt: string;
  releaseNotes: string;
  validationReportId: string;
}

export interface PluginBindingV1 {
  contractId?: typeof PLUGIN_BINDING_CONTRACT_ID;
  id: string;
  pluginId: string;
  pluginVersion: string;
  pluginDigest: string;
  installationId: string;
  categories: string[];
  connectivity: "offline_capable" | "lan_required" | "external_required";
  configuration: Record<string, unknown>;
  configurationDigest: string;
  inputMappings: Array<{
    target: string;
    source: string;
    maxClassification?: "public" | "internal" | "confidential" | "restricted";
  }>;
  timeoutSeconds: number;
  enabledInProfiles: Array<"cloud" | "institutional" | "air_gapped">;
  localReplacementBindingId?: string;
  requestedPermissions?: string[];
  inputSchema?: string;
  outputSchema?: string;
  inputPorts?: CompositionPortV1[];
  outputPorts?: CompositionPortV1[];
  dependencies?: Array<{ pluginId: string; version: string; digest: string }>;
}

export type CompositionDataTypeV1 = "boolean" | "integer" | "number" | "string" | "object" | "array" | "effect_proposal";

export interface CompositionPortV1 {
  id: string;
  label: string;
  dataType: CompositionDataTypeV1;
  unit: string;
  classification: "public" | "internal" | "confidential" | "restricted";
  required: boolean;
  carriesEffectProposals?: boolean;
}

export interface CompositionNodeV1 {
  id: string;
  name: string;
  kind: "model" | "transform" | "fan_out" | "join" | "approval_gate" | "output";
  bindingId?: string;
  transform?: "identity" | "sum" | "average";
  joinPolicy?: "all_required" | "allow_partial";
  approverSessionRoleIds?: string[];
  inputPorts: CompositionPortV1[];
  outputPorts: CompositionPortV1[];
}

export interface CompositionEdgeV1 {
  id: string;
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
}

export interface CompositionFixtureV1 {
  id: string;
  name: string;
  modelOutputs: Record<string, Record<string, unknown>>;
  failingNodeIds?: string[];
}

export interface ModelCompositionV1 {
  contractId: typeof COMPOSITION_DEFINITION_CONTRACT_ID;
  id: string;
  name: string;
  version: string;
  nodes: CompositionNodeV1[];
  edges: CompositionEdgeV1[];
  fixtures: CompositionFixtureV1[];
  graphDigest?: string;
  dependencyClosure?: Array<{ pluginId: string; version: string; digest: string }>;
}

export type RuntimeFieldTypeV1 = "short_text" | "long_text" | "number" | "single_select" | "multi_select" | "artifact_reference";

export type PlatformTargetProfileV1 = "cloud" | "institutional" | "air_gapped";
export type VoiceChannelModeV1 = "radio_ptt" | "open_room" | "private_call" | "broadcast";

export interface PlatformAdapterV1 {
  id: string;
  digest: string;
  kind?: "media_provider" | "voting_method";
  voiceCapabilities?: Array<{
    profile: PlatformTargetProfileV1;
    modes: VoiceChannelModeV1[];
    recording: boolean;
    transcription: boolean;
  }>;
}

export interface RuntimeFieldOptionSourceV1 {
  kind: "team_cells";
  teamId: string;
  cellKind: string;
}

export interface RuntimeArtifactReferenceV1 {
  sourceArtifactTypeIds: string[];
  requiredOutcome: "accepted_terms";
  relationship: "active_team_is_recipient";
  multiple: boolean;
  snapshotFields: string[];
}

export interface RuntimeFieldConditionV1 {
  field: string;
  operator: "equals" | "not_equals" | "includes" | "present";
  value?: string | number | boolean;
}

export interface RuntimeFieldValidationV1 {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export interface RuntimeFormFieldDefinitionV1 {
  id: string;
  key: string;
  label: string;
  type: RuntimeFieldTypeV1;
  required?: boolean;
  requiredWhen?: RuntimeFieldConditionV1;
  visibleWhen?: RuntimeFieldConditionV1;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  optionSource?: RuntimeFieldOptionSourceV1;
  reference?: RuntimeArtifactReferenceV1;
  readOnly?: boolean;
  validation?: RuntimeFieldValidationV1;
}

export interface RuntimeFormDefinitionV1 {
  id: string;
  name: string;
  formVersion: string;
  sections: Array<{
    id: string;
    title?: string;
    description?: string;
    fields: RuntimeFormFieldDefinitionV1[];
    repeatable?: boolean;
    itemLabel?: string;
    itemKeyField?: string;
    minItems?: number;
    maxItems?: number;
  }>;
  rules?: Array<{ kind: "distinct"; fields: string[]; message: string }>;
  presentation?: {
    mode: "modal_per_scope";
    scopeField: string;
    accessibleDialog: { labelledByFormName: boolean; focusOnOpen: string; restoreFocusOnClose: boolean; escapeCloses: boolean };
  };
}

export interface RuntimeWorkflowStateV1 {
  key: string;
  label: string;
  kind: "draft" | "task" | "review" | "approval" | "wait" | "terminal" | "cancelled";
  holderSessionRoleIds?: string[];
  holderRelation?: "creator";
  assignment?: {
    mode: "specific_participant" | "session_role" | "team_session_role" | "control_group" | "first_available" | "all_eligible";
    sessionRoleIds?: string[];
    teamSelector?: "creator_team" | "any" | { teamIds: string[] };
  };
  dueAfterSeconds?: number;
  quorum?: { rule: "any_one" | "majority" | "quorum" | "unanimous" | "lead_after_peers"; minimumApprovals?: number; leadSessionRoleId?: string };
  automation?: AutomationActionV1[];
}

export interface RuntimeWorkflowTransitionV1 {
  id: string;
  from: string | null;
  command: string;
  label?: string;
  to: string;
  allowedSessionRoleIds: string[];
  notifySessionRoleIds?: string[];
  notifyCreator?: boolean;
  contentOnly?: boolean;
  editableFieldKeys?: string[];
  precondition?: string;
  gate?: GateV1;
  priority?: number;
  actions?: AutomationActionV1[];
}

export interface RuntimeWorkflowDefinitionV1 {
  id: string;
  key: string;
  name: string;
  initialState: string;
  states: RuntimeWorkflowStateV1[];
  transitions: RuntimeWorkflowTransitionV1[];
  description?: string;
  artifactFamily?: "action" | "proposal" | "rfi" | "note" | "orientation";
  custodyChain?: string[];
}

export interface RuntimeProposalThreadProtocolV1 {
  sourceArtifactTypeIds: string[];
  recipientTeamField: string;
  isolation: "one_thread_per_recipient";
  custodySessionRoleIds: string[];
  participantSessionRoleIds: string[];
  appendOnly: true;
  approvalRequiredForEveryMessage: true;
  completionRule: "explicit_close_per_recipient";
  actions: Array<{
    command: string;
    label: string;
    actor: "recipient" | "source" | "custodian";
    messageType: "proposal_forwarded" | "recipient_response" | "negotiation_message" | "thread_closed";
    routeId?: string;
    approvalRouteId?: string;
    requiresText?: boolean;
  }>;
  acceptanceOutcome?: {
    status: "accepted_terms";
    actionableByRecipientTeam: true;
    eligibleActionArtifactTypeByRecipientTeam: Record<string, string>;
    immutableEvidenceSnapshot: string[];
  };
}

export type RuntimeDataClassificationV1 = "public" | "internal" | "confidential" | "restricted";

export interface RuntimeActorSelectorV1 {
  sessionRoleIds?: string[];
  teamIds?: string[];
  seatIds?: string[];
  relation?: "creator" | "creator_team" | "current_holder" | "recipients";
  includeControlRoles?: boolean;
  public?: boolean;
  // Relationship selectors are release-owned data, not platform role branches.
  ownerTeam?: boolean;
  payloadTeamField?: string;
}

export interface RuntimeInformationGrantV1 {
  audience: RuntimeActorSelectorV1;
  release?: {
    mode: "immediate" | "at_stage" | "after_seconds" | "on_gate" | "manual";
    stageId?: string;
    offsetSeconds?: number;
    gate?: Record<string, unknown>;
  };
  expiresAtStageId?: string;
  fieldsExcluded?: string[];
}

export interface RuntimeInjectDefinitionV1 {
  id: string;
  title: string;
  contentId: string;
  senderIdentity?: string;
  recipients: RuntimeActorSelectorV1;
  releaseMode: "manual" | "scheduled" | "stage_entry" | "stage_exit" | "gate";
  scheduledOffsetSeconds?: number;
  stageId?: string;
  releaseGate?: GateV1;
  requiredResponseArtifactTypeId?: string;
  responseDeadlineSeconds?: number;
  effects?: StateEffectV1[];
  followOnInjectIds?: string[];
  controlNotesContentId?: string;
}

export interface RuntimePollDefinitionV1 {
  id: string;
  scope: "session" | "team" | "stage";
  scopeReference?: string;
  question: string;
  options: Array<{ id: string; label: string }>;
  pollType: "single_choice" | "multiple_choice" | "yes_no_abstain" | "opinion";
  minSelections?: number;
  maxSelections?: number;
  tallyMethod: "builtin_count" | "voting_method_adapter";
  votingMethodAdapterBindingId?: string;
  tallyMethodVersion: string;
  electoratePolicyId: string;
  oneBallotPer: "seat_assignment";
  allowRevote: boolean;
  finalBallotRule?: "latest_accepted";
  secrecy: "open" | "secret_ballot" | "anonymous_survey";
  thresholdRule: {
    kind: "simple_majority" | "supermajority" | "unanimity" | "plurality" | "none";
    fraction?: number;
    denominator: "valid_votes" | "votes_cast" | "electorate";
    abstentionCountsTowardDenominator: boolean;
  };
  quorumRule: {
    basis: "electorate_at_open" | "custom_snapshot";
    minimum: number;
    abstentionCountsTowardParticipation: boolean;
  };
  weights: Array<{ seatId: string; weight: number }>;
  vetoRule: { holderSeatIds: string[] };
  tieRule: "no_decision" | "chair_decides" | "reissue";
  openTrigger: { mode: "manual" | "scheduled" | "stage_entry" | "gate"; stageId?: string; offsetSeconds?: number; gate?: Record<string, unknown> };
  closeTrigger: { mode: "manual" | "scheduled" | "stage_exit" | "gate"; stageId?: string; offsetSeconds?: number; gate?: Record<string, unknown> };
  deadlinePolicy: { graceSeconds: number };
  resultVisibilityPolicyId: string;
  certificationPolicy: { certifierSessionRoleIds?: string[]; certifierOrganizationRoles?: Array<"Admin" | "Operator"> };
  onCertifiedWorkflowId?: string;
  retentionPolicyId?: string;
}

export interface RuntimeVoiceChannelDefinitionV1 {
  id: string;
  name: string;
  mode: VoiceChannelModeV1;
  capacity: number;
  activeStageIds?: string[];
  language?: string;
  priorityPolicy?: Array<{ sessionRoleId: string; priority: number }>;
  canListen: RuntimeActorSelectorV1;
  canTransmit: RuntimeActorSelectorV1;
  canModerate: RuntimeActorSelectorV1;
  canInvite?: RuntimeActorSelectorV1;
  radio?: {
    floorLeaseMs: number;
    queuePolicy: "fifo" | "priority";
    preemption: "none" | "authorized_emergency";
    maxTransmissionMs: number;
    cooldownMs: number;
  };
  recordingPolicy: "off" | "on" | "with_consent";
  transcriptionPolicy: "off" | "with_consent";
  mediaProviderAdapterBindingId: string;
  retentionPolicyId?: string;
}

export interface RuntimeTeamCellDefinitionV1 {
  id: string;
  teamId: string;
  kind: string;
  name: string;
  enabled: boolean;
}

export interface RuntimeArtifactInstanceScopeV1 {
  kind: "team_cell";
  teamId: string;
  cellKind: string;
  field: string;
  editor: "modal_per_scope";
}

export interface RuntimeArtifactEvidenceLinkV1 {
  id: string;
  field: string;
  relationship: "implements_accepted_proposal";
  sourceArtifactTypeIds: string[];
  requiredOutcome: "accepted_terms";
  eligibleSourceRelation: "active_team_is_recipient";
  immutableSnapshot: string[];
  required: boolean;
}

export interface RuntimeArtifactTypeDefinitionV1 {
  id: string;
  key: string;
  name: string;
  formId: string;
  workflowId: string;
  informationPolicyId: string;
  allowedCreatorSessionRoleIds: string[];
  allowedTeamIds?: string[];
  availableStageIds?: string[];
  ownership: "individual" | "team" | "session";
  decisionBearing: boolean;
  versioning: "none" | "draft_versions" | "full_history";
  exportable: boolean;
  instanceScope?: RuntimeArtifactInstanceScopeV1;
  evidenceLinks?: RuntimeArtifactEvidenceLinkV1[];
}

export interface RuntimeArtifactCoverageRequirementV1 {
  id: string;
  kind: "artifact_coverage";
  artifactTypeId: string;
  scope: { kind: "team_cell"; teamId: string; cellKind: string; field: string };
  minimumPerScope: number;
  qualifyingMilestone: "submitted_to_control";
  stageGroupId?: string;
}

export interface RuntimeStageDefinitionV1 {
  id: string;
  name: string;
  stageType: string;
  stageGroupId?: string;
  order?: number;
  durationSeconds?: number;
  timerMode?: "countdown" | "countup" | "none";
  allowedActivityIds: string[];
  entryGate?: GateV1;
  completionGate?: GateV1;
  transitionMode?: "exclusive" | "parallel";
  parallelJoinStageId?: string;
  joinMode?: "all" | "first";
  transitions: Array<{ id: string; targetStageId: string; label?: string; mode: "automatic" | "manual" | "automatic_or_manual"; gate?: GateV1; priority?: number }>;
  onEnter?: AutomationActionV1[];
  onExit?: AutomationActionV1[];
  operatorControls: {
    allowStart: boolean; allowEnd: boolean; allowReopen: boolean; allowExtend: boolean;
    allowSkip: boolean; allowReturnToPrevious: boolean; requireReason: boolean;
  };
  completionRequirements?: RuntimeArtifactCoverageRequirementV1[];
}

export interface RuntimeInterfaceProfileV1 {
  id: string;
  name: string;
  selectors: { sessionRoleIds?: string[]; teamIds?: string[]; stageIds?: string[] };
  layout: {
    template: "single_column" | "main_sidebar" | "dashboard" | "workspace";
    regions: Array<{ id: string; modules: Array<{ id: string; moduleType: string; title?: string; configuration: Record<string, unknown> }> }>;
  };
  navigation: { items: Array<{ id: string; label: string; target: { moduleId?: string; regionId?: string }; order: number }>; defaultItemId?: string };
}

export interface RuntimeReportDefinitionV1 {
  id: string;
  name: string;
  audience: string;
  formats: string[];
  sections: unknown[];
  availableToSessionRoleIds?: string[];
  availableToOrganizationRoles?: Array<"Admin" | "Designer" | "Publisher" | "Operator" | "Reviewer" | "Research Analyst">;
}

export interface RuntimeAccessPolicyV1 {
  joinMethods: Array<"invitation" | "code_and_verified_email" | "sso" | "code_and_guest_pin" | "waiting_room" | "open_seat_selection" | "operator_assignment">;
  guests: { allowed: boolean; requiredFields: string[]; expiryHours: number; includeInResearchExports: boolean; operatorApproval: boolean };
  displays: Array<{ interfaceProfileId: string; classificationCeiling: string }>;
  reassignment: { allowedBy: "operator" | "operator_with_approval"; crossTeamAllowed: boolean; exposureAcknowledgementRequired: boolean };
  readiness: Array<{ key: string; label: string; sessionRoleIds?: string[]; blocking: boolean }>;
}

export interface MethodologyConceptV1 {
  key: string;
  label: string;
  enabled: boolean;
  dependsOn: string[];
}

export interface ResearchQuestionV1 {
  id: string;
  question: string;
}

export interface DecisionTraceV1 {
  id: string;
  artifactTypeId: string;
  researchQuestionIds: string[];
  ownerSessionRoleId: string;
  trigger: string;
  informationRequirements: string;
  availableActions: string;
  adjudicationMethod: string;
  affectedStateVariableIds: string[];
  measurementDefinitionIds: string[];
}

export interface RuntimeCoreDesignV1 {
  methodologyConcepts?: MethodologyConceptV1[];
  teams: Array<{ id: string; name: string; objectiveIds: string[]; enabled: boolean }>;
  teamCells?: RuntimeTeamCellDefinitionV1[];
  sessionRoles: Array<{
    id: string; name: string; description?: string; responsibilities?: string[]; capabilities: Array<{ capability: string }>;
    interfaceProfileIds: string[]; allowedTeamIds?: string[]; isControlRole: boolean; enabled: boolean;
  }>;
  seats: Array<{ id: string; name: string; sessionRoleIds: string[]; teamId?: string; minOccupancy: number; maxOccupancy: number | null; required: boolean; joinMode: string }>;
  stageGroups: Array<{ id: string; name: string; stageType: string; order: number; parentGroupId?: string }>;
  stages: RuntimeStageDefinitionV1[];
  artifactTypes: RuntimeArtifactTypeDefinitionV1[];
  forms: RuntimeFormDefinitionV1[];
  workflows: RuntimeWorkflowDefinitionV1[];
  informationPolicies: Array<{ id: string; name: string; classification?: RuntimeDataClassificationV1; grants: RuntimeInformationGrantV1[] }>;
  communications: {
    messageChannels: Array<{ id: string; name: string; type: string; supportsAttachments: boolean; supportsThreading: boolean; structuredArtifactTypeId?: string; informationPolicyId?: string; threadProtocol?: RuntimeProposalThreadProtocolV1 }>;
    routes: Array<{ id: string; channelId: string; sender: RuntimeActorSelectorV1; recipient: RuntimeActorSelectorV1; approvalWorkflowId?: string; informationPolicyId?: string; activeStageIds?: string[] }>;
    voiceChannels: RuntimeVoiceChannelDefinitionV1[];
  };
  polls?: RuntimePollDefinitionV1[];
  interfaces: RuntimeInterfaceProfileV1[];
  reports: RuntimeReportDefinitionV1[];
  stateVariables?: StateVariableDefinitionV1[];
  capabilities?: CapabilityDefinitionV1[];
  resourceDefinitions?: ResourceDefinitionV1[];
  pluginBindings: PluginBindingV1[];
  compositions?: ModelCompositionV1[];
  platformAdapters?: PlatformAdapterV1[];
  terminology?: { labels: Record<string, { singular: string; plural: string }>; customLabels: Record<string, string> };
  accessPolicy?: RuntimeAccessPolicyV1;
  identity?: { title: string; subtitle?: string; developer: string; developerLogoResourceId?: string };
  presentation?: Record<string, unknown>;
  resources?: Array<{ id: string; name: string; type: string; mediaType: string; usage: string[]; altText?: string; dataUri?: string; sourcePath?: string; contentDigest: string }>;
  researchQuestions?: ResearchQuestionV1[];
  decisionTraceability?: DecisionTraceV1[];
}

export interface CoreDesignV1 extends Partial<RuntimeCoreDesignV1> {
  pluginBindings: PluginBindingV1[];
  [key: string]: unknown;
}

export interface ScenarioV1 {
  id: string;
  name: string;
  description: string;
  deliveryModes: Array<"in_person" | "virtual" | "hybrid" | "asynchronous">;
  tags: string[];
  content?: Array<{ id: string; title: string; type: string; body?: string; informationPolicyId: string; version: string }>;
  injects?: RuntimeInjectDefinitionV1[];
  initialState?: Array<{ stateVariableId: string; scopeReference?: string; value: RuntimeScalarV1 }>;
  initialCapabilities?: Array<{ capabilityId: string; scopeReference?: string; state: string; quantity?: number }>;
  initialResources?: Array<{ resourceId: string; scopeReference?: string; balance: number }>;
  [key: string]: unknown;
}

export interface SimulationReleaseV1 {
  manifest: ReleaseManifestV1;
  coreDesign: CoreDesignV1;
  scenario: ScenarioV1;
}

export function copySimulationTemplate(
  coreDesign: CoreDesignV1,
  scenario: ScenarioV1,
  newProjectId: string,
  newScenarioId: string,
  includeScenario = false
): { projectId: string; coreDesign: CoreDesignV1; scenario: ScenarioV1 } {
  return {
    projectId: newProjectId,
    coreDesign: structuredClone(coreDesign),
    scenario: includeScenario
      ? { ...structuredClone(scenario), id: newScenarioId }
      : { id: newScenarioId, name: "Untitled Scenario", description: "", deliveryModes: [], tags: [] }
  };
}

type ManifestSchema = Readonly<{
  $schema: "https://json-schema.org/draft/2020-12/schema";
  $id: string;
  title: string;
  type: "object";
  additionalProperties: false;
  required: readonly (keyof ReleaseManifestV1 & string)[];
  properties: { readonly [K in keyof Required<ReleaseManifestV1>]: Readonly<Record<string, unknown>> };
}>;

const uuidProperty = { type: "string", format: "uuid" } as const;
const nonEmptyStringProperty = { type: "string", minLength: 1 } as const;

export const releaseManifestV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: RELEASE_MANIFEST_SCHEMA_ID,
  title: "Release Manifest v1.3.1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "releaseId",
    "projectId",
    "definitionRevisionId",
    "releaseLabel",
    "semanticVersion",
    "methodologyVersion",
    "compilerVersion",
    "contentDigest",
    "publishedBy",
    "approvedBy",
    "publishedAt",
    "releaseNotes",
    "validationReportId"
  ],
  properties: {
    schemaVersion: { const: SIMULATION_SCHEMA_VERSION },
    releaseId: uuidProperty,
    projectId: uuidProperty,
    definitionRevisionId: uuidProperty,
    releaseLabel: nonEmptyStringProperty,
    semanticVersion: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    methodologyVersion: nonEmptyStringProperty,
    compilerVersion: nonEmptyStringProperty,
    contentDigest: { type: "string", pattern: "^[0-9a-f]{64}$" },
    publishedBy: uuidProperty,
    approvedBy: { type: "array", items: uuidProperty },
    publishedAt: { type: "string", format: "date-time" },
    releaseNotes: { type: "string" },
    validationReportId: uuidProperty
  }
} as const satisfies ManifestSchema;

export const pluginBindingV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: PLUGIN_BINDING_CONTRACT_ID, title: "Plugin Binding v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "id", "pluginId", "pluginVersion", "pluginDigest", "installationId", "categories", "connectivity",
    "configuration", "configurationDigest", "inputMappings", "timeoutSeconds", "enabledInProfiles"],
  properties: {
    contractId: { const: PLUGIN_BINDING_CONTRACT_ID }, id: { type: "string", format: "uuid" }, pluginId: nonEmptyStringProperty,
    pluginVersion: nonEmptyStringProperty, pluginDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
    installationId: { type: "string", format: "uuid" }, categories: { type: "array", items: nonEmptyStringProperty },
    connectivity: { enum: ["offline_capable", "lan_required", "external_required"] }, configuration: { type: "object" },
    configurationDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, inputMappings: { type: "array", items: { type: "object" } },
    timeoutSeconds: { type: "integer", minimum: 1, maximum: 300 }, enabledInProfiles: { type: "array", uniqueItems: true,
      items: { enum: ["cloud", "institutional", "air_gapped"] } }, localReplacementBindingId: { type: "string", format: "uuid" },
    requestedPermissions: { type: "array", uniqueItems: true, items: nonEmptyStringProperty }, inputSchema: nonEmptyStringProperty,
    outputSchema: nonEmptyStringProperty, inputPorts: { type: "array", items: { type: "object" } },
    outputPorts: { type: "array", items: { type: "object" } }, dependencies: { type: "array", items: { type: "object" } }
  }
} as const;

export const compositionDefinitionV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: COMPOSITION_DEFINITION_CONTRACT_ID, title: "Model Composition Definition v1",
  type: "object", additionalProperties: false,
  required: ["contractId", "id", "name", "version", "nodes", "edges", "fixtures"],
  properties: {
    contractId: { const: COMPOSITION_DEFINITION_CONTRACT_ID }, id: { type: "string", format: "uuid" }, name: nonEmptyStringProperty,
    version: nonEmptyStringProperty, nodes: { type: "array", items: { type: "object" } },
    edges: { type: "array", items: { type: "object" } }, fixtures: { type: "array", items: { type: "object" } },
    graphDigest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" }, dependencyClosure: { type: "array", items: { type: "object" } }
  }
} as const;

export const gateExpressionV1Schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: GATE_EXPRESSION_CONTRACT_ID,
  title: "Gate Expression v1",
  type: "object",
  additionalProperties: false,
  required: ["contractId", "operator", "conditions"],
  properties: {
    contractId: { const: GATE_EXPRESSION_CONTRACT_ID },
    operator: { enum: ["all", "any", "none"] },
    conditions: { type: "array", minItems: 1, maxItems: 32, items: { oneOf: [{ $ref: "#/$defs/gate" }, { $ref: "#/$defs/condition" }] } }
  },
  $defs: {
    gate: {
      type: "object",
      additionalProperties: false,
      required: ["operator", "conditions"],
      properties: {
        contractId: { const: GATE_EXPRESSION_CONTRACT_ID },
        operator: { enum: ["all", "any", "none"] },
        conditions: { type: "array", minItems: 1, maxItems: 32, items: { oneOf: [{ $ref: "#/$defs/gate" }, { $ref: "#/$defs/condition" }] } }
      }
    },
    condition: {
      type: "object",
      additionalProperties: false,
      required: ["fact", "operator"],
      properties: {
        fact: { type: "string", minLength: 1 },
        operator: { enum: ["equals", "not_equals", "greater_than", "less_than", "greater_or_equal", "less_or_equal", "contains", "exists", "in", "not_in"] },
        value: {},
        compareTo: { type: "string", minLength: 1 }
      }
    }
  }
} as const;

export function hasPinnedPluginDigest(binding: PluginBindingV1): boolean {
  return binding.pluginVersion.length > 0 && /^sha256:[0-9a-f]{64}$/u.test(binding.pluginDigest);
}

export interface RuntimeFormValidationIssueV1 {
  field: string;
  message: string;
}

export function runtimeFormValue(payload: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (Array.isArray(value)) return value[Number(segment)];
    if (typeof value === "object" && value !== null) return (value as Record<string, unknown>)[segment];
    return undefined;
  }, payload);
}

export function setRuntimeFormValue(payload: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  let target: Record<string, unknown> | unknown[] = payload;
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (last) {
      if (Array.isArray(target)) target[Number(segment)] = value;
      else target[segment] = value;
      return;
    }
    const nextIsIndex = /^\d+$/u.test(segments[index + 1] ?? "");
    const current = Array.isArray(target) ? target[Number(segment)] : target[segment];
    const next = typeof current === "object" && current !== null ? current : nextIsIndex ? [] : {};
    if (Array.isArray(target)) target[Number(segment)] = next;
    else target[segment] = next;
    target = next as Record<string, unknown> | unknown[];
  });
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

export function runtimeFieldConditionMatches(condition: RuntimeFieldConditionV1 | undefined, payload: Record<string, unknown>): boolean {
  if (condition === undefined) return true;
  const actual = runtimeFormValue(payload, condition.field);
  if (condition.operator === "present") return hasValue(actual);
  if (condition.operator === "includes") return Array.isArray(actual) && actual.includes(condition.value);
  if (condition.operator === "not_equals") return actual !== condition.value;
  return actual === condition.value;
}

export function validateRuntimeFormPayload(
  form: RuntimeFormDefinitionV1,
  payload: Record<string, unknown>
): RuntimeFormValidationIssueV1[] {
  const issues: RuntimeFormValidationIssueV1[] = [];
  const validateFields = (
    fields: RuntimeFormFieldDefinitionV1[],
    values: Record<string, unknown>,
    prefix = ""
  ): void => {
    for (const field of fields) {
      if (!runtimeFieldConditionMatches(field.visibleWhen, values)) continue;
      const value = runtimeFormValue(values, field.key);
      const issueField = `${prefix}${field.key}`;
    const required = field.required === true || runtimeFieldConditionMatches(field.requiredWhen, values) && field.requiredWhen !== undefined;
    if (!hasValue(value)) {
      if (required) issues.push({ field: issueField, message: `${field.label} is required` });
      continue;
    }
    if ((field.type === "short_text" || field.type === "long_text") && typeof value !== "string") {
      issues.push({ field: issueField, message: `${field.label} must be text` });
      continue;
    }
    if (field.type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      issues.push({ field: issueField, message: `${field.label} must be a number` });
      continue;
    }
    if (field.type === "single_select" && typeof value !== "string") {
      issues.push({ field: issueField, message: `${field.label} must be one choice` });
      continue;
    }
    if ((field.type === "multi_select" || field.type === "artifact_reference") && !Array.isArray(value)) {
      issues.push({ field: issueField, message: `${field.label} must be a list of choices` });
      continue;
    }
    const allowed = new Set(field.options?.map((option) => option.value));
    if (allowed.size > 0) {
      const selected = Array.isArray(value) ? value : [value];
      if (selected.some((item) => typeof item !== "string" || !allowed.has(item))) {
        issues.push({ field: issueField, message: `${field.label} contains an invalid choice` });
      }
    }
    const validation = field.validation;
    if (validation === undefined) continue;
    if (typeof value === "string" && validation.minLength !== undefined && value.length < validation.minLength) issues.push({ field: issueField, message: `${field.label} is too short` });
    if (typeof value === "string" && validation.maxLength !== undefined && value.length > validation.maxLength) issues.push({ field: issueField, message: `${field.label} is too long` });
    if (typeof value === "number" && validation.min !== undefined && value < validation.min) issues.push({ field: issueField, message: `${field.label} is below the minimum` });
    if (typeof value === "number" && validation.max !== undefined && value > validation.max) issues.push({ field: issueField, message: `${field.label} is above the maximum` });
    if (typeof value === "number" && validation.integer === true && !Number.isInteger(value)) issues.push({ field: issueField, message: `${field.label} must be a whole number` });
    if (Array.isArray(value) && validation.minItems !== undefined && value.length < validation.minItems) issues.push({ field: issueField, message: `${field.label} needs more choices` });
    if (Array.isArray(value) && validation.maxItems !== undefined && value.length > validation.maxItems) issues.push({ field: issueField, message: `${field.label} has too many choices` });
    if (Array.isArray(value) && validation.uniqueItems === true && new Set(value).size !== value.length) issues.push({ field: issueField, message: `${field.label} must not repeat choices` });
    }
  };
  for (const section of form.sections) {
    if (section.repeatable !== true) {
      validateFields(section.fields, payload);
      continue;
    }
    const entries = payload[section.id];
    if (!Array.isArray(entries)) {
      if ((section.minItems ?? 0) > 0) issues.push({ field: section.id, message: `${section.title ?? section.id} needs at least ${section.minItems} item(s)` });
      continue;
    }
    if (section.minItems !== undefined && entries.length < section.minItems) issues.push({ field: section.id, message: `${section.title ?? section.id} needs at least ${section.minItems} item(s)` });
    if (section.maxItems !== undefined && entries.length > section.maxItems) issues.push({ field: section.id, message: `${section.title ?? section.id} has too many items` });
    entries.forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        issues.push({ field: `${section.id}.${index}`, message: `${section.itemLabel ?? "Item"} must be an object` });
        return;
      }
      validateFields(section.fields, entry as Record<string, unknown>, `${section.id}.${index}.`);
    });
    if (section.itemKeyField !== undefined) {
      const values = entries.map((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry)
        ? runtimeFormValue(entry as Record<string, unknown>, section.itemKeyField as string)
        : undefined).filter(hasValue);
      if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length) {
        issues.push({ field: section.id, message: `${section.itemLabel ?? "Item"} identifiers must be unique` });
      }
    }
  }
  for (const rule of form.rules ?? []) {
    const values = rule.fields.map((field) => runtimeFormValue(payload, field)).filter(hasValue);
    if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length) issues.push({ field: rule.fields[0] ?? "", message: rule.message });
  }
  return issues;
}

function uniqueIds(items: readonly { id: string }[], label: string): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.id.length === 0 || ids.has(item.id)) throw new Error(`${label} identifiers must be non-empty and unique`);
    ids.add(item.id);
  }
  return ids;
}

export type RuntimeFactTypeV1 = "boolean" | "number" | "text" | "unknown";

export function gateFactTypes(
  coreDesign: CoreDesignV1,
  scenario?: Pick<ScenarioV1, "injects">
): ReadonlyMap<string, RuntimeFactTypeV1> {
  const facts = new Map<string, RuntimeFactTypeV1>([
    ["session.status", "text"], ["session.stage.id", "text"], ["session.stage.elapsedSeconds", "number"],
    ["artifact.status", "text"], ["artifact.typeKey", "text"], ["actor.sessionRoleId", "text"],
    ["actor.teamId", "text"], ["time.simulation", "text"], ["time.wallClock", "text"]
  ]);
  for (const stage of coreDesign.stages ?? []) facts.set(`stage.${stage.id}.status`, "text");
  const workflows = new Map((coreDesign.workflows ?? []).map((workflow) => [workflow.id, workflow]));
  for (const artifact of coreDesign.artifactTypes ?? []) {
    facts.set(`teams.submittedCount.${artifact.key}`, "number");
    for (const state of workflows.get(artifact.workflowId)?.states ?? []) {
      facts.set(`artifacts.count.${artifact.key}.${state.key}`, "number");
    }
  }
  for (const form of coreDesign.forms ?? []) {
    for (const field of form.sections.flatMap((section) => section.fields)) facts.set(`artifact.field.${field.key}`, "unknown");
  }
  for (const variable of coreDesign.stateVariables ?? []) {
    const type = variable.type === "integer" || variable.type === "decimal" ? "number" :
      variable.type === "boolean" ? "boolean" : "text";
    facts.set(`state.${variable.id}`, type);
    if (variable.scope === "team") {
      for (const team of coreDesign.teams ?? []) facts.set(`state.${variable.id}.team.${team.id}`, type);
    }
  }
  for (const resource of coreDesign.resourceDefinitions ?? []) facts.set(`resource.${resource.id}.balance`, "number");
  for (const capability of coreDesign.capabilities ?? []) {
    facts.set(`capability.${capability.id}.status`, "text");
    if (capability.mode === "counted") facts.set(`capability.${capability.id}.quantity`, "number");
  }
  for (const inject of scenario?.injects ?? []) facts.set(`inject.${inject.id}.status`, "text");
  return facts;
}

function valueType(value: RuntimeScalarV1): Exclude<RuntimeFactTypeV1, "unknown"> {
  return typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "text";
}

/** Validates one bounded, declarative Gate without interpreting authored text as code. */
export function assertGateDefinition(
  gate: GateV1,
  facts: ReadonlyMap<string, RuntimeFactTypeV1>,
  label = "Gate"
): void {
  let nodes = 0;
  const visit = (candidate: GateV1, depth: number): void => {
    nodes += 1;
    if (depth > 8 || nodes > 64 || !["all", "any", "none"].includes(candidate.operator) ||
        candidate.conditions.length === 0 || candidate.conditions.length > 32 ||
        (candidate.contractId !== undefined && candidate.contractId !== GATE_EXPRESSION_CONTRACT_ID)) {
      throw new Error(`${label} exceeds the bounded Gate contract`);
    }
    for (const item of candidate.conditions) {
      if ("conditions" in item) {
        visit(item, depth + 1);
        continue;
      }
      nodes += 1;
      if (nodes > 64 || !facts.has(item.fact)) throw new Error(`${label} references unknown Fact ${item.fact}`);
      if (item.compareTo !== undefined && !facts.has(item.compareTo)) throw new Error(`${label} references unknown Fact ${item.compareTo}`);
      if (item.compareTo !== undefined && item.value !== undefined) throw new Error(`${label} condition must compare to a Fact or a value, not both`);
      if (item.operator === "exists") {
        if (item.value !== undefined || item.compareTo !== undefined) throw new Error(`${label} exists condition cannot declare a comparison value`);
        continue;
      }
      if (item.value === undefined && item.compareTo === undefined) throw new Error(`${label} condition needs a comparison value`);
      const factType = facts.get(item.fact)!;
      const comparisonType = item.compareTo === undefined ? undefined : facts.get(item.compareTo);
      if (comparisonType !== undefined && factType !== "unknown" && comparisonType !== "unknown" && factType !== comparisonType) {
        throw new Error(`${label} compares incompatible Fact types`);
      }
      if (["greater_than", "less_than", "greater_or_equal", "less_or_equal"].includes(item.operator) &&
          (factType !== "number" || (item.value !== undefined && (Array.isArray(item.value) || typeof item.value !== "number")))) {
        throw new Error(`${label} numeric comparison requires number Facts and values`);
      }
      if ((item.operator === "in" || item.operator === "not_in") && !Array.isArray(item.value)) {
        throw new Error(`${label} ${item.operator} comparison requires a value list`);
      }
      const values = Array.isArray(item.value) ? item.value : item.value === undefined ? [] : [item.value];
      if (factType !== "unknown" && values.some((value) => valueType(value) !== factType)) {
        throw new Error(`${label} comparison value does not match Fact type ${factType}`);
      }
      if (item.operator === "contains" && factType !== "text" && factType !== "unknown") {
        throw new Error(`${label} contains comparison requires a text Fact`);
      }
    }
  };
  visit(gate, 1);
}

const classificationRank = { public: 0, internal: 1, confidential: 2, restricted: 3 } as const;

export function assertModelComposition(
  composition: ModelCompositionV1,
  bindings: readonly PluginBindingV1[],
  sessionRoleIds: ReadonlySet<string> = new Set()
): void {
  if (composition.contractId !== COMPOSITION_DEFINITION_CONTRACT_ID || composition.name.trim().length === 0 ||
      composition.version.trim().length === 0) throw new Error(`Model Composition ${composition.id} is incomplete`);
  const nodes = new Map(composition.nodes.map((node) => [node.id, node]));
  if (nodes.size !== composition.nodes.length) throw new Error(`Model Composition ${composition.id} has duplicate node IDs`);
  const edges = new Map(composition.edges.map((edge) => [edge.id, edge]));
  if (edges.size !== composition.edges.length) throw new Error(`Model Composition ${composition.id} has duplicate edge IDs`);
  const bindingById = new Map(bindings.map((binding) => [binding.id, binding]));
  const incoming = new Map<string, CompositionEdgeV1[]>();
  const outgoing = new Map<string, CompositionEdgeV1[]>();
  for (const node of composition.nodes) {
    uniqueIds(node.inputPorts, `Model Composition ${composition.id} node ${node.id} input port`);
    uniqueIds(node.outputPorts, `Model Composition ${composition.id} node ${node.id} output port`);
    if (node.kind === "model" && (node.bindingId === undefined || !bindingById.has(node.bindingId))) {
      throw new Error(`Model Composition ${composition.id} node ${node.id} references a missing Plugin Binding`);
    }
    if (node.kind !== "model" && node.bindingId !== undefined) {
      throw new Error(`Model Composition ${composition.id} node ${node.id} can bind a Plugin only when its kind is model`);
    }
    if (node.kind === "approval_gate" && (node.approverSessionRoleIds?.length ?? 0) === 0) {
      throw new Error(`Model Composition ${composition.id} approval gate ${node.id} needs an approver Session Role`);
    }
    node.approverSessionRoleIds?.forEach((id) => {
      if (sessionRoleIds.size > 0 && !sessionRoleIds.has(id)) {
        throw new Error(`Model Composition ${composition.id} approval gate ${node.id} references missing Session Role ${id}`);
      }
    });
  }
  for (const edge of composition.edges) {
    const source = nodes.get(edge.fromNodeId);
    const target = nodes.get(edge.toNodeId);
    const sourcePort = source?.outputPorts.find(({ id }) => id === edge.fromPortId);
    const targetPort = target?.inputPorts.find(({ id }) => id === edge.toPortId);
    if (source === undefined || target === undefined || sourcePort === undefined || targetPort === undefined) {
      throw new Error(`Model Composition ${composition.id} edge ${edge.id} references a missing node or port`);
    }
    if (sourcePort.dataType !== targetPort.dataType) {
      throw new Error(`Model Composition ${composition.id} edge ${edge.id} has incompatible types ${sourcePort.dataType} and ${targetPort.dataType}`);
    }
    if (sourcePort.unit !== targetPort.unit) {
      throw new Error(`Model Composition ${composition.id} edge ${edge.id} has incompatible units ${sourcePort.unit || "unitless"} and ${targetPort.unit || "unitless"}`);
    }
    if (classificationRank[sourcePort.classification] > classificationRank[targetPort.classification]) {
      throw new Error(`Model Composition ${composition.id} edge ${edge.id} exceeds the ${targetPort.classification} classification ceiling`);
    }
    incoming.set(target.id, [...(incoming.get(target.id) ?? []), edge]);
    outgoing.set(source.id, [...(outgoing.get(source.id) ?? []), edge]);
  }
  for (const node of composition.nodes) {
    for (const port of node.inputPorts) {
      const count = (incoming.get(node.id) ?? []).filter(({ toPortId }) => toPortId === port.id).length;
      if (port.required && count === 0) throw new Error(`Model Composition ${composition.id} node ${node.id} is missing required input ${port.id}`);
      if (count > 1 && node.kind !== "join") throw new Error(`Model Composition ${composition.id} node ${node.id} has illegal fan-in at ${port.id}`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string, path: string[]): void => {
    if (visiting.has(nodeId)) throw new Error(`Model Composition ${composition.id} has a cycle: ${[...path, nodeId].join(" -> ")}`);
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) visit(edge.toNodeId, [...path, nodeId]);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  composition.nodes.forEach(({ id }) => visit(id, []));
  const effectSources = composition.nodes.filter((node) => node.outputPorts.some((port) =>
    port.dataType === "effect_proposal" || port.carriesEffectProposals === true));
  const checkApprovalPath = (nodeId: string, approved: boolean, path: string[]): void => {
    const node = nodes.get(nodeId)!;
    const nextApproved = approved || node.kind === "approval_gate";
    const next = outgoing.get(nodeId) ?? [];
    if ((node.kind === "output" || next.length === 0) && !nextApproved) {
      throw new Error(`Model Composition ${composition.id} Effect Proposal path ${[...path, nodeId].join(" -> ")} has no approval gate`);
    }
    next.forEach((edge) => checkApprovalPath(edge.toNodeId, nextApproved, [...path, nodeId]));
  };
  effectSources.forEach(({ id }) => {
    const next = outgoing.get(id) ?? [];
    if (next.length === 0) throw new Error(`Model Composition ${composition.id} Effect Proposal path ${id} has no approval gate`);
    next.forEach((edge) => checkApprovalPath(edge.toNodeId, nodes.get(id)?.kind === "approval_gate", [id]));
  });
  if (composition.graphDigest !== undefined && !/^sha256:[0-9a-f]{64}$/u.test(composition.graphDigest)) {
    throw new Error(`Model Composition ${composition.id} graph digest is invalid`);
  }
}

/** Validates the executable Runtime subset of the canonical Core Design. */
export function assertRuntimeCoreDesign(value: CoreDesignV1): asserts value is CoreDesignV1 & RuntimeCoreDesignV1 {
  const required = ["teams", "sessionRoles", "seats", "stageGroups", "stages", "artifactTypes", "forms",
    "workflows", "informationPolicies", "interfaces", "reports"] as const;
  if (required.some((key) => !Array.isArray(value[key])) || typeof value.communications !== "object" || value.communications === null) {
    throw new Error("Core Design is missing required Runtime definitions");
  }
  const runtime = value as CoreDesignV1 & RuntimeCoreDesignV1;
  if (!Array.isArray(runtime.communications.messageChannels) || !Array.isArray(runtime.communications.routes)) {
    throw new Error("Core Design communications are incomplete");
  }
  const roles = uniqueIds(runtime.sessionRoles, "Session Role");
  const teams = uniqueIds(runtime.teams, "Team");
  const stages = uniqueIds(runtime.stages, "Stage");
  const forms = uniqueIds(runtime.forms, "Form");
  const workflows = uniqueIds(runtime.workflows, "Workflow");
  const policies = uniqueIds(runtime.informationPolicies, "Information Policy");
  const interfaces = uniqueIds(runtime.interfaces, "Interface Profile");
  const artifactTypes = uniqueIds(runtime.artifactTypes, "Artifact Type");
  uniqueIds(runtime.teamCells ?? [], "Team Cell");
  const resources = uniqueIds(runtime.resources ?? [], "Resource");
  const seats = uniqueIds(runtime.seats, "Seat");
  const stageGroups = uniqueIds(runtime.stageGroups, "Stage Group");
  const stateVariables = uniqueIds(runtime.stateVariables ?? [], "State Variable");
  const capabilities = uniqueIds(runtime.capabilities ?? [], "Capability Definition");
  const worldResources = uniqueIds(runtime.resourceDefinitions ?? [], "Resource Definition");
  uniqueIds(runtime.polls ?? [], "Poll Definition");
  uniqueIds(runtime.communications.voiceChannels ?? [], "Voice Channel Definition");
  uniqueIds(runtime.compositions ?? [], "Model Composition");
  uniqueIds(runtime.reports, "Report");

  const reference = (ids: Set<string>, id: string, label: string): void => {
    if (!ids.has(id)) throw new Error(`${label} references missing identifier ${id}`);
  };
  const facts = gateFactTypes(runtime);
  const stateEffect = (effect: StateEffectV1, label: string): void => {
    reference(stateVariables, effect.stateVariableId, label);
    if (!["set", "increment", "decrement", "multiply"].includes(effect.operation) ||
        effect.delaySeconds !== undefined && (!Number.isSafeInteger(effect.delaySeconds) || effect.delaySeconds < 0 || effect.delaySeconds > 604_800) ||
        effect.rationale !== undefined && effect.rationale.trim().length === 0) throw new Error(`${label} is invalid`);
    const variable = runtime.stateVariables?.find(({ id }) => id === effect.stateVariableId);
    const expected = variable?.type === "integer" || variable?.type === "decimal" ? "number" :
      variable?.type === "boolean" ? "boolean" : "string";
    if (typeof effect.value !== expected || (variable?.type === "integer" && !Number.isSafeInteger(effect.value)) ||
        effect.operation !== "set" && typeof effect.value !== "number") throw new Error(`${label} has an incompatible value`);
  };
  const automation = (action: AutomationActionV1, label: string): void => {
    if (action.type === "apply_effect") {
      if (typeof action.parameters !== "object" || action.parameters === null || Array.isArray(action.parameters)) {
        throw new Error(`${label} has no State Effect`);
      }
      stateEffect(action.parameters as unknown as StateEffectV1, label);
    } else {
      throw new Error(`${label} uses ${action.type} without approved Runtime semantics`);
    }
  };
  const selector = (value: RuntimeActorSelectorV1, label: string): void => {
    const populated = value.public === true || value.includeControlRoles === true || value.ownerTeam === true ||
      value.relation !== undefined || value.payloadTeamField !== undefined ||
      (value.sessionRoleIds?.length ?? 0) > 0 || (value.teamIds?.length ?? 0) > 0 || (value.seatIds?.length ?? 0) > 0;
    if (!populated) throw new Error(`${label} has an empty default-deny selector`);
    value.sessionRoleIds?.forEach((id) => reference(roles, id, label));
    value.teamIds?.forEach((id) => reference(teams, id, label));
    value.seatIds?.forEach((id) => reference(seats, id, label));
  };

  for (const report of runtime.reports) {
    report.availableToSessionRoleIds?.forEach((id) => reference(roles, id, `Report ${report.id}`));
    const organizationRoles = new Set(["Admin", "Designer", "Publisher", "Operator", "Reviewer", "Research Analyst"]);
    if (report.availableToOrganizationRoles?.some((role) => !organizationRoles.has(role))) {
      throw new Error(`Report ${report.id} references an invalid Organization Role`);
    }
  }
  if (runtime.accessPolicy !== undefined) {
    uniqueIds(runtime.accessPolicy.readiness.map(({ key }) => ({ id: key })), "Readiness check");
    for (const check of runtime.accessPolicy.readiness) {
      if (check.label.trim().length === 0 || typeof check.blocking !== "boolean") throw new Error(`Readiness check ${check.key} is incomplete`);
      check.sessionRoleIds?.forEach((id) => reference(roles, id, `Readiness check ${check.key}`));
    }
  }
  if (runtime.terminology !== undefined && Object.values(runtime.terminology.customLabels).some((label) => label.trim().length === 0)) {
    throw new Error("Terminology custom labels must be non-empty");
  }

  const bindingIds = uniqueIds(runtime.pluginBindings, "Plugin Binding");
  for (const binding of runtime.pluginBindings) {
    if (binding.contractId !== undefined && binding.contractId !== PLUGIN_BINDING_CONTRACT_ID) {
      throw new Error(`Plugin Binding ${binding.id} has an unsupported contract identifier`);
    }
    if (!hasPinnedPluginDigest(binding)) throw new Error(`Plugin Binding ${binding.id} is not pinned by digest`);
    if (binding.localReplacementBindingId !== undefined) reference(bindingIds, binding.localReplacementBindingId, `Plugin Binding ${binding.id}`);
    if (binding.connectivity === "external_required" && binding.enabledInProfiles.includes("air_gapped")) {
      const replacement = runtime.pluginBindings.find(({ id }) => id === binding.localReplacementBindingId);
      if (replacement === undefined || replacement.connectivity !== "offline_capable" || !replacement.enabledInProfiles.includes("air_gapped")) {
        throw new Error(`Plugin Binding ${binding.id} needs a verified local replacement for the air_gapped profile`);
      }
    }
  }
  for (const composition of runtime.compositions ?? []) assertModelComposition(composition, runtime.pluginBindings, roles);

  for (const role of runtime.sessionRoles) {
    role.interfaceProfileIds.forEach((id) => reference(interfaces, id, `Session Role ${role.id}`));
    role.allowedTeamIds?.forEach((id) => reference(teams, id, `Session Role ${role.id}`));
  }
  for (const cell of runtime.teamCells ?? []) {
    reference(teams, cell.teamId, `Team Cell ${cell.id}`);
    if (cell.kind.length === 0 || cell.name.length === 0) throw new Error(`Team Cell ${cell.id} is incomplete`);
  }
  for (const variable of runtime.stateVariables ?? []) {
    reference(policies, variable.informationPolicyId, `State Variable ${variable.id}`);
    variable.editableBySessionRoleIds?.forEach((id) => reference(roles, id, `State Variable ${variable.id}`));
    if (variable.name.trim().length === 0 || variable.minimum !== undefined && variable.maximum !== undefined && variable.minimum > variable.maximum) {
      throw new Error(`State Variable ${variable.id} has an invalid definition`);
    }
    if (variable.type === "enum" && (variable.options?.length ?? 0) === 0) throw new Error(`State Variable ${variable.id} needs enum options`);
  }
  for (const resource of runtime.resourceDefinitions ?? []) {
    reference(policies, resource.informationPolicyId, `Resource Definition ${resource.id}`);
    if (resource.name.trim().length === 0 || resource.unit.trim().length === 0 ||
        resource.replenishment !== undefined && (!Number.isFinite(resource.replenishment.amount) || resource.replenishment.amount < 0)) {
      throw new Error(`Resource Definition ${resource.id} has an invalid definition`);
    }
  }
  for (const capability of runtime.capabilities ?? []) {
    reference(policies, capability.informationPolicyId, `Capability Definition ${capability.id}`);
    if (capability.ownerTeamId !== undefined) reference(teams, capability.ownerTeamId, `Capability Definition ${capability.id}`);
    if (capability.name.trim().length === 0 || capability.states.length === 0 || !capability.states.some((state) => state === capability.initialState)) {
      throw new Error(`Capability Definition ${capability.id} has an invalid initial state`);
    }
    const mode = capability.mode ?? "boolean";
    if (mode === "boolean" && (capability.initialQuantity !== undefined || capability.maximumQuantity !== undefined ||
        capability.consumable === true || capability.renewal !== undefined)) {
      throw new Error(`Capability Definition ${capability.id} has quantity rules in boolean mode`);
    }
    if (mode === "counted" && (!Number.isSafeInteger(capability.initialQuantity) || !Number.isSafeInteger(capability.maximumQuantity) ||
        Number(capability.initialQuantity) < 0 || Number(capability.maximumQuantity) < Number(capability.initialQuantity))) {
      throw new Error(`Capability Definition ${capability.id} has invalid counted capacity`);
    }
    if (capability.renewal !== undefined && (mode !== "counted" || capability.renewal.everyStageType.trim().length === 0 ||
        !Number.isSafeInteger(capability.renewal.amount) || capability.renewal.amount <= 0)) {
      throw new Error(`Capability Definition ${capability.id} has invalid renewal rules`);
    }
    if (capability.activationGate !== undefined) assertGateDefinition(capability.activationGate, facts, `Capability Definition ${capability.id} activation Gate`);
    capability.degradationEffects?.forEach((effect) => stateEffect(effect, `Capability Definition ${capability.id} degradation Effect`));
    capability.costs?.forEach(({ resourceId, amount }) => {
      reference(worldResources, resourceId, `Capability Definition ${capability.id} cost`);
      if (!Number.isFinite(amount) || amount < 0) throw new Error(`Capability Definition ${capability.id} has an invalid cost`);
    });
  }
  if (runtime.identity?.developerLogoResourceId !== undefined) {
    reference(resources, runtime.identity.developerLogoResourceId, "Release identity developer logo");
  }
  for (const seat of runtime.seats) {
    seat.sessionRoleIds.forEach((id) => reference(roles, id, `Seat ${seat.id}`));
    if (seat.teamId !== undefined) reference(teams, seat.teamId, `Seat ${seat.id}`);
    if (seat.minOccupancy < 0 || (seat.maxOccupancy !== null && seat.maxOccupancy < seat.minOccupancy)) {
      throw new Error(`Seat ${seat.id} has invalid occupancy bounds`);
    }
  }
  for (const poll of runtime.polls ?? []) {
    const optionIds = uniqueIds(poll.options, `Poll ${poll.id} option`);
    if (poll.question.trim().length === 0 || optionIds.size < 2 || poll.oneBallotPer !== "seat_assignment") {
      throw new Error(`Poll ${poll.id} has an incomplete definition`);
    }
    reference(policies, poll.electoratePolicyId, `Poll ${poll.id} Electorate`);
    reference(policies, poll.resultVisibilityPolicyId, `Poll ${poll.id} result visibility`);
    if ((poll.scope === "team" || poll.scope === "stage") && poll.scopeReference === undefined) {
      throw new Error(`Poll ${poll.id} has no scope reference`);
    }
    if (poll.scope === "team") reference(teams, poll.scopeReference!, `Poll ${poll.id}`);
    if (poll.scope === "stage") reference(stages, poll.scopeReference!, `Poll ${poll.id}`);
    if (poll.pollType === "multiple_choice" && (!Number.isSafeInteger(poll.minSelections) || !Number.isSafeInteger(poll.maxSelections) ||
        Number(poll.minSelections) < 1 || Number(poll.maxSelections) < Number(poll.minSelections) || Number(poll.maxSelections) > optionIds.size)) {
      throw new Error(`Poll ${poll.id} has invalid selection bounds`);
    }
    if (poll.pollType === "yes_no_abstain" && !["yes", "no", "abstain"].every((id) => optionIds.has(id))) {
      throw new Error(`Poll ${poll.id} must define yes, no and abstain options`);
    }
    if (poll.allowRevote !== (poll.finalBallotRule === "latest_accepted")) {
      throw new Error(`Poll ${poll.id} has an incomplete revote rule`);
    }
    if (poll.tallyMethod === "voting_method_adapter" && poll.votingMethodAdapterBindingId === undefined) {
      throw new Error(`Poll ${poll.id} has no Voting Method Adapter binding`);
    }
    if (poll.tallyMethodVersion.trim().length === 0 || poll.quorumRule === undefined || poll.weights === undefined || poll.vetoRule === undefined ||
        !Number.isFinite(poll.quorumRule.minimum) || poll.quorumRule.minimum < 0 || !Number.isInteger(poll.deadlinePolicy.graceSeconds) || poll.deadlinePolicy.graceSeconds < 0) {
      throw new Error(`Poll ${poll.id} must explicitly define quorum, weights, vetoes and deadline grace`);
    }
    if (poll.thresholdRule.kind === "supermajority" &&
        (poll.thresholdRule.fraction === undefined || poll.thresholdRule.fraction <= 0.5 || poll.thresholdRule.fraction > 1)) {
      throw new Error(`Poll ${poll.id} has an invalid supermajority fraction`);
    }
    const weightedSeats = new Set<string>();
    for (const weight of poll.weights) {
      reference(seats, weight.seatId, `Poll ${poll.id} weight`);
      if (!Number.isFinite(weight.weight) || weight.weight <= 0 || weightedSeats.has(weight.seatId)) {
        throw new Error(`Poll ${poll.id} has invalid Seat weights`);
      }
      weightedSeats.add(weight.seatId);
    }
    poll.vetoRule.holderSeatIds.forEach((id) => reference(seats, id, `Poll ${poll.id} veto`));
    poll.certificationPolicy.certifierSessionRoleIds?.forEach((id) => reference(roles, id, `Poll ${poll.id} certification`));
  }
  for (const channel of runtime.communications.voiceChannels ?? []) {
    if (!Number.isSafeInteger(channel.capacity) || channel.capacity < 2 || channel.name.trim().length === 0) {
      throw new Error(`Voice Channel ${channel.id} has invalid identity or capacity`);
    }
    selector(channel.canListen, `Voice Channel ${channel.id} listen policy`);
    selector(channel.canTransmit, `Voice Channel ${channel.id} transmit policy`);
    selector(channel.canModerate, `Voice Channel ${channel.id} moderation policy`);
    channel.canInvite === undefined || selector(channel.canInvite, `Voice Channel ${channel.id} invitation policy`);
    channel.activeStageIds?.forEach((id) => reference(stages, id, `Voice Channel ${channel.id}`));
    channel.priorityPolicy?.forEach(({ sessionRoleId, priority }) => {
      reference(roles, sessionRoleId, `Voice Channel ${channel.id} priority policy`);
      if (!Number.isSafeInteger(priority)) throw new Error(`Voice Channel ${channel.id} has an invalid priority`);
    });
    const adapter = runtime.platformAdapters?.find(({ id }) => id === channel.mediaProviderAdapterBindingId);
    if (channel.mediaProviderAdapterBindingId.trim().length === 0 || adapter === undefined ||
        (adapter.kind !== undefined && adapter.kind !== "media_provider")) {
      throw new Error(`Voice Channel ${channel.id} has no pinned Media Provider Adapter binding`);
    }
    const incompatible = adapter.voiceCapabilities?.find(({ modes, recording, transcription }) =>
      !modes.includes(channel.mode) || (channel.recordingPolicy !== "off" && !recording) ||
      (channel.transcriptionPolicy !== "off" && !transcription));
    if (incompatible !== undefined) {
      throw new Error(`Voice Channel ${channel.id} is unsupported by Media Provider Adapter ${adapter.id} for ${incompatible.profile}`);
    }
    if (channel.mode === "radio_ptt") {
      const radio = channel.radio;
      if (radio === undefined || !Number.isSafeInteger(radio.floorLeaseMs) || radio.floorLeaseMs < 250 ||
          !Number.isSafeInteger(radio.maxTransmissionMs) || radio.maxTransmissionMs < radio.floorLeaseMs ||
          !Number.isSafeInteger(radio.cooldownMs) || radio.cooldownMs < 0) {
        throw new Error(`Voice Channel ${channel.id} has invalid radio lease bounds`);
      }
    } else if (channel.radio !== undefined) {
      throw new Error(`Voice Channel ${channel.id} has radio policy outside radio_ptt mode`);
    }
    if (channel.mode === "private_call" && channel.canInvite === undefined) {
      throw new Error(`Voice Channel ${channel.id} has no invitation policy`);
    }
  }
  for (const group of runtime.stageGroups) {
    if (group.parentGroupId !== undefined) reference(stageGroups, group.parentGroupId, `Stage Group ${group.id}`);
    const parents = new Set([group.id]);
    let parentId = group.parentGroupId;
    while (parentId !== undefined) {
      if (parents.has(parentId)) throw new Error(`Stage Group ${group.id} has a nesting cycle`);
      parents.add(parentId);
      parentId = runtime.stageGroups.find(({ id }) => id === parentId)?.parentGroupId;
    }
  }
  const incomingStages = new Map<string, string[]>();
  runtime.stages.forEach((source) => source.transitions.forEach(({ targetStageId }) => {
    incomingStages.set(targetStageId, [...(incomingStages.get(targetStageId) ?? []), source.id]);
  }));
  for (const stage of runtime.stages) {
    if (stage.stageGroupId !== undefined) reference(stageGroups, stage.stageGroupId, `Stage ${stage.id}`);
    stage.transitions.forEach((transition) => reference(stages, transition.targetStageId, `Stage ${stage.id}`));
    if (stage.entryGate !== undefined) assertGateDefinition(stage.entryGate, facts, `Stage ${stage.id} entry Gate`);
    if (stage.completionGate !== undefined) assertGateDefinition(stage.completionGate, facts, `Stage ${stage.id} completion Gate`);
    stage.transitions.forEach((transition) => transition.gate === undefined ||
      assertGateDefinition(transition.gate, facts, `Stage ${stage.id} transition ${transition.id} Gate`));
    stage.onEnter?.forEach((action) => automation(action, `Stage ${stage.id} on-enter action`));
    stage.onExit?.forEach((action) => automation(action, `Stage ${stage.id} on-exit action`));
    const transitionMode = stage.transitionMode ?? "exclusive";
    if (transitionMode === "parallel" && stage.transitions.length < 2) {
      throw new Error(`Stage ${stage.id} needs at least two transitions for a parallel fork`);
    }
    if (transitionMode === "parallel") {
      if (stage.parallelJoinStageId === undefined) throw new Error(`Stage ${stage.id} must name its parallel join Stage`);
      reference(stages, stage.parallelJoinStageId, `Stage ${stage.id} parallel join`);
      const join = runtime.stages.find(({ id }) => id === stage.parallelJoinStageId);
      if (join?.joinMode === undefined) throw new Error(`Stage ${stage.id} parallel join must declare all or first behavior`);
      const reachesJoin = (startId: string, seen = new Set<string>()): boolean => {
        if (startId === stage.parallelJoinStageId) return true;
        if (seen.has(startId)) return false;
        seen.add(startId);
        const candidate = runtime.stages.find(({ id }) => id === startId);
        return candidate !== undefined && candidate.transitions.length > 0 &&
          candidate.transitions.every(({ targetStageId }) => reachesJoin(targetStageId, new Set(seen)));
      };
      if (stage.transitions.some(({ targetStageId }) => !reachesJoin(targetStageId))) {
        throw new Error(`Stage ${stage.id} has a parallel branch that does not reach its join`);
      }
      const inspectBranch = (stageId: string, seen = new Set<string>()): void => {
        if (stageId === stage.parallelJoinStageId || seen.has(stageId)) return;
        seen.add(stageId);
        const branch = runtime.stages.find(({ id }) => id === stageId);
        if (branch === undefined || branch.transitionMode === "parallel" || (branch.allowedActivityIds?.length ?? 0) > 0 ||
            (branch.completionRequirements?.length ?? 0) > 0 || (branch.durationSeconds ?? 0) > 0 ||
            branch.transitions.some(({ mode }) => mode !== "automatic") ||
            [...(branch.onEnter ?? []), ...(branch.onExit ?? [])].some((action) => action.type === "apply_effect" &&
              Number((action.parameters as Record<string, unknown> | undefined)?.delaySeconds ?? 0) > 0)) {
          throw new Error(`Stage ${stage.id} parallel branches must be bounded automatic logic before their join`);
        }
        branch.transitions.forEach(({ targetStageId }) => inspectBranch(targetStageId, new Set(seen)));
      };
      if (stage.transitions.some(({ mode }) => mode !== "automatic")) {
        throw new Error(`Stage ${stage.id} parallel fork transitions must be automatic`);
      }
      if ([...(stage.onExit ?? [])].some((action) => action.type === "apply_effect" &&
          Number((action.parameters as Record<string, unknown> | undefined)?.delaySeconds ?? 0) > 0)) {
        throw new Error(`Stage ${stage.id} parallel fork cannot delay effects inside its atomic branch transaction`);
      }
      stage.transitions.forEach(({ targetStageId }) => inspectBranch(targetStageId));
    } else if (stage.parallelJoinStageId !== undefined) {
      throw new Error(`Stage ${stage.id} names a parallel join without a parallel fork`);
    }
    if (transitionMode === "exclusive" && stage.transitions.length > 1) {
      const priorities = stage.transitions.map(({ priority }) => priority);
      const fallback = stage.transitions.filter(({ gate }) => gate === undefined);
      const minimumPriority = Math.min(...priorities.map(Number));
      if (priorities.some((priority) => !Number.isSafeInteger(priority)) || new Set(priorities).size !== priorities.length ||
          fallback.length > 1 || (fallback[0]?.priority !== undefined && fallback[0].priority !== minimumPriority)) {
        throw new Error(`Stage ${stage.id} conditional branches need unique priorities and Gates before the fallback branch`);
      }
    }
    const incoming = incomingStages.get(stage.id) ?? [];
    if (stage.joinMode !== undefined && incoming.length < 2) {
      throw new Error(`Stage ${stage.id} needs at least two incoming branches for a join`);
    }
    if (stage.joinMode === undefined && incoming.length > 1) {
      throw new Error(`Stage ${stage.id} must declare whether its join waits for all branches or accepts the first`);
    }
    for (const requirement of stage.completionRequirements ?? []) {
      reference(artifactTypes, requirement.artifactTypeId, `Stage ${stage.id} completion requirement`);
      reference(teams, requirement.scope.teamId, `Stage ${stage.id} completion requirement`);
      if (requirement.stageGroupId !== undefined) reference(stageGroups, requirement.stageGroupId, `Stage ${stage.id} completion requirement`);
      if (requirement.minimumPerScope < 1) throw new Error(`Stage ${stage.id} completion requirement needs a positive minimum`);
      if (!(runtime.teamCells ?? []).some((cell) => cell.teamId === requirement.scope.teamId && cell.kind === requirement.scope.cellKind)) {
        throw new Error(`Stage ${stage.id} completion requirement references missing Team Cells`);
      }
      const requirementType = runtime.artifactTypes.find((type) => type.id === requirement.artifactTypeId);
      const requirementForm = runtime.forms.find((form) => form.id === requirementType?.formId);
      if (!requirementForm?.sections.some((section) => section.fields.some((field) => field.key === requirement.scope.field))) {
        throw new Error(`Stage ${stage.id} completion requirement references missing scope field ${requirement.scope.field}`);
      }
    }
  }
  const reachableStages = new Set<string>();
  const stageQueue = runtime.stages[0] === undefined ? [] : [runtime.stages[0].id];
  while (stageQueue.length > 0) {
    const id = stageQueue.shift();
    if (id === undefined || reachableStages.has(id)) continue;
    reachableStages.add(id);
    runtime.stages.find((stage) => stage.id === id)?.transitions.forEach((transition) => stageQueue.push(transition.targetStageId));
  }
  if (reachableStages.size !== runtime.stages.length) throw new Error("Core Design contains an unreachable Stage");
  const visitingStages = new Set<string>();
  const visitedStages = new Set<string>();
  const visitStage = (id: string): void => {
    if (visitingStages.has(id)) throw new Error("Core Design contains a cyclic Stage graph");
    if (visitedStages.has(id)) return;
    visitingStages.add(id);
    runtime.stages.find((stage) => stage.id === id)?.transitions.forEach(({ targetStageId }) => visitStage(targetStageId));
    visitingStages.delete(id);
    visitedStages.add(id);
  };
  if (runtime.stages[0] !== undefined) visitStage(runtime.stages[0].id);
  const referencedForms = new Set(runtime.artifactTypes.map((type) => type.formId));
  for (const form of runtime.forms) {
    if (!referencedForms.has(form.id)) throw new Error(`Form ${form.id} is not used by an Artifact Type`);
    const fields = form.sections.flatMap((section) => section.fields);
    uniqueIds(fields, `Form ${form.id} field`);
    const keys = uniqueIds(fields.map((field) => ({ id: field.key })), `Form ${form.id} field`);
    uniqueIds(form.sections, `Form ${form.id} section`);
    for (const section of form.sections) {
      if ((section.minItems ?? 0) < 0 || (section.maxItems ?? 0) < 0 ||
          (section.minItems !== undefined && section.maxItems !== undefined && section.minItems > section.maxItems)) {
        throw new Error(`Form ${form.id} section ${section.id} has invalid repeat bounds`);
      }
      if (section.repeatable === true && section.itemKeyField !== undefined && !section.fields.some((field) => field.key === section.itemKeyField)) {
        throw new Error(`Form ${form.id} section ${section.id} references missing item key ${section.itemKeyField}`);
      }
    }
    for (const field of fields) {
      if ((field.type === "single_select" || field.type === "multi_select") && (field.options?.length ?? 0) === 0) {
        throw new Error(`Form ${form.id} field ${field.key} needs choices`);
      }
      if (field.options !== undefined) uniqueIds(field.options.map((option) => ({ id: option.value })), `Form ${form.id} field ${field.key} choice`);
      if (field.optionSource !== undefined) {
        reference(teams, field.optionSource.teamId, `Form ${form.id} field ${field.key}`);
        if (!(runtime.teamCells ?? []).some((cell) => cell.teamId === field.optionSource?.teamId && cell.kind === field.optionSource?.cellKind)) {
          throw new Error(`Form ${form.id} field ${field.key} references missing Team Cells`);
        }
      }
      if (field.type === "artifact_reference") {
        if (field.reference === undefined) throw new Error(`Form ${form.id} field ${field.key} needs an Artifact reference contract`);
        field.reference.sourceArtifactTypeIds.forEach((id) => reference(artifactTypes, id, `Form ${form.id} field ${field.key}`));
      }
      for (const condition of [field.visibleWhen, field.requiredWhen]) {
        if (condition !== undefined && !keys.has(condition.field)) throw new Error(`Form ${form.id} field ${field.key} references missing condition field ${condition.field}`);
      }
      const validation = field.validation;
      if (validation !== undefined && ((validation.minLength ?? 0) < 0 || (validation.maxLength ?? 0) < 0 || (validation.minItems ?? 0) < 0 || (validation.maxItems ?? 0) < 0)) {
        throw new Error(`Form ${form.id} field ${field.key} has invalid validation bounds`);
      }
    }
    for (const rule of form.rules ?? []) rule.fields.forEach((key) => reference(keys, key, `Form ${form.id} rule`));
    if (form.presentation !== undefined) reference(keys, form.presentation.scopeField, `Form ${form.id} presentation`);
  }
  for (const type of runtime.artifactTypes) {
    reference(forms, type.formId, `Artifact Type ${type.id}`);
    reference(workflows, type.workflowId, `Artifact Type ${type.id}`);
    reference(policies, type.informationPolicyId, `Artifact Type ${type.id}`);
    type.allowedCreatorSessionRoleIds.forEach((id) => reference(roles, id, `Artifact Type ${type.id}`));
    type.allowedTeamIds?.forEach((id) => reference(teams, id, `Artifact Type ${type.id}`));
    type.availableStageIds?.forEach((id) => reference(stages, id, `Artifact Type ${type.id}`));
    const form = runtime.forms.find((candidate) => candidate.id === type.formId);
    const formKeys = new Set(form?.sections.flatMap((section) => section.fields.map((field) => field.key)) ?? []);
    if (type.instanceScope !== undefined) {
      reference(teams, type.instanceScope.teamId, `Artifact Type ${type.id} scope`);
      reference(formKeys, type.instanceScope.field, `Artifact Type ${type.id} scope`);
      if (!(runtime.teamCells ?? []).some((cell) => cell.teamId === type.instanceScope?.teamId && cell.kind === type.instanceScope?.cellKind)) {
        throw new Error(`Artifact Type ${type.id} references missing Team Cells`);
      }
    }
    for (const link of type.evidenceLinks ?? []) {
      reference(formKeys, link.field, `Artifact Type ${type.id} evidence link`);
      link.sourceArtifactTypeIds.forEach((id) => reference(artifactTypes, id, `Artifact Type ${type.id} evidence link`));
    }
    runtime.informationPolicies.find((policy) => policy.id === type.informationPolicyId)?.grants.forEach((grant) => {
      if (grant.audience.payloadTeamField !== undefined) reference(formKeys, grant.audience.payloadTeamField, `Artifact Type ${type.id} policy`);
    });
  }
  for (const policy of runtime.informationPolicies) {
    if (policy.grants.length === 0) throw new Error(`Information Policy ${policy.id} grants nothing`);
    for (const grant of policy.grants) {
      selector(grant.audience, `Information Policy ${policy.id}`);
      if (grant.release?.stageId !== undefined) reference(stages, grant.release.stageId, `Information Policy ${policy.id}`);
      if (grant.expiresAtStageId !== undefined) reference(stages, grant.expiresAtStageId, `Information Policy ${policy.id}`);
      if (grant.release?.mode === "after_seconds" && (!Number.isSafeInteger(grant.release.offsetSeconds) || Number(grant.release.offsetSeconds) < 0)) {
        throw new Error(`Information Policy ${policy.id} has an invalid release offset`);
      }
    }
  }
  for (const workflow of runtime.workflows) {
    const states = new Set(workflow.states.map((state) => state.key));
    if (!states.has(workflow.initialState) || !workflow.states.some((state) => state.kind === "terminal")) {
      throw new Error(`Workflow ${workflow.id} needs an initial and terminal state`);
    }
    for (const state of workflow.states) {
      state.holderSessionRoleIds?.forEach((id) => reference(roles, id, `Workflow ${workflow.id} state ${state.key}`));
      state.assignment?.sessionRoleIds?.forEach((id) => reference(roles, id, `Workflow ${workflow.id} state ${state.key} assignment`));
      if (typeof state.assignment?.teamSelector === "object") {
        state.assignment.teamSelector.teamIds.forEach((id) => reference(teams, id, `Workflow ${workflow.id} state ${state.key} assignment`));
      }
      if (state.dueAfterSeconds !== undefined && (!Number.isSafeInteger(state.dueAfterSeconds) || state.dueAfterSeconds < 0)) {
        throw new Error(`Workflow ${workflow.id} state ${state.key} has an invalid due period`);
      }
      if (["task", "review", "approval", "wait"].includes(state.kind) && state.holderRelation === undefined &&
          (state.holderSessionRoleIds?.length ?? 0) === 0 && state.assignment === undefined) {
        throw new Error(`Workflow ${workflow.id} state ${state.key} has no assignment`);
      }
      if (state.kind === "approval" && (state.holderSessionRoleIds?.length ?? 0) + (state.assignment?.sessionRoleIds?.length ?? 0) === 0) {
        throw new Error(`Workflow ${workflow.id} state ${state.key} has no eligible approver`);
      }
      if (state.quorum !== undefined) {
        if (state.quorum.minimumApprovals !== undefined && (!Number.isSafeInteger(state.quorum.minimumApprovals) || state.quorum.minimumApprovals < 1)) {
          throw new Error(`Workflow ${workflow.id} state ${state.key} has an invalid quorum`);
        }
        if (state.quorum.rule === "quorum" && state.quorum.minimumApprovals === undefined) {
          throw new Error(`Workflow ${workflow.id} state ${state.key} must declare its quorum minimum`);
        }
        if (state.quorum.rule === "lead_after_peers") {
          if (state.quorum.leadSessionRoleId === undefined) throw new Error(`Workflow ${workflow.id} state ${state.key} has no lead approver`);
          reference(roles, state.quorum.leadSessionRoleId, `Workflow ${workflow.id} state ${state.key} quorum`);
        }
      }
      state.automation?.forEach((action) => automation(action, `Workflow ${workflow.id} state ${state.key} automation`));
    }
    const transitionGroups = new Map<string, RuntimeWorkflowTransitionV1[]>();
    for (const transition of workflow.transitions) {
      if ((transition.from !== null && !states.has(transition.from)) || !states.has(transition.to)) {
        throw new Error(`Workflow ${workflow.id} has an invalid state reference`);
      }
      for (const sessionRoleId of transition.allowedSessionRoleIds) {
        reference(roles, sessionRoleId, `Workflow ${workflow.id}`);
        const key = `${transition.from ?? "<create>"}:${transition.command}:${sessionRoleId}`;
        transitionGroups.set(key, [...(transitionGroups.get(key) ?? []), transition]);
      }
      if (transition.contentOnly === true && transition.editableFieldKeys !== undefined) {
        throw new Error(`Workflow ${workflow.id} transition ${transition.id} has conflicting content rules`);
      }
      if (transition.editableFieldKeys !== undefined) {
        const workflowForms = runtime.artifactTypes.filter((type) => type.workflowId === workflow.id)
          .map((type) => runtime.forms.find((form) => form.id === type.formId));
        for (const form of workflowForms) {
          const fieldKeys = new Set(form?.sections.flatMap((section) => section.fields.map((field) => field.key)) ?? []);
          transition.editableFieldKeys.forEach((key) => reference(fieldKeys, key, `Workflow ${workflow.id} transition ${transition.id}`));
        }
      }
      if (transition.gate !== undefined) assertGateDefinition(transition.gate, facts, `Workflow ${workflow.id} transition ${transition.id} Gate`);
      transition.actions?.forEach((action) => automation(action, `Workflow ${workflow.id} transition ${transition.id} action`));
    }
    for (const candidates of transitionGroups.values()) {
      if (candidates.length < 2) continue;
      const priorities = candidates.map(({ priority }) => priority);
      const fallback = candidates.filter(({ gate }) => gate === undefined);
      const minimumPriority = Math.min(...priorities.map(Number));
      if (priorities.some((priority) => !Number.isSafeInteger(priority)) || new Set(priorities).size !== priorities.length ||
          fallback.length > 1 || (fallback[0]?.priority !== undefined && fallback[0].priority !== minimumPriority)) {
        throw new Error(`Workflow ${workflow.id} has conflicting transitions without bounded priorities and Gates`);
      }
    }
    const reachableStates = new Set<string>();
    const stateQueue = workflow.transitions.filter((transition) => transition.from === null).map((transition) => transition.to);
    while (stateQueue.length > 0) {
      const state = stateQueue.shift();
      if (state === undefined || reachableStates.has(state)) continue;
      reachableStates.add(state);
      workflow.transitions.filter((transition) => transition.from === state).forEach((transition) => stateQueue.push(transition.to));
    }
    if (reachableStates.size !== workflow.states.length) throw new Error(`Workflow ${workflow.id} has an unreachable state`);
    const terminatingStates = new Set(workflow.states.filter(({ kind }) => kind === "terminal" || kind === "cancelled").map(({ key }) => key));
    let changed = true;
    while (changed) {
      changed = false;
      for (const transition of workflow.transitions) {
        if (transition.from !== null && terminatingStates.has(transition.to) && !terminatingStates.has(transition.from)) {
          terminatingStates.add(transition.from);
          changed = true;
        }
      }
    }
    if (workflow.states.some(({ key }) => !terminatingStates.has(key))) {
      throw new Error(`Workflow ${workflow.id} contains a state with no terminating path`);
    }
  }
  for (const profile of runtime.interfaces) {
    profile.selectors.sessionRoleIds?.forEach((id) => reference(roles, id, `Interface Profile ${profile.id}`));
    profile.selectors.teamIds?.forEach((id) => reference(teams, id, `Interface Profile ${profile.id}`));
    profile.selectors.stageIds?.forEach((id) => reference(stages, id, `Interface Profile ${profile.id}`));
    for (const module of profile.layout.regions.flatMap((region) => region.modules)) {
      const releaseResourceId = module.configuration.releaseResourceId;
      if (module.moduleType === "slide_deck" && typeof releaseResourceId === "string") {
        reference(resources, releaseResourceId, `Interface Profile ${profile.id} module ${module.id}`);
      }
      const scoped = module.configuration.scopedModalArtifacts;
      if (Array.isArray(scoped)) {
        for (const item of scoped) {
          if (typeof item !== "object" || item === null || !("artifactTypeId" in item) || typeof item.artifactTypeId !== "string") {
            throw new Error(`Interface Profile ${profile.id} module ${module.id} has an invalid scoped modal Artifact`);
          }
          reference(artifactTypes, item.artifactTypeId, `Interface Profile ${profile.id} module ${module.id}`);
        }
      }
      if (module.moduleType === "message_inbox") {
        const configuredChannels = module.configuration.channelIds;
        if (!Array.isArray(configuredChannels) || configuredChannels.some((id) =>
          typeof id !== "string" || !runtime.communications.messageChannels.some((channel) => channel.id === id))) {
          throw new Error(`Interface Profile ${profile.id} module ${module.id} has invalid Message Channels`);
        }
        const sendRouteId = module.configuration.sendRouteId;
        if (sendRouteId !== undefined && (typeof sendRouteId !== "string" ||
            !runtime.communications.routes.some((route) => route.id === sendRouteId && configuredChannels.includes(route.channelId)))) {
          throw new Error(`Interface Profile ${profile.id} module ${module.id} has an invalid send Route`);
        }
      }
      if (module.moduleType === "proposal_thread") {
        const channelId = module.configuration.channelId;
        if (typeof channelId !== "string" || !runtime.communications.messageChannels.some((channel) =>
          channel.id === channelId && channel.threadProtocol !== undefined) ||
          !["participant", "custodian"].includes(String(module.configuration.actorMode))) {
          throw new Error(`Interface Profile ${profile.id} module ${module.id} has an invalid proposal configuration`);
        }
      }
    }
  }
  const channelIds = uniqueIds(runtime.communications.messageChannels, "Message Channel");
  uniqueIds(runtime.communications.routes, "Communication Route");
  runtime.communications.routes.forEach((route) => {
    reference(channelIds, route.channelId, `Communication Route ${route.id}`);
    if (route.informationPolicyId === undefined) throw new Error(`Communication Route ${route.id} has no Information Policy`);
    reference(policies, route.informationPolicyId, `Communication Route ${route.id}`);
    if (route.approvalWorkflowId !== undefined) reference(workflows, route.approvalWorkflowId, `Communication Route ${route.id}`);
    route.activeStageIds?.forEach((id) => reference(stages, id, `Communication Route ${route.id}`));
    selector(route.sender, `Communication Route ${route.id} sender`);
    selector(route.recipient, `Communication Route ${route.id} recipient`);
  });
  for (const channel of runtime.communications.messageChannels) {
    if (channel.informationPolicyId !== undefined) reference(policies, channel.informationPolicyId, `Message Channel ${channel.id}`);
    const protocol = channel.threadProtocol;
    if (protocol === undefined) continue;
    if (channel.supportsThreading !== true || protocol.actions.length === 0) {
      throw new Error(`Message Channel ${channel.id} has an incomplete thread protocol`);
    }
    protocol.sourceArtifactTypeIds.forEach((id) => reference(artifactTypes, id, `Message Channel ${channel.id}`));
    protocol.custodySessionRoleIds.forEach((id) => reference(roles, id, `Message Channel ${channel.id}`));
    protocol.participantSessionRoleIds.forEach((id) => reference(roles, id, `Message Channel ${channel.id}`));
    const commands = new Set<string>();
    for (const action of protocol.actions) {
      if (commands.has(action.command)) throw new Error(`Message Channel ${channel.id} has a duplicate thread command`);
      commands.add(action.command);
      if (action.command === "message.proposal_approve_round") {
        if (action.routeId !== undefined || action.approvalRouteId !== undefined) {
          throw new Error(`Message Channel ${channel.id} approval action cannot declare a Route`);
        }
        continue;
      }
      if (action.routeId === undefined) throw new Error(`Message Channel ${channel.id} action ${action.command} has no Route`);
      const route = runtime.communications.routes.find(({ id }) => id === action.routeId);
      if (route === undefined || route.channelId !== channel.id) {
        throw new Error(`Message Channel ${channel.id} action ${action.command} references an invalid Route`);
      }
      if (action.actor !== "custodian") {
        if (action.approvalRouteId === undefined) {
          throw new Error(`Message Channel ${channel.id} action ${action.command} has no approval Route`);
        }
        const approvalRoute = runtime.communications.routes.find(({ id }) => id === action.approvalRouteId);
        if (approvalRoute === undefined || approvalRoute.channelId !== channel.id) {
          throw new Error(`Message Channel ${channel.id} action ${action.command} references an invalid approval Route`);
        }
      }
    }
    for (const typeId of protocol.sourceArtifactTypeIds) {
      const type = runtime.artifactTypes.find((candidate) => candidate.id === typeId);
      const form = runtime.forms.find((candidate) => candidate.id === type?.formId);
      const fieldKeys = new Set(form?.sections.flatMap((section) => section.fields.map((field) => field.key)) ?? []);
      reference(fieldKeys, protocol.recipientTeamField, `Message Channel ${channel.id}`);
    }
    if (protocol.acceptanceOutcome !== undefined) {
      for (const [teamId, artifactTypeId] of Object.entries(protocol.acceptanceOutcome.eligibleActionArtifactTypeByRecipientTeam)) {
        reference(teams, teamId, `Message Channel ${channel.id} acceptance outcome`);
        reference(artifactTypes, artifactTypeId, `Message Channel ${channel.id} acceptance outcome`);
      }
    }
  }
}

/** Validates Scenario references needed by the Runtime information-flow engine. */
export function assertRuntimeScenario(coreDesign: CoreDesignV1, scenario: ScenarioV1): void {
  if (coreDesign.teams === undefined) return;
  assertRuntimeCoreDesign(coreDesign);
  const runtime = coreDesign as CoreDesignV1 & RuntimeCoreDesignV1;
  const policies = new Set(runtime.informationPolicies.map(({ id }) => id));
  const stages = new Set(runtime.stages.map(({ id }) => id));
  const artifactTypes = new Set(runtime.artifactTypes.map(({ id }) => id));
  const stateVariables = new Map((runtime.stateVariables ?? []).map((definition) => [definition.id, definition]));
  const capabilities = new Map((runtime.capabilities ?? []).map((definition) => [definition.id, definition]));
  const resources = new Set((runtime.resourceDefinitions ?? []).map(({ id }) => id));
  const teams = new Set(runtime.teams.map(({ id }) => id));
  const content = uniqueIds(scenario.content ?? [], "Scenario content");
  const injects = uniqueIds(scenario.injects ?? [], "Inject Definition");
  const facts = gateFactTypes(runtime, scenario);
  for (const item of scenario.content ?? []) {
    if (!policies.has(item.informationPolicyId)) throw new Error(`Scenario content ${item.id} references missing Information Policy ${item.informationPolicyId}`);
  }
  for (const inject of scenario.injects ?? []) {
    if (!content.has(inject.contentId)) throw new Error(`Inject ${inject.id} references missing content ${inject.contentId}`);
    if ((inject.releaseMode === "stage_entry" || inject.releaseMode === "stage_exit") &&
        (inject.stageId === undefined || !stages.has(inject.stageId))) {
      throw new Error(`Inject ${inject.id} references a missing Stage`);
    }
    if (inject.releaseMode === "scheduled" && (!Number.isSafeInteger(inject.scheduledOffsetSeconds) || Number(inject.scheduledOffsetSeconds) < 0)) {
      throw new Error(`Inject ${inject.id} has an invalid scheduled offset`);
    }
    if (inject.releaseMode === "gate" && inject.releaseGate === undefined) throw new Error(`Inject ${inject.id} has no release Gate`);
    if (inject.releaseGate !== undefined) assertGateDefinition(inject.releaseGate, facts, `Inject ${inject.id} release Gate`);
    if (inject.releaseMode === "scheduled") throw new Error(`Inject ${inject.id} uses scheduled release without approved Runtime semantics`);
    if (inject.requiredResponseArtifactTypeId !== undefined && !artifactTypes.has(inject.requiredResponseArtifactTypeId)) {
      throw new Error(`Inject ${inject.id} references missing response Artifact Type ${inject.requiredResponseArtifactTypeId}`);
    }
    inject.followOnInjectIds?.forEach((id) => {
      if (!injects.has(id)) throw new Error(`Inject ${inject.id} references missing follow-on Inject ${id}`);
    });
    if (inject.controlNotesContentId !== undefined && !content.has(inject.controlNotesContentId)) {
      throw new Error(`Inject ${inject.id} references missing control notes content ${inject.controlNotesContentId}`);
    }
    for (const effect of inject.effects ?? []) {
      const definition = stateVariables.get(effect.stateVariableId);
      if (definition === undefined) throw new Error(`Inject ${inject.id} Effect references missing State Variable ${effect.stateVariableId}`);
      const expected = definition.type === "integer" || definition.type === "decimal" ? "number" :
        definition.type === "boolean" ? "boolean" : "string";
      if (typeof effect.value !== expected || definition.type === "integer" && !Number.isSafeInteger(effect.value) ||
          effect.operation !== "set" && typeof effect.value !== "number") throw new Error(`Inject ${inject.id} Effect has an incompatible value`);
    }
    const recipient = inject.recipients;
    recipient.sessionRoleIds?.forEach((id) => {
      if (!runtime.sessionRoles.some((role) => role.id === id)) throw new Error(`Inject ${inject.id} references missing Session Role ${id}`);
    });
    recipient.teamIds?.forEach((id) => {
      if (!runtime.teams.some((team) => team.id === id)) throw new Error(`Inject ${inject.id} references missing Team ${id}`);
    });
    recipient.seatIds?.forEach((id) => {
      if (!runtime.seats.some((seat) => seat.id === id)) throw new Error(`Inject ${inject.id} references missing Seat ${id}`);
    });
    const populated = recipient.public === true || recipient.includeControlRoles === true || recipient.ownerTeam === true ||
      recipient.relation !== undefined || recipient.payloadTeamField !== undefined ||
      (recipient.sessionRoleIds?.length ?? 0) > 0 || (recipient.teamIds?.length ?? 0) > 0 || (recipient.seatIds?.length ?? 0) > 0;
    if (!populated) throw new Error(`Inject ${inject.id} has an empty default-deny recipient selector`);
  }
  for (const initial of scenario.initialState ?? []) {
    const definition = stateVariables.get(initial.stateVariableId);
    if (definition === undefined) throw new Error(`Initial State Value references missing State Variable ${initial.stateVariableId}`);
    if (definition.scope === "team" && (initial.scopeReference === undefined || !teams.has(initial.scopeReference))) {
      throw new Error(`Initial State Value ${initial.stateVariableId} references a missing Team scope`);
    }
    const expected = definition.type === "integer" || definition.type === "decimal" ? "number" :
      definition.type === "boolean" ? "boolean" : "string";
    if (typeof initial.value !== expected || definition.type === "integer" && !Number.isSafeInteger(initial.value) ||
        typeof initial.value === "number" && (definition.minimum !== undefined && initial.value < definition.minimum ||
          definition.maximum !== undefined && initial.value > definition.maximum)) {
      throw new Error(`Initial State Value ${initial.stateVariableId} is incompatible with its definition`);
    }
  }
  for (const initial of scenario.initialCapabilities ?? []) {
    const definition = capabilities.get(initial.capabilityId);
    const expectedQuantity = definition?.mode === "counted" ? definition.initialQuantity : undefined;
    if (definition === undefined || !definition.states.some((state) => state === initial.state) ||
        (definition.mode === "counted" && (!Number.isSafeInteger(initial.quantity ?? expectedQuantity) ||
          Number(initial.quantity ?? expectedQuantity) < 0 || Number(initial.quantity ?? expectedQuantity) > Number(definition.maximumQuantity))) ||
        (definition.mode !== "counted" && initial.quantity !== undefined)) {
      throw new Error(`Initial Capability ${initial.capabilityId} is invalid`);
    }
  }
  for (const initial of scenario.initialResources ?? []) {
    if (!resources.has(initial.resourceId) || !Number.isFinite(initial.balance) || initial.balance < 0) {
      throw new Error(`Initial Resource ${initial.resourceId} is invalid`);
    }
  }
}
