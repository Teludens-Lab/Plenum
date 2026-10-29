# PS-230 - Run isolated Plugins through human-approved effects

## ID / title / goal / user outcome / risk

- ID: `PS-230`
- Title: Run isolated Plugins through human-approved effects
- Goal: Execute a pinned local Plugin, stage Effect Proposals, and commit approved effects exactly once.
- User outcome: A reviewer can inspect a model result and no authoritative state changes until a valid Approval Decision commits it.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-036`, `REQ-038`, `REQ-088`, `REQ-091`, `REQ-092`, `REQ-093`, `INV-008`, `INV-020`, `INV-026`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-036`, `REQ-038`, `REQ-088`, `REQ-091`, `REQ-092`, `REQ-093`, `INV-008`, `INV-020`, `INV-026`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md` — 10 Extension sections 8-18
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime section 12.3
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-54
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-018

Observed source evidence:

- docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-120`, `PS-210`, `PS-220`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Extension Host isolation requirements
- Policy-filtered snapshot boundary
- Command kernel approval and effect transaction

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Rootless container execution for one deterministic fixture
- Input/output validation
- Composition and Model Run provenance
- Effect Proposal review and exactly-once apply

Expected paths are discovery targets, not permission to invent absent structure:

- packages/extension-host/
- apps/server/src/extensions/runtime/
- apps/runtime-web/src/effect-proposals/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Freeze a policy-filtered input snapshot
- Run with resource and egress bounds
- Stage validated proposals
- Bind approval to proposal hash, state version, Release, and epoch
- Apply through an ordinary Command

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Exclude hidden role data
- Deny unauthorized reviewers
- Never log protected inputs or outputs

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Retry approval applies once
- Conflicting reviewers yield one transition
- Stale state returns STALE_PROPOSAL
- In-flight runs stay pinned

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not enable the deferred Python/native sandbox targets
- Do not auto-approve trusted Plugins
- Do not apply approval gates to designer-authored automation

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then state remains unchanged before approval
- Given the documented preconditions, when the task behavior is exercised, then same approval retries apply one effect and one Evidence Event
- Given the documented preconditions, when the task behavior is exercised, then malformed or timed-out run has no invented result
- Given the documented preconditions, when the task behavior is exercised, then designer-authored rule fires without spurious Plugin approval

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Extension Host slice
- Effect Proposal UI/API
- Approval transaction
- Full provenance export

## Tests

Required test/evidence IDs: `EXT-06`, `EXT-07`, `EXT-08`, `EXT-09`, `EXT-10`, `EXT-11`, `EXT-17`, `EXT-18`, `EXT-20`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`, `CMD-AIRGAP`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Extension Host has no direct stores
- Approval cannot be queued offline
- Provenance survives Plugin removal

The approval gate is: Formal Security Owner review of the isolation profile. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update contracts and threat model
- Update migration register
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-230-extension-host-and-human-approval`
- Proposed subject: `feat(extensions): require approval for model effects`
- Expected migrations: `012_extension_runs_approvals`
- Expected API/contract IDs: `model-run-v1`, `effect-proposal-v1`, `approval-decision-v1`

Proposed body:

```text
Why:
- Preserve human authority over consequential model effects.
What:
- Add isolated runs, proposals, approval, and exactly-once application.
Verification:
- EXT-06 to EXT-11, EXT-17, EXT-18, EXT-20.
Compatibility / migrations:
- Adds 012 run provenance.
Risks / follow-up:
- Sandbox and trust policy remain gated.
Refs: PS-230, REQ-088, DEC-54
```

Proposed PR description:

Summary: delivers isolated Plugin execution with approval. Risks: sandbox escape and stale approval. Migration: 012. Evidence: negative and retry tests. Rollback: disable new runs; preserve provenance.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: ADR-018 changes; A deferred execution target is approved; Composition semantics expand.
