# PS-340 - Configure Session access, Seats, and readiness

## ID / title / goal / user outcome / risk

- ID: `PS-340`
- Title: Configure Session access, Seats, and readiness
- Goal: Turn a published Release into a staffed, checked, and safely opened Session.
- User outcome: Operators can invite, review, assign, reassign, and admit Participants without codes becoming authority.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-018`, `REQ-045`, `REQ-046`, `REQ-047`, `REQ-048`, `REQ-049`, `REQ-069`, `INV-001`, `INV-002`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-018`, `REQ-045`, `REQ-046`, `REQ-047`, `REQ-048`, `REQ-049`, `REQ-069`, `INV-001`, `INV-002`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio section 21
- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform section 20
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime sections 2 and 4
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap section 15

Observed source evidence:

- references/plenum-runtime-slice/src/server.mjs

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-110`, `PS-150`, `PS-310`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- AccessPolicyDefinition
- Session onboarding routes
- Readiness gate requirements

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Invitations, verified joins, waiting room, roster review
- Seat claims and operator assignment
- Guest and Display Principal constraints
- Readiness checklist and open gate

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/runtime/access/
- apps/operator-console/src/readiness/
- apps/studio/src/access/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Hash and expire invitation tokens
- Resolve Seat eligibility server-side
- Make reassignment transactional
- Block open until required checks pass

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Guest and Display principals are narrowly scoped
- Cross-team reassignment warns about prior exposure
- Participant cannot read administrative audit

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Concurrent Seat claims yield one assignment
- Reassignment closes then opens atomically
- Readiness uses current Release and assignment versions

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not let a session code grant access
- Do not create unapproved Organization Roles
- Do not hide ambiguous roster rows

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then code-only join is denied
- Given the documented preconditions, when the task behavior is exercised, then ambiguous roster row enters review
- Given the documented preconditions, when the task behavior is exercised, then two claimants cannot occupy one exclusive Seat
- Given the documented preconditions, when the task behavior is exercised, then session cannot open with required readiness incomplete

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Access configuration
- Operator staffing and readiness UI
- Onboarding contracts and tests

## Tests

Required test/evidence IDs: `AC-03`, `PS-340-T01`, `PS-340-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Organization and Session Roles remain separate
- Attribution survives reassignment
- Guest expiry and revocation are tested

The approval gate is: OPEN-007 resolved 2026-10-21; production identity-profile and DEC-61 role implementation evidence remain separate gates. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update operator readiness contract
- Update migration register
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-340-session-access-and-readiness`
- Proposed subject: `feat(session): gate access and readiness`
- Expected migrations: `017_session_access`
- Expected API/contract IDs: `session-onboarding-v1`, `readiness-v1`

Proposed body:

```text
Why:
- Staff and open Sessions without weak code-based access.
What:
- Add onboarding, Seats, roster review, and readiness gate.
Verification:
- Access, concurrency, denial, and E2E tests.
Compatibility / migrations:
- Adds 017 session access.
Risks / follow-up:
- Production identity profiles and DEC-61 roles remain separate implementation work.
Refs: PS-340, REQ-069, DEC-61
```

Proposed PR description:

Summary: delivers safe Session staffing and launch. Risks: identity and Seat races. Migration: 017. Evidence: onboarding E2E. Rollback: close joining and retain assignments.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: DEC-61 role implementation begins; Guest policy changes; Seat topology contract changes.
