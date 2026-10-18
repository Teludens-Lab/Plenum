# PS-500 - Deliver durable Offline Outbox and reconciliation

## ID / title / goal / user outcome / risk

- ID: `PS-500`
- Title: Deliver durable Offline Outbox and reconciliation
- Goal: Let disconnected Participants keep permitted work and reconcile safely without becoming an authority.
- User outcome: A Participant can draft offline, see truthful local status, and receive a clear accepted, rejected, or reconciliation result after reconnect.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-003`, `REQ-008`, `REQ-043`, `REQ-044`, `REQ-078`, `REQ-084`, `INV-018`, `INV-024`, `INV-026`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-003`, `REQ-008`, `REQ-043`, `REQ-044`, `REQ-078`, `REQ-084`, `INV-018`, `INV-024`, `INV-026`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md` — Sync v1.1.1 sections 4-7 and 12
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data section 18
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime section 18

Observed source evidence:

- docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `ADR-001`, `ADR-010`, `OPEN-014`, `OPEN-015`.

## Prerequisites

Task prerequisites: `PS-140`, `PS-240`, `PS-250`, `PS-420`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Sync client and cursor store
- Device-security options
- Fixed offline feature rules

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Encrypted local Draft and outbox storage
- Queueable-command policy
- Ordered reconnect
- Explicit reconciliation UI
- Ballot-after-close and non-replay voice/approval cases

Expected paths are discovery targets, not permission to invent absent structure:

- packages/sync-client/
- apps/runtime-web/src/offline/
- tests/sync/offline/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Persist before showing saved-on-device
- Submit unchanged IDs and versions
- Lookup receipts before retry
- Keep rejected drafts editable
- Discard stale floor requests

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Minimize cached fields
- Expire and clear controllable data after revocation
- Test stolen-device and other-role bundle leakage

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Dependency-order Commands
- Duplicate delivery commits once
- Activation incompatibility yields reconciliation
- Ballot uses receipt time

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not queue adjudication, Stage, Session, voice, Floor, composition, or approval operations
- Do not promise remote wipe
- Do not accept device time as authority

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then local pending is never presented as submitted
- Given the documented preconditions, when the task behavior is exercised, then revoked role cannot submit queued Command
- Given the documented preconditions, when the task behavior is exercised, then late Ballot is rejected
- Given the documented preconditions, when the task behavior is exercised, then floor and Approval requests are absent from outbox and not replayed
- Given the documented preconditions, when the task behavior is exercised, then duplicate reconnect commits once

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Offline Outbox
- Local protection
- Reconnect UI
- SYNC-04 through SYNC-17 coverage as applicable

## Tests

Required test/evidence IDs: `AC-11`, `SYNC-04`, `SYNC-05`, `SYNC-08`, `SYNC-09`, `SYNC-10`, `SYNC-11`, `SYNC-14`, `SYNC-16`, `SYNC-17`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-E2E`, `CMD-OFFLINE`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- LAN-online behavior remains normal, not offline
- Hidden data is absent from bundles
- No automatic authority failover

The approval gate is: Production device posture and credential lifetime blocked by OPEN-014/015. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update offline threat model and command allowlist
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-500-durable-offline-participants`
- Proposed subject: `feat(sync): reconcile durable offline commands`
- Expected migrations: `021_offline_devices`
- Expected API/contract IDs: `offline-outbox-v1`, `sync-bootstrap-v1`

Proposed body:

```text
Why:
- Support disconnected work without false authority.
What:
- Add protected outbox, reconnect, and reconciliation states.
Verification:
- AC-11 and SYNC offline tests.
Compatibility / migrations:
- Adds 021 offline device state.
Risks / follow-up:
- Device policy remains OPEN-014/015.
Refs: PS-500, REQ-043, INV-026
```

Proposed PR description:

Summary: delivers controlled offline participation. Risks: cached-data loss and stale commands. Migration: 021. Evidence: partition/reconnect tests. Rollback: disable queueing and preserve drafts for export.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-014/015 resolves; Browser storage is replaced; New command type requests offline support.
