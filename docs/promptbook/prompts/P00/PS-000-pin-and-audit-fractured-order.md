# PS-000 - Pin and classify the Fractured Order reference

## ID / title / goal / user outcome / risk

- ID: `PS-000`
- Title: Pin and classify the Fractured Order reference
- Goal: Create the evidence-backed parity inventory against an owner-approved Fractured Order commit.
- User outcome: Every preserved reference behavior has a classification, source location, and parity-test target.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-024`, `REQ-071`, `INV-022`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-024`, `REQ-071`, `INV-022`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` — 08 Canon v1.0.1 section 12
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap v1.3.2 sections 4 and 6
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register OPEN-003

Observed source evidence:

- references/fractured-order.snapshot.json
- references/fractured-order/README.md
- docs/corpus/README.md
- docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `DEC-22`.

## Prerequisites

Task prerequisites: none.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Owner-supplied golden repository and exact commit SHA
- Current routes, stores, services, tables, forms, exports, and tests at that SHA
- 08 Canon section 12 classifications

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Record the approved SHA
- Produce capability, hard-coding, route, event, data, and coverage maps
- Classify each item without changing product code

Expected paths are discovery targets, not permission to invent absent structure:

- docs/reference-audit/
- definitions/fractured-order/
- tests/parity/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Inventory observable behavior and trace each row to the pinned SHA
- Classify rows using the Canon categories
- Raise ambiguous classifications for Methodology Lead review

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Do not copy secrets or personal data from the reference repository
- Keep private source links access-controlled

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Treat the SHA as immutable
- Key parity evidence by SHA and Release digest

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not reproduce legacy defects
- Do not alter the reference repository
- Do not infer methodology from unpinned code

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then the audited source matches commit ae5d5065bc04a53631815b1b1715a54e21e3ef5b and the tree recorded in references/fractured-order.snapshot.json
- Given the documented preconditions, when the task behavior is exercised, then every observed capability has one Canon classification and source citation
- Given the documented preconditions, when the task behavior is exercised, then ambiguous rows are explicitly blocked for Methodology Lead review
- Given the documented preconditions, when the task behavior is exercised, then no application files change

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Pinned reference record
- Capability and hard-coding matrices
- Parity fixture plan

## Tests

Required test/evidence IDs: `AC-09`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PROMPTBOOK-VALIDATE`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- No archived file is cited as current authority
- No named Team or Session Role is promoted into platform logic

The approval gate is: The owner-approved source pin is satisfied; Methodology Lead review remains required for ambiguous classifications. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PROJECT_STATE.md
- Update PARITY_TEST_PLAN.md
- Record new conflicts in CONFLICT_REGISTER.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-000-pin-and-audit-fractured-order`
- Proposed subject: `docs(reference): pin Fractured Order parity baseline`
- Expected migrations: none
- Expected API/contract IDs: none

Proposed body:

```text
Why:
- Establish the approved parity source.
What:
- Add the classified reference inventory.
Verification:
- Promptbook and inventory validation.
Compatibility / migrations:
- None.
Risks / follow-up:
- Ambiguous methodology rows remain gated.
Refs: PS-000, AC-09, OPEN-003
```

Proposed PR description:

Summary: pins and classifies the golden reference. Risks: classification errors. Migration: none. Evidence: inventory validation. Rollback: remove the audit artifacts.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The Product Owner supersedes the golden commit; The golden repository rewrites history; Methodology Lead changes a classification.
