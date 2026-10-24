# PS-140 - Deliver authorized Runtime deltas and reconnect

## ID / title / goal / user outcome / risk

- ID: `PS-140`
- Title: Deliver authorized Runtime deltas and reconnect
- Goal: Add SSE projection deltas, cursor catch-up, polling fallback, and truthful reconnect states.
- User outcome: Connected clients recover from dropped connections without duplicate effects or hidden-data leakage.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-003`, `REQ-043`, `REQ-044`, `REQ-047`, `INV-002`, `INV-018`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-003`, `REQ-043`, `REQ-044`, `REQ-047`, `INV-002`, `INV-018`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform section 14
- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md` — Sync v1.1.1 sections 2, 5, 10
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-010

Observed source evidence:

- references/plenum-runtime-slice/migrations/002_runtime_sync_evidence.sql
- references/plenum-runtime-slice/src/server.mjs

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-010`.

## Prerequisites

Task prerequisites: `PS-110`, `PS-120`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Existing outbox rows
- Projection authorization rules
- Cursor and snapshot contracts

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Outbox publisher
- Authorized projection builder
- SSE with opaque cursor
- Catch-up and snapshot reset
- Client connectivity state model

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/sync/
- packages/sync-client/
- apps/server/test/sync/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Publish after commit
- Filter per current Session Access Context
- Deduplicate at-least-once updates
- Invalidate cursors after policy changes
- Fall back to polling delta endpoint

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Cursors are opaque and scoped
- Projection omission must not reveal hidden counts or gaps
- Revoked clients fail closed

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Store cursor only after local persistence
- Duplicate and reordered deltas converge
- Snapshot carries projection and policy versions

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not implement full Offline Outbox yet
- Do not expose raw Evidence Sequence gaps
- Do not use WebSocket for Runtime deltas

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then duplicate and reordered deltas converge
- Given the documented preconditions, when the task behavior is exercised, then old-role cursor reveals no newly unauthorized data
- Given the documented preconditions, when the task behavior is exercised, then gap or expired cursor obtains an authorized snapshot
- Given the documented preconditions, when the task behavior is exercised, then no local pending state is shown as accepted

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- SSE endpoint
- Polling fallback
- Projection cursor store
- Reconnect tests

## Tests

Required test/evidence IDs: `SYNC-08`, `SYNC-10`, `SYNC-11`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Command writes remain HTTPS POST
- Evidence order remains authoritative
- SSE endpoint has bounded replay

The approval gate is: ADR-010 is Product Owner Approved; named Technical Lead and Security Owner sign-offs remain. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update OpenAPI and COMMAND_REGISTRY.md
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-140-runtime-deltas-and-reconnect`
- Proposed subject: `feat(sync): stream authorized runtime deltas`
- Expected migrations: `008_projection_cursors`
- Expected API/contract IDs: `runtime-sse-v1`, `sync-deltas-v1`, `sync-snapshot-v1`

Proposed body:

```text
Why:
- Recover connected clients safely after network loss.
What:
- Add SSE, catch-up, snapshots, and cursor invalidation.
Verification:
- SYNC-08, SYNC-10, SYNC-11.
Compatibility / migrations:
- Adds 008 cursor tables.
Risks / follow-up:
- Offline queue remains PS-500.
Refs: PS-140, REQ-044, ADR-010
```

Proposed PR description:

Summary: adds authorized delta delivery. Risks: projection leaks and cursor gaps. Migration: 008. Evidence: reconnect suite. Rollback: disable stream and retain polling fallback.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: ADR-010 changes; Replay retention limits are approved; Measured SSE scaling requires change.
