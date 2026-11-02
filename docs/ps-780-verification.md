# PS-780 verification — operator control floor and recovery workflows

Date: 2026-11-02

## Outcome

PS-780 implementation, automated verification, and the independent product-owner user test are **PASS**. The product owner completed all ten script points on 2026-11-02. Production approval remains separate.

The authoritative control-floor contract is `operator-control-floor-v1`. Session Operators now use the existing atomic Command Receipt and Evidence Event kernel without receiving a Participant Seat. The floor exposes Session/stage/timer state, connection and occupancy counts, tasks, required submissions, Inject and Adjudication queues, warnings, delivery health, and recent events. Lifecycle, Stage, Inject, and delivery-recovery mutations require active Organization and Session Operator authority; consequential controls require a bounded reason and explicit confirmation.

No SQL migration was required. Existing Session, Stage, Inject, control-intervention, Command Receipt, Evidence Event, audit, and delta-outbox tables remain authoritative. Rollback is the bounded API/UI/contract slice; persisted intervention and evidence history must be preserved.

## Verification

| Evidence | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |
| `npm test` including `PS-780-T01/T02` | **PASS** |
| `DATABASE_URL=<fresh-pg18> S3_ENDPOINT=<loopback-seaweedfs> npm run test:integration` | **PASS** |
| `DATABASE_URL=<fresh-pg18> npm run test:e2e:product` | **PASS** — 20/20 |
| Focused `PS-780-T01/T02`, `AC-12/AC-13` browser/Axe | **PASS** — 1/1; `output/playwright/ps-780/operator-control-floor.png` |
| Targeted Runtime delivery recovery browser flow | **PASS** — 1/1; stale-version-safe retry returned the dead letter to pending |
| `DATABASE_URL=<fresh-pg18> npm run test:a11y` | **PASS** — 11/11 |
| `PLENUM_LOAD_DATABASE_ADMIN_URL=<disposable-pg18> npm run load:app` | **PASS** |
| `PLENUM_LOAD_DATABASE_ADMIN_URL=<disposable-pg18> npm run load:voice` | **PASS** after authorized Docker fixture startup |
| `npm run audit:product-completeness` | **PASS** — 228 obligations; omission check PASS |
| `npm run lint` | **PASS** — 72 sources; 44 versioned contracts |
| Product-owner test | **PASS** — all ten script points completed 2026-11-02; see `docs/acceptance/PS-780-user-test.md` |

The first integration invocation was **NOT RUN** because its required `DATABASE_URL` and `S3_ENDPOINT` were absent. The first browser invocations were **NOT RUN** because the default port was already occupied and a reused database was not empty. The targeted recovery flow initially stopped on a stale accessible-label assertion; the assertion was aligned with the rendered `Plenum status: Connected` label and the clean rerun passed. The first application-load invocation was **NOT RUN** because its admin URL defaulted to an unavailable port, and the first voice-load invocation was **NOT RUN** because sandboxed Docker access was denied. Verification then used fresh disposable databases, the registered loopback S3 fixture, an isolated browser port where needed, the explicit load admin URL, and authorized disposable media startup.
