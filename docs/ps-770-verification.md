# PS-770 verification — participant entry and Runtime experience

Date: 2026-11-02  
Environment: Windows, Node 24.22.1, npm 11.19.1, PostgreSQL 18.6 Alpine, SeaweedFS 4.48, Playwright 1.64.1 Chromium

## Outcome

PS-770 is **implementation-complete with automated and product-owner acceptance PASS**. The product owner confirmed all ten visible-control steps on 2026-11-02. Production approval remains separate.

Participants now have a visible, tenant-scoped entry surface that lists only their invitations and assigned Sessions. Addressed invitations can be accepted without a token or identifier field; admitted Participants can choose policy-eligible Seats by labels and enter a stable role-scoped Runtime link. Runtime exposes configured module navigation, complete curated module states, active-role switching, Session status/help/exit controls, and the existing protected offline outbox distinctions.

The new authoritative contracts are `participant-entry-v1` and `runtime-navigation-v1`. No SQL migration was required: migration 017 already owns invitations, join requests, Participants, Seats, Seat Assignments, access revisions, and their tenant constraints. Rollback is the bounded API/UI/contract slice; no persisted schema or existing Release needs reversal.

## Verification

| Reference | Command / evidence | Result |
|---|---|---|
| Preflight | `node --version`; `npm --version` | **PASS** — v24.22.1; 11.19.1 |
| Type safety | `npm run typecheck` | **PASS** |
| Build | `npm run build` | **PASS** |
| Contract/style lint | `npm run lint` | **PASS** — 71 sources, 44 contracts |
| `CMD-PLATFORM-TEST` | `npm test -- --run` | **PASS** — 108/108 |
| `CMD-PLATFORM-INTEGRATION` | `DATABASE_URL=<fresh-pg18> S3_ENDPOINT=http://127.0.0.1:8333 npm run test:integration` | **PASS** — 28/28 |
| Database-only diagnostic | `DATABASE_URL=<fresh-pg18> npm run test:db` | **PASS** — 27/27 |
| `CMD-OFFLINE` / `AC-11` | `npm run test:offline` | **PASS** — 7/7 |
| `CMD-PRODUCT-E2E`, `PS-770-T01/T02`, `AC-08`, `AC-11` | `DATABASE_URL=<fresh-pg18> npm run test:e2e:product` | **PASS** — 19/19 in 7.0 minutes |
| `CMD-PLATFORM-A11Y` | `DATABASE_URL=<fresh-pg18> npm run test:a11y` | **PASS** — 11/11 in 7.3 minutes |
| `CMD-GAP-AUDIT` | `npm run audit:product-completeness` | **PASS** — 228 obligations; omission check PASS |
| Patch integrity | `git diff --check` | **PASS** |
| Product-owner test | `docs/acceptance/PS-770-user-test.md` | **PASS** — all ten steps confirmed by the product owner on 2026-11-02. |

The first integration attempt correctly failed because `S3_ENDPOINT` was absent; a second diagnostic failed because the disposable SeaweedFS process was not listening. After starting the required healthy S3 fixture, the registered integration command passed 28/28. Those prerequisite failures are not treated as acceptance evidence.

Browser evidence: `output/playwright/ps-770/participant-runtime.png`.

## Authorization and recovery evidence

- Product context is granted only by current Organization membership, an active Seat Assignment, or a current addressed invitation.
- Participant entry is filtered by trusted Principal and Organization; no request parameter can select another tenant or person.
- Accept-invitation mutation verifies the addressed person again under the Session transaction and remains idempotent through the existing Command Receipt kernel.
- Role selection is derived from active Seat Assignments and passed through the existing trusted Active Role Context resolver.
- Revoked/removed access is derived from active assignments and governed join state; protected cached data still clears on access denial.
- Offline-safe work remains `local_pending`; live-only control, adjudication, approval, Poll management, Voice, and Floor operations remain excluded from the Offline Outbox.

## Remaining gate

PS-770 change-level acceptance is **PASS** and PS-780 is the next eligible work. Production remains **NO-GO** pending the later completion sequence and PS-850 owner decision.
