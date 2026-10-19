# PS-430 - Pass the two-simulation generalization gate

## ID / title / goal / user outcome / risk

- ID: `PS-430`
- Title: Pass the two-simulation generalization gate
- Goal: Run policy-negotiation and crisis-response designs without Runtime code changes.
- User outcome: The platform demonstrates that its engines are generic beyond Fractured Order.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-020`, `REQ-024`, `REQ-071`, `INV-019`, `INV-022`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-020`, `REQ-024`, `REQ-071`, `INV-019`, `INV-022`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap section 14
- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD REQ-024
- `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` — 08 Canon section 12

Observed source evidence:

- docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `OPEN-004`, `OPEN-005`, `OPEN-006`.

## Prerequisites

Task prerequisites: `PS-400`, `PS-410`, `PS-420`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Generalization exit criteria
- Runtime source diff baseline
- Validation simulation fixtures

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Author two materially different Releases
- Run deterministic Sessions
- Prove no Runtime source edits
- Record any schema or engine gaps

Expected paths are discovery targets, not permission to invent absent structure:

- definitions/validation/policy-negotiation/
- definitions/validation/crisis-response/
- tests/e2e/generalization/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Use Studio only for authored changes
- Hash Runtime source before and after
- Exercise communication-heavy and state-heavy designs
- Route missing semantics to OPEN candidates

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Use synthetic Participants and content
- Include policy-leak negative cases
- Keep fixtures tenant-isolated

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Pin each Release and seed
- Repeat runs to compare trace
- Record nondeterministic adapter exclusions

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not tailor Runtime to either fixture
- Do not treat synthetic results as research findings
- Do not broaden product scope

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then both simulations complete on the same Runtime build
- Given the documented preconditions, when the task behavior is exercised, then no Runtime source file changes between fixtures
- Given the documented preconditions, when the task behavior is exercised, then differences are Release configuration
- Given the documented preconditions, when the task behavior is exercised, then unresolved semantics are not guessed

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Two validation Releases
- Source-change assertion
- Generalization evidence report

## Tests

Required test/evidence IDs: `PS-430-T01`, `PS-430-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-E2E`, `CMD-GENERALIZATION`, `CMD-PROMPTBOOK-VALIDATE`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- First-proof suite remains green
- Glossary lint passes
- Fixtures contain no production data

The approval gate is: Methodology Lead reviews any new semantic gap. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update validation simulation report
- Update COVERAGE_AND_QUALITY_REPORT.md and PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `fix/ps-430-generalization-gate`
- Proposed subject: `test(platform): prove simulation generality`
- Expected migrations: none
- Expected API/contract IDs: `validation-simulation-v1`

Proposed body:

```text
Why:
- Demonstrate the Runtime is not Fractured Order-specific.
What:
- Add two contrasting validation simulations and evidence.
Verification:
- Generalization E2E with source hash assertion.
Compatibility / migrations:
- None.
Risks / follow-up:
- Methodology gaps become OPEN candidates.
Refs: PS-430, REQ-024, INV-022
```

Proposed PR description:

Summary: proves generic execution. Risks: fixture-specific leakage. Migration: none. Evidence: two complete Sessions and source hashes. Rollback: fixtures only.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Runtime source changes materially; Canon adds a mandatory concept; Validation fixture requirements change.
