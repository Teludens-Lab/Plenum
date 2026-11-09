# PS-840 - Prove cross-simulation UAT and close product completeness gaps

## ID / title / goal / user outcome / risk

- ID: `PS-840`
- Title: Prove cross-simulation UAT and close product completeness gaps
- Goal: Independently demonstrate that the approved authoring behavior generalizes beyond Fractured Order and close every applicable product-owned completeness obligation.
- User outcome: Real target users can build and run materially different simulations, and the release packet contains no unknown, fixture-only, inaccessible or untested product behavior.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-006`, `REQ-007`, `REQ-008`, `REQ-009`, `REQ-010`, `REQ-011`, `REQ-012`, `REQ-013`, `REQ-014`, `REQ-015`, `REQ-016`, `REQ-017`, `REQ-018`, `REQ-019`, `REQ-020`, `REQ-021`, `REQ-022`, `REQ-023`, `REQ-024`, `REQ-025`, `REQ-026`, `REQ-027`, `REQ-028`, `REQ-029`, `REQ-030`, `REQ-031`, `REQ-032`, `REQ-033`, `REQ-034`, `REQ-035`, `REQ-036`, `REQ-037`, `REQ-038`, `REQ-039`, `REQ-040`, `REQ-041`, `REQ-042`, `REQ-043`, `REQ-044`, `REQ-045`, `REQ-046`, `REQ-047`, `REQ-048`, `REQ-049`, `REQ-050`, `REQ-051`, `REQ-052`, `REQ-053`, `REQ-054`, `REQ-055`, `REQ-056`, `REQ-057`, `REQ-058`, `REQ-059`, `REQ-060`, `REQ-061`, `REQ-062`, `REQ-063`, `REQ-064`, `REQ-065`, `REQ-066`, `REQ-067`, `REQ-068`, `REQ-069`, `REQ-070`, `REQ-071`, `REQ-072`, `REQ-073`, `REQ-074`, `REQ-075`, `REQ-076`, `REQ-077`, `REQ-078`, `REQ-079`, `REQ-080`, `REQ-081`, `REQ-082`, `REQ-083`, `REQ-084`, `REQ-085`, `REQ-086`, `REQ-087`, `REQ-088`, `REQ-089`, `REQ-090`, `REQ-091`, `REQ-092`, `REQ-093`, `REQ-094`, `INV-001`, `INV-002`, `INV-003`, `INV-004`, `INV-005`, `INV-006`, `INV-007`, `INV-008`, `INV-009`, `INV-010`, `INV-011`, `INV-012`, `INV-013`, `INV-014`, `INV-015`, `INV-016`, `INV-017`, `INV-018`, `INV-019`, `INV-020`, `INV-021`, `INV-022`, `INV-023`, `INV-024`, `INV-025`, `INV-026`, `INV-027`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-006`, `REQ-007`, `REQ-008`, `REQ-009`, `REQ-010`, `REQ-011`, `REQ-012`, `REQ-013`, `REQ-014`, `REQ-015`, `REQ-016`, `REQ-017`, `REQ-018`, `REQ-019`, `REQ-020`, `REQ-021`, `REQ-022`, `REQ-023`, `REQ-024`, `REQ-025`, `REQ-026`, `REQ-027`, `REQ-028`, `REQ-029`, `REQ-030`, `REQ-031`, `REQ-032`, `REQ-033`, `REQ-034`, `REQ-035`, `REQ-036`, `REQ-037`, `REQ-038`, `REQ-039`, `REQ-040`, `REQ-041`, `REQ-042`, `REQ-043`, `REQ-044`, `REQ-045`, `REQ-046`, `REQ-047`, `REQ-048`, `REQ-049`, `REQ-050`, `REQ-051`, `REQ-052`, `REQ-053`, `REQ-054`, `REQ-055`, `REQ-056`, `REQ-057`, `REQ-058`, `REQ-059`, `REQ-060`, `REQ-061`, `REQ-062`, `REQ-063`, `REQ-064`, `REQ-065`, `REQ-066`, `REQ-067`, `REQ-068`, `REQ-069`, `REQ-070`, `REQ-071`, `REQ-072`, `REQ-073`, `REQ-074`, `REQ-075`, `REQ-076`, `REQ-077`, `REQ-078`, `REQ-079`, `REQ-080`, `REQ-081`, `REQ-082`, `REQ-083`, `REQ-084`, `REQ-085`, `REQ-086`, `REQ-087`, `REQ-088`, `REQ-089`, `REQ-090`, `REQ-091`, `REQ-092`, `REQ-093`, `REQ-094`, `INV-001`, `INV-002`, `INV-003`, `INV-004`, `INV-005`, `INV-006`, `INV-007`, `INV-008`, `INV-009`, `INV-010`, `INV-011`, `INV-012`, `INV-013`, `INV-014`, `INV-015`, `INV-016`, `INV-017`, `INV-018`, `INV-019`, `INV-020`, `INV-021`, `INV-022`, `INV-023`, `INV-024`, `INV-025`, `INV-026`, `INV-027`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 6
- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 3 through 27
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime sections 2 through 23
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap sections 12 through 15
- `references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md` — Teludens Design Language sections 0 through 13
- `references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md` — Teludens Spatial Grammar sections 1 through 14
- `references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md` — Teludens Experience Physics sections 1 through 15
- `references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md` — Teludens Reference Slice sections 1 through 20
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register sections 3, 5.7 and 7.1 through 7.5
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-004
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-010
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-63
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-64

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

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-830`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Product completeness matrix
- Fractured Order golden-journey evidence
- Policy-negotiation and crisis-response fixtures
- All user feedback and defect ledgers
- Every supported screen/state/viewport/input combination
- Read APPROVAL_IMPLEMENTATION_PROMPTBOOK.md for the remaining-sequence ownership, checkpoint and exact-candidate evidence rules; tasks.json remains the task source of truth
- Decision Register v1.0.16 resolves OPEN-004/010/016/023 and the prior assumptions; approval is not implementation evidence and never waives PS-810, provider, mail, accessibility or named human gates
- Use supported Windows/macOS desktop browsers at the declared minimum 1024 x 768 and equivalent 200% zoom, keyboard, pointer, forced colors, reduced motion and named desktop AT; mobile/touch acceptance remains approved N/A
- Inventory existing uncommitted work and prior evidence before changes; preserve unrelated work and distinguish local source, committed candidate and deployed staging digests
- Before provisioning disposable databases/containers, check disk capacity and record exact task-owned resource identifiers; reuse safely where possible, clean up only authorized task-owned resources, and never run broad volume/image pruning

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Task-based UAT with Designers, Operators, Participants, Reviewers and Research users
- UI-only creation and execution of two contrasting simulations
- Product requirement/screen/API/state/accessibility/security evidence audit, with separately owned external/operational gates explicitly carried to PS-850
- Defect correction and rerun until every blocking row passes

Expected paths are discovery targets, not permission to invent absent structure:

- docs/acceptance/
- tests/e2e/generalization/
- tests/e2e/product/
- test-results/uat/
- docs/promptbook/PRODUCT_COMPLETENESS_MATRIX.md

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Run observed task-based UAT and record hesitations, failures and recovery attempts
- Author and run both validation simulations through public UI workflows
- Run the structural completeness audit and review each product-owned obligation. Keep PS-815/820 external/human and PS-845 operational evidence explicitly pending; the unscoped release audit belongs to PS-850 and must not pass early
- Fix every S0-S2 product defect and rerun affected journeys
- Build policy negotiation with optional numeric/adjudication mechanics disabled and crisis response with resources, conditional Injects and richer Forms. Verify enabling/disabling, preserved draft content, dependency denials and per-recipient completion using ordinary Designer workflows
- Use a second target-user reviewer for the PS-830 evidence; newly discovered capability defects return to the owning PS-830 checkpoint and invalidate affected golden/UAT evidence
- Keep functional/rubric correctness evidence separate from scientific model fidelity: record method assumptions, test cases and limitations; do not claim domain accuracy from passing UI tests

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

- Do not convert NOT RUN to PASS by documentation
- Do not accept proxy developer testing where qualified human review is required
- Do not expand explicitly deferred product scope without a new decision

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every applicable product-owned ledger row is PASS with direct evidence and an accountable reviewer, or has an already authorized N/A scope exclusion. External identity/institutional and PS-845 transfer rows retain their actual pending status and block PS-850, not a false product acceptance claim
- Given the documented preconditions, when the task behavior is exercised, then two materially different simulations are visually authored, published and run without Runtime source changes
- Given the documented preconditions, when the task behavior is exercised, then no S0-S2 defect or task-blocking usability/accessibility issue remains
- Given the documented preconditions, when the task behavior is exercised, then every supported persona, state, viewport, input and deployment profile has representative evidence
- Given the documented preconditions, when the task behavior is exercised, then the route and screenshot inventory contains no legacy branding or Teludens-conformance exception

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Product-complete ledger with external and operational gates truthfully pending
- Cross-simulation UI evidence
- UAT report
- Closed defect ledger
- Release-candidate recommendation

## Tests

Required test/evidence IDs: `PS-840-T01`, `PS-840-T02`, `PS-430-T01`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-GAP-AUDIT`, `CMD-GENERALIZATION`, `CMD-GOLDEN-JOURNEY`, `CMD-PRODUCT-E2E`, `CMD-VISUAL-QA`, `CMD-PLATFORM-A11Y`, `CMD-SECURITY`, `CMD-TELUDENS-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Deferred exclusions remain explicit and unavailable rather than half-built
- Synthetic data is clearly labeled
- UAT evidence does not expose personal or sensitive information
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the approved catalog Plenum primary wordmark with theme-safe presentation is used as platform branding; simulation content cannot replace platform identity

The approval gate is: PS-840 accepts product UAT only after all applicable product evidence and human review pass. It does not sign off identity-provider delivery, institution operations or authority transfer. PS-845 owns transfer; PS-850 requires the entire unscoped ledger to pass. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed
- Update APPROVAL_IMPLEMENTATION_PROMPTBOOK.md only for execution/evidence links; preserve the task source and approval boundaries
- Record source/image/lockfile/schema/configuration/Release and environment identity; a changed candidate requires impact assessment and affected gate reruns, not copied PASS labels
- Return a checkpoint handoff with completed behavior, exact evidence, unresolved dependencies, candidate identity and the next safe step; do not collapse partial/internal/automated/human/final acceptance into one PASS

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-840-close-cross-simulation-uat-and-all-gap-rows`
- Proposed subject: `test(product): close complete platform acceptance`
- Expected migrations: none
- Expected API/contract IDs: `product-completeness-ledger-v1`, `uat-evidence-v1`

Proposed body:

```text
Why:
- Prove that platform completeness generalizes beyond Fractured Order and that no specified feature, function, UI state or operational obligation is missing.
What:
- Real target users can build and run materially different simulations, and the release packet contains no unknown, fixture-only, inaccessible or untested product behavior.
Verification:
- Run the listed automated gates and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-840, REQ-001, REQ-002, REQ-003
```

Proposed PR description:

Summary: Real target users can build and run materially different simulations, and the release packet contains no unknown, fixture-only, inaccessible or untested product behavior. Risks: high workflow and authorization regressions. Migration: none. Evidence: automated checks, screenshots, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
