# PS-100 - Establish the TypeScript monorepo and contract kernel

## ID / title / goal / user outcome / risk

- ID: `PS-100`
- Title: Establish the TypeScript monorepo and contract kernel
- Goal: Create the smallest buildable monorepo skeleton with shared canonical contracts beside the retained slice.
- User outcome: Frontend and server code share one typed vocabulary and one verified build path.
- Risk: **MEDIUM**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-070`, `REQ-071`, `INV-019`, `INV-022`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-070`, `REQ-071`, `INV-019`, `INV-022`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform v1.3.1 sections 4 and 23
- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema v1.3.1 (entire current document)
- `docs/corpus/02_Updated_Architecture/09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md` — 09 Contracts v1.3.1 (entire current document)
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-007
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-008

Observed source evidence:

- references/plenum-runtime-slice/contracts/openapi.yaml
- references/plenum-runtime-slice/package-lock.json

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `ADR-008`, `OPEN-012`, `OPEN-022`.

## Prerequisites

Task prerequisites: `PS-001`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Reference slice public API and domain exports
- Platform section 4 target layout
- Existing repository package manager and lockfiles

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Create apps/server and only the packages needed by the next slice
- Create shared event and simulation contract packages
- Add deterministic lint, typecheck, test, and build scripts

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/
- packages/simulation-schema/
- packages/event-contracts/
- references/plenum-runtime-slice/
- package.json

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Move or copy the slice to reference without behavior change
- Define explicit public package exports
- Add contract lint for Glossary names and DEC-38 naming
- Pin versions from the resulting lockfile

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- No demo header code enters production apps
- No secrets or tenant IDs in shared contracts

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Version contract packages
- Keep command and event schema versions explicit
- Preserve historical slice OpenAPI unchanged

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not create every future package
- Do not remove or rewrite the vanilla slice
- Do not select unresolved engines beyond the task need

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then a clean checkout installs from one lockfile and runs all created commands
- Given the documented preconditions, when the task behavior is exercised, then shared contracts compile for server and one frontend consumer
- Given the documented preconditions, when the task behavior is exercised, then reference slice remains runnable and unchanged in behavior

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Buildable monorepo
- Shared contract packages
- CI command scripts
- Reference slice retained

## Tests

Required test/evidence IDs: `PS-100-T01`, `PS-100-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-BUILD`, `CMD-PROMPTBOOK-VALIDATE`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- No circular package dependencies
- No simulation-specific names in platform packages
- Glossary lint passes

The approval gate is: Technical Lead approval before treating ADR-008 as ratified. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Record chosen versions in TECHNOLOGY_DECISION_MATRIX.md
- Update REPO_TOPOLOGY.md and COMMAND_REGISTRY.md
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-100-establish-monorepo-contract-kernel`
- Proposed subject: `build(platform): establish shared contract monorepo`
- Expected migrations: none
- Expected API/contract IDs: `command-envelope-v1`, `event-envelope-v1`, `error-envelope-v1`

Proposed body:

```text
Why:
- Share canonical contracts without replacing the spike.
What:
- Add the minimum monorepo, contract packages, and build commands.
Verification:
- Lint, typecheck, test, and build.
Compatibility / migrations:
- No data migration.
Risks / follow-up:
- ADR-008 remains Proposed.
Refs: PS-100, REQ-070, ADR-008
```

Proposed PR description:

Summary: creates the shared TypeScript kernel. Risks: toolchain choice is Proposed. Migration: none. Evidence: clean build. Rollback: remove new workspace files and keep the reference slice.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: ADR-008 changes; OPEN-012 compatibility policy resolves; A second deployable becomes justified.
