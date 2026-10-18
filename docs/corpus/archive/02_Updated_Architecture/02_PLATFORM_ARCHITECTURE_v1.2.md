# Plenum Studio Platform and System Architecture

## Document Control

- **Document ID:** TSD
- **Version:** 1.2.0 (controlled alignment draft; retains v1.1 body)
- **Status:** Draft for review
- **Owner:** Plenum product owner
- **Approvers:** Product owner; simulation-methodology lead; technical lead
- **Reads from:** PRD; Simulation Design and Research Canon
- **Read by:** Canonical Schema; Contracts; Data/Security; Runtime; Design Studio; Implementation Roadmap
- **Authority:** Defines system boundaries, components, architectural principles, authoritative sources, trust boundaries, failure model, and platform-level technical decisions.
- **Out of scope:** Decisions explicitly governed by another document in the specification hierarchy.

## 1. Architectural Objective

The architecture must separate the stable Plenum platform from simulation-specific definitions. New simulations should be created by producing configuration and content, not source-code branches.

## 2. Logical Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      PLENUM DESIGN STUDIO                   │
│ Scenario │ Teams │ Roles │ Forms │ Flows │ Injects │ Theme │
└──────────────────────────────┬──────────────────────────────┘
                               │ validates and publishes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              VERSIONED SIMULATION PACKAGE                  │
│ Definition │ Schemas │ Content │ Assets │ Rules │ Reports  │
└──────────────────────────────┬──────────────────────────────┘
                               │ interpreted by
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     PLENUM RUNTIME ENGINE                   │
│ Sessions │ Identity │ Policy │ State │ Events │ Workflows  │
│ Realtime │ Messaging │ Injects │ Adjudication │ Reporting  │
└──────────────────────────────┬──────────────────────────────┘
                               │ assembles
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 ROLE-SPECIFIC USER SURFACES                 │
│ Participants │ Facilitators │ White Cell │ SMEs │ Observers │
└─────────────────────────────────────────────────────────────┘
```

## 3. Architectural Layers

### 3.1 Presentation layer

A shared application shell renders dynamic modules based on:

- Organization
- Simulation version
- Session
- Team
- Role
- Current phase
- Permissions
- Feature flags
- Device and accessibility context

The presentation layer must not contain simulation-specific assumptions such as Blue Team, Move 1, or Strategic Orientation.

### 3.2 Application services layer

Core services include:

- Identity and membership service
- Authorization and policy service
- Simulation-definition service
- Publishing and versioning service
- Session service
- Phase and timer service
- Artifact service
- Workflow service
- Communication service
- Inject service
- State and variable service
- Adjudication service
- Notification service
- Reporting and export service
- Audit and event service

### 3.3 Data layer

Use PostgreSQL for relational integrity, JSONB for dynamic payloads, object storage for assets, and an append-only event log for authoritative operational history.

### 3.4 Integration layer

The integration layer supports:

- External adjudication models
- AI-assisted design services
- Learning management systems
- Identity providers
- Analytics platforms
- Data warehouses
- Notification providers
- Geospatial services

## 4. Recommended Application Structure

```text
apps/
  studio/
  runtime/
  operator-console/
  admin/

packages/
  simulation-schema/
  policy-engine/
  workflow-engine/
  runtime-components/
  form-renderer/
  event-contracts/
  adjudication-sdk/
  reporting-engine/
  design-system/
  validation-engine/

definitions/
  fractured-order/
  templates/
```

A monorepo is recommended during the extraction phase to ensure shared types and contracts remain synchronized.

## 5. Generic Routing Model

Avoid role-specific static pages.

Recommended routes:

```text
/studio/simulations/:simulationId
/studio/simulations/:simulationId/versions/:versionId
/session/:sessionId
/session/:sessionId/team/:teamId/role/:roleId
/session/:sessionId/operator/:operatorRoleId
/admin/organizations/:organizationId
```

The runtime resolves the interface from context rather than route-specific source files.

## 6. Simulation Package

A published simulation package contains:

```text
manifest.json
simulation.json
teams.json
roles.json
phases.json
forms.json
workflows.json
injects.json
variables.json
adjudication.json
interfaces.json
reports.json
content-index.json
assets/
```

The physical package may be stored relationally rather than as files, but export and import should use a portable package representation.

## 7. Runtime Context Resolution

Every request should resolve a runtime context:

```typescript
interface RuntimeContext {
  organizationId: string;
  simulationVersionId: string;
  sessionId: string;
  participantId: string;
  teamIds: string[];
  roleIds: string[];
  phaseId: string;
  permissions: string[];
  featureFlags: string[];
}
```

All content, actions, fields, transitions, and interface modules are evaluated against this context.

## 8. Policy and Authorization Engine

Authorization must be centralized. Frontend hiding is not sufficient.

A policy decision should evaluate:

```text
subject + action + resource + simulation context + session state
```

Example:

```json
{
  "subject": "participant-123",
  "action": "artifact.submit",
  "resource": "action-draft-456",
  "context": {
    "team": "team-blue",
    "role": "team-lead",
    "phase": "round-1-submission",
    "sessionStatus": "active"
  }
}
```

Policies should be enforced in application services and database row-level security where appropriate.

## 9. State Management Model

The platform must distinguish:

1. **Definition state** — design-time configuration.
2. **Published version state** — immutable simulation package.
3. **Session state** — current phase, timers, assignments, and world state.
4. **Artifact state** — drafts, submissions, reviews, and published outcomes.
5. **Event history** — append-only record of what occurred.
6. **Derived views** — dashboards and reports reconstructed from authoritative data.

## 10. Event-Driven Runtime

Important state changes should emit domain events.

Examples:

```text
session.created
participant.joined
participant.assigned
phase.started
phase.completed
timer.paused
artifact.created
artifact.submitted
workflow.step.completed
message.sent
inject.released
adjudication.finalized
variable.changed
session.ended
export.generated
```

Each event should contain:

```typescript
interface DomainEvent<TPayload> {
  id: string;
  type: string;
  occurredAt: string;
  actorId?: string;
  sessionId?: string;
  simulationVersionId: string;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
  metadata: Record<string, unknown>;
}
```

## 11. Realtime Architecture

Realtime updates are required for:

- Phase changes
- Timer synchronization
- Participant presence
- New messages
- Inject release
- Workflow queue changes
- Adjudication status
- Variable changes
- Notifications

Requirements:

- Reconnection must restore authoritative server state.
- Client-side drafts must survive temporary disconnection.
- Commands must be idempotent.
- Duplicate events must not create duplicate effects.
- Presence should not be treated as authoritative participation history.
- Operators must have a session-health view.

## 12. Workflow Engine Architecture

A workflow definition describes nodes, transitions, assignments, deadlines, and actions.

A workflow instance tracks execution for a specific artifact.

The engine must support:

- Human tasks
- Automated tasks
- Conditional branches
- Parallel review
- Quorum or unanimous approval
- Return for revision
- Deadlines and escalation
- Cancellation
- Operator override

## 13. Form Rendering Architecture

Forms are rendered from versioned schemas.

Recommended components:

- JSON Schema-compatible field definitions
- UI schema for layout and display
- Validation schema
- Conditional rule definitions
- Permission rules at form, section, and field level

Submitted data must reference the exact schema version used at submission time.

## 14. Interface Composition Architecture

Each role-phase interface is a composition of modules.

```json
{
  "roleId": "team-lead",
  "phaseId": "round-1",
  "layout": {
    "regions": [
      {
        "id": "main",
        "modules": ["situation-brief", "action-workspace"]
      },
      {
        "id": "sidebar",
        "modules": ["timer", "objectives", "notifications"]
      }
    ]
  }
}
```

Modules have stable platform contracts. Designers configure placement, visibility, labels, and allowed actions.

## 15. Adjudication Plugin Architecture

External models should use a controlled plugin contract.

```typescript
interface AdjudicationPlugin {
  manifest: PluginManifest;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  evaluate(input: AdjudicationInput): Promise<AdjudicationOutput>;
}
```

Plugins must not receive unrestricted database access. Inputs are explicitly mapped and outputs require validation before effects are applied.

## 16. Reporting Architecture

Reports should use a declarative definition:

```text
Audience
Data scope
Filters
Sections
Tables
Charts
Narrative templates
Anonymization rules
Output formats
```

Report generation should read immutable event and artifact history rather than transient interface state.

## 17. Technology Recommendations

### Frontend

- React and TypeScript
- Vite or Next.js
- React Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- dnd-kit
- React Flow

### Backend

- Supabase PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage
- Edge Functions or a dedicated application service where complexity requires it

### Testing

- Vitest for unit and contract tests
- Playwright for full-session simulation tests
- Schema compatibility tests
- Permission-matrix tests
- Synthetic participant rehearsal tests

## 18. Architecture Decision Records Required

The engineering team should create formal decisions for:

- Monorepo structure
- Event sourcing depth
- JSON Schema compatibility
- Workflow-engine implementation
- Policy-engine implementation
- Offline draft strategy
- Plugin isolation
- Version migration
- Report generation
- Multitenancy and row-level security

## 19. Authoritative Source Matrix

The architecture must assign exactly one authoritative subsystem for current simulation time, scenario version, role assignment, access policy, decision status, event status, adjudication status, current state, capability availability, resource balances, and measurement values. Caches and client stores are projections and may never become independent authorities.

## 20. Trust Boundaries and Isolation

Isolation must be defined and tested across organization, workspace, simulation template, scenario version, simulation run, team, participant, observer scope, and analytical project. Authorization combines role-based and attribute-based policy using organization, workspace, run, team, role, phase, information classification, decision ownership, event-release state, observer status, and White Cell function.

## 21. Failure Model

The platform must specify recovery behavior for client disconnection, stale client state, service failure, database unavailability, duplicate commands, out-of-order events, failed event delivery, failed state transition, partial adjudication, notification failure, and export failure. Retryable commands require idempotency keys. Side effects must be transactional or compensatable. Dead-lettered events require an operator-visible recovery path.

## 22. Engineering Invariants

- Simulation time is distinct from wall-clock time and is server-authoritative.
- Published scenario versions are immutable.
- Active runs resolve to immutable configuration, rules, interface definitions, model versions, and random seeds where applicable.
- State changes occur only through approved state-transition services.
- Authorization is evaluated server-side before data are returned.
- Audit events are append-only.
- Cross-context communication uses versioned contracts.
- Raw observations remain separate from derived analytical products.
- Deterministic replay is required where feasible; documented nondeterminism must be bounded and reproducible through captured inputs.


## 23. Identity and Run-Access Architecture

### 23.1 Identity separation

The architecture must separate persistent identity from run-scoped participation:

```text
UserAccount
  -> RunParticipant
       -> ParticipantAssignment
            -> TeamInstance
            -> RoleInstance
            -> SeatInstance
```

Authentication establishes who the subject is. Run authorization determines whether that subject may enter a run and what the subject may see or do.

### 23.2 Identity service responsibilities

The identity and access subsystem owns:

- Persistent user accounts.
- External identity-provider bindings.
- Passwordless and SSO authentication.
- Multi-factor authentication status.
- Guest identity creation and expiry.
- Device identity registration and revocation.
- Authentication session issuance and invalidation.

It does not own team membership or run authority; these belong to the simulation-run assignment service.

### 23.3 Run access resolver

Every request against a live run must resolve an access context containing:

```typescript
interface RunAccessContext {
  userId?: string;
  guestIdentityId?: string;
  deviceIdentityId?: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  participantId?: string;
  assignmentIds: string[];
  activeRoleId?: string;
  activeTeamId?: string;
  seatId?: string;
  operatorRoleIds: string[];
  authenticationStrength: string;
  sessionStatus: string;
  phaseId?: string;
}
```

The policy engine must reject access when required fields cannot be resolved or when the active context is inconsistent with the stored assignments.

### 23.4 Invitation and join architecture

Invitation tokens must be opaque, single-purpose, expiring, revocable, and stored only as hashes. A token may bind a recipient to a run, team, role, and seat, but final access is granted only after successful identity verification and assignment activation.

Session codes identify a run but do not grant access by themselves. The join flow must evaluate run configuration, identity verification, seat eligibility, capacity, waiting-room policy, and operator approval.

### 23.5 Guest identities

Guest identities are run-limited principals. They must have:

- A generated stable identifier.
- A display name and optional verified contact.
- Explicit run and assignment scope.
- An expiry policy.
- Revocation state.
- Audit continuity after access expires.

Guest identities must not silently become organization members or persistent platform accounts.

### 23.6 Device identities

Shared displays use non-human device principals. Device authentication should use short-lived activation codes followed by rotated device credentials. Authorization is limited to approved read-only interface profiles and information classifications.

### 23.7 Session and reconnection model

Client sessions are not authoritative for assignment or permission. On connection and reconnection, the server must reload the current run access context. Draft restoration may use local caching, but publication, submission, approval, state change, and communication remain server-authoritative.

### 23.8 Reassignment consistency

Participant reassignment must occur through a transactional assignment service that:

1. closes or time-bounds the prior assignment;
2. creates the new assignment;
3. records the authorization and reason;
4. recalculates access policies;
5. invalidates or refreshes active sessions;
6. emits assignment-change events;
7. preserves historical attribution.

Previously viewed information cannot be technically unlearned. Cross-team or cross-clearance reassignment must therefore create an information-exposure warning for operators.


---

## v1.2 Controlled Architecture Alignment Amendment (2026-10-17)

**Status:** Proposed for product owner, methodology lead, and technical lead ratification. This amendment supplements—not supersedes—the preceding v1.1 specification. If earlier text conflicts, the conflict is recorded in `CROSS_DOCUMENT_CONSISTENCY_MATRIX.md` and remains open until ratification; these decisions are not represented as deployed capabilities.

**Authoritative decision references:** GOV-001 through GOV-010 in `GOVERNING_DECISIONS_AND_ADRS.md`. **Scope:** v1.2 alignment only. **Explicit non-goal:** PostgreSQL physical or detailed logical schema implementation.

### A. Execution and deployment topology

- The Studio, compiler/registry, Runtime, and evidence capabilities are **logical modules**, not automatically independently deployed services. Begin with a modular monolith and PostgreSQL, plus object storage and a background job worker as needed.
- Run the same portable application in cloud, on-premises LAN, and fully air-gapped institutional environments; air-gapped installations MUST NOT require outbound cloud services for exercise-critical functions. Local authentication, package validation, storage, backup and cryptographic verification MUST be operable without Internet access.
- Each live Session MUST have exactly one authoritative Runtime writer at a time, bound to a `deployment_id` and monotonically increasing `authority_epoch` (fencing token). A connection timeout MUST NOT independently elect a competing writer. Authority transfer requires explicit, durable fencing and recovery procedure. Automatic cloud-to-local failover is outside v1.2 scope.
- An offline individual client is **not** a second session authority. It can retain pre-authorized views, draft inputs, and provisional outbound commands.

### B. Consistency boundaries

- Studio drafts use collaborative document convergence (CRDT candidate: Yjs); package publication MUST validate merged documents against referential, methodological and visibility invariants. Document merge MUST NOT directly mutate a published Release.
- Runtime consequential commands (adjudication, phase/workflow transition, release activation, policy mutation) are handled by an authoritative transactional command processor—not CRDT merging.
- A durable server-side outbox is paired transactionally with state mutations and evidence insertion; WebSocket/SSE delivery is a post-commit projection and may be replayed safely.

### C. Safe release activation

- Published packages are immutable; sessions record activation events linking old and new release versions. Existing workflow instances are pinned to governing definitions unless an explicit, validated migration is approved.
- Changes are classified into safe prospective changes, potentially compatible changes, and consequential changes requiring impact review. Disconnected commands MUST be checked against applicable historical definitions **and** current authorization revocations. No unseen offline work is assumed absent.

### D. Revised capacity assumptions and failure tests

- Planning workload: 500 participants/session × 10 concurrent sessions = up to 5,000 active participants across sessions. This is a sizing assumption, not a benchmark, SLA or commitment.
- Prove LAN continuity during Internet outage, individual client replay after disconnection, no double adjudication, authority fencing, eventual draft convergence, and institutional backup/restore in representative load tests.
