# PS-300 - Collaboratively edit, validate, freeze, and publish

## ID / title / goal / user outcome / risk

- ID: `PS-300`
- Title: Collaboratively edit, validate, freeze, and publish
- Goal: Deliver two-Designer Draft convergence and publication from an exact validated materialization.
- User outcome: Designers can reconnect after concurrent edits and publish one immutable Release without losing later work.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-001`, `REQ-011`, `REQ-021`, `REQ-022`, `REQ-043`, `INV-009`, `INV-012`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-001`, `REQ-011`, `REQ-021`, `REQ-022`, `REQ-043`, `INV-009`, `INV-012`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 4, 22, 23
- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md` — Sync sections 9 and 12
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-002
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-010

Observed source evidence:

- references/plenum-runtime-slice/migrations/003_collaboration.sql

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-002`, `ADR-010`, `OPEN-013`, `OPEN-014`.

## Prerequisites

Task prerequisites: `PS-100`, `PS-110`, `PS-130`, `PS-140`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Schema-only collaborative tables
- Candidate CRDT versions in lockfile
- Publication freeze transaction

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Authenticated CRDT WebSocket
- Persistent updates and snapshots
- Four Studio save states
- Continuous validation
- Fenced freeze and publish

Expected paths are discovery targets, not permission to invent absent structure:

- apps/studio/src/collaboration/
- apps/server/src/studio/collaboration/
- packages/validation-engine/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Persist immutable updates with attribution
- Bound update size and rate
- Materialize deterministically
- Freeze one state vector and route later updates to the next Draft
- Block publish on validation errors

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Check edit rights for every update
- Stop sync after revocation
- Protect local Draft cache according to policy

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Partitioned Designers converge to identical bytes
- Repeated update IDs deduplicate
- Published bytes and digest remain immutable

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not treat convergence as validity
- Do not make presence authoritative
- Do not build comments or suggestions yet

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then partition and reconnect converges to identical bytes
- Given the documented preconditions, when the task behavior is exercised, then invalid merged Draft cannot publish
- Given the documented preconditions, when the task behavior is exercised, then freeze yields one immutable revision
- Given the documented preconditions, when the task behavior is exercised, then later edits do not alter the Release

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Collaboration service and client
- Validation loop
- Freeze/publish integration
- SYNC-01 and SYNC-02 evidence

## Tests

Required test/evidence IDs: `SYNC-01`, `SYNC-02`, `AC-01`, `AC-02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Publisher authorization remains server-side
- Validation messages link to source elements
- No raw JSON is required from end users

The approval gate is: ADR-002 is Product Owner Approved; named Technical Lead sign-off remains and publication controls depend on OPEN-013. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update collaboration contract and migration register
- Record CRDT version decision
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-300-collaborative-studio-freeze-and-publish`
- Proposed subject: `feat(studio): freeze collaborative drafts safely`
- Expected migrations: `015_collaboration_runtime`
- Expected API/contract IDs: `studio-crdt-v1`, `studio-publish-v1`

Proposed body:

```text
Why:
- Make concurrent authoring publishable and reproducible.
What:
- Add CRDT sync, validation, and fenced freeze.
Verification:
- SYNC-01, SYNC-02, AC-01, AC-02.
Compatibility / migrations:
- Adds 015 collaboration runtime.
Risks / follow-up:
- Approval policy remains OPEN-013.
Refs: PS-300, REQ-001, ADR-002
```

Proposed PR description:

Summary: delivers collaborative Draft publication. Risks: convergence and freeze races. Migration: 015. Evidence: partition tests. Rollback: stop collaboration sessions; preserve update log.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: ADR-002 changes; CRDT compatibility breaks; OPEN-013 resolves.
