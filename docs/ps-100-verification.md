# PS-100 verification report

Date: 2026-10-18  
Scope: TypeScript workspace and shared contract kernel  
Risk: Medium (new build boundary and security-sensitive context contract; no deployed service or persistent write)

## Environment

| Component | Verified version |
|---|---|
| Node.js | 24.22.0 |
| npm | 11.19.1 |
| TypeScript | 5.9.3, pinned by the root lockfile |
| Container image | `node@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |

The platform install and checks ran in a disposable Node 24 container with a dedicated `node_modules` volume. Source and generated `dist/` outputs were bind-mounted from the repository. The retained reference slice is outside the workspace.

## Acceptance evidence

| Criterion | Result | Evidence |
|---|---|---|
| Clean install from the root lockfile | PASS | `npm ci --ignore-scripts`; exit 0; 2.36 s; 5 workspace/dependency packages installed; audit reported 0 vulnerabilities |
| Deterministic contract lint | PASS | `npm run lint`; exit 0; 1.42 s; 4 application/package sources, 3 versioned contracts, canonical naming and acyclic workspace graph |
| Shared contracts compile for server and frontend consumer | PASS | `npm run typecheck`; exit 0; 1.59 s; `npm run build`; exit 0; 1.20 s; outputs under each workspace `dist/` directory |
| Required contract and authorization tests | PASS | `npm test`; exit 0; 2.22 s; `PS-100-T01` and `PS-100-T02` passed (2/2) |
| Reference slice remains runnable | PASS | `npm test` in `references/plenum-runtime-slice`; exit 0; 1.18 s; 12/12 domain tests passed on Node 24.22.0 |
| Reference slice source and OpenAPI unchanged by PS-100 | PASS | `git diff -- references/plenum-runtime-slice` produced no output |
| Promptbook integrity | PASS | `node scripts/render-promptbook.mjs` then `node scripts/validate-promptbook.mjs`; validation exit 0; 0.79 s; 31 tasks, REQ 94/94, INV 28/28, no dependency cycles |

## Demonstrated behavior

- `command-envelope-v1`, `event-envelope-v1`, and `error-envelope-v1` expose explicit public TypeScript and JSON Schema contracts.
- Contract lint rejects non-camelCase JSON fields, selected noncanonical Glossary aliases, simulation-specific vocabulary, demo identity handling, tenant identifiers in shared packages, and circular workspace dependencies.
- The server-only boundary rejects absent authentication, incomplete Participant context, and a mismatched Active Role Context with canonical error envelopes.
- The Runtime consumer compiles against both shared packages and keeps `local_pending` as client-only state.
- Plugin bindings require version and digest fields; platform-adapter bindings are not yet applicable because no adapter exists in this slice.

## Data, deployment, and recovery

- Database migrations: none.
- External APIs or deployed services: none.
- Rollback: remove the new root workspace/configuration and application/package files; the retained reference slice continues independently.
- Forward fix: contract changes remain additive within v1; breaking-version and migration policy remains unresolved under `OPEN-012`.

## Open governance and QA limits

- `ADR-008` was Approved by Product Owner direction on 2026-10-20. Named Technical Lead sign-off remains required.
- `OPEN-012` compatibility policy and `OPEN-022` remaining engine choices are unresolved.
- Node 26 target execution, browser/UI, PostgreSQL integration, performance, and deployment checks are NOT RUN because PS-100 creates no UI, persistence, or deployable service. The relevant later tasks own those gates.
