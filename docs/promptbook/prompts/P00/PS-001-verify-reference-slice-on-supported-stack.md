# PS-001 - Verify the v0.2 slice on Node 24 and PostgreSQL 18

## ID / title / goal / user outcome / risk

- ID: `PS-001`
- Title: Verify the v0.2 slice on Node 24 and PostgreSQL 18
- Goal: Reproduce the reference slice verification record on the supported floor and approved database major.
- User outcome: Engineers have a trustworthy preserve/change/deprecate baseline before platform extraction begins.
- Risk: **MEDIUM**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-005`, `REQ-035`, `REQ-045`, `REQ-053`, `REQ-065`, `REQ-070`, `INV-001`, `INV-015`, `INV-017`, `INV-022`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-005`, `REQ-035`, `REQ-045`, `REQ-053`, `REQ-065`, `REQ-070`, `INV-001`, `INV-015`, `INV-017`, `INV-022`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `references/plenum-runtime-slice/README.md` — Reference slice v0.2 README
- `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/POSTGRESQL_LOGICAL_DATA_MODEL_v1.1.md` — Data Model v1.1.1 sections 5 and 13
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-008
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-009
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-015

Observed source evidence:

- references/plenum-runtime-slice/package-lock.json
- references/plenum-runtime-slice/migrations/001_core.sql
- references/plenum-runtime-slice/test/db.test.mjs

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-008`, `ADR-009`, `OPEN-001`.

## Prerequisites

Task prerequisites: none.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- package.json and lockfile
- docker-compose.yml
- migrations/001-004
- src, test, OpenAPI, and the reference definition
- Current Node, npm, Docker, and PostgreSQL versions

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Run syntax, unit, migration, smoke, database, and browser checks on Node 24+ and PostgreSQL 18
- Record exact versions and outputs
- Classify existing files as preserve, change, or deprecate

Expected paths are discovery targets, not permission to invent absent structure:

- references/plenum-runtime-slice/
- docs/reference-slice-verification.md

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Fail preflight if Node is below 24
- Use a disposable PostgreSQL 18 database
- Run the documented commands unchanged before proposing fixes
- Record failures separately from historical 2026-10-17 evidence

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Keep demo identity loopback-only
- Use synthetic seeded identities only
- Run RLS checks as plenum_app

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Exercise six concurrent retries
- Verify foreign and fenced authority refusal
- Pin the tested pg package and PostgreSQL minor in evidence

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not port the slice
- Do not upgrade unrelated packages
- Do not claim PostgreSQL 18 success without the run

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then node 24+ and PostgreSQL 18 are named in the evidence
- Given the documented preconditions, when the task behavior is exercised, then all slice checks are PASS or failures have exact output and no completion claim
- Given the documented preconditions, when the task behavior is exercised, then preserve/change/deprecate covers every baseline file group

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Supported-stack verification report
- Preserve/change/deprecate inventory
- Exact command evidence

## Tests

Required test/evidence IDs: `SYNC-05`, `SYNC-06`, `SYNC-07`, `SYNC-09`, `SYNC-12`, `DB-01`, `DB-02`, `DB-04`, `DB-05`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-SLICE-CHECK`, `CMD-SLICE-UNIT`, `CMD-SLICE-MIGRATE`, `CMD-SLICE-SEED`, `CMD-SLICE-START`, `CMD-SLICE-SMOKE`, `CMD-SLICE-DB`, `CMD-SLICE-BROWSER`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- DEC-42 return and forbidden paths remain proven
- Rejected receipts, evidence sequences, RLS, and authority fencing remain proven

The approval gate is: None; use disposable local resources only. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update COMMAND_REGISTRY.md
- Update PROJECT_STATE.md
- Update SOURCE_REGISTER.md only if new sources appear

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `fix/ps-001-verify-reference-slice-on-supported-stack`
- Proposed subject: `test(reference): verify slice on supported stack`
- Expected migrations: `001_core`, `002_runtime_sync_evidence`, `003_collaboration`, `004_security`
- Expected API/contract IDs: `openapi-3.1-slice-v0.2`

Proposed body:

```text
Why:
- Establish a reproducible implementation baseline.
What:
- Record Node 24 and PostgreSQL 18 verification and migration inventory.
Verification:
- Run every CMD-SLICE command.
Compatibility / migrations:
- Exercises 001-004 without changing them.
Risks / follow-up:
- No production claim.
Refs: PS-001, ADR-009, DB-01
```

Proposed PR description:

Summary: verifies the existing spike on supported versions. Risks: environment-only findings. Migration: tests 001-004. Evidence: command logs. Rollback: documentation-only removal.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Node floor changes; PostgreSQL minimum changes; Any slice migration or test changes.
