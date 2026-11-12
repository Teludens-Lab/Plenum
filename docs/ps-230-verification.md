# PS-230 isolated Plugin effects verification

## CI browser regression follow-up — 2026-11-12

Source baseline: `8f621c21ead57a49b005d899316e5d1b39a8d35b`; initially clean worktree. CI run `43132860806` failed two accessibility cases and the BA-06 zoom assertion. The accessibility failures reproduced locally: the pre-seeded approved catalog manifests omitted the publisher metadata now required by approval-time trust validation, yielding a canonical `PLUGIN_NOT_APPROVED` receipt; the catalog assertion also expected the previous “available” wording. The fixture now inherits the existing complete synthetic manifest, the approval test checks the actual Command Receipt before presentation, and the catalog assertion matches “available for binding.” Production trust checks are unchanged.

The zoom failure did not reproduce in six focused runs using CI's exact Linux Chromium image. The assertion now waits at most five seconds for the measured document width after resizing, and reports overflowing element geometry on failure. This preserves failure for persistent overflow; the original intermittent layout cause is not proven. No CSS or application behavior changed. See [BA-06 evidence](acceptance/BA-06-live-sync.md).

Evidence is under `output/ci-browser-fix/`: `a11y-before.log` and `approval-trace/` record the initial rejection; `linux-layout-before.log` and `linux-layout-repeat.log` record 1 + 5 focused passes; `a11y-after.log` records **11/11 PASS** (6.6 minutes), and `typecheck.log` records **PASS**, both exit 0. The runner is Node 24.22.1 on Windows, with a loopback Playwright connection to `mcr.microsoft.com/playwright@sha256:ee15712262f017b8157421b212b12099146645f44b1bc5c0514cbbe6a229b1d0`; PostgreSQL 18.6 uses only synthetic disposable databases. `environment.json` records container identities. Linux screenshots at 1024×768 and 512×384 were inspected; this is not native zoom or human assistive-technology evidence.

The full remotely connected product command is **FAIL (verification transport), exit 1**: 24 cases passed, but the existing download tests call `Download.path()`, which Playwright prohibits for remote connections; the attempt was stopped and retained in `product-after.log`. This attempt does not establish full-product acceptance. Hosted CI rerun, production activation and the existing BA-08 isolation/owner-review gates remain separate.

The standard local `npm run test:e2e:product` rerun on a fresh disposable database is **PASS, 41/41, exit 0** (13.0 minutes; `product-local.log`). This includes Release/attachment/Form/archive downloads, the bounded zoom assertion, and BA-08 unavailable/error UI. Both required browser commands rebuilt the candidate. Tracked generated fixtures/screenshots were restored from the pre-run backup; disposable infrastructure was removed after verification. No commit, push or deployment. The final patch is test/evidence-only and does not change the existing release-acceptance status.

## BA-08 governed production Model Runs — 2026-11-11

**Current status: implementation authorized; production activation BLOCKED and finding 7 OPEN.** The owner explicitly approved the constrained Unix-socket supervisor proposal below for implementation and synthetic testing. This does not grant production activation, formal Security Owner approval, commit or push authority. Source baseline remains `cb5de97169dcabbeee1a364b8b003d5a13e1ca46`.

### Approved implementation and boundary

The production entrypoint now optionally constructs `createProductionExtensionRuntime` from `PLENUM_EXTENSION_SOCKET` and supplies it to the existing HTTP handler and BA-05 tenant worker. The resolver reads the Governing Release's immutable Definition revision, validates the composition and graph digest, and matches enabled Organization/Deployment installation and artifact/configuration pins. Explicit `executionPolicy` supplies the seed, trigger Roles and effect allowlist; the connected approval gate supplies reviewer Roles. Only the existing single-model, offline, dependency-free executor is activated. The binding timeout must admit the signed manifest's execution limit; unsupported graphs/policies remain unavailable. Mapping and effect targets must satisfy the current actor's information policy and classification limits. Signed bundles are loaded by the database-owned object key from existing storage and verified against approved trust and all three immutable digests.

The new `@plenum/extension-host` supervisor exposes only local `/health` and `/invoke` over a permissioned Unix socket. It admits no caller-selected image, command, host path, environment or mount. It verifies signed bundle custody again and stages under a private service-account directory. Before startup and each execution it requires a **rootless daemon with working cgroup v2 memory, CPU quota and process limits**, plus the exact cached host image. Existing read-only, no-network, non-root workload, capability, PID, memory, CPU, timeout and output controls remain. Docker control belongs only to the dedicated supervisor account. Container termination is confirmed before staging removal; uncertainty preserves staging and makes the supervisor unavailable. Restart recovery is bounded and fails closed on unsafe/live ownership or excess orphans.

Runs execute outside database transactions. Two local workers and two supervisor invocations are the concurrency bounds; each Organization admits at most 128 pending/running runs. Each visit considers two pending and sixteen expired attempts. Migration `047_model_run_work_queue.sql` adds only a partial queue index; existing status, timestamps and execution-policy JSON provide recovery/fencing without new state tables or privileges. Stored policy now records the trusted initiating context, plan digest and target versions. Trust, original actor, tenant service authority, Release and Authority Epoch are rechecked before dispatch and staging. Completion stages proposals and publishes Evidence/outbox notifications atomically. Existing authorized Runtime synchronization consumes proposal events. Approval still uses the Command kernel and now rechecks Plugin trust, including revocations committed while waiting on the publisher lock.

Six-minute expired attempts become terminal failures; late output cannot revive them. Original Command retries replay receipts. A new attempt requires a new Run/Command ID after review; ambiguous computation is never automatically repeated. Failures are visible in existing authorized extension provenance and `model_execution` telemetry. Missing configuration reports `executor_not_configured`; an unreachable/unhealthy configured supervisor reports `executor_unavailable` and degrades tenant-job readiness. The optional Compose override and user-service template are **not activated**. Deployment, custody, permissions, shutdown and recovery instructions are in [PS-820](operations/PS-820-INSTALL-UPGRADE-RECOVERY.md#ba-08-model-run-availability-gate).

### Current acceptance boundary

| ID | Status | Evidence / remaining gate |
|---|---|---|
| BA-08-T01 | NOT RUN / activation BLOCKED | A production-entrypoint test is prepared and explicitly skipped without `PLENUM_TEST_EXTENSION_SOCKET`. No qualifying supported-profile isolated workflow has been observed. |
| BA-08-T02 | PASS for local boundary harness; NOT RUN in activated profile | Real HTTP/PostgreSQL/S3 harness checks filtered input, signed custody, invalid output/timeout, current access/Authority changes, cross-tenant and revoked artifact denial, review and concurrent approval. Unit/IPC tests cover tampering, prohibited capabilities, rootful/missing-resource denial and provenance. Executor transport is explicitly a double, not deployment evidence. |
| BA-08-T03 | PASS for local durable recovery and unavailable behavior; activated-profile restart NOT RUN | Production startup reports absent/unreachable executor accurately; database harness verifies duplicate claims/receipts, restart, six-minute recovery, late output fencing and one approved effect. Full supervisor restart under active workloads still needs the qualifying environment. |

The disposable rootless lab used Docker `28.5.1-dind-rootless@sha256:87d03cfe51f2bf87eec6dda1922dc572da4d37a1d21c5ca8e8b22c8a1fa107cc`, container `0dd7e4f0b2c5f307b483afa4b84184c2a726cd46c47779d6abceb423157ab5b9`. Its daemon reports `name=rootless` and cgroup v2 but **MemoryLimit=false, CpuCfsQuota=false, PidsLimit=false**. Running the actual supervisor with pinned Node 24.22.0 refused startup for exactly that reason (`output/ba-08/rootless-lab-info.json`, `supervisor-startup-denial-final.log/.json`). No app or Plugin was activated in this lab. Docker Desktop's rootful helper tests cannot replace this missing proof.

The reusable signed test fixture is `org.ssg.fixtures.synthetic-effect@1.0.0`; each test creates fresh synthetic publisher keys and immutable bundle/manifest digests. Its artifact code digest is calculated from the fixture, never invented as an approved production digest. The optional production test prints exact artifact, bundle, profile and host-image identity when actually run. The host pin remains `node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f`.

### Final local verification

All commands ran from `C:\Users\ssnguna\Local Sites\Plenum`, Node **24.22.1**, root lockfile and TLS verification enabled. Security used Git Bash on PATH. Evidence is under `output/ba-08/`; each listed stem has a log and JSON command/duration/exit record. The final source remains an uncommitted working tree; `approved-candidate-files.json` records exact file hashes and distinguishes the pre-existing Studio title delta.

| Command ID / command | Result / exit | Duration | Evidence stem |
|---|---|---|---|
| CMD-PLATFORM-TYPECHECK / `npm run typecheck` | PASS / 0 | 8.56s | `approved-typecheck-candidate` |
| CMD-PLATFORM-TEST / `npm run test` | PASS / 0; 173/173 | 9.11s | `approved-unit-candidate` |
| CMD-PLATFORM-INTEGRATION / `npm run test:integration` | PASS / 0; 47 passed, one explicitly NOT RUN | 129.09s | `approved-integration-final3` |
| CMD-AIRGAP / `npm run test:airgap` | PASS / 0; 9/9 plus isolated helper | 20.02s | `approved-airgap-final`, `approved-airgap-report.json` |
| CMD-PRODUCT-E2E / `npm run test:e2e:product -- --reporter=line,json` | PASS / 0; 41/41 | 553.74s | `approved-product`, `approved-product-results.json` |
| CMD-SECURITY / `npm run test:security` | PASS / 0; 8/8; zero known vulnerabilities | 51.84s | `approved-security-final`, `approved-security-report.json` |
| CMD-LOAD-EXTENSIONS / `npm run load:extensions` | MEASURED / command exit 0; aggregate acceptance BLOCKED | 37.69s | `approved-load-final`, `approved-extension-load-report.json` |
| `npm run lint` | PASS / 0; 137 sources, 52 contracts | 4.56s | `approved-lint-final` |
| `npm run audit:product-completeness` | PASS / 0; REQ-038 remains BLOCKED | 0.75s | `approved-completeness-final` |
| `npm run validate:promptbook` | PASS / 0; 51 tasks, REQ 94/94, INV 28/28 | 0.89s | `approved-promptbook-final` |

The final focused database/HTTP/S3 rerun (`node output/ba-08/run-focus.mjs`, `model-diagnostic-provenance.log/.json`) additionally asserts that exported provenance omits the worker authentication-session reference. The worker-only policy is not in the portable archive allowlist, proposal projections or Evidence payloads. Product browser results precede the final backend-only trust race correction; the final integration run covers that correction. Subsequent changes were a privacy assertion/comment and documentation. No browser execution/approval workflow on an activated supervisor is claimed.

The browser captures (`studio-1024.png`, `studio-512.png`, `studio-forced-colors.png`, `plugins-1024.png`, `plugins-512.png`, `plugins-forced-colors.png`) were refreshed and agent-inspected. Availability text wraps and remains readable at 1024×768, 512×384 (200% equivalent reflow) and forced colors. The automated flow covers keyboard focus, reduced motion, missing metadata and failed requests. Native browser zoom and new human assistive-technology acceptance remain NOT RUN; historical owner acceptance keeps its original scope.

The final standalone host load measured 24 valid runs at concurrency four, p95 **2600.57ms**, one deterministic output digest, two invalid-output rejections, two timeout rejections and zero host-state mutations. Resource monitoring collected five database samples and 21 process samples. This includes confirmed container cleanup overhead and is not production-supervisor throughput or a capacity PASS. The existing aggregate capacity gate remains BLOCKED pending converged profile/soak/media evidence. Exact fixture artifact digest: `sha256:aff4827033d33f0d5dce9e6cea5aa4c58407d02b7ec22077a173cdc51e47246b`; generated bundle/manifest pins for the HTTP harness are in `approved-artifact-inventory.json`.

Failed attempts are retained: `approved-integration.log` (45/46, missing row-lock privileges on immutable bindings) led to locks on mutable artifact/publisher rows without granting new privileges. The focused fixture also corrected registry `connected` versus application `cloud` profile naming. `approved-integration-final2.log` failed the new contention probe because PostgreSQL cached its activity snapshot inside the test transaction; the probe now clears that diagnostic snapshot. `model-diagnostic-final.log` and full `approved-integration-final3.log` prove the correction and actual post-lock revocation denial. No failed run is counted as PASS.

Disposable resources: PostgreSQL 18.6 `plenum-ba08-db` (`f603454ac5f331f04168fe12250ddce4d686feac9b2e71865c1512af85b55be6`), SeaweedFS 4.48 `plenum-ba08-s3` (`8319a90d9ec734d92d44e87d3560cef9464c3ae23235b66132a73a783b325f52`), the rootless lab above, and stopped Node file-copy helper `plenum-ba08-node-files` (`53b7515bca5fffefcfd7c12dffcf23ad63465c6257dbf4480646e8796e698df2`). Disk preflight: 163,242,156,032 bytes available. Databases were `plenum_ba08_approved`, `plenum_ba08_focus`, `plenum_ba08_final`, `plenum_ba08_final2`, `plenum_ba08_final3`, `plenum_ba08_approved_product`; the load harness created and removed `plenum_ps540_extensions_bbb3450792`. Cleanup identity checks and results are in `approved-cleanup.json`. Thirty-five generated tracked screenshots/signed fixtures were restored from pre-run backups; the new BA-08 evidence remains. Unrelated stopped services and the pre-existing `apps/studio/index.html` title change were preserved.

Engineering review: scope, module ownership, backend/data boundaries, automated tests and additive compatibility **PASS at the demonstrated local boundary**. Activated-profile security/operations, actual production performance and complete acceptance **NEEDS WORK** until T01/T02/T03 run against a qualifying supervisor and the required owners approve release. The implementation does not close finding 7.

Migration 047 is additive and preserves old readers/writers and historical evidence. Its normal index creation can briefly block writes; schedule deployment accordingly. Code/configuration rollback leaves the index in place and disables dispatch after draining. No schema rollback, data rewrite, new trust identity, paid infrastructure, commit, push or production activation was performed. PS-830/840/842 approvals and PS-850 scope remain unchanged. BA-11 must validate the deployed boundary in every activated profile; BA-12 must measure the actual production workflow. Next independent task: BA-09.

### Pre-approval containment record (historical)

**Status: BLOCKED for activation; finding 7 remains open.** This section supersedes any reading of the historical implementation PASS below as production Model Run proof. Starting source: clean `cb5de97169dcabbeee1a364b8b003d5a13e1ca46`, Node 24.22.1. No commit, push, deployment or migration is authorized or performed.

### Observed boundary and containment

The production `deploy/compose/profile-service.mjs` constructs the HTTP handler without `extensionRuntime`. Whole-tree inspection found only injected in-memory plan maps in integration tests, no production Release-to-plan resolver, and Docker CLI execution in `packages/extension-host`. The Compose application has no Docker socket or executor credentials. Keep it that way: an unrestricted container socket would bypass its application isolation.

Artifact custody already exists: `extensions/registry.ts` verifies signed offline bundles and stores immutable bundle bytes in the existing S3-compatible object store. Installation, binding, approved publisher/key, revocation, license and artifact lifecycle remain distinct checks. ADR-018 approves a hardened rootless container boundary; it does not define a deployed gateway identity, invocation transport, staging custody or recovery lifecycle. The local Docker Desktop daemon reports seccomp/cgroup namespace security options, **not rootless daemon mode**. Non-root workload execution is not proof of a rootless daemon.

The authorized Plugin operations and catalog responses now include `modelRuns: { status, reason, message }`. `unavailable/executor_not_configured` means no runtime adapter; `unavailable/plans_not_configured` means an empty registry; `configured` reports configuration only, never authorization or readiness of a particular plan. Responses disclose no plan, participant or Session identities. Studio and Plugin administration show the same server message; missing metadata from an older server is explicitly unverified. Deployment posture links to this live status. Governance and authoring remain usable. No executor is activated and no existing human approval is bypassed.

Scope reaches the shared contract, runtime capability helper, existing HTTP responses, Studio catalog, Plugin administration/deployment posture, unit tests, existing production-entrypoint/database fixture and product browser tests. There is no new route, dependency, datastore or execution service in this containment patch.

### Activation proposal requiring owner review

The user's BA-08 instruction says **“No new trust boundary without established approval.”** AGENTS.md §2 also requires confirmation before moving trust boundaries. The owner subsequently approved the following proposal for implementation and synthetic testing; the current implementation/evidence is recorded above. This is not production activation approval:

1. Implement a narrow supervisor for the existing Extension Host on a dedicated Linux service account with a rootless Docker daemon. Use a filesystem-permissioned local Unix socket for application-to-supervisor invocation; the application gets only that constrained socket, never Docker control. No externally reachable listener, arbitrary executable/image/mount/host-path options or general job API. Reuse the pinned image and existing manifest limits (SDK ceilings: 300 seconds, 4096 MiB, 10 MiB output) and no-network controls. Initially allow at most two active invocations with no in-memory waiting queue; reject excess work explicitly. This is a proposed bound, not measured deployment capacity.
2. Keep registry custody in existing object storage. The trusted application loads the exact approved Organization artifact and verifies its stored bundle/artifact/manifest digests and current trust. Send only the verified bundle and filtered immutable input snapshot to the supervisor. The supervisor validates paths/digests again, stages files under its own temporary directory, mounts only those files read-only, and removes staging after confirmed container termination. Plugin containers receive no application credentials, registry credentials, databases or general storage access.
3. Resolve execution plans from the Session's Governing Release, not an environment-supplied plan map. Preserve graph/binding/configuration digests and explicit trigger/reviewer/input/effect policy. The existing `ModelCompositionV1` graph does not by itself encode every `ExtensionRunPlan` policy field; implement and validate that mapping at the existing compiler/configuration boundary, with unsupported graphs explicitly unavailable rather than silently reduced to one node. Do not infer effect authority from Plugin output.
4. Persist claim/deadline/version state using existing Model Run records where sufficient. Recheck trust, installation, access and Authority Epoch before dispatch and before staging; commit output/proposals atomically and fail interrupted attempts visibly. Retries cannot recreate approved effects. Integrate bounded pending/recovery work through BA-05's tenant discovery, retaining feature-owned logic. Any additive migration is reviewed separately if existing fields cannot fence a stale executor.

This authorizes no paid infrastructure or production activation. Implementation approval would allow wiring and synthetic testing of this boundary; formal Security Owner review, a genuinely rootless supported-profile environment and BA-08-T01 remain separate evidence gates. A smaller alternative is to retain the explicit unavailable state; that contains the misleading availability claim but leaves required Model Runs incomplete.

### Acceptance and evidence

| ID | Status | Evidence boundary |
|---|---|---|
| BA-08-T01 | BLOCKED | No approved configured production execution boundary/Release-plan adapter; no production-handler → isolated run → proposal → approved effect proof. |
| BA-08-T02 | NOT RUN for activated production | Existing SDK, isolated executor and approval denial regressions are retained. Their results do not prove a deployed workflow. |
| BA-08-T03 | BLOCKED overall; containment PASS | Production-entrypoint/database test passes unavailable capability, anonymous denial, authenticated concurrent start rejection, one durable receipt, zero runs/proposals and replay after restart. Recovery of an executing attempt remains unimplemented and open. Browser evidence is recorded below. |

All commands use repo cwd `C:\Users\ssnguna\Local Sites\Plenum`, Node 24.22.1 and the root lockfile. Evidence directory: `output/ba-08/`; each command has a `.log` plus `.json` recording exact command, duration, exit and environment. TLS verification was enabled; security used Git Bash on PATH. Disposable infrastructure only: `plenum-ba08-db` (PostgreSQL 18.6; databases `plenum_ba08`, `plenum_ba08_r2`, `plenum_ba08_r3`, `plenum_ba08_product`, `plenum_ba08_product_focus`) and `plenum-ba08-s3` (SeaweedFS 4.48); 164,394,348,544 bytes available before creation. Exact container IDs: `435152ff096d16ddb4efcc01480ed95a75ede6450591737aeb64ffe086790964`, `4d1d7c02939863171307cc04c5569038d8de52c7a7695cd8a4410946a0f90489`. Both containers were identity-checked and removed after validation, disposing only synthetic tmpfs data. Existing stopped services are preserved; generated tracked screenshots/Plugin fixtures and the promptbook report were restored from pre-run backups.

| Command | Result / exit | Duration | Evidence under `output/ba-08/` |
|---|---|---|---|
| CMD-PLATFORM-TYPECHECK — `npm run typecheck` | PASS / 0 | 11.15s final | `typecheck-final.log`, `.json` |
| CMD-PLATFORM-TEST — `npm test` | PASS / 0; 169/169 | 20.71s | `unit.log`, `.json` |
| CMD-PLATFORM-INTEGRATION — `npm run test:integration` | PASS / 0; 46/46 | 150.46s final | `integration-final.log`, `.json` |
| CMD-AIRGAP — `npm run test:airgap` | PASS / 0; 9/9 plus deterministic isolated run | 20.45s | `airgap.log`, `.json`, `airgap-report.json` |
| CMD-SECURITY — `npm run test:security` | PASS / 0; 8/8, zero known vulnerabilities | 46.90s | `security.log`, `.json`, `security-report.json` |
| CMD-LOAD-EXTENSIONS — `npm run load:extensions` | PASS command / 0; aggregate capacity BLOCKED | 29.09s final | `extension-load-final.log`, `.json`, `extension-load-report.json` |
| `npm run lint` | PASS / 0; 52 contracts | 4.51s | `lint.log`, `.json` |
| `npm run audit:product-completeness` | PASS / 0; 240 obligations; REQ-038 explicitly BLOCKED | See metadata | `completeness.log`, `.json` |
| `npm run validate:promptbook` | PASS / 0; 51 tasks, REQ 94/94, INV 28/28 | See metadata | `promptbook.log`, `.json`, `promptbook-report.md` |
| CMD-PRODUCT-E2E — `npm run test:e2e:product -- --reporter=line,json` | PASS / 0; 41/41 | 589.35s | `product.log`, `.json`, `product-results.json` |
| Focused final browser rerun — `npm run test:e2e:product -- --grep 'PS-750-T02\|BA-08-T03' --reporter=line,json` | PASS / 0; 2/2 | 42.99s | `product-focused.log`, `.json`, `product-focused-results.json` |

Browser evidence uses synthetic authenticated application contexts, not an activated executor. It covers Studio binding and Admin/Publisher governance with the unavailable message, old-server metadata omission, a simulated 503, 1024×768, 512×384 (200% equivalent reflow), forced colors, reduced motion, visible keyboard focus and axe. Agent visual inspection of `studio-1024.png`, `studio-512.png`, `studio-forced-colors.png`, `plugins-1024.png`, `plugins-512.png` and `plugins-forced-colors.png` found readable, wrapping status text with no horizontal overflow. After the full 41-case run, only the two affected tests changed to scroll the status into view and strengthen captures; their final rerun passed. Application code did not change. Native browser zoom and new human/screen-reader review are NOT RUN; historical owner acceptance is not extended. Fixture startup media/scheduler warnings are not deployed provider/readiness evidence.

The initial integration run failed 45/46 because the expanded worker fixture lacked a Release activation required by Session authentication. The fixture now supplies that record; the focused production case then passed in 13.90s, followed by the full 46/46 rerun. Preserve `integration.log/.json` and `integration-focused.log/.json` as the failed-attempt/correction evidence.

The first load command exited 0 but its default container monitor collected no database samples. It is not a resource PASS. The corrected run sets `PLENUM_LOAD_DATABASE_CONTAINER=plenum-ba08-db` and `PLENUM_LOAD_DATABASE_ADMIN_URL` to the disposable owner connection; four database samples and resource monitoring pass. It measured 24 valid runs at concurrency 4 (p95 1701.56ms, zero errors), one deterministic output digest, two invalid-output and two timeout rejections, zero host-state mutations. Auto-created load databases `plenum_ps540_extensions_7ff9adf64e` and `plenum_ps540_extensions_66e77ab4fb` were removed by the harness. Its own aggregate acceptance remains BLOCKED; these are standalone host measurements, not production-handler performance.

Exact isolated fixture: `org.ssg.fixtures.synthetic-effect@1.0.0`, local `packages/extension-host/fixtures/synthetic-effect`, synthetic manifest digest `sha256:` followed by 64 `1` characters; image `node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f`. The missing image was cached by digest before gates; `test:airgap` itself never pulled. These tests use Docker Desktop 28.5.1, UID 65532, read-only mounts and no network. The synthetic manifest is not a production approved artifact identity and this is not rootless-daemon, production-custody, Release-resolution or T01 proof. No actual supported production artifact/profile identity can yet be reported.

Changed source/test files: `apps/server/src/extensions/runtime.ts`, `apps/server/src/http/runtime-http.ts`, `packages/event-contracts/src/index.ts`, `apps/runtime-web/src/product/AdministrationPortal.tsx`, `apps/studio/src/plugins/PluginCatalogEditor.tsx`, `apps/server/test/operational-security.unit.test.mjs`, `apps/server/test/tenant-jobs.integration.mjs`, `apps/server/test/identity.integration.test.mjs`, `tests/e2e/product/product-shell.spec.mjs`. Documentation changes are this record, document 10's additive metadata contract, PS-820 recovery guidance, PROJECT_STATE, the completeness matrix and its existing ledger. `candidate-files.json` records final file hashes; the original build audit is unchanged.

### Compatibility, recovery and continuation

The response addition is backward compatible; older clients ignore it and newer clients fail closed to “unverified” when it is absent. Existing Command receipts, approval semantics, immutable Releases, historical runs and stored bundles are unchanged. Rolling back this patch removes the status explanation; it does not enable execution or delete data. There are no artifact paths, secrets or protected inputs in the status response.

PS-830 owner acceptance, PS-840 checkpoint exception, PS-842 decisions and PS-850 approval retain their original scope. This patch adds no human AT acceptance. BA-11 must verify the approved deployed boundary and BA-12 must measure the activated workflow; standalone executor load is not application throughput. BA-09 can proceed independently, but finding 7 and the complete BA-08 gate remain open.

---

Date: 2026-10-19. Result: **IMPLEMENTATION PASS; FORMAL SECURITY OWNER REVIEW AND RELEASE APPROVAL PENDING**.

## Delivered

- `@plenum/extension-host` executes a digest-pinned local Plugin in a rootless, read-only, capability-free, no-new-privileges container with no network namespace and bounded CPU, memory, processes, time, temporary storage, and output.
- Composition Runs freeze only allowlisted state inputs plus the deterministic seed. Model Runs retain Plugin, configuration, input, output, environment, Release, attempt, duration, status, and failure provenance.
- Valid Plugin output can only stage Effect Proposals. It cannot access application stores or mutate authoritative state.
- Approval, rejection, and return use the ordinary Command kernel. Approval is bound to the proposal hash, target version, active Release, Authority epoch, reviewer Session Role, and immutable decision reason.
- One accepted approval applies one state transition, one immutable Approval Decision, one effect receipt, one Command Receipt, one Evidence Event, and one outbox record in the same transaction. Retries replay the original receipt; competing or stale decisions do not reapply the effect.
- The Runtime review UI is keyboard-operable, uses semantic controls and live notices, exposes the proposal provenance needed for review, and refuses to queue Approval Decisions while offline.
- Migration `012_extension_runs_approvals.sql`, OpenAPI, shared contracts, the migration/compatibility/security registers, and the operator provenance export cover successful and failed runs. Provenance remains queryable after Plugin revocation.

## Acceptance evidence

| Criterion | Evidence | Result |
|---|---|---|
| EXT-06 / EXT-07 | Frozen snapshots include only mapped state; malformed and timed-out runs record their failure with zero proposals. | PASS |
| EXT-08 / EXT-09 | State is unchanged while a proposal is in review; one valid approval applies through the Command kernel. | PASS |
| EXT-10 | A proposal whose target state version changed returns `STALE_PROPOSAL` and leaves state unchanged. | PASS |
| EXT-11 | The browser refuses offline Approval Decisions instead of creating a local-pending Command. | PASS |
| EXT-17 | Reviewer Session Role filtering denies an otherwise authenticated Participant. | PASS |
| EXT-18 | Concurrent approvals produce one accepted transition; retrying its Command ID replays the receipt. | PASS |
| EXT-20 | Existing designer-authored Stage and artifact automation remains on the normal Command path; the effect gate is scoped only to Plugin Effect Proposals. | PASS |

## Verification

Authoritative compile and automated checks ran in the cached `node:24.22.0-alpine` image. Database integration used a new disposable PostgreSQL 18.6 database. The air-gap workload executed the synthetic Plugin inside its own pinned Node 24.22.0 container.

| Check | Result |
|---|---|
| Lockfile install (`npm ci --ignore-scripts`) | PASS; 99 packages audited, 0 vulnerabilities |
| `CMD-PLATFORM-TYPECHECK` | PASS on Node 24.22.0 |
| `CMD-PLATFORM-BUILD` | PASS on Node 24.22.0 |
| `CMD-PLATFORM-LINT` | PASS; 28 sources, 17 versioned contracts |
| `CMD-PLATFORM-TEST` | PASS, 36/36 on Node 24.22.0 |
| `CMD-PLATFORM-DB` | PASS, 10/10 on Node 24.22.0 / PostgreSQL 18.6 |
| `CMD-PLATFORM-INTEGRATION` | PASS, 11/11 on Node 24.22.0 / PostgreSQL 18.6 / SeaweedFS 4.48 |
| `CMD-AIRGAP` | PASS, 6/6; includes actual rootless/read-only/no-egress Plugin execution |
| `CMD-PLATFORM-E2E` | PASS, 8/8 on the local Node 22.16.0 launcher / Chromium; the PS-230 offline and approval path passed |
| Focused PS-230 axe browser check | PASS, zero violations |
| Aggregate `CMD-PLATFORM-A11Y` | FAIL, 2/3; the new PS-230 check passed, while a pre-existing PS-210 test depended on state created by the non-a11y suite |

The direct Windows Node 22 typecheck was also blocked by the managed filesystem while resolving the parent user-profile path. It is not authoritative because the repository requires Node 24; the same checkout passed the supported Node 24 typecheck above.

## Migration and recovery

- Forward: apply migration 012 after 011 before enabling composition starts or Effect Proposal endpoints.
- Disable/forward-fix: stop new composition starts and reviews, then redeploy the prior application. Older code ignores the additive tables.
- Never delete or rewrite Composition Runs, Model Runs, proposals, decisions, receipts, or linked evidence during rollback. Pending proposals remain non-authoritative and may be returned or marked stale after service recovery.
- Full packaged deployment recovery, backup/restore, and extension load testing remain PS-530/PS-540 responsibilities.

## Residual risk

- Formal Security Owner review of the isolation profile is still required before release approval.
- Python/native targets, auto-approval, external-required execution, catalog/composition authoring UI, and production key/recovery procedures were deliberately not added.
- The aggregate accessibility command has a pre-existing test-isolation defect even though the new PS-230 flow and full browser suite pass.
