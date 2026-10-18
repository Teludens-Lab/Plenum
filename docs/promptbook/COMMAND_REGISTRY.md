# Command registry

Commands are executable only when status is **Verified**. A Proposed entry is a contract for the task that creates it, not permission to guess a script.

| ID | Command / source | CWD | Prerequisites and environment | Expected timeout | Evidence | Status |
|---|---|---|---|---:|---|---|
| `CMD-PROMPTBOOK-RENDER` | `node scripts/render-promptbook.mjs` from this promptbook | `docs/promptbook` | Node; no network | <10s | Prompt count and generated files | Verified after generation |
| `CMD-PROMPTBOOK-VALIDATE` | `node scripts/validate-promptbook.mjs` | `docs/promptbook` | Render first | <10s | `PROMPTBOOK_VALIDATION_REPORT.md` | Verified after generation |
| `CMD-SLICE-CHECK` | `node --check` for every `src/*.mjs` and `test/*.mjs` | `references/plenum-runtime-slice` | Node >=24 required for authoritative run | <30s | Exit code 0 | Current diagnostic PASS on Node22; supported run pending PS-001 |
| `CMD-SLICE-UNIT` | `npm test` from `package.json` | Slice | Node >=24; no DB | <1m | 12 domain tests | Historical PASS; current diagnostic PASS on Node22; supported run pending PS-001 |
| `CMD-SLICE-MIGRATE` | `npm run migrate` from `package.json` | Slice | `DATABASE_URL`; disposable Pg18; migration owner | <2m | Applied 001-004 | Historical PASS on Pg16; Pg18 NOT RUN |
| `CMD-SLICE-SEED` | `npm run seed` from `package.json` | Slice | Migrated disposable database; `DATABASE_URL`; writes synthetic `DEMO_*` values for the current shell | <1m | Seeded organization, Release, Session, Seats, and demo principals | Historical PASS on Pg16; current NOT RUN |
| `CMD-SLICE-START` | `npm start` from `package.json` | Slice | Migrated/seeded DB; `DATABASE_URL`, `DEMO_*`, `PLENUM_LOCAL_DEMO=1`, `PLENUM_DEPLOYMENT_ID`; loopback-only for demo identity | Persistent process; ready <30s | Readiness response and startup log without secrets | Historical PASS on Pg16; current NOT RUN |
| `CMD-SLICE-SMOKE` | `npm run smoke` from `package.json` | Slice | Running server, migrated/seeded DB, `DEMO_*`, `PLENUM_LOCAL_DEMO=1`, `PLENUM_DEPLOYMENT_ID` | <3m | 31 HTTP checks | Historical PASS on Pg16; current NOT RUN |
| `CMD-SLICE-DB` | `npm run dbtest` from `package.json` | Slice | Same as smoke; `DATABASE_URL` is migration owner | <3m | 7 DB tests | Historical PASS on Pg16; current NOT RUN |
| `CMD-SLICE-BROWSER` | Exact command not present; PS-001 must discover or create a documented real-browser check | Slice | Running slice; browser | <5m | Screenshots and flow log | Proposed by PS-001 |
| `CMD-PLATFORM-LINT` | Exact script created by PS-100 | Repo root | Clean install from platform lockfile | <5m | Lint report | Proposed by PS-100 |
| `CMD-PLATFORM-TYPECHECK` | Exact script created by PS-100 | Repo root | Clean install | <5m | Typecheck output | Proposed by PS-100 |
| `CMD-PLATFORM-TEST` | Exact script created by PS-100 | Repo root | Clean install | <10m | Unit/contract report | Proposed by PS-100 |
| `CMD-PLATFORM-BUILD` | Exact script created by PS-100 | Repo root | Clean install | <10m | Build artifacts | Proposed by PS-100 |
| `CMD-PLATFORM-INTEGRATION` | Exact script created by PS-100 | Repo root | Disposable Pg18 and service fixtures | <15m | Integration report | Proposed by PS-100 |
| `CMD-PLATFORM-DB` | Exact script created by PS-100 | Repo root | Disposable Pg18 under real app role | <15m | DB/RLS/migration report | Proposed by PS-100 |
| `CMD-PLATFORM-E2E` | Exact script created by PS-150 | Repo root | Built apps, Pg18, browser | <20m | Browser evidence | Proposed by PS-150 |
| `CMD-PLATFORM-A11Y` | Exact script created by PS-150 | Repo root | Reference screens and browser | <15m | Accessibility evidence | Proposed by PS-150 |
| `CMD-PARITY` | Exact script created by PS-000/PS-200 | Repo root | Official snapshot manifest and parity fixtures | <20m | AC-09 matrix | Proposed by PS-000 |
| `CMD-AIRGAP` | Exact script created by PS-220/PS-530 | Repo root | Offline bundle; network deny | <30m | Egress and workflow evidence | Proposed by PS-530 |
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

Never put secrets in this registry. Future tasks must record exact script sources and change Proposed to Verified only after a PASS on the declared environment.
