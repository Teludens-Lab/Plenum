# PS-530 - Package cloud, institutional, and air-gapped profiles

## ID / title / goal / user outcome / risk

- ID: `PS-530`
- Title: Package cloud, institutional, and air-gapped profiles
- Goal: Run one image set across all three profiles with local identity, storage, media, Plugins, backup, and restore.
- User outcome: An institution can install, operate, back up, restore, and verify Plenum without a public network dependency.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-005`, `REQ-023`, `REQ-051`, `REQ-065`, `REQ-066`, `REQ-067`, `REQ-068`, `REQ-069`, `REQ-083`, `REQ-084`, `REQ-090`, `INV-027`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-005`, `REQ-023`, `REQ-051`, `REQ-065`, `REQ-066`, `REQ-067`, `REQ-068`, `REQ-069`, `REQ-083`, `REQ-084`, `REQ-090`, `INV-027`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform section 5
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 19, 22, 24
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap Phase 5
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-013

Observed source evidence:

- references/plenum-runtime-slice/docker-compose.yml

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-009`, `ADR-011`, `ADR-012`, `ADR-013`, `ADR-017`, `OPEN-020`, `OPEN-027`, `OPEN-029`.

## Prerequisites

Task prerequisites: `PS-220`, `PS-250`, `PS-500`, `PS-510`, `PS-520`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- All runtime dependencies and images
- Profile-specific configuration
- Offline dependency and trust closure
- Backup consistency requirements

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- OCI image set
- Compose/Podman reference profile
- Bundled PostgreSQL, Keycloak, object storage, media/TURN, Extension Host
- Air-gap network-deny lane
- Backup and restore drill
- Operator runbooks

Expected paths are discovery targets, not permission to invent absent structure:

- deploy/compose/
- deploy/offline-bundle/
- docs/operations/
- tests/deployment/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Use one build with configuration differences
- Validate no outbound request
- Bundle dependency closure and checksums
- Restore database and objects consistently
- Verify evidence chain after restore
- Meet RPO ≤15 minutes and RTO ≤4 hours in the isolated recovery drill
- Run recovery drills quarterly and before each major production release

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Use local identity and institution trust roots
- Keep secrets environment-scoped
- Restrict backup and restore access

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Pin every image and artifact digest
- Coordinate migrations with app version
- Restore into disposable environment
- Record forward-fix path

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not require Kubernetes
- Do not purchase services
- Do not claim accreditation
- Do not perform destructive production restore

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then same image digests run in all profiles
- Given the documented preconditions, when the task behavior is exercised, then air-gap Session completes with zero public egress
- Given the documented preconditions, when the task behavior is exercised, then external-required Plugin is blocked without local replacement
- Given the documented preconditions, when the task behavior is exercised, then restore preserves Releases, objects, sequences, and proofs
- Given the documented preconditions, when the task behavior is exercised, then dead letter has visible recovery action
- Given the documented preconditions, when the task behavior is exercised, then isolated restore meets RPO ≤15 minutes and RTO ≤4 hours

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Three deployment profiles
- Offline bundle
- Backup/restore scripts and evidence
- Health and dead-letter recovery views

## Tests

Required test/evidence IDs: `EXT-03`, `EXT-04`, `EXT-05`, `VOTE-12`, `VOICE-06`, `PS-530-T01`, `PS-530-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-DEPLOYMENT-SMOKE`, `CMD-AIRGAP`, `CMD-BACKUP-RESTORE`, `CMD-EVIDENCE-VERIFY`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- No mandatory cloud control plane
- Signing gaps remain explicit
- No production data is used in drills

The approval gate is: Production deployment requires evidence for the resolved OPEN-014/017 key, signing and recovery policy; unresolved consent and trust policies remain blockers. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update DEPLOYMENT_PROFILES.md and recovery matrix
- Update RELEASE_READINESS.md and PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-530-deployment-profiles-airgap-and-recovery`
- Proposed subject: `feat(deploy): package disconnected deployment profiles`
- Expected migrations: none
- Expected API/contract IDs: `deployment-manifest-v1`, `backup-manifest-v1`

Proposed body:

```text
Why:
- Run one product in hosted and disconnected environments.
What:
- Add profile packaging, air-gap lane, and restore drills.
Verification:
- Deployment smoke, network deny, backup/restore, evidence verify.
Compatibility / migrations:
- Rehearses all migrations.
Risks / follow-up:
- Resolved key and recovery policy still needs production evidence; unrelated consent/trust gates remain open.
Refs: PS-530, REQ-005, ADR-013
```

Proposed PR description:

Summary: packages three deployment profiles. Risks: offline dependency gaps and recovery inconsistency. Migration: rehearses full chain. Evidence: no-egress and restore logs. Rollback: redeploy prior images; forward-fix data.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Any deployment ADR changes; A dependency gains an Internet requirement; The approved RPO/RTO changes.
