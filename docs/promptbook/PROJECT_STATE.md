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
| Reference slice v0.2.0 | Partial Phase 1 | Yes | Historical PASS on Pg16; current unit/syntax PASS on unsupported Node22 | Spike only | No | No | No | No |
| Promptbook | Yes | n/a | PASS: 31 prompts, JSON Schema, 94/94 REQ, 28/28 INV, no cycles, nine samples | n/a | n/a | n/a | n/a | n/a |
| First-release application | Specified | No | No | No | No | No | No | No |

## Current command evidence

- `npm test`: PASS, 12/12, run during generation outside the filesystem sandbox on Node 22.16.0. Diagnostic only because Node 24 is required.
- `node --check` over `src/**/*.mjs` and `test/**/*.mjs`: PASS on Node 22.16.0. Diagnostic only.
- PostgreSQL-backed migrate/smoke/dbtest: NOT RUN in this generation; Docker daemon unavailable.
- Historical 2026-10-17 slice record: migrate/smoke/dbtest PASS on PostgreSQL 16, real browser and Pg18 NOT RUN.

## Next eligible work

`PS-000` and `PS-001` are ready. Run PS-000 next to classify the official snapshot and create the parity inventory required by PS-200. PS-001 may proceed independently with a Node 24+ and PostgreSQL 18 preflight. No later implementation task is eligible until its prerequisites have actual evidence.
