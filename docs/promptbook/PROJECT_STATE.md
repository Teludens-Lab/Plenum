# Project state

Updated: 2026-10-18.

## Repository

- The repository baseline is organized for its first commit; application implementation has not started.
- The corpus is under `docs/corpus/`; reference implementations are under `references/`.
- The official Fractured Order golden reference is the verified snapshot under `references/`, pinned to commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b`.
- Application implementation beyond the v0.2.0 spike has not started.
- Promptbook generation changes only `docs/promptbook/`.

## Observed maturity

| Area | Design specified | Implementation started | Tested locally | Integrated | Security reviewed | Performance verified | Deployment verified | Release approved |
|---|---|---|---|---|---|---|---|---|
| Corpus 01-12 | Yes, unratified | n/a | n/a | n/a | No | No | No | No |
| Reference slice v0.2.0 | Partial Phase 1 | Yes | PS-001 PASS on Node 24.22.0/Pg 18.6: syntax, unit 12/12, migrate, seed, start, smoke 31/31, DB 7/7, browser | Spike only | Partial: exercised RLS, immutability, concurrency, and Authority refusal; no full review | No | Disposable Docker only | No |
| Promptbook | Yes | n/a | PASS: 31 prompts, JSON Schema, 94/94 REQ, 28/28 INV, no cycles, nine samples | n/a | n/a | n/a | n/a | n/a |
| First-release application | Specified | No | No | No | No | No | No | No |

## Current command evidence

- `npm test`: PASS, 12/12, run during generation outside the filesystem sandbox on Node 22.16.0. Diagnostic only because Node 24 is required.
- `node --check` over `src/**/*.mjs` and `test/**/*.mjs`: PASS on Node 22.16.0. Diagnostic only.
- PostgreSQL-backed migrate/smoke/dbtest: NOT RUN in this generation; Docker daemon unavailable.
- Historical 2026-10-17 slice record: migrate/smoke/dbtest PASS on PostgreSQL 16, real browser and Pg18 NOT RUN.
- PS-001 supported-stack preflight: Node 24.22.0, npm 11.19.1, PostgreSQL 18.6, and `pg` 8.23.1 recorded in `docs/reference-slice-verification.md`.
- `CMD-SLICE-CHECK`, `CMD-SLICE-UNIT`, `CMD-SLICE-MIGRATE`, `CMD-SLICE-SEED`, `CMD-SLICE-START`, and `CMD-SLICE-SMOKE`: PASS on the supported stack; smoke passed 31/31.
- `CMD-SLICE-BROWSER`: PASS in managed Chromium 155; the seeded Designer created a project and received HTTP 201. A nonfunctional `/favicon.ico` request returned 401.
- `CMD-SLICE-DB`: PASS with exit code 0; 7/7 tests passed after placing setup, tests, and pool cleanup in one `node:test` suite. DB-02, DB-04, and foreign/fenced Authority refusal are accepted for the v0.2 slice scope.

## Next eligible work

`PS-001` is complete: every `CMD-SLICE-*` reference passes on Node 24.22.0/PostgreSQL 18.6. `PS-100` is the next eligible task because its `PS-001` prerequisite has evidence. PS-000 remains separate work, and PS-200 remains ineligible until its recorded prerequisites have evidence.
