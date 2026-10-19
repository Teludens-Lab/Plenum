# PS-120 - Extract the transactional Command and evidence kernel

## ID / title / goal / user outcome / risk

- ID: `PS-120`
- Title: Extract the transactional Command and evidence kernel
- Goal: Promote proven command, receipt, authority, evidence, and outbox behavior into reusable platform modules.
- User outcome: Retries, rejections, stale writes, and authority loss are truthful and never double-commit.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-004`, `REQ-035`, `REQ-053`, `INV-011`, `INV-014`, `INV-015`, `INV-017`, `INV-018`, `INV-021`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-004`, `REQ-035`, `REQ-053`, `INV-011`, `INV-014`, `INV-015`, `INV-017`, `INV-018`, `INV-021`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform section 12
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime section 3
- `docs/corpus/02_Updated_Architecture/09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md` — 09 Contracts sections 3-5
- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/POSTGRESQL_LOGICAL_DATA_MODEL_v1.1.md` — Data Model sections 3-7

Observed source evidence:

- references/plenum-runtime-slice/src/server.mjs
- references/plenum-runtime-slice/migrations/002_runtime_sync_evidence.sql

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `ADR-014`, `OPEN-016`, `OPEN-017`. ADR-001, ADR-003 and ADR-015 are confirmed.

## Prerequisites

Task prerequisites: `PS-100`, `PS-110`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Slice lock ordering, receipt lookup, emit and record functions
- Canonical command and error contracts
- Database constraints and immutability triggers

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- One command processor
- Session Authority epoch checks
- Atomic state, receipt, Evidence Event, and outbox transaction
- Recorded rejection and reconciliation outcomes

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/runtime/commands/
- packages/event-contracts/
- apps/server/test/runtime/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Reuse canonical serialization and stable Command IDs
- Lock authority then aggregate in a fixed order
- Write exactly one Evidence Event per recorded outcome
- Publish only after commit

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Resolve actor and Active Role Context server-side
- Do not record malformed or pre-Session requests as receipts
- Restrict receipt reads

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Same ID and digest returns the original receipt
- Different digest returns IDEMPOTENCY_COLLISION
- Stale epoch and wrong Deployment make no receipt
- Expected versions yield reconciliation

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not implement authority transfer
- Do not add a broker
- Do not full-event-source current state

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then six concurrent retries commit once
- Given the documented preconditions, when the task behavior is exercised, then every recorded rejection has one receipt and one Evidence Event
- Given the documented preconditions, when the task behavior is exercised, then foreign or stale authority cannot write
- Given the documented preconditions, when the task behavior is exercised, then rollback leaves no Evidence Sequence gap

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Command processor
- Evidence sequence allocator
- Transactional outbox
- Concurrency regression suite

## Tests

Required test/evidence IDs: `AC-10`, `AC-12`, `AC-13`, `SYNC-05`, `SYNC-06`, `SYNC-07`, `SYNC-12`, `DB-02`, `DB-04`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-DB`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Keep DEC-37 statuses exact
- Use past-tense events
- No external call occurs inside the transaction

The approval gate is: ADR-001/003 remain unratified; milestone exit is blocked pending confirmation. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update OpenAPI and event catalog only by reference to 09
- Update DATA_MIGRATION_REGISTER.md
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-120-transactional-command-evidence-kernel`
- Proposed subject: `feat(runtime): extract transactional command kernel`
- Expected migrations: `006_command_kernel`
- Expected API/contract IDs: `command-envelope-v1`, `command-receipt-v1`, `domain-event-v1`

Proposed body:

```text
Why:
- Reuse the spike's proven authority and idempotency behavior.
What:
- Add the platform command processor, evidence sequence, and outbox.
Verification:
- Concurrency, rejection, fencing, and rollback tests.
Compatibility / migrations:
- Adds 006 command kernel tables or constraints.
Risks / follow-up:
- Authority transfer stays OPEN-016.
Refs: PS-120, REQ-035, DEC-43
```

Proposed PR description:

Summary: centralizes authoritative mutations. Risks: transaction ordering. Migration: 006. Evidence: DB concurrency tests. Rollback: forward-fix only after data migration; retain slice path until parity.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: ADR-001 or ADR-003 changes; Authority transfer is approved; Measured contention requires narrower locking.
