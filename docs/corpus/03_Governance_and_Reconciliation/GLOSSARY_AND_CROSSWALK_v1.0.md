# Plenum Studio — Glossary and Terminology Crosswalk

## Document control

| Field | Value |
|---|---|
| Document ID | GLOSS |
| Version | 1.0.3 |
| Date | 2026-11-08 |
| Status | Controlled. Former assumption markers removed following owner confirmation on 2026-11-08; DEC-62–64 preserve amended decision history. |
| Owner | Product Owner |
| Approvers | Sethu Nguna as Product Owner, Methodology Lead and Technical Lead (resolved OPEN-001) |
| Governed by | `DECISION_REGISTER_v1.0.md`, chiefly DEC-30 to DEC-39, DEC-46 to DEC-61, DEC-63 and DEC-64 |
| Read by | Every Plenum document, API, event contract, database object and interface label |

## 1. Rules

1. Each concept has exactly one canonical term. Documents, API fields, event names, workflow states and database objects use that term.
2. Designers may relabel concepts for participants through a Terminology Profile (for example, showing "Move" for a Stage). A display label never changes the underlying concept or identifier.
3. Names defined inside a Simulation Release — team names, Session Role names such as Scribe, Facilitator or White Cell — are simulation data, not platform vocabulary. Platform code and platform documents must not depend on them.
4. Legacy terms (§9) may appear only in archived documents or in an explicit compatibility mapping. Persisted identifiers and historical event types are never renamed silently; a rename requires a documented migration.
5. A term that is not in this glossary must be added here before it appears in a contract.
6. "Session" alone always means a simulation Session. A login is an **Authentication Session**. "Decision" alone in a product document means a register entry (DEC-nn); inside a simulation it is always **Decision Record**.

## 2. Tenancy, identity and access

| Term | Definition | Notes |
|---|---|---|
| Organization | The tenant and top-level security boundary. Owns memberships, Simulation Projects, Simulation Releases, Sessions, plugins and exports. | There is no level between Organization and Simulation Project (DEC-36). |
| Person | A persistent human identity known to the platform. | Legacy: user, user account |
| Organization Membership | A Person's membership in an Organization, carrying one or more Organization Roles. | |
| Organization Role | Platform-defined authority inside an Organization: **Admin**, **Designer**, **Publisher**, **Operator**, **Reviewer**, **Research Analyst**. Fixed by the platform, never by a Simulation Release. | DEC-61 |
| Reviewer | An Organization Role limited to project-scoped methodology review, publication approval and approval of governed live changes. | DEC-61; legacy persona: Methodology Owner |
| Research Analyst | An Organization Role limited to policy-approved research evidence and exports within an assigned project or protocol scope. | DEC-61; legacy persona: research/evaluation analyst |
| Session Operator | A Person holding the Operator Organization Role who is assigned to operate a specific Session. | Persona label "Game Master" maps here |
| Guest Identity | A Session-limited principal with a display name, explicit Session and Seat scope, expiry and revocation state. Never becomes an Organization Membership. | |
| Display Principal | A non-human principal for shared read-only displays, limited to approved Interface Profiles and an information classification ceiling. | Legacy: device identity (Platform §23.6) |
| Device | A registered client installation bound to a Person or Display Principal. Revocable. | |
| Principal | Any authenticated actor: Person, Guest Identity, Display Principal or system service. | |
| Authentication Session | A login session issued by the identity service. Never authoritative for Session membership or permissions. | Legacy: "client session" (Platform §23.7) |
| Deployment | One installed instance of the Plenum application, with its own identity, in the cloud, institutional or air-gapped profile. | DEC-19 |

## 3. Design time

| Term | Definition | Notes |
|---|---|---|
| Simulation Project | The container for one simulation's design work: its Core Design, Scenarios, Draft, Definition Revisions and Simulation Releases. | DEC-31. Legacy: Simulation (design identity) |
| Core Design | The reusable methodological structure of a simulation: Team Definitions, Session Roles, Seats, Stages, Artifact Types, Forms, Workflow Definitions, Information Policies, Interface Profiles and Adjudication Models. Contains no exercise-specific content. | DEC-31 |
| Scenario | Exercise-specific content bound to a Core Design: briefs, inject content and schedules, initial State Values, scenario objectives and assets. | DEC-31 |
| Simulation Template | A Core Design published to the Organization library for reuse. Starting from it copies the Core Design; Scenario content is copied only when the designer chooses. | DEC-32; DEC-04 |
| Methodology Concept | A canonical SSG concept (for example Team, Stage, Adjudication) that a Core Design may enable or disable, subject to dependency rules. | DEC-01; OPEN-004 |
| Draft | The mutable, collaboratively edited working state of a Core Design and its Scenarios. | ADR-002 |
| Definition Revision | An immutable, hashed snapshot of a validated Draft. | |
| Simulation Release | The immutable, compiled, executable output of one Definition Revision, carrying compiler version, schema version and content digest. The only thing a Session can execute. | Legacy: Simulation Package, simulation version, published version, scenario version |
| Package | The portable file form of a Simulation Release, used for export and import (including air-gapped transfer). A Package carries a Release; it is not a separate identity. | OPEN-020 |
| Publication | The controlled process that turns a Definition Revision into a Simulation Release. Follows the Publication lifecycle (§7.1). | DEC-39 |
| Terminology Profile | Designer-set display labels for canonical concepts. | Rule 2 |

## 4. Structure (defined in a Core Design)

| Term | Definition | Notes |
|---|---|---|
| Team Definition | A designer-defined group of Participants with identity, objectives and resources. Not a fixed set of sides. | |
| Session Role | A Release-defined functional responsibility in a Session, with explicit capabilities and scope (for example Scribe, Facilitator, White Cell in Fractured Order). | DEC-61. Legacy: role definition, RoleInstance |
| Seat | A Release-defined position a Participant occupies, binding a Session Role and optionally a Team. Has minimum and maximum occupancy and a join mode. | |
| Stage | A unit of simulation structure and time. Has a designer-chosen **Stage Type** label (for example phase, move, round, turn, orientation, custom) and may belong to a parent **Stage Group**, allowing nesting such as a move containing phases. | DEC-33; OPEN-005. Legacy: phase, round, turn, move, orientation, temporal node |
| Stage Transition | A guarded move from one Stage to another: automatic, manual, or either. | Legacy: phase transition |
| Activity | Something Participants do within a Stage: read, discuss, submit, review, communicate, adjudicate, observe or custom. | |
| Artifact Type | A versioned definition of a structured record: its Form, Workflow Definition, ownership, Information Policy, retention and export behavior. | DEC-09 |
| Decision-bearing type | An Artifact Type marked by the methodology as recording a committed choice. Instances are Decision Records. | DEC-63 |
| Form | The versioned field schema, layout, validation and conditional logic for an Artifact Type. | |
| Workflow Definition | A state machine of states, guarded transitions, permitted Session Roles, emitted events and side effects. | DEC-08; OPEN-006 |
| Gate | A declarative, type-checked condition that restricts a transition or action, evaluated authoritatively in the Runtime. | Legacy: rule, condition group |
| Information Policy | The default-deny rules controlling which Participants may see a record or field, and when it is released. | DEC-10. Legacy: visibility rule, visibility matrix |
| Inject Definition | A designed release of information to a defined audience, with release mode, schedule or trigger, required response and effects. | DEC-34. Legacy: event definition (designer sense) |
| Message Channel | A permitted message type (direct, team, proposal, request for information, broadcast, public statement, custom). | DEC-51. Legacy: Communication Channel |
| Communication Route | The rule allowing a sender selector to use a Message Channel toward a recipient selector, possibly with approval. | |
| Voice Channel Definition | A designed audio channel: mode (`radio_ptt`, `open_room`, `private_call`, `broadcast`), capacity, active Stages, listen, transmit, moderate and invite policies, radio floor rules, recording and transcription policy. | DEC-47, DEC-51; document 12 |
| Poll Definition | A designed poll or vote: question, options with stable IDs, poll type, tally method and version, Electorate policy, secrecy mode, quorum, weights, veto, tie rule, open and close triggers, result visibility and certification policy. | DEC-46; document 11 |
| State Variable | A designer-defined quantity of world state with scope, type, range, visibility and edit rights. | Legacy: variable, world-state variable |
| Capability Definition | A designer-defined capability with availability, readiness, degradation and recovery rules. | |
| Resource Definition | A designer-defined resource with allocation, consumption and replenishment rules. | |
| Objective | A goal attached to a Team, Session Role, Scenario or Session. | Attachment rules: OPEN-018 |
| Research Question | A question the simulation is designed to answer, linked to Decision Records and Measurement Definitions. | 08 Canon |
| Measurement Definition | A versioned metric contract: definition, formula, sources, aggregation and interpretation. | Legacy: metric definition |
| Adjudication Model | The configured method for resolving Decision Records: manual, rubric-assisted, rules-based, plugin-supported or hybrid. | DEC-03 |
| Interface Profile | A curated composition of platform modules and layout for given Session Roles and Stages. | DEC-12 |
| Plugin | A developer-produced package or service connector implementing a signed, versioned capability contract with declared inputs, outputs, permissions, category and connectivity. Runs in the Extension Host outside the trusted Runtime and can only propose effects. | DEC-11, DEC-52 to DEC-56. Legacy: extension, extension adapter, adjudication engine |
| Plugin Category | Discovery metadata grouping Plugins into four families and nine categories. Never a permission. | DEC-60 |
| Plugin Artifact | The immutable, content-addressed, signed distributable of one Plugin version. | Document 10 |
| Plugin Installation | An Organization's verified, approved copy of a Plugin Artifact in a Deployment, including connection settings and secret references. | Legacy: Adapter (connection configuration) |
| Plugin Configuration | Designer-set, non-secret parameters, mappings and triggers for a Plugin. | |
| Plugin Binding | The reference from a Core Design to an approved Plugin Installation, its pinned digest and its Plugin Configuration. | |
| Model Composition | A typed directed graph of Plugin invocations, allowlisted transforms, joins and approval gates, compiled into the Release. No arbitrary cycles. | DEC-55 |
| Platform Adapter | A pinned, verified component that extends a core capability without holding authority: a **Voting Method Adapter** (tally algorithm) or a **Media Provider Adapter** (voice transport). Not a Plugin Category. | DEC-59 |

## 5. Runtime

| Term | Definition | Notes |
|---|---|---|
| Session | One execution of a Simulation Release. Owns its state, Participants and evidence. | DEC-30. Legacy: run, simulation run, exercise session |
| Session Authority | The single Deployment currently permitted to commit consequential changes for a Session. | ADR-001 |
| Authority Epoch | A monotonically increasing number identifying the current Session Authority; writes carrying an older epoch are rejected. | ADR-001 |
| Release Activation | A recorded event that makes a Simulation Release govern new work in a Session. The first activation happens at Session creation. | ADR-004 |
| Governing Release | The Simulation Release that governs a specific Artifact or Workflow Instance, pinned when it is created. | ADR-004 |
| Participant | A Principal's participation in a Session. | Legacy: RunParticipant |
| Seat Assignment | The time-bounded binding of a Participant to a Seat. Reassignment closes one Seat Assignment and opens another. | Legacy: participant assignment, seat claim |
| Active Role Context | The single Session Role a multi-role Participant is currently acting in. | |
| Session Team | The runtime instance of a Team Definition in a Session. | Legacy: TeamInstance |
| Artifact | An instance of an Artifact Type in a Session, with author, version and history. | Legacy: artifact instance, submission, form record |
| Decision Record | An Artifact of a decision-bearing type. | DEC-63 |
| Action | The single executable component inside a Decision Record. | DEC-63. Legacy: ActionRecord as a top-level entity |
| Workflow Instance | The execution of a Workflow Definition for one Artifact. | |
| Inject Instance | The runtime state of one Inject Definition in a Session, including per-recipient acknowledgement and response. | DEC-64 |
| Message | A communication sent over a Message Channel. | |
| Poll | The runtime instance of a Poll Definition in a Session (§7.9). | DEC-46 |
| Electorate | The Seat Assignments eligible to vote in a Poll, with weights and veto rights, frozen when the Poll opens. | |
| Ballot | One accepted vote in a Poll, with its receipt. In secret-ballot mode the choice is stored apart from the voter's identity. | |
| Secret Ballot / Anonymous Survey | Secret ballot: eligibility is verified but choices are hidden from operators. Anonymous survey: no personally linkable identity is collected by design. | Document 11 |
| Tally | A computed, unofficial count over a fixed set of accepted Ballots under a pinned method version. | |
| Certification | The authorized, recorded acceptance of one Tally as the official result of a Poll revision. A correction is a new linked Certification. | |
| Voice Channel | The runtime instance of a Voice Channel Definition in a Session. | DEC-51 |
| Floor | The right to transmit on a push-to-talk Voice Channel. At most one holder at a time, granted as a short-lived **Floor Lease**. | DEC-48 |
| Media Credential | A short-lived credential issued by the Runtime, scoped to Session, Voice Channel, permission (listen, transmit, moderate) and Participant. | ADR-017 |
| Consent Record | A Participant's recorded agreement to, or withdrawal from, recording or transcription on a Voice Channel. | DEC-50 |
| Extension Host | The isolated execution supervisor that runs Plugins with quotas, data controls and instrumentation. | ADR-018 |
| Model Run | One Plugin invocation with a fixed Plugin digest, input snapshot, configuration and seed. | |
| Composition Run | One execution of a Model Composition, made of Model Runs (node attempts). | |
| Effect Proposal | A typed, staged request from a Model Run to change Session state. Never itself a change. | DEC-54. Legacy: plugin output, proposed effect |
| Approval Decision | A person's approve, reject or return decision on an Effect Proposal set, bound to its hash, the state version and the Authority Epoch. | DEC-54 |
| Adjudication Request | A permission-limited, versioned request to resolve one or more Decision Records. | |
| Adjudication Record | The result of adjudication: outcome, rationale, evidence references, origin (human or plugin), version and review disposition. | Legacy: adjudication instance, adjudication result |
| Outcome | The narrative and categorical result published from an Adjudication Record. | |
| Effect | A change to State Values, Capabilities, Resources or Injects caused by an Outcome or Inject. | |
| State Value | The current value of a State Variable in a Session. | Legacy: variable value |
| State Snapshot | A recorded set of State Values at a point in a Session. | |
| Control Intervention | An authorized operator action that changes Session state outside normal participant flow, with authority, reason and category recorded. | Legacy: White Cell intervention (White Cell is a Release-defined role name) |
| Command | A request to change state, carrying a stable Command ID, expected aggregate version and Governing Release. | |
| Command Receipt | The durable server record of a Command's outcome. | |
| Command Outcome | The status of a Command Receipt (§7.6). | DEC-37 |
| Projection | The authorization-filtered view of Session data sent to one Participant or Device. | |
| Projection Cursor | An opaque, server-validated position in a Projection's delta stream. | |
| Offline Outbox | The protected client-side queue of Commands created while disconnected. | |
| Session Access Context | The server-resolved identity, Seat Assignments, Active Role Context and status used to authorize every request. | Legacy: RunAccessContext, RuntimeContext |

## 6. Evidence and analysis

| Term | Definition | Notes |
|---|---|---|
| Evidence Event | The append-only, sequenced, tamper-evident institutional record of a committed change or a rejected Command in a Session. | DEC-34; DEC-43; ADR-003. Legacy: event log entry, in-session audit event |
| Evidence Sequence | The strictly increasing per-Session number assigned to each Evidence Event. | |
| Domain Event | A past-tense notification that a change committed, derived from an Evidence Event and delivered through the outbox to Projections and integrations. | DEC-34 |
| Checkpoint | A signed digest over a contiguous range of Evidence Events, chained to the previous Checkpoint. | ADR-003 |
| Anchor | An independently held copy of a Checkpoint digest used to detect tampering. | ADR-003; OPEN-017 |
| Audit Record | A security or administrative record outside any Session: authentication, membership changes, publication approvals, exports. | |
| Observation | A raw recorded fact about participant or system behavior. Never overwritten by derived values. | Data §20 layer 1 |
| Derived Metric | A reproducible transformation of Observations under a versioned Measurement Definition. | Layer 2 |
| Analytical Note | An attributed analyst interpretation. | Layer 3 |
| Finding | A claim linked to supporting evidence, confidence and limitations. | Layer 4 |
| Captured History | Evidence Events recorded during the Session. | |
| Reconstructed Narrative | A report assembled from Captured History, Artifacts and annotations. Never presented as a raw transcript. | |
| Session Reproducibility Manifest | The list of immutable versions, seeds and imported content needed to reproduce or replay a Session. | Legacy: run reproducibility manifest |

## 7. Lifecycles and status vocabularies

Status values are lower snake_case in data and contracts. Display labels may differ.

### 7.1 Publication lifecycle — DEC-39

`draft` → `validated` → `in_review` → `approved` → `published` → `superseded` → `archived`

- A failed validation leaves the item in `draft` with a validation report attached.
- A test session is not required by default. An Organization policy may require a passed test session before `approved`. Production approval and sandbox exceptions follow resolved OPEN-013 and the confirmed application of DEC-39.

### 7.2 Session lifecycle

`created` → `configured` → `ready` → `open` → `active` ⇄ `paused` → `completed` → `locked` → `archived`

Commands from Participants are accepted only in `active`, and in `paused` only where the Release permits drafting.

### 7.3 Reference artifact workflow — DEC-42

Defined by the Fractured Order reference Release, not by the platform. States: `draft`, `submitted`, `in_review`, `returned`, `accepted`. Transitions are listed in the Decision Register §5.4.

### 7.4 Methodology default decision lifecycle

Carried from Runtime §20 as the default template for decision-bearing Artifact Types, pending the 08 Canon:

`draft` → `submitted` → `under_review` → `clarification_requested` → `resubmitted` → `approved` → `adjudication_pending` → `adjudicated` → `effects_applied` → `closed`

### 7.5 Inject lifecycle — DEC-64

Lifecycle vocabulary and configurable requirements follow DEC-64. Scheduling, acknowledgement and response steps are not universally mandatory; recipient states and configured completion requirements determine progress. The implementation must not infer all-recipient completion from a single acknowledgement.

### 7.6 Command outcomes — DEC-37

| Status | Where | Meaning |
|---|---|---|
| `local_pending` | Client only | Stored on the device; not yet received by the Session Authority. Never a server success. |
| `received` | Server | Durably recorded; processing not final. |
| `accepted` | Server | Committed. |
| `rejected` | Server | Not executed; stable error code; recorded with an Evidence Event (DEC-43). |
| `needs_reconciliation` | Server | Requires user or operator action, for example a stale version or incompatible Release. |

A replayed Command returns its original receipt with `replayed: true`.

### 7.7 Session Authority status

`active`, `transfer_pending`, `fenced`, `unavailable`.

### 7.8 Seat and onboarding

- Seat: `open` → `reserved` → `occupied` → `vacated` → `open`; also `disabled`.
- Participant onboarding: `invited` → `identity_pending` → `assignment_pending` → `waiting_room` → `admitted` → `readiness_incomplete` → `ready` → `active` → `completed`; exits `declined`, `rejected`, `removed`, `revoked`, `expired`.

### 7.9 Poll lifecycle — DEC-46

`draft` → `configured` → `scheduled` → `open` → `closed` → `tallied` → `certified`, with exits `cancelled`, `voided`, `disputed` and `correction_issued`. Nothing about a Poll can change after `open`; a change means void and reissue.

### 7.10 Plugin Artifact lifecycle — DEC-52

`submitted` → `scanned` → `contract_validated` → `security_reviewed` → `approved` → `published`, then per Organization `installed` → `enabled` → bound to a Release; exits `rejected`, `suspended`, `revoked`, `deprecated`, `quarantined`, `uninstalled`.

### 7.11 Effect Proposal lifecycle — DEC-54

`staged` → `in_review` → `approved` → `applied`, with exits `rejected`, `returned`, `stale` and `failed`.

### 7.12 Floor Lease

`requested` → `granted` or `queued` → `released`, `expired` or `preempted`.

## 8. Naming conventions — DEC-38

| Item | Convention | Examples |
|---|---|---|
| Command | `<aggregate>.<imperative verb>`, lower dot-case | `artifact.submit`, `session.pause`, `release.activate` |
| Domain Event and Evidence Event type | `<aggregate>.<past participle>`, with an integer schema version | `artifact.submitted` v1, `release.activated` v1, `command.rejected` v1 |
| Aggregate names with two words | snake_case before the dot | `seat_assignment.created`, `model_run.failed` |
| Status values | lower snake_case | `in_review`, `needs_reconciliation` |
| JSON fields | camelCase | `sessionId`, `governingReleaseId`, `authorityEpoch` |
| Database objects | snake_case | `session_id`, `governing_release_id` |
| Identifiers | UUID; field suffix `Id` / `_id` | `releaseId`, `release_id` |
| Error codes | UPPER_SNAKE_CASE; the catalog in 09 Contracts §8.1 is canonical | `STALE_AGGREGATE_VERSION` |

## 9. Legacy term crosswalk

### 9.1 Terms

| Legacy term | Where it appears | Canonical term |
|---|---|---|
| Simulation (design identity) | Foundation §5 | Simulation Project |
| Simulation Package | Foundation; Platform §6 | Simulation Release (identity); Package (file form) |
| Simulation version, `simulationVersionId`, published version | Platform §7, §10; Schema §22 | Simulation Release, `releaseId` |
| Scenario version (executable sense) | Schema §24, §27; Platform §20 | Simulation Release |
| Scenario lifecycle | Studio §23; API §5 | Publication lifecycle |
| Run, simulation run, `runId`, `/runs/{runId}` | Platform §20, §23; Schema §24; API §10 | Session, `sessionId`, `/sessions/{sessionId}` |
| Run lifecycle | API §5 | Session lifecycle |
| RunParticipant | Platform §23 | Participant |
| RunAccessContext, RuntimeContext | Platform §7, §23 | Session Access Context |
| ParticipantAssignment | Platform §23 | Seat Assignment |
| TeamInstance | Platform §23 | Session Team |
| RoleInstance, role definition | Platform §23; Schema §7 | Session Role |
| SeatInstance | Platform §23 | Seat (definition) with Seat Assignment |
| UserAccount, user | Platform §23 | Person |
| Client session, authentication session | Platform §23.7 | Authentication Session |
| Device identity (shared display) | Platform §23.6 | Display Principal |
| Workspace, `workspaceId` | Platform §20, §23 | Removed (DEC-36) |
| Phase, round, turn, move, orientation, temporal node | Schema §8; Foundation §5 | Stage with Stage Type |
| PhaseDefinition, `phaseId` | Schema §8 | Stage, `stageId` |
| Phase transition | Schema §8 | Stage Transition |
| Event definition, event instance (designer sense) | Schema §24; Runtime §20 | Inject Definition, Inject Instance |
| Event lifecycle (Runtime §20) and inject lifecycle (Runtime §9) | Runtime | Inject lifecycle §7.5 |
| DomainEvent | Platform §10 | Domain Event |
| Event log, event history, in-session audit event | Runtime §16; Data §3, §9 | Evidence Event |
| Audit event (administrative) | Data §9 | Audit Record |
| Artifact instance, submission | Foundation; Data §4 | Artifact |
| ActionRecord as a top-level entity | Schema §25 | Action inside a Decision Record |
| Variable, world-state variable | Schema §15; Studio §12 | State Variable |
| Variable value, variable change | Runtime §10 | State Value; Evidence Event |
| Visibility rule, visibility matrix | Schema §20; Studio | Information Policy |
| Rule, condition group (as a gate) | Foundation; Schema §20 | Gate |
| Extension, extension adapter, adjudication engine | Foundation §1, §9 | Plugin; Plugin Installation for the connection |
| Communication Channel | Glossary v1.0; Schema v1.3 §13 | Message Channel (DEC-51) |
| Adapter (Plugin connection configuration) | Glossary v1.0 | Plugin Installation; Platform Adapter is a different concept |
| Phase gates, `phaseGates` | Voice and voting specifications v1.0 | Active Stages, `activeStageIds` |
| Proposed Effect, model output | Extension specification v1.0 | Effect Proposal |
| `seat_id`, `holder_seat_id` | Voice specification v1.0 | Seat Assignment ID |
| White Cell intervention | Schema §25; Runtime §21 | Control Intervention |
| Game Master | Foundation §4 | Session Operator (persona label) |
| White Cell, Controller, Scribe, Facilitator, team lead, notetaker | Foundation; Roadmap §10; code slice | Session Roles defined by a Release, not platform terms |
| Definition state; published version state | Platform §9 | Draft; Simulation Release |
| Run reproducibility manifest | Schema §27 | Session Reproducibility Manifest |
| `needs_review` | Runtime v1.2 §B | `needs_reconciliation` |
| `already_processed` | Runtime v1.2 §B | Original receipt with `replayed: true` |
| `local_pending` as a server status | API v1.2 addendum | Client-only status |
| `artifact.resubmit` | Code slice | `artifact.submit` from `returned` |
| Tables `simulations`, `simulation_versions`, `event_log`, `artifacts` | Data §3, §4 | Names in PostgreSQL Logical Data Model v1.1 |

### 9.2 Event names

| Legacy name | Source | Canonical name |
|---|---|---|
| `session.created` | Platform §10 | `session.created` (unchanged) |
| `participant.joined` | Platform §10 | `participant.admitted` |
| `participant.assigned` | Platform §10 | `seat_assignment.created` |
| `phase.started`, `phase.completed` | Platform §10 | `stage.started`, `stage.completed` |
| `timer.paused` | Platform §10 | `timer.paused` (unchanged) |
| `artifact.created`, `artifact.submitted` | Platform §10 | unchanged |
| `workflow.step.completed` | Platform §10 | `workflow_instance.advanced` |
| `message.sent` | Platform §10 | unchanged |
| `inject.released` | Platform §10 | unchanged |
| `adjudication.finalized` | Platform §10 | `adjudication_record.finalized` |
| `variable.changed` | Platform §10 | `state_value.changed` |
| `session.ended` | Platform §10 | `session.completed` |
| `export.generated` | Platform §10 | unchanged |
| `run_invitation_issued`, `run_invitation_accepted` | API §10.2 | `invitation.issued`, `invitation.accepted` |
| `run_join_requested` | API §10.2 | `join_request.submitted` |
| `participant_admitted`, `participant_rejected` | API §10.2 | `participant.admitted`, `participant.rejected` |
| `seat_reserved`, `seat_claimed` | API §10.2 | `seat.reserved`, `seat.claimed` |
| `participant_assignment_created`, `participant_assignment_changed` | API §10.2 | `seat_assignment.created`, `seat_assignment.changed` |
| `participant_role_context_changed` | API §10.2 | `participant.role_context_changed` |
| `participant_readiness_changed`, `participant_readiness_overridden` | API §10.2 | `participant.readiness_changed`, `participant.readiness_overridden` |
| `participant_disconnected`, `participant_reconnected` | API §10.2 | `participant.disconnected`, `participant.reconnected` |
| `principal_access_revoked` | API §10.2 | `principal.access_revoked` |
| `device_identity_activated`, `device_identity_revoked` | API §10.2 | `display_principal.activated`, `display_principal.revoked` |
| `plugin_installed` | API §18 | `plugin.installed` |
| `plugin_enabled_for_simulation`, `plugin_disabled_for_simulation` | API §18 | `plugin_binding.enabled`, `plugin_binding.disabled` |
| `plugin_execution_requested`, `_completed`, `_failed` | API §18 | `model_run.started`, `model_run.completed`, `model_run.failed` |
| `plugin_output_approved`, `plugin_output_rejected` | API §18 | `effect_proposal.approved`, `effect_proposal.rejected` |
| `model.effect.proposed`, `.approved`, `.rejected`, `.applied` | Extension specification v1.0 | `effect_proposal.staged`, `.approved`, `.rejected`, `.applied` |
| `composition.run.started`, `composition.node.completed`, `composition.node.failed` | Extension specification v1.0 | `composition_run.started`, `model_run.completed`, `model_run.failed` |
| `plugin.artifact.approved`, `plugin.dependency.unavailable` | Extension specification v1.0 | `plugin_artifact.approved`, `plugin_installation.unavailable` |
| `poll.tally.computed`, `poll.result.certified`, `poll.correction.issued` | Voting specification v1.0 | `poll.tallied`, `poll.certified`, `poll.corrected` |
| `comms.channel.opened`, `.closed` | Voice specification v1.0 | `voice_channel.opened`, `voice_channel.closed` |
| `comms.floor.granted`, `.queued`, `.released`, `.preempted` | Voice specification v1.0 | `floor_lease.granted`, `.queued`, `.released`, `.preempted` |
| `comms.participant.joined`, `.left` | Voice specification v1.0 | `voice_channel.joined`, `voice_channel.left` |
| `comms.provider.unavailable` | Voice specification v1.0 | `media_provider.unavailable` |
| `comms.recording.started`, `.stopped` | Voice specification v1.0 | `voice_recording.started`, `voice_recording.stopped` |
| `asset_uploaded`, `asset_processed`, `asset_quarantined` | API §18 | `asset.uploaded`, `asset.processed`, `asset.quarantined` |
| Brand, theme, interface and terminology profile events | API §18 | `<profile_type>.updated`, `semantic_theme.validated` |
| Evidence event type equal to the command name (`artifact.submit`) | Code slice | Past tense: `artifact.submitted` |

## 10. Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-17 | Created from the 2026-10-17 review and questionnaire. |
| 1.0.1 | 2026-10-17 | Added voting, voice and extension terms (DEC-46 to DEC-60) and lifecycles §7.9 to §7.12; renamed Communication Channel to Message Channel (DEC-51); replaced Adapter with Plugin Installation; mapped specification event names. |
| 1.0.2 | 2026-10-21 | Added Reviewer and Research Analyst Organization Roles from DEC-61. |
| 1.0.3 | 2026-11-08 | Aligned confirmed terms and publication interpretation; removed assumption markers; adopted DEC-63 and DEC-64 while preserving historical entries. |
