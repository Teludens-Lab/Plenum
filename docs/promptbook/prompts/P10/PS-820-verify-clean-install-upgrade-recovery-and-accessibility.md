# PS-820 - Verify clean install, upgrade, recovery, and human accessibility

## ID / title / goal / user outcome / risk

- ID: `PS-820`
- Title: Verify clean install, upgrade, recovery, and human accessibility
- Goal: Close the remaining deployment, recovery, device, and human accessibility evidence gaps on supported profiles.
- User outcome: An institution can install, operate, upgrade, recover and access Plenum using documented procedures and supported assistive technology.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-005`, `REQ-008`, `REQ-023`, `REQ-064`, `REQ-065`, `REQ-066`, `REQ-067`, `REQ-069`, `REQ-090`, `INV-027`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-005`, `REQ-008`, `REQ-023`, `REQ-064`, `REQ-065`, `REQ-066`, `REQ-067`, `REQ-069`, `REQ-090`, `INV-027`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform section 5
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 17 and 18
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap section 15
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register OPEN-014
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register OPEN-017
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register sections 3, 5.7 and 7.1 through 7.5

Observed source evidence:

- apps/studio/src/App.tsx
- apps/runtime-web/src/App.tsx
- apps/server/src/http/runtime-http.ts

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-815`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Three deployment profiles and offline bundle
- Migration and forward-fix runbooks
- Backup/restore and signer custody
- Manual accessibility report gaps
- Managed-device offline policy
- Read APPROVAL_IMPLEMENTATION_PROMPTBOOK.md for the remaining-sequence ownership, checkpoint and exact-candidate evidence rules; tasks.json remains the task source of truth
- Decision Register v1.0.16 resolves OPEN-004/010/016/023 and the prior assumptions; approval is not implementation evidence and never waives PS-810, provider, mail, accessibility or named human gates
- Use supported Windows/macOS desktop browsers at the declared minimum 1024 x 768 and equivalent 200% zoom, keyboard, pointer, forced colors, reduced motion and named desktop AT; mobile/touch acceptance remains approved N/A
- Inventory existing uncommitted work and prior evidence before changes; preserve unrelated work and distinguish local source, committed candidate and deployed staging digests
- Before provisioning disposable databases/containers, check disk capacity and record exact task-owned resource identifiers; reuse safely where possible, clean up only authorized task-owned resources, and never run broad volume/image pruning

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Clean install for cloud-reference, institutional and air-gapped profiles
- Upgrade from prior signed image/schema and code rollback/forward-fix
- Institution-owned backup, restore, anchor and custody drill
- Managed-device offline accreditation
- NVDA, JAWS or VoiceOver and keyboard user review

Expected paths are discovery targets, not permission to invent absent structure:

- deploy/
- scripts/
- docs/operations/
- docs/release-evidence/
- tests/deployment/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Resume the existing PS-820 evidence and owner-authorized PS-815 exception; identify applicable migration and image deltas before rerunning. Record qualified desktop/AT reviews and institutional approval as NOT RUN until actually completed
- Automate a disposable clean-install and versioned upgrade rehearsal
- Execute restore and Evidence verification with separated custody
- Record manual task-based accessibility results and fix blockers
- Validate offline-device expiry, revocation and data clearing on an approved managed-device profile
- After PS-830 form/schema changes and PS-845 transfer changes, repeat affected empty-install, prior-version upgrade, historical-record preservation, rollback compatibility and restore checks on the final candidate; reuse the harness rather than creating another installation path

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

- Do not run destructive production operations without explicit authorization
- Do not claim all assistive technologies from one review
- Do not claim live authority-transfer readiness from backup/restore tests; PS-845 owns resolved OPEN-016 implementation and timed transfer evidence

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then a clean supported installation reaches the product shell without manual database editing
- Given the documented preconditions, when the task behavior is exercised, then a prior supported version upgrades without losing Releases, Sessions, evidence or objects
- Given the documented preconditions, when the task behavior is exercised, then restore meets approved objectives and independently verifies evidence
- Given the documented preconditions, when the task behavior is exercised, then qualified manual accessibility review has no unresolved task-blocking defect
- Given the documented preconditions, when the task behavior is exercised, then historical Releases, submitted forms and Sessions remain readable after the approved capability changes; incompatible contracts fail explicitly and are not silently upgraded

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Clean-install evidence
- Upgrade and forward-fix evidence
- Institutional recovery package
- Manual accessibility report
- Operations user-test script

## Tests

Required test/evidence IDs: `PS-820-T01`, `PS-820-T02`, `PS-530-T01`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-CLEAN-INSTALL`, `CMD-DEPLOYMENT-SMOKE`, `CMD-AIRGAP`, `CMD-BACKUP-RESTORE`, `CMD-EVIDENCE-VERIFY`, `CMD-PLATFORM-A11Y`, `CMD-GAP-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Production targets remain protected by refusal guards
- Offline bundles make no public-network request
- Schema rollback is never assumed safe

The approval gate is: Preserve historical AUTOMATED PASS and HUMAN NOT RUN separately. Re-verify automated installation prerequisites for a new working candidate before PS-830 execution; human/AT acceptance remains mandatory for task completion and PS-850. The recorded PS-815 exception is not a blanket release waiver. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed
- Update APPROVAL_IMPLEMENTATION_PROMPTBOOK.md only for execution/evidence links; preserve the task source and approval boundaries
- Record source/image/lockfile/schema/configuration/Release and environment identity; a changed candidate requires impact assessment and affected gate reruns, not copied PASS labels
- Return a checkpoint handoff with completed behavior, exact evidence, unresolved dependencies, candidate identity and the next safe step; do not collapse partial/internal/automated/human/final acceptance into one PASS

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-820-verify-clean-install-upgrade-recovery-and-accessibility`
- Proposed subject: `test(release): verify install recovery and accessibility`
- Expected migrations: none
- Expected API/contract IDs: `clean-install-evidence-v1`, `institutional-acceptance-v1`

Proposed body:

```text
Why:
- Close the remaining deployment, recovery, device, and human accessibility evidence gaps on supported profiles.
What:
- An institution can install, operate, upgrade, recover and access Plenum using documented procedures and supported assistive technology.
Verification:
- Run the listed automated gates and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-820, REQ-005, REQ-008, REQ-023
```

Proposed PR description:

Summary: An institution can install, operate, upgrade, recover and access Plenum using documented procedures and supported assistive technology. Risks: high workflow and authorization regressions. Migration: none. Evidence: automated checks, screenshots, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.
