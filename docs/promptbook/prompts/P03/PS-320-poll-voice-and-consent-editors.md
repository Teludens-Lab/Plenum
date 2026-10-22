# PS-320 - Configure Polls, Voice Channels, and consent in Studio

## ID / title / goal / user outcome / risk

- ID: `PS-320`
- Title: Configure Polls, Voice Channels, and consent in Studio
- Goal: Add visual Poll and Voice Channel editors plus consent-governed recording and transcription.
- User outcome: Designers configure explicit voting and voice rules, and Participants control consent without hidden defaults.
- Risk: **CRITICAL**
- Metadata: `source_evidence` is populated; `prerequisites_verified: true`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-072`, `REQ-076`, `REQ-079`, `REQ-080`, `REQ-083`, `REQ-085`, `INV-023`, `INV-025`, `INV-027`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-072`, `REQ-076`, `REQ-079`, `REQ-080`, `REQ-083`, `REQ-085`, `INV-023`, `INV-025`, `INV-027`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 25-26
- `docs/corpus/02_Updated_Architecture/11_LIVE_POLLING_AND_VOTING_v1.1.md` — 11 Voting (entire current document)
- `docs/corpus/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md` — 12 Voice (entire current document)
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data sections 20 and 24

Observed source evidence:

- docs/corpus/02_Updated_Architecture/11_LIVE_POLLING_AND_VOTING_v1.1.md
- docs/corpus/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: `ADR-017`, `OPEN-027`, `OPEN-028`.

## Prerequisites

Task prerequisites: `PS-240`, `PS-250`, `PS-310`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- Poll and Voice Definition contracts
- Installed adapter capabilities
- Organization consent configuration

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Poll editor with explicit counting sentence
- Electorate and result preview
- Voice editor and permission matrix
- Consent capture/withdrawal
- Recording/transcription controls default off

Expected paths are discovery targets, not permission to invent absent structure:

- apps/studio/src/polls/
- apps/studio/src/voice/
- apps/runtime-web/src/consent/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Reject incomplete counting rules
- Validate adapter capabilities per target profile
- Explain secret ballot versus anonymous survey
- Stop transcription immediately on consent withdrawal

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Keep secret choices and voice assets out of ordinary projections
- Consent is participant-scoped and evidenced
- Recording assets follow classification and retention

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Open Poll definitions are immutable
- Consent actions are append-only
- Provider grants refresh on policy change

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not enable ranked choice or video
- Do not decide legal basis
- Do not enable production secret ballots before policy approval

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then poll cannot publish with implicit denominator or tie rule
- Given the documented preconditions, when the task behavior is exercised, then recording and transcription are off by default
- Given the documented preconditions, when the task behavior is exercised, then missing consent returns CONSENT_REQUIRED
- Given the documented preconditions, when the task behavior is exercised, then withdrawal stops transcription and records the event

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Poll editor
- Voice editor and matrix
- Consent UI and lifecycle
- VOTE/VOICE accessibility evidence

## Tests

Required test/evidence IDs: `VOTE-15`, `VOICE-09`, `VOICE-11`, `VOICE-13`, `VOICE-14`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-TEST`, `CMD-PLATFORM-E2E`, `CMD-PLATFORM-A11Y`.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- No plaintext secret choice in UI telemetry
- Essential voice instructions have non-audio paths
- Production gates remain visible

The approval gate is: Production recording/transcription and secret ballots blocked by OPEN-027/028. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update consent and privacy matrix
- Record OPEN-027/028 limits
- Update PROJECT_STATE.md

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-320-poll-voice-and-consent-editors`
- Proposed subject: `feat(studio): configure polls and voice consent`
- Expected migrations: `016_voice_consent_assets`
- Expected API/contract IDs: `voice-consent-v1`, `poll-definition-v1`, `voice-definition-v1`

Proposed body:

```text
Why:
- Make first-release voting and voice configurable and safe.
What:
- Add Poll, Voice Channel, and consent editors.
Verification:
- VOTE-15 and VOICE-09/11/13/14.
Compatibility / migrations:
- Adds 016 consent assets.
Risks / follow-up:
- Production policy remains OPEN-027/028.
Refs: PS-320, REQ-083, DEC-50
```

Proposed PR description:

Summary: adds Poll/Voice configuration and consent. Risks: privacy and accessibility. Migration: 016. Evidence: consent and assistive-technology tests. Rollback: keep recording/transcription disabled.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: OPEN-027 or OPEN-028 resolves; Adapter capability changes; Applicable consent policy changes.
