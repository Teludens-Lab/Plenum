# Plenum Studio Implementation Roadmap and Migration Plan

## Document Control

- **Document ID:** IRM
- **Version:** 1.2.0 (controlled alignment draft; retains v1.1 body)
- **Status:** Draft for review
- **Owner:** Plenum product owner
- **Approvers:** Product owner; simulation-methodology lead; technical lead
- **Reads from:** All approved governing and technical specifications
- **Read by:** Epics, implementation tasks, test plans, migration work, and release decisions
- **Authority:** Defines sequencing, gates, acceptance evidence, migration, staffing, and definition of done; it may not redefine upstream product or simulation intent.
- **Out of scope:** Decisions explicitly governed by another document in the specification hierarchy.

## 1. Strategic Approach

The safest path is to extract a generic platform from Fractured Order rather than rewrite the entire application and attempt a fully generalized builder immediately.

The sequence is:

1. Inventory Fractured Order behavior.
2. Separate platform capabilities from simulation-specific configuration.
3. Reproduce Fractured Order from configuration.
4. Build frontend editors for the configuration.
5. Test the model against contrasting simulations.
6. Add advanced automation and ecosystem features.

## 2. Phase 0 — Repository and Capability Audit

### Objectives

Create a complete map of the current system.

### Work

- Inventory routes and user surfaces.
- Inventory team-specific and role-specific pages.
- Inventory stores, services, database tables, and realtime subscriptions.
- Inventory forms and validation rules.
- Inventory phase transitions and timers.
- Inventory communication types.
- Inventory adjudication logic.
- Inventory exports and reports.
- Identify every hard-coded simulation term.

### Deliverables

- Capability matrix
- Hard-coding register
- Current-state data model
- Route and interface map
- Realtime event map
- Test coverage map

### Exit criterion

Every Fractured Order capability has been classified as:

- Platform service
- Configurable definition
- Optional plugin
- Simulation content
- Technical debt

## 3. Phase 1 — Extract the Platform Kernel

### Objectives

Create stable shared services without changing visible Fractured Order behavior.

### Work

- Centralize authentication and runtime context.
- Centralize policy checks.
- Create generic session service.
- Create generic phase and timer service.
- Create artifact service.
- Create event contracts.
- Create module registry.
- Replace team and role constants with identifiers.
- Add configuration-loading service.

### Deliverables

```text
plenum-core
plenum-runtime
plenum-components
plenum-schema
fractured-order-definition
```

### Exit criterion

Fractured Order still runs, but its reusable services no longer depend on its team names, role names, or phase labels.

## 4. Phase 2 — Configuration-Driven Fractured Order

### Objectives

Represent Fractured Order in the Canonical Simulation Definition.

### Work

- Move teams into configuration.
- Move roles and permissions into configuration.
- Move phases and timers into configuration.
- Move forms and artifact types into configuration.
- Move communications into configuration.
- Move injects into configuration.
- Move interface composition into configuration.
- Bind specialized PLI adjudication as a plugin or model definition.
- Move export labels and report sections into configuration.

### Acceptance test

A developer can rename teams, add a round, change a form field, or alter a role's interface without modifying application source code.

### Exit criterion

Fractured Order is one published simulation package interpreted by the generic runtime.

## 5. Phase 3 — Foundational Design Studio

### Objectives

Allow non-programmers to create basic simulations.

### Scope

- Simulation metadata
- Teams
- Roles
- Seats
- Linear phases
- Timers
- Basic forms
- Artifact types
- Content upload
- Manual workflows
- Communication matrix
- Manual inject release
- Manual adjudication
- Interface module selection
- Validation
- Publishing
- Session launch

### Exit criterion

A designer can create and run a simple three-team, three-phase simulation without code.

## 6. Phase 4 — Advanced Logic

### Scope

- Conditional fields
- Branching phases
- Trigger rules
- Automated workflow actions
- Conditional inject release
- World-state variables
- Rubric-assisted adjudication
- Rules-based adjudication
- Advanced report definitions
- Synthetic rehearsal

### Exit criterion

The platform supports a materially different simulation without new runtime features.

## 7. Phase 5 — Collaboration and Institutional Scale

### Scope

- Co-authoring
- Comments
- Review workflows
- Organization component libraries
- Template governance
- Simulation comparison
- Version diff
- Institutional branding
- SSO
- Advanced research controls

## 8. Phase 6 — AI and Plugin Ecosystem

### Scope

- Guide-to-simulation drafting
- AI-generated team and role proposals
- Inject suggestions
- Balance checks
- Automated facilitator-guide drafting
- Plugin SDK
- Plugin registry
- External model integrations

AI and plugins should be added only after the canonical definition and validation model are stable.

## 9. Recommended Epics

### Epic A — Canonical schema

- TypeScript schema
- JSON Schema export
- Validator
- Version compatibility rules
- Import/export package

### Epic B — Runtime context and permissions

- Context resolver
- Permission registry
- Policy evaluation
- Preview-as-role
- Permission tests

### Epic C — Dynamic interface

- Application shell
- Module registry
- Layout templates
- Role-phase composition
- Responsive behavior

### Epic D — Forms and artifacts

- Form renderer
- Form builder
- Artifact lifecycle
- Draft recovery
- Schema versioning

### Epic E — Workflow engine

- Definitions
- Instances
- Human tasks
- Automated tasks
- Branching
- Overrides

### Epic F — Session operations

- Session creation
- Join flows
- Seat management
- Phase control
- Timer control
- Session health

### Epic G — Injects and communications

- Channel policy
- Messaging
- Inject library
- Trigger evaluation
- Required responses

### Epic H — Adjudication and state

- Manual adjudication
- Rubric engine
- Rule engine
- Variable store
- Effect application
- Plugin contract

### Epic I — Reporting

- Event log
- Report definitions
- Standard reports
- Exports
- Anonymization

## 10. Testing Strategy

### Unit tests

- Schema validation
- Rule evaluation
- Permission evaluation
- State effects
- Workflow transitions

### Contract tests

- Simulation package compatibility
- Plugin contracts
- Event contracts
- Report definitions

### Integration tests

- Artifact submission through workflow
- Inject release and response
- Adjudication and state change
- Phase transition
- Export generation

### End-to-end tests

Use Playwright actors representing:

- Game master
- White Cell
- Team lead
- Team member
- Notetaker
- Observer

A synthetic full-session test should run from lobby to final report.

## 11. Migration Strategy

### 11.1 Preserve the current production path

Do not replace Fractured Order all at once. Introduce compatibility adapters.

### 11.2 Strangler pattern

Replace one capability at a time:

```text
Hard-coded forms → generic form renderer
Hard-coded roles → policy engine
Static pages → dynamic module shell
Custom phase logic → phase engine
Custom exports → reporting engine
```

### 11.3 Data migration

- Map existing sessions to a Fractured Order simulation version.
- Map existing form records to artifact types.
- Preserve original timestamps and identifiers.
- Create migration provenance records.
- Validate historical exports before deprecating old paths.

## 12. Initial Team Composition

A practical small team:

- Product owner and simulation-domain lead
- Senior full-stack architect
- Frontend engineer focused on Studio UX
- Backend engineer focused on runtime and data
- Product designer
- QA and automation engineer
- Part-time security and data-governance support

## 13. Prioritization Rules

Prioritize work that:

1. Removes Fractured Order-specific assumptions.
2. Improves runtime reliability.
3. Creates reusable contracts.
4. Makes behavior testable.
5. Enables frontend configuration.

Defer work that adds visual novelty without improving simulation portability.

## 14. MVP Definition of Done

The MVP is complete when:

- Fractured Order runs from a published definition.
- A user can build a basic new simulation through the Studio.
- The runtime dynamically renders role-specific interfaces.
- Workflows and communications are enforced by configuration.
- Operators can run a full session.
- Events, artifacts, adjudications, and state changes are traceable.
- Standard reports and structured exports are generated.
- No custom programming is required for the supported feature set.

## 15. Recommended First Two Validation Simulations

After Fractured Order, test the platform against two deliberately different designs:

### A. Policy negotiation simulation

Characteristics:

- Multiple organizations
- Proposals and counterproposals
- Public statements
- Negotiated agreement
- Limited numeric state

### B. Crisis response simulation

Characteristics:

- Fast rounds
- Conditional injects
- Resource allocation
- Hidden information
- Escalating world-state variables

If both can be built without runtime code changes, the abstraction is likely sound.

## 16. Specification-First Fill Order

Implementation must follow this governing sequence:

1. Product requirements and decision/research intent.
2. Simulation Design and Research Canon.
3. Initial requirements and traceability registers.
4. Technical system design and engineering foundations.
5. Domain-driven design and canonical data model.
6. API, event, authorization, analytics, and workflow contracts.
7. Database and frontend architecture.
8. Infrastructure, security, and reliability controls.
9. Testing, acceptance evidence, operations, and agent/build contracts.
10. Implementation.

Parallel drafting is allowed, but downstream approval cannot precede the approval of governing upstream decisions.

## 17. Contract-First Delivery Gates

No epic enters implementation until its requirement IDs, canonical entities, API contracts, event contracts, workflow transitions, authorization rules, analytics definitions, error behavior, and acceptance tests are approved. A functioning interface or database write is not sufficient evidence of completion.

## 18. Acceptance Evidence Model

Every requirement must identify test ID, test type, expected behavior, actual behavior, evidence artifact, responsible owner, and acceptance status. Required categories include unit, integration, API contract, event contract, state-machine, authorization, tenant isolation, trigger evaluation, state transition, adjudication workflow, analytics reproducibility, deterministic replay, load, recovery, migration, accessibility, browser, and end-to-end simulation testing.

## 19. Operational Readiness Gate

Before a live run, operators must verify the published scenario version, participant assignments, permissions, event triggers, adjudication guidance, time controls, export path, fallback procedures, technical operators, backup and recovery, connectivity contingency, pause/resume procedure, state-recovery procedure, and incident command ownership.

## 20. Agent-Assisted Development Gate

Coding agents must read the build contract, requirement traceability row, smallest governing upstream sections, canonical domain definitions, data entities, applicable API/event/workflow contracts, and testing requirements before changing code. Agents may not invent requirements, terms, metrics, transitions, or permissions and must escalate contradictions through change control.


## 15. Customization and Plugin Delivery Sequence

### Stage A — Brand and assets

- Organization and simulation brand profiles
- Asset upload, metadata, variants, and authorization
- Thumbnail, cover, logo, and team-icon support
- Brand inheritance and preview

### Stage B — Semantic themes and terminology

- Token derivation
- Accessibility validation
- Light/dark/adaptive modes
- Typography tokens
- Terminology presets and mappings

### Stage C — Interface profiles

- Constrained module composition
- Role and phase scope
- Layout, width, density, and navigation controls
- Runtime interface resolver

### Stage D — Built-in plugin registry

- Manifest schema
- Installation and enablement scopes
- Permission viewer
- Configuration mapping
- Version pinning
- Audit records

### Stage E — Controlled plugin execution

- Plugin execution gateway
- Input/output validation
- Human approval workflow
- Failure isolation and observability
- Reproducibility manifest integration

A public third-party marketplace and arbitrary custom code remain deferred until the built-in extension model is proven secure and operationally supportable.

## 15. Fractured Order Runtime Extraction Sequence

1. Freeze and inventory current Fractured Order behavior.
2. Convert the professional playthrough into the gold conformance matrix.
3. Separate Studio control-plane concerns from Runtime data-plane concerns.
4. Define and compile `plenum-runtime-v1` manifests.
5. Replace named role pages with generic surface archetypes and bindings.
6. Replace artifact-specific page logic with `ArtifactTypeContract` and handoff configuration.
7. Extract seat claim, operator grant, heartbeat, reconciliation, timer, notification, and queue services.
8. Convert facilitator decks and venue projection into structured runtime content.
9. Convert PLI, journal/intercom, recorder, and other extensions to plugin execution patterns.
10. Generate validated evidence packages with captured/reconstructed provenance.
11. Recreate Fractured Order entirely through Studio.
12. Pass professional playthrough, recovery, isolation, accessibility, and export reconciliation gates.
13. Remove remaining simulation-specific runtime branches and compatibility aliases according to migration policy.

## 16. Runtime Extraction Exit Criteria

- No branch on named teams or display role labels in core runtime.
- Every role resolves through a surface binding.
- Every artifact type has a complete executable contract.
- Realtime loss is recoverable without duplicate delivery.
- Existing Fractured Order workflows and exports remain equivalent.
- Historical runs remain readable through pinned runtime manifests.


---

## v1.2 Controlled Architecture Alignment Amendment (2026-10-17)

**Status:** Proposed for product owner, methodology lead, and technical lead ratification. This amendment supplements—not supersedes—the preceding v1.1 specification. If earlier text conflicts, the conflict is recorded in `CROSS_DOCUMENT_CONSISTENCY_MATRIX.md` and remains open until ratification; these decisions are not represented as deployed capabilities.

**Authoritative decision references:** GOV-001 through GOV-010 in `GOVERNING_DECISIONS_AND_ADRS.md`. **Scope:** v1.2 alignment only. **Explicit non-goal:** PostgreSQL physical or detailed logical schema implementation.

### A. Dependency-ordered changes to delivery gates

1. **Architecture gate (before detailed DDL):** Ratify authority ownership, two synchronization domains, release activation policy, cryptographic custody, and deployment profiles. Update governing PRD, canonical definitions and contract corpus once available.
2. **Single-session authority vertical slice:** LAN-local Runtime, idempotent `artifact.submit` command, atomic state + evidence + receipt, reconnection replay, explicit rejection of offline adjudication.
3. **Studio collaboration slice:** Two designers change one draft concurrently; reconnect convergence; validation; immutable revision; publish from frozen snapshot.
4. **Version activation slice:** Release revision changes while active workflows remain pinned; classify changes; inspect impact; accept/reject delayed offline commands.
5. **Evidence verification slice:** Independently anchored signed checkpoint, offline verification of export, detection of tampered/missing events, recovery and key rotation drill.
6. **Deployment profile slice:** Exercise both cloud and disconnected LAN-local installation; document non-cloud startup, local identity, backup/restore, package import, operator runbooks. Air-gapped accreditation is separate and subject to institutional requirements.
7. **Load and reliability gate:** Exercise representative 500-person session and 10 concurrent sessions with defined interaction mix, latency, contention, reconnect burst and resource measurement. Scale technologies only when bottleneck evidence justifies them.

### B. Release policy

- v1.2 is a documentation alignment milestone, NOT an implemented feature release. Existing phased Fractured Order extraction remains the core strategy.
- The PostgreSQL Logical Data Model and Synchronization Protocol v1.0 starts only after architecture/contract ownership and open blockers are reconciled.
