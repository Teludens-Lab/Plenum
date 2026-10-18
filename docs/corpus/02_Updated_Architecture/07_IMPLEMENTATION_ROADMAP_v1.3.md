# Plenum — Implementation Roadmap and Migration Plan

## Document control

| Field | Value |
|---|---|
| Document ID | IRM |
| Number | 07 |
| Version | 1.3.2 |
| Date | 2026-10-17 |
| Status | Draft for review. v1.2 amendment merged; duplicate section numbers fixed (DEC-26). |
| Owner | Product Owner, with Technical Lead |
| Approvers | Product Owner; Methodology Lead; Technical Lead (role placeholders — OPEN-001) |
| Reads from | All governing and technical documents |
| Read by | Epics, tasks, test plans, migration work, release decisions |
| Authority | Sequencing, gates, acceptance evidence, migration, staffing and definition of done. It may not redefine product or methodology intent. |
| Supersedes | `07_IMPLEMENTATION_ROADMAP_v1.2.md` |

---

## 1. Strategy

Extract a generic platform from Fractured Order rather than rewriting everything or building a fully general Studio first:

1. Inventory Fractured Order behavior against a pinned commit.
2. Separate platform capabilities from simulation configuration.
3. Reproduce Fractured Order from configuration.
4. Build Studio editors for that configuration.
5. Prove the model against contrasting simulations.
6. Add advanced automation and expand the plugin catalog.

The Extension Framework (DEC-58), live polling and voting (DEC-46) and voice and radio (DEC-47) are first-release scope and are delivered in Phases 2 and 3, not left to the end.

## 2. Governing sequence

Specifications are approved in this order: 01 PRD and 08 Canon → Decision Register entries → 02 Platform → 03 Schema → 09 Contracts → 04, 05, 06 → 10, 11, 12 → Data Model and Synchronization Protocol → implementation.

**Parallel work (DEC-27).** Detailed design and spike code may run ahead of approval, provided each artifact is labeled non-authoritative and is reconciled once its governing document is approved. The reference code slice is such an artifact.

## 3. Contract-first gate

No epic is declared complete until its requirement IDs, canonical entities, API and event contracts, workflow transitions, authorization rules, analytics definitions, error behavior and acceptance tests are approved and its acceptance evidence (§13) exists. A working interface or database write is not evidence of completion.

## 4. Phases and slices

Each phase lists the v1.2 delivery slices it now contains.

### Phase 0 — Reference audit

- Pin a Fractured Order commit (OPEN-003).
- Inventory routes, surfaces, role- and team-specific pages, stores, services, tables, realtime subscriptions, forms, validation, Stage logic, timers, communications, adjudication, exports and every hard-coded simulation term.
- Classify every capability using 08 Canon §12.

**Deliverables:** capability matrix; hard-coding register; current data model; route and interface map; realtime event map; test coverage map.

**Exit:** every capability is classified, and the Methodology Lead has reviewed ambiguous classifications.

### Phase 1 — Platform kernel and authority slice

Contains **Slice S1 (single-session authority)**: LAN-local Runtime; idempotent `artifact.submit`; atomic state, evidence and receipt; reconnection replay; explicit refusal of offline adjudication.

- Centralize authentication and Session Access Context; centralize policy checks.
- Build generic Session, Stage and timer, Artifact and workflow services, command processor, evidence journal and event contracts.
- Build the module registry and configuration loading; replace team and role constants with identifiers.

**Exit:** reusable services do not depend on Fractured Order names (INV-022); S1 tests pass. The reference code slice (`plenum_runtime_slice`) is the spike for this phase.

### Phase 2 — Configuration-driven Fractured Order

Move Teams, Session Roles, Seats, Stages, timers, Forms, Artifact Types, communications, Injects, interface composition, export labels and report sections into a Fractured Order Release; bind PLI as a plugin (DEC-11, DEC-41).

Extension core (10 §17 steps 1–5): SDK and manifest schema; publisher intake and registry; Organization installation; Extension Host (ADR-018); Effect Proposal staging and mandatory approval (DEC-54); the PLI-like test Plugin bound to a Fractured Order-derived Release.

Polls and voice Runtime services (11, 12): Poll lifecycle, Ballot Commands, Tally and Certification; Voice Channels, Media Credentials, push-to-talk floor endpoints and the first Media Provider Adapter (ADR-017).

**Acceptance test:** rename Teams, add a Stage, change a Form field or change a role's interface without modifying source code.

**Exit:** Fractured Order is one Simulation Release interpreted by the generic Runtime; EXT-01 to EXT-11, VOTE-01 to VOTE-10 and VOICE-01 to VOICE-05 pass.

### Phase 3 — Foundational Studio and collaboration

Contains **Slice S3 (Studio collaboration)**: two Designers edit one Draft concurrently; reconnect convergence; validation; immutable Definition Revision; Publication from a frozen snapshot.

Scope: project metadata; Methodology workspace; Teams; Session Roles and Seats; sequential Stages; timers; basic Forms and Artifact Types; workflow templates; communication matrix; manual Inject release; manual adjudication; Interface module selection; validation; Publication; Session launch; real-time co-editing (DEC-15); Poll editor; Voice Channel editor and voice matrix; plugin catalog, Plugin Binding inspector and Model Composition builder; sequential and parallel compositions; offline installation bundles for Plugins and Platform Adapters; recording and transcription with consent (DEC-50).

**Exit:** a non-programming Designer builds and runs a simple three-team, three-Stage simulation without code, with two Designers editing concurrently, including a Poll, a push-to-talk Voice Channel and a two-model composition with approval; the remaining EXT, VOTE and VOICE tests pass except the load tests, which belong to S7.

### Phase 4 — Advanced logic and live change

Contains **Slice S4 (Release activation)**: activate a new Release while active workflows stay pinned; classify changes; review impact; accept or flag delayed offline Commands.

Scope: conditional fields; nested and branching Stages (within OPEN-005); trigger rules; automated workflow actions; conditional Injects; State Variables, Capabilities and Resources; rubric and rules adjudication; advanced reports; synthetic rehearsal; live-change activation.

**Exit:** a materially different simulation runs without new Runtime features.

### Phase 5 — Institutional scale

Contains **Slice S5 (evidence verification)**, **Slice S6 (deployment profiles)** and **Slice S7 (load and reliability)**.

- S5: independently anchored signed Checkpoints; offline verification of an export; detection of tampered and missing events; recovery and key-rotation drill.
- S6: cloud and disconnected LAN installations; non-cloud startup; local identity; backup and restore; Package import; operator runbooks. Air-gapped accreditation is separate and institution-specific.
- S7: a representative 500-Participant Session and 10 concurrent Sessions with defined interaction mix, latency, contention, reconnect bursts and resource measurement (OPEN-019), including ballot bursts (VOTE-14), a separate voice media profile (VOICE-12) and plugin execution (EXT-19). Scale technologies only when measurements justify them.

Also: comments, suggested changes, review requests and change comparison in Studio; organization component libraries; template governance; version diff; institutional branding; SSO federation; advanced research controls; full offline Participant support (Slice S2 below).

**Slice S2 (offline Participants):** durable Offline Outbox; projection cursors and snapshots; device encryption; reconnect acceptance tests (Synchronization Protocol §12).

### Phase 6 — Plugin catalog expansion

The framework itself ships in Phases 2 and 3 (DEC-58). Phase 6 adds production Plugins and external model integrations as their contracts stabilize (OPEN-011), and any deferred capability the Product Owner later revives: bounded feedback loops (DEC-55), ranked-choice voting (DEC-46), video (DEC-47). AI-assisted authoring is not part of this phase (DEC-41; PRD Appendix A).

## 5. Epics

| Epic | Contents |
|---|---|
| A — Canonical schema | TypeScript types; JSON Schema export; validator; compatibility rules; Package import and export |
| B — Context and permissions | Session Access Context resolver; capability catalog; policy evaluation; preview as role; permission-matrix tests |
| C — Dynamic interface | Application shell; module registry; layout templates; role and Stage composition; responsive behavior |
| D — Forms and Artifacts | Form renderer and builder; Artifact lifecycle; draft recovery; Form versioning |
| E — Workflow engine | Definitions; instances; human and automated tasks; branching; overrides |
| F — Session operations | Session creation; joins; Seats; Stage and timer control; Session health |
| G — Injects and communications | Channel policy; messaging; Inject library; trigger evaluation; required responses |
| H — Adjudication and state | Manual, rubric and rules engines; State Values; effects; plugin contract |
| I — Reporting | Evidence journal; report definitions; standard reports; exports; anonymization |
| J — Collaboration and sync | CRDT Draft service; Offline Outbox; projections and cursors; authority fencing |
| K — Evidence integrity | Checkpoints; signing; Anchors; verification export |
| L — Extension Framework | SDK; registry and intake; installations; Extension Host; compositions; Effect Proposals and approval; offline bundles (10) |
| M — Polling and voting | Poll lifecycle; Ballots; Tally; Certification; secret ballots; Voting Method Adapters (11) |
| N — Voice and radio | Voice Channels; Media Credentials; floor control; Media Provider Adapter; consent, recording and transcription (12) |

## 6. Fractured Order extraction

### 6.1 Sequence

1. Freeze and inventory current behavior at the pinned commit.
2. Turn the professional playthrough into the gold conformance matrix.
3. Separate Studio control-plane concerns from Runtime data-plane concerns.
4. Define and compile the Fractured Order Release.
5. Replace named role pages with generic surfaces bound through Interface Profiles.
6. Replace artifact-specific page logic with Artifact Types and Workflow Definitions.
7. Extract Seat claims, operator grants, heartbeat, reconciliation, timers, notifications and queues into platform services.
8. Convert facilitator decks and venue projection into structured content and display Interface Profiles.
9. Convert PLI, journal and intercom, recorder and similar extensions into plugins.
10. Generate validated evidence packages labeled captured or reconstructed.
11. Recreate Fractured Order entirely in Studio.
12. Pass playthrough, recovery, isolation, accessibility and export reconciliation gates.
13. Remove remaining simulation-specific branches and compatibility aliases under the migration policy.

### 6.2 Exit criteria

No branch on named Teams or Session Role labels in core code; every Session Role resolves through an Interface Profile; every Artifact Type has a complete Workflow Definition; realtime loss is recoverable without duplicate delivery; Fractured Order workflows and exports remain equivalent; historical Sessions remain readable through their pinned Releases.

## 7. Customization and plugin delivery stages

| Stage | Scope |
|---|---|
| A — Brand and assets | Organization and project brand profiles; asset upload, metadata, variants and authorization; thumbnails, covers, logos, team icons; brand inheritance and preview |
| B — Themes and terminology | Token derivation; accessibility validation; light, dark and adaptive modes; typography tokens; Terminology Profiles |
| C — Interface Profiles | Constrained module composition; role and Stage scope; layout, width, density and navigation controls; runtime interface resolver |
| D — Plugin registry | Manifest schema; publisher intake; installation and enablement scopes; permission viewer; configuration mapping; digest pinning; Audit Records (Phase 2, DEC-58) |
| E — Controlled plugin execution | Extension Host; input and output validation; mandatory approval of consequential effects (DEC-54); failure isolation and observability; reproducibility manifest integration (Phase 2) |
| F — Model Composition | Composition builder; typed graphs; sequential and parallel runs; offline installation bundles (Phase 3) |

A public third-party marketplace and arbitrary custom code remain out of scope (PRD §2.2).

## 8. Testing strategy

| Level | Coverage |
|---|---|
| Unit | Schema validation; Gate evaluation; permission evaluation; state effects; workflow transitions |
| Contract | Release compatibility; plugin contracts; command and event contracts; report definitions; error codes |
| Integration | Artifact through workflow; Inject release and response; adjudication and state change; Stage transition; export; rejection evidence |
| Database | Tenant isolation under the application role; immutability triggers; idempotency; sequence allocation (Data Model §13) |
| Synchronization | SYNC-01 to SYNC-15 (Synchronization Protocol §12) |
| End-to-end | Playwright actors for operator, control staff, team lead, team member, notetaker and observer; a synthetic full Session from lobby to final report |
| Load and recovery | S7 and restore drills |

## 9. Migration

### 9.1 Preserve the production path

Do not replace Fractured Order at once. Introduce compatibility adapters and replace one capability at a time:

```text
Hard-coded forms     → generic form renderer
Hard-coded roles     → policy engine and capability catalog
Static pages         → dynamic module shell
Custom phase logic   → Stage engine
Custom exports       → reporting engine
```

### 9.2 Data migration

Map existing sessions to a Fractured Order Release; map form records to Artifact Types; preserve original timestamps and identifiers; create migration provenance records; validate historical exports before retiring old paths.

### 9.3 Schema migrations

Versioned expand → backfill → switch → contract migrations, rehearsed against representative old data (Data Model §11).

## 10. Team

Product owner and simulation-domain lead; senior full-stack architect; frontend engineer for Studio; backend engineer for Runtime and data; product designer; QA and automation engineer; part-time security and data-governance support.

## 11. Prioritization

Prioritize work that (1) removes Fractured Order assumptions, (2) improves Runtime reliability, (3) creates reusable contracts, (4) makes behavior testable, (5) enables Studio configuration. Defer visual novelty that does not improve portability.

## 12. MVP definition of done

- Fractured Order runs from a published Release.
- A Designer builds a basic new simulation in Studio, with concurrent co-editing.
- The Runtime renders role-specific interfaces from configuration.
- Workflows and communications are enforced by configuration.
- Operators run a full Session.
- Evidence Events, Artifacts, adjudications and state changes are traceable; rejections are recorded.
- Standard reports and structured exports are generated.
- Polls run end to end with Certification, including secret ballots (DEC-46).
- Voice Channels work in all four modes, with push-to-talk floor control and consent-based transcription (DEC-47, DEC-50).
- The whole Extension Framework works: approved Plugins installed, bound, composed, run and approved, including from an offline bundle in a disconnected deployment (DEC-58).
- No custom programming is needed for the supported feature set.

## 13. Acceptance evidence

Every requirement has: test ID, test type, expected behavior, actual behavior, evidence artifact, responsible owner and acceptance status. Required categories: unit, integration, API contract, event contract, state machine, authorization, tenant isolation, trigger evaluation, state transition, adjudication workflow, analytics reproducibility, deterministic replay, load, recovery, migration, accessibility, browser and end-to-end Session.

## 14. Validation simulations

After Fractured Order, build two deliberately different designs without Runtime code changes:

- **Policy negotiation:** multiple organizations; proposals and counterproposals; public statements; negotiated agreement; little numeric state.
- **Crisis response:** fast Stages; conditional Injects; resource allocation; hidden information; escalating State Variables.

## 15. Operational readiness gate

Before a live Session, operators verify: Release version; Seat Assignments; permissions; Inject triggers; adjudication guidance; time controls; export path; fallback procedures; technical operators; backup and recovery; connectivity contingency; pause and resume procedure; state-recovery procedure; incident command ownership (REQ-069).

## 16. Assisted development rule

Anyone changing code — human or coding agent — first reads the requirement rows, the smallest governing sections, the Glossary terms, the relevant contracts and tests. Nobody may invent requirements, terms, metrics, transitions or permissions; contradictions go to the Decision Register as OPEN items.

## 17. Current status

| Item | Status |
|---|---|
| Specification set (01–12, Data Model, Synchronization Protocol) | Rebuilt 2026-10-17; 10–12 added the same day; Draft; awaiting confirmations in Decision Register §3 |
| Reference code slice v0.2 | Spike for Phase 1; data-driven roles and transitions; see its README for verification status |
| Phases 0–6 | Not started |

## Change log

| Version | Date | Change |
|---|---|---|
| 1.3.0 | 2026-10-17 | Merged v1.2 slices into phases; fixed duplicate §15/§16 numbering; moved co-authoring into Phase 3 (DEC-15); removed AI items from Phase 6 (DEC-41); added parallel-work rule (DEC-27); added epics J and K; removed references to unavailable governance files (DEC-23); added current status. |
| 1.3.1 | 2026-10-17 | Corrected the migrations citation to Data Model §11. |
| 1.3.2 | 2026-10-17 | Moved the Extension Framework, polls and voice into first-release Phases 2 and 3 (DEC-46, DEC-47, DEC-58); Phase 6 becomes catalog expansion; added epics L to N, delivery stage F, MVP criteria and load-test coverage. |
| 1.2.0 | 2026-10-17 | Alignment amendment (archived). |
