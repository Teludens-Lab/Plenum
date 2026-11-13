# PS-120 verification

## BA-11 first task — Command/scheduled-Inject lock ordering (2026-11-12)

Scope is the recorded Command/scheduled-Inject deadlock only, not completion of BA-11 or release approval. Starting HEAD is `2e9ace12438221a617126f1f3c63f67ace89411a` with the 23-file uncommitted BA-10 candidate preserved in `output/ba-11-deadlock/preflight/` and `preflight.json`. No commit, push or deployment is authorized or performed.

### Cause and change

The participant Command processor previously read Session lifecycle state without a row lock. A rejected Command could allocate and hold `evidence.session_sequences`, then wait for the Session foreign-key `FOR KEY SHARE` check while inserting its Evidence. Meanwhile `runScheduledInjects` held that Session `FOR UPDATE` and waited for the same sequence. PostgreSQL aborted one transaction with `40P01`, yielding HTTP 500 instead of the canonical rejected receipt. The saved BA-09/10 failures and the new controlled baseline reproduction show the same cycle.

The shared scheduler Session claim now uses `FOR NO KEY UPDATE SKIP LOCKED`. The scheduler does not change the Session key. This lock still excludes lifecycle writers and competing scheduler claims, but is compatible with Evidence foreign-key `FOR KEY SHARE` checks. Consequently an Evidence writer can finish while the scheduler waits on its sequence, eliminating the conflicting edge in the lock cycle. Authority, device, Participant and Active Role checks, receipt replay, aggregate versions and the existing atomic outcome CTE are unchanged. No production retry or timeout was added. PostgreSQL's [row-lock compatibility documentation](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS) specifies these compatibility rules.

Production change: `apps/server/src/runtime/inject-scheduler.ts` (one SQL locking clause plus its explanatory comment). Regression: `apps/server/test/command-scheduler.integration.mjs`, invoked by the existing `tenant-jobs.integration.mjs` fixture and named in `identity.integration.test.mjs`. The new fixture reuses the existing synthetic Organization/Release/Inject setup; no production hook, authentication bypass, new test command or infrastructure abstraction is introduced.

### Acceptance boundaries

The test uses real PostgreSQL transactions and real `submitRuntimeCommand` / `runScheduledInjects` execution. A test-only client wrapper pauses after the scheduler owns the Session lock. It observes either Command completion or the original conflict through `pg_blocking_pids` before releasing the scheduler. The original scheduler reliably deadlocks. With the fix, the Command completes with its normal `CAPABILITY_UNAVAILABLE` rejected receipt and the scheduled Inject commits. The reverse order pauses a Command after outcome insertion but before commit: the scheduler claims the Session and waits on the Evidence sequence; a second scheduler skips that claimed Session. Releasing the Command lets the first scheduler deliver exactly once. Two concurrent Command retries return the original receipt. SQL assertions require one rejection receipt/Event, one Inject release/recipient delivery, one outbox row per Event and contiguous sequences without lost or duplicate outcomes.

This is a database concurrency regression, not a new live AWS or real isolated Model Run proof. The enclosing existing integration case separately starts the actual production profile and exercises HTTP outcomes and tenant jobs. Existing full-suite accepted/rejected/reconciliation cases, forced rollback, tenant isolation and stale-authority cases guard the unchanged atomicity and authorization contracts. Polling is bounded to five seconds on observed database state; ten-second statement timeouts are restricted to the two disposable test connections and reset afterward. No arbitrary timing delay selects the interleaving.

### Verification

All commands run from `C:\Users\ssnguna\Local Sites\Plenum`, Node 24.22.1/npm 11.19.1, Windows, PostgreSQL 18.6 and SeaweedFS 4.48, synthetic data only. Logs and command metadata are under `output/ba-11-deadlock/`.

| Command / boundary | Result | Wall time / evidence |
|---|---|---|
| Original scheduler, final regression, build + focused integration | FAIL as expected: `deadlock detected` | 9.80 s; `scheduler-baseline.json`, `scheduler-baseline.log` |
| Fixed scheduler, same focused integration | PASS; 1 test, no skips | 30.96 s; `scheduler-focused.json`, `scheduler-focused.log` |
| `npm run typecheck` | PASS / exit 0 | 9.17 s; `typecheck.log`, `checks.json` |
| `npm test` | PASS / exit 0; 174 passed, no failures/skips | 9.70 s; `unit.log`, `checks.json` |
| `npm run test:integration` | PASS / exit 0; 47 passed, 0 failed, 1 skipped | 156.62 s including build; `integration.log`, `checks.json` |
| `npm run lint` | PASS / exit 0; 139 sources, 52 contracts | 3.62 s including build; `lint.log`, `checks.json` |
| PostgreSQL deadlock counters after completion | PASS; zero for focused `ba11_scheduler_fixed` and full-suite `ba11_verified` | `deadlock-counters.log`, `final-database.log`; original scheduler baseline has 1 |

The integration skip is BA-08-T01: qualifying Linux rootless supervisor socket unavailable. It is NOT RUN, not accepted isolation evidence. Builds emitted the existing >500 kB chunk warnings. An initial final-gate shell invocation stopped during the unit build because PowerShell treated that warning on stderr as terminating; `unit-shell-interrupted.log` preserves the incomplete attempt. Unit/integration/lint were then run to completion with native exit-code collection, without changing test assertions or build configuration.

Diagnostic history is retained: `reproduction.*` first proved the Command cycle. An initial participant-admission `FOR SHARE` attempt passed its focused and full suites (`focused.*`, `initial-*`), but both databases recorded a background Floor Evidence deadlock through the same scheduler lock. That incomplete fix was reverted. The final scheduler change removes the common conflict for Evidence writers; zero counters supplement, rather than replace, the controlled regression. No Command or Floor production code is changed by BA-11.

After recording zero remaining database clients, the identity-checked task containers `plenum-ba11-deadlock-db` and `plenum-ba11-deadlock-s3` were removed; unrelated containers were preserved. Historical generated output was restored from the preflight copies. All 23 pre-existing BA-10 paths retain their prior content, with only the two documented test-harness additions and the new Project state entry on shared files. `git diff --check` passes. No commit, push or deployment occurred.

### Compatibility and remaining work

No migration, dependency, public contract, configuration or persistence-format change belongs to this fix. The preserved BA-10 migration 048 remains part of the combined candidate, not a new BA-11 migration. Reverting the single locking clause would restore the demonstrated defect; no data rollback is needed. Lifecycle writes still conflict with the scheduler claim and duplicate schedulers still skip claimed Sessions. This change adds no participant admission lock. Converged throughput/fairness measurements remain BA-12 work, not a claimed result here.

Full BA-11 remains open: consolidated production-boundary coverage and omitted-wiring negatives, same-candidate browser/security/deployment/observability gates, supported-profile and CI/Linux evidence. BA-08 activated isolation, BA-09 genuine reconstruction, BA-10 real custody and both golden proofs, BA-12 voice latency/load and final release approval remain unchanged. Existing PS-830 human acceptance and PS-840/842 decisions retain their original scope.

The dated PS-120 evidence below is historical and is not the current candidate's gate record.

Date: 2026-10-18. Status: implementation evidence, not release approval.

## Environment

- Node.js 24.22.0 container pinned by digest; npm 11.19.1; TypeScript 5.9.3.
- PostgreSQL 18.6 Alpine container with synthetic disposable data.

## Evidence

| Gate | Result | Demonstrated behavior |
|---|---|---|
| `npm run typecheck` | PASS | Strict command-kernel and contract types |
| `npm test` | PASS, 5/5 | Canonical serialization and five versioned contracts plus PS-100/110 regressions |
| `npm run test:integration` | PASS, 4/4 | Six concurrent retries commit once; collision refused; rejection and reconciliation each write one receipt/event; stale/wrong Authority writes nothing; forced receipt failure rolls back state/event/outbox/sequence |
| `npm run test:db` | PASS, 4/4 | Same Pg18 database boundary suite exposed as CMD-PLATFORM-DB |
| `npm run lint` | PASS | Contract IDs, names and dependency graph |
| `node scripts/validate-promptbook.mjs` | PASS | 31 tasks, REQ 94/94, INV 28/28, no cycles |

Migration `006_command_kernel.sql` is additive. It extends receipts and events with correlation and aggregate metadata and adds one recorded outcome per Command. Recovery is forward-fix; no destructive rollback is authorized after production data uses the new columns/index.

ADR-001, ADR-003 and ADR-015 are Confirmed; ADR-014 was Approved on 2026-10-20 with named Technical Lead sign-off remaining. OPEN-016 authority transfer remains unresolved. OPEN-017 recovery/custody was resolved by user direction on 2026-10-23; its implementation remains assigned to PS-510/530. No publisher is implemented: committed rows stay `pending` for the later outbox worker, so no external call occurs inside the transaction.
