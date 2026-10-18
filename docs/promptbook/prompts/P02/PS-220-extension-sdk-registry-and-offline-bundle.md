# PS-220 - Build the Plugin SDK, registry, and offline bundle

## ID / title / goal / user outcome / risk

- ID: `PS-220`
- Title: Build the Plugin SDK, registry, and offline bundle
- Goal: Let approved publishers build, validate, submit, install, and bind digest-pinned Plugins.
- User outcome: Institutions can install a verified local Plugin, including without Internet, before any Session run uses it.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-038`, `REQ-086`, `REQ-090`, `REQ-094`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-038`, `REQ-086`, `REQ-090`, `REQ-094`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md` — 10 Extension sections 5-7 and 13
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data section 19
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-018
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-029

Observed source evidence:

- docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `ADR-018`, `OPEN-020`, `OPEN-022`, `OPEN-029`.

## Prerequisites

Task prerequisites: `PS-100`, `PS-110`, `PS-130`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Plugin manifest and lifecycle
- Package/object adapter
- Current trust-root and signing gaps

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- SDK validators and fixture runner
- Restricted publisher intake
- Artifact approval and Organization installation
- Digest lockfile and offline dependency bundle

Expected paths are discovery targets, not permission to invent absent structure:

- packages/plugin-sdk/
- apps/server/src/extensions/registry/
- apps/admin/src/plugins/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Canonicalize and verify manifest plus dependency closure
- Separate publisher, artifact, install, binding, and run authorization
- Reject digest reuse and incompatible host ranges
- Make the fixture Plugin clearly synthetic

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Only approved publishers submit
- Audit privileged lifecycle changes
- Keep secret references out of Releases and bundles

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Unique pluginId/version maps to one digest
- Pin host API and Release schema ranges
- Revocation never deletes history

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not create a public marketplace
- Do not let Plugins define trust roots
- Do not finalize OPEN-029 policy

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then unauthorized submission is denied
- Given the documented preconditions, when the task behavior is exercised, then tampered offline bundle fails without Internet
- Given the documented preconditions, when the task behavior is exercised, then approved artifact is unusable until installed and bound
- Given the documented preconditions, when the task behavior is exercised, then external-required Plugin is blocked in air-gapped profile

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Plugin SDK
- Registry lifecycle
- Offline bundle verifier
- Tamper and authorization tests

## Tests

Required test/evidence IDs: `EXT-01`, `EXT-02`, `EXT-03`, `EXT-04`, `EXT-05`, `EXT-16`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-AIRGAP`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- No Plugin receives DB, object-store, or ambient secret access
- SBOM/signing gaps remain explicit
- Audit Records remain Participant-inaccessible

The approval gate is: Production plugin approval blocked by OPEN-029. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update trust matrix and compatibility matrix
- Record candidate OPEN items
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-220-extension-sdk-registry-and-offline-bundle`
- Proposed subject: `feat(extensions): add SDK and plugin registry`
- Expected migrations: `011_extension_registry`
- Expected API/contract IDs: `plugin-manifest-v1`, `plugin-registry-v1`, `offline-plugin-bundle-v1`

Proposed body:

```text
Why:
- Establish a controlled Plugin supply chain.
What:
- Add SDK, registry, installation, and offline bundle verification.
Verification:
- EXT-01 to EXT-05 and EXT-16.
Compatibility / migrations:
- Adds 011 extension registry.
Risks / follow-up:
- Trust operations remain OPEN-029.
Refs: PS-220, REQ-094, DEC-52
```

Proposed PR description:

Summary: adds the restricted Plugin supply chain. Risks: artifact trust. Migration: 011. Evidence: tamper and denial tests. Rollback: suspend new artifacts; preserve immutable history.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-029 resolves; ADR-018 changes; A new execution target is approved.
