# PS-815 - Prove Platform Control Plane identity and workforce production acceptance

## ID / title / goal / user outcome / risk

- ID: `PS-815`
- Title: Prove Platform Control Plane identity and workforce production acceptance
- Goal: Close the real-provider, delivery, recovery and human acceptance gates for governed Organization identity and workforce operations.
- User outcome: Organizations can authenticate and provision their workforce through supported identity providers while operators can detect, retry, reconcile and recover failures without database intervention or silent access changes.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-045`, `REQ-047`, `REQ-051`, `REQ-052`, `REQ-064`, `REQ-066`, `REQ-067`, `INV-001`, `INV-002`, `INV-015`, `INV-019`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-045`, `REQ-047`, `REQ-051`, `REQ-052`, `REQ-064`, `REQ-066`, `REQ-067`, `INV-001`, `INV-002`, `INV-015`, `INV-019`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform sections 8, 9, 20, 21 and 22
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 5 through 9 and 16 through 19
- `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` — 07 Roadmap sections 13 and 15
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-012
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-015

Observed source evidence:

- apps/server/src/identity/organization-providers.ts
- apps/server/src/identity/organization-workforce.ts
- apps/server/src/platform/
- apps/server/contracts/openapi.yaml
- apps/runtime-web/src/product/PlatformAdministratorsPortal.tsx
- apps/runtime-web/src/product/PlatformOrganizationsPortal.tsx
- apps/runtime-web/src/product/AdministrationPortal.tsx
- scripts/test-provider-interoperability.mjs
- scripts/test-workforce-migration.mjs
- docs/operations/DEPLOYMENT.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-810`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Platform Administrator and Organization provisioning evidence from Control Plane Build Steps 1 through 6
- Organization IdP revision, approval, rollback, emergency-access and signing-key rotation paths
- SCIM credentials, group mappings, provisioning telemetry, retry, reconciliation and session-revocation behavior
- Invitation delivery receipts, bounce handling, revocation, reissue and expiry
- Supported staging tenants, mail provider, devices, browsers and assistive technologies

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Real Microsoft Entra ID and Okta OIDC, supported brokered SAML and SCIM 2.0 interoperability in staging
- Joiner, mover, leaver, reactivation, group mapping, entitlement and final-Administrator protection journeys
- Invitation delivery, bounce, duplicate receipt, revocation, reissue and expiry through the configured provider
- Visible provisioning failure, bounded retry, reconciliation, credential rotation, provider rollback and emergency access
- Representative workforce migration rehearsal and task-based device and assistive-technology acceptance
- Consolidated sanitized evidence and accountable identity/workforce subsystem go or no-go decision

Expected paths are discovery targets, not permission to invent absent structure:

- apps/server/src/identity/
- apps/server/src/platform/
- apps/runtime-web/src/product/
- scripts/test-provider-interoperability.mjs
- scripts/test-workforce-migration.mjs
- docs/operations/
- docs/release-evidence/
- test-results/identity-provider/
- test-results/migration/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Freeze one staging release candidate and record source, image, lockfile, migration and configuration digests before external testing
- Configure separately approved Entra ID and Okta provider revisions and execute OIDC, supported brokered SAML and SCIM preflight without displacing the known-good revision
- Run joiner, mover, leaver, reactivation, group, entitlement, denial and active-session termination journeys with synthetic identities
- Exercise real invitation delivery, bounce, duplicate callback, revocation, reissue and expiry through controlled inboxes
- Force safe partial failures and prove telemetry, bounded retry, reconciliation, provider rollback, SCIM credential rotation and emergency Platform Administrator access
- Rehearse the workforce migration against representative existing Organization data and verify the documented recovery procedure
- Run the supported Windows, macOS, iOS and Android task matrix with keyboard, touch, zoom, forced colors, reduced motion and named screen readers
- Close defects, consolidate sanitized evidence and obtain named engineering, security, accessibility, operations and product approval for the identity/workforce subsystem

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Use isolated staging tenants, synthetic identities and controlled mailboxes; never copy provider secrets, assertions, access tokens or personal information into evidence
- Prove authentication alone never grants Organization access and IdP groups cannot grant Platform Administrator authority
- Verify Organization scoping, least privilege, final-Administrator protection, session termination and server-side denial across every joiner, mover and leaver transition

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Bind all evidence to one immutable release-candidate source, image, lockfile, migration and configuration digest set
- Prove duplicate delivery events, repeated SCIM operations, retries and reconciliation remain idempotent and cannot silently remove access
- Preserve the active known-good provider revision until a separately approved candidate passes discovery, metadata, signing-key and test-authentication preflight

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not test with production tenants, production workforce data or uncontrolled email addresses
- Do not implement SAML directly in Plenum when the approved deployment profile delegates federation to Keycloak or another supported broker
- Do not count mocked provider, local inbox or automated axe evidence as the required real-provider and human acceptance
- Do not approve production, waive a blocking gate or repair staging by manual database mutation

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then entra ID and Okta each complete the approved OIDC, supported brokered SAML and SCIM joiner, mover, leaver and reactivation journeys against the same staging release candidate
- Given the documented preconditions, when the task behavior is exercised, then authentication without an active governed workforce assignment grants no access and no IdP group can grant Platform Administrator authority
- Given the documented preconditions, when the task behavior is exercised, then failed or partial synchronization is visible, retryable and reconcilable without silent deletion, privilege escalation or manual database intervention
- Given the documented preconditions, when the task behavior is exercised, then real invitations are delivered, bounced, revoked, reissued and expired with duplicate provider events handled idempotently
- Given the documented preconditions, when the task behavior is exercised, then suspension and deprovisioning terminate active sessions and future entry while preserving governed and immutable audit records
- Given the documented preconditions, when the task behavior is exercised, then provider rollback, emergency Platform Administrator access, SCIM credential rotation and representative migration recovery succeed
- Given the documented preconditions, when the task behavior is exercised, then authorized human testers complete the control-plane workflows on the supported device and assistive-technology matrix with no unresolved task-blocking defect
- Given the documented preconditions, when the task behavior is exercised, then every required gate is PASS and named accountable approvers bind the subsystem decision to the exact tested artifacts

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Entra ID and Okta authentication and SCIM interoperability evidence
- Invitation delivery and bounce evidence
- Provisioning retry, reconciliation, rollback and recovery evidence
- Representative migration and restore evidence
- Device and assistive-technology acceptance report
- Identity and workforce subsystem go or no-go record

## Tests

Required test/evidence IDs: `PS-815-T01`, `PS-815-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-WORKFORCE-MIGRATION`, `CMD-IDENTITY-PROVIDER-STAGING`, `CMD-SECURITY`, `CMD-DEPLOYMENT-SMOKE`, `CMD-GAP-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Provider configuration cannot replace a working revision before successful preflight and separate approval
- Authentication, provisioning and authorization remain separate authorities and fail closed
- Reconciliation cannot silently apply destructive removals and retries cannot duplicate side effects
- Emergency Platform Administrator access remains independent of customer identity systems
- Evidence contains correlation identifiers and outcomes without secrets, tokens, assertions or personal data
- FAIL and NOT RUN are never translated into PASS or production approval

The approval gate is: PS-815 passes only when the required Entra ID, Okta, invitation, recovery, device and assistive-technology evidence is PASS; any FAIL or NOT RUN blocks PS-820, while final platform production approval remains PS-850.. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md with the exact subsystem acceptance result
- Index sanitized provider logs, request and operation identifiers, invitation receipts, recovery evidence and human test records by release-candidate digest
- Record every defect, waiver and approval owner; leave FAIL and NOT RUN gates explicit for PS-820 and PS-850

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-815-prove-platform-control-plane-identity-workforce-production-acceptance`
- Proposed subject: `test(identity): prove control-plane production acceptance`
- Expected migrations: none
- Expected API/contract IDs: `platform-control-plane-v1`, `organization-workforce-v1`

Proposed body:

```text
Why:
- Close the external provider, delivery, recovery and human acceptance gap before whole-platform release testing.
What:
- Prove governed Entra ID, Okta, SCIM, invitation, recovery and accessible workforce operations against one staging release candidate.
Verification:
- Run the listed automated gates, real-provider harnesses and authorized human acceptance matrix.
Compatibility / migrations:
- Rehearse migrations 037 and 038 against representative data; use restore or forward-fix rather than destructive schema rollback.
Risks / follow-up:
- Any missing provider, delivery, recovery, device or assistive-technology evidence blocks PS-820.
Refs: PS-815, REQ-045, REQ-051, REQ-064
```

Proposed PR description:

Summary: Prove that activated Organizations can authenticate and provision their workforce through real Entra ID and Okta integrations and recover safely from delivery, synchronization and provider failures. Risks: high identity, authorization, tenant-isolation and session-revocation exposure. Migration: no new schema; rehearse migrations 037 and 038 with representative data. Evidence: automated regression, real-provider logs, delivery receipts, recovery exercises and authorized device and assistive-technology acceptance. Rollback: retain the known-good provider revision, revoke test credentials, restore isolated staging data when required and forward-fix additive migrations.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: Entra ID, Okta, the mail provider or the supported authentication broker changes its contract; The Organization Role, entitlement, invitation or SCIM lifecycle changes; The supported browser, device or assistive-technology matrix changes.
