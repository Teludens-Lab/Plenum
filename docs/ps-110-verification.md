# PS-110 verification

Date: 2026-10-18. Mode: production-oriented contract slice, not production approval.

## Environment

- Node.js 24.22.0 container: `node@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f`
- npm 11.19.1; TypeScript 5.9.3; `jose` 6.2.12; `pg` 8.23.1
- PostgreSQL 18.6 Alpine container: `postgres@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`
- Synthetic data only; disposable local database.

## Results

| Command | Result | Evidence |
|---|---|---|
| `npm ci --ignore-scripts` | PASS | 30 packages audited; 0 vulnerabilities |
| `npm run typecheck` | PASS | No TypeScript diagnostics |
| `npm test` | PASS | 5/5: PS-100 regressions, OIDC validation, default-deny projections |
| `npm run test:integration` | PASS | 4/4 on Pg18.6: OIDC mapping, DB-01 pooled RLS/read denial, atomic reassignment/rollback, revocation |

`PS-110-T03` deliberately fails the Audit Record insert after the preceding writes and verifies that the original active assignment, access revision and event count are unchanged. `DB-01` reuses the application pool for Organization A then B and proves a hostile Organization B write under Organization A context is rejected by forced RLS.

## Gates and limits

- ADR-012 Security Owner sign-off: confirmed complete on 2026-10-21.
- OPEN-007 and OPEN-025: resolved on 2026-10-21. Subsequent migration `018_identity_roles_and_governance.sql` and the identity/governance runtime implement the Keycloak profile contract and DEC-61 roles; this PS-110 evidence predates that follow-up.
- Node 26, a real Keycloak/remote issuer, browser cookie/CSRF behavior, performance, deployment and recovery: NOT RUN.
