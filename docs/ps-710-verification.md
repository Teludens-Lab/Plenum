# PS-710 verification

Date: 2026-10-29. Environment: Windows, Node 24.22.1, npm 11.19.1, disposable PostgreSQL 18.6, disposable SeaweedFS 4.48, Playwright 1.64.1 Chromium. No production system or production data was changed.

## Delivered behavior

- `project-portal-v1`: server-owned Organization context, bounded Project search/list pagination, ownership, collaborators, status, Release count, recent work, and least-privilege Admin/Designer/Publisher/Reviewer views.
- `template-library-v1`: Organization-scoped Simulation Template browse/start flow using the existing Core Design copy contract; optional Scenario content remains excluded unless explicitly selected.
- Transactional, idempotent, version-aware Project create/archive/reopen operations with original-response replay, collision rejection, stale-version recovery, RLS, and audit records.
- Visible blank and Template Project creation, Studio resume links, archive confirmation, reopen, loading/empty/error/conflict/read-only/unauthorized recovery, and explicit Operator-only denial.
- Additive migration `026_product_portal`, OpenAPI paths, shared event contracts, logical Organization archive compatibility, and synthetic persona fixtures.

Client mutation state is limited to request progress and server-confirmed Project state. REQ-043 Studio save/synchronize/validate/publish distinctions and Runtime `local_pending` are not changed by this portal slice.

## Validation evidence

| Reference | Command | Result | Evidence |
|---|---|---|---|
| Preflight | `node --version`; `npm --version` | PASS | Node 24.22.1; npm 11.19.1 |
| `CMD-PLATFORM-TYPECHECK` | `npm run typecheck` | PASS | exit 0 |
| `CMD-PLATFORM-TEST` | `npm test` | PASS | 104/104 in 2.5 seconds test time; exit 0 |
| `CMD-PLATFORM-INTEGRATION` | `DATABASE_URL=<disposable-pg18> S3_ENDPOINT=<disposable-loopback-s3> npm run test:integration` | PASS | 26/26 in 39.8 seconds test time, including PS-710 lifecycle/RLS/revocation and logical archive reimport |
| `CMD-PRODUCT-E2E` | `DATABASE_URL=<disposable-pg18> npm run test:e2e:product` | PASS | 11/11 in 41.7 seconds; header-free local persona chooser, `PS-710-T01`, `PS-710-T02`, axe and deep-link regressions; `output/playwright/ps-710/` |
| Local user-test harness | `DATABASE_URL=<fresh-disposable-pg18> npm run user-test:ps710` | PASS | Seeded a fresh database, served the chooser at `http://127.0.0.1:4173`, and returned HTTP 200 without developer tools or authorization headers |
| Independent user test | `docs/acceptance/PS-710-user-test.md` | PASS | Product owner completed all ten steps in Chrome on Windows using visible controls; Designer/Admin/Reviewer/Operator authorization, Template defaulting, sign-out, empty/validation states, and two-tab stale archive/reopen recovery passed |
| `CMD-PLATFORM-A11Y` | `DATABASE_URL=<disposable-pg18> npm run test:a11y` | PASS | 11/11 in 2.9 minutes |
| `CMD-PLATFORM-LINT` | `npm run lint` | PASS | contract and source checks; exit 0 |
| `CMD-GAP-AUDIT` | `npm run audit:product-completeness` | PASS | 228 obligations and deliberate omission detection |

The integration evidence covers duplicate request replay, request-ID collision, stale versions, cross-Organization denial, role revocation, Reviewer read-only access, Operator denial, immutable Release counts, and Template Scenario defaulting. Browser evidence uses only visible controls and synthetic identities. No arbitrary sleep is used.

## Visual QA

The final artifacts `persona-chooser.png`, `designer-project-lifecycle.png`, `template-copy-default.png`, and `operator-denied.png` under `output/playwright/ps-710/` were inspected. The loopback chooser is visibly marked as local and synthetic, and the portal retains the exact catalog Plenum wordmark and semantic Teludens tokens, presents Project state in text as well as color, preserves the root shell, and omits protected Project data from the Operator denial state.

## Status and residual gates

PS-710 implementation, automated evidence, and independent ten-minute user test are **PASS**. Change-level acceptance is complete and PS-720 is eligible. Production approval remains separate and is not granted by this evidence.

The user test found two local-harness defects: sign-out initially attempted to parse an empty response and revoked the reusable fixture session, and the stale-tab conflict message initially refreshed outside the visible viewport. Both were fixed and retested. The final focus-only follow-up passed typecheck, lint/build, `node --check`, and an exact live two-tab Playwright exercise. The complete product E2E suite after that focus-only follow-up was **NOT RUN** because the manual user-test harness owned port 4173; the earlier 11/11 product E2E result remains recorded above.

Migration 026 is additive and backfills each existing Project creator as its owner collaborator. Deploy the migration before the new application version. Roll code back by disabling the portal endpoints/UI while retaining added rows and immutable receipts; do not reverse the schema after use. A defect should be handled by forward-fix. Logical Organization archives now include Templates, collaborators, and mutation receipts and restore Project-to-Template references in two phases; older version-1 archives without those optional datasets remain accepted.
