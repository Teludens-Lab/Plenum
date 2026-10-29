# PS-790 - Complete administration, reporting, replay, archive, and Plugin operations

## ID / title / goal / user outcome / risk

- ID: `PS-790`
- Title: Complete administration, reporting, replay, archive, and Plugin operations
- Goal: Expose every remaining operational backend capability through least-privilege, comprehensible interfaces.
- User outcome: Admins, Publishers, Reviewers, Research Analysts and Operators can perform their complete jobs without command-line tools or direct database access.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-023`, `REQ-038`, `REQ-042`, `REQ-052`, `REQ-054`, `REQ-055`, `REQ-056`, `REQ-058`, `REQ-059`, `REQ-060`, `REQ-061`, `REQ-062`, `REQ-068`, `REQ-086`, `INV-016`, `INV-020`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-023`, `REQ-038`, `REQ-042`, `REQ-052`, `REQ-054`, `REQ-055`, `REQ-056`, `REQ-058`, `REQ-059`, `REQ-060`, `REQ-061`, `REQ-062`, `REQ-068`, `REQ-086`, `INV-016`, `INV-020`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 9 through 23
- `docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md` — 10 Extension Framework (entire current document)
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime sections 15, 17 and 21
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

Task prerequisites: `PS-780`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Reporting, replay and evidence services
- Retention/legal-hold APIs
- Plugin registry and trust services
- Role boundaries from DEC-61
- Current basic PDF/ZIP output

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Organization member and role administration
- Plugin publisher/trust/revocation/license/install operations
- Report builder, generation, download and trace inspection
- Replay/divergence and captured-history views
- Archive, retention, legal hold, correction and portable export/import

Expected paths are discovery targets, not permission to invent absent structure:

- apps/platform-web/
- apps/server/src/reporting/
- apps/server/src/replay/
- apps/server/src/evidence/
- apps/server/src/extensions/
- apps/server/migrations/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Build task-specific administrative workspaces with explicit role boundaries
- Provide professional multi-page report rendering and source trace navigation
- Expose replay differences, archive status and retention consequences
- Complete Plugin lifecycle administration with digest and provenance visibility

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

- Do not expose identity mappings to Research Analysts
- Do not invent production trust approval
- Do not present reconstructed narrative as transcript
- Do not require the optional post-release PS-600 catalog expansion to complete core Plugin administration

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every Organization Role can complete its defined job and is denied every other role's privileged job
- Given the documented preconditions, when the task behavior is exercised, then reports are readable, multi-page where needed, traceable and portable
- Given the documented preconditions, when the task behavior is exercised, then replay distinguishes captured history from reconstructed narrative and reports divergence
- Given the documented preconditions, when the task behavior is exercised, then a Plugin can move through approved lifecycle operations without CLI or SQL

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Administration center
- Reporting and replay workspaces
- Archive/retention UI
- Plugin operations center
- Role-based user-test scripts

## Tests

Required test/evidence IDs: `PS-790-T01`, `PS-790-T02`, `PS-520-T01`, `EXT-01`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-REPORT-RECONCILE`, `CMD-EVIDENCE-VERIFY`, `CMD-AIRGAP`, `CMD-GAP-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Legal holds continue preventing purge
- Evidence verification remains independent
- Removed Plugins preserve historical provenance
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the catalog Plenum dark/light wordmarks are used as platform branding; simulation content cannot replace platform identity

The approval gate is: Change-level acceptance requires passing automated evidence and a completed user-test script; production approval remains separate.. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-790-complete-administration-reporting-plugin-operations`
- Proposed subject: `feat(operations): expose admin and reporting workflows`
- Expected migrations: `032_operations_administration`
- Expected API/contract IDs: `operations-admin-v1`, `report-delivery-v1`

Proposed body:

```text
Why:
- Expose every remaining operational backend capability through least-privilege, comprehensible interfaces.
What:
- Admins, Publishers, Reviewers, Research Analysts and Operators can perform their complete jobs without command-line tools or direct database access.
Verification:
- Run the listed automated gates and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-790, REQ-023, REQ-038, REQ-042
```

Proposed PR description:

Summary: Admins, Publishers, Reviewers, Research Analysts and Operators can perform their complete jobs without command-line tools or direct database access. Risks: high workflow and authorization regressions. Migration: 032_operations_administration. Evidence: automated checks, screenshots, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
