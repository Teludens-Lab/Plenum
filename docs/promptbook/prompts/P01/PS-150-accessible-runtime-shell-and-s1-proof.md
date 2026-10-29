# PS-150 - Ship the accessible Runtime shell and S1 proof

## ID / title / goal / user outcome / risk

- ID: `PS-150`
- Title: Ship the accessible Runtime shell and S1 proof
- Goal: Render the preserved artifact workflow through React and prove the Phase 1 authority slice end to end.
- User outcome: Participants and operators can complete the configured handoff with clear loading, denial, reconnect, and error states.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-024`, `REQ-025`, `REQ-027`, `REQ-028`, `REQ-032`, `REQ-063`, `REQ-064`, `INV-003`, `INV-004`, `INV-022`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-024`, `REQ-025`, `REQ-027`, `REQ-028`, `REQ-032`, `REQ-063`, `REQ-064`, `INV-003`, `INV-004`, `INV-022`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 8
- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio section 18
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime sections 2, 7, 8, 14
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data section 20

Observed source evidence:

- references/plenum-runtime-slice/public/index.html
- references/plenum-runtime-slice/test/smoke.mjs

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-007`, `ADR-008`.

## Prerequisites

Task prerequisites: `PS-120`, `PS-140`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Reference workstation semantics
- React candidate stack actually pinned by PS-100
- Module and Interface Profile contracts

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Runtime application shell
- Artifact form and task list
- Role- and Stage-derived modules
- Operator visibility for the S1 path
- Accessible status and reconnect handling

Expected paths are discovery targets, not permission to invent absent structure:

- apps/runtime-web/
- apps/operator-console/
- packages/form-renderer/
- packages/design-system/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Render from Release data
- Handle loading, empty, error, stale, offline, and retry states
- Use semantic forms and focus management
- Keep operator controls reasoned and evidenced

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Render only server-filtered projections
- Never infer permission from route or UI state
- Test unauthorized direct requests

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Show receipt state separately from local state
- Use stable aggregate versions
- Retry with the same Command ID only after receipt lookup

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not build Studio editors
- Do not hard-code Scribe, Facilitator, or White Cell in components
- Do not add visual novelty outside S1

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then the DEC-42 flow and forbidden paths work without named-role branches
- Given the documented preconditions, when the task behavior is exercised, then keyboard and screen-reader operation covers the reference screens
- Given the documented preconditions, when the task behavior is exercised, then lost acknowledgement and stale-version states remain truthful
- Given the documented preconditions, when the task behavior is exercised, then operator view matches authoritative state

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- React Runtime shell
- Configured artifact workflow UI
- Operator S1 view
- Browser and accessibility evidence

## Tests

Required test/evidence IDs: `AC-03`, `AC-04`, `AC-05`, `AC-06`, `AC-08`, `AC-10`, `AC-12`, `AC-13`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Reference slice parity tests remain green
- No protected payload appears before server authorization
- Responsive width, height, zoom, and long text are inspected

The approval gate is: Accessibility evidence is required before Phase 1 exit. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update Interface Profile examples
- Attach browser evidence
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-150-accessible-runtime-shell-and-s1-proof`
- Proposed subject: `feat(runtime-web): deliver configured S1 workflow`
- Expected migrations: none
- Expected API/contract IDs: `artifact-command-v1`, `runtime-projection-v1`

Proposed body:

```text
Why:
- Prove the authority slice through a usable interface.
What:
- Add Runtime and operator shells for the configured artifact flow.
Verification:
- Browser, accessibility, and S1 tests.
Compatibility / migrations:
- None.
Risks / follow-up:
- Studio remains Phase 3.
Refs: PS-150, AC-04, REQ-064
```

Proposed PR description:

Summary: delivers the S1 user flow. Risks: accessibility and projection drift. Migration: none. Evidence: E2E and rendered states. Rollback: retain reference workstation route.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Interface Profile contract changes; Accessibility defects are found; A second Runtime surface duplicates logic.
