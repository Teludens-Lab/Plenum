# PS-350 - Prove Designer to evidence first release journey

## ID / title / goal / user outcome / risk

- ID: `PS-350`
- Title: Prove Designer to evidence first release journey
- Goal: Pass AC-01 through AC-13 across Studio, Release, Runtime, evidence, and export.
- User outcome: A non-programming Designer and Session team complete the entire first product proof on one build.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-001`, `REQ-009`, `REQ-021`, `REQ-024`, `REQ-027`, `REQ-035`, `REQ-041`, `REQ-043`, `REQ-053`, `REQ-064`, `INV-002`, `INV-003`, `INV-004`, `INV-005`, `INV-017`, `INV-021`, `INV-022`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-001`, `REQ-009`, `REQ-021`, `REQ-024`, `REQ-027`, `REQ-035`, `REQ-041`, `REQ-043`, `REQ-053`, `REQ-064`, `INV-002`, `INV-003`, `INV-004`, `INV-005`, `INV-017`, `INV-021`, `INV-022`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 8
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap section 12
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-42
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-43

Observed source evidence:

- docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md
- references/plenum-runtime-slice/test/smoke.mjs

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `OPEN-001`, `ADR-001`, `ADR-002`, `ADR-003`, `ADR-004`.

## Prerequisites

Task prerequisites: `PS-200`, `PS-210`, `PS-230`, `PS-240`, `PS-250`, `PS-300`, `PS-310`, `PS-320`, `PS-330`, `PS-340`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Every prerequisite evidence record
- AC-01 to AC-13 fixture definitions
- Known unresolved approval gates

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- One deterministic end-to-end Session
- Positive and negative flows
- Evidence and structured export reconciliation
- Poll, push-to-talk Voice Channel, and two-model composition as Phase 3 exit proof

Expected paths are discovery targets, not permission to invent absent structure:

- tests/e2e/first-proof/
- test-results/first-proof/
- docs/acceptance/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Use real browser actors and PostgreSQL
- Exercise network loss and duplicate retry
- Compare export to canonical records
- Record blocked AC-09 separately if needed

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Include unauthorized and cross-tenant denial
- Inspect browser and server logs for protected data
- Use synthetic fixtures

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Exercise duplicate retry, queued reconnect, and conflicting adjudication
- Pin Release and adapter digests
- Use deterministic clocks and seeds

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not claim full production readiness
- Do not waive failed gates
- Do not claim AC-09 without verified parity evidence

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then aC-01 through AC-13 each has actual behavior and evidence
- Given the documented preconditions, when the task behavior is exercised, then failures block completion and name the owning task
- Given the documented preconditions, when the task behavior is exercised, then export reconciles to canonical records
- Given the documented preconditions, when the task behavior is exercised, then no application-built claim exceeds evidence

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- AC-01 to AC-13 evidence bundle
- Defect ledger
- Phase 3 readiness decision

## Tests

Required test/evidence IDs: `AC-01`, `AC-02`, `AC-03`, `AC-04`, `AC-05`, `AC-06`, `AC-07`, `AC-08`, `AC-09`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`, `CMD-PARITY`, `CMD-PROMPTBOOK-VALIDATE`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- All narrow prerequisite suites remain green
- Browser states are inspected
- No unresolved critical defect is waived implicitly

The approval gate is: Phase exit needs objective evidence and owner confirmation; AC-09 needs passing evidence against the official snapshot. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update RELEASE_READINESS.md and PROJECT_STATE.md
- Attach evidence index
- Record owner risk acceptance explicitly

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-350-first-product-proof`
- Proposed subject: `test(e2e): prove first product journey`
- Expected migrations: none
- Expected API/contract IDs: `first-proof-e2e-v1`

Proposed body:

```text
Why:
- Demonstrate the first release journey across real boundaries.
What:
- Add AC-01 to AC-13 E2E evidence.
Verification:
- Full first-proof and accessibility lanes.
Compatibility / migrations:
- None.
Risks / follow-up:
- This is not production approval.
Refs: PS-350, AC-01, AC-13
```

Proposed PR description:

Summary: adds integrated first-proof evidence. Risks: broad failure surface. Migration: none. Evidence: AC bundle. Rollback: tests and fixtures only; do not suppress failures.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Any prerequisite behavior changes; Golden reference changes; Acceptance criteria change.
