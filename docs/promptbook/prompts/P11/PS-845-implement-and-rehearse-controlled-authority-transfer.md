# PS-845 - Implement and rehearse controlled Session authority transfer

## ID / title / goal / user outcome / risk

- ID: `PS-845`
- Title: Implement and rehearse controlled Session authority transfer
- Goal: Implement resolved OPEN-016 and prove safe operator-controlled Session authority transfer with measured recovery and preserved committed evidence.
- User outcome: An authorized operator can transfer a Session to a prepared replacement without competing writers, duplicated accepted decisions or unexplained evidence gaps.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-005`, `REQ-006`, `REQ-008`, `REQ-051`, `REQ-064`, `REQ-067`, `REQ-069`, `REQ-070`, `INV-001`, `INV-002`, `INV-017`, `INV-019`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-005`, `REQ-006`, `REQ-008`, `REQ-051`, `REQ-064`, `REQ-067`, `REQ-069`, `REQ-070`, `INV-001`, `INV-002`, `INV-017`, `INV-019`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register sections 7.3 and 7.5
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-001
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-016
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-017
- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md` — Sync section 8
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime section 2
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 16 through 18

Observed source evidence:

- apps/server/src/runtime/commands/processor.ts
- apps/server/src/identity/context.ts
- apps/server/src/runtime/access/onboarding.ts
- scripts/recovery-evidence.mjs
- docs/operations/PS-820-INSTALL-UPGRADE-RECOVERY.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-840`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Read APPROVAL_IMPLEMENTATION_PROMPTBOOK.md for the remaining-sequence ownership, checkpoint and exact-candidate evidence rules; tasks.json remains the task source of truth
- Decision Register v1.0.16 resolves OPEN-004/010/016/023 and the prior assumptions; approval is not implementation evidence and never waives PS-810, provider, mail, accessibility or named human gates
- Use supported Windows/macOS desktop browsers at the declared minimum 1024 x 768 and equivalent 200% zoom, keyboard, pointer, forced colors, reduced motion and named desktop AT; mobile/touch acceptance remains approved N/A
- Inventory existing uncommitted work and prior evidence before changes; preserve unrelated work and distinguish local source, committed candidate and deployed staging digests
- Before provisioning disposable databases/containers, check disk capacity and record exact task-owned resource identifiers; reuse safely where possible, clean up only authorized task-owned resources, and never run broad volume/image pruning
- Inventory every consequential writer including timers, workers, effects and media-control paths; inspect database privileges and transaction authority checks
- Review candidate deployment topology, operator permissions, backup/anchor custody, client replay and existing recovery harnesses

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Controlled prepare/fence/verify/transfer/resume operation with explicit permissions, reason and audit evidence
- Shared-database application-host replacement and separately verified database/site recovery boundaries
- Failure injection and measured operator rehearsals on disposable nonproduction infrastructure
- Runbooks, observability, interrupted-transfer recovery and named Operations/Technical acceptance

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/runtime/
- apps/server/src/identity/
- apps/server/src/operations/
- apps/server/contracts/
- packages/event-contracts/
- deploy/
- scripts/
- package.json
- apps/server/test/
- tests/deployment/
- docs/operations/
- docs/release-evidence/
- test-results/authority-transfer/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Checkpoint A - Contract and operator path: map all writers and reuse the existing authority record. Specify a bounded, authenticated operator operation and inspect schema before assigning any additive migration. Define preconditions, transfer ownership, resume/retry semantics, evidence records and refusal behavior
- Checkpoint B - Safe execution: suspend intake, resolve in-flight receipts, fence old application and background writers, verify committed state/Evidence continuity, then atomically advance the epoch and successor. Isolate any old database primary through verified infrastructure controls before promotion; a row in one database cannot fence another writable database
- Checkpoint C - Client and failure behavior: reject stale owners/epochs on every consequential write, reconnect and reconcile idempotently, handle concurrent/repeated transfer attempts and crash at each phase, and remain paused if proof of fencing or continuity is unavailable
- Checkpoint D - Rehearsal: create and verify CMD-AUTHORITY-TRANSFER. Measure planned transfer and unexpected application-host failure under the conditions in resolved OPEN-016, including operator response. Separately retain OPEN-017 database/site recovery evidence and all safety preconditions; never weaken fencing to meet a timing target
- Record source/image/schema/configuration/environment identity, old/new authority, operator, failure-detection/start/resume timestamps, committed-data comparison, Evidence verification and all negative cases. Obtain named Operations/Technical review; PS-850 determines release GO

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

- No automatic failover, cloud-to-LAN takeover or new paid infrastructure
- No production fault injection or disabling a live writer without explicit authorization
- No owner/epoch changes through undocumented manual SQL or a timeout-only promotion
- No rewriting historical evidence, repurposing recovery-account scripts or equating backup restore speed with live-transfer time

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- PS-845-T01: planned shared-database transfer meets the approved conditional objective and preserves all committed records, receipts and independently verified Evidence
- PS-845-T02: unexpected application-host failure meets the approved detection-to-resume objective including operator response on a prepared replacement
- PS-845-T03: stale/concurrent/background writers, duplicate requests, interrupted phases, unavailable fencing and database split-writer scenarios are denied or safely remain paused without duplicate effects
- PS-845-T04: reconnected clients reconcile safely, failback cannot resurrect old authority, and database/site recovery remains separately measured under OPEN-017
- Given the documented preconditions, when the task behavior is exercised, then named Operations and Technical reviewers accept the exact-candidate rehearsal and staffing/runbook; missing timing, isolation or review evidence remains NOT RUN/FAIL

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Supported operator transfer operation and versioned contract
- Repeatable nonproduction transfer/failure harness
- Audited timed-rehearsal and committed-data/Evidence-continuity bundle
- Runbook with staffing, refusal, recovery and escalation procedures

## Tests

Required test/evidence IDs: `PS-845-T01`, `PS-845-T02`, `PS-845-T03`, `PS-845-T04`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-AUTHORITY-TRANSFER`, `CMD-EVIDENCE-VERIFY`, `CMD-BACKUP-RESTORE`, `CMD-DEPLOYMENT-SMOKE`, `CMD-SECURITY`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Every consequential writer enforces authority transactionally, including background paths
- No duplicate accepted decisions/effects or lost committed data during application-only transfer
- Failure to prove old-writer isolation or continuity prevents promotion
- Disposable targets and explicit refusal guards protect current demos and production
- Any fixes affecting product/auth/install behavior trigger affected PS-815/820/830/840 reruns before final approval

The approval gate is: All transfer integrity, timing and refusal evidence plus named operational review must pass. A safe refusal is correct behavior for a negative case but cannot substitute for a successful timed positive rehearsal. PS-850 owns final production approval. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed
- Update APPROVAL_IMPLEMENTATION_PROMPTBOOK.md only for execution/evidence links; preserve the task source and approval boundaries
- Record source/image/lockfile/schema/configuration/Release and environment identity; a changed candidate requires impact assessment and affected gate reruns, not copied PASS labels
- Return a checkpoint handoff with completed behavior, exact evidence, unresolved dependencies, candidate identity and the next safe step; do not collapse partial/internal/automated/human/final acceptance into one PASS

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `fix/ps-845-implement-and-rehearse-controlled-authority-transfer`
- Proposed subject: `feat(runtime): add controlled authority transfer`
- Expected migrations: none
- Expected API/contract IDs: `release-evidence-v2`

Proposed body:

```text
Why:
- Deliver the operator-controlled recovery contract approved in OPEN-016.
What:
- A fenced, audited transfer operation and timed nonproduction rehearsals.
Verification:
- PS-845-T01 through T04, registered regression gates and named operator review.
Compatibility / migrations:
- Inspect existing authority records; preserve epochs, Releases and evidence; allocate additive migrations only if required.
Risks / follow-up:
- No automatic failover or production deployment; PS-850 owns exact-artifact GO.
Refs: PS-845, OPEN-016, OPEN-017, ADR-001
```

Proposed PR description:

Implement safe operator-controlled Session authority transfer and demonstrate integrity, refusal behavior, client reconciliation and approved timing on an isolated candidate. Include real migration/compatibility implications and attributable operational review; do not claim automatic high availability.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
