# PS-540 - Measure load, reconnect, voting, Plugin, and voice profiles

## ID / title / goal / user outcome / risk

- ID: `PS-540`
- Title: Measure load, reconnect, voting, Plugin, and voice profiles
- Goal: Measure the DEC-16 planning workload on named hardware against owner-approved budgets.
- User outcome: Release owners know observed limits and failure behavior instead of relying on capacity claims.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-002`, `REQ-032`, `REQ-067`, `REQ-068`, `INV-017`, `INV-019`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-002`, `REQ-032`, `REQ-067`, `REQ-068`, `INV-017`, `INV-019`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap Slice S7
- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform section 25
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-019
- `docs/corpus/02_Updated_Architecture/11_LIVE_POLLING_AND_VOTING_v1.1.md` — VOTE-14
- `docs/corpus/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md` — VOICE-12
- `docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md` — EXT-19
- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md` — SYNC-15

Observed source evidence:

- docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-350`, `PS-500`, `PS-530`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Approved latency and reliability targets
- Named hardware and network
- Telemetry and health views

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- API/session mix
- Reconnect and submission bursts
- Ballot burst
- Plugin execution
- Separate media profile
- Saturation and recovery observations

Expected paths are discovery targets, not permission to invent absent structure:

- tests/load/
- docs/performance/
- deploy/load-fixtures/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Name hardware, versions, actor mix, and rates
- Measure p50/p95/p99 and integrity
- Inject dependency and restart failures
- Record saturation and cost

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Use synthetic data
- Keep load environment isolated
- Do not expose telemetry secrets

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Preserve one authority under stress
- Verify no double count or double effect
- Pin load scripts and seeds

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not infer voice capacity from participant count
- Do not add cache, broker, or service split before evidence
- Do not publish an SLO without owner approval

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then all claims cite named hardware and conditions
- Given the documented preconditions, when the task behavior is exercised, then integrity holds during bursts
- Given the documented preconditions, when the task behavior is exercised, then failure recovery is observed
- Given the documented preconditions, when the task behavior is exercised, then any new scale component has measured justification

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Load harness
- Measured profile reports
- Bottleneck analysis
- Scaling decision record if justified

## Tests

Required test/evidence IDs: `SYNC-15`, `VOTE-14`, `VOICE-12`, `EXT-19`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-LOAD-APP`, `CMD-LOAD-VOTING`, `CMD-LOAD-VOICE`, `CMD-LOAD-EXTENSIONS`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Functional suites pass before and after load
- No production environment is targeted
- Approved capacity targets remain a release gate and failed measurements block acceptance

The approval gate is: OPEN-019 targets are approved; capacity acceptance remains blocked by failed command/Floor latency and incomplete acceptance runs. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update performance report and technology matrix
- Update RELEASE_READINESS.md and PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-540-load-reliability-and-capacity-evidence`
- Proposed subject: `perf(platform): measure reference workloads`
- Expected migrations: none
- Expected API/contract IDs: `load-profile-v1`

Proposed body:

```text
Why:
- Replace planning assumptions with measured evidence.
What:
- Add application, voting, Plugin, reconnect, and voice load profiles.
Verification:
- Run named load commands on recorded hardware.
Compatibility / migrations:
- None.
Risks / follow-up:
- Approved command and Floor targets currently fail; optimize and rerun.
Refs: PS-540, REQ-002, DEC-16
```

Proposed PR description:

Summary: measures reference workloads. Risks: misleading benchmarks. Migration: none. Evidence: raw results and environment manifest. Rollback: test-only artifacts.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Command or Floor paths are optimized; Hardware or topology changes; Measured saturation crosses budget; Authorized owners amend a target.
