# Plenum Runtime, Workflow, and Adjudication Engine

## Document Control

- **Document ID:** RWA
- **Version:** 1.2.0 (controlled alignment draft; retains v1.1 body)
- **Status:** Draft for review
- **Owner:** Plenum product owner
- **Approvers:** Product owner; simulation-methodology lead; technical lead
- **Reads from:** Simulation Design and Research Canon; Platform Architecture; Canonical Schema; Contracts
- **Read by:** Runtime implementation; operator playbooks; testing and analytics
- **Authority:** Defines executable lifecycle, workflow, timing, decision, event, adjudication, effect, recovery, and replay behavior.
- **Out of scope:** Decisions explicitly governed by another document in the specification hierarchy.

## 1. Purpose

The runtime engine interprets a published simulation definition and manages live execution. It must be stable across simulations and must not require new code when teams, roles, phases, forms, or workflows change.

## 2. Session Lifecycle

```text
Created
Configured
Ready
Open
Active
Paused
Completed
Locked
Archived
```

### 2.1 Created

The session references one exact published simulation version.

### 2.2 Configured

Operators may configure allowed runtime overrides such as:

- Session title
- Schedule
- Seat counts within permitted bounds
- Participant preassignment
- Timer adjustments
- Enabled optional teams
- Enabled optional inject branches

### 2.3 Ready

All required roles, operator assignments, and configuration checks are complete.

### 2.4 Open

Participants may join but the simulation has not begun.

### 2.5 Active

The phase engine, workflows, communications, injects, and timers operate normally.

### 2.6 Paused

Timers and configured automated transitions stop. Drafting behavior follows simulation policy.

### 2.7 Completed

No new ordinary participant actions are permitted.

### 2.8 Locked

Operators can no longer change session records except through governed corrections.

## 3. Participant Assignment

Participants may be assigned by:

- Preassignment
- Join code
- Open seat selection
- Operator assignment
- Bulk import

Every assignment change must be logged.

## 4. Phase Engine

The phase engine is a state machine.

It must:

- Evaluate entry conditions
- Apply on-entry actions
- Start timers
- Enable activities and modules
- Track completion conditions
- Evaluate transition eligibility
- Require manual confirmation when configured
- Apply on-exit actions
- Preserve a complete transition history

### 4.1 Manual overrides

Authorized operators may:

- Start a phase
- End a phase
- Reopen a phase
- Extend time
- Skip a phase
- Return to a previous phase

Overrides require a reason and generate an audit event.

## 5. Timer Engine

Requirements:

- Server-authoritative timing
- Pause and resume
- Extensions and reductions
- Phase-specific and activity-specific timers
- Warning thresholds
- Automatic expiry actions
- Reconnection-safe display

## 6. Artifact Runtime

An artifact instance includes:

```text
Definition reference
Schema version
Session
Owner
Creator
Recipients
Status
Workflow instance
Payload
Attachments
Version history
Visibility
Timestamps
```

### 6.1 Draft protection

- Autosave
- Local fallback during disconnection
- Server conflict detection
- Recovery after reconnect
- Explicit submission

### 6.2 Submission integrity

The runtime validates:

- Current phase
- Creator permission
- Required fields
- Recipient validity
- Workflow eligibility
- Schema version
- Duplicate submission rules

## 7. Workflow Runtime

A workflow instance contains:

- Current active nodes
- Completed nodes
- Assigned users or roles
- Deadlines
- Transition history
- Automation results
- Override history

### 7.1 Human tasks

Human tasks may be assigned to:

- Specific participant
- Role
- Team role
- Operator group
- First available eligible user
- All eligible reviewers

### 7.2 Parallel review

Support:

- Any one approval
- Majority approval
- Quorum
- Unanimous approval
- Lead approver after peer input

## 8. Communications Runtime

The runtime must enforce the communication matrix on every send operation.

Communication records include:

- Sender
- Recipient
- Channel
- Thread
- Content
- Attachments
- Approval state
- Delivery state
- Read state where appropriate
- Session phase
- Timestamp

## 9. Inject Runtime

An inject instance moves through:

```text
Pending → Eligible → Released → Acknowledged → Responded → Closed
```

The engine must support:

- Manual release
- Scheduled release
- Phase entry or exit
- Conditional release
- Cancellation
- Rescheduling
- Recipient-specific acknowledgement
- Required-response tracking

## 10. World-State Runtime

Current variable values are stored separately from variable definitions.

Every change creates a variable-change record containing:

- Variable
- Scope
- Previous value
- New value
- Operation
- Source event
- Source artifact or inject
- Actor
- Rationale
- Timestamp

State changes should be transactional with the adjudication or inject release that caused them.

## 11. Adjudication Runtime

### 11.1 Manual adjudication

The adjudicator reviews inputs and records outputs manually.

Required elements:

- Decision or outcome
- Rationale
- Evidence references
- Confidence or uncertainty
- Effects
- Publication scope

### 11.2 Rubric-assisted adjudication

The engine calculates a suggested score from weighted criteria.

The adjudicator may accept or override the suggestion. Overrides require rationale.

Example:

```text
Strategic coherence         20%
Capability availability     20%
Implementation feasibility  20%
Coalition support            15%
Target vulnerability         15%
Escalation risk              10%
```

### 11.3 Rules-based adjudication

Rules operate on validated facts and variables.

Example:

```text
IF committed resources meet the requirement
AND at least two partners support the action
AND target resilience is below 40
THEN suggest strong success.
```

Rules should generate an explanation trace showing which conditions passed or failed.

### 11.4 Plugin adjudication

Plugin execution flow:

1. Resolve approved input mappings.
2. Validate input schema.
3. Execute plugin in an isolated service.
4. Validate output schema.
5. Display suggested outcome.
6. Require human approval if configured.
7. Apply effects transactionally.
8. Record plugin version and execution metadata.

## 12. Multi-Perspective Adjudication

The engine should support separate reviewers for dimensions such as:

- Economic effects
- Diplomatic effects
- Information effects
- Operational feasibility
- Legal constraints
- Escalation risk
- Political sustainability

A lead adjudicator may synthesize these reviews into a final outcome.

## 13. Outcome Publication

An adjudication remains a draft until published.

Publishing may:

- Release narrative outcomes
- Reveal selected evidence
- Change variables
- Trigger injects
- Unlock phases
- Notify recipients
- Generate public or team-specific versions

## 14. Operator Console

The operator console must show:

- Session status
- Current phase
- Timer
- Connected participants
- Seat occupancy
- Required submission status
- Active workflow tasks
- Pending injects
- Adjudication queue
- Communication failures
- Validation or runtime warnings
- Event stream

## 15. Recovery Operations

Operators need controlled tools for:

- Reassigning participants
- Reopening artifacts
- Correcting recipients
- Releasing missed injects
- Reprocessing failed automation
- Extending deadlines
- Restoring session state
- Annotating corrections

No recovery action should erase original history.

## 16. Event Log

The event log is append-only and records:

```text
Event ID
Type
Actor
Role
Team
Session
Phase
Object
Previous state
New state
Timestamp
Causation
Correlation
Metadata
```

## 17. Captured History vs Reconstructed Narrative

The platform must distinguish:

- **Captured history** — timestamped events recorded during runtime.
- **Reconstructed narrative** — reports assembled from events, artifacts, and operator annotations.

Reports must not imply that reconstructed narrative is a raw event transcript.

## 18. Runtime Acceptance Tests

A simulation passes runtime validation when:

- Every required role can join.
- Each role receives the correct interface.
- Restricted content remains restricted.
- Required artifacts can be drafted and submitted.
- Workflows reach completion.
- Phase transitions behave as configured.
- Inject triggers execute once.
- State effects are traceable.
- Reconnection restores state.
- Reports reproduce the session history.

## 19. Decision-Centric Runtime Model

A decision is the participant or control authority’s committed choice; an action is one executable component of that decision. The runtime must preserve the decision trigger, owner, co-authors, supporting roles, information viewed, options considered where captured, constraints, confidence, submission timing, approval timing, actions, adjudication, outcomes, effects, and analytical measures.

## 20. Required State Machines

The runtime must implement explicit, testable state machines for scenario lifecycle, simulation run, decision, event, adjudication, capability, information delivery, export, and analysis lock. Invalid transitions are rejected server-side. Every completed transition emits a versioned event only after durable state change.

Recommended minimum decision lifecycle:

```text
Draft → Submitted → Under Review → Clarification Requested → Resubmitted
→ Approved → Adjudication Pending → Adjudicated → Effects Applied → Closed
```

Recommended event lifecycle:

```text
Draft → Scheduled → Armed → Triggered → Released → Acknowledged → Expired
```

## 21. White Cell Intervention Controls

Every intervention must record authority, reason, affected run and entities, previous state, resulting state, simulation time, wall-clock time, operator, evidence, and whether it is part of normal scenario control, adjudication, external-actor representation, technical recovery, or exceptional override. Intervention powers must be bounded, auditable, and visible in research exports according to classification policy.

## 22. Adjudication Doctrine and Precedent

Each adjudication model must declare whether it is structured-argument, expert-judgment, rules-based, model-supported, probability-based, or hybrid. Records must capture applicable rules, evidence, assumptions, confidence, disagreement, resolution, immediate effects, delayed effects, player-facing rationale, hidden analytical notes, and precedents consulted. Precedent is advisory unless a simulation explicitly makes it binding.

## 23. Deterministic Replay Test

Given the same scenario version, initial state, participant decisions, information deliveries, White Cell interventions, adjudications, model versions, and random seed, replay must reproduce the same event and state history except for explicitly documented nondeterministic integrations. Replay differences must produce a machine-readable divergence report.



---

## v1.2 Controlled Architecture Alignment Amendment (2026-10-17)

**Status:** Proposed for product owner, methodology lead, and technical lead ratification. This amendment supplements—not supersedes—the preceding v1.1 specification. If earlier text conflicts, the conflict is recorded in `CROSS_DOCUMENT_CONSISTENCY_MATRIX.md` and remains open until ratification; these decisions are not represented as deployed capabilities.

**Authoritative decision references:** GOV-001 through GOV-010 in `GOVERNING_DECISIONS_AND_ADRS.md`. **Scope:** v1.2 alignment only. **Explicit non-goal:** PostgreSQL physical or detailed logical schema implementation.

### A. Single-writer authoritative session protocol

- Each Session MUST have exactly one authoritative Runtime instance/deployment. Record monotonically increasing `authority_epoch`, and reject stale epochs on all consequential writes. Explicit, durable handover only.
- LAN-hosted Runtime can continue autonomously without Internet access; its locally hosted PostgreSQL and essential identity/package dependencies must remain available. Individual-device disconnection permits prepared drafts and allowed provisional commands, **not independent adjudication**.
- While disconnected from the authoritative Runtime, an offline participant MUST NOT finalize adjudication, trigger official phase transitions, or establish authoritative order of events. Timers displayed offline are informational estimates; reconnect rehydrates authoritative deadlines.

### B. Offline command acceptance contract

1. Client persists an offline command in a durable protected outbox with unique command ID, session/device identifier, expected aggregate version, governing release, locally asserted creation time, and payload.
2. On reconnect, authenticate session membership anew, check current authorization and effective revocations, check command ID/payload hash for idempotency, enforce authority fencing, and validate against pinned definition/activation compatibility.
3. Lock/serialize contested aggregate operations; commit valid state transition, command receipt, append-only evidence and notification outbox atomically.
4. Return one of `accepted`, `rejected`, `needs_review` or `already_processed` with stable machine-readable reasons; retain local user work and guided correction for conflicts.
5. Server receipt and sequence timestamps determine institutional ordering; device clocks only provide attributed client observations.

### C. Safe activation and recovery

- Existing workflow instances stay governed by the definition under which they were instantiated, unless a validated, operator-approved migration occurs. New workflows normally use the newly activated package. Security revocations always apply at the authoritative boundary and cannot retroactively erase previously cached information.
- A partially failed reactivation MUST be idempotent and recoverable; package activation and its evidence are in one transaction or coordinated by an explicitly recoverable transition.
- Add tests: two competing adjudicators, replayed offline command after successful commit but lost response, stale authority epoch, unexpected release activation during disconnection, expired membership, corrupt local payload, 500 participant-session workload assumption.
