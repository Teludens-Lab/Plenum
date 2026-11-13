# PS-820 verification index

## BA-11 production composition acceptance — 2026-11-12

Candidate starts at `898234d9fa039c9d6c51c236c2a854138d13fc4a`, clean worktree, Node 24.22.1/npm 11.19.1 on Windows. That HEAD already contains BA-10 and the earlier BA-11 deadlock fix; neither is overwritten. Changes are test-only: `apps/server/test/tenant-jobs.integration.mjs`, its existing `identity.integration.test.mjs` entry, child-only `omit-production-wiring.mjs`, and `tests/e2e/product/live-sync.spec.mjs`. No application behavior, dependency, migration, public contract or production configuration change. No commit, push or deployment is authorized.

### Acceptance and boundary map

| Acceptance | Boundary exercised | Evidence / limitation |
|---|---|---|
| BA-11-T01 — PASS locally | Actual `deploy/compose/profile-service.mjs`, PostgreSQL/RLS, tenant discovery, timers, Runtime assets and HTTP | Both acceptance tenants publicly provisioned; second discovered after startup; idle authorized browsers update without manual publisher/refresh |
| BA-11-T02 — PASS locally | Four process-local wiring omissions; provider faults, duplicate processes, restart and graceful shutdown | Startup, Inject, publication and attachment omissions each failed the bounded work predicate; restoring wiring recovered without duplicate delivery |
| BA-11-T03 — local gates PASS, one environment case NOT RUN | Build, typecheck, lint, unit, full integration, product browser, deployment smoke, security and observability | Full integration has one explicit BA-08 rootless-executor skip; hosted CI, live providers and release approval remain separate |

The job harness starts from the existing migrated synthetic bootstrap setup, then creates **both acceptance Organizations** through the production Platform API: create, domain challenge/verification, first-Admin invitation/delivery/acceptance and lifecycle activation. The second is provisioned after the first tenant's service has started. Its Admin binds the existing deployment through the public jobs API. Release/Session/content/expired-file inputs remain explicitly seeded fixtures, not authoring or installation proof. Timers—not test calls to publisher, cleanup or checkpoint workers—cause Inject delivery, outbox publication, report retention, attachment journal recovery, Floor revocation and checkpoints. Independent SQL/S3 assertions inspect effects. The separately labeled deadlock regression directly invokes kernel APIs and is not used as automatic-trigger evidence.

The browser case now uses a synthetic HTTPS OIDC issuer and the production authorization-code/PKCE/nonce/callback path for the Operator and three Participant contexts. It does **not** install session cookies or substitute `authenticate`. The application issues Secure/HttpOnly/SameSite cookies. Approved provider configuration and federated mappings are seeded; this is not provider-onboarding or Entra/Okta interoperability proof. A supported Platform API reconciliation establishes legacy workspace routing before login. Operator Commands produce canonical changes; two idle authorized clients receive them, a hidden recipient does not, reconnect recovers, reassignment removes prior access, and late responses cannot restore revoked data. The later explicit Refresh is solely a stale-response race probe, never the automatic-delivery trigger.

Synthetic external boundaries are explicit: test TLS and OIDC signing, test-only DNS answers, an invitation webhook, a LiveKit protocol stub, AWS KMS/S3 protocol stubs for signing/anchors, and pinned SeaweedFS for actual disposable object bytes. DNS substitution is restricted to a child preload and registered test challenges; it changes no application authorization. The omission preload uses Node module hooks to remove exactly one known call in child memory, fails if the source match drifts, and is loaded only by test spawn arguments. There are no production test flags. Missing executor and Replay configurations must report unavailable; these are containment checks, not successful Model Runs or reconstruction.

### Audit-to-command inventory

| Audit finding / obligation | Existing executable regression | Actual boundary |
|---|---|---|
| 1, 9: login binding/return path (BA-01) | Product `oidc-login.spec.mjs`; integration BA-01 | Real production callback plus isolated Chromium contexts; synthetic IdP |
| 2: shared anonymous quota (BA-02) | Integration BA-02-T01/T02/T03 | Production HTTP, real DB contention, spoofing and controlled windows |
| 3: Floor expiry/recovery (BA-04) | Integration Floor recovery and tenant-job shutdown | Production timer/provider protocol; actual media publish enforcement remains external |
| 4: publication/idle clients (BA-06) | Integration publication omission/backlog; product `live-sync.spec.mjs` | Production publisher and actual rendered Runtime; no manual publisher/refresh trigger |
| 5: tenant jobs (BA-05) | Integration tenant harness including public provisioning and startup/Inject omissions | Real entrypoint, authorized tenant binding, post-startup discovery, duplicate workers and authority denial |
| 6: attachment expiry (BA-07) | Integration read policy plus tenant attachment omission/failure/restart | Production cleanup, real S3-compatible bytes, journal state, holds and delayed-worker denial |
| 7: Model Runs (BA-08) | Integration unavailable boundary, HTTP transport harness, separate qualifying-rootless test | Positive activated isolation remains environment-gated; transport fixture is not deployed proof |
| 8: Replay (BA-09) | Integration capability/denial plus existing Operator product case | Unavailable adapter is accurate; genuine reconstruction remains BLOCKED |
| 10: Origin/CSRF (BA-03) | Product `browser-origin.spec.mjs`; integration security cases | Real browser cookie/origin and production gateway/HTTP checks |
| Signed evidence (BA-10) | Integration tenant checkpoints, outage/restart and independent verifier process | Actual worker/adapter calls with synthetic custody; no live golden or independent-owner proof |

`tests/e2e/runtime-server.mjs` still provides the general product fixture with persona authentication, memory storage/media and direct handler composition; its green tests do not prove production construction. The targeted production browser files spawn the actual profile service themselves. `scripts/test-deployment.mjs` proves packaged startup/security headers, supported profile configuration and bounded air-gap smoke; it does not replace the database/browser acceptance above. Existing CI already runs the integration and product commands, so no duplicate command, service or workflow is added.

### Verification and continuation

All commands below ran from `C:\Users\ssnguna\Local Sites\Plenum`; durations include their configured builds. `output/ba-11-production/checks.json` records timestamps, durations, exits and log paths. No application source changed during verification. After strengthening the first acceptance tenant to use public provisioning too, build/type/unit/full integration/lint were rerun; `initial-*` preserves the earlier successful run. The browser test, packaged application and security-tested code are unchanged by that integration-fixture-only refinement.

| Command ID / actual command | Result / exit | Seconds | Evidence under `output/ba-11-production/` |
|---|---|---:|---|
| CMD-PLATFORM-BUILD / `npm run build` | PASS / 0 | 3.93 | `build.log` |
| CMD-PLATFORM-TYPECHECK / `npm run typecheck` | PASS / 0 | 16.17 | `typecheck.log` |
| CMD-PLATFORM-LINT / `npm run lint` | PASS / 0; 139 sources, 52 contracts | 4.59 | `lint.log` |
| CMD-PLATFORM-TEST / `npm test` | PASS / 0; 174 passed, none failed/skipped | 14.31 | `unit.log` |
| CMD-PLATFORM-INTEGRATION / `npm run test:integration` | PASS / 0; 47 passed, none failed, 1 environment skip | 283.42 | `integration.log` |
| CMD-PRODUCT-E2E / `npm run test:e2e:product` | PASS / 0; 42 passed, none skipped | 1101.06 | `product.log` |
| CMD-DEPLOYMENT-SMOKE / `npm run test:deployment` | PASS / 0; 6 passed | 38.03 | `deployment.log` |
| CMD-SECURITY / `npm run test:security` | PASS / 0; 8 passed; dependency audit reports 0 vulnerabilities | 66.79 | `security.log` |
| CMD-OBSERVABILITY-CONTRACT / `npm run validate:observability` | PASS / 0; 8 alerts, 4 panels | 0.55 | `observability.log` |

The integration skip is `BA-08-T01 supported rootless production entrypoint executes and approves a governed effect`: qualifying Linux rootless supervisor socket unavailable. It remains NOT RUN, not proof of real isolation. Full/final integration and product databases recorded **zero deadlocks** (`final-database-counters.log`). Promptbook validation passed 51 tasks, REQ 94/94 and INV 28/28; structural completeness passed 240 obligations including its deliberate omission check. These structural checks do not grant product acceptance.

Application image: `sha256:ad7c53ae169f87fd5be56f1f9edafd64261a0273fa5136ce85df3e91e3e8e8ae`, tag `plenum-ba11-production:verification`, Dockerfile Node 24.22.0. Root lockfile SHA-256: `4cdf368c302e3c7ab8d9568255c5aa32c4a9bbddeef4dee4c3b6ac39fdc1eb61`. Schema includes existing migration 048; BA-11 adds none. Full behavioral proof uses the cloud profile; packaged smoke covers cloud, institutional and air-gapped profiles and is not full behavior qualification of every profile. PostgreSQL 18.6 and SeaweedFS 4.48 use the CI-pinned digests recorded with exact container IDs in `services.log`; `candidate.json` records final changed-file hashes. Service configurations and synthetic adapter identities are in the committed test fixtures; no production key or provider configuration is consumed.

Builds retain large-chunk warnings. The general browser fixture logged schema-bootstrap/synthetic-media warnings and a pg future-version concurrency deprecation; logs retain them. The actual production cases assert their own outcomes and readiness independently. The connected, reconnecting and 200% desktop screenshots from the focused browser run were visually reviewed; existing axe, keyboard, forced-colors and reduced-motion checks passed. This is automated/agent review, not a new human AT acceptance. No UI component was changed.

Earlier focused attempts are retained: the wiring-only job proof passed; the expanded public-provisioning run exposed an old assumption that a newly generated tenant UUID must fall on a specific page. The replacement asserts page bounds, no repeated IDs and inclusion across both pages. The first browser attempt queried the workspace slug from the wrong table; the corrected run uses canonical provisioning and passed production OIDC/idle-client/revocation checks. These failed attempts are not PASS evidence.

Cleanup: after verifying zero database clients, the identity-checked BA-11 PostgreSQL/S3 containers and the uniquely tagged application image were removed. Unrelated containers were preserved (`remaining-containers.log`). Fresh generated evidence was copied under `current-generated/` before restoring the tracked historical artifacts; the generated promptbook report was likewise retained as task evidence and restored. `git diff --check` passes. The final diff contains only four test files and five existing documentation/continuity files. No commit, push or deployment occurred.

Remaining external gates: qualifying BA-08 rootless execution/security activation; BA-09 independent deterministic reconstruction; BA-10 approved signing/key distribution/independent anchors and both live golden exports; hosted CI/Linux browser evidence; live alert delivery; BA-12 converged load/voice latency; named final release approval. Prior PS-830 human acceptance, PS-840 continuation exception and PS-842 decisions retain their scope. This suite cannot close those gates.

The PS-820 record below is historical and is not the BA-11 candidate's verification result.

Recorded: 2026-11-07\
Candidate: `43284c3e7ba39f0431d7a4398c19c50ad7dc8b45` plus the listed working-tree changes\
Environment: Windows, Node `v24.22.1`, npm `11.19.1`, Docker, PostgreSQL `18.6-alpine`, SeaweedFS `4.48`, Playwright `1.64.1` Chromium\
Decision: **AUTOMATED PASS / HUMAN DESKTOP ACCEPTANCE NOT RUN**

PS-820 proceeded under the Product Owner's explicit prerequisite exception after PS-815 internal acceptance passed. Deferred PS-810/PS-815 provider evidence was not counted as PS-820 evidence and is not a failure of this install/recovery phase.

## Acceptance evidence

| Gate | Result | Evidence |
|---|---|---|
| Node preflight | PASS | Node `v24.22.1`; npm `11.19.1` |
| TypeScript | PASS | `npm run typecheck` |
| Build | PASS | Candidate Runtime and Studio production builds |
| Unit and contract regression | PASS | `npm test`; 130/130 |
| Contract lint | PASS | `npm run lint`; 90 sources and 44 versioned contracts |
| Clean install and upgrade | PASS | `npm run test:clean-install`; 77.4s; prior image migration 038, forward-fix 039/040, representative data preserved, prior-image compatibility retained, current shell reached on all three profiles; `test-results/clean-install/ps-820-clean-install.json` |
| Deployment smoke | PASS | `npm run test:deployment`; 6/6; `test-results/deployment/ps-530-smoke.json` |
| Air-gapped operation | PASS | `npm run test:airgap`; 9/9; no-egress/rootless/read-only controls and local Plugin execution; `test-results/airgap/ps-220-airgap.json` |
| Backup and restore | PASS | `npm run test:backup-restore`; RPO 1s, RTO 6s, one object restored, one Evidence chain verified; `test-results/recovery/ps-530-restore.json` |
| Independent Evidence verification | PASS | `npm run verify:evidence`; 6/6 including tamper, omission, reordering, rotation and separate-custodian evidence |
| Desktop automated accessibility | PASS | `npm run test:a11y`; 11/11 in 8.0m; keyboard/Axe journeys plus managed-device `ACCESS_REVOKED` cache clearing |
| Structural completeness audit | PASS | `npm run audit:product-completeness`; 228 obligations and deliberate omission check |
| Promptbook validation | PASS | `npm run validate:promptbook`; 49 tasks, REQ 94/94, INV 28/28, no dependency cycles |
| Patch whitespace | PASS | `git diff --check` |
| Qualified Windows/macOS keyboard and screen-reader review | **NOT RUN** | Complete `docs/design/user-test/PS-820-script.md`; mobile/touch is N/A |
| Named tester, witness and approving owner | **NOT RUN** | Required for PS-820 change-level acceptance |

The first backup/restore invocation failed before the test because the disposable SeaweedFS container had an invalid bind option. The corrected repository-aligned `-ip=storage` launch became healthy and the complete recovery command passed. The failed infrastructure invocation is not acceptance evidence.

## Decision and next action

All executable automated PS-820 gates pass. PS-820 is not yet change-level accepted because the qualified human desktop accessibility record and named approval are `NOT RUN`. No production system, identity, provider, credential or data was used. All PS-820-created disposable containers were removed.
