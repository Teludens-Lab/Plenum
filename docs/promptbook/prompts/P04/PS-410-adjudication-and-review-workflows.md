# PS-410 - Deliver explainable adjudication and review workflows

## ID / title / goal / user outcome / risk

- ID: `PS-410`
- Title: Deliver explainable adjudication and review workflows
- Goal: Support manual, rubric, rules, Plugin, hybrid, and multi-perspective adjudication through one contract.
- User outcome: Adjudicators can review evidence, explain decisions, override suggestions with rationale, and publish outcomes safely.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-036`, `REQ-037`, `REQ-038`, `REQ-039`, `REQ-040`, `INV-008`, `INV-014`, `INV-020`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-036`, `REQ-037`, `REQ-038`, `REQ-039`, `REQ-040`, `INV-008`, `INV-014`, `INV-020`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` — 08 Canon section 8
- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema section 14
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime section 12
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-54

Observed source evidence:

- docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `OPEN-006`, `OPEN-018`, `OPEN-022`.

## Prerequisites

Task prerequisites: `PS-230`, `PS-400`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Adjudication contract and doctrine mapping
- Effect Proposal path
- Workflow assignment and quorum support

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Manual, rubric, and rules mechanisms
- Unified request and record
- Perspective reviews and lead synthesis
- Draft-to-publish outcome flow
- Plugin proposal integration

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/adjudication/
- apps/runtime-web/src/adjudication/
- packages/workflow-engine/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Generate explanation trace
- Require override rationale
- Keep reviewer inputs and final synthesis distinct
- Apply published effects transactionally

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Filter evidence by reviewer permissions
- Keep hidden analytical notes separate
- Deny direct outcome publication

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Competing adjudications yield one accepted version
- Records pin Governing Release
- Plugin approvals use proposal hash and epoch

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not make model output authoritative
- Do not invent doctrine
- Do not expose unpublished outcomes

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then all mechanisms produce one contract
- Given the documented preconditions, when the task behavior is exercised, then rules trace lists each evaluated condition
- Given the documented preconditions, when the task behavior is exercised, then override requires rationale
- Given the documented preconditions, when the task behavior is exercised, then unpublished result is invisible
- Given the documented preconditions, when the task behavior is exercised, then two competing versions produce one conflict

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Adjudication service
- Reviewer UI
- Explanation trace
- Conflict and publication tests

## Tests

Required test/evidence IDs: `AC-12`, `PS-410-T01`, `PS-410-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Failed Plugin never becomes outcome
- DEC-54 carve-out remains correct
- Historical review inputs remain attributable

The approval gate is: Methodology doctrine and unresolved modeling questions require owner review. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update API and event fixtures
- Update migration register
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-410-adjudication-and-review-workflows`
- Proposed subject: `feat(adjudication): publish explainable outcomes`
- Expected migrations: `019_adjudication_records`
- Expected API/contract IDs: `adjudication-request-v1`, `adjudication-record-v1`

Proposed body:

```text
Why:
- Unify human and model-supported adjudication safely.
What:
- Add explainable mechanisms, review, and publication.
Verification:
- Conflict, denial, trace, and outcome tests.
Compatibility / migrations:
- Adds 019 adjudication records.
Risks / follow-up:
- Modeling questions remain OPEN-018.
Refs: PS-410, REQ-036, INV-008
```

Proposed PR description:

Summary: delivers explainable adjudication. Risks: hidden evidence and concurrent approvals. Migration: 019. Evidence: mechanism matrix. Rollback: stop new publications and preserve drafts.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-018 resolves; Doctrine changes; A new adjudication mechanism is approved.
