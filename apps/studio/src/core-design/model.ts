import type {
  CoreDesignV1,
  MethodologyConceptV1,
  RuntimeFormDefinitionV1,
  RuntimeInformationGrantV1,
  RuntimeInterfaceProfileV1,
  RuntimePollDefinitionV1,
  RuntimeStageDefinitionV1,
  RuntimeVoiceChannelDefinitionV1,
  RuntimeWorkflowDefinitionV1
} from "@plenum/simulation-schema";

export const METHODOLOGY_CONCEPTS: readonly MethodologyConceptV1[] = [
  { key: "stage", label: "Stage", enabled: true, dependsOn: [] },
  { key: "session_role", label: "Session Role", enabled: true, dependsOn: [] },
  { key: "seat", label: "Seat", enabled: true, dependsOn: ["session_role"] },
  { key: "artifact_type", label: "Artifact Type", enabled: true, dependsOn: ["form", "workflow_definition"] },
  { key: "workflow_definition", label: "Workflow Definition", enabled: true, dependsOn: ["session_role"] },
  { key: "information_policy", label: "Information Policy", enabled: true, dependsOn: ["session_role"] },
  { key: "team", label: "Team", enabled: true, dependsOn: ["seat"] },
  { key: "decision_record", label: "Decision Record", enabled: true, dependsOn: ["artifact_type"] },
  { key: "inject", label: "Inject", enabled: false, dependsOn: ["information_policy"] },
  { key: "communication", label: "Communication", enabled: false, dependsOn: ["information_policy"] },
  { key: "research_question", label: "Research Question", enabled: false, dependsOn: [] }
];

export const FIELD_TYPES = ["short_text", "long_text", "number", "single_select", "multi_select", "artifact_reference"] as const;
export const MODULE_TYPES = ["session_status", "artifact_form", "task_list", "artifact_presentation", "slide_deck", "message_inbox", "proposal_thread", "inject_inbox"] as const;

export function identifier(): string {
  return crypto.randomUUID();
}

export function basicStage(name: string, order: number): RuntimeStageDefinitionV1 {
  return {
    id: identifier(), name, stageType: "stage", order, timerMode: "none", allowedActivityIds: [], transitions: [],
    operatorControls: { allowStart: true, allowEnd: true, allowReopen: true, allowExtend: false, allowSkip: false, allowReturnToPrevious: order > 0, requireReason: true }
  };
}

export function basicWorkflow(name: string, sessionRoleId: string | undefined): RuntimeWorkflowDefinitionV1 {
  const id = identifier();
  const roles = sessionRoleId === undefined ? [] : [sessionRoleId];
  return {
    id, key: id, name, initialState: "draft",
    states: [
      { key: "draft", label: "Draft", kind: "draft", holderRelation: "creator" },
      { key: "review", label: "Review", kind: "review", holderSessionRoleIds: roles },
      { key: "completed", label: "Completed", kind: "terminal" }
    ],
    transitions: [
      { id: identifier(), from: null, command: "artifact.create", label: "Save draft", to: "draft", allowedSessionRoleIds: roles },
      { id: identifier(), from: "draft", command: "artifact.submit", label: "Submit for review", to: "review", allowedSessionRoleIds: roles },
      { id: identifier(), from: "review", command: "artifact.accept", label: "Accept", to: "completed", allowedSessionRoleIds: roles }
    ]
  };
}

export function basicForm(name: string): RuntimeFormDefinitionV1 {
  return { id: identifier(), name, formVersion: "1", sections: [{ id: identifier(), title: "Details", fields: [] }] };
}

export function defaultGrant(sessionRoleId: string | undefined): RuntimeInformationGrantV1 {
  return { audience: sessionRoleId === undefined ? {} : { sessionRoleIds: [sessionRoleId] }, release: { mode: "immediate" } };
}

export function basicInterface(name: string, sessionRoleId: string | undefined): RuntimeInterfaceProfileV1 {
  return {
    id: identifier(), name, selectors: sessionRoleId === undefined ? {} : { sessionRoleIds: [sessionRoleId] },
    layout: { template: "single_column", regions: [{ id: identifier(), modules: [] }] },
    navigation: { items: [] }
  };
}

export function basicPoll(name: string, policyId: string | undefined): RuntimePollDefinitionV1 {
  return {
    id: identifier(), scope: "session", question: name,
    options: [{ id: identifier(), label: "Yes" }, { id: identifier(), label: "No" }, { id: identifier(), label: "Abstain" }],
    pollType: "yes_no_abstain", minSelections: 1, maxSelections: 1,
    tallyMethod: "builtin_count", tallyMethodVersion: "1", electoratePolicyId: policyId ?? "",
    oneBallotPer: "seat_assignment", allowRevote: false, secrecy: "open",
    thresholdRule: { kind: "simple_majority", denominator: "valid_votes", abstentionCountsTowardDenominator: false },
    quorumRule: { basis: "electorate_at_open", minimum: 0, abstentionCountsTowardParticipation: true },
    weights: [], vetoRule: { holderSeatIds: [] }, tieRule: "no_decision",
    openTrigger: { mode: "manual" }, closeTrigger: { mode: "manual" }, deadlinePolicy: { graceSeconds: 0 },
    resultVisibilityPolicyId: policyId ?? "", certificationPolicy: {}
  };
}

export function basicVoiceChannel(name: string, adapterId: string | undefined): RuntimeVoiceChannelDefinitionV1 {
  return {
    id: identifier(), name, mode: "open_room", capacity: 20,
    canListen: {}, canTransmit: {}, canModerate: {},
    recordingPolicy: "off", transcriptionPolicy: "off", mediaProviderAdapterBindingId: adapterId ?? ""
  };
}

export function coreArray<K extends keyof CoreDesignV1>(core: CoreDesignV1, key: K): Extract<NonNullable<CoreDesignV1[K]>, unknown[]> {
  const value = core[key];
  return (Array.isArray(value) ? value : []) as Extract<NonNullable<CoreDesignV1[K]>, unknown[]>;
}
