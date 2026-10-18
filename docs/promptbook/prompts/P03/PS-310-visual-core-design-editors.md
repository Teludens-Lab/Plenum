# PS-310 - Build the visual Core Design editor slice

## ID / title / goal / user outcome / risk

- ID: `PS-310`
- Title: Build the visual Core Design editor slice
- Goal: Let a non-programming Designer create the first-proof Core Design and Scenario using visual controls only.
- User outcome: A Designer configures Teams, roles, Seats, Stages, Forms, workflow, Information Policy, interfaces, and a Scenario without raw JSON.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-009`, `REQ-010`, `REQ-011`, `REQ-012`, `REQ-013`, `REQ-014`, `REQ-015`, `REQ-016`, `REQ-017`, `REQ-018`, `REQ-019`, `REQ-020`, `REQ-063`, `REQ-064`, `INV-007`, `INV-009`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-009`, `REQ-010`, `REQ-011`, `REQ-012`, `REQ-013`, `REQ-014`, `REQ-015`, `REQ-016`, `REQ-017`, `REQ-018`, `REQ-019`, `REQ-020`, `REQ-063`, `REQ-064`, `INV-007`, `INV-009`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 3-24
- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema (entire current document)
- `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` — 08 Canon sections 2-6
- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 6.1

Observed source evidence:

- docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `DEC-31`, `DEC-32`, `DEC-33`, `OPEN-004`, `OPEN-005`, `OPEN-006`, `OPEN-010`, `OPEN-018`, `OPEN-022`.

## Prerequisites

Task prerequisites: `PS-210`, `PS-300`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Canonical Schema for supported first-release fields
- Validation catalog
- Existing design-system and form-renderer components

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Methodology, Teams, roles, Seats, sequential/nested Stages
- Basic Form and Artifact Type builder
- Workflow template and guarded editor
- Information Policy matrix
- Interface module selection
- Research traceability
- Template copy semantics

Expected paths are discovery targets, not permission to invent absent structure:

- apps/studio/src/core-design/
- packages/form-renderer/
- packages/validation-engine/
- packages/design-system/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Use progressive disclosure and plain-language rule builders
- Reuse Runtime projection logic for preview
- Make every validation item navigable
- Preserve disabled content
- Copy Scenario only on explicit choice

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Preview uses server-filtered projections
- Information Policy defaults to deny
- Roster ambiguity enters review instead of silent acceptance

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Edits operate through the collaborative Draft
- Stable IDs survive reordering
- Template copy gets new Project identities

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not add arbitrary pixel placement
- Do not expose raw JSON
- Do not implement unresolved advanced workflow constructs

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then a non-programmer completes AC-01 without raw JSON
- Given the documented preconditions, when the task behavior is exercised, then all REQ-011 defect fixtures block Publication with targeted messages
- Given the documented preconditions, when the task behavior is exercised, then role preview matches Runtime projection
- Given the documented preconditions, when the task behavior is exercised, then template omits Scenario by default

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Visual first-proof editors
- Role/Stage preview
- Validation catalog UI
- Accessible editor evidence

## Tests

Required test/evidence IDs: `AC-01`, `AC-02`, `PS-310-T01`, `PS-310-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Keyboard, focus, contrast, errors, zoom, and constrained layouts are inspected
- No duplicate schema model appears in UI code
- Unsupported constructs are unavailable, not silently approximated

The approval gate is: Advanced Stage, workflow, and Form capabilities remain bounded by OPEN-005/006/010. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update editor coverage table
- Raise OPEN candidates for contradictions
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-310-visual-core-design-editors`
- Proposed subject: `feat(studio): add visual core design editors`
- Expected migrations: none
- Expected API/contract IDs: `core-design-editor-v1`, `role-preview-v1`

Proposed body:

```text
Why:
- Enable non-programming simulation design.
What:
- Add the first-proof visual editors and validation.
Verification:
- AC-01, AC-02, validation fixtures, accessibility.
Compatibility / migrations:
- None.
Risks / follow-up:
- Advanced constructs remain gated.
Refs: PS-310, REQ-009, DEC-07
```

Proposed PR description:

Summary: delivers the visual Core Design slice. Risks: editor/schema drift. Migration: none. Evidence: authoring E2E and accessibility. Rollback: preserve Draft data and hide incomplete editor routes.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-004/005/006/010 resolve; Schema adds required fields; User testing finds an inaccessible interaction.
