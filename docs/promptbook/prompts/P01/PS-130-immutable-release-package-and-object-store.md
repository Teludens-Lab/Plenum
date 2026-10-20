# PS-130 - Compile immutable Releases and portable Packages

## ID / title / goal / user outcome / risk

- ID: `PS-130`
- Title: Compile immutable Releases and portable Packages
- Goal: Freeze validated Drafts into immutable Definition Revisions, Releases, and digest-verified Packages.
- User outcome: A published simulation is stable, portable, and verifiable across Deployments.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-021`, `REQ-022`, `REQ-023`, `REQ-070`, `INV-005`, `INV-012`, `INV-013`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-021`, `REQ-022`, `REQ-023`, `REQ-070`, `INV-005`, `INV-012`, `INV-013`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` — 02 Platform section 7
- `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` — 03 Schema sections 3, 4, 18
- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio section 23
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — OPEN-020

Observed source evidence:

- references/plenum-runtime-slice/src/server.mjs
- references/plenum-runtime-slice/migrations/001_core.sql

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-011`, `ADR-014`, `OPEN-012`, `OPEN-013`, `OPEN-020`.

## Prerequisites

Task prerequisites: `PS-100`, `PS-110`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Slice publish transaction and embedded blob key
- Release manifest and Package layout
- S3 adapter candidates and current lockfile

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Canonical Release compiler
- Immutable publication records
- S3-compatible object adapter
- Package export/import with digest and compatibility check

Expected paths are discovery targets, not permission to invent absent structure:

- packages/release-compiler/
- apps/server/src/registry/
- apps/server/test/publication/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Freeze one exact materialization
- Canonicalize and hash manifest and content
- Write object before final registry commit with safe cleanup
- Reject mutations and digest mismatches

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Require Publisher authority
- Exclude secrets and Participant data from Packages
- Keep object keys server-side

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Concurrent publication of identical content yields one Release or an explicit conflict
- Pin schema, compiler, Plugin, and Platform Adapter digests
- Preserve historical contract references

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not choose signing policy for OPEN-020
- Do not add multi-cloud abstractions
- Do not require a test Session by default

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then re-reading a Release yields identical bytes and digest
- Given the documented preconditions, when the task behavior is exercised, then tampered Package import fails
- Given the documented preconditions, when the task behavior is exercised, then package round-trip preserves Release identity
- Given the documented preconditions, when the task behavior is exercised, then no secret or Participant data appears in a Package

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Release compiler
- Object storage port and one local adapter
- Package import/export
- Immutability and tamper tests

## Tests

Required test/evidence IDs: `AC-02`, `AC-06`, `PS-130-T01`, `PS-130-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-DB`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Immutable-table triggers remain active
- Publication lifecycle uses DEC-39 values
- Unresolved signing stays visibly gated

The approval gate is: Package signing for production is blocked by OPEN-020. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update compatibility and migration matrices
- Record the Approved S3-compatible direction and candidate provider
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-130-immutable-release-package-and-object-store`
- Proposed subject: `feat(registry): compile immutable release packages`
- Expected migrations: `007_release_packages`
- Expected API/contract IDs: `release-manifest-v1`, `package-import-v1`

Proposed body:

```text
Why:
- Make published simulations portable and stable.
What:
- Add compiler, Package round-trip, and object adapter.
Verification:
- Digest, immutability, and import tests.
Compatibility / migrations:
- Adds 007 release package records.
Risks / follow-up:
- Signing remains OPEN-020.
Refs: PS-130, REQ-021, INV-012
```

Proposed PR description:

Summary: adds immutable Release and Package handling. Risks: canonicalization drift. Migration: 007. Evidence: round-trip and tamper tests. Rollback: retain records and disable new publication route.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-020 resolves; OPEN-012 resolves; Object-store evaluation selects a product.
