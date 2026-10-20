# PS-001 supported-stack verification

Date: 2026-10-18
Overall status: **PASS — PS-001 is complete**

The v0.2.0 reference slice was exercised on Node.js 24 and PostgreSQL 18 with disposable local resources. Syntax, unit, migration, seed, startup, HTTP smoke, database, and real-browser checks all passed. This verifies the slice on the supported floor; it does not make the executable spike production-ready or release-approved.

The governing dependencies `ADR-008` and `ADR-009` are Approved as of 2026-10-20, and `ADR-015` is Confirmed. Named specialist sign-offs and approver identities under `OPEN-001` remain unresolved.

## Environment

| Component | Exact observed version | Notes |
|---|---|---|
| Node.js | `v24.22.0` | Official `node:24-alpine` image; satisfies the Node 24 floor in Approved `ADR-008` |
| npm | `11.19.1` | npm bundled in the Node image used for slice commands |
| PostgreSQL | `18.6 (Debian 18.6-1.pgdg13+2)` | Official `postgres:18` image; tested minor recorded for Approved `ADR-009` |
| `pg` | `8.23.1` | Exact version resolved by `package-lock.json`; `pg-pool` resolved to `3.14.0` |
| Docker Engine | `28.5.1` | Disposable local containers |
| Docker Compose | `v2.40.2-desktop.1` | Disposable database lifecycle |
| Playwright CLI | `0.1.22` | Official `@playwright/cli`; managed Chromium 155 |

The first attempted Node harness, `node:24-bookworm-slim`, was unusable on this Docker Desktop instance (`exec format error`, followed by an image-layer `input/output error`). The official Alpine variant ran successfully and is the environment reported above. The repository's bundled Playwright wrapper currently targets `@playwright/mcp`, which no longer exposes `playwright-cli`; the browser check therefore used the current official `@playwright/cli` package directly.

## Command evidence

All slice scripts were run unchanged from `references/plenum-runtime-slice/package.json`. The source tree was mounted read-only into the Node 24 container; dependencies were installed with `npm ci` into the disposable Docker volume `plenum_ps001_node_modules`. The PostgreSQL container and all data were disposable. `DATABASE_URL` used the documented local-only owner account and is not reproduced here.

| Reference | Command (cwd `references/plenum-runtime-slice`) | Result | Exit / duration | Evidence |
|---|---|---|---|---|
| `CMD-SLICE-CHECK` | `find src test -type f -name '*.mjs' -print -exec node --check '{}' ';'` | **PASS** | `0`; about 1.56 s | Eight `.mjs` files printed and checked without syntax errors |
| `CMD-SLICE-UNIT` | `npm test` | **PASS** | `0`; runner duration `130.586538 ms` | 12 tests, 12 pass, 0 fail |
| `CMD-SLICE-MIGRATE` | `npm run migrate` | **PASS** | `0`; about 1.52 s | Applied `001_core`, `002_runtime_sync_evidence`, `003_collaboration`, and `004_security` to PostgreSQL 18.6 |
| `CMD-SLICE-SEED` | `npm run seed` | **PASS** | `0`; under 2 s | Synthetic organization, principals, Release, Session, and Seats created; IDs below |
| `CMD-SLICE-START` | `npm start` | **PASS** | Persistent process; ready in under 2 s | `Plenum reference slice listening on http://127.0.0.1:3000 as deployment 2e7a951e-a83c-43e5-b62a-e9aa335bbfa7` |
| `CMD-SLICE-SMOKE` | `npm run smoke` | **PASS** | `0`; under 4 s | 31 checks passed; Session `ccbafef1-f070-4edf-a0fe-a4f36e587382` |
| `CMD-SLICE-DB` | `npm run dbtest` | **PASS** | `0`; runner duration `550.357575 ms` | 7 tests, 7 pass, 0 fail; one suite |
| `CMD-SLICE-BROWSER` | `npx --yes --package @playwright/cli@0.1.22 playwright-cli -s=ps001-pass open http://127.0.0.1:3001`, then `fill`, `click`, and `screenshot --filename output/playwright/ps-001-browser.png --full-page` | **PASS** | Commands `0`; under 25 s total | Chromium loaded the workstation and `Create project` returned HTTP 201. [Screenshot](../output/playwright/ps-001-browser.png); snapshot `.playwright-cli/page-2026-10-18T05-22-56-615Z.yml` |

Port 3001 was a test-only host-loopback forwarder to the server's container-loopback port 3000. The application itself remained bound to `127.0.0.1`, and only synthetic seeded identities were used.

### Seed output

```text
organizationId  4a840b72-bbb6-47a9-a547-c9ed114ef12c
designer        c3e0640a-6fb2-47ce-88af-1de50c1c06cd
publisher       bdea1985-5986-4941-9413-ab8aa355e247
operator        93b93ad6-4c0c-4bea-8c67-a3f73420d6b6
scribe          8535221d-2dce-45c7-8767-0cb769c4ac92
facilitator     88b8490f-2d33-42f8-96e7-47281ea72c1e
white_cell      b44afb2a-78fe-4fdd-841e-2869eba9ea15
```

### Database lifecycle fix and passing result

```text
▶ reference slice database boundaries
  ✔ DB-01: the application role only sees its own organization
  ✔ DB-01: without tenant context the application role sees nothing
  ✔ DB-01: the application role cannot write into another organization
  ✔ DB-05: releases, revisions and evidence cannot be updated or deleted, even by the owner
  ✔ DB-02 / DB-04: concurrent retries of one command commit once
  ✔ ADR-001: a deployment that is not the Session Authority cannot commit
  ✔ ADR-001: a fenced authority cannot commit
ℹ tests 7
ℹ suites 1
ℹ pass 7
ℹ fail 0
ℹ duration_ms 550.357575
EXIT_CODE=0
```

`test/db.test.mjs` now encloses its existing setup, seven tests, and `owner.end()` cleanup hook in one `node:test` suite. This keeps the pool alive until every nested test has finished. No assertion or product behavior changed. The supported-stack rerun proves the six-retry database counts and both foreign- and fenced-Authority refusal paths.

### Browser evidence

The browser snapshot exposed the four workstation regions and their semantic controls. With the synthetic Designer identity, `Create project` produced:

```text
HTTP 201
projectId 0913f1f7-86be-4ee3-808f-d020b4d4a346
draftId   3ee8b768-0e15-4002-b30d-7eb9c6ef8692
version   1
```

The only console error was a `401 Unauthorized` request for `/favicon.ico`; it did not affect the workflow. This is a minor browser polish defect, not a failed critical journey.

## Required evidence assessment

| Evidence ID | Status on Node 24 / PostgreSQL 18 | Basis |
|---|---|---|
| `SYNC-05`, `SYNC-06`, `SYNC-07`, `SYNC-09`, `SYNC-12` | **PASS** for the v0.2 smoke scope | 31/31 HTTP smoke checks, including rejected receipts, replay/collision, stale state, projections, and gap-free evidence |
| `DB-01` | **PASS** | Own-tenant read, missing-context denial, cross-tenant write denial under `plenum_app` |
| `DB-02` | **PASS** | State/evidence/receipt behavior and post-command database counts passed under six concurrent retries |
| `DB-04` | **PASS** | All six retries returned one evidence sequence; exactly one non-replay, event, and receipt were asserted |
| `DB-05` | **PASS** | Owner and `plenum_app` update/delete/truncate protections passed |

The smoke suite preserved DEC-42 happy, return, and forbidden paths. The database suite proved RLS, immutability, concurrent idempotency, and foreign/fenced Authority refusal on the supported Node runtime.

## Preserve / change / deprecate inventory

| Baseline file group | Classification | Reason / follow-up |
|---|---|---|
| `definitions/fractured-order-reference.json` | **Preserve** | Definition-driven transitions and required fields passed unit and smoke checks |
| `migrations/001_core.sql` through `004_security.sql` | **Preserve** | Fresh PostgreSQL 18.6 application succeeded in order; RLS and append-only checks passed |
| `src/domain.mjs` | **Preserve** | 12/12 domain tests passed on Node 24 |
| `src/server.mjs` and `src/db.mjs` | **Preserve** | Startup, 31 HTTP checks, concurrent idempotency, and Authority refusal checks passed |
| `src/migrate.mjs` and `src/seed.mjs` | **Preserve** | Fresh migration and synthetic seed completed on PostgreSQL 18.6 |
| `public/index.html` | **Preserve with minor follow-up** | Real Chromium flow passed; add or exempt a favicon to remove the 401 console noise if desired |
| `contracts/openapi.yaml` | **Preserve** | No contract mismatch was observed in the exercised flow |
| `test/domain.test.mjs` and `test/smoke.mjs` | **Preserve** | 12 unit and 31 smoke checks passed |
| `test/db.test.mjs` | **Change completed** | Setup, all seven tests, and cleanup now share one suite lifetime; 7/7 passed on Node 24/PostgreSQL 18 |
| `package-lock.json` | **Preserve** | Deterministically resolved and tested `pg` 8.23.1 |
| `package.json` | **Change candidate** | It declares `pg` as `^8.13.3`; decide whether Approved `ADR-009`'s pinning rule also requires an exact direct-dependency declaration |
| `docker-compose.yml` | **Change candidate** | It uses floating major tag `postgres:18`; pin the tested PostgreSQL 18 minor/image digest when named specialist sign-offs complete or the repository adopts that rule |
| `README.md` | **Change** | Replace the PostgreSQL 16-only historical record with this supported-stack result and document the reproducible real-browser command after the DB gate is repaired |
| Any baseline file | **Deprecate: none** | No obsolete file or behavior was established by this verification |

Client mutation-state distinctions are not changed by this task. No schema, Command, event, enum, error, or public API contract was added.

## Migration, recovery, and next action

No migration or application file changed. Migrations 001–004 were exercised from an empty PostgreSQL 18.6 database. The only code change is the test-suite boundary in `test/db.test.mjs`; reverting that small change is the code rollback. Deleting the disposable local database/volume removes all synthetic run data and has no production implication.

PS-001 is complete. The exact next task is: **begin `PS-100`, whose `PS-001` prerequisite is now satisfied.**
