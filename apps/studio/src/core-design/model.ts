import type {
  CoreDesignV1,
  RuntimeFormDefinitionV1,
  RuntimeInformationGrantV1,
  RuntimeInterfaceProfileV1,
  RuntimePollDefinitionV1,
  RuntimeStageDefinitionV1,
  RuntimeVoiceChannelDefinitionV1,
  RuntimeWorkflowDefinitionV1,
  RuntimeWorkflowTransitionV1
} from "@plenum/simulation-schema";

export const FIELD_TYPES = ["short_text", "long_text", "number", "single_select", "multi_select", "artifact_reference"] as const;
export const MODULE_TYPES = ["session_status", "artifact_form", "task_list", "artifact_presentation", "slide_deck", "resource_library", "message_inbox", "proposal_thread", "inject_inbox"] as const;

export function identifier(): string {
  return crypto.randomUUID();
}

/** Distinguish repeated Stage names without exposing their internal identifiers. */
export function stageChoiceLabel(core: CoreDesignV1, stageId: string): string {
  const stages = core.stages ?? [];
  const stage = stages.find(({ id }) => id === stageId);
  if (!stage) return "Missing Stage";
  if (stages.filter(({ name }) => name === stage.name).length < 2) return stage.name;
  const groupPath = (groupId: string | undefined): string => {
    const names: string[] = [];
    const visited = new Set<string>();
    while (groupId && !visited.has(groupId)) {
      visited.add(groupId);
      const group = core.stageGroups?.find(({ id }) => id === groupId);
      if (!group) break;
      names.unshift(group.name);
      groupId = group.parentGroupId;
    }
    return names.join(" / ");
  };
  const group = groupPath(stage.stageGroupId);
  const label = group ? `${group} / ${stage.name}` : stage.name;
  const ambiguous = stages.filter((other) => other.name === stage.name && groupPath(other.stageGroupId) === group).length > 1;
  return ambiguous ? `${label} (Stage ${stages.indexOf(stage) + 1})` : label;
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

export function dec42Workflow(sessionRoleIds: readonly string[]): RuntimeWorkflowDefinitionV1 {
  const [author = "", reviewer = "", control = ""] = sessionRoleIds;
  const transition = (from: string | null, command: string, label: string, to: string, roles: string[],
    extra: Partial<RuntimeWorkflowTransitionV1> = {}): RuntimeWorkflowTransitionV1 =>
    ({ id: identifier(), from, command, label, to, allowedSessionRoleIds: roles.filter(Boolean), ...extra });
  return {
    id: identifier(), key: `dec42_${identifier()}`, name: "DEC-42 reference review", initialState: "draft",
    description: "The author drafts and submits; the intermediate reviewer forwards or returns; Control accepts or returns; returned work resubmits through the intermediate reviewer.",
    states: [
      { key: "draft", label: "Draft", kind: "draft", holderSessionRoleIds: [author].filter(Boolean) },
      { key: "submitted", label: "Submitted for intermediate review", kind: "review", holderSessionRoleIds: [reviewer].filter(Boolean) },
      { key: "in_review", label: "In Control review", kind: "review", holderSessionRoleIds: [control].filter(Boolean) },
      { key: "returned", label: "Returned for revision", kind: "draft", holderSessionRoleIds: [author].filter(Boolean) },
      { key: "accepted", label: "Accepted", kind: "terminal" }
    ],
    transitions: [
      transition(null, "artifact.create", "Save draft", "draft", [author]),
      transition("draft", "artifact.edit", "Save changes", "draft", [author], { contentOnly: true }),
      transition("draft", "artifact.submit", "Submit for intermediate review", "submitted", [author], { notifySessionRoleIds: [reviewer].filter(Boolean) }),
      transition("submitted", "artifact.forward", "Forward to Control", "in_review", [reviewer], { notifySessionRoleIds: [control].filter(Boolean) }),
      transition("submitted", "artifact.return", "Return to author", "returned", [reviewer], { notifySessionRoleIds: [author].filter(Boolean) }),
      transition("in_review", "artifact.accept", "Accept", "accepted", [control]),
      transition("in_review", "artifact.return", "Return for revision", "returned", [control], { notifySessionRoleIds: [author, reviewer].filter(Boolean) }),
      transition("returned", "artifact.edit", "Save revision", "returned", [author], { contentOnly: true }),
      transition("returned", "artifact.submit", "Resubmit for intermediate review", "submitted", [author], { notifySessionRoleIds: [reviewer].filter(Boolean) })
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

export function basicPoll(name: string, policyId: string | undefined, certifierSessionRoleId?: string): RuntimePollDefinitionV1 {
  return {
    id: identifier(), scope: "session", question: name,
    options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }, { id: "abstain", label: "Abstain" }],
    pollType: "yes_no_abstain", minSelections: 1, maxSelections: 1,
    tallyMethod: "builtin_count", tallyMethodVersion: "1", electoratePolicyId: policyId ?? "",
    oneBallotPer: "seat_assignment", allowRevote: false, secrecy: "open",
    thresholdRule: { kind: "simple_majority", denominator: "valid_votes", abstentionCountsTowardDenominator: false },
    quorumRule: { basis: "electorate_at_open", minimum: 0, abstentionCountsTowardParticipation: true },
    weights: [], vetoRule: { holderSeatIds: [] }, tieRule: "no_decision",
    openTrigger: { mode: "manual" }, closeTrigger: { mode: "manual" }, deadlinePolicy: { graceSeconds: 0 },
    resultVisibilityPolicyId: policyId ?? "", certificationPolicy: { certifierSessionRoleIds: certifierSessionRoleId === undefined ? [] : [certifierSessionRoleId] }
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
