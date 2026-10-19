# Command registry

Commands are executable only when status is **Verified**. A Proposed entry is a contract for the task that creates it, not permission to guess a script.

| ID | Command / source | CWD | Prerequisites and environment | Expected timeout | Evidence | Status |
|---|---|---|---|---:|---|---|
| `CMD-PROMPTBOOK-RENDER` | `node scripts/render-promptbook.mjs` from this promptbook | `docs/promptbook` | Node; no network | <10s | Prompt count and generated files | Verified after generation |
| `CMD-PROMPTBOOK-VALIDATE` | `node scripts/validate-promptbook.mjs` | `docs/promptbook` | Render first | <10s | `PROMPTBOOK_VALIDATION_REPORT.md` | Verified after generation |
| `CMD-SLICE-CHECK` | `node --check` for every `src/*.mjs` and `test/*.mjs` | `references/plenum-runtime-slice` | Node >=24 required for authoritative run | <30s | Exit code 0 | Verified; PASS on Node 24.22.0 in PS-001 |
| `CMD-SLICE-UNIT` | `npm test` from `package.json` | Slice | Node >=24; no DB | <1m | 12 domain tests | Verified; PASS 12/12 on Node 24.22.0 in PS-001 |
| `CMD-SLICE-MIGRATE` | `npm run migrate` from `package.json` | Slice | `DATABASE_URL`; disposable Pg18; migration owner | <2m | Applied 001-004 | Verified; PASS on PostgreSQL 18.6 in PS-001 |
| `CMD-SLICE-SEED` | `npm run seed` from `package.json` | Slice | Migrated disposable database; `DATABASE_URL`; writes synthetic `DEMO_*` values for the current shell | <1m | Seeded organization, Release, Session, Seats, and demo principals | Verified; PASS on PostgreSQL 18.6 in PS-001 |
| `CMD-SLICE-START` | `npm start` from `package.json` | Slice | Migrated/seeded DB; `DATABASE_URL`, `DEMO_*`, `PLENUM_LOCAL_DEMO=1`, `PLENUM_DEPLOYMENT_ID`; loopback-only for demo identity | Persistent process; ready <30s | Readiness response and startup log without secrets | Verified; PASS on Node 24.22.0/PostgreSQL 18.6 in PS-001 |
| `CMD-SLICE-SMOKE` | `npm run smoke` from `package.json` | Slice | Running server, migrated/seeded DB, `DEMO_*`, `PLENUM_LOCAL_DEMO=1`, `PLENUM_DEPLOYMENT_ID` | <3m | 31 HTTP checks | Verified; PASS 31/31 on Node 24.22.0/PostgreSQL 18.6 in PS-001 |
| `CMD-SLICE-DB` | `npm run dbtest` from `package.json` | Slice | Same as smoke; `DATABASE_URL` is migration owner | <3m | 7 DB tests | Verified; PASS 7/7 on Node 24.22.0/PostgreSQL 18.6 after PS-001 suite-lifecycle fix |
| `CMD-SLICE-BROWSER` | `npx --yes --package @playwright/cli@0.1.22 playwright-cli -s=ps001 open "$API_URL"`; use `snapshot`, exercise the seeded Designer `Create project` flow, then `screenshot --filename output/playwright/ps-001-browser.png --full-page` and `close` | Slice | Running loopback-only slice; seeded synthetic identity; Chromium; `API_URL` | <5m | HTTP result, snapshot, console log, and screenshot | Verified; PASS in Chromium 155 in PS-001; `/favicon.ico` returned nonfunctional 401 |
| `CMD-PLATFORM-LINT` | `npm run lint` | Repo root | Node >=24; `npm ci` from root lockfile | <5m | Contract IDs, Glossary aliases, DEC-38 naming, package graph, tenant/demo leakage | Verified; PASS across 28 sources and 17 contracts on Node 24.22.0 in PS-230 |
| `CMD-PLATFORM-TYPECHECK` | `npm run typecheck` | Repo root | Node >=24; `npm ci` from root lockfile | <5m | TypeScript diagnostics | Verified; PASS on Node 24.22.0 in PS-220 |
| `CMD-PLATFORM-TEST` | `npm test` | Repo root | Node >=24; `npm ci` from root lockfile | <10m | Node test report with evidence IDs | Verified; PASS 36/36 on Node 24.22.0 in PS-230 |
| `CMD-PLATFORM-BUILD` | `npm run build` | Repo root | Node >=24; `npm ci` from root lockfile | <10m | `dist/` JavaScript, declarations, source maps and production Runtime web bundle | Verified; PASS on Node 24.22.0 in PS-220 |
| `CMD-PLATFORM-INTEGRATION` | `npm run test:integration` | Repo root | Node >=24; root lockfile installed; `DATABASE_URL` targets an empty disposable Pg18 database owned by the migration role; `S3_ENDPOINT` targets a disposable S3-compatible service | <15m | OIDC/RLS/Command/Release/Plugin regressions plus authorized Runtime cursor, snapshot, SSE and polling reconnect behavior | Verified; PASS 11/11 on Node 24.22.0/PostgreSQL 18.6/SeaweedFS 4.48 in PS-230 |
| `CMD-PLATFORM-DB` | `npm run test:db` | Repo root | Node >=24; root lockfile; empty disposable Pg18; `DATABASE_URL` uses migration owner while requests switch to `plenum_app` | <15m | Command atomicity, Release integrity, tenant controls and authorized Runtime reconnect | Verified; latest alignment run PASS 8/8 after clean migrations 001-010 on host Node 22.16.0/PostgreSQL 18; diagnostic until repeated on Node >=24 |
| `CMD-PLATFORM-S3` | `npm run test:s3` | Repo root | Node >=24; root lockfile; `S3_ENDPOINT` targets a disposable S3-compatible service; optional test-only S3 region and credentials | <5m | Conditional immutable put/get/delete, collision and concurrent first-writer behavior | Verified; PASS 1/1 on Node 24.22.0/SeaweedFS 4.48 in PS-130 |
| `CMD-PLATFORM-E2E` | `npm run test:e2e` from root `package.json`; command rebuilds server/web output before Playwright; config at `tests/e2e/playwright.config.mjs` | Repo root | Root lockfile; empty disposable Pg18 via `DATABASE_URL`; Playwright Chromium | <20m | Seven browser tests and screenshots under `output/playwright/ps-150/` | Verified; PASS 7/7 on Node 24.21.0/PostgreSQL 18/Playwright 1.64.1 Chromium, including the full RFI lifecycle, stale-answer race, cross-Team denial, direct/broadcast communications, forbidden routing, receipt replay, reload/reconnect deduplication, proposal isolation, multi-round approval, accepted evidence and two-sided closure |
| `CMD-PLATFORM-A11Y` | `npm run test:a11y` from root `package.json`; `@a11y` Playwright test with axe | Repo root | Same browser/database fixture as E2E | <15m | Keyboard behavior, semantic form and automated axe result | Verified; PASS 1/1 on Node 24.22.0/PostgreSQL 18.6/Chromium 156 in PS-150 |
| `CMD-PARITY` | `node tests/parity/validate-reference-inventory.mjs` | Repo root | Official snapshot manifest, classified inventory and parity fixture plan; no network | <10s | Pin, capability coverage, source-anchor and fixture-target status summary on stdout | Verified after PS-210 RFI/communications closure: command PASS on Node 24.22.0; 9 target PASS, 0 BLOCKED, 8 OUT_OF_SCOPE; AC-09 remains BLOCKED by the eight later-phase targets |
| `CMD-PS210-INFORMATION-LOAD` | `npm run test:load:information` | Repo root | Empty disposable Pg18 via `DATABASE_URL`; synthetic data only | <5m | Transactional recipient/delivery integrity and elapsed time for a 500-Participant broadcast and Stage-entry Inject fan-out | Verified on host Node 22.16.0, i7-12700H, 31.7 GiB, PostgreSQL 18/loopback: 500/500 recipients and deliveries; 363.99 ms broadcast, 581.05 ms Inject. Measurement only; OPEN-019 acceptance budgets and the 10-Session workload remain blocked/later-phase. |
| `CMD-AIRGAP` | `npm run test:airgap` | Repo root | Node >=24; root lockfile installed; Docker; pinned Node image already cached so the command never pulls | <5m | `test-results/airgap/ps-220-airgap.json`; rootless/read-only/no-egress controls, signed offline workflow, and isolated deterministic Plugin execution | Verified; PASS 6/6 on Node 24.22.0 in PS-230 |
| `CMD-GENERALIZATION` | Exact script created by PS-430 | Repo root | Two validation Releases | <30m | Source hash and Session results | Proposed by PS-430 |
| `CMD-OFFLINE` | Exact script created by PS-500 | Repo root | Browser/device partition harness | <20m | SYNC evidence | Proposed by PS-500 |
| `CMD-EVIDENCE-VERIFY` | Exact script created by PS-510 | Repo root | Verification export and independent anchor fixture | <10m | Tamper/omission report | Proposed by PS-510 |
| `CMD-REPORT-RECONCILE` | Exact script created by PS-520 | Repo root | Seed Session and exports | <15m | Source reconciliation | Proposed by PS-520 |
| `CMD-DEPLOYMENT-SMOKE` | Exact script created by PS-530 | Deployment fixture | Built images and disposable hosts | <30m | Profile smoke results | Proposed by PS-530 |
| `CMD-BACKUP-RESTORE` | Exact script created by PS-530 | Deployment fixture | Disposable source/restore targets | <60m | Restore and proof verification | Proposed by PS-530 |
| `CMD-LOAD-APP` | Exact script created by PS-540 | Load environment | Approved targets and named hardware | Budgeted by profile | Raw metrics | Proposed by PS-540 |
| `CMD-LOAD-VOTING` | Exact script created by PS-540 | Load environment | Poll burst fixture | Budgeted by profile | VOTE-14 metrics | Proposed by PS-540 |
| `CMD-LOAD-VOICE` | Exact script created by PS-540 | Media load environment | SFU/TURN and named network | Budgeted by profile | VOICE-12 metrics | Proposed by PS-540 |
| `CMD-LOAD-EXTENSIONS` | Exact script created by PS-540 | Load environment | Fixture Plugins | Budgeted by profile | EXT-19 metrics | Proposed by PS-540 |
| `CMD-SECURITY` | Exact script created by PS-550 | Repo/deployment roots | Locked dependencies and security fixtures | <30m | Scan and negative-control evidence | Proposed by PS-550 |

## Environment variables observed in the slice

- `DATABASE_URL`: PostgreSQL owner connection for migrations and DB tests.
- `DEMO_ORG_ID`, `DEMO_DESIGNER`, `DEMO_PUBLISHER`, `DEMO_OPERATOR`, `DEMO_SCRIBE`, `DEMO_FACILITATOR`, `DEMO_WHITE_CELL`: synthetic seed output.
- `PLENUM_LOCAL_DEMO=1`: mandatory local-only identity guard.
- `PLENUM_DEPLOYMENT_ID`: server-side authority UUID.
- `PLENUM_DB_ROLE`: optional local role override; defaults to `plenum_app`.
- `API_URL`, `PORT`: optional local endpoints.

## Environment variables observed in the platform

- `S3_ENDPOINT`: S3-compatible service URL for the object-store integration test.
- `S3_REGION`: optional test region; defaults to `us-east-1`.
- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: optional disposable-test credentials. Production credential values belong in the configured `S3Client` credential chain and are never recorded here.

Never put secrets in this registry. Future tasks must record exact script sources and change Proposed to Verified only after a PASS on the declared environment.
