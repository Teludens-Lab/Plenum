# PS-240 - Deliver authoritative Polls, Ballots, Tallies, and Certification

## ID / title / goal / user outcome / risk

- ID: `PS-240`
- Title: Deliver authoritative Polls, Ballots, Tallies, and Certification
- Goal: Implement the core voting lifecycle with explicit rules, idempotent Ballots, reproducible Tallies, and Certification.
- User outcome: Eligible Participants can vote with clear receipts and operators can certify a reproducible result without exposing protected choices.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-072`, `REQ-073`, `REQ-074`, `REQ-075`, `REQ-076`, `REQ-077`, `REQ-078`, `INV-023`, `INV-024`, `INV-025`, `INV-026`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-072`, `REQ-073`, `REQ-074`, `REQ-075`, `REQ-076`, `REQ-077`, `REQ-078`, `INV-023`, `INV-024`, `INV-025`, `INV-026`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/11_LIVE_POLLING_AND_VOTING_v1.1.md` — 11 Voting v1.1.0 (entire current document)
- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema section 13.2
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data section 24.1
- `docs/corpus/02_Updated_Architecture/09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md` — 09 Contracts section 12.2

Observed source evidence:

- docs/corpus/02_Updated_Architecture/11_LIVE_POLLING_AND_VOTING_v1.1.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-120`, `PS-140`, `PS-210`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Poll Definition and command catalog
- Secret-ballot storage boundary
- Offline Ballot rule

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Poll open/close/freeze
- Electorate snapshot
- Ballot cast and receipt
- Built-in tally
- Certification and correction
- LAN operation

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/voting/
- apps/runtime-web/src/polls/
- apps/server/test/voting/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Require explicit denominator, abstention, quorum, weight, veto, and tie rules
- Freeze definition at open
- Store secret choice apart from identity
- Bind Certification to Ballot-set hash and method version

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Resolve Electorate server-side
- Hide early results
- Exclude secret choices from events, logs, exports, analytics, and Plugin inputs

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Unique accepted Ballot per Seat Assignment unless revote configured
- Two Certifications yield one current record
- Deadline uses server receipt time
- Adapters are digest-pinned

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not implement ranked choice
- Do not claim end-to-end verifiability
- Do not enable production secret ballots before OPEN-028

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then retry returns the original Ballot receipt
- Given the documented preconditions, when the task behavior is exercised, then late queued Ballot returns DEADLINE_EXPIRED
- Given the documented preconditions, when the task behavior is exercised, then independent recount matches hash
- Given the documented preconditions, when the task behavior is exercised, then unauthorized query reveals no Ballot or early result
- Given the documented preconditions, when the task behavior is exercised, then open Poll cannot be edited

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Voting schema and services
- Participant Poll UI
- Certification view
- VOTE-01 to VOTE-10 evidence

## Tests

Required test/evidence IDs: `VOTE-01`, `VOTE-02`, `VOTE-03`, `VOTE-04`, `VOTE-05`, `VOTE-06`, `VOTE-07`, `VOTE-08`, `VOTE-09`, `VOTE-10`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Human Ballots are never treated as Plugin effects
- Certified result changes state only through a separate Command
- Production secret-ballot gate remains closed

The approval gate is: Production secret-ballot use blocked by OPEN-028. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update OpenAPI and privacy threat model
- Update migration register
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-240-authoritative-polling-and-voting`
- Proposed subject: `feat(voting): certify reproducible poll results`
- Expected migrations: `013_voting_core`
- Expected API/contract IDs: `poll-command-v1`, `ballot-command-v1`, `certification-v1`

Proposed body:

```text
Why:
- Deliver first-release authoritative voting.
What:
- Add Poll, Ballot, Tally, and Certification flows.
Verification:
- VOTE-01 to VOTE-10.
Compatibility / migrations:
- Adds 013 voting core.
Risks / follow-up:
- Secret-ballot production use remains OPEN-028.
Refs: PS-240, REQ-075, INV-025
```

Proposed PR description:

Summary: delivers core voting. Risks: ballot secrecy and race conditions. Migration: 013. Evidence: VOTE suite. Rollback: void affected Polls; never rewrite Ballots.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-028 resolves; A Voting Method Adapter is approved; Ranked choice is revived by a new decision.
