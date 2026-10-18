# PS-250 - Deliver Voice Channels, Media Credentials, and Floor control

## ID / title / goal / user outcome / risk

- ID: `PS-250`
- Title: Deliver Voice Channels, Media Credentials, and Floor control
- Goal: Run one local media provider behind the adapter with authoritative grants and non-replayable Floor leases.
- User outcome: Authorized Participants can use configured voice modes while revoked or disconnected users fail closed.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-079`, `REQ-080`, `REQ-081`, `REQ-082`, `REQ-083`, `REQ-084`, `REQ-085`, `INV-026`, `INV-027`, `INV-028`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-079`, `REQ-080`, `REQ-081`, `REQ-082`, `REQ-083`, `REQ-084`, `REQ-085`, `INV-026`, `INV-027`, `INV-028`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md` — 12 Voice v1.1.0 (entire current document)
- `docs/corpus/02_Updated_Architecture/09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md` — 09 Contracts section 12.3
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-48
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-49
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — ADR-017

Observed source evidence:

- docs/corpus/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Proposed Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies are unratified or unresolved and must remain labeled: `ADR-013`, `ADR-016`, `ADR-017`, `OPEN-027`.

## Prerequisites

Task prerequisites: `PS-110`, `PS-120`, `PS-140`, `PS-210`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

## Inspect before editing

- Media Provider Adapter contract
- Voice grant and Floor schemas
- Current local certificate and TURN constraints

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- One local SFU adapter proof
- Short-lived Media Credentials
- Four channel modes
- Dedicated Floor request/renew/release
- LAN no-public-egress lane
- Accessible voice controls

Expected paths are discovery targets, not permission to invent absent structure:

- packages/media-adapter/
- apps/server/src/comms/
- apps/runtime-web/src/voice/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Derive grants from current Seat Assignment, role, and Stage
- Use row-locked bounded leases
- Expire and revoke on disconnect or policy change
- Treat provider events as untrusted observations

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Deny cross-Organization probing at API and provider boundary
- Scope credentials narrowly
- Keep audio outside Plenum PostgreSQL

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- At most one Floor holder
- Request ID deduplicates only the live request
- Stale token and epoch never grant
- No reconnect replay

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not hard-code LiveKit
- Do not implement video
- Do not queue or replay voice or Floor operations
- Do not enable recording or transcription policy yet

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then simultaneous requests produce one lease
- Given the documented preconditions, when the task behavior is exercised, then stale request is not replayed after reconnect
- Given the documented preconditions, when the task behavior is exercised, then role or Stage revocation mutes or removes
- Given the documented preconditions, when the task behavior is exercised, then lAN audio works with zero public egress
- Given the documented preconditions, when the task behavior is exercised, then keyboard controls and non-audio instructions pass

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Media adapter
- Voice service
- Floor endpoints
- Participant controls
- VOICE-01 to VOICE-07 evidence

## Tests

Required test/evidence IDs: `VOICE-01`, `VOICE-02`, `VOICE-03`, `VOICE-04`, `VOICE-05`, `VOICE-06`, `VOICE-07`, `VOICE-11`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`, `CMD-AIRGAP`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Media provider never writes Plenum DB
- Provider observations are not authoritative delivery proof
- Recording and transcription stay off

The approval gate is: Recording/transcription remains disabled until PS-320 and OPEN-027 policy. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update deployment profile and media runbook
- Record adapter choice as candidate or Proposed
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-250-voice-media-and-floor-control`
- Proposed subject: `feat(voice): enforce media grants and floor leases`
- Expected migrations: `014_comms_voice_core`
- Expected API/contract IDs: `media-credential-v1`, `floor-lease-v1`, `voice-command-v1`

Proposed body:

```text
Why:
- Deliver first-release LAN voice without creating a second authority.
What:
- Add media credentials, adapter, channels, and Floor control.
Verification:
- VOICE-01 to VOICE-07 and VOICE-11.
Compatibility / migrations:
- Adds 014 comms core.
Risks / follow-up:
- Consent policy remains OPEN-027.
Refs: PS-250, REQ-081, DEC-48
```

Proposed PR description:

Summary: delivers Voice Channels and Floor control. Risks: authorization propagation and media outage. Migration: 014. Evidence: voice and LAN tests. Rollback: disable provider binding; leases expire.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: ADR-017 changes; OPEN-027 resolves; Provider evaluation selects a different adapter.
