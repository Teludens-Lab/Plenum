# PS-730 - Complete foundational Studio workspaces

## ID / title / goal / user outcome / risk

- ID: `PS-730`
- Title: Complete foundational Studio workspaces
- Goal: Close all visual-authoring gaps for Overview, Methodology, Teams, Roles, Seats, Stages, and Activities.
- User outcome: A non-programming Designer can model simulation identity, participants, structure, time, objectives, relationships, resources, and activities through guided controls.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-001`, `REQ-009`, `REQ-010`, `REQ-012`, `REQ-013`, `REQ-018`, `INV-009`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-001`, `REQ-009`, `REQ-010`, `REQ-012`, `REQ-013`, `REQ-018`, `INV-009`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 4 through 9
- `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` — 08 Canon sections 2 through 7
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register OPEN-004
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
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Dark.png
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Light.png

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `OPEN-004`.

## Prerequisites

Task prerequisites: `PS-720`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Current long-scroll Core Design editor
- Canonical Core Design schema
- Validation error source links
- Fractured Order Team, Seat, Stage and objective configuration

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Overview and terminology
- Methodology dependency controls
- Team identity, briefing, objectives, resources and relationships
- Session Roles, capabilities and Seats
- Stage groups, stages, timers, activities, transitions and operator controls

Expected paths are discovery targets, not permission to invent absent structure:

- apps/studio/src/core-design/
- packages/simulation-schema/
- packages/validation-engine/
- tests/e2e/product/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Replace incomplete field sets with guided workspace flows and previews
- Support relationships, objectives, resources, activity requirements and nested bounded Stage structures
- Provide safe add, reorder, duplicate, delete, undo and validation navigation
- Add role-specific and narrow-screen user tests

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

- Do not add arbitrary pixel positioning
- Do not infer unresolved mandatory methodology concepts
- Do not expose raw JSON as the primary editor

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every setting in Studio sections 5-9 is visually authorable without JSON
- Given the documented preconditions, when the task behavior is exercised, then a Designer creates flat, nested, conditional and bounded-parallel Stage designs with plain-language validation
- Given the documented preconditions, when the task behavior is exercised, then role preview matches the server Runtime projection
- Given the documented preconditions, when the task behavior is exercised, then two Designers converge while validation links to the exact control needing correction

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Complete foundational Studio workspaces
- Role and Stage previews
- Authoring user-test script
- Updated completeness rows

## Tests

Required test/evidence IDs: `PS-730-T01`, `PS-730-T02`, `AC-01`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-GAP-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- No named Fractured Order Team or Role enters platform code
- Stage and timer authority remains server-side
- Unsupported loops and unbounded structures remain blocked
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the catalog Plenum dark/light wordmarks are used as platform branding; simulation content cannot replace platform identity

The approval gate is: Change-level acceptance requires passing automated evidence and a completed user-test script; production approval remains separate.. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-730-complete-foundational-studio-workspaces`
- Proposed subject: `feat(studio): complete core structure workspaces`
- Expected migrations: none
- Expected API/contract IDs: `studio-foundation-editor-v1`

Proposed body:

```text
Why:
- Close all visual-authoring gaps for Overview, Methodology, Teams, Roles, Seats, Stages, and Activities.
What:
- A non-programming Designer can model simulation identity, participants, structure, time, objectives, relationships, resources, and activities through guided controls.
Verification:
- Run the listed automated gates and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-730, REQ-001, REQ-009, REQ-010
```

Proposed PR description:

Summary: A non-programming Designer can model simulation identity, participants, structure, time, objectives, relationships, resources, and activities through guided controls. Risks: high workflow and authorization regressions. Migration: none. Evidence: automated checks, screenshots, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
