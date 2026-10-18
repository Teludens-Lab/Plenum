# Canonical Simulation Definition Schema

## Document Control

- **Document ID:** CDM
- **Version:** 1.1.0
- **Status:** Draft for review
- **Owner:** Plenum product owner
- **Approvers:** Product owner; simulation-methodology lead; technical lead
- **Reads from:** PRD; Simulation Design and Research Canon; Platform Architecture
- **Read by:** API, event, workflow, database, frontend, analytics, and testing specifications
- **Authority:** Defines canonical vocabulary, entities, value objects, relationships, invariants, schemas, and versioning rules.
- **Out of scope:** Decisions explicitly governed by another document in the specification hierarchy.

## 1. Purpose

The Canonical Simulation Definition is the authoritative design-time representation of a Plenum simulation. It captures the structure, behavior, content, permissions, interfaces, and reporting requirements required by the runtime.

Designers interact with this definition through frontend forms and visual tools. They should not need to edit JSON directly.

## 2. Design Requirements

The schema must be:

- Versioned
- Portable
- Validatable
- Human-readable when exported
- Independent of a specific simulation
- Backward-compatible within declared version ranges
- Referenced by immutable published versions
- Capable of representing Fractured Order without source-code assumptions

## 3. Top-Level Definition

```typescript
interface SimulationDefinition {
  schemaVersion: string;
  simulation: SimulationMetadata;
  terminology: TerminologyDefinition;
  teams: TeamDefinition[];
  roles: RoleDefinition[];
  seats: SeatDefinition[];
  phases: PhaseDefinition[];
  activities: ActivityDefinition[];
  artifactTypes: ArtifactTypeDefinition[];
  forms: FormDefinition[];
  workflows: WorkflowDefinition[];
  communications: CommunicationDefinition;
  injects: InjectDefinition[];
  variables: VariableDefinition[];
  adjudicationModels: AdjudicationModelDefinition[];
  interfaces: InterfaceDefinition[];
  content: ContentDefinition[];
  reports: ReportDefinition[];
  plugins: PluginBinding[];
  policies: PolicyDefinition[];
  validationProfile: ValidationProfile;
}
```

## 4. Simulation Metadata

```typescript
interface SimulationMetadata {
  id: string;
  name: string;
  slug: string;
  version: string;
  status: "draft" | "review" | "published" | "archived";
  description: string;
  purpose?: string;
  learningObjectives?: string[];
  researchQuestions?: string[];
  audience?: string[];
  estimatedDurationMinutes?: number;
  deliveryModes: Array<"in_person" | "virtual" | "hybrid" | "asynchronous">;
  ownerOrganizationId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  themeId?: string;
}
```

## 5. Terminology

Terminology allows simulations to rename common platform concepts without changing their behavior.

```typescript
interface TerminologyDefinition {
  teamSingular: string;
  teamPlural: string;
  phaseSingular: string;
  phasePlural: string;
  actionSingular: string;
  actionPlural: string;
  facilitatorLabel: string;
  adjudicatorLabel: string;
  customLabels: Record<string, string>;
}
```

## 6. Team Definition

```typescript
interface TeamDefinition {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  publicBrief?: string;
  privateBriefContentId?: string;
  colorToken?: string;
  iconAssetId?: string;
  objectives: ObjectiveDefinition[];
  startingResources?: ResourceAllocation[];
  relationshipIds?: string[];
  tags?: string[];
  minParticipants?: number;
  maxParticipants?: number;
  enabled: boolean;
}
```

```typescript
interface ObjectiveDefinition {
  id: string;
  title: string;
  description?: string;
  visibility: VisibilityRule;
  successMetricIds?: string[];
  priority?: number;
}
```

## 7. Roles and Seats

```typescript
interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  scope: "platform" | "simulation" | "session" | "team";
  permissions: string[];
  interfaceProfileId?: string;
  allowedTeamIds?: string[];
  phaseRestrictions?: string[];
  contentVisibilityTags?: string[];
  enabled: boolean;
}
```

```typescript
interface SeatDefinition {
  id: string;
  name: string;
  teamId?: string;
  roleIds: string[];
  minOccupancy: number;
  maxOccupancy: number;
  required: boolean;
  joinMode: "open" | "code" | "assigned" | "operator_assigned";
}
```

## 8. Phase Definition

```typescript
interface PhaseDefinition {
  id: string;
  name: string;
  description?: string;
  type: "lobby" | "orientation" | "deliberation" | "submission" | "adjudication" | "outcome" | "debrief" | "custom";
  order?: number;
  instructionsContentId?: string;
  durationSeconds?: number;
  timerMode?: "countdown" | "countup" | "none";
  allowedActivityIds: string[];
  requiredArtifactTypeIds?: string[];
  visibleModuleIds?: string[];
  entryConditions?: ConditionGroup;
  completionConditions?: ConditionGroup;
  transitions: PhaseTransition[];
  onEnterActions?: AutomationAction[];
  onExitActions?: AutomationAction[];
  operatorControls: OperatorControlDefinition;
}
```

```typescript
interface PhaseTransition {
  id: string;
  targetPhaseId: string;
  label?: string;
  conditions?: ConditionGroup;
  mode: "automatic" | "manual" | "automatic_or_manual";
  priority?: number;
}
```

## 9. Activities

```typescript
interface ActivityDefinition {
  id: string;
  name: string;
  type: "read" | "discuss" | "submit" | "review" | "communicate" | "adjudicate" | "observe" | "custom";
  instructions?: string;
  artifactTypeId?: string;
  allowedRoleIds?: string[];
  allowedTeamIds?: string[];
  completionTracking: "none" | "individual" | "team" | "session";
}
```

## 10. Artifact Types

```typescript
interface ArtifactTypeDefinition {
  id: string;
  name: string;
  description?: string;
  formId: string;
  workflowId: string;
  ownership: "individual" | "team" | "session";
  versioning: "none" | "draft_versions" | "full_history";
  visibility: VisibilityRule;
  allowedCreatorRoleIds?: string[];
  allowedRecipientTypes?: Array<"participant" | "role" | "team" | "operator" | "public">;
  retentionPolicyId?: string;
  exportable: boolean;
}
```

## 11. Form Definition

```typescript
interface FormDefinition {
  id: string;
  name: string;
  schemaVersion: string;
  description?: string;
  sections: FormSection[];
  validationRules?: ValidationRule[];
  uiOptions?: FormUiOptions;
}
```

```typescript
interface FormSection {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
  visibility?: VisibilityRule;
  repeatable?: boolean;
  minItems?: number;
  maxItems?: number;
}
```

```typescript
interface FormField {
  id: string;
  key: string;
  label: string;
  type: "short_text" | "long_text" | "rich_text" | "number" | "currency" | "percentage" | "date" | "datetime" | "single_select" | "multi_select" | "ranking" | "scale" | "matrix" | "team_selector" | "role_selector" | "resource_selector" | "relationship_selector" | "file" | "citation" | "repeatable_group";
  helpText?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: SelectOption[];
  validation?: FieldValidation;
  visibility?: VisibilityRule;
  editability?: EditabilityRule;
  computedValue?: ExpressionDefinition;
  dataClassification?: "public" | "internal" | "confidential" | "restricted";
}
```

## 12. Workflow Definition

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  initialNodeId: string;
  nodes: WorkflowNode[];
  transitions: WorkflowTransition[];
  completionNodeIds: string[];
  cancellationNodeIds?: string[];
}
```

```typescript
interface WorkflowNode {
  id: string;
  name: string;
  type: "draft" | "human_task" | "automated_task" | "review" | "approval" | "publication" | "wait" | "complete" | "cancelled";
  assigneeRule?: AssignmentRule;
  dueAfterSeconds?: number;
  requiredActions?: string[];
  automation?: AutomationAction[];
  quorum?: QuorumDefinition;
}
```

```typescript
interface WorkflowTransition {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  trigger: string;
  conditions?: ConditionGroup;
  actions?: AutomationAction[];
}
```

## 13. Communication Definition

```typescript
interface CommunicationDefinition {
  channels: CommunicationChannel[];
  routes: CommunicationRoute[];
  retentionPolicyId?: string;
}
```

```typescript
interface CommunicationChannel {
  id: string;
  name: string;
  type: "direct_message" | "team_message" | "proposal" | "rfi" | "broadcast" | "public_statement" | "custom";
  structuredArtifactTypeId?: string;
  supportsAttachments: boolean;
  supportsThreading: boolean;
}
```

```typescript
interface CommunicationRoute {
  id: string;
  channelId: string;
  senderSelector: ActorSelector;
  recipientSelector: ActorSelector;
  approvalWorkflowId?: string;
  visibility: VisibilityRule;
  activePhaseIds?: string[];
}
```

## 14. Inject Definition

```typescript
interface InjectDefinition {
  id: string;
  title: string;
  contentId: string;
  senderIdentity?: string;
  recipients: ActorSelector;
  releaseMode: "manual" | "scheduled" | "phase_entry" | "phase_exit" | "condition";
  scheduledOffsetSeconds?: number;
  phaseId?: string;
  releaseConditions?: ConditionGroup;
  requiredResponseArtifactTypeId?: string;
  responseDeadlineSeconds?: number;
  effects?: StateEffect[];
  followOnInjectIds?: string[];
  facilitatorNotesContentId?: string;
}
```

## 15. Variable Definition

```typescript
interface VariableDefinition {
  id: string;
  name: string;
  description?: string;
  scope: "global" | "team" | "relationship" | "location" | "sector" | "asset" | "role";
  type: "integer" | "decimal" | "boolean" | "text" | "enum";
  initialValue: unknown;
  minimum?: number;
  maximum?: number;
  unit?: string;
  options?: SelectOption[];
  visibility: VisibilityRule;
  editableByRoleIds?: string[];
  historyMode: "full" | "final_only";
}
```

## 16. Adjudication Model

```typescript
interface AdjudicationModelDefinition {
  id: string;
  name: string;
  mode: "manual" | "rubric" | "rules" | "plugin";
  appliesToArtifactTypeIds: string[];
  inputMappings: InputMapping[];
  rubric?: RubricDefinition;
  rules?: DecisionRule[];
  pluginBindingId?: string;
  reviewerRoleIds: string[];
  finalApproverRoleIds: string[];
  outputSchema: FormDefinition;
  effectMappings?: EffectMapping[];
  requireRationale: boolean;
}
```

## 17. Interface Definition

```typescript
interface InterfaceDefinition {
  id: string;
  name: string;
  selectors: {
    roleIds?: string[];
    teamIds?: string[];
    phaseIds?: string[];
  };
  layout: LayoutDefinition;
  navigation: NavigationDefinition;
  labels?: Record<string, string>;
}
```

```typescript
interface LayoutDefinition {
  template: "single_column" | "main_sidebar" | "dashboard" | "workspace";
  regions: LayoutRegion[];
}
```

```typescript
interface LayoutRegion {
  id: string;
  width?: string;
  modules: ModuleInstance[];
}
```

```typescript
interface ModuleInstance {
  id: string;
  moduleType: string;
  title?: string;
  configuration: Record<string, unknown>;
  visibility?: VisibilityRule;
}
```

## 18. Content Definition

```typescript
interface ContentDefinition {
  id: string;
  title: string;
  type: "rich_text" | "document" | "image" | "audio" | "video" | "link" | "dataset";
  body?: string;
  assetId?: string;
  visibility: VisibilityRule;
  releaseConditions?: ConditionGroup;
  tags?: string[];
  version: string;
}
```

## 19. Report Definition

```typescript
interface ReportDefinition {
  id: string;
  name: string;
  audience: string;
  formats: Array<"html" | "pdf" | "csv" | "json" | "jsonl">;
  sections: ReportSection[];
  filters?: ReportFilter[];
  anonymizationProfileId?: string;
  availableToRoleIds?: string[];
}
```

## 20. Shared Rule Types

```typescript
interface ConditionGroup {
  operator: "all" | "any" | "none";
  conditions: Array<Condition | ConditionGroup>;
}
```

```typescript
interface Condition {
  fact: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "exists" | "in" | "not_in";
  value?: unknown;
  reference?: string;
}
```

```typescript
interface VisibilityRule {
  mode: "public" | "restricted";
  teamIds?: string[];
  roleIds?: string[];
  phaseIds?: string[];
  conditions?: ConditionGroup;
}
```

```typescript
interface AutomationAction {
  type: string;
  target?: string;
  parameters?: Record<string, unknown>;
}
```

```typescript
interface StateEffect {
  variableId: string;
  scopeReference?: string;
  operation: "set" | "increment" | "decrement" | "multiply";
  value: number | string | boolean;
  rationale?: string;
}
```

## 21. Validation Requirements

The schema validator must detect:

- Duplicate identifiers
- Missing references
- Invalid role or team references
- Unreachable phases
- Phases with no valid exit
- Circular automatic transitions
- Workflows without terminal states
- Forms referenced by no artifact type
- Artifacts with missing workflows
- Injects with impossible conditions
- Interface modules inaccessible to their target roles
- State effects referencing missing variables
- Communication routes with no valid recipient
- Reports referencing unavailable data
- Permission contradictions

## 22. Versioning Rules

- Every published definition has a semantic version.
- Published definitions are immutable.
- Drafts may be edited.
- Sessions reference one exact published version.
- Submitted artifacts reference one exact form schema version.
- Workflow instances reference one exact workflow definition version.
- Runtime migrations may transform storage, but must preserve the interpretation of historical records.

## 23. Minimal Example

```json
{
  "schemaVersion": "1.0.0",
  "simulation": {
    "id": "sim-example",
    "name": "Regional Finance Crisis",
    "slug": "regional-finance-crisis",
    "version": "1.0.0",
    "status": "published",
    "description": "A three-round policy negotiation simulation.",
    "deliveryModes": ["in_person", "virtual"],
    "ownerOrganizationId": "org-1",
    "createdBy": "user-1",
    "createdAt": "2026-08-05T00:00:00Z",
    "updatedAt": "2026-08-05T00:00:00Z",
    "tags": ["finance", "negotiation"]
  },
  "teams": [],
  "roles": [],
  "seats": [],
  "phases": [],
  "activities": [],
  "artifactTypes": [],
  "forms": [],
  "workflows": [],
  "communications": {"channels": [], "routes": []},
  "injects": [],
  "variables": [],
  "adjudicationModels": [],
  "interfaces": [],
  "content": [],
  "reports": [],
  "plugins": [],
  "policies": [],
  "validationProfile": {"level": "standard"}
}
```

## 24. Canonical Vocabulary and Distinctions

The platform must explicitly distinguish simulation template, scenario, scenario version, simulation run, phase, round, turn, role definition, participant, participant assignment, team definition, team instance, objective, decision, action, event definition, event instance, information object, information delivery, adjudication request, adjudication record, outcome, effect, state-variable definition, state value, state snapshot, capability definition, capability instance, resource definition, resource allocation, measurement definition, measurement value, observation, finding, and White Cell intervention.

No implementation contract may use a synonym that changes these meanings. Every API field, event field, workflow state, database table, and interface label must resolve to a canonical term or an explicitly mapped presentation label.

## 25. Additional Required Canonical Entities

The schema must include or explicitly map the following entities:

- `ResearchQuestion`
- `ObjectiveDefinition` and `ObjectiveStatus`
- `DecisionRecord` distinct from `ActionRecord`
- `InformationObject` distinct from `InformationDelivery`
- `CapabilityDefinition` and `CapabilityInstance`
- `ResourceDefinition`, `ResourceAllocation`, and `ResourceTransaction`
- `StateSnapshot`
- `AdjudicationRequest`, `AdjudicationRecord`, `OutcomeRecord`, and `EffectRecord`
- `WhiteCellIntervention`
- `MeasurementDefinition` and `MeasurementValue`
- `AnalyticalObservation`, `AnalyticalNote`, and `ResearchFinding`
- `ModelVersion` and `RandomizationRecord`

## 26. Required Modeling Decisions

Before schema approval, the design must resolve whether one decision may contain multiple actions; whether several roles may co-author a decision; whether submitted decisions may be revised; whether one adjudication may resolve multiple actions; whether one outcome may create multiple immediate or delayed effects; how delayed effects are scheduled and cancelled; whether snapshots are immutable; how capability consumption and degradation are recorded; how information access differs from information delivery; and how objectives attach to actors, roles, teams, scenarios, or runs.

## 27. Run Reproducibility Manifest

Every run must store a manifest referencing immutable versions of product configuration, scenario, role definitions, interface configuration, event definitions, rules, state-variable definitions, capability and resource definitions, measurement framework, adjudication guidance, model versions, imported content, and random seed. The manifest is part of every research export and replay request.



---

# Controlled architecture reconciliation addendum — v1.2 (2026-10-17)

**Status:** TARGET design alignment; not an approved change to SSG methodology. Preserve the original schema above.

## Scope and authority
The Canonical Simulation Definition represents portable *simulation behavior*, not device synchronization internals, database schema layout, or deployment secrets. Keep Studio's mutable collaborative draft, immutable Definition Revision, compiled Simulation Release, and Session as separate concepts. Publication freezes the validated definition, methodology/schema/compiler compatibility metadata and referenced assets; runtime mutation does not alter its Release.

## Live activation semantics
A Session references a release activation history. Runtime aggregates record their governing release/definition revision. Existing workflow instances stay pinned by default; new instances use the currently activated release. A proposed activation must classify semantic changes (safe prospective, compatibility-dependent, or blocking) and require authorized operator approval for consequential migrations and information-policy changes. Historical outcomes must never be reinterpreted by simply changing the session release pointer.

## Offline projection schema boundary
Offline participant bundles are runtime-generated authorization-filtered projections, not complete exported Simulation Releases. Each projection declares its governing release, projection revision, permitted scope, validity/expiry, and integrity digest. Publication does not imply permission to download all simulation content. Offline authoritative adjudication is excluded.

## Compatibility questions retained as open
Pin the machine-readable format for revisions/releases, define schema/compiler backward-compatibility rules, and obtain methodology-owner approval for the taxonomy of safe change classes. See `DECISION_APPROVAL_REGISTER.md`.
