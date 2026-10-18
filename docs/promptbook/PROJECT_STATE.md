# Project state

Updated: 2026-10-18.

## Repository

- The repository baseline is organized and PS-100 has established the first application workspaces.
- The corpus is under `docs/corpus/`; reference implementations are under `references/`.
- The official Fractured Order golden reference is the verified snapshot under `references/`, pinned to commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b`.
- PS-000 has produced the classified reference inventory, hard-coding register, route/service/data/realtime maps and parity fixture plan under `docs/reference-audit/`, `definitions/fractured-order/` and `tests/parity/`.
- Application implementation includes the PS-100 contract kernel and PS-110 OIDC, trusted Session context, policy, PostgreSQL and reassignment slice. No HTTP transport or rendered frontend exists yet.
- Promptbook generation changes only `docs/promptbook/`.

## Observed maturity

| Area | Design specified | Implementation started | Tested locally | Integrated | Security reviewed | Performance verified | Deployment verified | Release approved |
|---|---|---|---|---|---|---|---|---|
| Corpus 01-12 | Yes, unratified | n/a | n/a | n/a | No | No | No | No |
| Reference slice v0.2.0 | Partial Phase 1 | Yes | PS-001 PASS on Node 24.22.0/Pg 18.6: syntax, unit 12/12, migrate, seed, start, smoke 31/31, DB 7/7, browser | Spike only | Partial: exercised RLS, immutability, concurrency, and Authority refusal; no full review | No | Disposable Docker only | No |
| Promptbook | Yes | n/a | PASS: 31 prompts, JSON Schema, 94/94 REQ, 28/28 INV, no cycles, nine samples | n/a | n/a | n/a | n/a | n/a |
| PS-000 reference audit | Yes, with OPEN-026 review blocks | Yes | PASS: pin/tree, 30 role capabilities, 15 operational capabilities, 15 hard-coding rows and 17 parity targets | Documentation/definition inventory only | No | n/a | n/a | No |
| First-release application | Specified | PS-100 contract kernel | PASS: clean install, lint, typecheck, build and 2/2 contract tests on Node 24.22.0 | Shared contracts compile in server and Runtime consumer | Partial: negative trusted-context tests only; no formal review | No | No | No |
| PS-110 identity/policy slice | Specified with OPEN-007/025 limits | Yes | PASS: typecheck, unit 5/5 and integration 4/4 on Node 24.22.0/Pg18.6 | OIDC mapping, forced RLS, context, reassignment and revocation integrated | Control tests pass; Security Owner approval pending | No | Disposable Docker only | No |

## Current command evidence

- `npm test`: PASS, 12/12, run during generation outside the filesystem sandbox on Node 22.16.0. Diagnostic only because Node 24 is required.
- `node --check` over `src/**/*.mjs` and `test/**/*.mjs`: PASS on Node 22.16.0. Diagnostic only.
- PostgreSQL-backed migrate/smoke/dbtest: NOT RUN in this generation; Docker daemon unavailable.
- Historical 2026-10-17 slice record: migrate/smoke/dbtest PASS on PostgreSQL 16, real browser and Pg18 NOT RUN.
- Fractured Order exported tree re-index: PASS; actual tree `771510b6180bd4826dc5688789d131f2109eeb62` matched the pinned snapshot.
- `CMD-PARITY` inventory validation: PASS on Node 22.16.0; pin/tree, exact source-manifest coverage, evidence anchors, classifications, review blocks and fixture targets passed. Behavioral AC-09 remains NOT RUN.
- `CMD-PROMPTBOOK-VALIDATE`: PASS after render; 31 tasks, REQ 94/94, INV 28/28 and no dependency cycles.
- PS-001 supported-stack preflight: Node 24.22.0, npm 11.19.1, PostgreSQL 18.6, and `pg` 8.23.1 recorded in `docs/reference-slice-verification.md`.
- `CMD-SLICE-CHECK`, `CMD-SLICE-UNIT`, `CMD-SLICE-MIGRATE`, `CMD-SLICE-SEED`, `CMD-SLICE-START`, and `CMD-SLICE-SMOKE`: PASS on the supported stack; smoke passed 31/31.
- `CMD-SLICE-BROWSER`: PASS in managed Chromium 155; the seeded Designer created a project and received HTTP 201. A nonfunctional `/favicon.ico` request returned 401.
- `CMD-SLICE-DB`: PASS with exit code 0; 7/7 tests passed after placing setup, tests, and pool cleanup in one `node:test` suite. DB-02, DB-04, and foreign/fenced Authority refusal are accepted for the v0.2 slice scope.
- PS-100 clean root `npm ci --ignore-scripts`: PASS on Node 24.22.0/npm 11.19.1; TypeScript 5.9.3; audit reported 0 vulnerabilities.
- `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, and `CMD-PLATFORM-BUILD`: PASS on Node 24.22.0. Four workspaces compile from the root lockfile; contract lint checked four application/package source files, three versioned contracts, canonical naming, and an acyclic workspace graph.
- `CMD-PLATFORM-TEST`: PASS 2/2 (`PS-100-T01`, `PS-100-T02`) on Node 24.22.0. The retained slice domain regression also passed 12/12 without source or OpenAPI changes. Full evidence is in `docs/ps-100-verification.md`.
- PS-110 `CMD-PLATFORM-TYPECHECK`: PASS; `CMD-PLATFORM-TEST`: PASS 5/5; `CMD-PLATFORM-INTEGRATION`: PASS 4/4 on Node 24.22.0/PostgreSQL 18.6. DB-01 used a reused pool connection under `plenum_app`; PS-110-T03 included forced transactional rollback. Full evidence is in `docs/ps-110-verification.md`.
- PS-120 `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-INTEGRATION`, and `CMD-PLATFORM-DB`: PASS on Node 24.22.0/PostgreSQL 18.6. Six concurrent retries produced one commit; recorded rejection/reconciliation, authority refusal, collision, and rollback-without-sequence-gap passed. Full evidence is in `docs/ps-120-verification.md`.

## Next eligible work

`PS-120` is implementation-complete on Node 24.22.0/PostgreSQL 18.6. Milestone exit remains blocked on confirmation of ADR-001/ADR-003; authority transfer and evidence custody remain OPEN-016/OPEN-017. `PS-130 — Build the Release package compiler and registry` is the exact next task.
