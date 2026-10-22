# PS-350 first-product-proof evidence

Date: 2026-10-21. Commit: `e09c69b9aa412d157fdc4a5e5da59a5826d52dda`.

Result: **PASS / Phase 3 GO**. The current build passes its implemented unit, browser, database, real-media, and all 17 reference-parity checks. AC-07 and AC-11 are explicitly deferred to PS-420/PS-500, and accessibility acceptance is deferred to PS-550. This is an implemented-capability result, not production approval.

## Verified follow-up implementation

The remaining PS-350-owned behavior is implemented and verified: visual configuration covers Team, Session Role, Stage, Form, Workflow, and Scenario; an authenticated tenant-scoped Operator creates a Session from the Release published by that browser journey; DEC-42 covers return, revision, re-forward, and two competing White Cell decisions; lost-ack handling retries the identical Command three times; unavailable Plugin behavior is rejected; and the research evidence index is compared field-for-field with canonical Evidence Event rows, including a rejected Command. Admin lifecycle, cross-Session research export/archive, PLI, and intercom/recorder Plugin parity now have executable evidence as well.

The follow-up database and browser evidence is **PASS**. Typecheck, lint/build, 77 unit/contract tests, 17 database integration tests, 17 Playwright tests with one conditional media skip, JavaScript syntax checks, and `git diff --check` pass. The dedicated real-media command also passes against loopback LiveKit 1.13.10. AC-09 passes all 17 non-waived parity targets.

## Environment and claim boundary

- Supported checks: Node 24.22.0, npm 11.19.1, network-disabled cached container.
- Final checks: Node 24.22.0, npm 11.19.1, Playwright 1.64.1, Chromium 156, PostgreSQL 18.6, synthetic fixtures, and fresh disposable databases.
- `CMD-PLATFORM-MEDIA` used `MEDIA_TEST_URL=http://127.0.0.1:7880`, loopback LiveKit 1.13.10, synthetic microphone input, and a fresh database; it passed 1/1 on Node 24.22.0 and the current working tree.
- Accessibility acceptance is deliberately outside this phase and remains required at PS-550; prior automated results are retained as regression history, not Phase 3 approval evidence.
- No production data, secrets, migrations, or deployments were used.

## AC-01 through AC-13

| ID | Status | Current evidence | Missing proof / owner |
|---|---|---|---|
| AC-01 | PASS | The follow-up E2E visually edits a Team, Session Role, Stage, Form, Workflow, and Scenario in one converged Draft. | None for the bounded visual-authoring claim. |
| AC-02 | PASS | `SYNC-01 SYNC-02 AC-01 AC-02` browser case publishes a frozen valid Draft; Node tests cover targeted invalid-publication failures and deterministic immutable Release bytes. | None for the bounded Publication claim. |
| AC-03 | PASS | A tenant-scoped Operator atomically creates the Session, authority, initial Release Activation, evidence sequence, Operator assignment, and audit record from the visually published Release; PS-340 evidence covers readiness/opening. | None for the bounded launch claim. |
| AC-04 | PASS | The current browser run creates and submits an Artifact, omits it from an unauthorized Team projection, and forwards it from Facilitator to White Cell. | None for the tested handoff. |
| AC-05 | PASS | The follow-up E2E returns DEC-42 from White Cell, revises it as Scribe, re-forwards it as Facilitator, and completes it after reload. | None. |
| AC-06 | PASS | The follow-up E2E exports the structured research evidence index and compares every exported field to canonical Event rows. | Broader report reconciliation remains PS-520 scope. |
| AC-07 | DEFERRED | Only the initial Release Activation seeded with the Session exists. | Not part of PS-350 completion. PS-420 must prove governed impact review and live Release Activation before PS-550 can approve release. |
| AC-08 | PASS | The browser journey covers invalid and stale Commands, denied visibility, offline state, lost acknowledgement, and an unavailable Plugin without false success. | Deployment-level unavailability remains PS-530. |
| AC-09 | PASS | `CMD-PARITY` validates the pinned commit/tree and reports 17 PASS, 0 BLOCKED, 0 OUT_OF_SCOPE targets. Orientation, operational notes, Control, Scenario, admin lifecycle, complete export/archive, PLI, and intercom/recorder Plugin parity have executable evidence. | None for the pinned-reference parity claim; no target was waived. |
| AC-10 | PASS | The browser captures the lost-ack Command and submits three identical concurrent retries, producing one shared Evidence sequence and replayed receipts. | None. |
| AC-11 | DEFERRED | Existing integration evidence returns `needs_reconciliation` for a stale Command, and the Runtime distinguishes `local_pending`. | Not part of PS-350 completion. PS-420/PS-500 must prove durable queued reconnect against changed authorization and Governing Release before PS-550 can approve release. |
| AC-12 | PASS | The follow-up E2E submits two White Cell acceptance decisions against one Artifact version and observes one acceptance plus one stale reconciliation. | Generalized adjudication remains PS-410 scope. |
| AC-13 | PASS | The follow-up E2E matches a rejected receipt's Evidence sequence to `command.rejected` in the structured export and canonical Event row. | None. |

## Phase 3 exit additions

| Capability | Status | Evidence / limitation |
|---|---|---|
| Poll | PASS | Browser actor opened, cast, closed, tallied, and certified the synthetic Poll; axe reported no violations. |
| Push-to-talk Voice Channel | PASS | Two authenticated browser Participants joined through the real local LiveKit adapter; one published microphone audio and the other observed one remote audio stream. |
| Two-model composition | PASS | Browser actor bound two approved Plugins, built a typed graph with an approval gate, and completed a deterministic fixture preview with zero state changes. |

## Validation

| Reference / command | Result | Environment and artifact |
|---|---|---|
| `CMD-PLATFORM-E2E` / `npm run test:e2e` | PASS: 17 passed, 1 intentional live-SFU skip | Node 24.22.0/npm 11.19.1; fresh PostgreSQL 18.6 database; Playwright 1.64.1 Chromium; screenshots under `output/playwright/ps-150/`; `.last-run.json` reports `passed`. |
| `CMD-PLATFORM-MEDIA` / `npm run test:e2e:media` | PASS: 1/1, 20.0 s browser time | Node 24.22.0/npm 11.19.1; fresh PostgreSQL 18.6 database; Playwright 1.64.1 Chromium; loopback LiveKit 1.13.10; two-browser publish/subscribe observed. |
| `CMD-PLATFORM-A11Y` / `npm run test:a11y` | DEFERRED TO PS-550 | Historical automated results remain available, but accessibility is not a PS-350/Phase 3 acceptance gate. Manual screen-reader output remains NOT RUN and cannot be inferred from axe. |
| `CMD-PARITY` / `node tests/parity/validate-reference-inventory.mjs` | PASS; AC-09 PASS | Node 24.22.0; 17 targets: 17 PASS, 0 BLOCKED, 0 OUT_OF_SCOPE; pinned commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b`, tree `771510b6180bd4826dc5688789d131f2109eeb62`. |
| `CMD-PROMPTBOOK-VALIDATE` / `node scripts/validate-promptbook.mjs` from `docs/promptbook` | PASS | Node 24.22.0; 31 tasks, REQ 94/94, INV 28/28, no dependency cycles or warnings; PS-400 is the first eligible task. |
| `CMD-PLATFORM-TEST` / `npm test -- --run` | PASS: 77/77 | Node 24.22.0/npm 11.19.1; includes the executable PLI and media Plugin parity fixtures. Existing Runtime chunk warning remains. |
| `CMD-PLATFORM-TYPECHECK` / `npm run typecheck` | PASS | Node 24.22.0; no diagnostics. |
| `CMD-PLATFORM-LINT` / `npm run lint` | PASS | Node 24.22.0; 50 sources, 26 versioned contracts. |
| `CMD-PLATFORM-DB` / `npm run test:db` | PASS: 17/17 | Node 24.22.0/npm 11.19.1; fresh PostgreSQL 18.6 database; includes atomic Session creation, tenant isolation, Command outcomes, reconnect, publication, Plugin, voting, voice, Studio, and research-export coverage. |

## Defect and blocker ledger

| ID | Severity | Finding | Owner / release treatment |
|---|---|---|---|
| PS350-04 | RESOLVED | AC-09 now passes all 17 pinned-reference parity targets; admin lifecycle, complete export/archive, PLI, and intercom/recorder Plugin evidence closed the final four gaps. | Resolved in the PS-350 implementation pass without waivers. |
| PS350-06 | S2 | The real-media proof passes on supported Node 24 locally, but institutional LAN/TLS/TURN remains unverified. | Operations/Technical Lead; later deployment/release evidence, not a Phase 3 blocker. |
| PS350-07 | S2 | Manual assistive-technology review remains NOT RUN. | Deferred to PS-550; Accessibility reviewer; cannot be replaced by axe. |

## Readiness decision

**Phase 3: GO; PS-400 is eligible to start.** The PS-350-owned journey, all 17 AC-09 parity targets, and real-media proof pass. Release approval separately requires passing the deferred AC-07/AC-11 evidence from PS-420/PS-500, plus `OPEN-001`, named specialist sign-offs for `ADR-001` through `ADR-004`, and the later security, deployment, recovery, load, and PS-550 accessibility gates.

No migration or dependency was added. Admin deletion is deliberately logical: retained Session, Participant, assignment, evidence, and audit rows remain available while Session authority is fenced.
