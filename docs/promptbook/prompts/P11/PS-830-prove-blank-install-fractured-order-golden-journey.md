# PS-830 - Implement approved authoring rules and prove the Fractured Order golden journey

## ID / title / goal / user outcome / risk

- ID: `PS-830`
- Title: Implement approved authoring rules and prove the Fractured Order golden journey
- Goal: Deliver the approved concept, form, Decision Record and Inject behavior through supported product workflows, then prove the original and customized Fractured Order design-to-archive journeys.
- User outcome: A non-programming Designer customizes sectors, role arrangements, forms and adjudication in Studio, publishes under policy and runs a traceable Session without source edits, SQL or raw JSON authoring.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-009`, `REQ-020`, `REQ-024`, `REQ-032`, `REQ-054`, `REQ-060`, `REQ-063`, `REQ-064`, `REQ-069`, `INV-022`, `REQ-012`, `REQ-014`, `REQ-028`, `REQ-030`, `REQ-070`, `INV-009`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-009`, `REQ-020`, `REQ-024`, `REQ-032`, `REQ-054`, `REQ-060`, `REQ-063`, `REQ-064`, `REQ-069`, `INV-022`, `REQ-012`, `REQ-014`, `REQ-028`, `REQ-030`, `REQ-070`, `INV-009`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 1
- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 8
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap sections 12 through 15
- `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` — 08 Canon section 12
- `references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md` — Teludens Design Language sections 0 through 13
- `references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md` — Teludens Spatial Grammar sections 1 through 14
- `references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md` — Teludens Experience Physics sections 1 through 15
- `references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md` — Teludens Reference Slice sections 1 through 20
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register sections 3, 5.7 and 7.1 through 7.5
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-004
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-010
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-013
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-018
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-63
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-64
- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema sections 9 and 10
- `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` — 08 Canon sections 2 through 5

Observed source evidence:

- apps/studio/src/App.tsx
- apps/runtime-web/src/App.tsx
- apps/server/src/http/runtime-http.ts
- references/teludens-design-system-catalog/README.md
- references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md
- references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md
- references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md
- references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md
- references/teludens-design-system-catalog/docs/TELUDENS_TOKENS.json
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Primary.png
- packages/validation-engine/src/index.ts
- packages/simulation-schema/src/index.ts
- apps/studio/src/core-design/Editor.tsx
- apps/server/src/studio/content-library.ts
- apps/server/src/runtime/information-flow.ts

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-820`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Official Fractured Order parity inventory
- All product user-test scripts
- Clean-install environment
- Release source and Scenario asset provenance
- Operator and participant role coverage
- Read APPROVAL_IMPLEMENTATION_PROMPTBOOK.md for the remaining-sequence ownership, checkpoint and exact-candidate evidence rules; tasks.json remains the task source of truth
- Decision Register v1.0.16 resolves OPEN-004/010/016/023 and the prior assumptions; approval is not implementation evidence and never waives PS-810, provider, mail, accessibility or named human gates
- Use supported Windows/macOS desktop browsers at the declared minimum 1024 x 768 and equivalent 200% zoom, keyboard, pointer, forced colors, reduced motion and named desktop AT; mobile/touch acceptance remains approved N/A
- Inventory existing uncommitted work and prior evidence before changes; preserve unrelated work and distinguish local source, committed candidate and deployed staging digests
- Before provisioning disposable databases/containers, check disk capacity and record exact task-owned resource identifiers; reuse safely where possible, clean up only authorized task-owned resources, and never run broad volume/image pruning

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Fresh installation and initial Organization setup
- UI-only Project and Release authoring or approved Template import plus visual verification of every element
- Session creation, staffing and full role execution
- Control, Inject, communication, Poll, Voice, adjudication, offline and recovery cases
- Reports, evidence verification, replay, archive and restore
- Implement OPEN-004 and OPEN-010 across schema, publication, Studio, Runtime, server validation and export
- Align single-Action and configurable per-recipient Inject behavior with DEC-63/64; verify all prior assumption confirmations without reopening their decisions

Expected paths are discovery targets, not permission to invent absent structure:

- tests/e2e/golden-journey/
- docs/acceptance/
- output/playwright/golden-journey/
- test-results/golden-journey/
- apps/studio/src/
- apps/runtime-web/src/
- apps/server/src/
- packages/simulation-schema/
- packages/validation-engine/
- packages/release-compiler/
- packages/form-renderer/
- tests/platform/
- apps/server/test/
- scripts/
- package.json
- docs/promptbook/CONTRACT_COMPATIBILITY_MATRIX.md
- docs/promptbook/DATA_MIGRATION_REGISTER.md

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Checkpoint A - Baseline: inspect dirty working changes, existing Energy proof and PS-820 installation evidence. Reproduce failures before editing. Retain the original Fractured Order baseline and record currently verified vs missing capabilities
- Checkpoint B - Concepts: establish one stable-key concept registry consumed by Studio and server publication validation. Protect mandatory foundations, derive dependencies from actual enabled references, retain disabled authored content, exclude inactive behavior from compiled execution and report actionable errors. Verify a simple one-Stage design and Fractured Order
- Checkpoint C - Forms: implement the approved basic field/reference types, units, conditional rules and bounded repeating groups end to end. Enforce OPEN-010 limits on the server and expose them in Studio. Define the exact byte convention and bounded structured-submission size with evidence; update authoritative versioned contracts and representative old/new fixtures
- Checkpoint D - Expressions and text: implement restricted deterministic computed fields and safe formatted text; recompute authoritative values server-side, preserve formula versions and reject cycles, missing inputs, division errors and unsafe content. Do not execute Designer code or grant expression access to hidden data
- Checkpoint E - Files and interchange: reuse existing object-storage and scan mechanisms for permission-scoped form attachments; enforce count/size/aggregate limits and unavailable-until-clean behavior. Implement versioned JSON import/export, CSV mapping previews and linked repeating-group tables, plus readable PDF where supported. Test access, retention and partial failures
- Checkpoint F - Decision and Inject semantics: enforce one Action per Decision Record and prove multi-record adjudication. Make acknowledgement/response requirements configurable with independent recipient progress and completion from Release rules. Test informational, acknowledgement-only and response-required Injects, duplicate delivery and revoked access
- Checkpoint G - Studio proof: from a blank supported install and documented identity bootstrap, import the official Template through the public UI, visually verify it, then add Energy sector, a second Facilitator sharing the intended team role, a required contingency field and rubric adjudication. Configure Orientation requirements through Studio; never bypass readiness with SQL or service calls
- Checkpoint H - Golden acceptance: create and verify CMD-GOLDEN-JOURNEY, run the unchanged reference and customized design through distinct-author approval, publication, staffing, participant submission, adjudication, allowed effects, reports, evidence verification, replay and archive. Record every supported role and required capability; deferred production modes stay unavailable
- Close and verify each checkpoint before the next. Use focused domain/integration/browser checks for the changed behavior; run broader required task gates on the converged candidate. A partial checkpoint is not PS-830 PASS

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Reuse the existing trusted OIDC, Organization Role, Session Role, Seat and RLS boundaries
- Return only server-authorized data and test cross-Organization, cross-Session and revoked access
- Use synthetic test identities and never expose secrets or protected content in screenshots or logs

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Preserve idempotent Commands, immutable Releases and Governing Release pins
- Make persistent mutations transactional and version-aware
- Test duplicate, stale, interrupted and concurrent user actions

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not seed domain records directly into SQL
- Do not call private service functions instead of product APIs/UI
- Do not waive unavailable or inconvenient features
- Do not enable deferred arbitrary scripts, deep form nesting, complex matrix/ranking editors, production recording/transcription or secret ballots
- Do not count the Energy customization proof alone as full OPEN-010 coverage or claim model scientific accuracy from workflow correctness
- Do not mutate historical form submissions or published Releases to fit new contracts; create explicit versioned compatibility paths
- Do not implement authority transfer here; PS-845 owns it. Infrastructure/identity bootstrap may use documented setup, but simulation domain state must be created through supported UI workflows

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- PS-830-T03: stable-key mandatory/optional concept rules work on server and UI; disabled draft content survives and enabled references to disabled concepts block publication with precise locations
- PS-830-T04: every approved supported field type and repeating structure round-trips Studio, published Runtime, server validation and export; exact OPEN-010 boundaries and one-over cases are verified; old Releases/submissions remain valid under their own version
- PS-830-T05: calculations are deterministic, server-authoritative and version-pinned; erroneous/cyclic expressions and unsafe formatted text fail safely without hidden-data leaks
- PS-830-T06: attachment permission, scan-unavailability/quarantine, count/size totals and retention work; malformed imports fail with usable feedback and exports preserve authorized structure
- PS-830-T07: one Action per record and multi-record adjudication are proven; configured Inject completion respects independent recipients and does not force optional acknowledgement/response steps
- PS-830-T08: all four user-approved Energy variations are authored, published and executed through Studio/product interfaces, including the required contingency validation and rubric result with appropriate human approval
- PS-830-T01/T02 and AC-09: unchanged reference and customized UI-only journeys reach completed/archive state with verified evidence, reports and historical-version readability; all required non-deferred parity capabilities are evidenced
- Given the documented preconditions, when the task behavior is exercised, then no core workflow requires raw IDs, SQL, raw JSON authoring, private service calls or simulation-specific Runtime branches; platform branding and desktop accessibility remain conformant

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- UI-only golden journey
- Role-by-role evidence bundle
- Completed Session archive and verified reports
- Human acceptance script
- Checkpoint A-H acceptance matrix with direct evidence for each approved capability
- Versioned shared form/concept contracts, compatibility fixtures and declared limits
- Energy variation plus unchanged-reference journey bundles; partial prior walkthrough remains historical only

## Tests

Required test/evidence IDs: `PS-830-T01`, `PS-830-T02`, `AC-09`, `PS-830-T03`, `PS-830-T04`, `PS-830-T05`, `PS-830-T06`, `PS-830-T07`, `PS-830-T08`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-GOLDEN-JOURNEY`, `CMD-PARITY`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-EVIDENCE-VERIFY`, `CMD-GAP-AUDIT`, `CMD-TELUDENS-AUDIT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-REPORT-RECONCILE`, `CMD-CLEAN-INSTALL`, `CMD-SECURITY`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- All 17 Fractured Order parity targets remain PASS
- The Runtime contains no simulation-name branches
- Every encountered defect is fixed and rerun from the nearest durable checkpoint
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the approved catalog Plenum primary wordmark with theme-safe presentation is used as platform branding; simulation content cannot replace platform identity

The approval gate is: All checkpoints and required automated/human product acceptance must pass for PS-830 completion. Prior PS-815/820 human or provider deferrals remain release blockers; safe independent preparation does not imply predecessor acceptance. Freeze a new candidate after the implementation checkpoints for downstream UAT. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed
- Update APPROVAL_IMPLEMENTATION_PROMPTBOOK.md only for execution/evidence links; preserve the task source and approval boundaries
- Record source/image/lockfile/schema/configuration/Release and environment identity; a changed candidate requires impact assessment and affected gate reruns, not copied PASS labels
- Return a checkpoint handoff with completed behavior, exact evidence, unresolved dependencies, candidate identity and the next safe step; do not collapse partial/internal/automated/human/final acceptance into one PASS

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-830-prove-blank-install-fractured-order-golden-journey`
- Proposed subject: `feat(studio): implement approved design and golden journey`
- Expected migrations: none
- Expected API/contract IDs: `golden-journey-evidence-v1`

Proposed body:

```text
Why:
- Deliver owner-approved customization as a complete Studio-to-Runtime workflow.
What:
- Concept dependencies, bounded forms, single-Action and Inject semantics, and original/Energy golden journeys in focused checkpoint commits when authorized.
Verification:
- Execute checkpoint tests, registered commands and human acceptance; retain missing evidence explicitly.
Compatibility / migrations:
- Version contracts and preserve historical Releases and submissions; allocate migrations only after inspecting the schema.
Risks / follow-up:
- Full provider, operational transfer and production approval remain separate.
Refs: PS-830, OPEN-004, OPEN-010, DEC-63, DEC-64
```

Proposed PR description:

Implement the approved authoring capabilities across Studio, publication, Runtime and export, then prove original and Energy Fractured Order journeys. Report checkpoint evidence, historical compatibility, remaining acceptance gates and actual migrations; use focused changes rather than a single unreviewable patch.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
