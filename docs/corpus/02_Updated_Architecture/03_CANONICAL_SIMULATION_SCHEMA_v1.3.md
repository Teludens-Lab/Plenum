# Plenum — Canonical Simulation Schema

## Document control

| Field | Value |
|---|---|
| Document ID | CDM |
| Number | 03 |
| Version | 1.3.2 |
| Date | 2026-10-21 |
| Status | Draft for review. v1.2 addendum merged (DEC-26). Header previously read 1.1.0 in a file named v1.2; corrected. |
| Owner | Technical Lead, with Methodology Lead for meaning |
| Approvers | Product Owner; Methodology Lead; Technical Lead (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 08 Canon; 02 Platform; Decision Register; Glossary |
| Read by | 04 Studio; 05 Runtime; 06 Data; 09 Contracts; PostgreSQL Logical Data Model; release compiler; frontend; tests |
| Authority | Canonical design-time types, relationships, validation and versioning rules for Simulation Releases. Runtime record shapes are owned by the Data Model and 09; §16 maps them. |
| Supersedes | `03_CANONICAL_SIMULATION_SCHEMA_v1.2.md` |

---

## 1. Purpose

The Canonical Simulation Schema is the authoritative, portable representation of a simulation design. Designers edit it through Studio and never edit JSON directly (REQ-009). It represents simulation behavior only — not device synchronization, database layout or deployment secrets.

## 2. Design requirements

The schema is versioned, portable, validatable, human-readable when exported, independent of any particular simulation, backward-compatible within declared ranges (OPEN-012), and able to represent Fractured Order without source-code assumptions (DEC-14).

## 3. Layering

DEC-31 separates three layers. A Simulation Release combines them under a manifest.

| Layer | Contains | Copied from a Simulation Template? |
|---|---|---|
| Core Design | Methodology configuration, Teams, Session Roles, Seats, Stages, Activities, Artifact Types, Forms, Workflows, Information Policies, Communications, State Variables, Capabilities, Resources, Adjudication Models, Interfaces, Reports, Measurements, Research Questions, Plugin Bindings, Access Policy | Yes (DEC-32) |
| Scenario | Briefs, content, Inject Definitions, initial State Values, Scenario objectives, assets | Only if the Designer chooses (DEC-04) |
| Release manifest | Identity, versions, digest, provenance | Never; generated at Publication |

## 4. Top-level types

```typescript
interface SimulationRelease {
  manifest: ReleaseManifest;
  coreDesign: CoreDesign;
  scenario: Scenario;
}

interface ReleaseManifest {
  schemaVersion: string;            // version of this schema, e.g. "1.3.0"
  releaseId: string;
  projectId: string;
  definitionRevisionId: string;
  releaseLabel: string;
  semanticVersion: string;          // e.g. "1.2.0"; compatibility rules OPEN-012
  methodologyVersion: string;
  compilerVersion: string;
  contentDigest: string;            // SHA-256 of canonical serialization
  publishedBy: string;
  approvedBy: string[];
  publishedAt: string;
  releaseNotes: string;
  validationReportId: string;
}

interface CoreDesign {
  methodology: MethodologyConfiguration;
  terminology: TerminologyProfile;
  teams: TeamDefinition[];
  sessionRoles: SessionRoleDefinition[];
  seats: SeatDefinition[];
  stageGroups: StageGroupDefinition[];
  stages: StageDefinition[];
  activities: ActivityDefinition[];
  artifactTypes: ArtifactTypeDefinition[];
  forms: FormDefinition[];
  workflows: WorkflowDefinition[];
  informationPolicies: InformationPolicy[];
  communications: CommunicationDefinition;   // Message Channels, routes, Voice Channels
  polls: PollDefinition[];                   // §13.2; DEC-46
  stateVariables: StateVariableDefinition[];
  capabilities: CapabilityDefinition[];
  resources: ResourceDefinition[];
  adjudicationModels: AdjudicationModelDefinition[];
  interfaces: InterfaceProfile[];
  reports: ReportDefinition[];
  researchQuestions: ResearchQuestionDefinition[];
  measurements: MeasurementDefinition[];
  pluginBindings: PluginBinding[];           // §14.2
  compositions: ModelCompositionDefinition[]; // §14.2; DEC-55
  accessPolicy: AccessPolicyDefinition;
  validationProfile: ValidationProfile;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  purpose?: string;
  learningObjectives?: string[];
  audience?: string[];
  estimatedDurationMinutes?: number;
  deliveryModes: Array<"in_person" | "virtual" | "hybrid" | "asynchronous">;
  content: ContentDefinition[];
  injects: InjectDefinition[];
  initialState: InitialStateValue[];
  objectives: ObjectiveDefinition[];
  tags: string[];
}

interface SimulationProjectMetadata {
  id: string;
  ownerOrganizationId: string;
  name: string;
  slug: string;
  description?: string;
  publicationStatus: "draft" | "validated" | "in_review" | "approved" | "published" | "superseded" | "archived"; // DEC-39
  coreDesignId: string;
  scenarioIds: string[];
  templateSourceId?: string;        // Simulation Template it was created from
  themeId?: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

## 5. Methodology and terminology

```typescript
interface MethodologyConfiguration {
  methodologyVersion: string;
  enabledConcepts: MethodologyConceptKey[];   // 08 Canon §2; dependency rules OPEN-004
}

type MethodologyConceptKey =
  | "stage" | "session_role" | "seat" | "artifact_type" | "workflow" | "information_policy" | "evidence"
  | "team" | "decision_record" | "inject" | "communication" | "state_variable" | "capability"
  | "resource" | "objective" | "adjudication_model" | "effect" | "control_intervention"
  | "research_question" | "measurement";

interface TerminologyProfile {
  labels: Partial<Record<CanonicalLabelKey, { singular: string; plural: string }>>;
  customLabels: Record<string, string>;
}

type CanonicalLabelKey =
  | "team" | "session_role" | "seat" | "stage" | "stage_group" | "artifact" | "decision_record"
  | "action" | "inject" | "adjudication" | "control_staff" | "participant";
```

A Terminology Profile changes display text only (Glossary rule 2).

## 6. Actors

```typescript
interface TeamDefinition {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  publicBriefContentId?: string;
  privateBriefContentId?: string;
  colorToken?: string;
  iconAssetId?: string;
  objectiveIds: string[];
  startingResources?: ResourceAllocation[];
  relationships?: TeamRelationship[];
  minParticipants?: number;
  maxParticipants?: number;
  enabled: boolean;
}

interface TeamRelationship {
  targetTeamId: string;
  kind: "trust" | "alliance" | "rivalry" | "trade_exposure" | "communication_access" | "formal_authority" | "dependency" | "custom";
  label?: string;
  strength?: number;
}

interface SessionRoleDefinition {
  id: string;
  name: string;                       // e.g. "Scribe" — Release data, not platform vocabulary
  description?: string;
  capabilities: CapabilityGrant[];    // §7
  interfaceProfileIds: string[];
  allowedTeamIds?: string[];          // empty = not team-bound
  stageRestrictions?: string[];       // Stage IDs where the role is active
  informationClearance?: DataClassification;
  isControlRole: boolean;             // may perform Control Interventions (08 Canon §7)
  enabled: boolean;
}

interface SeatDefinition {
  id: string;
  name: string;
  sessionRoleIds: string[];
  teamId?: string;
  minOccupancy: number;
  maxOccupancy: number;
  required: boolean;
  joinMode: "open" | "code" | "assigned" | "operator_assigned";
  eligibility?: Gate;
}
```

Organization Roles (Admin, Designer, Publisher, Operator, Reviewer, Research Analyst) are platform-defined and never appear in a Release (DEC-61).

## 7. Capability catalog

A `CapabilityGrant` gives a Session Role permission to issue a family of Commands, optionally limited by scope.

```typescript
interface CapabilityGrant {
  capability: CapabilityKey;
  scope?: { artifactTypeIds?: string[]; teamIds?: string[]; stageIds?: string[] };
}

type CapabilityKey =
  // participation
  | "briefing.view" | "objectives.view" | "team_resources.view"
  | "artifact.draft" | "artifact.edit_team" | "artifact.submit"
  // communication
  | "message.send" | "proposal.send" | "proposal.respond" | "request.submit" | "statement.publish"
  // review and adjudication
  | "artifact.review" | "artifact.forward" | "artifact.return" | "artifact.accept"
  | "rubric.score" | "effect.apply" | "outcome.approve" | "outcome.publish"
  // control
  | "timer.control" | "stage.advance" | "inject.release" | "participant.reassign"
  | "workflow.override" | "intervention.record" | "export.generate";
```

Workflow transitions (§10) additionally name which Session Roles may fire each transition. Both checks must pass.

## 8. Stages

DEC-33 replaces the fixed phase hierarchy with Stages and optional Stage Groups.

```typescript
interface StageGroupDefinition {
  id: string;
  name: string;
  stageType: string;                 // designer label, e.g. "move"
  parentGroupId?: string;            // nesting
  order: number;
}

interface StageDefinition {
  id: string;
  name: string;
  stageType: string;                 // designer label, e.g. "phase", "round", "orientation"
  stageGroupId?: string;
  order?: number;
  description?: string;
  instructionsContentId?: string;
  durationSeconds?: number;
  timerMode?: "countdown" | "countup" | "none";
  allowedActivityIds: string[];
  requiredArtifactTypeIds?: string[];
  visibleModuleIds?: string[];
  entryGate?: Gate;
  completionGate?: Gate;
  transitions: StageTransition[];
  onEnter?: AutomationAction[];
  onExit?: AutomationAction[];
  operatorControls: OperatorControlDefinition;
}

interface StageTransition {
  id: string;
  targetStageId: string;
  label?: string;
  gate?: Gate;
  mode: "automatic" | "manual" | "automatic_or_manual";
  priority?: number;
}

interface OperatorControlDefinition {
  allowStart: boolean;
  allowEnd: boolean;
  allowReopen: boolean;
  allowExtend: boolean;
  allowSkip: boolean;
  allowReturnToPrevious: boolean;
  requireReason: boolean;            // REQ-025 requires true for all overrides; field kept for display
}
```

Permitted Stage structures (parallel, conditional, continuous) are OPEN-005; until resolved, validators accept sequential and nested sequential structures only.

## 9. Activities, artifacts and forms

```typescript
interface ActivityDefinition {
  id: string;
  name: string;
  type: "read" | "discuss" | "submit" | "review" | "communicate" | "adjudicate" | "observe" | "custom";
  instructions?: string;
  artifactTypeId?: string;
  allowedSessionRoleIds?: string[];
  allowedTeamIds?: string[];
  completionTracking: "none" | "individual" | "team" | "session";
}

interface ArtifactTypeDefinition {
  id: string;
  key: string;                       // stable key used in runtime records
  name: string;
  description?: string;
  formId: string;
  workflowId: string;
  ownership: "individual" | "team" | "session";
  decisionBearing: boolean;          // DEC-35
  actionFormId?: string;             // schema for Actions inside a Decision Record (OPEN-018)
  versioning: "none" | "draft_versions" | "full_history";
  informationPolicyId: string;
  allowedCreatorSessionRoleIds: string[];
  allowedRecipientTypes?: Array<"participant" | "session_role" | "team" | "control" | "public">;
  retentionPolicyId?: string;
  exportable: boolean;
}

interface FormDefinition {
  id: string;
  name: string;
  formVersion: string;               // each submitted Artifact references this (REQ-028)
  description?: string;
  sections: FormSection[];
  validationRules?: ValidationRule[];
  uiOptions?: FormUiOptions;
}

interface FormSection {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
  informationPolicyId?: string;
  repeatable?: boolean;
  minItems?: number;
  maxItems?: number;
}

interface FormField {
  id: string;
  key: string;
  label: string;
  type:
    | "short_text" | "long_text" | "rich_text" | "number" | "currency" | "percentage"
    | "date" | "datetime" | "single_select" | "multi_select" | "ranking" | "scale" | "matrix"
    | "team_selector" | "session_role_selector" | "resource_selector" | "relationship_selector"
    | "file" | "citation" | "repeatable_group";
  helpText?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: SelectOption[];
  validation?: FieldValidation;
  informationPolicyId?: string;
  editability?: EditabilityRule;
  computedValue?: ExpressionDefinition;
  dataClassification?: DataClassification;
  reportingLabel?: string;
}

interface SelectOption { value: string; label: string; description?: string; }

interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;                  // restricted regular-expression subset
  minSelections?: number;
  maxSelections?: number;
  allowedFileTypes?: string[];
  maxFileBytes?: number;
  message?: string;
}

interface ValidationRule {
  id: string;
  gate: Gate;                        // must evaluate true for the form to be valid
  message: string;
  severity: "error" | "warning";
}

interface EditabilityRule {
  editableBySessionRoleIds?: string[];
  editableInWorkflowStates?: string[];
  lockedAfterSubmission?: boolean;
}

interface FormUiOptions {
  layout: "single_column" | "two_column" | "wizard";
  showSectionNumbers?: boolean;
  submitLabel?: string;
}

type DataClassification = "public" | "internal" | "confidential" | "restricted"; // extensions OPEN-024
```

Field-type limits, nesting depth and attachment rules are OPEN-010.

## 10. Workflows

```typescript
interface WorkflowDefinition {
  id: string;
  key: string;
  name: string;
  initialState: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

interface WorkflowState {
  key: string;                       // lower snake_case, e.g. "in_review"
  label: string;
  kind: "draft" | "task" | "review" | "approval" | "wait" | "terminal" | "cancelled";
  holderSessionRoleIds?: string[];   // who currently "has" the artifact
  holderRelation?: "creator";        // the creating Participant holds it (not every Participant in the role)
  assignment?: AssignmentRule;
  dueAfterSeconds?: number;
  quorum?: QuorumDefinition;
  automation?: AutomationAction[];
}

interface WorkflowTransition {
  id: string;
  from: string | null;               // null = creation
  command: string;                   // e.g. "artifact.submit" (DEC-38)
  to: string;
  allowedSessionRoleIds: string[];
  gate?: Gate;
  notifySessionRoleIds?: string[];
  notifyCreator?: boolean;           // notify the creating Participant only
  actions?: AutomationAction[];
  contentOnly?: boolean;             // true = edit without state change
}

interface AssignmentRule {
  mode: "specific_participant" | "session_role" | "team_session_role" | "control_group" | "first_available" | "all_eligible";
  sessionRoleIds?: string[];
  teamSelector?: "creator_team" | "any" | { teamIds: string[] };
}

interface QuorumDefinition {
  rule: "any_one" | "majority" | "quorum" | "unanimous" | "lead_after_peers";
  minimumApprovals?: number;
  leadSessionRoleId?: string;
}

interface AutomationAction {
  type: "notify" | "release_inject" | "unlock_stage" | "apply_effect" | "request_adjudication" | "start_timer" | "custom";
  target?: string;
  parameters?: Record<string, unknown>;
}
```

Validation rejects workflows with no initial state, no terminal state, unreachable states, unassigned task states, conflicting transitions (same `from` and `command` for the same role), and approvals with no eligible approver. Expressiveness beyond this is OPEN-006.

### 10.1 Reference workflow (DEC-42)

```json
{
  "id": "wf-request",
  "key": "request_review",
  "name": "Request review",
  "initialState": "draft",
  "states": [
    { "key": "draft", "label": "Draft", "kind": "draft", "holderRelation": "creator" },
    { "key": "submitted", "label": "With Facilitator", "kind": "review", "holderSessionRoleIds": ["facilitator"] },
    { "key": "in_review", "label": "With White Cell", "kind": "review", "holderSessionRoleIds": ["white_cell"] },
    { "key": "returned", "label": "Returned", "kind": "draft", "holderRelation": "creator" },
    { "key": "accepted", "label": "Accepted", "kind": "terminal" }
  ],
  "transitions": [
    { "id": "t1", "from": null, "command": "artifact.create", "to": "draft", "allowedSessionRoleIds": ["scribe"] },
    { "id": "t2", "from": "draft", "command": "artifact.edit", "to": "draft", "allowedSessionRoleIds": ["scribe"], "contentOnly": true },
    { "id": "t3", "from": "draft", "command": "artifact.submit", "to": "submitted", "allowedSessionRoleIds": ["scribe"], "notifySessionRoleIds": ["facilitator"] },
    { "id": "t4", "from": "submitted", "command": "artifact.forward", "to": "in_review", "allowedSessionRoleIds": ["facilitator"], "notifySessionRoleIds": ["white_cell"] },
    { "id": "t5", "from": "submitted", "command": "artifact.return", "to": "returned", "allowedSessionRoleIds": ["facilitator"], "notifyCreator": true },
    { "id": "t6", "from": "in_review", "command": "artifact.accept", "to": "accepted", "allowedSessionRoleIds": ["white_cell"], "notifySessionRoleIds": ["facilitator"], "notifyCreator": true },
    { "id": "t7", "from": "in_review", "command": "artifact.return", "to": "returned", "allowedSessionRoleIds": ["white_cell"], "notifySessionRoleIds": ["facilitator"], "notifyCreator": true },
    { "id": "t8", "from": "returned", "command": "artifact.edit", "to": "returned", "allowedSessionRoleIds": ["scribe"], "contentOnly": true },
    { "id": "t9", "from": "returned", "command": "artifact.submit", "to": "submitted", "allowedSessionRoleIds": ["scribe"], "notifySessionRoleIds": ["facilitator"] }
  ]
}
```

Role IDs here (`scribe`, `facilitator`, `white_cell`) are Fractured Order Release data. The executable copy of this workflow is `plenum_runtime_slice/definitions/fractured-order-reference.json`.

## 11. Gates and expressions

```typescript
interface Gate {
  operator: "all" | "any" | "none";
  conditions: Array<Condition | Gate>;
}

interface Condition {
  fact: FactReference;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "greater_or_equal" | "less_or_equal"
          | "contains" | "exists" | "in" | "not_in";
  value?: unknown;
  compareTo?: FactReference;
}

/** Facts are read-only, typed paths in a fixed namespace. Unknown paths fail validation. */
type FactReference =
  | `session.status` | `session.stage.id` | `session.stage.elapsedSeconds`
  | `stage.${string}.status`
  | `artifact.status` | `artifact.field.${string}` | `artifact.typeKey`
  | `artifacts.count.${string}.${string}`           // artifacts.count.<typeKey>.<state>
  | `teams.submittedCount.${string}`                // teams that submitted <typeKey>
  | `state.${string}` | `state.${string}.team.${string}`
  | `resource.${string}.balance` | `capability.${string}.status`
  | `inject.${string}.status`
  | `actor.sessionRoleId` | `actor.teamId`
  | `time.simulation` | `time.wallClock`;

interface ExpressionDefinition {
  /** Bounded arithmetic over facts and constants: + - * / min max round, no loops, no I/O. */
  expression: string;
  resultType: "number" | "text" | "boolean";
}
```

The policy engine evaluates Gates server-side and never executes authored text as code.

## 12. Information Policy

Default deny (DEC-10). A record or field is visible only if a policy grants it.

```typescript
interface InformationPolicy {
  id: string;
  name: string;
  grants: InformationGrant[];
  classification?: DataClassification;
}

interface InformationGrant {
  audience: ActorSelector;
  release?: {
    mode: "immediate" | "at_stage" | "after_seconds" | "on_gate" | "manual";
    stageId?: string;
    offsetSeconds?: number;
    gate?: Gate;
  };
  expiresAtStageId?: string;
  fieldsExcluded?: string[];
}

interface ActorSelector {
  sessionRoleIds?: string[];
  teamIds?: string[];
  seatIds?: string[];
  relation?: "creator" | "creator_team" | "current_holder" | "recipients";
  includeControlRoles?: boolean;
  public?: boolean;                  // all Participants in the Session
}
```

Selectors combine as OR across listed fields; an empty selector grants nothing.

## 13. Communication, polls, voice, Injects, state, capabilities and resources

### 13.1 Messages, Injects, state, capabilities and resources

```typescript
interface CommunicationDefinition {
  messageChannels: MessageChannel[];   // DEC-51; formerly `channels`
  routes: CommunicationRoute[];
  voiceChannels: VoiceChannelDefinition[]; // §13.3
  retentionPolicyId?: string;
}

interface MessageChannel {
  id: string;
  name: string;
  type: "direct_message" | "team_message" | "proposal" | "request_for_information" | "broadcast" | "public_statement" | "custom";
  structuredArtifactTypeId?: string;
  supportsAttachments: boolean;
  supportsThreading: boolean;
}

interface CommunicationRoute {
  id: string;
  channelId: string;
  sender: ActorSelector;
  recipient: ActorSelector;
  approvalWorkflowId?: string;
  informationPolicyId?: string;
  activeStageIds?: string[];
}

interface InjectDefinition {
  id: string;
  title: string;
  contentId: string;
  senderIdentity?: string;
  recipients: ActorSelector;
  releaseMode: "manual" | "scheduled" | "stage_entry" | "stage_exit" | "gate";
  scheduledOffsetSeconds?: number;
  stageId?: string;
  releaseGate?: Gate;
  requiredResponseArtifactTypeId?: string;
  responseDeadlineSeconds?: number;
  effects?: StateEffect[];
  followOnInjectIds?: string[];
  controlNotesContentId?: string;
}

interface StateVariableDefinition {
  id: string;
  name: string;
  description?: string;
  scope: "global" | "team" | "relationship" | "location" | "sector" | "asset" | "session_role";
  type: "integer" | "decimal" | "boolean" | "text" | "enum";
  minimum?: number;
  maximum?: number;
  unit?: string;
  options?: SelectOption[];
  informationPolicyId: string;
  editableBySessionRoleIds?: string[];
  historyMode: "full" | "final_only";
  display?: "number" | "progress_bar" | "gauge" | "trend" | "status_label" | "hidden";
}

interface InitialStateValue {
  stateVariableId: string;
  scopeReference?: string;           // e.g. team ID for team-scoped variables
  value: number | string | boolean;
}

interface StateEffect {
  stateVariableId: string;
  scopeReference?: string;
  operation: "set" | "increment" | "decrement" | "multiply";
  value: number | string | boolean;
  delaySeconds?: number;             // delayed effects: scheduling rules OPEN-018
  rationale?: string;
}

interface CapabilityDefinition {
  id: string;
  name: string;
  ownerTeamId?: string;
  states: Array<"available" | "ready" | "committed" | "degraded" | "exhausted" | "recovering" | "unavailable">;
  initialState: string;
  activationGate?: Gate;
  degradationEffects?: StateEffect[];
  recoverySeconds?: number;
  costs?: ResourceAllocation[];
  informationPolicyId: string;
}

interface ResourceDefinition {
  id: string;
  name: string;
  unit: string;
  ownership: "team" | "global";
  replenishment?: { everyStageType?: string; amount: number };
  informationPolicyId: string;
}

interface ResourceAllocation {
  resourceId: string;
  amount: number;
}
```

Capability and Resource changes are recorded as transactions (§16), never as direct field edits.

### 13.2 Polls — DEC-46

Behavior is owned by 11 Live Polling and Voting.

```typescript
interface PollDefinition {
  id: string;
  scope: "session" | "team" | "stage";
  scopeReference?: string;
  question: string;
  options: Array<{ id: string; label: string }>;   // stable IDs, immutable once open
  pollType: "single_choice" | "multiple_choice" | "yes_no_abstain" | "opinion";
  minSelections?: number;
  maxSelections?: number;
  tallyMethod: "builtin_count" | "voting_method_adapter";
  votingMethodAdapterBindingId?: string;           // Platform Adapter, DEC-59
  tallyMethodVersion: string;
  electoratePolicyId: string;                      // Information Policy selector
  oneBallotPer: "seat_assignment";
  allowRevote: boolean;
  finalBallotRule?: "latest_accepted";
  secrecy: "open" | "secret_ballot" | "anonymous_survey";
  thresholdRule: { kind: "simple_majority" | "supermajority" | "unanimity" | "plurality" | "none";
                   fraction?: number; denominator: "valid_votes" | "votes_cast" | "electorate";
                   abstentionCountsTowardDenominator: boolean };
  quorumRule?: { basis: "electorate_at_open" | "custom_snapshot"; minimum: number;
                 abstentionCountsTowardParticipation: boolean };
  weights?: Array<{ seatId: string; weight: number }>;
  vetoRule?: { holderSeatIds: string[] };
  tieRule: "no_decision" | "chair_decides" | "reissue";
  openTrigger: { mode: "manual" | "scheduled" | "stage_entry" | "gate"; stageId?: string; offsetSeconds?: number; gate?: Gate };
  closeTrigger: { mode: "manual" | "scheduled" | "stage_exit" | "gate"; stageId?: string; offsetSeconds?: number; gate?: Gate };
  deadlinePolicy: { graceSeconds: number };        // default 0: no late Ballots
  resultVisibilityPolicyId: string;
  certificationPolicy: { certifierSessionRoleIds?: string[]; certifierOrganizationRoles?: Array<"Admin" | "Operator"> };
  onCertifiedWorkflowId?: string;
  retentionPolicyId?: string;
}
```

### 13.3 Voice Channels — DEC-47

Behavior is owned by 12 Voice and Radio.

```typescript
interface VoiceChannelDefinition {
  id: string;
  name: string;
  mode: "radio_ptt" | "open_room" | "private_call" | "broadcast";
  capacity: number;
  activeStageIds?: string[];
  language?: string;
  priorityPolicy?: Array<{ sessionRoleId: string; priority: number }>;
  canListen: ActorSelector;
  canTransmit: ActorSelector;
  canModerate: ActorSelector;
  canInvite?: ActorSelector;                       // private_call only
  radio?: { floorLeaseMs: number; queuePolicy: "fifo" | "priority";
            preemption: "none" | "authorized_emergency"; maxTransmissionMs: number; cooldownMs: number };
  recordingPolicy: "off" | "on" | "with_consent";  // default off
  transcriptionPolicy: "off" | "with_consent";     // DEC-50; default off
  retentionPolicyId?: string;
}
```

## 14. Adjudication, plugins and reports

### 14.1 Adjudication and reports

```typescript
interface AdjudicationModelDefinition {
  id: string;
  name: string;
  doctrine: "structured_argument" | "expert_judgment" | "rules_based" | "model_supported" | "probability_based" | "hybrid"; // 08 Canon §8.1
  mechanism: "manual" | "rubric" | "rules" | "plugin" | "hybrid";
  appliesToArtifactTypeIds: string[];
  inputMappings: InputMapping[];
  rubric?: RubricDefinition;
  rules?: DecisionRule[];
  pluginBindingId?: string;
  perspectives?: Array<{ key: string; label: string; reviewerSessionRoleIds: string[] }>;
  reviewerSessionRoleIds: string[];
  finalApproverSessionRoleIds: string[];
  // Plugin and composition effects always need human approval (DEC-54); there is no switch.
  // Manual, rubric and rules mechanisms follow reviewerSessionRoleIds and finalApproverSessionRoleIds.
  outputFormId: string;
  effectMappings?: EffectMapping[];
  requireRationale: boolean;
  precedentMode: "none" | "advisory" | "binding";
}

interface InputMapping {
  target: string;                    // field in plugin or rubric input
  source: FactReference;
  maxClassification?: DataClassification;
}

interface RubricDefinition {
  criteria: Array<{
    key: string; name: string; description?: string; weight: number;
    scale: { min: number; max: number };
    anchors?: Record<string, string>;
    requiredEvidence?: string;
    reviewerSessionRoleIds?: string[];
  }>;
  bands?: Array<{ minScore: number; outcomeCategory: string }>;
}

interface DecisionRule {
  id: string;
  gate: Gate;
  suggestOutcomeCategory: string;
  explanation: string;
}

interface EffectMapping {
  outcomeCategory: string;
  effects: StateEffect[];
  releaseInjectIds?: string[];
}

interface ReportDefinition {
  id: string;
  name: string;
  audience: string;
  formats: Array<"html" | "pdf" | "csv" | "json" | "jsonl" | "parquet">;
  sections: ReportSection[];
  filters?: ReportFilter[];
  anonymizationProfileId?: string;
  availableToSessionRoleIds?: string[];
  availableToOrganizationRoles?: Array<"Admin" | "Designer" | "Publisher" | "Operator" | "Reviewer" | "Research Analyst">;
}

interface ReportSection {
  id: string;
  title: string;
  kind: "narrative" | "table" | "chart" | "timeline" | "metric";
  source: "evidence" | "artifacts" | "adjudications" | "state" | "measurements" | "observations";
  query: Record<string, unknown>;    // declarative selector; no executable code
  labelAs: "captured_history" | "reconstructed_narrative" | "derived";  // REQ-061
}

interface ReportFilter {
  field: string;
  operator: "equals" | "in" | "between";
  value: unknown;
}

interface ResearchQuestionDefinition {
  id: string;
  question: string;
  decisionTrace: DecisionTraceRow[];  // REQ-019
}

interface DecisionTraceRow {
  artifactTypeId: string;
  ownerSessionRoleId: string;
  trigger: string;
  informationRequirements: string[];
  constraints?: string[];
  availableActions?: string[];
  resourceIds?: string[];
  intendedEffects?: string[];
  unintendedEffects?: string[];
  adjudicationModelId?: string;
  stateVariableIds?: string[];
  measurementIds: string[];
  analyticalPurpose: string;
}

interface MeasurementDefinition {
  id: string;
  version: string;
  researchQuestionId?: string;
  name: string;
  definition: string;
  formula: ExpressionDefinition;
  sourceFields: string[];
  aggregationLevel: "participant" | "team" | "session_role" | "session";
  timeWindow?: string;
  missingDataBehavior: "exclude" | "zero" | "flag";
  interpretation: string;
  misinterpretationRisk?: string;
  validationMethod?: string;
}
```

### 14.2 Plugins and Model Compositions — DEC-52 to DEC-60

Behavior is owned by 10 Extension Framework.

```typescript
interface PluginBinding {
  id: string;
  pluginId: string;
  pluginVersion: string;
  pluginDigest: string;              // pinned by digest, not version alone
  installationId: string;
  categories: string[];              // DEC-60 discovery metadata
  connectivity: "offline_capable" | "lan_required" | "external_required";
  configuration: Record<string, unknown>;   // non-secret; secrets stay in the Plugin Installation
  configurationDigest: string;
  inputMappings: InputMapping[];
  timeoutSeconds: number;
  enabledInProfiles: Array<"cloud" | "institutional" | "air_gapped">;
  localReplacementBindingId?: string;       // required for air_gapped if external_required (DEC-56)
}

interface ModelCompositionDefinition {
  id: string;
  version: string;
  trigger: { kind: "manual" | "workflow_event" | "stage_entry" | "stage_exit" | "adjudication_request"; reference?: string };
  nodes: Array<{
    id: string;
    kind: "model" | "transform" | "fan_out" | "join" | "approval_gate" | "output";
    bindingId?: string;              // model nodes
    transform?: string;              // allowlisted pure transform ID
    joinPolicy?: "wait_all" | "fail_on_any" | "allow_partial_with_approval";
    approverSelector?: ActorSelector; // approval_gate nodes
  }>;
  edges: Array<{ from: string; to: string; type: string; unit?: string;
                 classification?: DataClassification; required: boolean }>;
}
```

Every path from a node that emits Effect Proposals to state reaches an `approval_gate` (DEC-54). Cycles are invalid (DEC-55).

## 15. Interfaces, content, objectives, access and validation profile

```typescript
interface InterfaceProfile {
  id: string;
  name: string;
  selectors: { sessionRoleIds?: string[]; teamIds?: string[]; stageIds?: string[] };
  layout: { template: "single_column" | "main_sidebar" | "dashboard" | "workspace"; regions: LayoutRegion[] };
  navigation: NavigationDefinition;
  labels?: Record<string, string>;
  readOnly?: boolean;                // required for Display Principals
}

interface LayoutRegion {
  id: string;
  width?: "narrow" | "medium" | "wide" | "full";
  modules: ModuleInstance[];
}

interface ModuleInstance {
  id: string;
  moduleType: string;                // from the platform module registry
  title?: string;
  configuration: Record<string, unknown>;
  informationPolicyId?: string;
}

interface NavigationDefinition {
  items: Array<{ id: string; label: string; target: { moduleId?: string; regionId?: string }; order: number }>;
  defaultItemId?: string;
}

interface ContentDefinition {
  id: string;
  title: string;
  type: "rich_text" | "document" | "image" | "audio" | "video" | "link" | "dataset";
  body?: string;
  assetId?: string;
  informationPolicyId: string;
  variantOf?: string;                // team or control variant
  tags?: string[];
  version: string;
}

interface ObjectiveDefinition {
  id: string;
  title: string;
  description?: string;
  attachTo: { teamId?: string; sessionRoleId?: string; scenario?: boolean }; // OPEN-018
  informationPolicyId: string;
  measurementIds?: string[];
  priority?: number;
}

interface AccessPolicyDefinition {
  joinMethods: Array<"invitation" | "code_and_verified_email" | "sso" | "code_and_guest_pin" | "waiting_room" | "open_seat_selection" | "operator_assignment">;
  guests: { allowed: boolean; requiredFields: string[]; expiryHours: number; includeInResearchExports: boolean; operatorApproval: boolean };
  displays: Array<{ interfaceProfileId: string; classificationCeiling: DataClassification }>;
  reassignment: { allowedBy: "operator" | "operator_with_approval"; crossTeamAllowed: boolean; exposureAcknowledgementRequired: boolean };
  readiness: Array<{ key: string; label: string; sessionRoleIds?: string[]; blocking: boolean }>;
}

interface ValidationProfile {
  level: "standard" | "strict";
  requireTestSession: boolean;       // organization policy may force true (DEC-39)
  suppressedWarnings?: string[];     // never suppresses errors
}
```

## 16. Runtime record mapping

Runtime records are not part of a Release. Their storage is owned by the PostgreSQL Logical Data Model and their contracts by 09. Every runtime record carries `organizationId`, `sessionId` and, where applicable, `governingReleaseId`.

| Runtime entity | Key fields | Defined by |
|---|---|---|
| Participant, Seat Assignment | principal, seat, session role, team, valid-from, valid-to | Data Model |
| Artifact | type key, Form version, Governing Release, state, payload, version, creator | Data Model |
| Decision Record and Action | Artifact with `decisionBearing`; Actions as child records | Data Model; OPEN-018 |
| Workflow Instance | definition key, Governing Release, current state, version | Data Model |
| Information object and delivery | content or record ID; delivered-to, opened-at, acknowledged-at | Data Model |
| Inject Instance | definition ID, state, per-recipient acknowledgement and response | Data Model |
| State Value, State Snapshot | variable, scope, value; snapshot set at Evidence Sequence | Data Model |
| Capability Instance, Resource Transaction | capability state; resource debit or credit with source | Data Model |
| Objective Status | objective, status, evidence | Data Model |
| Adjudication Request, Adjudication Record, Outcome, Effect | §14 contract; origin human or plugin | Data Model; 05 |
| Control Intervention | authority, reason, category, before and after | Data Model; 08 Canon §7 |
| Measurement Value, Observation, Analytical Note, Finding | 08 Canon §10 | Data Model |
| Model and plugin version record, Randomization record | plugin ID and version, seed | Data Model |
| Command Receipt, Evidence Event | DEC-37, DEC-43 | Data Model; 09 |
| Poll, Electorate member, Ballot, Ballot receipt, Tally, Certification | 11 §5 | Data Model §4.7 |
| Voice Channel, voice grant, Floor Lease, floor request, Consent Record, media event, recording asset | 12 §4 | Data Model §4.8 |
| Composition Run, Model Run, Effect Proposal, Approval Decision, effect receipt | 10 §11 | Data Model §4.9 |

## 17. Validation requirements

The validator detects at least: duplicate identifiers; missing references; invalid Team or Session Role references; disabled Methodology Concepts referenced by enabled elements; unreachable Stages; Stages with no exit; circular automatic transitions; workflow defects listed in §10; Forms referenced by no Artifact Type; Artifact Types missing a workflow; Injects with impossible Gates; Interface modules inaccessible to their Session Roles; State Effects referencing missing State Variables; Communication Routes with no valid recipient; Polls with undefined denominators, tie rules or Electorate policy; Voice Channels with impossible states, missing policy references or a mode the installed Media Provider Adapter cannot support; Model Compositions with cycles, type or unit mismatches, missing inputs, illegal fan-in, classification leaks, duplicate effect targets or any effect path without an approval gate; Reports referencing unavailable data; capability grants that contradict workflow permissions; Information Policy leakage; unknown Fact References; decision-bearing Artifact Types missing from the traceability matrix; Plugin Bindings disabled in every profile the Release targets; `external_required` Plugin Bindings in an air-gapped target without a verified local replacement.

## 18. Versioning rules

1. Every Simulation Release has a semantic version and a content digest; Releases and Definition Revisions are immutable (INV-012).
2. Drafts are mutable; collaborative merges never alter a Definition Revision or Release.
3. A Session pins its initial Release and records every Release Activation (INV-005).
4. Every Artifact references its Form version; every Workflow Instance pins its Governing Release (INV-021).
5. Storage migrations may transform representation but must preserve the meaning of historical records (INV-006).
6. Change classification for live activation follows 08 Canon §9 and ADR-004.
7. Schema and compiler backward-compatibility rules are OPEN-012.

## 19. Offline projection boundary

Offline Participant bundles are runtime-generated, policy-filtered projections — never a complete exported Release. Each bundle declares its Governing Release, projection revision, permitted scope, expiry and integrity digest. Publication does not imply permission to download all simulation content (REQ-008).

## 20. Minimal example

```json
{
  "manifest": {
    "schemaVersion": "1.3.0",
    "releaseId": "rel-example",
    "projectId": "proj-example",
    "definitionRevisionId": "rev-example",
    "releaseLabel": "Regional Finance Crisis 1.0",
    "semanticVersion": "1.0.0",
    "methodologyVersion": "1.0",
    "compilerVersion": "1.0.0",
    "contentDigest": "0000000000000000000000000000000000000000000000000000000000000000",
    "publishedBy": "person-1",
    "approvedBy": ["person-2"],
    "publishedAt": "2026-10-17T00:00:00Z",
    "releaseNotes": "Initial release.",
    "validationReportId": "val-1"
  },
  "coreDesign": {
    "methodology": { "methodologyVersion": "1.0", "enabledConcepts": ["stage", "session_role", "seat", "artifact_type", "workflow", "information_policy", "evidence", "control_intervention"] },
    "terminology": { "labels": {}, "customLabels": {} },
    "teams": [],
    "sessionRoles": [],
    "seats": [],
    "stageGroups": [],
    "stages": [],
    "activities": [],
    "artifactTypes": [],
    "forms": [],
    "workflows": [],
    "informationPolicies": [],
    "communications": { "messageChannels": [], "routes": [], "voiceChannels": [] },
    "polls": [],
    "stateVariables": [],
    "capabilities": [],
    "resources": [],
    "adjudicationModels": [],
    "interfaces": [],
    "reports": [],
    "researchQuestions": [],
    "measurements": [],
    "pluginBindings": [],
    "compositions": [],
    "accessPolicy": {
      "joinMethods": ["invitation"],
      "guests": { "allowed": false, "requiredFields": [], "expiryHours": 0, "includeInResearchExports": false, "operatorApproval": true },
      "displays": [],
      "reassignment": { "allowedBy": "operator", "crossTeamAllowed": false, "exposureAcknowledgementRequired": true },
      "readiness": []
    },
    "validationProfile": { "level": "standard", "requireTestSession": false }
  },
  "scenario": {
    "id": "scn-example",
    "name": "Regional Finance Crisis",
    "description": "A three-round policy negotiation simulation.",
    "deliveryModes": ["in_person", "virtual"],
    "content": [],
    "injects": [],
    "initialState": [],
    "objectives": [],
    "tags": ["finance", "negotiation"]
  }
}
```

## 21. Open questions

OPEN-004 (concept activation), OPEN-005 (Stage structures), OPEN-006 (workflow expressiveness), OPEN-010 (form constraints), OPEN-012 (compatibility), OPEN-018 (modeling questions), OPEN-024 (classification), OPEN-028 (secret ballots). OPEN-021 is resolved by DEC-59 and DEC-60.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.3.2 | 2026-10-21 | Added Reviewer and Research Analyst to the Organization Role vocabulary under DEC-61. Runtime validation support remains a separate implementation change. |
| 1.3.1 | 2026-10-17 | Added `PollDefinition` (§13.2), `VoiceChannelDefinition` (§13.3), `ModelCompositionDefinition` and a digest-pinned `PluginBinding` (§14.2); renamed `CommunicationChannel` to `MessageChannel` and `channels` to `messageChannels` (DEC-51); removed `requireHumanApproval` (DEC-54); added validator rules and runtime mappings. |
| 1.3.0 | 2026-10-17 | Split Core Design, Scenario and manifest (DEC-31); replaced phases with Stages and Stage Groups (DEC-33); replaced `RoleDefinition` with `SessionRoleDefinition` and removed platform scope (DEC-44); added capability catalog; defined previously undefined types (ActorSelector, AssignmentRule, QuorumDefinition, FactReference, ExpressionDefinition, FieldValidation, ValidationRule, EditabilityRule, FormUiOptions, NavigationDefinition, ReportSection, ReportFilter, InputMapping, RubricDefinition, DecisionRule, EffectMapping, OperatorControlDefinition, ResourceAllocation, PluginBinding, ValidationProfile, AccessPolicyDefinition and others); replaced VisibilityRule with default-deny Information Policy; added decision-bearing artifacts, capabilities, resources, research and measurement types; added DEC-42 reference workflow; merged v1.2 addendum. |
| 1.2.0 | 2026-10-17 | Reconciliation addendum (archived). Header incorrectly read 1.1.0. |
