# PS-545 - Optimize command and Floor performance, then rerun capacity gates

## ID / title / goal / user outcome / risk

- ID: `PS-545`
- Title: Optimize command and Floor performance, then rerun capacity gates
- Goal: Remove the measured command and radio-Floor bottlenecks and pass the approved capacity profile without weakening authority or integrity.
- User outcome: Participants receive timely command receipts and Floor decisions under the approved workload, with repeatable evidence rather than a waiver.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: true`.

## Requirements and invariants

Product IDs: `REQ-002`, `REQ-032`, `REQ-067`, `REQ-068`, `INV-017`, `INV-019`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-002`, `REQ-032`, `REQ-067`, `REQ-068`, `INV-017`, `INV-019`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-16
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-005
- resolved OPEN-019 — unresolved source alias; stop and resolve through SOURCE_REGISTER.md before editing
- DB-10 — unresolved source alias; stop and resolve through SOURCE_REGISTER.md before editing
- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md` — SYNC-15
- `docs/corpus/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md` — VOICE-12
- PS-540 evidence — unresolved source alias; stop and resolve through SOURCE_REGISTER.md before editing

Observed source evidence:

- docs/performance/PS-540-reference-load.md
- docs/open-019-acceptance-recommendation.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-540`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- PS-540 raw latency and saturation distributions
- Command transaction and lock ownership
- Floor queue-position and per-channel locking queries
- Connection-pool and PostgreSQL wait observations

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Accepted-command transaction and lock path
- Radio Floor request and queue-position path
- Bounded connection and concurrency tuning
- Approved three-run application, voting, Extension and institutional voice acceptance profiles

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/runtime/
- apps/server/src/comms/voice.ts
- apps/server/migrations/
- tests/load/
- deploy/load-fixtures/
- docs/performance/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Profile database locks, waits and query plans for the failing paths
- Apply the smallest root-cause optimization in the existing modular monolith
- Add regression tests for preserved ordering, idempotency, authorization and Floor priority
- Run the approved warm-up, steady-state, burst, recovery and institutional media profiles three consecutive times

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Use synthetic identities and isolated approved load environments
- Preserve tenant and Session scoping in every optimized query
- Keep telemetry free of secrets, voice content and protected payloads

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Preserve one Session Authority and canonical command ordering
- Prove no lost, duplicate or reordered accepted effects under optimized concurrency
- Preserve Floor priority, preemption and one-active-lease invariants
- Pin the same Release, seed, schema and adapter versions for before/after comparison

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not change or waive approved targets to obtain a pass
- Do not weaken one-authority, ordering, authorization, Evidence, receipt or outbox guarantees
- Do not add a cache, broker, database split or service split unless measured evidence proves the simpler fixes insufficient
- Do not target production

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then accepted-command p95 and burst p99 meet the approved targets in all three clean runs
- Given the documented preconditions, when the task behavior is exercised, then floor-grant p95 meets the approved target and institutional media join, speech-start and packet-loss measures pass
- Given the documented preconditions, when the task behavior is exercised, then all other PS-540 measures remain within their approved targets
- Given the documented preconditions, when the task behavior is exercised, then integrity, authorization, ordering, failure recovery and saturation gates pass with zero waived defects
- Given the documented preconditions, when the task behavior is exercised, then the before/after report identifies the measured cause and why no additional scale component is required or justified

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Root-cause profile and query/lock evidence
- Minimal optimized implementation with regression coverage
- Before/after comparison
- Three clean approved capacity reports including institutional voice evidence

## Tests

Required test/evidence IDs: `DB-10`, `SYNC-15`, `VOTE-14`, `VOICE-12`, `EXT-19`, `PS-545-T01`, `PS-545-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-LOAD-APP`, `CMD-LOAD-VOTING`, `CMD-LOAD-VOICE`, `CMD-LOAD-EXTENSIONS`, `CMD-PROMPTBOOK-VALIDATE`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Functional suites pass before and after optimization
- Every load profile passes three consecutive production-shaped runs
- A failed approved target keeps PS-545 and PS-550 blocked
- No production environment or personal data is used

The approval gate is: All approved OPEN-019 thresholds and integrity gates must pass three consecutive production-shaped runs; no owner waiver is inferred. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update the PS-540 performance report with superseding PS-545 evidence
- Update TECHNOLOGY_DECISION_MATRIX.md, RELEASE_READINESS.md and PROJECT_STATE.md
- Keep resolved OPEN-019 separate from capacity-pass status

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-545-optimize-command-floor-and-retest-capacity`
- Proposed subject: `perf(runtime): meet approved command and Floor targets`
- Expected migrations: none
- Expected API/contract IDs: `load-profile-v1`

Proposed body:

```text
Why:
- PS-540 found command and Floor latency far above approved targets.
What:
- Remove measured lock/query bottlenecks without weakening authority or integrity.
Verification:
- Functional regressions and three clean approved load-profile runs.
Compatibility / migrations:
- Preserve existing contracts; document any additive index migration.
Risks / follow-up:
- Capacity remains blocked until every approved target passes.
Refs: PS-545, REQ-002, DEC-16
```

Proposed PR description:

Summary: optimizes the measured command and Floor bottlenecks and reruns the approved capacity gate. Risks: concurrency or ordering regressions. Migration: none unless a measured additive index is required. Evidence: before/after profiles and three clean runs. Rollback: redeploy prior code and retain failed results.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Any approved threshold changes; Hardware or topology changes; A load regression crosses a target; Query plans or lock waits materially change.
