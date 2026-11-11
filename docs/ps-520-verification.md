# PS-520 verification

## BA-07 automatic Form attachment expiry (2026-11-11)

**Status: implementation and local automated verification PASS; BA-07-T01–T03 PASS.** Baseline `cc3cc51` was clean on `main`; all new edits are BA-07 work and the narrow browser-gate synchronization correction described below. No commit, push or deployment is performed. Proposed branch `fix/build-audit-attachment-expiry`; subject `fix(retention): enforce automatic attachment expiry`.

The existing Organization worker now invokes journaled Form attachment retention under each eligible tenant's own current Admin service authority. Expired files disappear from attachment lists and Form export manifests and cannot be downloaded or selected for rescan even when held or cleanup has not run. Download authorization and expiry are rechecked after object I/O. Migration 046 adds retry metadata to the existing journal; no new service, dependency, identity model or retention engine. Exact bounds and forward-fix guidance are in [retention operations](ps-520-data-dictionary-and-retention.md#ba-07-form-attachment-expiry-2026-11-11).

### Policy authority and owner clarification

Authority: security/reporting document 06 sections 11–12, approved OPEN-010 in Decision Register section 7.2, existing applicable automatic-delete Form policy validation, and BA-05's approved durable Organization–Deployment bindings. Existing policy periods, Organization hold scope, scan restrictions and historical evidence are preserved. The owner explicitly approved on 2026-11-11: expiry blocks ordinary list/download/Form-export access even under a hold; holds preserve bytes and audit metadata; unexpired held files remain accessible under normal authorization. This clarification is recorded in Decision Register section 7.2. No policy ambiguity remains.

### Acceptance evidence

| ID | Current result | Boundary proved |
|---|---|---|
| BA-07-T01 | PASS | Database-clock expiry at -1/0/+1 microsecond; expired metadata and Form manifest omitted before cleanup, including held files; clean unexpired held/unheld download succeeds; same previously issued HTTP URL returns 404 after expiry; expiry during object retrieval cannot return bytes. |
| BA-07-T02 | PASS | Actual `deploy/compose/profile-service.mjs` startup automatically purges synthetic bytes from S3-compatible storage for bootstrap and newly enrolled second Organization. Tests never call cleanup directly in this acceptance path. Database journal and object 404 are asserted separately; duplicate processes produce one audit under each tenant's own actor. |
| BA-07-T03 | PASS | Failed S3 delete keeps bytes plus `purge_pending`; successful delete followed by an injected database exception leaves absent bytes plus `purge_pending`; restart recovers both. Organization hold preserves pending and attached bytes, release permits retry, disabled tenant stays intact, exact expiry and cancelled stalled storage body are covered. A barrier-driven concurrent hold placement waits on the deletion transaction's advisory lock; the failed delete leaves recoverable bytes. |

Tests extend existing `identity.integration.test.mjs`, `tenant-jobs.integration.mjs` and `object-store.integration.test.mjs`; no parallel harness or command is introduced. Existing product E2E covers upload/download, scan failure/rescan, Form export, manual Admin enforcement, authorization, offline workflows and collaboration. No new UI controls or layout styles are introduced. The HTTP harness proves server gates, not browser-cache revocation of bytes already downloaded. Logical Organization archives are privileged evidence exports and retain metadata but exclude object bytes; no alternate attachment byte export or pre-signed URL path was found.

The converged browser run caught an intermittent BA-06 width assertion after resizing. Inspection found a credible race: `setViewportSize` can complete before `useWideViewport`'s `matchMedia` listener commits React's closed-sidebar state. `tests/e2e/product/live-sync.spec.mjs` now waits for that existing DOM state, retains the overflow assertion and attaches before/after dimensions. No CSS, assertion removal or timeout increase. The focused rerun passed in 50.21 s and its 512-pixel forced-colors screenshot was inspected. The first final full run's 39/40 result is retained in `product-final.log`; that failed attempt did not capture the overflowing element. The final full run passes 40/40 and records viewport/scroll widths of 512/512 with the sidebar closed (`resize-dimensions.json`).

### Verification environment and command records

All commands run from `C:\Users\ssnguna\Local Sites\Plenum`, Node 24.22.1/npm 11.19.1, root lockfile, PostgreSQL 18.6 and SeaweedFS 4.48, synthetic identities/files only. Detailed output is in `output/ba-07/`. PASS rows have exit 0; historical evidence below this section is not current-candidate proof.

| Command | Result | Duration / evidence |
|---|---|---|
| `npm run typecheck` | PASS | 9.93 s; `final-typecheck.log` |
| `npm test` | PASS, 168 tests | 12.83 s; `final-test.log` |
| `npm run test:integration` | PASS, 46 tests | 116.19 s; `final2-test-integration.log` |
| `npm run test:s3` | PASS, 2 tests | 4.90 s; `final2-test-s3.log` |
| `npm run test:e2e:product -- --reporter=line,json` | PASS, 40 tests | 631.11 s; `product-verified.log`, `product-verified-report.json`; earlier 40/40 PASS then 39/40 resize assertion FAIL are retained separately |
| `npm run reconcile:reports` | PASS, 3 tests | 4.73 s; `final2-reconcile-reports.log` |
| `npm run lint` | PASS, 52 contracts | 3.80 s; `final2-lint.log` |
| `npm run test:security` | PASS, 8 tests and dependency audit | 42.95 s; `final2-test-security.log`, `security.json` |
| `npm run validate:promptbook` | PASS | 2.00 s; `validate-promptbook.log` |
| `npm run audit:product-completeness` | PASS | 0.78 s, 240 obligations; `audit-product-completeness.log` |
| `npm run validate:observability` | PASS | 0.85 s, 8 alerts/4 panels; `validate-observability.log` |
| BA-11 deployed multi-Organization rehearsal / fresh human AT | NOT RUN | Local automated evidence does not replace deployed proof or extend historical human acceptance |

Reproduction: `baseline.log` shows expired clean metadata still returned before the read fix. The first targeted attempt (`reproduction.log`) could not run the ordered PS-830 fixture alone; it is a setup failure, not defect evidence. The baseline suite's later tenant-worker failure overlapped a composition signature edit and is not a second product finding. The first worker attempt failed a synthetic UUID/text cast (`worker.log`); after correcting it, the production worker case passed in 13.4 s (`worker2.log`). The first final integration run (`final-test-integration.log`, exit 1 after 174.27 s) was stopped because its new hold-race fixture sampled PostgreSQL microseconds and JavaScript milliseconds at the same boundary and awaited a deletion that was not yet due. The corrected fixture uses an explicitly past deadline and rejects an early cleanup return; the entire rerun passes. These failed attempts are retained, not presented as PASS.

Resource preflight: 164,631,715,840 free bytes on C:. Only task-owned `plenum-ba07-db` and `plenum-ba07-s3` containers were created with tmpfs data, loopback ports 65439/6833 and disposable `ba07_*` databases. Exact inventory and cleanup status: `output/ba-07/resources.txt`. Unrelated stopped containers and demonstrations are preserved. Database restore tests create/drop their own synthetic restore databases through the established harness. No real report or attachment data is purged.

Final file hashes and exact changed paths are recorded in `output/ba-07/candidate-manifest.json`; command durations/exits are in `final-checks.json`, `continuity-checks.json` and `product-verified.json`. Test-generated tracked screenshots and fixtures were saved as local evidence, then restored to their preflight versions. The task containers and disposable data were removed after identity verification; no unrelated resource was pruned.

### Continuation and release limits

BA-11 must verify actual deployment coverage, storage lifecycle configuration and healthy sweep timing for the real tenant population; local arithmetic bounds are not capacity measurements. No staging/production deletion, independent security review, fresh human/desktop AT acceptance or external provider certification is claimed. Preserve PS-830 owner acceptance, the PS-840 signed-checkpoint exception, PS-842 decisions and PS-850 release scope. Next implementation task: BA-08.

Updated: 2026-10-23. Change mode: production/high-criticality implementation with synthetic local data only.

## Outcome

PS-520 is implemented and verified. The modular server now produces immutable provenance-bearing Session reports and consent-filtered research exports in JSON, JSONL, CSV, HTML, PDF, and ZIP; stores separate observations, versioned metrics, notes, and findings; records retention policy and compensating corrections; performs pinned deterministic replay with machine-readable divergence; and transactionally rehydrates digest-verified Organization archives into an empty same-Organization deployment.

Migration `024_reporting_research` adds forced-RLS, append-only reporting records. The HTTP surface adds research-consent and report-generation endpoints. A replay adapter is injected at deployment/runtime composition; the HTTP endpoint fails closed when no deterministic adapter is configured.

## Acceptance evidence

| Requirement | Evidence | Result |
|---|---|---|
| Every report element traces to source | `PS-520-T01/T02/T03` and real-DB `AC-06` assert event/metric/analysis source references and reconciliation counts | PASS |
| Research export contains no direct participant identifiers or raw bodies | Real-DB and aggregate HTTP/browser flow assert person/participant IDs and a synthetic direct name are absent | PASS |
| Metric version changes do not rewrite history | Real-DB test generates v1, adds v2, generates again, and verifies the first artifact bytes are unchanged | PASS |
| Replay matches or emits machine-readable divergence | Unit and real-DB adapter tests cover identical input, missing/reordered events, and manifest comparison | PASS |
| Exact idempotent retry and immutable regeneration | Real-DB and HTTP flow return identical bytes for one key, refuse key collision, and create a new artifact for a new key | PASS |
| Portable Organization archive validates and reimports | Real-DB test creates a second fresh database, applies migrations 001-024, adds only the bootstrap Admin identity, imports every declared dataset, compares every table count, then successfully replays a Session and regenerates a report | PASS for logical operational-table hydration |
| Import boundary and atomicity | Import rejects digest, restore-contract, Organization-scope, identity, and non-empty-target mismatches before data insertion; all hydration and audit work share one transaction; the same digest replays without duplicate rows | PASS |
| Required aggregate browser gate | The Windows fixture-server shutdown hang is fixed with a bounded global teardown. The exact clean `npm run test:e2e` aggregate completed with `21 passed`, `1` conditional real-media skip, and a normal final summary in 6.4 minutes. Loaded-host time budgets were widened without weakening assertions, and the timer extension proof now compares its durable deadline rather than a decaying wall-clock value. | PASS |

## Verification commands

Environment: Node 24.18.0, npm 11.16.0, TypeScript 5.9.3, fresh disposable PostgreSQL 18 databases, digest-pinned SeaweedFS 4.48, Playwright 1.64.1 Chromium, synthetic data only.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0; 62 sources and 37 versioned contracts |
| `npm test` | PASS, exit 0; 103/103 |
| `npm run reconcile:reports` | PASS, exit 0; 3/3 |
| `npm run test:integration` | PASS, exit 0; 24/24 on a clean source database plus real S3-compatible storage and a second freshly migrated logical-restore database |
| focused global-teardown proof | PASS, exit 0; 1/1 in 52.3 seconds and the fixture server terminated in 292 ms without manual intervention |
| focused DEC-42 plus timer-control regression | PASS, exit 0; 2/2 in 2.5 minutes, including an exact 60-second durable-deadline shift |
| focused Studio collaboration regression | PASS, exit 0; 1/1 in 5.2 minutes, including offline reconnect, convergence, validation, freeze, approval, and publication |
| `npm run test:e2e` | PASS, exit 0; exact aggregate `21 passed`, `1` conditional real-media skip in 6.4 minutes on a fresh disposable database; normal final summary and clean fixture shutdown |

## Security, privacy, and operational boundary

Research export requires current Research Analyst membership, an unrevoked project grant, and current purpose-specific consent. Organization and standard exports require current Admin/Operator authorization. RLS and append-only triggers protect every new table, and audit records cover consent, analysis, policy, correction, export, and archive import actions.

No browser UI changed. No production system, KMS/HSM, custodian, backup, or institutional retention configuration was deployed. Logical import is deliberately limited to an empty same-Organization deployment and never merges into authoritative live Runtime tables. Authentication credentials and object-store blobs remain separate. PS-530 owns their deployment and recovery mechanics.

## Readiness

PS-520 is `verified` at change level. Its report/research/replay behavior, logical archive reimport into a second clean database, and exact aggregate browser gate all pass. **PS-530 is the next planned implementation task.**

In simple terms, OPEN-009 now defines how long production records live and where they stay, but the repository has not yet implemented and proved the complete deletion/anonymization, legal-hold and audit process. PS-530 implements deployment/recovery and PS-550 must verify the approved retention policy and production controls before release.
