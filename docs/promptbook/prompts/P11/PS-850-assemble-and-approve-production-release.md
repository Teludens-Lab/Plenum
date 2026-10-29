# PS-850 - Assemble and approve the production release

## ID / title / goal / user outcome / risk

- ID: `PS-850`
- Title: Assemble and approve the production release
- Goal: Bind the complete application, evidence, operations and owner decisions into one reproducible production release candidate.
- User outcome: The owner receives a single go/no-go packet proving that the complete platform is usable, secure, recoverable and operable for its declared version-1 scope.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-005`, `REQ-051`, `REQ-064`, `REQ-066`, `REQ-067`, `REQ-069`, `REQ-070`, `INV-015`, `INV-019`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-005`, `REQ-051`, `REQ-064`, `REQ-066`, `REQ-067`, `REQ-069`, `REQ-070`, `INV-015`, `INV-019`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap sections 13 and 15
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 16 through 18
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register OPEN-016

Observed source evidence:

- apps/studio/src/App.tsx
- apps/runtime-web/src/App.tsx
- apps/server/src/http/runtime-http.ts

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `OPEN-016`.

## Prerequisites

Task prerequisites: `PS-840`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- All P07-P11 handoffs
- Completeness and defect ledgers
- Golden journey and UAT evidence
- Security, accessibility, performance, deployment and recovery approvals
- Exact source/image/package digests

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Clean release-candidate build and signed manifests
- Full regression and production-shaped gates
- Operations, support, incident, rollback and recovery handoff
- Formal owner go/no-go decision bound to exact artifacts

Expected paths are discovery targets, not permission to invent absent structure:

- docs/release-evidence/
- deploy/
- test-results/release/
- docs/promptbook/RELEASE_READINESS.md
- docs/promptbook/RELEASE_GATES.md

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Create a clean tagged candidate from reviewed committed source
- Run every mandatory gate against the exact candidate
- Assemble signed evidence and operating runbooks
- Record explicit authorized approval or NO-GO with owners and remediation

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

- Do not deploy production without separate authorization
- Do not waive a blocker silently
- Do not claim high availability beyond approved authority-transfer behavior

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then the exact candidate passes every mandatory automated and human gate
- Given the documented preconditions, when the task behavior is exercised, then no completeness row, S0-S2 defect or production control is FAIL, BLOCKED or NOT RUN
- Given the documented preconditions, when the task behavior is exercised, then rollback, forward-fix, incident and restore procedures are owned and rehearsed
- Given the documented preconditions, when the task behavior is exercised, then an authorized owner signs GO for the exact source, image, schema, Package and evidence digests

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Signed release candidate
- Complete release evidence index
- Operations and support handoff
- Explicit owner decision

## Tests

Required test/evidence IDs: `PS-850-T01`, `PS-850-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-GOLDEN-JOURNEY`, `CMD-GAP-AUDIT`, `CMD-SECURITY`, `CMD-CLEAN-INSTALL`, `CMD-BACKUP-RESTORE`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Approval is bound to immutable artifact digests
- Production deployment remains a separately authorized action
- Any changed artifact invalidates approval and reruns affected gates

The approval gate is: Change-level acceptance requires passing automated evidence and a completed user-test script; production approval remains separate.. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-850-assemble-and-approve-production-release`
- Proposed subject: `chore(release): assemble complete platform evidence`
- Expected migrations: none
- Expected API/contract IDs: `release-evidence-v2`

Proposed body:

```text
Why:
- Bind the complete application, evidence, operations and owner decisions into one reproducible production release candidate.
What:
- The owner receives a single go/no-go packet proving that the complete platform is usable, secure, recoverable and operable for its declared version-1 scope.
Verification:
- Run the listed automated gates and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-850, REQ-005, REQ-051, REQ-064
```

Proposed PR description:

Summary: The owner receives a single go/no-go packet proving that the complete platform is usable, secure, recoverable and operable for its declared version-1 scope. Risks: high workflow and authorization regressions. Migration: none. Evidence: automated checks, screenshots, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
