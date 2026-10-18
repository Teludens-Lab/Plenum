# Plenum Studio — Foundational Product Definition

**Version:** 0.2  
**Date:** 2026-10-17  
**Status:** Controlled product foundation revision; product-owner requirements confirmed in conversation; technical ADRs and institutional sign-offs pending  
**Mode:** Discovery → prototype planning  
**Golden reference:** https://github.com/ssgwm25/Fractured-Order  
**Engineering governance:** `PROJECT_BOOTSTRAP.md`, `AGENTS.md`, `QA_STANDARDS.md`, `UNIVERSAL_DESIGN_STANDARDS.md`  


**Revision lineage:** v0.2 is a controlled extension of v0.1. Sections 1–15 and decisions DEC-01–DEC-14 are retained in substance; the controlling addendum is §16. This discovery document does not supersede the enterprise PRD (`PLENUM_PRD_v0.6_ENTERPRISE_SESSION_INTEGRITY.md`).

## 1. Executive product definition

Plenum Studio is an enterprise-grade visual simulation development environment enabling Statecraft Simulations Group (SSG) simulation experts, including nonprogrammers, to define, design, test, publish, operate, and evolve simulations under the SSG simulation methodology without writing application code.

The product separates: (1) **SSG Methodology**—canonical simulation concepts and invariants; (2) **Plenum Studio**—the authoring and governance control plane; (3) **Simulation Package**—the validated, versioned machine-readable definition; (4) **Plenum Runtime**—the session execution plane; and (5) **Extension Adapters**—controlled integrations such as PLI and human adjudication pathways.

**Product promise:** A designer can model a simulation using SSG methodology, publish a validated package, instantiate a session, and run reproducible, role-scoped workflows without commissioning an exercise-specific application.

**Initial audience:** SSG simulation experts who understand simulation design but may not program. Studio is a professional authoring workstation, not a generic web page builder.

## 2. Confirmed product decisions (owner-approved in conversation)

| ID | Decision | Consequence |
|---|---|---|
| DEC-01 | Fundamental SSG concepts are preserved, but some may be disabled. | Canonical vocabulary with configurable activation, dependencies, and validation; optional does not mean semantically arbitrary. |
| DEC-02 | Simulation structure and time can vary. | Do not hard-code `Strategic Orientation → Move 1 → Phase 1` as a universal hierarchy. Represent ordered or conditionally transitioning stages and optional move/phase groupings. |
| DEC-03 | Human and external-model adjudication both supported. | A common adjudication request/result contract with human review, provenance, and authorization rules. |
| DEC-04 | Templates inherit structure and workflows, not automatically the entire scenario. | Template package and scenario content must be independently modeled; cloning defaults to methodology/workflow templates, not scenario data. |
| DEC-05 | Live simulations remain fully editable with version control. | All changes are versioned, attributable, auditable, validated, and applied using controlled runtime change management rather than silent rewrites. |
| DEC-06 | Start with centralized multi-organization cloud; permit self-hosting later. | Tenant isolation now; portable packaging/deployment contracts. Do not prematurely build self-hosted operations. |
| DEC-07 | Studio users are SSG experts who may not program. | Visual editors for complex modeling; expert precision without writing source code. |
| DEC-08 | Hybrid workflows: SSG templates and advanced workflow editor. | Reusable workflow patterns plus guarded custom state machines. |
| DEC-09 | Arbitrary structured artifacts are required. | Schema/form/workflow/visibility/export generation from one canonical artifact definition. |
| DEC-10 | Information asymmetry is first-class. | Visibility policies and release timing belong in the domain model and trusted enforcement boundary. |
| DEC-11 | Pluggable specialist tools and adjudication engines supported. | Small, versioned adapter contracts; no unrestricted plugin execution inside trusted Runtime. |
| DEC-12 | Participant UI is configurable, not free-form. | Curated view families and components; customizable labels, layouts, navigation, branding. |
| DEC-13 | No general AI design copilot. | AI may appear only as an approved adjudication integration (e.g., PLI). |
| DEC-14 | First proof: Fractured Order essential model and Scribe → Facilitator → White Cell journey built and executed without custom application code. | Scope around one real vertical slice; parity measured against pinned reference evidence. |

## 3. Source-derived reference evidence versus proposals

**Documented in Fractured Order repository:** `README.md` identifies participant/team workspaces, Game Master, White Cell, structured Strategic Orientation, Actions and Proposals, team-specific authoring, RFIs, communications, sessions, events/exports and PLI adjudication integration. `docs/role-capability-test-matrix.md` specifies shipped role families and authorization-oriented workflow evidence. `FRACTURED_ORDER_AS_BUILT_BLUEPRINT_GENERATION_PROMPT_v3.md` explicitly describes a golden-reference, implementation-neutral blueprint intended to permit reproduction of Fractured Order through configuration rather than custom Runtime code. `PLENUM_FUNCTIONAL_WORKFLOW_AUDIT.md` includes historical audit findings with explicit evidence and limitations. **These are source/documentation observations, not claims that current live behavior has been verified in this session.**

**Product-design proposals in this specification:** The canonical ontology, package schema, deployment topology, Studio navigation, migration model, release gates and validation contract below are proposed solutions and require evidence-based refinement. They should not be represented as already implemented.

**Golden-reference process (proposed):** Pin a Fractured Order commit SHA, build an as-built behavioral inventory (role × capability × artifact × state transition × visibility × evidence), distinguish `METHODOLOGY-CORE`, `FO-CONFIGURATION`, `RUNTIME-DESIGN-SYSTEM`, `PARITY-UI`, and `LEGACY/DEFECT`, then obtain owner review of ambiguous classifications. Do not encode historical defects as methodology.

## 4. Users and jobs to be done

| Actor | Primary jobs |
|---|---|
| Simulation Designer | Define actors, scenario, structure, artifacts, workflows, visibility, and presentation; reuse approved methodology templates. |
| Studio Administrator | Manage organization members, permissions, approved templates, deployments/authorizations, and package governance. |
| Reviewer / Methodology Owner | Inspect methodological conformance, approve publication, review risky live revisions. |
| Session Game Master | Instantiate, staff, monitor, archive, and export exercise sessions. |
| White Cell / Controller | Operate timeline and injects, review/return/complete artifacts, conduct adjudication or route to external engines. |
| Participant Roles | Use role-specific interfaces, create/submit artifacts, receive information according to visibility policies. |
| SME / Adjudicator | Review assigned matters, provide or approve outcomes, preserve rationale/provenance. |
| Research/Evaluation User | Export permitted evidence, reconstruct sequence and provenance, distinguish observed and derived data. |

Role titles above include both product-level personas and potential Runtime roles; they are not all mandatory simulation seats.

## 5. Canonical simulation grammar (proposed ontology)

A **Simulation** is a versioned design resource owned by an Organization. A published **Simulation Package** is an immutable, validated snapshot of the authored design. A **Session** executes a package and maintains independently owned event/state/evidence history.

| Domain concept | Definition and invariants |
|---|---|
| Organization | Ownership/security boundary for users, designs, packages, sessions, integrations, and exports. |
| Simulation | Design identity, purpose and evolution across draft and published versions. |
| Scenario | Content/context and world assumptions, separable from reusable methodology templates. |
| Simulation Template | Reusable structure, artifact/workflow patterns and methodological defaults; scenario content not included by default. |
| Role Definition | Named functional responsibility with explicit, configurable capabilities and scope. |
| Team/Cell | Optional group of actors/roles; identity and scope, not a hardcoded set of geopolitical sides. |
| Seat/Assignment | An authorized person's claim/assignment to a role within a session and optionally team. |
| Temporal Node | Stage, move, phase, orientation, or custom typed segment, with ordering, gates and timing policies. |
| Artifact Type | Versioned schema for a decision or evidence object, including form presentation, validation, visibility and lifecycle binding. |
| Artifact Instance | Authored, durable instance of an artifact type in a session with authorship, version and history. |
| Workflow Definition | State machine of states, guarded transitions, actors, resulting events and side effects; templates or advanced custom definition. |
| Gate/Rule | Declarative, type-checked predicate restricting actions/transitions; evaluated authoritatively in Runtime. |
| Information Policy | Default-deny audience, role/team/seat/phase/time and release policy for any protected record or view. |
| Inject/Communication | Routed release of exercise information with audience, schedule/trigger, provenance and acknowledgement where defined. |
| Adjudication Request/Result | Versioned decision contract with target artifact, context, outcome, rationale, origin, engine/human identity and status. |
| Session Event | Attributed evidence of an actual operation, including effective package/config revision. |
| Runtime Configuration Revision | Immutable change set to the session-effective definition, linked to an approved base version. |
| Presentation Configuration | Theme, labels, ordered navigation, available component/view types, layouts and role-specific defaults. |
| Integration/Adapter | Allowlisted, versioned external capability with declared input/output, permissions, timeouts and provenance. |

### Non-negotiable semantic invariants (proposed)

1. Every mutation belongs to an organization, simulation/package context and (for Runtime) a session.
2. An operator/participant cannot acquire a protected artifact merely because it is hidden in the UI; server-side information policy is authoritative.
3. A workflow transition is valid only if its preconditions, actor permissions, record version and temporal gates pass at the trusted boundary.
4. Every persisted artifact is attributable and versioned; committed history is not silently rewritten.
5. Publication produces a stable package version; executing sessions pin the original package and record all subsequent effective revisions.
6. A live design edit never retrospectively changes the meaning or outcome of a historical event.
7. Template reuse distinguishes workflow structure from scenario-specific text, credentials and participant/session content.
8. Adjudication results distinguish human decisions, engine proposals, overrides, approvals and rejected/failed executions.
9. If a disabled methodological concept is referenced by an enabled workflow, rule or view, publication fails with an actionable dependency error.
10. Incompatible runtime edits require an explicit transition/migration plan; the system must reject silent deletion or reinterpretation of live session data.

## 6. Studio product capability map

**Authoring core:** Simulation overview and version history; scenario editor; actor/team/role/seat configuration; timeline/temporal structure editor; artifact builder; form and validation designer; workflow/state machine editor; rule/gate designer; information/visibility matrix; inject/communications designer; facilitator/White Cell tools configuration; approved integration adapters; participant UI configuration; dry-run validation and preview; publish/release workflow.

**Operations/governance:** Organization administration; package library/templates; authorized session creation; revision/deployment management; live-edit review, impact preview and approvals; audit history; exports and retention policies.

**Suggested Studio navigation (candidate, not approved UX):** Library / Simulations / Scenario / Structure / Actors / Artifacts / Workflows / Rules & Visibility / Injects / Facilitation / Extensions / Experience / Validate / Publish / Sessions.

The Studio interface should meet `UNIVERSAL_DESIGN_STANDARDS.md` with a project-specific design brief, token system, accessible controls, dense but coherent workstation layouts, undo and recovery. Avoid building an unbounded free-form webpage editor.

## 7. Studio → Package → Runtime contract

**Package publication (proposed):** Studio validates schema, references, permissions, workflow reachability, unsatisfiable gates, audience leakage, temporal dead ends, required configuration and extension compatibility; a successful publish creates a signed or integrity-hashed immutable package snapshot with a stable ID, semantic version, package schema version and provenance. Signing is optional until a proven distribution requirement arises; integrity and identity are mandatory.

**Runtime consumption (proposed):** Runtime verifies package compatibility and identity, then instantiates a session. One generic artifact renderer, workflow executor, temporal controller and authorization/information-policy evaluator interpret package definitions. No Fractured Order-specific business code should be required for the first slice.

**Ownership boundaries:** Studio owns authored design and package publication. Runtime owns session state and activity evidence. Extensions own only their declared isolated behavior, not unauthorized direct mutation of Runtime. The organization security boundary applies to all three.

## 8. Live editing and revision semantics — critical capability

Fully editable live sessions do **not** imply instantly applying every arbitrary change to ongoing state. The platform must distinguish authoring freedom from safe operational application.

**Proposed lifecycle:** `Draft edit → Impact analysis → Validation → Review/authorization (risk based) → Atomic activation at explicit boundary → Reconciliation → Audit entry`.

Each published/live effective revision must record: revision ID, base revision, author, reason, timestamp, affected entities, intended activation policy, validation results, compatibility analysis, approved reviewer when required, and actual activation result.

**Changes likely safe for immediate application:** Non-sensitive labels, some help copy, certain participant-visible theme changes. Even these changes must honor audit/provenance and UI consistency.

**Changes requiring explicit guards:** Role capabilities, audience/visibility rules, workflow graphs, gates, artifact schema, stage order, time/deadlines, adjudication integration and session participation topology.

**Behavior for incompatible changes:** Allow design edit to be saved; block activation until the administrator selects and validates an explicit migration (e.g. field mapping, archive preserved records, assignment reassociation, pending-transition handling), or creates a new session/package branch. No historic record may be rewritten to pretend it always followed the new rule.

**Concurrency:** Runtime must evaluate commands against the effective revision and record version; stale client writes yield a specific conflict with a refresh/reconcile path. Revision activation must have well-defined transaction and participant synchronization semantics.

**Minimum guarantee:** The complete session can be reconstructed as `initial package + accepted effective revisions + authoritative recorded activity`, without erasing or retroactively relabeling earlier records. A full event-sourced application architecture is **not** mandated by this requirement; append-only audit/evidence records and explicit state/revision ownership may be sufficient.

## 9. Adjudication model and extension boundaries

The adjudication interface should accept a permission-limited, versioned request containing artifact identity/revision, simulation/session identity, relevant context under visibility policy, declared engine/human decision mode, and correlation/idempotency keys. A response should include outcome, reason/evidence reference, origin, version, status and review disposition. Application is a separate authorized Runtime transition.

Support human-origin decisions and external proposals (including PLI), with configurable approve/override/return pathways. An external engine failing, timing out or producing invalid output must not be represented as an accepted outcome. Engine connectors are explicitly installed/approved; no general AI design assistant is part of Studio.

First slice may implement a local human adjudication adapter and a fake PLI contract adapter. Production PLI integration is later, after the actual reference contract is captured and independently verified.

## 10. Initial deployment and architecture (proposed, subject to engineering profile)

**Chosen deployment direction:** Centralized SSG-managed multi-organization cloud, retaining the ability to package and deploy Studio/Runtime independently in the future.

**Default architecture hypothesis:** One modular application/deployable with internally separated Studio/domain/runtime/identity/revision/evidence/integration modules, plus a relational transactional database; add a separately deployed asynchronous adjudication worker only when actual PLI workload/security constraints require it. Existing Fractured Order uses Vite and Supabase, but this is evidence of the reference implementation, **not an approved Plenum stack**.

**Tenant safeguards:** server-side organization authorization, cross-organization denial tests, scoped object storage and exports, isolated extension credentials, auditability, and least privilege. Tenant identity must never be trusted solely from client-supplied fields.

**Portability safeguards:** Environment configuration separate from package content, documented migrations, export/import format, no scenario-specific code inside platform core, and externalized integration secrets. Actual self-hosted packaging and support policies remain a later product decision.

**Enterprise maturity trajectory:** Early prototype proves real workflows and failure paths; production adds backed-up persistence, restore rehearsals, security hardening, audits, monitoring, migrations and recovery with evidence. Enterprise-grade does not require speculative microservices, Kubernetes, CQRS, generic plugin marketplaces or complex multi-cloud topology.

## 11. First vertical slice — acceptance contract

**Goal:** Starting with a Studio draft modeled on the essential Fractured Order structure, a nonprogramming designer publishes a package; an operator starts a Runtime session; a Team Scribe authors a defined artifact; a Facilitator reviews and forwards it; White Cell accepts or returns it; the complete attributed history remains viewable across roles and exportable. This happens without modifying Runtime source code.

**In scope:** Organization (one pilot tenant plus isolation checks), one simulation/package version, configurable team + roles, one configurable stage/move, one structured artifact schema, one templated three-actor workflow, role-scoped visibility, Studio form/workflow editor, publication validation, role-specific Runtime UI, durable state, basic export, deterministic test fixture, minimal authorized mid-session revision demo.

**Out of scope for slice:** Full Fractured Order functional parity, all Industry Turn Sheet variants, complex multi-recipient threads, realtime scale/load guarantees not derived from fixtures, production PLI integration, unlimited workflow visual authoring, commercial billing, organizational self-host installation, AI content generation.

### Acceptance scenarios

- **AC-01 Define:** Given a nonprogramming designer, when they configure teams, roles, one temporal stage, an artifact form and a review workflow using Studio, the model is persisted and validates without source edits.
- **AC-02 Publish:** Given a complete valid model, publishing produces a uniquely identified immutable versioned package; invalid references/gates/policies prevent publication with targeted errors.
- **AC-03 Session:** Given a published package, an authorized Game Master starts a session; unauthorized and cross-organization requests are denied.
- **AC-04 Handoff:** A Scribe creates and forwards an artifact; it appears to the designated Facilitator but not an unauthorized role; the Facilitator can return it or forward it to White Cell.
- **AC-05 Review:** White Cell accepts or returns the artifact under the configured workflow. Direct API attempts to bypass authorization, stage gates, or intermediate states fail at the trusted boundary.
- **AC-06 Durability:** Each actor can reload and retrieve the permitted current state; author/version/status/history persist and the evidence export agrees with canonical records.
- **AC-07 Revision:** An authorized designer modifies a permitted live property, sees a change-impact result, activates a new revision, and the effective revision and author are recorded without changing historical actions.
- **AC-08 Failure:** Invalid input, stale version, lost connection, double submission, unavailable extension and denied visibility produce truthful states, recovery guidance, and no false success.
- **AC-09 Reference fidelity:** Every included Fractured Order behavior has a traceable baseline claim and parity test; known reference defects are not automatically reproduced.

**Initial success metric:** One complete, reproducible designer → package → session → Scribe → Facilitator → White Cell → audit/export journey that passes defined positive and negative checks. Do not use unverified claims of scale, test coverage or deployment readiness.

## 12. Delivery sequence and gates

1. **Reference reconnaissance:** Pin Fractured Order commit and complete evidence-backed as-built extraction; classify methodology vs exercise configuration vs runtime infrastructure vs legacy defects. Gate: owner reviews essential ontology mappings.
2. **Domain semantics:** Formalize canonical domain types, optional-methodology dependencies, actor/permission semantics, artifact lifecycle, gates, and revision rules. Gate: invariants are testable with examples.
3. **Architecture contract:** Select stack and deployment profile; document module boundaries, persistence, API, identity and tenant isolation; design versioned Package schema. Gate: single authoritative ownership path for each concept.
4. **Reference slice UX:** Build Studio simulation editor, artifact editor, workflow handoff and publish preview using universal interface standards. Gate: nonprogramming designer completes core authoring task with accessible controls.
5. **Runtime vertical slice:** Instantiate package, execute cross-role artifact workflow, protect visibility and record immutable provenance. Gate: end-to-end scenario + negative authorization tests pass.
6. **Controlled live revisions:** Diff/impact/validation/activation/history for at least one live-edit type, with tests for stale clients. Gate: no silent historical reclassification and no unauthorized activation.
7. **Hardening and expansion:** Add full FO parity incrementally; PLI adapter when real contract is ready; expand workflow/temporal variability, organization admin and operational controls. Gate: risk-based QA and actual readiness evidence.

## 13. Decisions deliberately unresolved

1. Exactly which methodology concepts are *mandatory enabled* versus *always modeled but optionally inactive*; specific dependency matrix needs owner classification of Fractured Order concepts.
2. Permitted temporal graph structures (sequential, parallel, nested, conditional and continuously timed) and consistency semantics.
3. Workflow language expressiveness: conditions, parallel branches, loops, timers, participant assignment and approvals; prevent nontermination/incoherence.
4. Identity/authorization implementation and enterprise federation (SSO), particularly self-host policy variations.
5. Change migration policy for pending artifacts, in-progress phases and participant permissions while live; legal/approval authority for disruptive changes.
6. Precise deployment stack, storage residency, data sensitivity, retention, performance requirements, budgets and operational owner.
7. Artifact schema and form rendering constraints (supported types, nesting, calculated fields, attachments) and import/export formats.
8. Which PLI adapters and other external tools have stable contracts, approved licenses, security classification, and release lifecycle.
9. Semantic diff and runtime compatibility versioning policy for packages, extensions and persisted instances.
10. Template governance, methodology approval roles, and whether publishing/activating revisions requires a distinct approver.

These are explicit engineering/product questions, not permission to fabricate contracts. Use reversible assumptions for exploratory work and stop before irreversible security, tenancy or schema decisions.

## 14. Evidence, quality and project state

**Foundation status:** Decisions consolidated; product foundation drafted. No Plenum Studio application code, database schema, deployment, automated test, or live runtime verification has been produced by this document.

**Baseline limitation:** Fractured Order was inspected through GitHub metadata and selected repository documents earlier in the conversation, not executed here. The golden reference must be pinned and tested before treating any specific behavior as authoritative current-runtime evidence.

**Follow-on authoritative artifacts (create proportionally when implementation begins):** `PRODUCT_BRIEF.md`, `PRD.md`, `DOMAIN_MODEL.md`, `SYSTEM_ARCHITECTURE.md`, `SECURITY_MODEL.md`, `DESIGN_BRIEF.md`, `TEST_STRATEGY.md`, `IMPLEMENTATION_PLAN.md`, `PROJECT_STATE.md`; split this document into canonical owners rather than duplicating competing definitions. This foundation itself is the discovery-phase anchor.

**Standards basis:** `PROJECT_BOOTSTRAP.md` phases/gates; `AGENTS.md` modular/coherent boundaries; `QA_STANDARDS.md` behavior-driven risk-based verification; `UNIVERSAL_DESIGN_STANDARDS.md` accessible high-precision creator interfaces.

## 15. Reference links

- Fractured Order: https://github.com/ssgwm25/Fractured-Order
- Fractured Order README: https://github.com/ssgwm25/Fractured-Order/blob/main/README.md
- As-Built Blueprint prompt: https://github.com/ssgwm25/Fractured-Order/blob/main/FRACTURED_ORDER_AS_BUILT_BLUEPRINT_GENERATION_PROMPT_v3.md
- Role Capability Matrix: https://github.com/ssgwm25/Fractured-Order/blob/main/docs/role-capability-test-matrix.md
- Functional Workflow Audit: https://github.com/ssgwm25/Fractured-Order/blob/main/PLENUM_FUNCTIONAL_WORKFLOW_AUDIT.md


---

## 16. Controlled v0.2 addendum — owner-confirmed requirements and alignment qualifications

**Authority and interpretation:** This section records product direction confirmed in the October 17, 2026 conversation. It supplements, and does not delete or replace, original DEC-01–DEC-14 or the foundational methodological invariants. Where earlier sections use a narrower first-release scope, the phased delivery interpretation below controls without representing capabilities as already implemented. The enterprise PRD remains authoritative and needs the equivalent formal amendment.

### 16.1 Six new product decisions

| Decision | Confirmed product requirement | Implementation consequence |
|---|---|---|
| DEC-15 — Collaborative authoring | Multiple designers simultaneously edit the same simulation draft with Google-Docs-style collaboration. | Draft concurrency, identity-attributed updates, offline editing, reconnection, semantic post-merge validation and explicit publish snapshot boundaries. CRDT/Yjs is a candidate design, not an approved library selection. |
| DEC-16 — Reference workload | Plan for up to 500 participants in a simulation and 10 concurrent simulations. | Design and test toward up to 5,000 connected participants in the reference workload; do not advertise this as an achieved capacity, SLA, or guaranteed simultaneous activity rate. |
| DEC-17 — Dual offline operation | Support both an institutional LAN Runtime operating without Internet and participant devices that become individually disconnected. | Local Runtime is fully authoritative on its LAN; disconnected devices may retain authorized data, draft, and queue allowed provisional commands for future validation. |
| DEC-18 — Central adjudication authority | Consequential adjudications and workflow decisions remain authoritative at a single designated Runtime per session. | An offline device must not finalize adjudication. Conflicts are resolved by the authoritative Runtime, with idempotent processing and explicit rejection/recovery paths. |
| DEC-19 — Institutional deployment profiles | Support centrally hosted deployment, institutional self-hosting, and future air-gapped/classified-network environments. | Keep package and runtime portable with no mandatory external online call for air-gapped execution; classify and accredit specific security deployments separately. |
| DEC-20 — Tamper-evident evidence | Preserve an institutional history that permits independent detection of unauthorized alteration. | Append-only authoritative evidence and verifiable cryptographic commitments, with independently governed anchors, key custody, export and verification policy. The specific cryptographic mechanism requires security/research approval. |

### 16.2 Clarification of existing decisions and scope

**DEC-06 (deployment):** Cloud-first describes implementation order, not an architectural prohibition on self-hosting. Institutional and air-gapped operation are target capabilities; full accredited air-gapped delivery is not implicitly included in the first pilot or vertical slice. Full disconnection of individual devices is distinct from an Internet-disconnected local LAN.

**Canonical terminology:** Older foundational language uses **Simulation** as design identity and **Simulation Package** as the immutable published executable. The upstream enterprise PRD uses more granular **Simulation Project**, **Core Design**, **Scenario**, **Simulation Release**, and **Session** concepts. v0.2 preserves original prose for lineage, but database/API implementation MUST use the ratified upstream term crosswalk; a Simulation Package is not synonymous with a mutable Studio draft, and Session state is not synonymous with a Release. Do not silently rename persistent identifiers or historical event types.

**DEC-13 (AI scope):** General-purpose AI design copilot/AI-assisted authoring remains excluded. References to AI-assisted design services in an older integration inventory are not authorization to implement them. Approved external model-based adjudication remains within DEC-03/DEC-11.

### 16.3 Safe activation and offline reconciliation policy candidate

**Proposed, pending methodology and technical approval:** In-flight workflow instances retain their governing release by default. Compatible changes may apply prospectively to new workflow instances after validated activation; a consequential migration must have impact analysis, authorization, and evidence. Offline commands are provisional, must be checked by the designated Runtime against the applicable release and latest authorization, and cannot retroactively acquire authority merely because a device recorded a timestamp. Historical adjudications and decisions are never silently reinterpreted.

**Offline trust boundary:** Devices receive only the authorized participant-specific data projection. Offline local content may remain accessible after server-side revocation until reconnection or local expiry; encryption and expiry mitigate but cannot guarantee remote erasure. Device enrollment, maximum disconnection duration, key custody, retained classified information, and reauthorization rules remain open security decisions.

### 16.4 Implementation sequence and architecture decisions

Preserve the first Fractured Order vertical slice in §11. Add narrow conformance proofs for duplicate retry, queued submission after reconnect, conflicting adjudication rejection, and a versioned live-edit activation. Expand to comprehensive disconnected participants and certified air-gapped operations in subsequent independently gated milestones.

**Decided by product owner:** DEC-15–DEC-20 and the originally confirmed DEC-01–DEC-14.

**Recommended, not technically approved:** modular monolith; PostgreSQL as system-of-record with JSONB for flexible artifacts; CRDT-based Studio drafts; transactional command/outbox; session-authority epochs/fencing; signed evidence checkpoints with independent anchoring. These require ADR decisions and tests.

**Open institutional gates:** methodology-approved in-flight migration semantics; offline authentication lifetime and device policies; session authority transfer/fencing proof; evidence-signing custody, independent anchor, retention and correction policy; operational RPO/RTO; actual high-security deployment assurance and procurement conditions.

### 16.5 Required authority and verification

`PLENUM_PRD_v0.6_ENTERPRISE_SESSION_INTEGRITY.md` remains the product authority. Issue the attached PRD controlled amendment request and merge it into an owner-approved new PRD revision before representing the corpus as formally ratified. The Canonical Simulation Schema, API/Event Contracts and v1.2 architecture should reference that PRD revision after approval.

No current release capability, capacity measurement, offline production test, classification certification, cryptographic proof verification, or institutional sign-off is claimed by this document.
