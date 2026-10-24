# PS-550 - Close security, accessibility, and release gates

## ID / title / goal / user outcome / risk

- ID: `PS-550`
- Title: Close security, accessibility, and release gates
- Goal: Run the complete negative-control, accessibility, recovery, migration, and release evidence matrix.
- User outcome: Owners receive an honest go/no-go package with every unresolved production gate visible.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-051`, `REQ-052`, `REQ-064`, `REQ-066`, `REQ-067`, `REQ-069`, `REQ-076`, `REQ-083`, `REQ-085`, `INV-002`, `INV-015`, `INV-025`, `INV-027`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-051`, `REQ-052`, `REQ-064`, `REQ-066`, `REQ-067`, `REQ-069`, `REQ-076`, `REQ-083`, `REQ-085`, `INV-002`, `INV-015`, `INV-025`, `INV-027`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 19, 20, 22, 23
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap sections 13 and 15
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register open items (entire current document)

Observed source evidence:

- docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `OPEN-001`, `OPEN-009`, `OPEN-019`, `OPEN-024`, `OPEN-027`, `OPEN-028`, `OPEN-029`.

## Prerequisites

Task prerequisites: `PS-510`, `PS-520`, `PS-530`, `PS-540`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- All phase evidence, including deferred AC-07/AC-11 results from PS-420/PS-500
- Security control ownership
- Accessibility reference screens
- Migration and recovery rehearsals

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Security control verification
- Tenant and policy denial
- Secret and consent privacy
- WCAG 2.2 AA evidence
- Migration and restore gate
- Release maturity matrix

Expected paths are discovery targets, not permission to invent absent structure:

- docs/release-evidence/
- tests/security/
- tests/accessibility/
- RELEASE_READINESS.md

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Map every control to test or operational check
- Run representative browser and assistive-technology tests
- Verify dependency and secret scanning
- Classify defects and block release where required

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Use least privilege in every check
- Inspect logs and exports for protected data
- Keep audit evidence access-controlled

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Rehearse expand/backfill/switch/contract
- Confirm restore and forward-fix compatibility
- Pin evidence to build digest

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not grant owner risk acceptance
- Do not claim accreditation
- Do not waive unresolved critical defects

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every mandatory control has PASS/FAIL/NOT RUN evidence
- Given the documented preconditions, when the task behavior is exercised, then deferred AC-07 and AC-11 have passing PS-420/PS-500 evidence before release approval
- Given the documented preconditions, when the task behavior is exercised, then no critical defect is silently accepted
- Given the documented preconditions, when the task behavior is exercised, then maturity states are separated
- Given the documented preconditions, when the task behavior is exercised, then owner approval remains distinct from engineering completion

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Release evidence index
- Security and accessibility reports
- Maturity matrix
- Go/no-go recommendation

## Tests

Required test/evidence IDs: `VOTE-09`, `VOTE-15`, `VOICE-10`, `VOICE-11`, `VOICE-13`, `PS-550-T01`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`, `CMD-SECURITY`, `CMD-BACKUP-RESTORE`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- All earlier phase gates remain satisfied
- No fictional certification or performance claim
- Production-gating OPEN items remain blockers

The approval gate is: Formal release approval requires named owners and closure or explicit acceptance of every listed OPEN gate. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Finalize RELEASE_READINESS.md and RELEASE_GATES.md
- Update PROJECT_STATE.md
- Record named owner decisions

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `fix/ps-550-security-accessibility-and-release-gates`
- Proposed subject: `test(release): enforce assurance gates`
- Expected migrations: none
- Expected API/contract IDs: `release-evidence-v1`

Proposed body:

```text
Why:
- Separate engineering completion from release approval.
What:
- Add security, accessibility, recovery, and maturity evidence.
Verification:
- Run all release commands and record exact outcomes.
Compatibility / migrations:
- Rehearses the full migration chain.
Risks / follow-up:
- Owner approval remains external.
Refs: PS-550, REQ-051, OPEN-001
```

Proposed PR description:

Summary: assembles release assurance evidence. Risks: incomplete manual review. Migration: rehearsal only. Evidence: signed index. Rollback: evidence-only; failed gates remain failed.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Any release artifact changes; An OPEN gate resolves; A critical defect is discovered.
