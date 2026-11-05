# PS-800 - Complete Teludens conformance and every UI state

## ID / title / goal / user outcome / risk

- ID: `PS-800`
- Title: Complete Teludens conformance and every UI state
- Goal: Replace proof-oriented long-scroll screens with a coherent professional workstation and verify every supported viewport, input and state.
- User outcome: Users can understand, navigate and complete complex work efficiently on desktop and constrained displays with keyboard, pointer, touch and assistive technology.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-009`, `REQ-063`, `REQ-064`, `REQ-071`, `INV-019`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-009`, `REQ-063`, `REQ-064`, `REQ-071`, `INV-019`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 2 and 3
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data section 17
- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 6.9
- `references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md` — Teludens Design Language sections 0 through 13
- `references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md` — Teludens Spatial Grammar sections 1 through 14
- `references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md` — Teludens Experience Physics sections 1 through 15
- `references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md` — Teludens Reference Slice sections 1 through 20

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

Task prerequisites: `PS-760`, `PS-790`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- The PS-700 Teludens foundation, catalog-source diff and component adoption report
- All uses of logos, product names, raw visual values and legacy simulation-specific styling
- Universal design standard and existing CSS tokens
- All screen families and screenshots
- Long-scroll Studio and operator views
- Browser bundle warnings and interaction performance

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Catalog conformance across Platform, Studio, Runtime, Fractured Order, Operator, Admin, reporting and replay surfaces
- Project-specific design brief, layout, components, interaction and motion contracts
- Shared shell, navigation, command bars, inspectors, dialogs and notifications
- Every loading/empty/error/offline/stale/conflict/disabled/success state
- Responsive, zoom, reduced-motion, forced-colors and performance QA

Expected paths are discovery targets, not permission to invent absent structure:

- apps/ui/ or established shared component location
- apps/*/src/styles.css
- docs/design/
- tests/visual/
- tests/e2e/product/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Replace remaining legacy or one-off UI with the PS-700 Teludens primitives without changing domain authority
- Audit the complete rendered route inventory for raw styling, card mosaics, noncanonical motion, ambiguous scroll ownership and noncatalog branding
- Create and apply the project-specific design artifacts required by the repository standard
- Refactor screens into task-focused view families with preserved context and bounded scrolling
- Split oversized bundles and components where measured behavior benefits
- Add automated geometry checks plus reviewed visual matrices

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

- Do not replace React or the approved architecture
- Do not trade accessibility for visual novelty
- Do not create inert controls or screenshot-only implementations

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every Platform, Studio, Runtime, Fractured Order, Operator, Admin, report and replay view passes the Teludens catalog conformance audit
- Given the documented preconditions, when the task behavior is exercised, then no legacy logo, simulation-branded shell, raw reusable styling value or unapproved component remains
- Given the documented preconditions, when the task behavior is exercised, then every view family passes the declared viewport, height, zoom and long-content matrix
- Given the documented preconditions, when the task behavior is exercised, then no essential workflow uses one unbounded page or internal identifier entry
- Given the documented preconditions, when the task behavior is exercised, then every interactive control has complete keyboard, focus, status and failure behavior
- Given the documented preconditions, when the task behavior is exercised, then performance budgets and bundle sizes are measured and accepted

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Unified component system
- Task-focused responsive layouts
- Complete state inventory
- Visual QA baseline and user test

## Tests

Required test/evidence IDs: `PS-800-T01`, `PS-800-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-BUILD`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-VISUAL-QA`, `CMD-GAP-AUDIT`, `CMD-TELUDENS-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Semantic tokens remain the only reusable styling source
- Reduced motion and forced colors retain meaning
- Responsive changes preserve authorization and domain behavior
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the approved catalog Plenum primary wordmark with theme-safe presentation is used as platform branding; simulation content cannot replace platform identity

The approval gate is: Change-level acceptance requires passing automated evidence and a completed user-test script; production approval remains separate.. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-800-unify-design-system-and-complete-ui-states`
- Proposed subject: `feat(ui): complete cohesive product experience`
- Expected migrations: none
- Expected API/contract IDs: `design-system-v1`, `visual-qa-matrix-v1`

Proposed body:

```text
Why:
- Replace proof-oriented long-scroll screens with a coherent professional workstation and verify every supported viewport, input and state.
What:
- Users can understand, navigate and complete complex work efficiently on desktop and constrained displays with keyboard, pointer, touch and assistive technology.
Verification:
- Run the listed automated gates and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-800, REQ-009, REQ-063, REQ-064
```

Proposed PR description:

Summary: Users can understand, navigate and complete complex work efficiently on desktop and constrained displays with keyboard, pointer, touch and assistive technology. Risks: high workflow and authorization regressions. Migration: none. Evidence: automated checks, screenshots, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
