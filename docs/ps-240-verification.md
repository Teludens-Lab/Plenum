# PS-240 verification

Date: 2026-10-19. Mode: critical production-oriented implementation evidence in disposable local infrastructure; not release approval.

## Delivered

- Migration `013_voting_core` adds tenant-isolated Polls, frozen options/Electorates, separated Ballots/receipts, deterministic Tallies and append-only Certification correction chains.
- `poll.open`, `poll.close`, `poll.tally`, `poll.certify`, `poll.correct`, `poll.void` and `ballot.cast` run through the existing atomic Command/Evidence/outbox kernel.
- Participant projections return only the caller's eligibility capability and receipt. Early results and restricted audit data are omitted or denied server-side.
- The Runtime provides semantic radio/checkbox Ballots, accepted-receipt status, offline management refusal and a Certification view.
- Production secret/anonymous Poll opening fails with `CAPABILITY_UNAVAILABLE` while OPEN-028 remains unresolved.

## Acceptance evidence

| Evidence | Result |
|---|---|
| VOTE-01 eligible cast is atomic and event omits choice | PASS |
| VOTE-02 ineligible active Seat Assignment denied | PASS |
| VOTE-03 identical Command replay returns original receipt | PASS |
| VOTE-04 concurrent Ballots yield one accepted/current Ballot | PASS |
| VOTE-05 post-close queued Ballot returns `DEADLINE_EXPIRED` | PASS |
| VOTE-06 open options cannot be edited by the application role | PASS |
| VOTE-07 weighted/quorum/veto/tie fixtures and independent recount hashes match | PASS |
| VOTE-08 unauthorized observer receives no Ballot choice or early Tally | PASS |
| VOTE-09 early result denied and production secret Poll opening blocked | PASS |
| VOTE-10 concurrent Certifications yield one current record | PASS |

## Registered commands

| Reference | Command and environment | Result |
|---|---|---|
| `CMD-PLATFORM-TEST` | `npm test`; repo root; Node 24.22.0/npm 11.19.1 in isolated Docker dependency volume | PASS, exit 0, 37/37, 9.89 s |
| `CMD-PLATFORM-INTEGRATION` | `npm run test:integration`; repo root; Node 24.22.0, empty PostgreSQL 18 database, disposable SeaweedFS 4.48 | PASS, exit 0, 12/12, 8.95 s |
| `CMD-PLATFORM-E2E` | `npm run test:e2e`; repo root; host Node 22.16.0 launcher, empty PostgreSQL 18 database, Playwright 1.64.1 Chromium | PASS, exit 0, 9/9, 1.8 min; artifacts under `output/playwright/ps-150/` |
| `CMD-PLATFORM-A11Y` | `npm run test:a11y`; same host browser environment | PASS, exit 0, 4/4, 52.7 s; includes Poll keyboard/axe flow |

Additional checks: `npm run typecheck` PASS; `npm run lint` PASS with 29 sources and 17 contracts; Node 24 build PASS. The browser launcher remains Node 22 because the installed local Chromium toolchain is Windows-hosted; application compilation and database tests were repeated on required Node 24.

## Migration and recovery

Migration 013 is additive. Old application versions ignore the new schema. After first use, rollback means disabling new Poll creation and deploying a forward fix; Ballots, Tallies, Evidence Events and Certifications must not be deleted or rewritten. The migration was rehearsed from 001 through 013 on clean PostgreSQL 18 databases.

## Release limits

- Formal Security Owner review and production recovery validation are pending.
- Voting contention/load and manual assistive-technology review are not complete.
- Production secret ballots are blocked by OPEN-028; the implementation does not claim coercion resistance or end-to-end verifiability.
