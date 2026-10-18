# PS-600 - Expand the approved production Plugin catalog

## ID / title / goal / user outcome / risk

- ID: `PS-600`
- Title: Expand the approved production Plugin catalog
- Goal: Add individually approved production Plugins and external integrations after their contracts and licenses stabilize.
- User outcome: Designers can choose more institution-approved models without weakening the first-release extension controls.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-038`, `REQ-086`, `REQ-087`, `REQ-088`, `REQ-089`, `REQ-090`, `REQ-091`, `REQ-092`, `REQ-093`, `REQ-094`, `INV-020`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-038`, `REQ-086`, `REQ-087`, `REQ-088`, `REQ-089`, `REQ-090`, `REQ-091`, `REQ-092`, `REQ-093`, `REQ-094`, `INV-020`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap Phase 6
- `docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md` — 10 Extension Framework (entire current document)
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-011
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-029

Observed source evidence:

- docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `OPEN-011`, `OPEN-022`, `OPEN-029`.

## Prerequisites

Task prerequisites: `PS-550`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Candidate Plugin contract, license, security classification, and lifecycle
- Approved registry and SDK
- Profile compatibility

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- One approved Plugin at a time
- Contract and fixture tests
- Offline/local replacement where required
- Catalog metadata and runbook

Expected paths are discovery targets, not permission to invent absent structure:

- plugins/
- tests/plugins/
- docs/plugins/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Verify supply chain and digest
- Map policy-filtered inputs
- Require effect approval
- Measure cost and failure behavior
- Document removal path

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Review each requested permission
- Deny extra data
- Keep external egress explicit

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Pin artifact and adapter digests
- Use bounded retries
- Preserve run provenance after removal

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not revive AI-assisted authoring
- Do not add feedback loops, ranked choice, or video without new decisions
- Do not create a public marketplace

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then plugin has approved contract, license, security review, and digest
- Given the documented preconditions, when the task behavior is exercised, then failure yields no invented result
- Given the documented preconditions, when the task behavior is exercised, then air-gap compatibility is explicit
- Given the documented preconditions, when the task behavior is exercised, then every consequential effect still requires approval

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Approved Plugin Artifact
- Contract tests
- Profile compatibility evidence
- Catalog entry

## Tests

Required test/evidence IDs: `EXT-02`, `EXT-04`, `EXT-05`, `EXT-10`, `EXT-11`, `EXT-17`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-AIRGAP`, `CMD-SECURITY`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Framework tests remain green
- No core authority moves to Plugin
- Deferred product features remain deferred

The approval gate is: Each production Plugin requires its own owner and security approval under OPEN-011/029. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update catalog and technology matrix
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-600-expand-approved-plugin-catalog`
- Proposed subject: `feat(plugins): add approved catalog integration`
- Expected migrations: none
- Expected API/contract IDs: `plugin-manifest-v1`

Proposed body:

```text
Why:
- Expand approved modeling capabilities safely.
What:
- Add one reviewed Plugin with fixtures and profile evidence.
Verification:
- Contract, security, failure, and air-gap tests.
Compatibility / migrations:
- None unless the Plugin contract requires a versioned addition.
Risks / follow-up:
- Approval is Plugin-specific.
Refs: PS-600, REQ-086, OPEN-011
```

Proposed PR description:

Summary: adds one approved production Plugin. Risks: external dependency and data exposure. Migration: contract-specific. Evidence: Plugin review package. Rollback: revoke new runs and preserve history.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Plugin contract or license changes; Artifact is revoked; A deferred capability receives a new product decision.
