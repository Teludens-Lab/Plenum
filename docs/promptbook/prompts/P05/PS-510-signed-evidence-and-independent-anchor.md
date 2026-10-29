# PS-510 - Sign, anchor, and verify Evidence checkpoints

## ID / title / goal / user outcome / risk

- ID: `PS-510`
- Title: Sign, anchor, and verify Evidence checkpoints
- Goal: Create independently verifiable signed Checkpoints over contiguous Evidence ranges.
- User outcome: An institution can detect modified or missing Session history using an offline verification export.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-006`, `REQ-053`, `REQ-066`, `INV-015`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-006`, `REQ-053`, `REQ-066`, `INV-015`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data section 10
- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/POSTGRESQL_LOGICAL_DATA_MODEL_v1.1.md` — Data Model sections 4.6 and 6.3
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-003
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-017

Observed source evidence:

- references/plenum-runtime-slice/migrations/002_runtime_sync_evidence.sql

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-003`.

## Prerequisites

Task prerequisites: `PS-120`, `PS-350`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Checkpoint schema-only tables
- Canonicalization format
- Available institutional key and anchor adapters

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Checkpoint batches
- External signer port
- Independent anchor receipt
- Offline verification export
- Key-rotation and tamper drills

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/evidence/checkpoints/
- packages/reporting-engine/src/verification/
- tests/evidence/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Canonicalize contiguous ranges
- Chain checkpoint digests
- Sign outside DB
- Persist anchor receipts
- Verify missing, modified, reordered, and key-rotation cases
- Checkpoint every five minutes or 1,000 Evidence Events and at Session close
- Keep signing keys in an institution-controlled KMS, HSM or hardware token and retain historical public verification keys

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Restrict verification exports
- Redact protected bodies without breaking proof metadata
- Separate signing custody
- Exclude protected event bodies from the independent anchor

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- One Checkpoint per starting sequence
- Retry signing and anchoring idempotently
- Never skip a committed range

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not claim tamper evidence without independent anchor
- Do not store signing keys in PostgreSQL
- Do not silently delete evidence

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then modified or omitted event fails independent verification
- Given the documented preconditions, when the task behavior is exercised, then key rotation preserves chain verification
- Given the documented preconditions, when the task behavior is exercised, then restore drill verifies chain end to end
- Given the documented preconditions, when the task behavior is exercised, then no integrity claim is made without an anchor
- Given the documented preconditions, when the task behavior is exercised, then approved cadence creates one idempotent signed and independently anchored Checkpoint
- Given the documented preconditions, when the task behavior is exercised, then historical evidence remains verifiable after signing-custody rotation

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Checkpoint worker
- Signer and anchor ports
- Verification CLI/export
- Tamper and recovery evidence

## Tests

Required test/evidence IDs: `SYNC-13`, `PS-510-T01`, `PS-510-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-EVIDENCE-VERIFY`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Evidence remains append-only
- Correction uses compensating event
- Signer has no application DB ownership

The approval gate is: Resolved OPEN-014/017 signing, anchor, custody and recovery policy must be implemented and evidenced. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update custody and recovery matrix
- Record evidence against the approved RPO/RTO
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-510-signed-evidence-and-independent-anchor`
- Proposed subject: `feat(evidence): verify signed checkpoint chains`
- Expected migrations: `023_evidence_checkpoints`
- Expected API/contract IDs: `checkpoint-v1`, `verification-export-v1`

Proposed body:

```text
Why:
- Make institutional evidence independently verifiable.
What:
- Add checkpoint signing, anchoring, and offline verification.
Verification:
- Tamper, omission, rotation, and restore drills.
Compatibility / migrations:
- Adds 023 checkpoint operations.
Risks / follow-up:
- Implement and evidence the resolved OPEN-014/017 custody and recovery policy.
Refs: PS-510, REQ-006, ADR-003
```

Proposed PR description:

Summary: adds signed and anchored evidence. Risks: key custody and false assurance. Migration: 023. Evidence: tamper drills. Rollback: pause new checkpoints; preserve all records.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The OPEN-014/017 policy changes; Canonicalization changes; Signing algorithm rotation.
