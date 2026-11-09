# Plenum Studio — Platform and System Architecture

## Document control

| Field | Value |
|---|---|
| Document ID | TSD |
| Number | 02 |
| Version | 1.3.3 |
| Date | 2026-11-08 |
| Status | Draft for review. v1.2 amendments merged into the body (DEC-26). |
| Owner | Technical Lead |
| Approvers | Product Owner; Methodology Lead; Technical Lead (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 08 Canon; Decision Register; Glossary |
| Read by | 03 Schema; 04 Studio; 05 Runtime; 06 Data, Security and Reporting; 07 Roadmap; 09 Contracts; 10 Extension Framework; 11 Polling and Voting; 12 Voice and Radio |
| Authority | System boundaries, components, code and deployment topology, authoritative sources, trust boundaries, failure model, technology stack. Holds the rationale for ADRs listed in the Decision Register. |
| Supersedes | `02_PLATFORM_ARCHITECTURE_v1.2.md` |

---

## 1. Architectural objective

Separate the stable Plenum platform from simulation-specific definitions. New simulations are produced as configuration and content (a Simulation Release), never as source-code branches (REQ-024, INV-022).

## 2. Logical architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         PLENUM STUDIO                                │
│ Overview │ Teams │ Roles & Seats │ Stages │ Artifacts │ Workflows   │
│ Information Policy │ Injects │ State │ Adjudication │ Interfaces    │
│ Polls │ Voice Channels │ Plugins and Model Compositions             │
│ Collaborative Draft (CRDT) ── validate ── freeze ── review/approve    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ Definition Revision ── compile
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                SIMULATION RELEASE (immutable, digested)              │
│ Manifest │ Core Design │ Scenario │ Forms │ Workflows │ Policies     │
│ Interfaces │ Reports │ Plugin lockfile │ Compositions │ Assets      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ instantiate / activate
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        PLENUM RUNTIME                                │
│ Session Authority │ Command processor │ Policy engine │ Stage/timer │
│ Workflow │ Messages │ Polls │ Voice control │ Injects │ State       │
│ Adjudication │ Effect Proposals and approval                       │
│ Evidence journal │ Outbox │ Projections │ Realtime │ Reporting      │
└──────────┬──────────────────────────────────────────┬────────────────┘
           │ policy-filtered projections               │ mapped inputs / validated outputs
           ▼                                           ▼
┌───────────────────────────────────┐   ┌──────────────────────────────┐
│     ROLE-SPECIFIC SURFACES        │   │ EXTENSION HOST (isolated;    │
│ Participants │ Control staff │    │   │ ADR-018) — Plugins propose   │
│ Adjudicators │ Observers │ Displays│  │ effects only (DEC-54)        │
└──────────────┬────────────────────┘   └──────────────────────────────┘
               │ WebRTC audio with scoped Media Credentials (ADR-017)
               ▼
┌───────────────────────────────────┐
│ MEDIA PROVIDER (SFU, TURN; own    │
│ boundary, no Plenum DB — DEC-49)  │
└───────────────────────────────────┘
```

## 3. Architectural layers

### 3.1 Presentation

A shared application shell (React and TypeScript, ADR-007) renders modules according to the Session Access Context (§8): Organization, Release, Session, Seat Assignments, Active Role Context, Stage, permissions, feature flags, device and accessibility context.

The presentation layer contains no simulation-specific assumptions such as team names, Stage names or Session Role names (INV-022).

### 3.2 Application services

All services are modules inside one deployable application (ADR-005).

| Service | Responsibility |
|---|---|
| Identity and membership | Persons, Organization Memberships, Organization Roles, Guest Identities, Display Principals, Devices |
| Authorization and policy | Role- and attribute-based decisions; Information Policy evaluation; projection filtering |
| Studio draft | Collaborative Draft storage and CRDT exchange (ADR-002) |
| Validation | Structural and methodological validation (REQ-011, 08 Canon §3) |
| Release compiler and registry | Definition Revisions, compilation, Simulation Releases, Packages |
| Session | Session lifecycle, Session Authority, Release Activations |
| Seat and assignment | Seats, Seat Assignments, joins, reassignment |
| Stage and timer | Server-authoritative progression and time |
| Artifact and workflow | Artifacts, Workflow Instances, transitions |
| Communication | Message Channels, routes, Messages |
| Polling and voting | Polls, Electorates, Ballots, Tallies, Certifications (11) |
| Voice control | Voice Channels, grants, Floor Leases, Consent Records, Media Provider Adapter (12) |
| Inject | Inject Instances and release |
| State | State Variables, State Values, Capabilities, Resources, Effects |
| Adjudication | Adjudication Requests and Records |
| Extension | Plugin registry and installations, Model Composition runs, Effect Proposals, Approval Decisions; drives the Extension Host (10) |
| Command processor | Idempotent, serialized command execution with evidence (§12) |
| Evidence | Evidence Events, Checkpoints, Anchors (ADR-003) |
| Projection and sync | Per-Participant projections, cursors, delta delivery (§14) |
| Notification | Delivery of notifications through the outbox |
| Reporting and export | Reports, exports, research packages |
| Audit | Administrative Audit Records |

### 3.3 Data

PostgreSQL 18 (ADR-009) as the transactional system of record, organized into schemas `identity`, `studio`, `registry`, `runtime`, `sync`, `evidence` (ADR-005) plus `extension`, `voting` and `comms` (ADR-016); JSONB for schema-governed payloads; S3-compatible object storage for assets and Packages (ADR-011); relational current state plus the append-only Evidence Event journal (ADR-014). Table design is owned by the PostgreSQL Logical Data Model.

### 3.4 Integration

| Integration | Mechanism |
|---|---|
| Plugins (DEC-60 categories) | Extension Framework (10); summary §18 |
| Voting Method and Media Provider Adapters | Platform Adapters (DEC-59; 11 §8, 12 §2) |
| Voice media server | WebRTC SFU and TURN behind the Media Provider Adapter (ADR-017) |
| Identity providers | OIDC and SAML through Keycloak or a customer IdP (ADR-012) |
| Learning management systems | Export and identity federation |
| Analytics platforms and data warehouses | Research exports (06) |
| Notification providers | Outbox-driven adapters; disabled in air-gapped profile unless local |
| Geospatial services | Visualization and spatial Plugin category (DEC-60) |

AI-assisted design services are not part of the integration layer (DEC-41; PRD Appendix A).

## 4. Code organization

One monorepo shares types and contracts between frontend and backend (ADR-008). **Code topology is not deployment topology:** these folders build into one deployable server plus static frontends.

```text
apps/
  studio/              # Designer workstation (React/TS)
  runtime-web/         # Participant and control-staff surfaces (React/TS)
  operator-console/    # Session operation (React/TS)
  admin/               # Organization administration (React/TS)
  server/              # Single deployable application (Node.js/TS)

packages/
  simulation-schema/   # Canonical types, JSON Schema export (03)
  validation-engine/
  release-compiler/
  policy-engine/
  workflow-engine/
  form-renderer/
  event-contracts/     # Commands, events, error codes (09)
  sync-client/         # Offline outbox, projection cursor (09)
  plugin-sdk/          # Manifest schema, fixture runner, contract harness, signing (10 §5)
  extension-host/      # Isolated execution supervisor (ADR-018)
  media-adapter/       # Media Provider Adapter interface (12)
  reporting-engine/
  design-system/

definitions/
  fractured-order/     # Reference Release source
  templates/

reference/
  plenum_runtime_slice/  # Vanilla JS reference slice (ADR-007)
```

## 5. Deployment profiles

All profiles run the same OCI images (ADR-013, REQ-065).

| Component | Cloud profile | Institutional profile | Air-gapped profile |
|---|---|---|---|
| Application server and worker | Managed container service | Compose or Podman on institutional hosts; Kubernetes optional | Compose or Podman from offline bundle |
| PostgreSQL 18 | Managed service | Packaged | Packaged |
| Object storage | Provider S3 | Garage, SeaweedFS or Ceph RGW | Garage, SeaweedFS or Ceph RGW |
| Identity | Keycloak or customer IdP over OIDC | Bundled Keycloak, optional federation | Bundled Keycloak, local accounts |
| Plugins | Approved; external-service Plugins allowed | Approved; installed per Organization | Local Plugins only, from signed offline bundles (DEC-56) |
| Extension Host | Bundled image | Bundled image | Bundled image |
| Voice media | SFU and TURN images (DEC-49) | SFU and TURN on institutional hosts | SFU and TURN from offline bundle; zero public egress |
| Updates | Continuous | Institution-scheduled | Signed offline bundles (OPEN-020) |

Air-gapped installations must not require any outbound call for authentication, Package validation, storage, backup or cryptographic verification (REQ-005).

### 5.1 Session authority across profiles

Each live Session has exactly one Session Authority (ADR-001, INV-017), bound to a Deployment ID and an Authority Epoch. A connection timeout never elects a new writer. Authority transfer follows resolved OPEN-016 (Decision Register §7.3); its readiness and timing claims require the evidence in §7.5. Automatic cloud-to-LAN failover is out of scope. For air-gapped Sessions, authority is local from creation.

An individually disconnected client is never a second authority: it may keep authorized views, Drafts and an Offline Outbox (INV-018).

## 6. Routing model

Routes carry identifiers, never role or team names. The interface is resolved from the Session Access Context.

```text
/studio/projects/:projectId
/studio/projects/:projectId/revisions/:revisionId
/studio/projects/:projectId/releases/:releaseId
/sessions/:sessionId
/sessions/:sessionId/operate
/admin/organizations/:organizationId
```

## 7. Simulation Release and Package

A Simulation Release is stored relationally and in object storage (06, Data Model). Its portable Package form contains:

```text
manifest.json              # identity, digest, schema and compiler versions, provenance
core-design/
  methodology.json         # enabled Methodology Concepts
  teams.json
  session-roles.json
  seats.json
  stages.json
  activities.json
  artifact-types.json
  forms.json
  workflows.json
  information-policies.json
  communications.json
  state-variables.json
  capabilities.json
  resources.json
  adjudication-models.json
  interfaces.json
  reports.json
  plugin-bindings.json
  measurements.json
scenario/
  content-index.json
  injects.json
  initial-state.json
  objectives.json
assets/
```

Package signing policy is OPEN-020. Identity and digest verification are mandatory regardless.

## 8. Session Access Context

Every Runtime request resolves one server-side context. It replaces the earlier `RuntimeContext` and `RunAccessContext`.

```typescript
interface SessionAccessContext {
  principalId: string;
  principalType: "person" | "guest" | "display" | "service";
  deviceId?: string;
  organizationId: string;
  sessionId: string;
  sessionStatus: string;
  participantId?: string;
  seatAssignmentIds: string[];
  activeSessionRoleId?: string;
  activeSessionTeamId?: string;
  seatId?: string;
  organizationRoles: string[];      // Admin, Designer, Publisher, Operator, Reviewer, Research Analyst (DEC-61)
  stageId?: string;
  activeReleaseId: string;
  authenticationStrength: string;
  featureFlags: string[];
}
```

The policy engine rejects a request when a required field cannot be resolved or when the active context conflicts with stored Seat Assignments.

## 9. Policy and authorization

Authorization is centralized and server-side (REQ-047, INV-002). A decision evaluates:

```text
principal + action + resource + Release context + Session state
```

```json
{
  "principal": "participant-123",
  "action": "artifact.submit",
  "resource": "artifact-456",
  "context": {
    "sessionTeam": "team-a",
    "sessionRole": "scribe",
    "stage": "stage-1",
    "sessionStatus": "active"
  }
}
```

Layering (ADR-015): tenant identity from authenticated context only; PostgreSQL row-level security as defense in depth under a non-owner role; Information Policy and projection filtering in the application policy engine. Policies compile to a bounded evaluator; authored configuration never becomes executable SQL.

## 10. State model

| State | Mutability | Owner |
|---|---|---|
| Draft | Mutable, collaborative | Studio draft service |
| Definition Revision | Immutable | Release registry |
| Simulation Release | Immutable | Release registry |
| Session state (status, Stage, timers, Seat Assignments, State Values) | Mutable through Commands | Runtime services |
| Artifact and Workflow Instance state | Mutable through Commands; pinned to Governing Release | Artifact and workflow service |
| Evidence Events | Append-only | Evidence service |
| Projections, reports, dashboards | Derived; rebuildable | Projection and reporting services |

## 11. Authoritative sources

Each class of truth has exactly one owner (INV-019). Caches and client stores are projections.

| Truth | Authoritative owner |
|---|---|
| Simulation time and Stage | Stage and timer service |
| Release governing new work | Session service (Release Activations) |
| Release governing an Artifact or workflow | Artifact and workflow service (pinned) |
| Seat Assignment and Active Role Context | Seat and assignment service |
| Access policy | Authorization and policy service |
| Decision and Artifact status | Artifact and workflow service |
| Adjudication status | Adjudication service |
| State Values, capability availability, resource balances | State service |
| Measurement values | Reporting service |
| Event order | Evidence service (Evidence Sequence) |
| Session Authority | Session service (Session Authority record) |

## 12. Commands, events and evidence

### 12.1 Command processing

Every mutation is a Command (REQ-035) processed by the Session Authority:

1. Verify identity and Session Access Context; ignore client-asserted actor, organization or authority.
2. Look up the Command ID; same payload digest returns the original receipt; a different digest is refused.
3. Lock the Session Authority record and target aggregate in a fixed order; verify Deployment and Authority Epoch.
4. Evaluate permissions, Gates, Stage, Governing Release compatibility, deadlines and expected version.
5. In one transaction: write the state change (or nothing, for a rejection), the Command Receipt, the Evidence Event and the outbox entry (DEC-43, REQ-053).
6. Deliver Domain Events after commit through the outbox; never call external services inside the transaction.

### 12.2 Domain Event envelope

```typescript
interface DomainEvent<TPayload> {
  id: string;
  type: string;               // past tense, e.g. "artifact.submitted" (DEC-38)
  typeVersion: number;
  organizationId: string;
  sessionId?: string;
  releaseId: string;          // Governing Release
  evidenceSequence?: number;
  authorityEpoch?: number;
  occurredAt: string;         // server commit time
  actorParticipantId?: string;
  commandId?: string;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
}
```

Representative types: `session.created`, `participant.admitted`, `seat_assignment.created`, `stage.started`, `stage.completed`, `timer.paused`, `artifact.created`, `artifact.submitted`, `workflow_instance.advanced`, `message.sent`, `inject.released`, `adjudication_record.finalized`, `state_value.changed`, `release.activated`, `command.rejected`, `session.completed`, `export.generated`. The full catalog is owned by 09.

## 13. Consistency domains

Two domains with different rules (ADR-002):

| Domain | Mechanism | Guarantee |
|---|---|---|
| Studio Draft | CRDT convergence (Yjs candidate) | Concurrent edits converge; publication freezes and fully validates a materialized snapshot; merge never mutates a Release |
| Runtime Session | Serialized, idempotent Commands at the Session Authority | One authoritative order; no conflicting consequential commits |

## 14. Realtime delivery

ADR-010:

| Flow | Transport |
|---|---|
| Runtime Commands | HTTPS POST with idempotent receipts |
| Runtime deltas to clients | Server-Sent Events over HTTP/2; the event ID is the Projection Cursor |
| Restricted-network fallback | Polling delta endpoint |
| Studio collaboration | Authenticated WebSocket for CRDT updates |
| Push-to-talk floor control | Dedicated HTTPS endpoints, never queued or replayed (DEC-48) |
| Voice audio | WebRTC through the media provider (ADR-017) |

Requirements: reconnection restores authoritative state; Drafts survive disconnection; duplicate deliveries do not create duplicate effects; presence is never authoritative participation history; operators have a Session health view (REQ-044, REQ-068).

## 15. Workflow engine

A Workflow Definition (03) describes states, transitions, Session Roles, Gates, deadlines and side effects. A Workflow Instance tracks one Artifact, pinned to its Governing Release (INV-021). The engine supports human and automated tasks, conditional branches, parallel review, quorum or unanimous approval, return for revision, deadlines and escalation, cancellation and operator override, within the expressiveness limits set by OPEN-006.

## 16. Form rendering

Forms render from versioned schemas: JSON Schema-compatible field definitions, a UI schema for layout, validation rules, conditional rules, and permissions at form, section and field level. Each submitted Artifact references the exact Form version used (REQ-028). JSON Schema compatibility is OPEN-022.

## 17. Interface composition

Each Session Role and Stage resolves to an Interface Profile composed of platform modules (REQ-063).

```json
{
  "sessionRoleId": "role-a",
  "stageId": "stage-1",
  "layout": {
    "template": "main_sidebar",
    "regions": [
      { "id": "main", "modules": ["situation-brief", "artifact-workspace"] },
      { "id": "sidebar", "modules": ["timer", "objectives", "notifications"] }
    ]
  }
}
```

Modules have stable platform contracts. Designers configure placement, visibility, labels and allowed actions.

## 18. Plugin architecture

The Extension Framework is specified in 10. In summary (DEC-11, DEC-52 to DEC-60, REQ-038, INV-020):

- Plugins come only from approved publishers, are signed and pinned by digest, and are installed per Organization.
- They run in the Extension Host (ADR-018) on a policy-filtered input snapshot, with no database, object-store or secret-store access.
- Outputs are validated and staged as Effect Proposals; a consequential effect is committed only after an authorized person approves it, through an ordinary Command (DEC-54).
- Model Compositions chain Plugins in typed graphs without cycles (DEC-55).
- Voting Method and Media Provider Adapters are Platform Adapters: same packaging and verification, no authority (DEC-59).

## 19. Reporting

Reports are declarative: audience, data scope, filters, sections, tables, charts, narrative templates, anonymization rules and output formats. Reports read Evidence Events, Artifacts and Adjudication Records, never transient interface state (REQ-054 to REQ-061).

## 20. Identity and Session access

### 20.1 Identity separation

```text
Person / Guest Identity / Display Principal
  -> Participant (per Session)
       -> Seat Assignment
            -> Seat -> Session Role (+ Session Team)
```

Authentication establishes who the Principal is. Session authorization decides whether the Principal may enter and what it may see or do.

### 20.2 Identity service

Owns Persons, identity-provider bindings, passwordless and SSO sign-in, MFA status, Guest Identity creation and expiry, Device registration and revocation, and Authentication Sessions. It does not own Seat Assignments or Session authority.

### 20.3 Invitations and joining

Invitation tokens are opaque, single-purpose, expiring, revocable and stored only as hashes. A token may bind a recipient to a Session, Team, Session Role and Seat, but access is granted only after identity verification and Seat Assignment activation. Session codes identify a Session and never grant access alone (REQ-046). The join flow evaluates Session configuration, identity, Seat eligibility, capacity, waiting-room policy and operator approval.

### 20.4 Guest identities and displays

Guest Identities are Session-limited, expire, can be revoked and keep audit continuity after expiry; they never become Organization Memberships. Display Principals use short-lived activation codes followed by rotated credentials and are limited to read-only Interface Profiles under a classification ceiling.

### 20.5 Reconnection

Authentication Sessions are not authoritative for assignment or permission. On every connection and reconnection the server reloads the Session Access Context. Drafts may be restored from local storage, but submission, approval, state change and communication remain server-authoritative.

### 20.6 Reassignment

Reassignment (REQ-049) is transactional: close or time-bound the prior Seat Assignment, create the new one, record authority and reason, recalculate access, refresh active connections, emit `seat_assignment.changed`, preserve attribution. Cross-team or cross-clearance reassignment raises an information-exposure warning because previously viewed information cannot be withdrawn.

## 21. Trust boundaries and isolation

Isolation is defined and tested across Organization, Simulation Project, Simulation Release, Session, Session Team, Participant, observer scope and analytical project. Authorization combines role- and attribute-based policy using Organization, Session, Team, Session Role, Stage, information classification, decision ownership, Inject release state, observer status and control function.

## 22. Failure model

| Failure | Required behavior |
|---|---|
| Client disconnection | Drafts and Offline Outbox persist; reconnect resyncs from cursor |
| Stale client state | `STALE_AGGREGATE_VERSION`; refresh and explicit merge |
| Duplicate Commands | Original receipt returned; no second effect |
| Out-of-order or duplicate deltas | Deduplicated by ID; gaps trigger snapshot |
| Service or database unavailable | No success reported; retryable error with receipt lookup |
| Failed state transition | Rolled back; rejection recorded (DEC-43) |
| Partial adjudication or plugin failure | Never shown as an outcome; retry or manual path |
| Media provider outage | Voice Channels shown degraded or unavailable; grants fail closed; Floor Leases expire |
| Notification or delivery failure | Outbox retry; dead-lettered items visible to operators |
| Export failure | Retryable job; no partial file presented as complete |
| Lost authority | `AUTHORITY_UNAVAILABLE`; no automatic failover |

Retryable Commands require Command IDs. Side effects are transactional or compensatable.

## 23. Technology stack

| Concern | Choice | Decision | Status |
|---|---|---|---|
| Frontend | React, TypeScript | ADR-007 | Approved |
| Backend | Node.js 26 LTS target, 24 LTS floor; TypeScript | ADR-008 | Approved |
| Database | PostgreSQL 18 | ADR-009 | Approved |
| Object storage | S3-compatible API; Garage, SeaweedFS or Ceph RGW self-hosted | ADR-011 | Approved |
| Identity | OIDC relying party; Keycloak bundled for self-hosted profiles | ADR-006, ADR-012 | Approved |
| Realtime | SSE for Runtime; WebSocket for Studio collaboration | ADR-010 | Approved |
| Background jobs | PostgreSQL-backed queue | ADR-005 | Approved |
| Packaging | OCI images; Compose or Podman reference deployment | ADR-013 | Approved |
| Voice media | Self-hosted WebRTC SFU (LiveKit candidate) and TURN | DEC-49, ADR-017 | Approved; provider remains replaceable |
| Plugin isolation | Hardened rootless containers; WASM/WASI for deterministic models | ADR-018 | Confirmed |
| CRDT | Yjs candidate | ADR-002 | Approved |
| Frontend libraries (candidates) | React Router, TanStack Query, Zustand, React Hook Form, Zod, dnd-kit, React Flow | — | Candidates; pin in implementation ADRs |
| Testing | Vitest (unit and contract), Playwright (full Session), schema compatibility, permission matrix, synthetic rehearsal | — | Candidates |

Supabase is not used in any profile (ADR-006).

## 24. Engineering invariants

INV-011 to INV-022 in 01 PRD apply to every component.

## 25. Capacity planning

The DEC-16 workload (500 Participants per Session, 10 concurrent Sessions, up to 5,000 active Participants) is a sizing assumption, not a benchmark or service level. Load tests must cover reconnect bursts, peak submissions, active projections and export load. Acceptance targets are OPEN-019. Brokers, caches and service splits are added only when measurements justify them (ADR-005); the media stack is the one approved exception (DEC-49). Voice is sized as a separate media profile (12 §10).

## 26. Open technical decisions

OPEN-016 was resolved on 2026-11-08; OPEN-002, OPEN-012, OPEN-020, OPEN-021, OPEN-022 and OPEN-029 also have recorded resolutions, including baseline limitations. Consult Decision Register §§3 and 7 for authority and scope, and §7.5 for transfer implementation and evidence obligations. No automatic availability claim follows from policy approval.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.3.2 | 2026-10-21 | Applied the resolved OPEN-007 deployment-profile identity rules and DEC-61 Organization Roles. Runtime support for Reviewer and Research Analyst remains a separately tested implementation change. |
| 1.3.1 | 2026-10-17 | Added polling, voice and extension services, schemas, deployment components, transports and failure modes; replaced the §18 plugin interface with a summary of 10 Extension Framework; recorded the media-stack exception (DEC-49). |
| 1.3.0 | 2026-10-17 | Merged v1.2 amendment into body; adopted Glossary terms (Session, Simulation Release, Stage, Session Access Context); removed "workspace"; replaced Supabase stack with ADR-006 to ADR-013; removed AI-assisted design services (DEC-41); added deployment profile table, authoritative source table, command pipeline and realtime transport; renumbered sections. |
| 1.2.0 | 2026-10-17 | Controlled alignment amendment (archived). |
| 1.3.3 | 2026-11-08 | Aligned architecture decision status and operator-transfer readiness references with owner approval. |
