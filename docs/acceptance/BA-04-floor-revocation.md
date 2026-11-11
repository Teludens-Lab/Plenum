# BA-04 — Reconcile radio Floor provider revocations

## Outcome

High-risk, pre-production remediation of audit finding 3. The prior provider holder remains a durable obligation after Floor expiry/release; provider uncertainty blocks successor grants. Production starts a bounded expiry/retry worker, and new processes recover pending effects. No new service, provider, dependency, audio storage or identity model.

Security acceptance T01–T03: **PASS within the boundaries below**. Capacity/release acceptance: **BLOCKED**, including the measured voice burst latency miss. Code delivery does not close that gate.

Starting tree was clean at `45b25c36f40fb9dd945abd2b95a074b314abd46a`, including BA-01/02/03. Node **v24.22.1**, root lockfile. The original [build audit](../release-evidence/2026-11-10-build-audit.md) remains unchanged. Governing sources: PS-250/780; REQ-079–082; INV-026–028; Roadmap §16; PRD, Voice and Radio v1.1, API/Event Contracts §12.3, Decision Register DEC-48/49/50 and ADR-017, and the Glossary Floor Lease lifecycle. No new human acceptance or PS-850 release approval is granted.

Final implementation identity: [15-file SHA-256 manifest](../../test-results/ba-04/candidate.json), digest `8afbef5615c430e40c22fc3e48c6e1628c7a1bb138c1472af85365e465bf4772`. The prior manifest is retained separately. The final change after application verification added only the lost-disable-acknowledgement regression; it is reached by the registered integration command.

## Acceptance and boundary evidence

| ID | Result | What was actually proved |
|---|---|---|
| BA-04-T01 | PASS | Real database and adapter harness: expiry reconciliation disables the holder without another request. Real Chromium and LiveKit: a connected publisher never renews, releases or calls local mute; the test advances its persisted deadline, the scheduled worker revokes provider `canPublish`, and LiveKit reports no published tracks. Audio is synthetic. |
| BA-04-T02 | PASS (database/provider failure harness) | Failed release returns `MEDIA_UNAVAILABLE` and retains `pending_disable`, attempts and retry deadline. A new pool and a separate Node process recover the persisted obligation. Interrupted enable reservations are revoked, and timeout-after-possible-enable is compensated. A successful expiry disable with a lost acknowledgement also remains pending, blocks successors and is safely retried. Real LiveKit outage/restart with this browser is not claimed by that failure harness. |
| BA-04-T03 | PASS | Failed prior revocation blocks successors and request traffic cannot bypass durable backoff. A delayed disable completes before the same participant's next enable. Renewal/expiry contention, duplicate reconciliation, in-flight enable expiry, stale Authority Epoch and foreign Organization/deployment denial are covered. The real provider test confirms the old holder is disabled before the successor publishes and explicit release removes its tracks. Fresh-credential reconnect starts listen-only, rejects the released Floor request replay, and requires a new lease to publish. Cached provider-token replay is not claimed. |

Baseline reproduction is executable through the existing integration harness: [observations](../../test-results/ba-04/reproduction.json), [original regression](../../test-results/ba-04/reproduction-test.mjs), [command](../../test-results/ba-04/reproduction-command.json). Both `expiryLeftBothPublishing` and `swallowedDisable` were true. The baseline integration command remains **FAIL**, as expected for the regression.

The database test uses controlled persisted deadlines/retry times and explicit promise barriers, not sleeps. The process-recovery test uses a new Node process with only database state and a synthetic HTTP provider adapter; it is not a real-provider failover claim. The browser proof goes through real HTTP grants, the shared scheduled worker and LiveKit's management API. It checks provider permission and published tracks, not merely a UI badge or local microphone flag. The separate existing media regression exercises actual microphone packets, keyboard Floor controls and repeated joins. Chromium's local-network permission is explicitly granted to the synthetic test origin; browser security checks remain enabled.

## Provider, persistence and operational bounds

- Provider: disposable loopback **LiveKit 1.13.10**, image `livekit/livekit-server:v1.13.10@sha256:89ca9ce0791e18d6e03bf6e2c49ceb27e1c754eae8bd50c989386c1a5963791a`; server SDK **2.19.1**, browser SDK **2.23.0**, Playwright **1.64.1**. No real-user audio or production fault injection.
- Additive migration **044** adds provider state/attempt/retry/acknowledgement fields to existing Floor Lease rows and retains current RLS and history. The [upgrade probe](../../test-results/ba-04/migration-probe.json) applied it to the baseline database: both legacy rows and every old field were preserved; both defaulted to `pending_disable`.
- Poll: **250 ms**, one batch in flight, at most **20 channels** per batch and **20 old obligations** per channel; stop that channel at its first failure. Provider RPC timeout: **5 seconds**, no SDK regional failover. Retry spacing: **1, 2, 4, 8, 16, 30 seconds**, then 30 seconds indefinitely; attempt counter saturates at 30. Obligations are never discarded as successful on exhaustion.
- A per-Organization/channel PostgreSQL session advisory lock orders effects across processes. Short RLS transactions reuse its connection, so no SQL transaction spans a provider call and lock waiters cannot exhaust a second connection pool. Authority and lease state are checked around enable; acknowledgement updates check the lease version. Completed disables are not replayed against a new valid lease. Uncertain startup reservations are disabled, never automatically enabled.
- All actual provider enables still originate in authenticated Floor requests. Workers only revoke persisted, trusted Organization/Session/channel/holder bindings and honor the pinned adapter and current owning authority. Existing consent and recording defaults remain unchanged.
- The configured OIDC Organization is wired at production startup and drained at shutdown. **BA-05/BA-11 must add and verify coverage for additional Organizations.** This is not deployment-wide tenant coverage or representative LAN/TURN/TLS acceptance.

[Operations and recovery](../operations/PS-810-OBSERVABILITY-SECURITY.md#radio-floor-provider-reconciliation--ba-04) documents failure visibility and pending-work inspection. The first failed disable writes the existing `media_provider.unavailable` event/outbox; worker failures emit its scrubbed operational category `floor_reconciliation`. No credentials, raw provider errors or audio are logged by the worker.

LiveKit documents that removing publish permission unpublishes tracks, whereas token TTL does not terminate an existing connection: [participant permissions](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/), [token lifecycle](https://docs.livekit.io/frontends/reference/tokens-grants/). These are supporting semantics, not substitutes for the pinned-provider test. This remediation does not rely on token expiry or cooperative local mute.

## Verification

All commands ran from `C:\Users\ssnguna\Local Sites\Plenum` on Windows with Node v24.22.1. JSON records include exact command, environment, runtime, duration, exit and status; adjacent logs preserve failed attempts.

| Command | Result | Evidence |
|---|---|---|
| CMD-PLATFORM-TYPECHECK — `npm run typecheck` | PASS / 0; 12.38 s | [typecheck-final.json](../../test-results/ba-04/typecheck-final.json) |
| CMD-PLATFORM-TEST — `npm test` | PASS / 0; 164/164; 13.17 s | [unit-final.json](../../test-results/ba-04/unit-final.json) |
| CMD-PLATFORM-LINT — `npm run lint` | PASS / 0; 6.20 s; 132 sources, 52 contracts | [lint-final.json](../../test-results/ba-04/lint-final.json) |
| CMD-GAP-AUDIT — `npm run audit:product-completeness` | PASS / 0; 0.91 s; 240 obligations, omission check | [completeness-final.json](../../test-results/ba-04/completeness-final.json); structural check, not release acceptance. |
| CMD-PLATFORM-INTEGRATION — baseline reproduction | FAIL / 1; 119.22 s | [reproduction-command.json](../../test-results/ba-04/reproduction-command.json); confirms both defects. |
| CMD-PLATFORM-INTEGRATION — initial fix | PASS / 0; 44/44; 130.84 s | [integration.json](../../test-results/ba-04/integration.json) |
| CMD-PLATFORM-INTEGRATION — separate-process recovery | PASS / 0; 44/44; 131.84 s | [integration-final.json](../../test-results/ba-04/integration-final.json) |
| CMD-PLATFORM-INTEGRATION — optimized grant path | PASS / 0; 44/44; 185.95 s | [integration-optimized.json](../../test-results/ba-04/integration-optimized.json) |
| CMD-PLATFORM-INTEGRATION — final lost-acknowledgement regression | PASS / 0; 44/44; 133.30 s | [integration-ack.json](../../test-results/ba-04/integration-ack.json) |
| CMD-PLATFORM-MEDIA — earlier attempts | FAIL | [initial](../../test-results/ba-04/media.json), [second](../../test-results/ba-04/media-final.json), [focused](../../test-results/ba-04/media-probe.json), [diagnostic](../../test-results/ba-04/media-diagnostic.json), [provider pass / legacy TLS mismatch](../../test-results/ba-04/media-verified.json). Details below. |
| CMD-PLATFORM-MEDIA — earlier full gate | FAIL / 1; 121.55 s; BA-04 passed, legacy offline selector was ambiguous | [media-complete.json](../../test-results/ba-04/media-complete.json) |
| CMD-PLATFORM-MEDIA — optimized path and reconnect | FAIL / 1; BA-04 passed, legacy join p95 exceeded 3 s during concurrent integration work | [media-closed.json](../../test-results/ba-04/media-closed.json), [measurements](../../test-results/ba-04/media-closed-report.json) |
| CMD-PLATFORM-MEDIA — final isolated gate | PASS / 0; 2/2; 89.05 s | [media-isolated.json](../../test-results/ba-04/media-isolated.json), [measurements](../../test-results/ba-04/media-isolated-report.json) |
| CMD-LOAD-VOICE — first fix | FAIL / 1; prepared lease expired under burst before confirmation | [load-voice.json](../../test-results/ba-04/load-voice.json) |
| CMD-LOAD-VOICE — optimized path, initial measurement | PASS / 0; 72.09 s; capacity NOT accepted | [load-voice-final.json](../../test-results/ba-04/load-voice-final.json), [report](../../test-results/ba-04/load-voice-unmonitored-report.json); p95 748.38 ms, database resource sampler targeted the wrong container. |
| CMD-LOAD-VOICE — isolated, corrected resource sampling | PASS / 0; 80.34 s; **performance target FAIL / capacity BLOCKED** | [load-voice-monitored.json](../../test-results/ba-04/load-voice-monitored.json), [report](../../test-results/ba-04/load-voice-monitored-report.json) |

Earlier media attempts exposed test-environment issues: missing Chromium local-network permission, stale collapsed-panel/heading selectors, and an institutional TLS assertion applied to a loopback UDP target. Synthetic application headers are now isolated from provider signaling; advertised media ports match host mappings. The local fixture now writes separate local topology evidence and retains TLS assertions for institutional targets. Earlier failed commands are not relabeled PASS and historical institutional acceptance is not replaced with loopback results.

Final browser media measurements: join p95 **1,505.89 ms** (21 samples), speech-start median **77.25 ms** (five samples), keyboard Floor p95 **299.89 ms** (ten samples), **0% packet loss**, UDP on loopback. All existing thresholds passed. Initial worker warnings in this harness occur while global setup recreates the schema; production must apply migrations before starting workers.

The first load failure drove removal of redundant reconciliation transactions from ordinary requests. Pending or expired prior holders still take the revocation barrier, and every new enable retains pre/post authority and lease validation. Lease duration is unchanged and starts from the database's current clock close to reservation; renewal cannot resurrect an already-expired lease.

Measured voice load: **5,000 requests, 10 Sessions, concurrency 50, zero request errors**, Floor request p95 **1,085.43 ms**, p99 **2,931.15 ms**. The p95 exceeds the approved 500 ms target: this is an unresolved release/performance gate for **BA-12**, not capacity acceptance. Resource sampling passed (six database samples). Floor control load uses the adapter harness; the separate real SFU phase used **49 listeners/one synthetic speaker for 20 seconds**, zero packet loss before/after restart, and **8,759.26 ms** restart recovery. These are distinct measurements, not 5,000 real browser publishers. The report's generic storage label is inaccurate for this fixture: PostgreSQL used task-owned tmpfs, not a persistent managed volume. CLI **2.19.2** archive SHA-256 `3a76873bd0a593d03b1305499ae0e468a242742eb3bfbfac737f27f1d00be139` was verified before use. Full-duration soak, three converged load sets and representative network acceptance remain outside BA-04.

## Change and recovery inventory

Implementation: `apps/server/src/comms/voice.ts`, `apps/server/src/database.ts` (existing transactions can reuse a locked connection), `apps/server/src/http/runtime-http.ts` (ordered moderation/removal effects), `packages/media-adapter/src/index.ts`, `deploy/compose/profile-service.mjs`, migration `044_floor_provider_reconciliation.sql`.

Tests/callers: `apps/server/test/floor-revocation.integration.mjs`, `identity.integration.test.mjs`, `packages/media-adapter/test/adapter.test.mjs`, `tests/e2e/global-setup.mjs`, `runtime-server.mjs`, `floor-revocation.spec.mjs`, `playwright.media.config.mjs`, `runtime.spec.mjs`, `tests/load/voice-profile.mjs`. The load fixture now binds only loopback and advertises the same media ports it exposes.

Continuity: this handoff and `.gitignore` exception, PS-810 and PS-820 runbooks, `PROJECT_STATE.md`, `PRODUCT_COMPLETENESS_MATRIX.md`, existing `product-completeness-ledger.json`. No competing acceptance ledger.

Deploy by draining old writers, applying migration 044, starting the new worker, and clearing pending legacy obligations before reopening radio traffic. Mixed old/new grant paths are unsafe despite additive schema compatibility. Rollback reopens finding 3: keep radio unavailable and forward-fix; never down-migrate persistent evidence or manually mark unconfirmed provider work complete.

## Workspace and disposable resources

[Preflight](../../test-results/ba-04/preflight.json) recorded a clean tree and 177,789,399,040 free bytes. All service ports were loopback-only; no production credentials, persistent volumes or real-user audio were used. [Fixture inventory](../../test-results/ba-04/resources.txt) and [final database inventory](../../test-results/ba-04/databases-final.txt) identify the task resources. PostgreSQL and SeaweedFS used tmpfs; LiveKit had no mounts.

- `plenum-ba04-pg`: `e87cb3774d2412b26d766ae80b6c942093c4abe63b0fa7b5167864b46a5102cf`.
- `plenum-ba04-s3`: `ba9b6b932004d462fc802ea1b0d8b618341ccb6e82f56febeecd0e136be91842`.
- `plenum-ba04-livekit`: `63ce08f3cd5a6bdcd03c6dc195edcaff064a0fe6e72ff0460c8a3700ac2b36c1`; it replaced the task's earlier mis-mapped instance `85cf07fe60efc2a7285df4f087d58822ad5adfaabf12fd9539ee51be52660891`.

The load harness created and removed its own random databases and two successive LiveKit containers per successful run; [exact identities](../../test-results/ba-04/load-resources.json) are retained. Final inspection found neither load database nor load container left behind. The three named fixtures above were removed by exact ID after all checks: [cleanup](../../test-results/ba-04/cleanup.log). No broad pruning was used.

Five initially clean tracked test artifacts were [archived with hashes](../../test-results/ba-04/generated-artifacts.json) under `test-results/ba-04/generated/`, then restored byte-for-byte from HEAD, preserving historical institutional evidence. Final source/test hashes match the candidate manifest; documentation continuity was rechecked with [CMD-GAP-AUDIT](../../test-results/ba-04/completeness-continuity.json). Failed-run logs, local measurements and the verified CLI remain in ignored `test-results/ba-04/`. No unrelated source changes were present or overwritten.

## Remaining scope and continuation

Representative institutional network/provider acceptance, deployed failover and additional-Organization worker coverage remain **NOT RUN** for this candidate. Expiry enforcement requires a running owning worker and reachable provider; arbitrary control-plane downtime or loss of a database advisory-lock connection during an in-flight provider RPC is not a proven failover boundary here. Poll/retry bounds are policy; measured capacity is recorded separately. The failed burst latency target remains a release blocker for BA-12. PS-830 owner-reported product/desktop AT acceptance, PS-840's signed-checkpoint exception and PS-842 decisions retain their original scope and grant no PS-850 approval.

No commit, push, PR, publication or deployment. Next: **BA-05**. Revisit on provider/API changes, authority topology changes, new Organizations, measured backlog growth or altered Floor lease durations.
