# PS-400 - Add bounded advanced logic and world state

## ID / title / goal / user outcome / risk

- ID: `PS-400`
- Title: Add bounded advanced logic and world state
- Goal: Run approved nested or branching Stages, typed Gates, State Values, Capabilities, Resources, and automation without code.
- User outcome: Designers model a crisis-response simulation with conditional behavior and traceable state effects.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-013`, `REQ-015`, `REQ-020`, `REQ-026`, `REQ-030`, `REQ-031`, `INV-011`, `INV-014`, `INV-019`, `INV-022`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-013`, `REQ-015`, `REQ-020`, `REQ-026`, `REQ-030`, `REQ-031`, `INV-011`, `INV-014`, `INV-019`, `INV-022`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema sections 8, 11, 13
- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 9, 14, 15, 22
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime sections 5, 6, 10, 11

Observed source evidence:

- docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `OPEN-005`, `OPEN-006`, `OPEN-018`, `OPEN-022`.

## Prerequisites

Task prerequisites: `PS-310`, `PS-350`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Approved Stage and workflow subset
- Gate fact namespace
- Existing simple engines and migration seams

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Approved nested/branching Stages
- Bounded typed Gate evaluator
- Conditional fields and Injects
- State, capability, and resource transactions
- Synthetic rehearsal explanation

Expected paths are discovery targets, not permission to invent absent structure:

- packages/workflow-engine/
- packages/validation-engine/
- apps/server/src/runtime/state/
- apps/studio/src/advanced-logic/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Compile Gates to a bounded evaluator
- Use server-authoritative time
- Record before/after/source for state changes
- Explain each trigger result

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Policy-filter facts before evaluation
- Require authorized operator reasons for overrides
- Do not expose hidden State Values

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Triggers claim once
- Effects are transactional with cause
- Rehearsal uses fixed clock and seed

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not invent loops or continuous timing
- Do not execute authored expressions as code
- Do not silently interpret unresolved Stage structures

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then approved Stage structures validate and run
- Given the documented preconditions, when the task behavior is exercised, then unknown facts fail validation
- Given the documented preconditions, when the task behavior is exercised, then each effect has source and before/after values
- Given the documented preconditions, when the task behavior is exercised, then repeated rehearsal produces the same trace

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Advanced validators and editors
- Runtime engines
- Crisis-response fixture
- Deterministic rehearsal evidence

## Tests

Required test/evidence IDs: `PS-400-T01`, `PS-400-T02`, `PS-400-T03`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Simple sequential designs remain valid
- No code injection path
- No new simulation-specific branches

The approval gate is: Only behavior explicitly approved under OPEN-005/006 may ship. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update supported-expression matrix
- Record unresolved constructs
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-400-advanced-stage-state-and-automation`
- Proposed subject: `feat(runtime): add bounded world-state automation`
- Expected migrations: `018_world_state_automation`
- Expected API/contract IDs: `gate-expression-v1`, `state-transaction-v1`

Proposed body:

```text
Why:
- Support advanced simulations without custom code.
What:
- Add approved Stage logic, Gates, and state transactions.
Verification:
- Deterministic engine and rehearsal tests.
Compatibility / migrations:
- Adds 018 world state.
Risks / follow-up:
- Unresolved constructs stay unavailable.
Refs: PS-400, REQ-031, OPEN-005
```

Proposed PR description:

Summary: adds bounded advanced logic. Risks: nondeterminism and expression safety. Migration: 018. Evidence: deterministic fixtures. Rollback: disable unsupported definitions and preserve data.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-005/006/018 resolve; Expression evaluator changes; Measured performance becomes insufficient.
