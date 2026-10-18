# Plenum API, Event, Authorization, and Workflow Contracts

## Document Control

- **Document ID:** CEW
- **Version:** 1.0.0
- **Status:** Draft framework
- **Reads from:** PRD; Simulation Design Canon; Platform Architecture; Canonical Schema
- **Read by:** Database; frontend; runtime; testing; operations; implementation agents
- **Authority:** Defines executable interfaces and transitions required before implementation.

## 1. Contract-First Rule

API request/response schemas, event payloads, workflow state machines, state-transition rules, authorization policies, analytics definitions, and error/recovery behavior must be approved before implementation. Contracts are versioned artifacts and must reference canonical entities.

## 2. API Operation Contract

Every operation defines operation ID, route, method, purpose, actor, permission, request schema, response schema, validation, errors, idempotency, audit behavior, rate limits, version, related events, and related workflow transition.

Required domains include authentication, organizations, workspaces, users, scenarios, scenario versions, validation, runs, teams, assignments, state, decisions, approvals, events, information release, capabilities, resources, adjudication, communications, measurements, analytics, audit, replay, export, and administration.

## 3. Command Semantics

Mutating operations are commands. Retryable commands require a client-generated idempotency key and return the durable aggregate version. Commands must reject stale aggregate versions where optimistic concurrency is required. A successful response means the state transition is durable, not merely queued.

## 4. Event Contract

Every event defines name, version, producer, consumers, trigger, payload schema, correlation ID, causation ID, run ID, scenario version, aggregate ID and version, ordering requirement, delivery guarantee, retry, deduplication, dead-letter behavior, retention, and classification.

Core events include run created/started/paused/resumed/completed, phase started/completed, decision created/submitted/approved, clarification requested, adjudication requested/completed, state changed, event triggered/released, information released/viewed/acknowledged, capability allocated/degraded, resource consumed, objective status changed, intervention recorded, analysis locked, and export generated.

## 5. Workflow Contract

Every workflow defines name, aggregate, initial state, terminal states, allowed transitions, actor, permission, preconditions, required data, side effects, events emitted, audit requirements, timeout behavior, failure behavior, retry behavior, and recovery behavior.

Required state machines include scenario lifecycle, run lifecycle, phase lifecycle, decision lifecycle, approval lifecycle, event lifecycle, information-delivery lifecycle, adjudication lifecycle, capability lifecycle, export lifecycle, and analysis lock.

## 6. Authorization Contract

Every protected operation and query must define subject attributes, object attributes, environmental attributes, allowed action, denial reasons, classification constraints, and audit behavior. Unauthorized information must not be sent to the client and hidden fields must not rely on frontend filtering.

## 7. Error Contract

Errors use stable codes and distinguish validation failure, authorization denial, not found, conflict, invalid transition, stale version, duplicate command, dependency unavailable, timeout, rate limit, and internal failure. Responses must state whether retry is safe and expose a correlation ID without leaking protected details.

## 8. Compatibility

Breaking API or event changes require a new version or explicit migration. Published scenarios and historical runs retain their original contract references. Consumers must declare supported versions and contract tests must verify compatibility.

## 9. Coherence Checklist

- Each API field and event field resolves to the canonical model.
- Each event has one owning producer.
- Ordering and duplicate handling are explicit.
- Workflow authority and recovery are explicit.
- Authorization is enforced server-side.
- Contracts do not expose information outside policy.
- Test fixtures and examples exist for every critical contract.

## 10. Identity and Run-Onboarding Contracts

### 10.1 Required API domains

At minimum, specify contracts for:

```text
POST /runs/{runId}/invitations
POST /invitations/{token}/accept
POST /runs/{runId}/join
POST /runs/{runId}/waiting-room/{participantId}/admit
POST /runs/{runId}/waiting-room/{participantId}/reject
POST /runs/{runId}/seats/{seatId}/claim
POST /runs/{runId}/assignments
POST /runs/{runId}/assignments/{assignmentId}/reassign
POST /runs/{runId}/participants/{participantId}/ready
POST /runs/{runId}/participants/{participantId}/readiness-override
POST /runs/{runId}/participants/{participantId}/active-role
POST /runs/{runId}/devices/activate
POST /runs/{runId}/principals/{principalId}/revoke
GET  /runs/{runId}/readiness
GET  /runs/{runId}/access-context
```

Every operation must define actor, required permission, identity assurance, idempotency, validation, events emitted, and audit behavior.

### 10.2 Core events

```text
run_invitation_issued
run_invitation_accepted
run_join_requested
participant_admitted
participant_rejected
seat_reserved
seat_claimed
participant_assignment_created
participant_assignment_changed
participant_role_context_changed
participant_readiness_changed
participant_readiness_overridden
participant_disconnected
participant_reconnected
principal_access_revoked
device_identity_activated
device_identity_revoked
```

Events must include run ID, scenario version, principal ID, participant ID where applicable, assignment ID, actor, correlation ID, causation ID, timestamp, and security classification.

### 10.3 Participant onboarding state machine

```text
Invited
-> Identity Pending
-> Assignment Pending
-> Waiting Room
-> Admitted
-> Readiness Incomplete
-> Ready
-> Active
-> Completed
```

Permitted alternative states include `Declined`, `Rejected`, `Removed`, `Revoked`, and `Expired`.

### 10.4 Seat lifecycle

```text
Open
-> Reserved
-> Occupied
-> Vacated
-> Open
```

A seat may also be `Disabled`. Occupancy transitions must be transactional with participant-assignment transitions.

### 10.5 Reassignment workflow

A reassignment command must validate authority, target-seat eligibility, occupancy, conflict rules, information-exposure policy, and run state. Completion emits an assignment-change event and forces access-context refresh.

### 10.6 Active-role context contract

A multi-role subject must select one currently authorized role context before performing role-sensitive actions. Commands must reject inactive, expired, or incompatible contexts.

### 10.7 Attribution contract

Every consequential command and artifact transition must include or derive:

- acting principal;
- run participant or operator identity;
- active assignment;
- active role;
- represented team where applicable;
- command timestamp;
- correlation and causation identifiers.

Frontend-supplied attribution must be verified against server-side assignment state.

## 18. Customization, Asset, and Plugin Contracts

Required API domains include:

```text
/organization-brand-profiles
/simulation-brand-profiles
/semantic-themes
/interface-profiles
/terminology-profiles
/assets
/assets/{assetId}/variants
/plugins
/plugin-installations
/simulation-plugin-enablement
/plugin-executions
```

Required events include:

- `organization_brand_profile_updated`
- `simulation_brand_profile_updated`
- `semantic_theme_validated`
- `asset_uploaded`
- `asset_processed`
- `asset_quarantined`
- `interface_profile_updated`
- `terminology_profile_updated`
- `plugin_installed`
- `plugin_enabled_for_simulation`
- `plugin_disabled_for_simulation`
- `plugin_execution_requested`
- `plugin_execution_completed`
- `plugin_execution_failed`
- `plugin_output_approved`
- `plugin_output_rejected`

A plugin output that requests a state transition must enter an approved workflow. It cannot call the state-management persistence layer directly.


---

# Controlled architecture reconciliation addendum — v1.2 (2026-10-17)

**Status:** TARGET protocol requirements; concrete OpenAPI/JSON Schema contracts still require design and review.

## Canonical contract identity and terminology
Use **Session** for execution instance, **Simulation Release** for immutable executable package, **Definition Revision** for immutable authoring snapshot, **Seat/Assignment** for participant role attribution, **Decision Record** and **Evidence Event** distinctly. Pre-existing `run`, `scenario version`, and `principal` fields in this draft are **legacy ambiguous identifiers**, not silently accepted canonical aliases. Build an explicit compatibility mapping before publishing any external API.

## Disconnected Runtime command envelope (normative shape, not final JSON Schema)
Each attempted authoritative mutation includes a unique session-scoped `commandId`, `sessionId`, authenticated device context, `aggregateId`, `expectedAggregateVersion`, governing `releaseId`, `operationType`, payload, and device-observed time. The server supplies verified identity, authority epoch, arrival time, and commit sequence. Client timestamps are observational, not authoritative for deadlines. A successful command result means durably committed, not merely saved locally.

## Command outcomes
Distinguish `local_pending` (client-only), `received`, `accepted` (committed), `rejected`, and `needs_reconciliation`. The API must expose idempotent command result lookup, resumable ordered deltas with cursors, projection snapshot refresh, and a bound on queue or history retention. The same command ID plus different payload digest must fail. The server enforces current authorization, revocation, release compatibility, workflow state, and optimistic concurrency on retry.

## Single-authority adjudication
Consequential commands are accepted only by the designated Session Authority within its fenced authority epoch. Disconnected devices cannot finalize adjudication; client-side proposed operations are provisional until accepted. Passive replicas must not acknowledge authoritative success. No automatic dual-writer cloud/LAN failover.

## Studio collaboration is a separate contract
Studio may merge CRDT draft updates, but document convergence does not imply valid domain configuration. Published revision compilation requires authoritative validation and a revision boundary that deterministically freezes the merged state.

## Evidence and publication events
Durable runtime mutation and its Evidence Event are atomic, with downstream notifications through an outbox. Tamper-evident institutional checkpoint creation/verification, activation approval, authority transfer, command rejection, offline projection refresh and participant access revocation require versioned event contracts, classifications and negative authorization tests.

## Unresolved before implementation
Exact endpoint names, transport, delivery ordering, cursor scope, retention windows, offline identity expiry, key custody, recovery RPO/RTO and concrete schemas are recorded in `DECISION_APPROVAL_REGISTER.md`; no production guarantees are claimed here.
