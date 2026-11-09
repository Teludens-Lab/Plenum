# Plenum — Runtime, Workflow and Adjudication

## Document control

| Field | Value |
|---|---|
| Document ID | RWA |
| Number | 05 |
| Version | 1.3.2 |
| Date | 2026-11-08 |
| Status | Draft for review. v1.2 amendment merged (DEC-26). |
| Owner | Technical Lead |
| Approvers | Product Owner; Methodology Lead; Technical Lead (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 08 Canon; 02 Platform; 03 Schema; 09 Contracts; 10 Extension Framework; 11 Polling and Voting; 12 Voice and Radio; Decision Register; Glossary |
| Read by | Runtime implementation; operator playbooks; tests; analytics |
| Authority | Executable Session behavior: lifecycle, authority, Commands, workflows, Stages, timers, Injects, state, adjudication, interventions, evidence, recovery and replay. |
| Supersedes | `05_RUNTIME_AND_ADJUDICATION_v1.2.md` |

---

## 1. Purpose

The Runtime interprets a Simulation Release and manages live execution. It is identical for every simulation; changing Teams, Session Roles, Stages, Forms or workflows never requires new code (REQ-024, INV-022).

## 2. Session lifecycle

`created` → `configured` → `ready` → `open` → `active` ⇄ `paused` → `completed` → `locked` → `archived`

| State | Meaning |
|---|---|
| created | The Session exists and pins its initial Release (INV-005). |
| configured | Operators have set permitted overrides: title, schedule, Seat counts within bounds, preassignments, timer adjustments, optional Teams, optional Inject branches. |
| ready | Required Seats, operator assignments and readiness checks are complete (REQ-069). |
| open | Participants may join; the simulation has not started. |
| active | Stages, workflows, communications, Injects and timers run normally. |
| paused | Timers and automatic transitions stop; drafting follows Release policy. |
| completed | No new ordinary Participant Commands. |
| locked | Records change only through governed corrections (06 §12). |
| archived | Retained under retention policy; read-only. |

Each lifecycle change is a Command and produces an Evidence Event (`session.started`, `session.paused`, `session.resumed`, `session.completed`, and so on).

## 3. Session authority and Command processing

### 3.1 Single writer

Each Session has exactly one Session Authority, identified by Deployment ID and Authority Epoch (ADR-001, INV-017). Every consequential write checks both inside its transaction; writes from a stale epoch or a different Deployment are refused with `AUTHORITY_UNAVAILABLE`. Authority transfer is an explicit, fenced operator procedure (Synchronization Protocol §8; resolved OPEN-016, Decision Register §7.3). A LAN-hosted Session Authority keeps running without Internet access, with its own PostgreSQL, identity and Release storage.

### 3.2 Command pipeline

Commands follow 02 §12.1. Key rules:

- A Command ID is unique per Session; replay with the same payload returns the original receipt; a different payload is refused (`IDEMPOTENCY_COLLISION`).
- Commands for the same Session are serialized at the Session Authority.
- State change, Command Receipt, Evidence Event and outbox entry commit in one transaction.
- Outcomes follow DEC-37. A rejected Command and a Command needing reconciliation are both recorded with an Evidence Event (DEC-43); malformed requests and requests from non-Participants are refused without a receipt because they never reach the Session.

### 3.3 What disconnected devices may not do

A device disconnected from the Session Authority may not finalize adjudication, trigger official Stage transitions or establish authoritative event order (INV-018). Timers shown offline are estimates; reconnection rehydrates authoritative deadlines.

## 4. Participants and Seats

### 4.1 Joining and assignment

Participants enter by preassignment, invitation, session code with identity verification, open Seat selection, operator assignment or roster import, according to the Release's access policy (03 §15). Every Seat Assignment is time-bounded and recorded as an Evidence Event.

### 4.2 Active Role Context

A Participant holding several Session Roles selects one Active Role Context for role-sensitive Commands. Commands naming a role the Participant does not hold are rejected (`PERMISSION_DENIED`).

### 4.3 Reassignment

Follows 02 §20.6 (REQ-049).

## 5. Stage engine

The Stage engine is a state machine over the Release's Stages and Stage Groups. It evaluates entry Gates, applies on-enter actions, starts timers, enables Activities and modules, tracks completion Gates, evaluates transition eligibility, requires manual confirmation where configured, applies on-exit actions, and keeps the full transition history.

**Operator overrides.** Start, end, reopen, extend, skip, or return to a previous Stage, each requiring a reason and producing an Evidence Event (REQ-025).

## 6. Timers

Server-authoritative timing (INV-011); pause and resume; extensions and reductions; Stage- and Activity-level timers; warning thresholds; automatic expiry actions; correct display after reconnection.

## 7. Artifacts

### 7.1 Record

An Artifact carries: Artifact Type key, Form version, Governing Release, Session, owner, creator, recipients, workflow state, payload, attachments, version history, visibility and timestamps.

### 7.2 Draft protection

Autosave; local fallback during disconnection; server conflict detection by expected version; recovery after reconnection; explicit submission (REQ-028).

### 7.3 Submission integrity

The Runtime validates the current Stage, the actor's Session Role and capabilities, required fields of the pinned Form version, recipient validity, workflow eligibility and duplicate-submission rules.

## 8. Workflows

### 8.1 Data-driven execution

The workflow engine reads the Workflow Definition from the Artifact's Governing Release (INV-021). A Command is accepted only if a transition exists from the current state for that Command and the actor's Active Role Context is permitted (INV-003). No workflow logic is written in code.

### 8.2 Instance state

A Workflow Instance holds current state, holders, deadlines, transition history, automation results and override history. In the first slice an Artifact has exactly one Workflow Instance, stored with the Artifact (Data Model §4.4).

### 8.3 Human tasks and parallel review

Tasks may be assigned to a specific Participant, a Session Role, a Team's Session Role, a control group, the first available eligible Participant, or all eligible reviewers. Parallel review supports any one approval, majority, quorum, unanimous, and lead approval after peer input.

### 8.4 Reference workflow

The Fractured Order reference Release uses the DEC-42 workflow (03 §10.1). It demonstrates that return paths, notifications and role permissions come from configuration.

## 9. Communications

### 9.1 Messages

Every send is checked against Communication Routes (REQ-029). Message records hold sender, recipients, Message Channel, thread, content, attachments, approval state, delivery state, read state where appropriate, Stage and server time.

### 9.2 Voice Channels

Specified in 12 (DEC-47). The Runtime opens and closes Voice Channels by Command or Stage rule, issues short-lived Media Credentials on `voice_channel.join`, re-evaluates grants whenever a Seat Assignment, Session Role or active Stage changes, and arbitrates the push-to-talk Floor through the dedicated floor endpoints (DEC-48). Transcription runs only with consent (DEC-50). Media-provider events are untrusted observations recorded as metadata; the Runtime never claims that audio was delivered.

## 10. Injects

Lifecycle and optional requirements follow DEC-64. The engine supports manual, scheduled, Stage-entry, Stage-exit and Gate-triggered release; cancellation; rescheduling; per-recipient acknowledgement and configured response tracking. Completion evaluation must use the Release requirements and recipient states rather than assume every Inject traverses all acknowledgement/response states. Each trigger fires exactly once (REQ-030).

## 11. World state

State Values are stored separately from State Variable definitions. Every change records variable, scope, previous value, new value, operation, source event, source Artifact or Inject, actor, rationale and time (REQ-031). Capability state changes and Resource transactions are recorded the same way. Immediate effects are applied in the same transaction as the Outcome or Inject release that caused them. Delayed effects are one-shot, Release-pinned records limited to seven days, cancellable only before due, and atomically claimed when applied. Published Release snapshots are immutable; counted Capability consumption and renewal are atomic and never negative.

## 12. Adjudication

### 12.1 Request and record

An Adjudication Request names the Decision Records, the Adjudication Model, the policy-filtered context and a correlation key. An Adjudication Record carries outcome, rationale, evidence references, confidence, effects, publication scope, origin (human or plugin), version and review disposition (REQ-036, 08 Canon §8.2).

OPEN-018 fixes the cardinality and revision rules: each Decision Record contains exactly one Action, while one Adjudication Request may snapshot several Decision Records/Actions. Submitted Action revisions are immutable and carry stable Person/Organization identifiers plus submission-time name and Organization snapshots. Reviewer inputs remain separate by perspective; restricted analytical notes are stored and projected separately from participant-facing rationale. An authorized lead synthesizes the final draft. A system or Plugin suggestion may be overridden only with an explicit rationale.

Publication is an online, authoritative Command and the only path that makes the outcome participant-visible or applies/schedules effects. The Runtime locks the request version, publishes the narrative and effects in one transaction, and rejects stale competing drafts or publications. Plugin contributions must reference applied proposals pinned by proposal hash, Governing Release and Authority Epoch; failed, timed-out, stale or merely staged proposals cannot become accepted adjudication input.

Information access and delivery are distinct. Access is current authorization evaluated server-side under the Governing Release Information Policy at release, delivery, query and projection time. Delivery is immutable per-recipient evidence that a particular authorized record version was made available at server time; it does not grant access and does not prove viewing. `released`, `delivered`, `viewed` and `acknowledged` are separate facts. Revocation stops future retrieval and redelivery but cannot erase a device copy; restricted delivery history remains retained.

### 12.2 Mechanisms

| Mechanism | Behavior |
|---|---|
| Manual | Adjudicator records outcome, rationale, evidence, confidence, effects and publication scope. |
| Rubric-assisted | Engine computes a suggested score from weighted criteria; the adjudicator accepts or overrides with rationale. |
| Rules-based | Rules over validated facts produce a suggestion and an explanation trace of which conditions passed or failed (REQ-037). |
| Plugin | See §12.3. |
| Hybrid | Combination declared in the model. |

Example rubric:

```text
Strategic coherence         20%
Capability availability     20%
Implementation feasibility  20%
Coalition support           15%
Target vulnerability        15%
Escalation risk             10%
```

Example rule:

```text
IF committed resources meet the requirement
AND at least two partners support the action
AND target resilience is below 40
THEN suggest strong success.
```

### 12.3 Plugin execution

Specified in 10 §8 to §10.

1. Resolve the approved input mappings, apply classification ceilings and freeze an input snapshot.
2. Validate inputs against the Plugin's input schema.
3. Execute the Plugin or Model Composition in the Extension Host with a deadline (ADR-018).
4. Validate outputs against the output schema and allowed effect types.
5. Stage the result as Effect Proposals and present them to the approving Session Roles.
6. Require an Approval Decision by an authorized person for every consequential effect (DEC-54). There is no setting that skips this step.
7. On approval, recheck authority, permission, Governing Release and state version, then apply the effects through an ordinary Command; a stale approval fails with `STALE_PROPOSAL`.
8. Record Plugin digest, input snapshot digest, output digest, Model Run and Composition Run IDs, the Approval Decision and the Command Receipt in evidence (10 §14).

A timeout, failure or invalid output is recorded as such and never presented as an outcome (INV-008, INV-020). Designer-authored rules, scheduled Injects and automatic Stage transitions are not plugin effects and run as configured.

### 12.4 Multiple perspectives

Separate reviewers may assess economic, diplomatic, information, operational, legal, escalation and political dimensions, or designer-defined ones; a lead adjudicator synthesizes the final record (REQ-039).

### 12.5 Publication of outcomes

An Adjudication Record stays a draft until published. Publishing may release narrative outcomes, reveal selected evidence, change State Values, trigger Injects, unlock Stages, notify recipients and produce public and team-specific versions (REQ-040).

## 13. Control Interventions

Each intervention records authority, reason, affected entities, previous and resulting state, simulation and wall-clock time, operator, evidence and category (08 Canon §7, REQ-034).

## 14. Operator console

Session status; current Stage; timer; connected Participants; Seat occupancy; required submission status; active workflow tasks; pending Injects; adjudication queue; delivery failures and dead letters; validation and runtime warnings; live evidence stream (REQ-032, REQ-068).

## 15. Recovery operations

Reassign Participants; reopen Artifacts; correct recipients; release missed Injects; reprocess failed automation; extend deadlines; restore Session state; annotate corrections. Every recovery action leaves the original record and adds a compensating record (REQ-033).

## 16. Evidence Events

Every committed change and every recorded rejection produces one Evidence Event (REQ-053):

```text
id · organizationId · sessionId · sequence · type · typeVersion
commandId · actorPersonId · actorParticipantId · activeSessionRoleId
governingReleaseId · authorityEpoch · body · recordedAt
```

Evidence integrity (Checkpoints and Anchors) is specified in 06 §10.

## 17. Captured history and reconstructed narrative

Reports label Captured History (Evidence Events) and Reconstructed Narrative (assembled later) distinctly (REQ-061, 08 Canon §10.4).

## 18. Offline participation

Participants may draft and queue Commands while disconnected. On reconnection the Session Authority re-authenticates the device, applies current revocations, checks idempotency, verifies authority, validates against the target's Governing Release and returns an outcome for each queued Command. Server receipt and sequence determine institutional order; device clocks are observations. The full protocol is the Synchronization Protocol v1.1. Feature rules (Sync §4.3): a Ballot may be queued but is judged at server receipt time; voice Commands and floor requests are never queued; Approval Decisions on Effect Proposals are never queued (INV-026).

## 19. Live Release activation

- Existing Artifacts and Workflow Instances stay governed by the Release under which they were created unless a validated, approved migration applies (ADR-004, INV-021).
- New instances use the newly activated Release.
- Security revocations always apply at the trusted boundary immediately; they cannot erase information already delivered.
- Activation and its Evidence Event commit in one transaction; a partly failed activation is idempotent and recoverable.

## 20. Required state machines

Each is explicit, testable and enforced server-side; every completed transition emits a versioned event only after durable commit.

| State machine | Defined in |
|---|---|
| Publication lifecycle | Glossary §7.1 |
| Session lifecycle | §2 |
| Stage | §5 |
| Artifact workflow | Release-defined; §8 |
| Decision lifecycle (methodology default) | Glossary §7.4 |
| Inject lifecycle | §10 |
| Information delivery | 09 §6 |
| Adjudication | §12 |
| Poll | Glossary §7.9; 11 §2 |
| Effect Proposal | Glossary §7.11; 10 §10 |
| Floor Lease | Glossary §7.12; 12 §5 |
| Plugin Artifact | Glossary §7.10; 10 §6 |
| Capability | 03 §13 |
| Seat and onboarding | Glossary §7.8 |
| Command outcome | Glossary §7.6 |
| Session Authority | Glossary §7.7 |
| Export | 09 §6 |
| Analysis lock | 09 §6 |

## 21. Deterministic replay

Given the same Release, initial state, Participant decisions, information deliveries, Control Interventions, adjudications, plugin and model versions and random seed, replay must reproduce the same event and state history, except for documented nondeterministic integrations. Differences produce a machine-readable divergence report (REQ-060).

## 22. Acceptance tests

A Release passes runtime acceptance when:

- every required Session Role can join and receives the correct interface;
- restricted content stays restricted;
- required Artifacts can be drafted and submitted; workflows reach terminal states;
- Stage transitions behave as configured; each Inject trigger fires once;
- state effects are traceable; reconnection restores state;
- reports reproduce the Session history.

Additional mandatory tests:

| Test | Expected result |
|---|---|
| Two competing adjudicators on the same version | One accepted, one `STALE_AGGREGATE_VERSION` |
| Offline Command replayed after commit but lost response | Original receipt returned; one Evidence Event |
| Command carrying a stale Authority Epoch or wrong Deployment | `AUTHORITY_UNAVAILABLE`; no commit |
| Release activated while a device is offline | Queued Commands validated against Governing Release; incompatible ones flagged |
| Membership expired while offline | Queued Commands refused on reconnect |
| Corrupt local payload | `VALIDATION_FAILED`; draft retained |
| Rejected Command | Rejected receipt and `command.rejected` Evidence Event |
| DEC-16 workload | Measured against OPEN-019 targets; no assumed success |
| Plugin proposes an effect | State unchanged until an Approval Decision; then exactly one application (EXT-06, EXT-08) |
| Poll edited after open | Refused (VOTE-06) |
| Simultaneous push-to-talk requests | One valid Floor Lease (VOICE-02) |

The full acceptance matrices for these features are 10 §18, 11 §10 and 12 §11.

## 23. Polls

Specified in 11 (DEC-46). The Runtime freezes the Electorate, weights and options when a Poll opens; accepts `ballot.cast` Commands through the standard command endpoint (DEC-48) with server-side eligibility and deadline checks; computes reproducible Tallies; and records Certifications, voids and corrections as new records (INV-023, INV-024). A certified result changes Session state or starts a workflow only through an ordinary Command (REQ-077). Secret-ballot choices never enter shared streams or general evidence bodies (INV-025, 06 §24.1).

## Change log

| Version | Date | Change |
|---|---|---|
| 1.3.1 | 2026-10-17 | Split §9 into Messages and Voice Channels; rewrote §12.3 for mandatory approval of plugin effects (DEC-54) replacing "if the model says so"; added Poll, Effect Proposal, Floor Lease and Plugin Artifact state machines, offline feature rules, new mandatory tests and §23 Polls. |
| 1.3.0 | 2026-10-17 | Merged v1.2 amendment; adopted Session, Stage, Session Role, Evidence Event terms; data-driven workflow execution (DEC-45) with DEC-42 reference; recorded rejections (DEC-43); Inject lifecycle (DEC-40); renamed White Cell intervention to Control Intervention; consolidated state machine list; renumbered sections. |
| 1.2.0 | 2026-10-17 | Alignment amendment (archived). |
| 1.3.2 | 2026-11-08 | Aligned Inject execution with DEC-64 and authority-transfer reference with resolved OPEN-016; implementation verification remains separate. |
