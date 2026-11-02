# PS-790 verification — administration, reporting, replay, archive, and Plugin operations

Date: 2026-11-02  
Mode: change-level implementation evidence; production approval is separate  
Human user test: **PASS** — all ten points confirmed by the product owner on 2026-11-02; see `docs/acceptance/PS-790-user-test.md`

## Delivered behavior

- Admins can inspect Organization members, replace role assignments with stale-revision rejection, and cannot remove the final Admin.
- Publisher and Admin Plugin workspaces expose signed bundle submission, publisher/trust/revocation/license governance, Artifact approval, installation and revocation with immutable digest and provenance visibility.
- Data-policy administration exposes versioned retention policy, legal hold, correction history and portable Organization archive export/import controls.
- Operator reports expose captured history, reconstructed narrative, observations, metrics, source references, reusable governed downloads and multi-page PDF output.
- Replay distinguishes captured history from deterministic reconstruction, reports digest/divergence results and does not mutate Session state.
- Archive review exposes the applicable retention policy, legal holds, Governing Release/Evidence preservation and the removal-from-active-operations consequence before confirmation.
- Research Analysts can generate only grant-, purpose- and consent-filtered reports. Direct identity mappings are omitted server-side; generated artifacts are scoped to their creator.
- Admin, Publisher, Operator, Reviewer and Research Analyst routes deny unauthorized capabilities explicitly and omit protected data.

## Compatibility and migration

- Migration `032_operations_administration.sql` is additive. It grants the application role membership deletion needed for transactional role replacement; existing forced RLS, service-context checks, final-Admin protection and audit evidence remain authoritative.
- The API additions are owned by `operations-admin-v1` and `report-delivery-v1`. Existing Release, Session, Evidence, report, replay, retention, legal-hold, correction, archive and Plugin records are not rewritten.
- Rollback is the bounded API/UI/contract slice. Migration 032 can remain in place; reverting its grant is optional and should occur only after confirming no deployed application version depends on role removal. Persisted audit, report, archive and Plugin provenance must be preserved.

## Automated evidence

| Reference | Command / evidence | Result |
|---|---|---|
| Preflight | `node --version` | **PASS** — Node 24.22.1 |
| Static contracts | `npm run typecheck` | **PASS** |
| Lint/contracts | `npm run lint` | **PASS** — 75 sources; 44 versioned contracts |
| `CMD-PLATFORM-TEST` | `npm test` | **PASS** — 111/111, including multi-page PDF coverage |
| `CMD-PLATFORM-INTEGRATION` | `DATABASE_URL=<fresh-pg18> S3_ENDPOINT=<loopback-seaweedfs> npm run test:integration` | **PASS** — 29/29, including `PS-790-T01`, `EXT-01`, tenant isolation, stale/final-Admin protection, Plugin permissions, policy and retention |
| `CMD-PRODUCT-E2E` | `DATABASE_URL=<fresh-pg18> npm run test:e2e:product` | **PASS** — 22/22 in 15.7 minutes after bounded PS-710/PS-730 load-sensitive wait corrections; focused PS-790 T01/T02 also passed in the preceding diagnostic run |
| `CMD-PLATFORM-A11Y` | `DATABASE_URL=<fresh-pg18> npm run test:a11y` | **PASS** — 11/11 in 26.1 minutes |
| `CMD-REPORT-RECONCILE` | `npm run reconcile:reports` | **PASS** — 3/3 |
| `CMD-EVIDENCE-VERIFY` | `npm run verify:evidence` | **PASS** — 6/6 |
| `CMD-AIRGAP` | `npm run test:airgap` | **PASS** — 9/9; `test-results/airgap/ps-220-airgap.json` |
| `CMD-GAP-AUDIT` | `npm run audit:product-completeness` | **PASS** — 228 obligations and omission check |
| Handoff harness | `.\scripts\start-ps790-user-test.ps1` then `GET http://127.0.0.1:4173/` | **PASS** — HTTP 200 with Plenum shell; all three PS-790 fixture files generated |

The first aggregate product run passed both PS-790 journeys but recorded two earlier-work-package timing failures: PS-710 exhausted a 90-second multi-role test budget during context creation, and PS-730 exceeded a 120-second collaboration acknowledgement wait. The tests now use bounded budgets appropriate to their existing multi-context workflows, and the combined recovery run passed 2/2 in 5.5 minutes. The first aggregate accessibility run similarly timed out in the pre-existing long PS-400 Studio case; its isolated rerun passed, a narrow 180-second per-test allowance was applied, and the complete clean rerun passed 11/11. These corrections change test synchronization only, not product behavior.

## Acceptance status

Implementation, required automated evidence and the independent ten-minute product-owner test are **PASS**. PS-790 change-level acceptance is complete, and PS-800 is the next eligible task. Production approval remains separate and **NOT RUN**.
