# PS-760 - Complete access, research, validation, publication, and live-change workspaces

## ID / title / goal / user outcome / risk

- ID: `PS-760`
- Title: Complete access, research, validation, publication, and live-change workspaces
- Goal: Finish the remaining Studio specification and turn validation into an operable simulation rehearsal and publication process.
- User outcome: Designers and Reviewers can configure access, interfaces, research, measurements and reports; rehearse the Release; resolve every issue; approve, publish and prepare live changes.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: true`.

## Requirements and invariants

Product IDs: `REQ-001`, `REQ-010`, `REQ-011`, `REQ-018`, `REQ-019`, `REQ-020`, `REQ-022`, `REQ-041`, `REQ-054`, `REQ-057`, `INV-006`, `INV-009`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-001`, `REQ-010`, `REQ-011`, `REQ-018`, `REQ-019`, `REQ-020`, `REQ-022`, `REQ-041`, `REQ-054`, `REQ-057`, `INV-006`, `INV-009`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 18 through 24
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 13 through 15
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register OPEN-013
- `references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md` — Teludens Design Language sections 0 through 13
- `references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md` — Teludens Spatial Grammar sections 1 through 14
- `references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md` — Teludens Experience Physics sections 1 through 15
- `references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md` — Teludens Reference Slice sections 1 through 20

Observed source evidence:

- apps/studio/src/App.tsx
- apps/runtime-web/src/App.tsx
- apps/server/src/http/runtime-http.ts
- references/teludens-design-system-catalog/README.md
- references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md
- references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md
- references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md
- references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md
- references/teludens-design-system-catalog/docs/TELUDENS_TOKENS.json
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Dark.png
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Light.png

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-750`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Interface and access editors
- Research traceability and reporting services
- Validation engine issue catalog
- Publication freeze/approval and live activation UI

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Interface profiles and access previews
- Seat planning, roster import review, lobby and readiness design
- Research questions, uncertainty, measurements and reports
- Role walkthrough and deterministic rehearsal
- Review, publish, Templates and live-change impact

Expected paths are discovery targets, not permission to invent absent structure:

- apps/studio/src/
- apps/server/src/studio/
- apps/server/src/reporting/
- packages/validation-engine/
- packages/release-compiler/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Implement every remaining Studio navigation workspace
- Create role/stage/access walkthroughs and deterministic trigger rehearsal with why/why-not traces
- Complete research/measurement/report authoring and previews
- Add governed review, acknowledgement, approval, Template publication and live-change impact flows

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Reuse the existing trusted OIDC, Organization Role, Session Role, Seat and RLS boundaries
- Return only server-authorized data and test cross-Organization, cross-Session and revoked access
- Enforce resolved OPEN-013 at the trusted server boundary: a production author cannot approve the exact freeze, Admin alone cannot approve methodology, and sandbox self-approval is visibly non-production
- Use synthetic test identities and never expose secrets or protected content in screenshots or logs

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Preserve idempotent Commands, immutable Releases and Governing Release pins
- Make persistent mutations transactional and version-aware
- Test duplicate, stale, interrupted and concurrent user actions

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not self-approve methodology or accessibility review
- Do not hide warnings or fabricate rehearsal outcomes
- Do not permit unsafe in-place live migration

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every Studio section 3-27 has a reachable, complete and tested workspace
- Given the documented preconditions, when the task behavior is exercised, then a Designer completes a deterministic rehearsal and receives explanations for every evaluated trigger
- Given the documented preconditions, when the task behavior is exercised, then a Reviewer can resolve linked issues and approve an exact freeze
- Given the documented preconditions, when the task behavior is exercised, then production rejects author self-approval and Admin-only methodology approval while permitting a Reviewer and Publisher to be the same non-author
- Given the documented preconditions, when the task behavior is exercised, then a material content change invalidates approval and requires review of the new exact digest
- Given the documented preconditions, when the task behavior is exercised, then published Template and Release versions remain immutable with attributable supersession, deprecation and archival history
- Given the documented preconditions, when the task behavior is exercised, then consequential live activation requires a fresh distinct-author Reviewer approval; disruptive change requires a new Session
- Given the documented preconditions, when the task behavior is exercised, then approvals, publications and activations record actor, active roles, policy version, artifact digest, evidence, rationale and timestamp
- Given the documented preconditions, when the task behavior is exercised, then a published Release is created without raw JSON, SQL, UUID pasting or test fixture intervention

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Specification-complete Studio
- Role walkthrough and rehearsal
- Research/report designers
- Review/publication/live-change user-test script

## Tests

Required test/evidence IDs: `PS-760-T01`, `PS-760-T02`, `AC-02`, `AC-07`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-GENERALIZATION`, `CMD-GAP-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Post-freeze edits remain in the next Draft
- Production two-person integrity remains enforced by person and exact artifact digest rather than role label alone
- Role previews and Runtime projections remain identical
- Live activation preserves in-flight governing Releases
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the catalog Plenum dark/light wordmarks are used as platform branding; simulation content cannot replace platform identity

The approval gate is: Change-level acceptance requires passing automated evidence and a completed user-test script; production approval remains separate.. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-760-complete-access-research-validation-publication-workspaces`
- Proposed subject: `feat(studio): finish rehearsal and publication`
- Expected migrations: `030_template_review_governance`
- Expected API/contract IDs: `studio-rehearsal-v1`, `publication-review-v1`

Proposed body:

```text
Why:
- Finish the remaining Studio specification and turn validation into an operable simulation rehearsal and publication process.
What:
- Designers and Reviewers can configure access, interfaces, research, measurements and reports; rehearse the Release; resolve every issue; approve, publish and prepare live changes.
Verification:
- Run the listed automated gates and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-760, REQ-001, REQ-010, REQ-011
```

Proposed PR description:

Summary: Designers and Reviewers can configure access, interfaces, research, measurements and reports; rehearse the Release; resolve every issue; approve, publish and prepare live changes. Risks: high workflow and authorization regressions. Migration: 030_template_review_governance. Evidence: automated checks, screenshots, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
