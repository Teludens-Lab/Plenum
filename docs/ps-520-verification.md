# PS-520 verification

## BA-09 Replay availability and reconstruction inventory (2026-11-12)

Baseline `c9d9a87` is clean. Finding 8's misleading availability can be contained, but required deterministic Replay remains OPEN. Connected, institutional/self-hosted and air-gapped production profiles provide no reconstruction adapter. `replay/service.ts` currently loads Release/compiler/package/seed metadata and captured Evidence Events; it does not provide the pinned starting state and independently executable historical inputs. Command receipts retain payload hashes, not canonical Command payloads (`runtime/commands/processor.ts`). Definition revisions, Artifact versions, Control Interventions and Model Run input snapshots/proposal records preserve useful subsets, but no complete versioned, observational transition implementation consumes them across all operation families. Re-running live SQL handlers would mutate state and invoke current integrations, and is prohibited. Missing historical inputs cannot be recovered by returning the captured events.

Compatibility decision before implementation: add an authorized `GET /v1/sessions/{sessionId}/replay` capability response; retain the existing POST divergence contract and `CAPABILITY_UNAVAILABLE` envelope. Both methods use the existing Admin/Operator Organization-role and tenant-Session boundary, including current membership/session validity. The UI checks capability before showing a runnable action. Existing adapter injection remains an internal seam; no environment toggle or production adapter is introduced. Echo adapters may remain only in explicitly named plumbing tests, never acceptance evidence. No migration or new trust boundary. T01 and full reconstruction-related T02 remain unfulfilled until independently derived, version-pinned reconstruction exists and rejects missing/corrupt history.

### Input and transition inventory

| Required material | Existing source | Remaining reconstruction gap |
|---|---|---|
| Governing Releases and definitions | `registry.releases`, `studio.definition_revisions`, ordered `runtime.release_activations` | Current adapter input carries metadata, not the complete definitions or a verified initial mutable-state snapshot. |
| Decisions and ordering | `evidence.events`, `sync.command_receipts`, Artifact versions, Control Interventions | Receipts store canonical payload digests, not canonical payloads; captured outcome events are not independent execution inputs for every operation. Current Replay projection also omits recorded times, actors, causation and Authority Epoch. |
| Deterministic external work | `extension.composition_runs.input_snapshot`, Model Run digests/seeds/environment and Effect Proposals | The loader supplies only selected pins. Complete external output and adapter/version support for reproducing all resulting events are not implemented. Replay must never dispatch the live Extension Host or provider effects. |
| Versioned transition logic | `packages/workflow-engine` (`resolveWorkflowTransition`, `selectStageTransitions`, `rehearseStages`, clock helpers); `nextOperatorSessionStatus` | These are useful deterministic pieces, not a Session-wide historical interpreter. Other handlers combine current database reads, writes and effects. A Studio rehearsal is not full Session Replay. |
| Comparison | `compareReplay` with canonical hashes and ordered event differences | Comparator tests independently assert difference codes, but supplied/echoed records are not independently reconstructed history. |

All current profiles are unavailable for deterministic reconstruction. There is no safe backfill that invents missing historical inputs. Completion requires a versioned input/initial-state contract, complete supported transition coverage with pinned time/seed semantics, integrity/gap/version validation, independent expected-history fixtures, and production T01/T02 evidence. Existing immutable histories must remain unchanged. No new retention period, data store or event-sourcing platform is introduced by this containment patch.

### Current acceptance and verification

**Status: containment implemented; finding 8 and required Replay remain OPEN / BLOCKED.** Exact starting source: `c9d9a8738a02e57cdcbe21fe6669a297508dd5cd`, clean before BA-09. All three production profiles (`cloud`, `institutional`, `air_gapped`) remain unavailable; none supplies a valid reconstruction adapter. The real cloud entrypoint is exercised below; other profiles share that factory, but were not independently deployed in this task.

| ID | Result | Evidence and limits |
|---|---|---|
| BA-09-T01 | BLOCKED / NOT RUN | No supported independent reconstruction exists. Comparator fixtures assert manifest, content, ordering, missing and unexpected event differences; they do not reconstruct history. |
| BA-09-T02 | Partial PASS; reconstruction gate BLOCKED | Real production GET/POST reject anonymous, wrong-tenant, unauthorized-role and revoked callers. Session row, Evidence and receipt counts are unchanged. Adapter plumbing verifies a cloned comparison baseline and revocation before result disclosure. Missing/corrupt/pin-mismatched reconstruction cannot be verified without a real interpreter. |
| BA-09-T03 | PASS | Real production startup returns authorized unavailable capability and POST `CAPABILITY_UNAVAILABLE`; supplied request history cannot activate Replay. Operator browser shows checking, unavailable and failed-check/retry states, no Run action or Matched claim, and a Reports link. Required Replay remains blocked in the completeness ledger. |

The service reads a repeatable-read, read-only snapshot, passes a clone to the internal adapter, then rechecks current authorization before disclosing results. No database transaction spans the adapter call. These are service safeguards, not a sandbox or proof that an arbitrary adapter has no external effects. No adapter is activated. The shared browser fixture's echo adapter is removed. Archive integration echoes are explicitly scoped to plumbing. Golden completion and restore helpers now assert actual capability before running Replay, and completion rechecks it even when an old saved checkpoint says Replay passed; their full journeys remain BLOCKED, not accepted through UI containment.

Commands ran from `C:\Users\ssnguna\Local Sites\Plenum`, Node 24.22.1/npm 11.19.1, root lockfile, local Windows Chromium, PostgreSQL 18.6 and SeaweedFS 4.48, synthetic data only. Evidence is under `output/ba-09/`; test-runner durations below exclude npm build/setup where the runner does not include it. Short static-command wall times are recorded separately in `static-checks.json`.

| Command ID / command | Result / exit | Duration / evidence |
|---|---|---|
| CMD-PLATFORM-TYPECHECK / `npm run typecheck` | PASS / 0 | 10.27 s wall time; `static-typecheck.log` |
| CMD-PLATFORM-TEST / `npm test` | PASS, 173 / 0 | 4.78 s tests; `unit-final.log` |
| CMD-PLATFORM-INTEGRATION / `npm run test:integration` | PASS, 47; 1 explicit skip / 0 | 153.73 s tests; `integration-verify.log`. BA-08 real rootless execution remains skipped because no qualifying supervisor socket is configured. |
| CMD-REPORT-RECONCILE / `npm run reconcile:reports` | PASS, 3 / 0 | 0.70 s tests; `report-reconcile.log` |
| CMD-PRODUCT-E2E / `npm run test:e2e:product` | PASS, 42 / 0 | 9.0 min browser runner; `product-final.log` |
| CMD-PLATFORM-A11Y / `npm run test:a11y` | PASS, 11 / 0 | 3.7 min browser runner; `a11y.log` |
| `npm run lint`, `npm run audit:product-completeness`, `npm run validate:promptbook` | PASS / 0 each | 5.07 / 0.54 / 0.60 s wall time; `static-checks.json` and corresponding logs; completeness checks consistency, not Replay delivery |
| Golden completion/restore helpers | Syntax PASS; full journeys BLOCKED / NOT RUN | `node --check` only; required reconstruction is unavailable |
| Hosted CI, actual browser zoom, fresh human/desktop AT review | NOT RUN | Local automated screenshots use 1024x768 and a 512x384 effective viewport, not actual browser zoom; prior human acceptance does not transfer to these changed states |

The new browser case checks overflow, focus and axe with forced colors/reduced motion. Screenshots `replay-1024.png`, `replay-512.png` and `replay-forced-colors.png` were visually inspected: explanatory content and Reports link remain readable, with visible keyboard focus and no horizontal clipping. The 512 viewport is a constrained-layout proxy for 200% zoom. The first product attempt was stopped after finding another obsolete PS-800 Run-button assertion; it is retained as `product.log`, not a passing run. The converged suite includes that corrected consumer.

**Separate unresolved concurrency defect:** `integration-final.log` failed (46 PASS, 1 FAIL, 1 SKIP; exit 1; 144.83 s) before the BA-09 assertions: an unavailable Model Run returned 500 instead of 409. `database-deadlock.log` records a cycle between Command outcome Evidence-sequence allocation and a scheduled Inject's Session lock/FK check. The unchanged-source rerun passes, but does not fix or clear this defect. Command/scheduler lock-order reconciliation and concurrency proof remain required in BA-11/12 before release; no broad retry or out-of-scope lock rewrite was added here.

### Recovery, resources and continuation

No migration, dependency, new process, production configuration or data rewrite. The GET addition and service safeguards preserve the existing POST response/bodyless-call behavior. Rollback requires paired application/UI redeployment; it would restore misleading availability, so retaining the containment is preferred. No rollback exercise or production deployment was performed. Logical archive/report compatibility remains covered by the integration/report gates.

Only `plenum-ba09-db` (`7ed51393573281db0bdcc4cde9d294f09c25e29c26be7edb6a03f70297d9ac19`, tmpfs `/var/lib/postgresql`) and `plenum-ba09-s3` (`e41fabc5ebdd67d82c70bcd9f48670db1be118a139e337c6ee5758bd182ffbca`, tmpfs `/data`) were created, on loopback ports 65439/6833 after a disk-capacity preflight. Disposable databases were `postgres`, `ba09_final`, `ba09_verify`, `ba09_product`, `ba09_product_final`, `ba09_a11y`, plus harness-owned restore databases. After all tests disconnected, exact container identities were verified and both containers removed. Unrelated containers were preserved; no broad prune. Generated tracked browser output is restored from the preflight backup; new local evidence remains under `output/ba-09/`. Final source paths/hashes are in `candidate-manifest.json`.

No commit, push or deployment. Suggested subject remains `fix(replay): align production capability and reconstruction`; it must not be read as completion of reconstruction. PS-830 owner acceptance, PS-840 signed-checkpoint exception, PS-842 decisions and PS-850 release obligations retain their scope. Affected PS-830/840 golden Replay and restore gates must be rerun with a genuine adapter and independent history expectations; they cannot inherit earlier echo-based PASS claims. Next independent task: BA-10. Required Replay implementation and the separate concurrency defect remain open.

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

Historical PS-520 reporting/archive verification does not establish deterministic Replay; BA-09 corrects that earlier claim above. The modular server produces immutable provenance-bearing Session reports and consent-filtered research exports in JSON, JSONL, CSV, HTML, PDF, and ZIP; stores separate observations, versioned metrics, notes, and findings; records retention policy and compensating corrections; compares supplied Replay records with machine-readable divergence; and transactionally rehydrates digest-verified Organization archives into an empty same-Organization deployment. The original Replay adapters were plumbing fixtures, not independent reconstruction.

Migration `024_reporting_research` adds forced-RLS, append-only reporting records. The HTTP surface adds research-consent and report-generation endpoints. A replay adapter is injected at deployment/runtime composition; the HTTP endpoint fails closed when no deterministic adapter is configured.

## Acceptance evidence

| Requirement | Evidence | Result |
|---|---|---|
| Every report element traces to source | `PS-520-T01/T02/T03` and real-DB `AC-06` assert event/metric/analysis source references and reconciliation counts | PASS |
| Research export contains no direct participant identifiers or raw bodies | Real-DB and aggregate HTTP/browser flow assert person/participant IDs and a synthetic direct name are absent | PASS |
| Metric version changes do not rewrite history | Real-DB test generates v1, adds v2, generates again, and verifies the first artifact bytes are unchanged | PASS |
| Replay matches or emits machine-readable divergence | Unit and real-DB adapter tests cover supplied records, missing/reordered events, and manifest comparison only | Comparator plumbing PASS; deterministic reconstruction BLOCKED (BA-09) |
| Exact idempotent retry and immutable regeneration | Real-DB and HTTP flow return identical bytes for one key, refuse key collision, and create a new artifact for a new key | PASS |
| Portable Organization archive validates and reimports | Real-DB test creates a second fresh database, applies migrations 001-024, adds only the bootstrap Admin identity, imports every declared dataset, compares every table count, then checks Replay comparator plumbing and regenerates a report | PASS for logical operational-table hydration; not reconstruction proof |
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
