# PS-210 - Enforce Information Policy, Messages, and Injects

## ID / title / goal / user outcome / risk

- ID: `PS-210`
- Title: Enforce Information Policy, Messages, and Injects
- Goal: Deliver a default-deny information flow slice spanning author configuration, Runtime enforcement, and evidence.
- User outcome: Participants receive only permitted content and each designed Inject fires and tracks response exactly once.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-016`, `REQ-029`, `REQ-030`, `REQ-047`, `REQ-050`, `INV-002`, `INV-014`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-016`, `REQ-029`, `REQ-030`, `REQ-047`, `REQ-050`, `INV-002`, `INV-014`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema sections 12 and 13
- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 12-14
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime sections 9-10
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 7-8

Observed source evidence:

- references/plenum-runtime-slice/src/server.mjs

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `DEC-34`, `DEC-40`.

## Prerequisites

Task prerequisites: `PS-110`, `PS-120`, `PS-200`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Policy engine public contract
- Release Information Policies and Communication Routes
- Inject lifecycle and trigger definitions

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Default-deny record and field projections
- Message route enforcement
- Manual, scheduled, Stage, and Gate Inject release
- Per-recipient acknowledgement and response

Expected paths are discovery targets, not permission to invent absent structure:

- packages/policy-engine/
- apps/server/src/runtime/messages/
- apps/server/src/runtime/injects/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Compile bounded policies
- Evaluate policy on every read and send
- Persist trigger claim before side effects
- Record access and delivery separately

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Seed route-leak and field-leak tests
- Use TARGET_NOT_FOUND for invisible records
- Filter plugin and export inputs

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Each Inject trigger claims once
- Retries return original receipts
- Policy revision invalidates projections

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not invent classification levels
- Do not infer delivery from access
- Do not execute authored code

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then forbidden routes and fields are denied at the server
- Given the documented preconditions, when the task behavior is exercised, then each trigger mode implemented by the active Release releases exactly once; scheduled and Gate modes remain publication-blocked until a Release needs and defines their approved semantics
- Given the documented preconditions, when the task behavior is exercised, then acknowledgement and response are distinct
- Given the documented preconditions, when the task behavior is exercised, then classification filtering applies to exports and plugin snapshots

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Policy evaluator
- Message service
- Inject engine
- Leakage and exactly-once tests

## Tests

Required test/evidence IDs: `PS-210-T01`, `PS-210-T02`, `PS-210-T03`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-DB`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Tenant isolation remains separate from Session policy
- No hidden data reaches client logs
- Past delivery is not falsely revoked

The approval gate is: Classification extensions remain blocked by OPEN-024. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update policy and event contract fixtures
- Update DATA_MIGRATION_REGISTER.md
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-210-information-policy-messages-and-injects`
- Proposed subject: `feat(runtime): enforce information flow rules`
- Expected migrations: `010_information_messages_injects`
- Expected API/contract IDs: `message-command-v1`, `inject-command-v1`, `information-projection-v1`

Proposed body:

```text
Why:
- Make information asymmetry authoritative.
What:
- Add policy-filtered Messages and exactly-once Injects.
Verification:
- Leakage, route, trigger, and response tests.
Compatibility / migrations:
- Adds 010 information tables.
Risks / follow-up:
- Classification extensions remain OPEN-024.
Refs: PS-210, REQ-016, INV-002
```

Proposed PR description:

Summary: enforces default-deny information flow. Risks: protected-data leakage. Migration: 010. Evidence: negative projection tests. Rollback: disable new routes; never weaken policy defaults.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-024 resolves; New Message Channel type is approved; Policy performance becomes measured bottleneck.
