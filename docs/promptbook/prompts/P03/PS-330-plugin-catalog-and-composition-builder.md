# PS-330 - Build the Plugin catalog and Model Composition editor

## ID / title / goal / user outcome / risk

- ID: `PS-330`
- Title: Build the Plugin catalog and Model Composition editor
- Goal: Let Designers bind approved Plugins and build typed sequential and parallel compositions without code.
- User outcome: A Designer connects two approved models, tests them on fixtures, and sees the mandatory approval path before Publication.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-087`, `REQ-089`, `REQ-090`, `INV-020`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-087`, `REQ-089`, `REQ-090`, `INV-020`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio section 27
- `docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md` — 10 Extension sections 9 and 17
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-53
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-55

Observed source evidence:

- docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-018`, `OPEN-022`, `OPEN-029`.

## Prerequisites

Task prerequisites: `PS-220`, `PS-230`, `PS-310`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Plugin catalog API
- Composition schema and validator
- Existing graph/editor candidate actually pinned

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Installed Plugin catalog
- Binding inspector
- Typed graph editor
- Sequential and parallel run preview
- Offline replacement selection

Expected paths are discovery targets, not permission to invent absent structure:

- apps/studio/src/plugins/
- apps/studio/src/compositions/
- packages/release-compiler/src/compositions/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Show types, units, classifications, versions, and connectivity
- Prevent invalid edges while editing
- Require an approval gate on every effect path
- Run fixture tests without state change

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Catalog is Organization-scoped
- Input mappings show classification ceilings
- Secret references never appear in Drafts

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Stable node and edge IDs
- Compile graph digest and dependency closure
- In-flight runs stay pinned

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not add script nodes
- Do not add feedback cycles
- Do not let Designers author Plugin code

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then designer builds a two-model composition without code
- Given the documented preconditions, when the task behavior is exercised, then cycle, unit mismatch, classification leak, and missing approval gate are actionable errors
- Given the documented preconditions, when the task behavior is exercised, then fixture run changes no state
- Given the documented preconditions, when the task behavior is exercised, then air-gap incompatible binding is blocked

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Catalog and binding UI
- Composition builder
- Compiler validation
- Sequential and parallel tests

## Tests

Required test/evidence IDs: `EXT-12`, `EXT-13`, `EXT-14`, `EXT-15`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- No public marketplace path
- No arbitrary cycles
- DEC-54 carve-out remains intact

The approval gate is: Production catalog sharing and trust remain OPEN-029. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update composition contract fixtures
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-330-plugin-catalog-and-composition-builder`
- Proposed subject: `feat(studio): compose approved plugins visually`
- Expected migrations: none
- Expected API/contract IDs: `composition-definition-v1`, `plugin-binding-v1`

Proposed body:

```text
Why:
- Complete no-code Extension Framework authoring.
What:
- Add catalog, bindings, and typed composition builder.
Verification:
- EXT-12 to EXT-15.
Compatibility / migrations:
- None.
Risks / follow-up:
- Trust operations remain gated.
Refs: PS-330, REQ-087, DEC-55
```

Proposed PR description:

Summary: delivers visual Plugin composition. Risks: invalid graph semantics. Migration: none. Evidence: compiler and E2E tests. Rollback: preserve graph JSON and disable editor route.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: DEC-55 changes; OPEN-022 resolves; New Plugin contract version is introduced.
