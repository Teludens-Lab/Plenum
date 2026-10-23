# PS-520 - Generate traceable reports, research exports, and replay

## ID / title / goal / user outcome / risk

- ID: `PS-520`
- Title: Generate traceable reports, research exports, and replay
- Goal: Produce governed reports and portable research data with source provenance, retention, and replay divergence evidence.
- User outcome: Operators and analysts receive accurate exports that distinguish captured history, derived metrics, notes, and findings.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-034`, `REQ-042`, `REQ-054`, `REQ-055`, `REQ-056`, `REQ-057`, `REQ-058`, `REQ-059`, `REQ-060`, `REQ-061`, `REQ-062`, `INV-013`, `INV-015`, `INV-016`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-034`, `REQ-042`, `REQ-054`, `REQ-055`, `REQ-056`, `REQ-057`, `REQ-058`, `REQ-059`, `REQ-060`, `REQ-061`, `REQ-062`, `INV-013`, `INV-015`, `INV-016`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 11-17
- `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` — 08 Canon sections 10-11
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime sections 17 and 21

Observed source evidence:

- references/plenum-runtime-slice/src/server.mjs

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `OPEN-009`, `OPEN-017`, `OPEN-022`.

## Prerequisites

Task prerequisites: `PS-410`, `PS-420`, `PS-510`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Evidence export baseline
- Report Definitions
- Research and retention policy gaps

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Standard reports and structured formats
- Source-level provenance
- Four analytical layers
- Consent and anonymization
- Retention/correction
- Deterministic replay and divergence report
- Organization export/import

Expected paths are discovery targets, not permission to invent absent structure:

- packages/reporting-engine/
- apps/server/src/reporting/
- apps/server/src/replay/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Read canonical records only
- Attach Release, Session, versions, and included/excluded classes
- Trace every output element
- Version metrics
- Use compensating corrections

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Apply consent and field exclusion
- Separate identity from behavior
- Suppress secret Ballots and protected voice assets by default

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Exports are idempotent jobs
- Replay pins all versions and seed
- Regeneration creates a new artifact, not mutation

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not present reconstructed narrative as transcript
- Do not invent research findings
- Do not overwrite raw Observations

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every report element traces to source
- Given the documented preconditions, when the task behavior is exercised, then anonymized export contains no direct identifiers
- Given the documented preconditions, when the task behavior is exercised, then metric version changes do not rewrite history
- Given the documented preconditions, when the task behavior is exercised, then replay either matches or emits machine-readable divergence
- Given the documented preconditions, when the task behavior is exercised, then organization export reimports cleanly

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Report engine
- Research export
- Retention/correction workflows
- Replay and divergence report

## Tests

Required test/evidence IDs: `AC-06`, `PS-520-T01`, `PS-520-T02`, `PS-520-T03`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`, `CMD-REPORT-RECONCILE`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Captured and reconstructed labels remain distinct
- Secret Ballots remain excluded
- Retention does not break evidence proofs

The approval gate is: Production retention, research roles, and RPO/RTO require OPEN-009/017/025. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update data dictionary and retention matrix
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-520-reporting-research-retention-and-replay`
- Proposed subject: `feat(reporting): trace exports to session evidence`
- Expected migrations: `024_reporting_research`
- Expected API/contract IDs: `report-definition-v1`, `research-export-v1`, `replay-divergence-v1`

Proposed body:

```text
Why:
- Produce trustworthy reports and research data.
What:
- Add provenance, analytical layers, retention, replay, and exports.
Verification:
- Reconciliation, anonymization, and replay tests.
Compatibility / migrations:
- Adds 024 reporting records.
Risks / follow-up:
- Institutional policies remain open.
Refs: PS-520, REQ-055, INV-016
```

Proposed PR description:

Summary: delivers governed reporting and replay. Risks: privacy and provenance gaps. Migration: 024. Evidence: reconciliation suite. Rollback: stop export jobs and preserve generated artifacts.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-009/017/025 resolve; Report format changes; New research classification is approved.
