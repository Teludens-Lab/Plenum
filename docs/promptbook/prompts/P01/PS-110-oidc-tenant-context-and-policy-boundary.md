# PS-110 - Resolve OIDC identity, tenant context, and policy denial

## ID / title / goal / user outcome / risk

- ID: `PS-110`
- Title: Resolve OIDC identity, tenant context, and policy denial
- Goal: Replace demo identity with server-derived OIDC context and prove tenant and Session policy isolation.
- User outcome: People authenticate once and receive only resources and fields authorized for their Organization and Session context.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-045`, `REQ-046`, `REQ-047`, `REQ-048`, `REQ-049`, `REQ-050`, `REQ-051`, `REQ-052`, `INV-001`, `INV-002`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-045`, `REQ-046`, `REQ-047`, `REQ-048`, `REQ-049`, `REQ-050`, `REQ-051`, `REQ-052`, `INV-001`, `INV-002`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform sections 8, 9, 20, 21
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 5-9 and 19
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-006
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-012
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-015

Observed source evidence:

- references/plenum-runtime-slice/src/db.mjs
- references/plenum-runtime-slice/migrations/004_security.sql

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-100`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Existing auth headers and RLS setup
- Session Access Context contract
- Keycloak/OIDC adapter boundary

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- OIDC relying-party login and local test issuer
- Server-derived Organization and Principal context
- Session Access Context resolver
- Policy denial and filtered projections
- Transactional Seat reassignment

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/identity/
- packages/policy-engine/
- apps/server/test/identity/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Validate issuer, audience, expiry, and subject
- Map identity to memberships server-side
- Set tenant DB context per transaction
- Return TARGET_NOT_FOUND for invisible resources
- Emit Audit Records for privileged changes

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Test cross-tenant read/write under the real app role and pooled connections
- Omit unauthorized fields server-side
- Keep Audit Records unreadable by Participants

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Make reassignment atomic
- Invalidate active projections and credentials after revocation
- Version policy decisions used in projections

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not implement SAML directly in the application
- Do not create new Organization Roles
- Do not trust client organization or role claims

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then hostile organization IDs never change server context
- Given the documented preconditions, when the task behavior is exercised, then cross-tenant and hidden-field tests fail closed
- Given the documented preconditions, when the task behavior is exercised, then seat reassignment preserves attribution and refreshes access

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- OIDC adapter
- Context resolver
- Policy engine slice
- Negative tenant and field-leak tests

## Tests

Required test/evidence IDs: `DB-01`, `PS-110-T01`, `PS-110-T02`, `PS-110-T03`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- RLS remains defense in depth
- Demo identity remains confined to the retained reference slice
- No raw claims reach domain authorization

The approval gate is: ADR-012 Security Owner sign-off completed 2026-10-21; production profile evidence remains required. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update OpenAPI security schemes
- Record threat decisions
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-110-oidc-tenant-context-and-policy-boundary`
- Proposed subject: `feat(identity): enforce OIDC tenant context`
- Expected migrations: `005_identity_oidc_context`
- Expected API/contract IDs: `session-access-context-v1`, `oidc-callback-v1`

Proposed body:

```text
Why:
- Replace demo headers with trusted identity context.
What:
- Add OIDC, Session Access Context, and tenant policy enforcement.
Verification:
- Identity, RLS, denial, and reassignment tests.
Compatibility / migrations:
- Adds 005 identity context tables.
Risks / follow-up:
- Production deployment profiles remain PS-530 work.
Refs: PS-110, REQ-045, ADR-015
```

Proposed PR description:

Summary: establishes trusted identity and tenant isolation. Risks: auth boundary changes. Migration: 005. Evidence: denial matrix. Rollback: disable new routes and restore prior nonproduction adapter only.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: ADR-012 or ADR-015 changes; DEC-61 role implementation begins; Production identity profile work begins.
