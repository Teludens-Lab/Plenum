# PS-200 - Extract Fractured Order into a configuration Release

## ID / title / goal / user outcome / risk

- ID: `PS-200`
- Title: Extract Fractured Order into a configuration Release
- Goal: Move remaining first-proof behavior into a compiled Release consumed by generic Runtime engines.
- User outcome: Teams, roles, Stages, Forms, workflows, messages, Injects, interfaces, and reports change without source edits.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-024`, `REQ-025`, `REQ-026`, `REQ-027`, `REQ-028`, `REQ-029`, `REQ-030`, `REQ-031`, `REQ-033`, `REQ-034`, `INV-003`, `INV-004`, `INV-011`, `INV-019`, `INV-021`, `INV-022`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-024`, `REQ-025`, `REQ-026`, `REQ-027`, `REQ-028`, `REQ-029`, `REQ-030`, `REQ-031`, `REQ-033`, `REQ-034`, `INV-003`, `INV-004`, `INV-011`, `INV-019`, `INV-021`, `INV-022`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap Phase 2
- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema (entire current document)
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime (entire current document)
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-42
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-45

Observed source evidence:

- references/plenum-runtime-slice/definitions/fractured-order-reference.json
- references/plenum-runtime-slice/src/domain.mjs

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `DEC-30`, `DEC-31`, `DEC-33`, `DEC-34`, `DEC-35`, `DEC-37`, `DEC-38`, `DEC-40`.

## Prerequisites

Task prerequisites: `PS-000`, `PS-130`, `PS-150`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Pinned parity inventory
- Slice definition and transition resolver
- Canonical Schema types and validation

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Complete Fractured Order Release source
- Generic Stage, timer, Artifact, workflow, Inject, Message, state, recovery, and interface bindings needed by it
- Parity adapters only where incremental migration needs them

Expected paths are discovery targets, not permission to invent absent structure:

- definitions/fractured-order/
- packages/workflow-engine/
- apps/server/src/runtime/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Compile Release data into generic contracts
- Replace one hard-coded capability at a time
- Preserve historical identifiers
- Delete compatibility branches only after parity evidence

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Apply Information Policy at projections and commands
- Record Control Interventions
- Test forbidden Message routes

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Pin every instance to Governing Release
- Use server time for Stages and deadlines
- Each trigger fires exactly once

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not implement full Studio
- Do not encode reference role names in platform packages
- Do not claim full Fractured Order parity beyond the pinned matrix

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then renaming a Team or Session Role needs no source change
- Given the documented preconditions, when the task behavior is exercised, then adding a Stage or Form field needs no source change
- Given the documented preconditions, when the task behavior is exercised, then pinned parity rows pass or are explicitly out of scope
- Given the documented preconditions, when the task behavior is exercised, then no platform branch uses a reference label

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Compiled Fractured Order Release
- Generic Runtime engines used by it
- Parity evidence for extracted capabilities

## Tests

Required test/evidence IDs: `AC-04`, `AC-05`, `AC-06`, `AC-09`, `PS-200-T01`, `PS-200-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`, `CMD-PARITY`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- DEC-42 forbidden paths remain denied
- Historical slice records remain readable
- Compatibility adapters have removal conditions

The approval gate is: AC-09 exit requires passing parity evidence against the official pinned snapshot. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update parity matrix
- Update migration register
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-200-extract-fractured-order-release`
- Proposed subject: `feat(runtime): execute Fractured Order from release`
- Expected migrations: `009_runtime_capabilities`
- Expected API/contract IDs: `stage-command-v1`, `inject-command-v1`, `message-command-v1`

Proposed body:

```text
Why:
- Remove simulation-specific runtime assumptions.
What:
- Compile and execute the Fractured Order Release through generic engines.
Verification:
- Parity and no-source-edit tests.
Compatibility / migrations:
- Adds 009 runtime capability records.
Risks / follow-up:
- Parity failures block phase exit.
Refs: PS-200, REQ-024, AC-09
```

Proposed PR description:

Summary: extracts the reference simulation into configuration. Risks: parity drift. Migration: 009 and compatibility adapters. Evidence: parity matrix. Rollback: retain old capability path until parity gate passes.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Golden reference changes; A compatibility adapter reaches its removal gate; Canon classification changes.
