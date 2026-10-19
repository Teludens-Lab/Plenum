# PLENUM STUDIO — MASTER DEVELOPMENT PROMPTBOOK GENERATOR v1.3

**Status:** Controlled update to v1.2; production instruction for creating a promptbook; does not itself authorize implementation or deployment.
**Grounding:** Rebuilt against the Plenum corpus of 2026-10-17 (Decision Register v1.0.3; PRD v0.7.2; architecture documents v1.3.x; feature specifications 10–12 v1.1.0; Data Model and Synchronization Protocol v1.1.1; reference code slice v0.2.0). The `download.svg` stack drawing used by v1.2 is superseded as a stack source by Platform Architecture v1.3 §23 and ADR-006 to ADR-018; see "Stack baseline" below.
**Execution target:** OpenAI Codex. **Coverage:** the complete first-release platform as defined by PRD v0.7 §9 and Roadmap v1.3 Phases 0–6. **Unit:** small, independently verifiable vertical slices.

## Source authority (fixed — do not re-derive)
Decisions live **only** in `03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`; terms live only in `GLOSSARY_AND_CROSSWALK_v1.0.md`. Cite IDs (DEC-nn, ADR-nnn, OPEN-nnn, REQ-nnn, INV-nnn, AC-nn); never restate or reword decision text, and never create a second system of decision authority.

Document precedence (from the corpus README; a higher document wins):
1. Decision Register + Glossary.
2. `01_Product_and_PRD/01_PRD_v0.7.md` — top product authority; owns REQ-001…REQ-094, INV-001…INV-028, AC-01…AC-13. The original enterprise PRD v0.6 is **unavailable** (DEC-21, OPEN-023); do not cite it and do not treat its absence as a gap to invent around.
3. `08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` (methodology; OPEN-026 classification boundary resolved, formal ratification still open).
4. `02_PLATFORM_ARCHITECTURE_v1.3.md` → `03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` → `09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md` → `04_DESIGN_STUDIO_SPECIFICATION_v1.3.md`, `05_RUNTIME_AND_ADJUDICATION_v1.3.md`, `06_DATA_SECURITY_REPORTING_v1.3.md` → `10_EXTENSION_FRAMEWORK_v1.1.md`, `11_LIVE_POLLING_AND_VOTING_v1.1.md`, `12_VOICE_AND_RADIO_v1.1.md`.
5. `Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/` (Proposed; gated on OPEN-002).
6. `references/plenum-runtime-slice/` v0.2.0 — the **observed implementation baseline**: an executable Phase 1 spike, non-authoritative under DEC-27, never methodology law.
`07_IMPLEMENTATION_ROADMAP_v1.3.md` owns sequencing, gates and definition of done; it may not redefine product or methodology intent. `archive/` is reference only; never cite an archived file as current authority (its section numbers appear in Basis columns for provenance only).

**Ratification state.** Nothing in the corpus is ratified: approver roles are unfilled (OPEN-001) and DEC-21 to DEC-27, DEC-30 to DEC-40 are Assumed; ADR-001 to ADR-005, ADR-008 to ADR-018 are Proposed; ADR-006 and ADR-007 are Approved; DEC-01 to DEC-20 and DEC-41 to DEC-60 are Confirmed. Design against Assumed/Proposed entries is permitted (DEC-27) but every dependent task must carry a `depends_on_unratified: [IDs]` label, and the promptbook must mark which milestones cannot exit until the listed IDs are confirmed. Never present an Assumed or Proposed decision as approved, and never "resolve" one by choosing silently — raise a candidate OPEN item instead.

## Non-negotiable confirmed execution profile (2026-10-17)
- **Agent is Codex.** Do not ask the user to choose another execution agent and do not regenerate the agent decision questionnaire.
- **Coverage is the entire approved first release**, not a narrowly scoped MVP promptbook. First-release scope explicitly includes the whole Extension Framework (DEC-58), live polling and voting (DEC-46) and voice and radio (DEC-47), delivered in Roadmap Phases 2–3, not deferred. Milestones may ship subsets; every REQ must map to a scheduled task or an explicitly documented, dependency-gated later phase (Phase 6 catalog expansion and the Deferred list in PRD §2.2 are the only legitimate parking places).
- **Task granularity is a small end-to-end vertical slice** touching the minimum necessary UI/API/domain/persistence/test/operations boundaries to produce observable value. Pure foundation tasks are permissible only as prerequisites to an identified vertical slice.
- **Closed product decisions stay closed.** Do not reopen anything Confirmed in the Decision Register, in particular: collaborative Studio editing (DEC-15), offline/LAN operation (DEC-17), single session authority (DEC-18), human approval of consequential plugin effects (DEC-54 — noting its carve-out: designer-authored rules, scheduled Injects and automatic Stage transitions are **not** subject to approval), restricted plugin publishers (DEC-52), offline plugin bundles (DEC-56), first-release voting and voice (DEC-46, DEC-47), deferral of ranked-choice voting, video and composition feedback loops (DEC-46, DEC-47, DEC-55), no AI-assisted authoring (DEC-13, DEC-41, with the DEC-57 clarification), and the media-stack exception (DEC-49). Escalate only genuine new conflicts or institution-specific operational parameters, as OPEN candidates.
- **Do not replace the current implementation wholesale.** Inspect `references/plenum-runtime-slice/` v0.2.0 (and the live repository, if one exists beyond the corpus), classify preserve/change/deprecate, and build incrementally per Roadmap §9.

## Your role and outcome
You are the principal software architect, engineering program manager, QA/security architect and Codex implementation-prompt author for Plenum Studio. Produce a **repository-grounded, dependency-indexed, complete development promptbook** that a fresh Codex agent can execute one slice at a time. Your output is a collection of engineering tasks, NOT aspirational feature summaries. Each task must leave a working demonstrable vertical outcome, automated evidence and an appropriately scoped commit proposal.

## Phase G0 — discover evidence before authoring any tasks
1. Read the corpus in precedence order, starting with the Decision Register, Glossary and PRD. Do **not** look for AGENTS.md, PROJECT_BOOTSTRAP.md, QA_STANDARDS.md, UNIVERSAL_DESIGN_STANDARDS.md, Control Pack CTL-001–014 or Prompt Book v1.4 — those references were removed as unavailable (DEC-23). Their functions are now owned by: Roadmap §16 (assisted-development rule — anyone changing code first reads the requirement rows, governing sections, Glossary terms, contracts and tests), Roadmap §8/§13 (testing and acceptance evidence), PRD §6.9 and REQ-064 (accessibility) and 06 Data/Security (security controls).
2. Inspect the observed baseline under `references/plenum-runtime-slice/`: README, `package.json`/`package-lock.json`, `docker-compose.yml`, `migrations/001–004`, `src/`, `test/`, `contracts/openapi.yaml`, `definitions/fractured-order-reference.json`. Record the exact revision and the verified commands (see "Observed baseline" below). If a separate live repository exists and is inaccessible, do not claim inspection or invent paths; generate discovery-gated prompts and mark the plan provisional.
3. Create `SOURCE_REGISTER.md` pre-seeded from the corpus README contents table (path, version, status, owner, verified-read status, contradictions), and extend it only with genuinely new sources. Distinguish *implemented*, *specified*, *proposed*, *ratified*, *untested* — using the Decision Register status vocabulary, not a parallel one.
4. Use Glossary vocabulary exactly: Simulation Project, Core Design, Scenario, Draft, Definition Revision, Simulation Release, Session, Stage (DEC-33), Seat and Seat Assignment, Organization Role vs Session Role (DEC-44), Artifact / Decision Record / Action (DEC-35), Inject vs Domain Event vs Evidence Event (DEC-34), Message Channel vs Voice Channel (DEC-51), Effect Proposal / Approval Decision, Poll / Ballot / Tally / Certification, Floor Lease, Media Credential. Commands are imperative dot-case, events past-tense dot-case (DEC-38); command outcomes follow DEC-37 (`received`, `accepted`, `rejected`, `needs_reconciliation`; client-only `local_pending`; replay returns the original receipt with `replayed: true`); lifecycles follow DEC-39 (Publication) and DEC-40 (Inject). "Run" and "Workspace" are retired (DEC-30, DEC-36). The Glossary already contains the legacy-name crosswalk — reference it; do not author a second one. Do not silently change persisted IDs.
5. Keep a `CONFLICT_REGISTER.md` as a **working log only**: each entry records the conflict, proposed resolution, owner, affected task IDs, blocking status, and the candidate OPEN item text to submit to the Decision Register. Consequential contradictions are escalated, never resolved by guessing (Roadmap §16).

## Requirement-to-task coverage (key on existing IDs — do not mint new requirement IDs)
`REQUIREMENTS_TRACEABILITY.md` maps every one of REQ-001…REQ-094 and INV-001…INV-028 to tasks and executable verification, grouped by the PRD's own areas:
- Authoring/Studio: REQ-001, REQ-009…REQ-020 (visual no-code authoring DEC-07; validation catalog REQ-011; Information Policy default-deny REQ-016; template copy semantics REQ-017/DEC-32).
- Publication/Releases: REQ-021…REQ-023 (immutability INV-005/INV-012; portable Packages; signing OPEN-020).
- Runtime: REQ-024…REQ-035, REQ-004 (generic engines INV-022; single authority DEC-18/ADR-001/INV-017; commands/receipts DEC-37, DEC-43).
- Adjudication/plugins: REQ-036…REQ-040 and REQ-086…REQ-094 (Effect Proposals, DEC-54 approval with its carve-out, DEC-55 compositions, DEC-56 offline bundles, DEC-57 actor proposals, INV-020, INV-028).
- Live change: REQ-007, REQ-041, REQ-042 (ADR-004; INV-006, INV-010, INV-021).
- Offline: REQ-003, REQ-008, REQ-043, REQ-044 (INV-018, INV-026; Sync Protocol §4.3 fixed rules for ballots, voice and approvals).
- Identity/tenancy/security: REQ-045…REQ-052 (ADR-012, ADR-015; INV-001, INV-002).
- Evidence/reporting/research: REQ-006, REQ-053…REQ-062 (ADR-003; INV-015, INV-016; replay REQ-060/INV-013).
- Presentation/accessibility: REQ-063, REQ-064 (WCAG 2.2 AA).
- Deployment/operations: REQ-005, REQ-065…REQ-069, REQ-002 (DEC-19; 500×10 is a planning assumption, DEC-16; targets are OPEN-019).
- Contracts/compatibility: REQ-070, REQ-071 (contract lint against the Glossary).
- Polling/voting: REQ-072…REQ-078 (INV-023…INV-026; error codes `ALREADY_VOTED`, `DEADLINE_EXPIRED`).
- Voice/radio: REQ-079…REQ-085 (DEC-48 floor exception; INV-026, INV-027; `CONSENT_REQUIRED`).
Acceptance evidence reuses the corpus's existing test-ID families — AC-01…AC-13, SYNC-01…SYNC-15, VOTE-xx, VOICE-xx, EXT-xx, DB-xx — before inventing new IDs, and follows the Roadmap §13 evidence record shape.

## Stack baseline and decision procedure (v1.3 — Platform Architecture §23 and ADRs, superseding the v1.2 diagram)
The target stack is the Platform Architecture v1.3 §23 table plus ADR-006 to ADR-018 and DEC-49. v1.2's diagram-grounded claims of **NestJS + Fastify**, three separate workspace apps, and LiveKit/Python/WASM as fixed adapters are retired: no current document specifies NestJS or Fastify; the backend decision is **Node.js + TypeScript in one monorepo sharing contract types** (ADR-008, Proposed), and LiveKit is a *candidate* behind the Media Provider Adapter (ADR-017), not a hard dependency.

| Concern | Choice | Decision | Status |
|---|---|---|---|
| Frontend | React + TypeScript (reference slice stays HTML/CSS/vanilla JS) | ADR-007 | **Approved** |
| Backend runtime | Node.js 26 LTS target, 24 LTS floor; TypeScript monorepo | ADR-008 | Proposed |
| Topology | One modular monolith; PostgreSQL schemas `identity`, `studio`, `registry`, `runtime`, `sync`, `evidence` + `extension`, `voting`, `comms`; PostgreSQL-backed job queue; no broker/cache/service split until measured | ADR-005, ADR-016 | ADR-005 Proposed; ADR-016 Confirmed |
| Database | PostgreSQL 18 minimum in every profile (slice currently verified on 16 — see migration task) | ADR-009 | Proposed |
| Object storage | S3-compatible API only; Garage/SeaweedFS/Ceph RGW self-hosted; MinIO CE excluded | ADR-011 | Proposed |
| Identity | OIDC relying party; Keycloak bundled for self-hosted/air-gapped; **no Supabase in any profile** | ADR-006 (Approved), ADR-012 | Mixed |
| Realtime | Commands over HTTPS POST with idempotent receipts; Runtime deltas over SSE (resume ID = projection cursor, HTTP/2); Studio CRDT over authenticated WebSocket; polling-delta fallback | ADR-010 | Proposed |
| CRDT | Yjs candidate, Studio drafts only; Runtime commands are never CRDT-merged | ADR-002 | Proposed |
| Voice media | Self-hosted WebRTC SFU (LiveKit candidate) + TURN behind the Media Provider Adapter; approved exception to ADR-005/ADR-013, confined to the media-provider boundary, never writing Plenum PostgreSQL (internal media datastores such as Redis are allowed inside that boundary) | DEC-49, ADR-017 | Exception Confirmed; product choice Proposed |
| Plugin isolation | Hardened rootless containers, read-only images, default-deny egress; WASM/WASI additional target for deterministic models; hosts never get DB/object-store/secret access; Python and native scientific-model targets remain deferred | ADR-018 | Confirmed |
| Packaging | One OCI image set for all profiles; Compose/Podman reference single-node; Kubernetes optional; reverse proxy terminates TLS/HTTP/2; images also carry Extension Host, media server, TURN | ADR-013 | Proposed |
| Persistence depth | Relational current state + append-only Evidence journal; no full event sourcing | ADR-014 | Proposed |
| Tenant isolation | Server-context tenant identity; RLS as defense in depth under a non-owner role without BYPASSRLS; application policy engine for in-Session asymmetry | ADR-015 | Confirmed |

Code organization follows Platform §4: `apps/` (studio, runtime-web, operator-console, admin, server) and `packages/` (simulation-schema, validation-engine, release-compiler, policy-engine, workflow-engine, form-renderer, event-contracts, sync-client, plugin-sdk, extension-host, media-adapter, reporting-engine, design-system), with `references/plenum-runtime-slice/` retained. **Code topology is not deployment topology**: these folders build into one deployable server plus static frontends; do not read them as microservices.

**Candidates, not commitments.** Platform §23 lists React Router, TanStack Query, Zustand, React Hook Form, Zod, dnd-kit, React Flow, Vitest and Playwright as candidates to pin in implementation ADRs. v1.2's additional candidates (Vite, Radix, Tailwind, Tiptap, Kysely, IndexedDB/Dexie, OpenAPI 3.1 / JSON Schema, structured logging, OpenTelemetry) remain legitimate proposals where no ADR or document contradicts them — note the slice already ships OpenAPI 3.1. Record all of these in `TECHNOLOGY_DECISION_MATRIX.md` as a **consolidation of ADR-006…018, the §23 candidates and remaining proposals** (owners: OPEN-022 for workflow/policy engines, JSON Schema compatibility, report generation and model sandboxes) — never as a parallel authority, and never falsely labeled as specified. Build foundation tasks that pin chosen versions from actual lockfiles and toolchain checks.

### Architectural invariants attached to this stack (cite, don't paraphrase, in prompts)
1. **One authoritative Runtime per session** (DEC-18, ADR-001, INV-017): deployment ID + monotonic authority epoch; stale epochs rejected on every consequential write; explicit fenced operator transfer; no automatic cloud-to-LAN failover. Clients, model executors and media servers are never second authorities.
2. **Media is not voting state** (DEC-48, DEC-49): the SFU carries audio; NestJS-free Node core and PostgreSQL own eligibility, ballots, tallies, certification and evidence. Media-provider events are untrusted observations (ADR-017). Floor control (request, renew, release) is the one sanctioned exception to the standard command endpoint: dedicated low-latency endpoints, **never queued offline and never replayed after reconnection** (DEC-48, REQ-081, INV-026).
3. **CRDT is authoring-only** (ADR-002): Studio drafts converge via CRDT; publication freezes and fully validates the merged draft (REQ-001, REQ-021). Runtime offline work uses the durable Offline Outbox, receipts, revalidation and authoritative acceptance (Sync Protocol v1.1); a ballot queued offline is judged at server receipt time (REQ-078, INV-024).
4. **Extensions propose, humans approve, Runtime commits** (DEC-54, INV-020, INV-028, REQ-088): isolated, schema-validated, digest-pinned execution; Effect Proposals bound to proposal hash, state version, Governing Release and Authority Epoch; stale approvals fail with `STALE_PROPOSAL`; the approval requirement does **not** extend to designer-authored rules, scheduled Injects or automatic Stage transitions.
5. **Evidence is transactional and verifiable** (ADR-003, REQ-053, INV-015): every committed change and every rejected Command writes an Evidence Event in the same transaction with a gap-free per-Session sequence; signed Checkpoints over canonicalized ranges are independently anchored (custody: OPEN-017).
6. **Cloud and air gap both matter** (DEC-19, REQ-005, REQ-065, DEC-56): one build for all profiles; offline installation closure for artifacts, dependencies, keys and compatible plugins; `external_required` plugins are visibly incompatible with air-gapped profiles absent a verified local replacement; document TURN/certificate needs.
7. **Secret ballots stay secret** (INV-025, REQ-076, OPEN-028): choices separated from voter identity, absent from events, logs, analytics, plugin inputs and research exports by default.
8. **Capacity is a test target, not a claim** (DEC-16, REQ-002, OPEN-019): 500 Participants/Session × 10 concurrent Sessions (≤5,000 active) with separate workloads for API, ballot bursts (VOTE-14), media profile (VOICE-12), sync and plugin execution (EXT-19); scale technologies only when measurements justify (ADR-005).
9. **Deployment adapters, not cloud lock-in** (ADR-011…013): PostgreSQL, object storage, identity, media and trust management all operable locally without an Internet control plane.

### Required stack implementation tasks and tests
Generate vertical-slice foundation tasks that provision and verify, against the observed baseline where it exists: the monorepo and shared contract types (ADR-008) alongside, not replacing, the vanilla-JS slice; React/TS Studio→API interaction; PostgreSQL 18 verification of migrations 001–004 (the slice's Compose Pg 18 container is recorded **NOT RUN**; Pg 16 is the only verified engine); transactional publication/runtime on the slice's schema; SSE delta stream with resume cursor (ADR-010); Yjs draft-convergence spike feeding the Phase 3 collaboration slice (ADR-002); OIDC via Keycloak replacing the slice's demo headers (ADR-012; slice Limits); immutable object upload + digest verification over an S3-compatible store (ADR-011); Extension Host container isolation with one approved model proposal → human approval → exactly-once effect (ADR-018, REQ-088); Media Provider Adapter proof with a local SFU, permissioned channels and floor leases (ADR-017, REQ-080/081); the authoritative native voting flow including a secret ballot (REQ-072…078); and WASM/WASI feasibility only if accepted for the first release. Specify version pinning, exact Docker/network dependencies, CI command discovery, and negative authorization/offline cases. Where the product stack diverges from the slice, inventory the divergence, preserve working behavior and propose an explicit incremental migration ADR rather than silently rewriting (Roadmap §9).

## Observed implementation baseline (seed for COMMAND_REGISTRY and preserve/change/deprecate)
`references/plenum-runtime-slice/` v0.2.0 (Node ≥24, dependency `pg` only; HTML/CSS/vanilla JS per ADR-007): verified 2026-10-17 — `npm test` PASS (12 unit), `npm run smoke` PASS (31 e2e), `npm run dbtest` PASS (7 db), `npm run migrate` PASS on PostgreSQL 16, scripted-DOM walkthrough PASS; Pg 18 container, real browser, accessibility audit, load, offline client, air-gapped install, backup/restore all NOT RUN. Already proven and to be preserved: data-driven DEC-42 transitions with forbidden paths (no Scribe withdrawal after submit; no Facilitator return from `in_review`), DEC-43 rejected receipts with Evidence Events, DEC-37 replay semantics, canonical digests, per-session serialization with exactly-once commit, server-side deployment identity with epoch fencing, Session lifecycle gating, append-only evidence triggers, `plenum_app` least-privilege RLS. Known gaps (its Limits section) are the honest starting backlog: OIDC, visual Studio editors, Information Policy evaluation, Offline Outbox/SSE/device encryption, authority transfer (OPEN-016), checkpoint signing/anchoring, live-change activation, publication review workflow and Package compiler, full Session lifecycle.

## Promptbook deliverables (all must be generated)
1. `00_INDEX.md`: goals, definition of finished system (Roadmap §12 MVP definition of done), phased milestones mapped to Roadmap Phases 0–6 and Slices S1–S7, entry/exit criteria, and which exits are blocked by unconfirmed IDs (Decision Register §3) or production-gating OPEN items (OPEN-027 recording/transcription, OPEN-028 secret-ballot custody, OPEN-029 plugin trust).
2. `SOURCE_REGISTER.md` (pre-seeded, §G0.3), `REQUIREMENTS_TRACEABILITY.md`, `CONFLICT_REGISTER.md` (working log feeding OPEN candidates), `DECISION_INDEX.md` strictly as a **pointer table into the Decision Register** — IDs, one-line consequence for the promptbook, affected tasks; no restated decision text.
3. `DEPENDENCY_GRAPH.md` and `tasks.json`: unique IDs, title, owner module (Roadmap Epics A–N), dependencies, acceptance IDs, risk, priority, state, paths, proposed commit, available commands, `depends_on_unratified`.
4. `REPO_TOPOLOGY.md`: the Platform §4 monorepo layout reconciled with the actual tree, module ownership, dependency rules, environment matrix and version policy.
5. `COMMAND_REGISTRY.md`: executable commands with cwd, prerequisites, environment, timeout expectation, exact script source and acceptance evidence — seeded with the slice's verified `npm test`, `npm run smoke`, `npm run dbtest`, `npm run migrate`, `npm run seed`, `npm start` and their environment requirements (`DATABASE_URL`, `DEMO_*`, `PLENUM_LOCAL_DEMO`, `PLENUM_DEPLOYMENT_ID`). Mark proposed commands as 'created by Task X' until that task has passed.
6. `PROMPT_TEMPLATE.md` and numbered prompt files by phase (`prompts/P00/...` matching Roadmap Phases 0–6).
7. `MILESTONE_GATES.md` (incorporating Roadmap §3 contract-first gate, §13 evidence categories, §15 operational readiness / REQ-069), `SECURITY_AND_RECOVERY_MATRIX.md` (REQ-051, REQ-066…068), `PARITY_TEST_PLAN.md` (keyed to AC-09 and the pinned Fractured Order commit — gated on OPEN-003; reuses SYNC/VOTE/VOICE/EXT/DB test IDs), `RELEASE_READINESS.md`.
8. `CODEX_EXECUTION_STANDARD.md`: invocation, context bootstrap (begins with the Roadmap §16 assisted-development rule), working-tree safety, validation, handoff, commit protocol, pause/escalation rules.
9. `PROMPTBOOK_CHANGE_CONTROL.md`: regeneration, supersession, preserving task IDs, absorbing Decision Register updates (new confirmations, new OPEN resolutions) and avoiding duplication.
10. `COVERAGE_AND_QUALITY_REPORT.md`: uncovered REQ/INV IDs, unresolved blockers, dependency cycles, overlarge tasks, absent test commands, fictional status, unapproved architecture, and any task that silently treats an Assumed/Proposed decision as ratified.

## Scope and sequencing
Build dependency-ordered vertical slices aligned to Roadmap v1.3: Phase 0 reference audit (gated on OPEN-003 commit pin); Phase 1 platform kernel + Slice S1 (the existing slice is this phase's spike); Phase 2 configuration-driven Fractured Order + extension core + poll/voice Runtime services (exit: EXT-01…11, VOTE-01…10, VOICE-01…05); Phase 3 foundational Studio + Slice S3 collaboration, including Poll and Voice Channel editors, composition builder and offline bundles; Phase 4 advanced logic + Slice S4 live change; Phase 5 institutional scale (Slices S2, S5, S6, S7); Phase 6 plugin catalog expansion only. These are workstreams, not permission to leave authentication, evidence, accessibility or threat controls to a final cleanup phase — every early vertical slice includes its required security, persistence, failure and accessible-UI behavior.

The first product proof is PRD §8 exactly: a non-programming Designer publishes a Release; an Operator starts a Session; the DEC-42 Scribe → Facilitator → White Cell workflow runs with its return paths and forbidden paths; acceptance is AC-01 through AC-13 (including duplicate retry AC-10, queued reconnect AC-11, conflicting adjudication AC-12 and rejection evidence AC-13). The generalization gate is Roadmap §14: two deliberately different validation simulations (policy negotiation; crisis response) run without Runtime code changes, plus the Phase 2 acceptance test (rename Teams, add a Stage, change a Form field and a role interface without source edits). Do not promise an integration pass when PostgreSQL or UI execution is unavailable.

## Per-prompt mandatory contract
Every prompt MUST use this ordered contract:
- `ID / title / goal / user outcome / risk`.
- `Requirements and invariants`: REQ/INV/AC/DEC/ADR IDs with source path+section; explicit authority; `depends_on_unratified` where applicable.
- `Prerequisites`: task IDs, migrations, tested contracts and required git state.
- `Inspect before editing`: real entrypoints, source paths, scripts and states to read.
- `Allowed scope and files`: concrete expected paths ONLY if verified, otherwise a path-discovery instruction; forbid unrelated refactors.
- `Implementation`: domain transitions, APIs/schemas/events (09 envelope, DEC-38 naming, documented error codes), migrations, valid and invalid behaviors, module boundaries, client states (REQ-043 including `local_pending`) and failure recovery.
- `Authorization/privacy`: trusted principal, Organization/Session scope, allowed actions, negative tests, leakage constraints (INV-002; REQ-047 server-side omission, not UI hiding).
- `Concurrency/idempotency/versions`: command ordering, Governing Release pinning (INV-021), authority epoch, DEC-37 retry behavior.
- `Non-goals and explicitly prohibited side effects`.
- `Acceptance`: Given/When/Then observable results including unauthorized, disconnected, stale and partial-failure cases.
- `Tests`: precise kinds per Roadmap §8, fixtures, determinism, integration environments, measured limits; reuse corpus test IDs where they exist.
- `Validation commands`: exact verified commands and expected evidence; NEVER guess a command exists; if unavailable, name the prerequisite task creating it.
- `Regression and quality gates`: existing workflows, slice behaviors and accessibility states to preserve.
- `Docs and continuity`: required ADR/contract/README/PROJECT_STATE updates; candidate OPEN items raised.
- `Commit`: branch, Conventional Commit subject ≤72 chars where feasible, detailed body (why, what, tests, migration, risks), expected files. Never commit a failed gate or unrelated changes; perform an actual commit only if authorized by repo workflow.
- `Handoff`: status PASS/FAIL/BLOCKED/NOT RUN, command-output reference, modified files, behavior demonstrated, blockers and next eligible task.
Use strong, contextual, actionable commands, not generic 'ensure quality'. Do not duplicate dozens of low-level tests in E2E.

## Codex execution rule
For each prompt: read the Roadmap §16 rule, PROJECT_STATE and the task; check git status and current versions; verify the dependency gate; state a small plan; inspect the existing implementation; implement only the bounded task; execute narrow then affected broad checks; record exact outcomes and unresolved defects; update linked contracts; prepare a focused commit and review the diff; commit only if the repo workflow authorizes it. Do not deploy, purchase cloud resources, run destructive migrations or change production secrets without explicit separate authorization. Never invent requirements, terms, metrics, transitions or permissions; route contradictions to the Decision Register as OPEN candidates. Stop only on genuine critical blockers; complete independent safe subtasks if feasible.

## Git contract
Branch pattern `feat/ps-<ID>-<slug>` or `fix/ps-<ID>-<slug>`; use the project's conventions where already approved. Commit subject examples: `feat(runtime): enforce artifact handoff transitions`; `feat(voting): certify quorum-aware poll results`; `test(sync): cover stale offline command retries`. Body:
```
Why:
- ...
What:
- ...
Verification:
- <exact command> — PASS/FAIL/NOT RUN and evidence
Compatibility / migrations:
- ...
Risks / follow-up:
- ...
Refs: PS-..., REQ-..., DEC-...
```
Don't create a git commit unless explicitly requested or the existing repo workflow grants authority; propose title/body regardless.

## Coverage and fitness gates
1. Every REQ maps to at least one implementation prompt and executable verification gate (or a named, documented future milestone consistent with Roadmap phasing); every implementation prompt cites its REQ/INV/DEC/ADR IDs.
2. Every prompt references only existing prerequisite outputs or planned outputs of earlier tasks; the dependency graph is acyclic, except human review nodes that are not programmatic dependencies.
3. Test tasks include at least one realistic case each of: negative authorization, stale command, deployment outage, tamper detection (against signed Checkpoints), no-Internet operation (REQ-005 air gap, REQ-078 LAN poll, REQ-084 LAN voice) and the DEC-48 floor-control non-replay rule.
4. Pinning/version compatibility is tested for Release, Plugin and Platform Adapter digests (INV-028), schema, contract versions (REQ-070) and persisted Session history.
5. Computed proposal, human Approval Decision and committed effect are distinguished everywhere (INV-008, INV-020); automatic consequential plugin effects are prohibited; the DEC-54 carve-out is respected so designer-authored automation is not wrapped in spurious approval gates.
6. Secret-ballot privacy holds against ordinary readers including other participants (INV-025); no plaintext ballots in event feeds, logs, exports or plugin inputs by default; production secret ballots remain gated on OPEN-028.
7. Media permissions cover join/listen/transmit/broadcast, floor lease, revocation and expiry at the transport boundary; recording and transcription are off by default and consent-gated (DEC-50, INV-027, OPEN-027).
8. A fresh-checkout runnable path and a verified PostgreSQL-backed smoke test (the slice's `npm run smoke` or its successor) are required before declaring the platform foundation complete; PostgreSQL 18 verification is an explicit early task.
9. No fabricated command results, performance claims, certification, user research or tests; capacity statements always cite DEC-16 as a planning assumption and OPEN-019 as the unresolved target.
10. Ask for consequential missing approvals only when they block safe work; distinguish operational policies yet to be configured (OPEN-009, OPEN-015, OPEN-017, OPEN-019, OPEN-024, OPEN-027…029) from product decisions already Confirmed.

## Output sequence
Stage A: source inventory and conflict report (no code changes). Stage B: architecture/stack reconciliation and the actual test command registry. Stage C: dependencies, phased feature slices and task index. Stage D: detailed Codex prompts with commits and acceptance contracts. Stage E: full traceability/lint/deduplication/quality audit and revised promptbook. Provide a short executive summary, status of verified versus proposed elements, highest-risk unresolved items and the exact next runnable task. **Do not implement application code while generating the promptbook.**

## Additional controls — promptbook precision and engineering operations
### A. Two-pass prompt authoring, without fabricating codebase facts
1. **Coverage pass:** enumerate all normative REQ/INV IDs with section anchors, create candidate vertical slices, dependency edges, risk classes and planned evidence. Mark unknown existing repo commands as unresolved discovery tasks.
2. **Executable pass:** only after repository inspection, replace candidate paths, scripts, versions, commands and fixtures with observed details. Every task has `source_evidence`, `prerequisites_verified`, and `ready_to_execute` fields. If a repo beyond the corpus is unavailable, deliver a complete *provisional* promptbook with discovery gates; never label it immediately executable.
3. Enforce uniqueness across task IDs, event names, domain owners and migration identifiers; requirement IDs are the PRD's and are never re-minted. Do not create a parallel authoritative contract in prose where OpenAPI/JSON Schema/SQL already exists (the slice ships `contracts/openapi.yaml`; 09 owns command/event contracts).

### B. Contract-first cross-cutting conventions
The generated promptbook MUST explicitly govern:
- canonical clock and timestamp conventions (server-authoritative time, INV-011; device clocks observational only);
- UUID/key policy, DEC-38 naming for commands and events, canonical enum vocabulary, SQL naming, JSON naming and the 09 error envelope with its documented error codes;
- transaction + Evidence Event + command receipt + transactional outbox atomicity (REQ-053, DEC-43);
- RLS tenant isolation and Session-level authorization as separate layers (ADR-015);
- environment-scoped secret references, signed Releases/Packages/Plugins (OPEN-020, OPEN-029), offline dependency closure and asset portability (REQ-023, DEC-56);
- schema evolution with expand/backfill/switch/contract rehearsed against representative data (Roadmap §9.3; Data Model §11); compatibility matrices for Package, API, client, plugin and persisted Session versions (REQ-070, OPEN-012);
- consent, disclosure, retention, recording configuration, and privacy-preserving voting evidence (REQ-058, REQ-059, REQ-076, REQ-083).
These are coverage checks, not permission to override existing canonical contracts.

### C. Detailed executable manifest schema
Require `tasks.json` to validate against a `task.schema.json` generated with the promptbook. Minimum task fields: `id`, `slug`, `phase`, `title`, `category`, `primary_owner` (Epic A–N), `product_requirements` (REQ/INV IDs), `source_refs`, `depends_on_unratified`, `prerequisites`, `scope`, `non_goals`, `deliverables`, `migration_ids`, `api_contract_ids`, `test_ids`, `validation_command_refs`, `acceptance_criteria`, `risk`, `approval_gate`, `implementation_state`, `evidence`, `commit_subject`, `commit_body`, `revisit_triggers`. Include a script or documented validator for unique IDs, missing links, cycles, invalid states and orphaned requirements. A generated test command in the registry is never silently treated as executable until its creating task has passed.

### D. Deliverable maturity and honest release claims
Require an explicit maturity matrix across **design specified / implementation started / tested locally / integrated / security reviewed / performance verified / deployment verified / release approved**, consistent with the Roadmap §17 status table and the slice's PASS/NOT RUN verification record. A task can be implementation-complete without making any production claim. A later task's unverified future acceptance conditions remain unverified. Full release requires owner approval (and OPEN-001 role confirmation) in addition to objective engineering evidence.

### E. Comms and voting architectural invariants
- Voice Channel grants reflect authoritative Seat Assignment, Session Role and active Stage, with `join`, `listen`, `transmit`, `floor`, `broadcast`, revoke and expiry semantics (REQ-080); server arbitration enforces at most one Floor holder where exclusivity applies, with bounded leases and recorded authorized preemption (REQ-081). Transport events are untrusted observations, distinct from authoritative simulation records (ADR-017). Voice lifecycle, join, moderation, recording and transcription changes are standard Commands with Evidence Events (REQ-082); floor control alone uses the DEC-48 dedicated endpoints.
- Poll Definitions are versioned and frozen at open (INV-023); eligibility is captured server-side at the defined point; thresholds, denominators, abstention, quorum, weights, vetoes and tie rules are explicit with no implicit defaults (REQ-072); Tallies are reproducible from the accepted Ballot set and pinned method version, and Certification binds the result hash to that set (REQ-075). Retried ballots cannot double-count (REQ-073). Reconnect-after-close and clock disagreement are handled explicitly (INV-024; `DEADLINE_EXPIRED`).
- LAN provides live voice and voting without public Internet (REQ-078, REQ-084); a fully disconnected device cannot participate in live audio, hold the Floor, cast an authoritative Ballot or issue an Approval Decision (INV-026); delayed ballot acceptance follows a recorded grace policy in the Poll Definition only (INV-024).
- Plugin-generated consequential effects require the distinct DEC-54 approval; user-cast Ballots follow core voting rules and are never misclassified as plugin effects; certified results change state only through an ordinary authorized Command (REQ-077).

### F. CI and reproducible operations
For each phase record toolchain pinning, lockfile ownership, clean-checkout setup, container profiles, seed fixtures, disposable test environments, safe migration simulation, rollback/forward fix, backup-and-restore verification (REQ-066 restore drills), logging/metrics, and security/secret scanning (REQ-051). Define an air-gap validation lane with an explicit network-deny test and bundled dependencies (REQ-005, REQ-090). Measure the DEC-16 workload on named hardware/load conditions against OPEN-019 targets before asserting performance.

### G. Prompts and commit discipline
Every task includes **both** a ready-to-paste Codex instruction and structured machine-readable metadata. Proposed branch and Conventional Commit title/body must be unambiguous; include a PR description with Summary, Risks, Migration, Evidence and Rollback. A failed test results in no completion claim; if the repo grants commits for WIP, distinguish them from completion commits. Avoid `git add .`, force push, destructive reset, or broad package upgrades.

### H. Acceptance tests for the promptbook itself
Ship a rubric and inspect a representative sample of at least: (i) repo foundation task, (ii) database migration (including the Pg 16→18 verification), (iii) Studio authoring workflow, (iv) Runtime adjudication, (v) offline reconciliation (AC-11), (vi) plugin human approval (REQ-088), (vii) secret ballot (REQ-076), (viii) radio floor control (REQ-081 with DEC-48 non-replay), and (ix) air-gapped deployment (REQ-005). Verify each has complete dependencies, exact-or-discovery-gated commands, a negative test, an evidence contract, a commit body and a handoff. If a sample fails, revise the prompt template and regenerate affected prompts before handoff.

### I. Required final artifacts
Include `task.schema.json`, `PROMPTBOOK_VALIDATION_REPORT.md`, `TECHNOLOGY_DECISION_MATRIX.md`, `DEPLOYMENT_PROFILES.md` (the three DEC-19 profiles against ADR-013), `CONTRACT_COMPATIBILITY_MATRIX.md`, `DATA_MIGRATION_REGISTER.md`, `RELEASE_GATES.md`, `TASK_HANDOFF_TEMPLATE.md`, and `REQUIREMENT_CHANGE_IMPACT.md`. Consolidate logically where the corpus already has authoritative equivalents (Decision Register, Glossary crosswalk, Roadmap gates, 09 contracts, Data Model §11 migration policy); do not produce duplicates solely to satisfy filenames.

### Final user-facing summary requirement
Report: reviewed sources and versions against the corpus README table, missing inputs, adopted stack (Approved vs Proposed vs candidate) versus remaining proposals, number of vertical slices, REQ/INV coverage and exclusions, dependency-cycle status, command verification status (seeded from the slice's 2026-10-17 record), sample-task QA results, outstanding approval gates (OPEN-001, OPEN-002, OPEN-003, Decision Register §3 confirmations, OPEN-027…029), and the first eligible executable Codex prompt. Never claim the application was built merely because the promptbook was generated.

## Change log
| Version | Date | Change |
|---|---|---|
| 1.3 | 2026-10-17 | Reground on the rebuilt corpus: authority chain replaced with the Decision Register / Glossary / PRD v0.7 precedence; removed DEC-23-retired governance files from G0; requirement coverage re-keyed to REQ-001…094, INV-001…028, AC-01…13; stack section rewritten from Platform §23 and ADR-006…018 (NestJS/Fastify and the download.svg table retired; Approved vs Proposed marked; no-Supabase, SSE/WebSocket, Keycloak, Pg 18, media exception DEC-49, floor exception DEC-48, DEC-54 carve-out added); observed-baseline section added from slice v0.2.0 with its verified commands and limits; sequencing aligned to Roadmap Phases 0–6, Slices S1–S7, Epics A–N and first-release scope DEC-46/47/58; first proof bound to PRD §8 AC-01…13; `depends_on_unratified` labeling and production-gating OPEN items added; conflict handling routed to Decision Register OPEN candidates. |
| 1.2 | — | Prior version (diagram-grounded stack; superseded). |
