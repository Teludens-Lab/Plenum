# PS-545 command and Floor optimization evidence

**Current candidate update (2026-11-13): BA-12 measurements below find failed Floor and browser projection-delay budgets. The October PASS remains historical evidence; it is not acceptance of the corrected November candidate.**

Date: 2026-10-26  
Status: **PASS on the owner-approved lower-capacity equivalent; production-institution operations acceptance remains external**

## Claim boundary

This report compares PS-540 with PS-545 on the owner-approved Windows/Docker lower-capacity equivalent and a synthetic 10-Session by 500-Participant fixture. The required 30-minute warm-up, 60-minute mixed steady state, bursts, recovery, raw saturation series, and three consecutive post-soak application/voting/voice/Extension sets pass. A user-authorized segmented two-laptop LAN run separately covers browser TURN/TLS, join, speech-start, Floor, packet loss, and media-provider restart recovery. These results do not claim production-institution DNS, PKI, firewall, hardware, or operator acceptance.

The accepted full soak (`approved-soak-4`) immediately preceded the last read-only information-flow Release-cache change. That change was made after a post-soak fan-out repetition exposed repeated immutable snapshot transfer. At the owner's direction, another 90-minute soak was not run; the final cache is instead covered by three fresh application diagnostics, 23/23 database integrations, and three consecutive final-code report sets. This is the recorded residual evidence limitation, not a hidden claim that the exact final working tree completed a second full soak.

## Measured causes

- Accepted Commands held an exclusive `runtime.session_authorities` row lock for the full transaction. During PS-540 reproduction, 48 connections waited on tuple locks and one on a transaction ID. The indexed authority lookup itself took 0.128 ms, while lock acquisition raised the observed statement to 2,432 ms.
- Moving authority validation to a shared lock exposed the next serialized write: Evidence sequence allocation. Command Receipt, Evidence Event, and outbox writes were separate statements within the same transaction.
- Artifact Commands and Floor requests read a Release snapshot containing an approximately 18.94 MB `resources` member that neither hot path needed. Even after omitting that member, concurrent Commands repeatedly transferred and parsed the same immutable published definition inside their transactions.
- A post-soak repetition later exposed the same issue in Message and automatic-Inject paths: ten concurrent operations transferred the immutable snapshot again, producing PostgreSQL `ClientWrite` waits and 8.18/14.43-second Message/Inject fan-out p95.
- Floor requests took the per-channel exclusive lock before validating the current voice grant and repeatedly re-read Release policy. The channel lock is still required to preserve one active Floor Lease; an attempted shared mutation correctly failed the unique active-lease invariant and was discarded.
- The remaining local variance correlated with `evidence.session_sequences` queues behind WAL flushes. The original PostgreSQL container used 4 MB auto-sized WAL buffers, five-minute checkpoints, and 1 GB `max_wal_size`; the cluster-wide counters recorded 1,097,629 WAL-buffer-full events and 36.7 seconds of checkpoint sync time. Durability remained enabled throughout.

No broker, database split, or service split is justified. The contention is within two existing authoritative transactions and improves materially when their lock scope and repeated immutable Release reads are reduced.

## Implemented optimization

- Authority validation uses `FOR SHARE`; a transaction-scoped advisory lock serializes only duplicate Command IDs so concurrent replay still returns one original receipt.
- Tenant transaction role/context setup, authority/advisory locking, participant/device admission, and Artifact revision/author writes each use one database round trip instead of two or three. The receipt read deliberately remains a second statement after the advisory lock so PostgreSQL takes a fresh MVCC snapshot for a concurrent replay winner.
- The primary accepted-command path allocates the Evidence sequence and inserts the Evidence Event, Command Receipt, and transactional outbox through one data-modifying CTE.
- Artifact and information-flow Release reads omit the unused Resource payload and each share one bounded, per-process promise for each immutable published Release. Concurrent callers therefore perform one database read/parse, failures are evicted for retry, and each cache is capped at 64 Releases.
- Floor authorization uses the current, revision/epoch-scoped server voice grant before taking the channel mutation lock. Radio eligibility remains materialized in the grant, while radio Media Credentials remain listen-only until the authoritative Floor path enables transmit.
- Floor Event sequence/Event/outbox writes use one data-modifying CTE, and expired leases are updated only when no current non-expired lease exists.
- The command profile now applies the approved 1,000-Command/10-second window across Sessions and records unique run artifacts. Integrity checks cover receipt/Event/outbox correspondence, sequence continuity, one queued outcome per Floor request, and positive queue positions.
- The institutional PostgreSQL profile keeps `synchronous_commit=on` and sets measured burst controls: 16 MB WAL buffers, a 15-minute checkpoint interval, and 4 GB `max_wal_size`. The load report records these settings.
- `npm run load:soak` now schedules 5,000 warm-up projections over 30 minutes, a 60-minute mixed steady state of 5,000 projections plus 1,000 accepted Commands, the 60-second reconnect ramp, and the existing Command/fan-out bursts. Duration overrides require an explicit diagnostic flag and are recorded in the report.
- Every final report records one-second application CPU/memory, database connection/queue data, five-second PostgreSQL-container CPU/memory samples, peak values, growth, and consecutive time at or above the 80% saturation threshold.

No migration or external contract change was introduced.

## Before/after results

Approved targets are Command p95 <= 500 ms, burst p99 <= 2,000 ms, Ballot p99 <= 2,000 ms, Floor p95 <= 500 ms, and fan-out p95 <= 5,000 ms.

| Measure | PS-540 baseline | Local run 1 | Local run 2 | Local run 3 | Result |
|---|---:|---:|---:|---:|---|
| Command receipt p95 | 15,376.23 ms | 56.94 ms | 77.75 ms | 538.93 ms | **FAIL**: run 3 exceeds 500 ms |
| Command receipt p99 | 16,622.14 ms | 65.46 ms | 92.80 ms | 558.94 ms | PASS in all three |
| Broadcast fan-out p95 | 1,092.56 ms | 1,167.60 ms | 1,348.12 ms | 2,054.36 ms | PASS in all three |
| Stage Inject fan-out p95 | 3,678.45 ms | 2,655.20 ms | 2,663.73 ms | 3,537.46 ms | PASS in all three |
| Ballot receipt p99 | 586.47 ms | 2,092.61 ms | 427.49 ms | 519.38 ms | Superseded: unordered fixture corrected below |
| Floor request p95 | 12,610.12 ms | 389.62 ms | 135.18 ms | 322.16 ms | PASS in all three |
| Local media packet loss | 0% | 0% | 0% | 0% | PASS locally |

After the continued profiling below, three consecutive runs on an isolated PostgreSQL 18.6 container with the institutional WAL/checkpoint settings measured Command p95 **140.35, 119.57, and 240.25 ms** and p99 **238.12, 187.61, and 279.64 ms**. All three pass the approved Command thresholds with `synchronous_commit=on`, zero errors, zero sequence gaps, and exact receipt/Event/outbox reconciliation.

All three repetitions completed with zero measured command/Floor errors and exact integrity counts. Command receipt/Event/outbox mismatches, command sequence gaps, lost or duplicate accepted effects, duplicate queued Floor outcomes, invalid queue positions, Ballot-choice leakage, and Extension host-state mutations were all zero. Database, application, media-server, and injected provider-failure recovery checks passed.

The original saturation calculation counted every PostgreSQL `ClientRead`, including idle pooled connections, as waiting. Phase-aware follow-up profiling corrected `waiting` to active database waits and records idle-in-transaction connections separately. The historical peak of 50 therefore does not prove database saturation and is superseded by the phase-aware artifacts below.

## Final acceptance results

The accepted `approved-soak-4` report ran for 5,488.68 seconds with the exact 1,800-second warm-up and 3,600-second steady state. Command p95/p99 were 76.04/119.74 ms; steady Command p95/p99 were 47.48/61.00 ms; reconnect p95/p99 were 34.67/67.84 ms; Message/Inject fan-out p95 were 1,913.02/3,385.53 ms. All 2,000 accepted Commands had matching receipts, Events, and outbox rows with zero gaps, lost effects, or duplicates. Database and application recovery were 1.10 and 708.09 ms.

The soak retained 5,500 raw resource samples and 1,096 PostgreSQL-container samples. Peak application CPU/memory were 10.88%/1.16%; peak database CPU/memory were 19.49%/5.46%; peak connections/waiters were 49/6. No resource spent any measured time at or above 80%, and the resource gate passed.

| Measure | Final set 1 | Final set 2 | Final set 3 | Threshold | Status |
|---|---:|---:|---:|---:|---|
| Command receipt p95 | 31.75 ms | 32.90 ms | 89.37 ms | <= 500 ms | PASS |
| Command receipt p99 | 57.59 ms | 60.96 ms | 198.67 ms | <= 2,000 ms burst | PASS |
| Reconnect p95 / p99 | 33.65 / 52.37 ms | 1,482.70 / 2,277.39 ms | 1,389.98 / 1,893.78 ms | <= 10,000 / 30,000 ms | PASS |
| Message fan-out p95 | 124.94 ms | 229.67 ms | 235.93 ms | <= 5,000 ms | PASS |
| Inject fan-out p95 | 131.46 ms | 103.47 ms | 100.05 ms | <= 5,000 ms | PASS |
| Ballot receipt p99 | 207.52 ms | 182.78 ms | 209.56 ms | <= 2,000 ms | PASS |
| Certification maximum | 212.73 ms | 205.53 ms | 46.50 ms | <= 5,000 ms | PASS |
| Floor request p95 | 124.09 ms | 130.21 ms | 107.99 ms | <= 500 ms | PASS |

All three sets recorded zero latency errors, receipt/Event/outbox mismatches, sequence gaps, lost/duplicate accepted effects, duplicate Floor queue events, invalid queue positions, Ballot-choice leaks, or Extension host-state mutations. Each ran 24 valid deterministic Extension executions, rejected two invalid outputs and two timeouts, recorded 0% local media packet loss, recovered its injected failures, and passed its resource-saturation gate.

## Continued profiling and confirmation

- A reproduced slow Command run measured p95 1,024.17 ms. Its unfiltered sampler was dominated by idle `ClientRead`, not locks. With active-wait filtering, subsequent Command p95 was 91.04 ms with 30 total active wait observations in the Command phase.
- The voting fixture consumed an unordered electorate query and could submit all 50 concurrent Ballots to one Session. Round-robin ordering now represents ten concurrent Sessions, matching the application and voice fixtures. Three final-code runs measured Ballot p99 230.15, 189.84, and 350.94 ms with zero errors.
- A measured Poll-lock refactor was tested against the corrected fixture and removed: deferring Ballot recording to the Evidence sequence increased Ballot p99 from 230.15 to 441.56 ms and doubled wall time. The simpler original transaction remains.
- Two pre-tuning confirmation repetitions measured Command p95 88.29 and 761.41 ms, voting p99 189.84 and 350.94 ms, and Floor p95 152.88 and 402.08 ms. A later reduced-round-trip run still varied between 82.96 ms and 1,999.76 ms, proving application query count alone was not the remaining cause.
- The slow runs recorded transaction-ID/tuple queues on `evidence.session_sequences`, WALWrite/WalSync waits, and data-file extension. An isolated durable PostgreSQL 18.6 instance using the institutional settings then passed three consecutive Command repetitions at 140.35/119.57/240.25 ms p95. At that stage no cache, broker, service split, or relaxation of gap-free Evidence ordering had been introduced.
- A shortened **diagnostic-only** soak-harness run used one-second warm-up/two-second steady-state phases to validate scheduling and reconciliation. It produced exact 2,000 receipt/Event/outbox rows with no sequence gaps, but its compressed burst latency is not acceptance evidence.

The first full-duration run (`approved-soak-2`) then passed with Command p95 65.13 ms, steady Command p95 61.98 ms, zero errors/gaps/mismatches, fan-out below five seconds, and database/application recovery below one second. Its next application profile reproduced the variance at Command p95 779.17 ms with 43 transaction-ID waits on `evidence.session_sequences`, 40 WAL-write waits, and a pool peak of 51 connections. A process-local PostgreSQL `commit_delay` experiment produced one fast and one 1,797 ms p95 run, so it was rejected and fully rolled back.

The Command Release cache produced three fresh-process diagnostic p95 values of **18.74, 18.59, and 32.78 ms**. The queued-Floor atomic CTE then produced p95 values of **104.84, 158.24, and 233.99 ms** with zero queue defects. Finally, the information-flow cache reduced three fresh Message fan-out p95 values to **192.63, 322.64, and 309.30 ms** and Inject p95 to **174.59, 286.44, and 153.93 ms**, with zero errors or integrity defects.

An exact-field Release JSON projection experiment also saturated the local Docker runtime and was reverted.

## Representative segmented-network media evidence

On 2026-10-25, a Windows Chromium client at `10.183.94.61` used a user-authorized Linux Mint LiveKit host at `10.183.94.79`. Docker-aware firewall rules rejected direct ICE/TCP, ICE/UDP, and TURN/UDP from the Windows client while permitting HTTPS signaling on TCP 8443 and TURN/TLS on TCP 443. Browser WebRTC statistics reported `relayProtocol: tls` throughout the measured media and recovery paths.

After two join and one speech-start warm-up observations, the clean run measured 21 joins, five steady-state speech starts, and ten Floor requests:

| Measure | Result | Threshold | Status |
|---|---:|---:|---|
| Media join p95 | 2,924.06 ms | <= 3,000 ms | PASS |
| Speech-start median | 122.72 ms | <= 300 ms | PASS |
| Floor p95 | 267.01 ms | <= 500 ms | PASS |
| Packet loss | 0% (0/195) | < 1% | PASS |

A controlled restart of `plenum-media-lab-media-1` interrupted active relayed audio. Audio resumed over TURN/TLS in 11,747.73 ms with 0% measured packet loss, within the approved five-minute recovery limit. The recovery run changed only the disposable media container and did not expose Docker remotely.

## Evidence artifacts

- `test-results/load/ps-545-local-run-{1,2,3}-application.json`
- `test-results/load/ps-545-local-run-{1,2,3}-voting.json`
- `test-results/load/ps-545-local-run-{1,2,3}-voice.json`
- `test-results/load/ps-545-local-run-{1,2,3}-extensions.json`
- `test-results/load/ps-545-profile-command-active-waits-application.json`
- `test-results/load/ps-545-profile-voting-round-robin-original-voting.json`
- `test-results/load/ps-545-local-confirm-{1,2}-{application,voting,voice,extensions}.json`
- `test-results/load/ps-545-tuned-confirm-{1,2,3}-application.json`
- `test-results/load/ps-545-approved-soak-2-application.json` (passed before the final variance fix; superseded for final-code acceptance)
- `test-results/load/ps-545-approved-post-2-application.json` (variance reproduction; failed Command p95)
- `test-results/load/ps-545-diagnostic-release-cache-{1,2,3}-application.json`
- `test-results/load/ps-545-diagnostic-floor-cte-{1,2,3}-voice.json`
- `test-results/load/ps-545-diagnostic-information-cache-{1,2,3}-application.json`
- `test-results/load/ps-545-approved-soak-4-application.json`
- `test-results/load/ps-545-approved-final4-post-{1,2,3}-{application,voting,voice,extensions}.json`
- `test-results/load/ps-545-soak-harness-check-application.json` (short diagnostic; not acceptance evidence)
- `output/playwright/ps-150/ps-545-institutional-media.json`
- `output/playwright/ps-150/ps-545-institutional-media-recovery.json`

These generated reports are intentionally not committed. Each is schema-valid `load-profile-v1` evidence and records Node, PostgreSQL, Docker, host, commit, workload, latency, integrity, saturation, recovery, and cost data.

## Gate status

| Reference | Status | Evidence |
|---|---|---|
| `DB-10` / `PS-545-T01` | PASS | Shared authority validation, duplicate-ID serialization, atomic outcome CTE, replay and exact integrity regression |
| `SYNC-15` | PASS with recorded soak/cache timing caveat | Full 30/60 soak, recovery, exact integrity, raw saturation, and three final-code application repetitions pass |
| `VOTE-14` | PASS | Three consecutive final sets each record exact 5,000-Ballot integrity and sub-threshold receipt/certification latency |
| `VOICE-12` / `PS-545-T02` | PASS | Three final Floor/media/failure sets plus representative TURN/TLS join, speech-start, packet loss, and restart recovery pass |
| `EXT-19` | PASS | Three final sets preserve deterministic valid results, invalid-output/timeout containment, host isolation, and resource limits |

PS-545 passes the approved lower-capacity-equivalent capacity gate with the explicit final-cache timing caveat above. PS-550 is now eligible. Production release approval remains separate and still requires PS-550 plus institution-owned security, accessibility, identity, key-custody, backup, TLS/firewall, and operating-procedure evidence.

## BA-12 current performance and recovery — 2026-11-13

Status: **capacity FAIL; local characterization, not production acceptance**. Production code is unchanged from `941a51cde44a5e397c89a572307854d1686b16f5` (BA-11). The only code diff extends `tests/e2e/product/live-sync.spec.mjs`: navigation/byte/interaction/delivery observations, forwarding browser WebSocket upgrades to the existing production gateway, and unique synthetic identity-provider keys. No optimization, dependency, schema, authorization or timeout change was made. The fresh full-duration soak completed with passing measured service-profile checks; the separate Floor and browser-projection failures keep aggregate capacity open.

The first full-soak attempt **FAILED during warm-up** after 639.84 seconds wall time. At `2026-11-13T16:08:15.946Z`, the PostgreSQL container exited with code 255 and `OOMKilled=false`; Windows recorded virtual-switch changes at the same time. The owner confirmed this was unexpected. The generator lost its connection and cleanup then received `ECONNREFUSED`; no final report was emitted. The initiating cause is unresolved. Task-owned PostgreSQL was restarted and completed crash recovery at `16:14:17.261Z`, about 361 seconds after interruption including diagnosis/manual recovery. Its interrupted database retained the 5,000 workload participants plus one cross-tenant fixture participant and zero Command receipts, Evidence Events or outbox rows: warm-up had not reached accepted writes. This is not an accepted-work recovery proof or PS-845 rehearsal. Logs/state are retained as `output/ba-12-performance/soak-interrupted*` and `soak-crash-recovery.log`. One fresh full-duration retry ran from `16:15:50.873Z` to `17:47:24.079Z` and exited 0; no interrupted time is credited.

### Full-duration retry

`CMD-LOAD-SOAK` (`npm run load:soak`, repository root, Node 24.22.1) exited 0. Its report covers **5,478.40 seconds** of profile execution, with the configured 1,800-second warm-up and 3,600-second steady state unchanged, followed by reconnect/Command/fan-out/recovery checks. Total shell time including build/setup/cleanup was 5,493.21 seconds. The report's `MEASURED` status is deliberately separate from aggregate acceptance; the following comparisons pass only for this service-module profile.

| Observation | Retry result | Applicable comparison |
|---|---:|---|
| Steady Command p95 / p99 | 37.36 / 52.23 ms | <=500 / 1,000 ms: PASS |
| Burst Command p95 / p99 | 21.96 / 36.68 ms | <=500 / 2,000 ms: PASS |
| Reconnect snapshot p95 / p99 | 20.00 / 37.00 ms | <=10,000 / 30,000 ms: PASS |
| Message / Inject fan-out p95 | 264.53 / 215.30 ms | <=5,000 ms: PASS |
| Database backend / fixture Runtime restart probe | 0.56 / 2,074.57 ms | Probe recovered; not a production workload recovery measurement |
| Accepted notes / receipts / Events / outbox rows | 2,000 each | Exact reconciliation PASS |
| Gaps / mismatches / lost or duplicate accepted effects | 0 each | PASS |

All 5,000 warm-up snapshots, 5,000 steady snapshots, 1,000 steady Commands, 5,000 reconnects and 1,000 burst Commands completed without recorded latency errors. Duplicate receipt replay and the unauthorized snapshot denial passed. The resource gate passed across 5,630 samples and 1,094 database-container samples: peak generator RSS 355.20 MiB, application CPU 5.21%, database CPU 2.80%, database memory 1.85%, 13 database connections and two active waiters. No sampled resource reached the 80% threshold; the recorded RSS change was -238.51 MiB. This establishes bounded observed use for the paced workload, not absence of all leaks or large-scale capacity.

Evidence: `test-results/load/ps-545-ba12-full-soak-retry-application.json`; archived copy, compact `soak-summary.json`, shell start/end/log and read-only interim counters under `output/ba-12-performance/`. That directory also retains `candidate.diff`, `candidate-manifest.json` (source/test/document hashes and command inventory) and `artifact-manifest.json` (archived evidence hashes). The runner removed the successful run's unique database. The first interrupted run remains a failure with unresolved infrastructure cause, not a successful recovery experiment. Current Floor/projection-delay failures and the boundary limitations below are unaffected by this passing retry.

### Authority, identity and reproducibility

- Requirements: REQ-002/032/067/068/069, INV-017/019; PS-540/545/820/845. Threshold authority is [approved OPEN-019](../open-019-acceptance-recommendation.md), the [reference profile](../../deploy/load-fixtures/reference-profile.json), and Decision Register OPEN-017 for RPO <=900 seconds / RTO <=14,400 seconds. OPEN-016 authority transfer remains a separate PS-845 obligation; its command is Proposed and absent, so it was not run.
- Environment: the previously owner-approved PS-545 lower-capacity equivalent, reused under the BA-12 instruction: Windows x64, Intel i7-12700H, 20 logical CPUs, 31.68 GiB RAM; Node 24.22.1; Docker Desktop 28.5.1 with 20 CPUs / 15.46 GiB. Loopback networking, no bandwidth/RTT/CPU shaping. This is not the AWS deployment, an institutional network or a low-end device measurement.
- Fresh PostgreSQL 18.6 Alpine image `sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`, container `plenum-ba12-db-20261113`, host port 65439, task-owned local Docker volume (not tmpfs). `synchronous_commit=on`, 16 MB WAL buffers, 15-minute checkpoints, 4 GB max WAL, 128 MB shared buffers, 100 connections; load pool maximum 60. Container CPU/memory use the enclosing Docker VM limits, without additional container caps.
- Exact lockfile, schema-file and profile hashes, Docker resource/storage identity and artifact inventory are under `output/ba-12-performance/preflight/identity.json`. Historical generated files were backed up before execution. The measured profile is `ps-540-reference-v1`, 10 Sessions x 500 Participants; synthetic identities and files only. Per-run reports carry source, platform, database and workload identity.
- Reproduce bounded sets with `PLENUM_LOAD_DATABASE_ADMIN_URL` pointing to a newly provisioned disposable cluster, `PLENUM_LOAD_DATABASE_CONTAINER` naming that container, unique `PLENUM_LOAD_RUN_ID`, then sequential `npm run load:app`, `load:voting`, `load:voice`, `load:extensions` for three sets. Never use the runner's default address without verifying ownership. Each invocation creates and drops a unique database. Reports are `test-results/load/ps-545-ba12-set-{1,2,3}-{application,voting,voice,extensions}.json`; logs and compact summaries are in `output/ba-12-performance/`.
- LiveKit 1.13.10 uses the existing pinned image and CLI 2.19.2. Downloaded CLI archive SHA-256 matched `3a76873bd0a593d03b1305499ae0e468a242742eb3bfbfac737f27f1d00be139`. Extension containers use the existing pinned Node 24.22.0 Alpine image, uid 65532, read-only root and no network. This rootful Docker test is not the qualifying BA-08 rootless supervisor environment.

### Three bounded load sets

All twelve commands completed and emitted schema-valid reports. `MEASURED` and exit code zero do **not** mean a latency budget passed; the comparisons below are separate.

| Metric (ms) | Set 1 | Set 2 | Set 3 | Approved comparison | Result |
|---|---:|---:|---:|---|---|
| Command receipt p95 | 47.79 | 94.20 | 139.24 | <=500 | PASS |
| Command receipt burst p99 | 140.53 | 256.76 | 311.46 | <=2,000 | PASS |
| Snapshot reconnect p95 / p99 | 23.72 / 42.38 | 26.02 / 108.57 | 27.56 / 75.87 | <=10,000 / 30,000 | PASS at service boundary |
| Durable Message fan-out p95 | 459.79 | 361.86 | 256.44 | <=5,000 | PASS |
| Durable Stage Inject fan-out p95 | 386.86 | 376.28 | 276.65 | <=5,000 | PASS |
| Ballot receipt p99 | 459.88 | 367.12 | 269.62 | <=2,000 | PASS |
| Certification maximum | 94.32 | 59.70 | 75.88 | <=5,000 | PASS |
| Existing Floor-request p95 metric | 1,174.77 | 1,080.13 | 1,029.92 | <=500, existing VOICE-12 comparison | **FAIL** |
| Isolated Plugin run p95 | 3,630.78 | 2,378.61 | 2,152.90 | No approved Plugin latency number | MEASURED |

Every application set reconciled 1,000 accepted notes with exactly 1,000 receipts, Events and outbox rows, 5,000 Message recipients and 5,000 Inject recipients; zero outcome mismatches, sequence gaps, lost or duplicate accepted effects. Duplicate Command replay returned the original receipt and unauthorized projection returned `NOT_A_PARTICIPANT`. Every voting set reconciled 5,000 Ballots/receipts and ten Certifications, zero leaked choices, `ALREADY_VOTED` and `DEADLINE_EXPIRED` negatives. Every voice set recorded 5,000 grants/requests, zero remaining active leases, duplicate queue Events or invalid queue positions, and one typed provider failure. Every Extension set produced 24 deterministic valid outputs with one digest, rejected two invalid outputs and two timeouts, with zero host-state mutations.

All twelve short-run resource checks passed the existing 80%-for-300-seconds gate. Peak generator RSS ranged from 195.19 to 547.28 MiB; peak database connections were 52. These short runs alone cannot prove a five-minute saturation or long-term-growth objective. Database reconnect probes recovered in 0.94–16.25 ms; fixture Runtime restart in 2,120–3,077.92 ms. Separate LiveKit runs (one synthetic audio publisher, 49 subscribers, 20 seconds, no TURN) had zero observed packet loss before/after restart and 9,064.80–9,292.39 ms restart recovery. The media-profile wall time is not join latency. New join/speech-start and segmented TURN/TLS measurements were not run; October evidence retains its historical scope.

The Floor metric includes queued and granted responses; grant-only latency is not separately retained. Its established metric regressed consistently, also confirming the BA-04 finding. The first set observed 10,172 samples of advisory-lock waits versus 100 WAL-sync waits. `withFloorChannelLock` deliberately serializes provider effects across processes. This identifies the dominant measured wait, not proof that removing the lock is safe. No exclusivity, revocation, authority check or retry was weakened. Follow-up must isolate queued-request overhead while preserving BA-04 race/recovery invariants, then obtain before/after evidence.

### Production browser observations

The existing production-entrypoint test ran three times with **three separate fresh databases**, real browser-bound OIDC handling against a synthetic issuer, three idle participant contexts, the actual `profile-service.mjs`, real authorization/filtering and automatic publication. Studio's WebSocket proxy preserves the original Origin/cookie and delegates all checks to the production gateway. No manual publisher or refresh triggers delivery acceptance.

Reproduce using `DATABASE_URL` for a new empty disposable database on each repetition and `PLAYWRIGHT_JSON_OUTPUT_FILE` for a unique output, then `npm run test:e2e:product -- live-sync.spec.mjs --reporter=line,json`. Chromium 156.0.8078.4 is headless on the same workstation; Runtime viewport 1024x768, Studio 1280x720. Cache-cold clears browser HTTP cache; it is not cold OS/process/JIT. Warm navigation follows in the same authenticated context. Runtime readiness is its visible frame; Studio readiness is its rendered `.visual-editor` after initial Draft data, **not** merely socket-open/Connected. A positive WebSocket-payload assertion prevents premature Studio measurements.

| Observation | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| Runtime cache-cold ready (ms) | 1,150.59 | 1,007.47 | 1,066.26 |
| Runtime warm ready (ms) | 1,409.06 | 1,004.99 | 1,074.09 |
| Studio cache-cold editor ready (ms) | 4,493.09 | 4,274.54 | 4,364.93 |
| Studio warm editor ready (ms) | 3,000.51 | 3,089.23 | 2,917.22 |
| Studio Teams workspace visible after selection (ms) | 102.96 | 48.49 | 66.43 |
| Stage-start pending outbox drained (ms from dispatch) | 224.03 | 188.56 | 181.19 |
| Inject visible to both authorized recipients (ms from dispatch) | 1,934.02 | 1,931.02 | 1,609.92 |

Runtime completed HTTP transfer at ready was 974,117–987,178 bytes. Studio completed HTTP transfer was 916,959 bytes **plus 25,561,927 bytes of received WebSocket payload on every cold/warm navigation**. HTTP numbers are completed Navigation/Resource Timing entries at the readiness boundary; WebSocket numbers exclude framing/TLS overhead. They are not total-session wire-byte bills. The source fixture includes embedded resources; the measurement is fixture-specific. No approved startup or byte budget was found, so these values are not assigned invented PASS/FAIL thresholds. Build PASS reported Runtime JS 641.31 kB and Studio JS 607.53 kB; bundle warnings did not trigger speculative code splitting.

Nine Stage-pause visibility observations, timed **after the accepted HTTP receipt** with animation-frame DOM observation, were 956.97–1,812.44 ms; nearest-rank p95/p99 are both 1,812.44 ms. The small local sample **misses the approved projection p95 <=1,000 ms** while remaining below p99 <=2,000 ms. It is not a population-scale percentile estimate. Worker publication and client consumption are both included; their overhead is not isolated. The 250-ms worker tick and subscription's one-second delay after each completed request are relevant implementation facts, not sufficient evidence to choose a new polling rate without measuring request/resource budgets. Reconnect, hidden-recipient filtering, reassignment, revocation, stale-response rejection and cleanup assertions passed in all final runs.

Final focused browser results: 3/3 PASS (56.2 / 53.7 / 54.6 seconds); typecheck and lint PASS. Earlier evidence is retained separately: the first shared-database attempt had 1 PASS / 2 fixture-key failures, fixed by unique synthetic provider keys; an attempted rerun on a non-empty database failed setup; a later shared-database attempt had 2 PASS / 1 240-second browser-lifecycle timeout reported during `browserContext.close`. The latter's underlying cause is unresolved; isolated final runs do not erase it. Preliminary socket-open timings were superseded when a zero-byte observation exposed early readiness. No timeout or product assertion was relaxed. Full product/unit/integration/security/hosted-CI suites were not rerun for this test-only change; BA-11's earlier results are historical and unchanged product code is an impact-assessment input, not a new run.

### Boundary and remaining acceptance

| Evidence | Actual boundary | Not proved |
|---|---|---|
| Application/voting/soak | Real PostgreSQL, synthetic trusted contexts, direct service calls | 5,000 live browser connections, production HTTP authentication/rate limits, multi-Organization fairness or hostile-load capacity |
| Voice | Direct Floor service with no-op provider adapter; separate real local SFU traffic | 5,000 real publishers, live Floor permission enforcement, current representative TURN/TLS join/speech latency |
| Extensions | Direct isolated-container executor fixtures | Release-governed production supervisor/approval workflow or qualifying rootless deployment activation |
| Browser | Actual production HTTP/gateway, OIDC callback, timers, authorized projections | Representative WAN/device distribution, sustained backlog recovery, per-worker/provider CPU/memory overhead at capacity |
| Install/restore | Current image and synthetic PostgreSQL/object/evidence fixture | Live custody, large-volume recovery, operator detection/provisioning time or authority transfer |

The load fixture uses one Organization; multi-tenant fairness under sustained load remains **NOT MEASURED**. The approved soak schedules 5,000 snapshot calls over 1,800 seconds, then 5,000 snapshots plus 1,000 Commands over 3,600 seconds (about 1.67 operations/second in steady state), before separate reconnect and Command bursts. Its 5,000 identities do not mean 5,000 simultaneously active browser clients. Voting currently sends a concurrency-bounded burst without the approved 30-second pacing. Application reconnects are service snapshot calls, not 5,000 held browser subscriptions. Resource telemetry covers the module-hosting generator and PostgreSQL, not every media/Extension/provider process. Reports retain percentile summaries and resource time series, not every per-request latency sample. BA-11 supplies functional multi-tenant/omitted-wiring/restart evidence, not these missing capacity measurements. These coverage limits preclude a broad production-capacity PASS even if individual service numbers pass.

At the initial BA-12 handoff, T01 was **partial**, T02 **FAIL/open**, and T03 **open**: no product optimization had been attempted. The follow-up below supersedes the local projection-delay failure only. Repeated Floor budget failure, representative media, production HTTP/fairness and separately governed authority transfer remain open. Existing PS-830 human acceptance, PS-840 continuation exception and PS-842 decisions are unchanged. BA-08 activation, BA-09 genuine Replay and BA-10 independent custody/live-golden proofs remain separate release obligations. No commit or deployment.

### BA-12 follow-up 1 — authorized synchronization latency

2026-11-13; baseline `941a51cde44a5e397c89a572307854d1686b16f5` plus preserved BA-12 work. **Local focused latency comparison PASS; capacity acceptance remains open.** This is a product-code candidate, so the earlier load/soak/recovery reports remain historical evidence, not measurements of this diff. Artifacts, failed intermediate candidates, source identity and logs are in `output/ba12-sync-latency/`; `comparison.json` contains phase and resource samples. No protocol, migration, dependency, authorization or provider-effect change.

#### Reproduction and smallest correction

The actual production entrypoint, cookie-bound browser login, automatic publisher and three idle clients reproduced post-receipt Stage visibility at **1,296.97 / 1,378.26 / 1,694.73 ms** before product changes. A separate diagnostic run also failed. The existing finite SSE batch endpoint authorizes and filters each request using the Runtime projection; the client then reads the affected authoritative projection. Both authorization reads remain necessary and were preserved.

The voting reader transferred the full immutable Release, including embedded resources: **19,126,417 bytes**, versus **186,890 bytes** with the unused root/nested `resources` removed in SQL (99.0% reduction). The existing resource-free selection pattern is now used by `voting/polls.ts`. The voice reader separately decompressed the same large JSON for four fields; `comms/voice.ts` now materializes one resource-free snapshot and retains the exact root/coreDesign per-field fallback. Paired database reads returned identical 23,581-byte results: original **63–115 ms**, changed **21–26 ms**. Neither reader caches policy or changes tenant/Release pins.

Resource exclusion alone still produced a **1,442.74 ms** maximum, with over 1,000 ms waiting for the next client cycle. The sync client previously slept 1,000 ms *after* network and refresh completion. Its healthy cadence now includes that work in a 500 ms start-to-start interval, leaving part of the approved 1,000 ms budget for publication and refresh. It still permits only one in-flight cycle; a slow cycle starts the next only when complete, without catch-up bursts. Failure backoff, abort, cursor-after-refresh, deduplication and stop behavior are unchanged. Voting exclusion plus cadence alone had a **1,043.92 ms** miss in an intermediate run; that failure is retained. The measured voice-query correction preceded all three final runs below. No worker tick or pool size was increased.

#### Three final production-browser measurements

Same local workstation/profile as the preceding BA-12 observations; Chromium 156.0.8078.4, Node 24.22.1, loopback HTTPS and synthetic OIDC. Fresh database for each repetition on pinned PostgreSQL 18.6 Alpine `sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`; synchronous commit enabled, 16 MB WAL buffers, 15-minute checkpoints, 4 GB max WAL. Container `plenum-ba12-sync-db-20261113`, local port 65440; no production traffic. Reproduce with a fresh disposable `DATABASE_URL` and unique `PLAYWRIGHT_JSON_OUTPUT_FILE`, then `npm run test:e2e:product -- live-sync.spec.mjs --reporter=line,json`.

| Observation (ms) | Final 1 | Final 2 | Final 3 |
|---|---:|---:|---:|
| Three post-receipt Stage observations | 586.84 / 685.69 / 986.53 | 414.32 / 465.88 / 881.58 | 744.63 / 842.64 / 892.92 |
| Run sample p95 (three observations; nearest rank) | **986.53** | **881.58** | **892.92** |
| Stage-start pending outbox drained | 482.26 | 495.69 | 258.63 |
| Inject visible to both authorized recipients, from dispatch | 947.30 | 990.81 | 958.51 |

All nine Stage samples meet 1,000 ms; their pooled nearest-rank p95/p99 is **986.53 ms**, compared with this follow-up's unchanged baseline maximum **1,694.73 ms** and the historical BA-12 nine-sample p95 **1,812.44 ms**. This small sample is not a population percentile or a guaranteed upper bound. Only 13.47 ms of observed headroom remains; representative WAN/device and capacity evidence is still required. Inject timing includes assertion polling and is a secondary observation, not the Stage-delay metric.

| Stage delay component | Unchanged baseline range (ms) | Final range across nine samples (ms) |
|---|---:|---:|
| Accepted receipt to publication timestamp | 28.68 | 114.35–292.50 |
| Publication timestamp to next delivering sync request | 381.57–548.65 | 70.77–470.33 |
| Authorized sync request | 372.28–713.82 | 95.82–157.01 |
| Sync response to projection request | 3.25–3.91 | 3.17–6.17 |
| Authoritative projection request | 389.29–476.40 | 80.33–154.81 |
| Projection response to rendered state | 10.93–23.07 | 9.82–21.89 |

The proxy observes request/response completion without retaining protected payloads. Publication uses `published_at`, a PostgreSQL transaction timestamp, calibrated to the browser harness monotonic clock; it is not an exact commit/visibility timestamp. Clock midpoint uncertainty was 1.64–3.94 ms. Publication did not improve in these samples; the correction removes repeated projection work and excess client waiting. Per-column ranges come from different clients and must not be summed as a single request.

#### Overhead and regression scope

For three idle clients over ten seconds, baseline **28** sync requests / **4,032** response-body bytes became **58 / 59 / 60** requests and **8,352 / 8,496 / 8,640** bytes. There were **zero projection reloads** in every idle window. This is approximately two finite authorized sync requests/second/client, versus 0.93 previously. Database commit deltas were **538** before and **633 / 653 / 639** after (18–21% higher); these include the fixture process and automatic workers and are not isolated per-request database CPU. One browser context's main-thread task time was **47.93 ms** before and **53.61 / 57.43 / 61.41 ms** after per ten seconds; post-window JS heap was approximately **5.83–5.84 MB**. These observations quantify local cost, not sustained resource bounds or leak proof. No 5,000-client capacity extrapolation is accepted.

The controlled-clock unit regression checks start-to-start cadence, network/refresh time, no overlap, no missed-tick replay and stop/late-response cleanup. The real-database voting regression checks that embedded bytes never cross the database boundary while retaining eligibility/privacy/receipt/recount assertions; voice fixtures now include resource bytes and retain grants/Floor/revocation checks. The production browser cases retain hidden-recipient and cross-Session denial, reconnect, expired cursor, reassignment, revocation, stale-response suppression and scoped-cache cleanup. All three final flows pass; their live/reconnecting screenshots were inspected, with existing axe/zoom checks retained. The deliberately filtered integration attempt failed (3 PASS / 6 FAIL) because earlier tests establish shared authentication/onboarding context; it is retained rather than represented as a product regression or discarded success.

Final verification on this product/test candidate:

| Command / check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | 175 PASS, 0 FAIL, 0 SKIP; includes controlled-clock cadence, deduplication, abort and stale-response cases |
| `npm run lint` | PASS; includes build, unchanged large-chunk warnings, contract lint 139 sources / 52 contracts |
| `npm run test:offline` | 12 PASS, 0 FAIL, 0 SKIP |
| `npm run validate:promptbook`; `git diff --check` | PASS; generated validation report archived separately, historical report restored |
| `npm run test:integration` | 47 PASS, 0 FAIL, 1 SKIP; 272.43 s test duration. BA-08 real rootless executor NOT RUN because qualifying Linux supervisor is unavailable |
| Three `npm run test:e2e:product -- live-sync.spec.mjs --reporter=line,json` runs | 3 PASS; functional assertions and local latency comparison pass on fresh databases; `verified-1/2/3.json` |
| Child-only original voting-query mutation, all prerequisites through VOTE-01 | Expected FAIL: 27 prerequisites PASS, the byte-transfer assertion fails with `Voting must not load embedded resource bytes`; `original-query-negative-complete.log` |

The full database suite used synthetic SeaweedFS 4.48, pinned digest `sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d`, local port 65441. Its production-worker, tenant/Origin/rate-limit, receipt, revocation, Floor retry/fencing and archive assertions pass; provider/signing doubles do not establish live external proof. A second, insufficiently filtered negative attempt also failed fixture prerequisites before reaching the target assertion; only the complete-prerequisite mutation counts as the regression sensitivity proof. No assertion or timeout was weakened to obtain a pass.

UI review: live 1024px and reconnect states are legible. The forced-colors/200% text screenshot shows the existing two-column layout squeezing the main heading into short fragments; the desktop browser-zoom screenshot shows a focused skip-link/header overlap. No UI component or layout changed here, and these observations are not investigated/fixed by the latency patch. Automated axe/overflow assertions passing do not constitute a full visual/accessibility approval.

All 15 task database counters report zero deadlocks; no test clients remained when the two task-owned PostgreSQL/S3 containers were stopped. Synthetic data is retained in those stopped containers/volumes, with identities in `resources-stopped.log`; no unrelated Docker resource was changed or deleted. Generated tracked browser fixtures were restored from preflight copies. `candidate-manifest.json`, `candidate.diff` and `artifact-manifest.json` identify the candidate and archived results; the earlier `output/ba-12-performance/` evidence was preserved.

At follow-up 1's handoff, the Floor-request latency defect remained open. Follow-up 2 below supersedes that local Floor comparison. Changes to shared voting/voice readers and sync cadence still require affected app/voting/soak capacity reruns on a representative candidate; the focused follow-ups do not imply full product/a11y/security suites, hosted Linux CI, AWS performance or new release approval. No commit or deployment.

### BA-12 follow-up 2 — Floor-request latency and permission recovery

2026-11-14. **The reproduced direct-service Floor latency defect is corrected, and three final local browser/provider repetitions pass. Aggregate BA-12 capacity acceptance remains open; intermittent observations below remain unresolved.** Starting HEAD is `941a51cde44a5e397c89a572307854d1686b16f5`, with all fourteen preexisting dirty files preserved. This follow-up changes the existing `comms/voice.ts` request/reconciliation path, its database regression and `tests/load/voice-profile.mjs`; no schema, adapter, pool, cadence, timeout, dependency or topology change. Source/report manifests and raw attempts are under `output/ba12-floor-latency/`. Prior BA-12 and synchronization evidence remain historical records with their own candidate identities.

#### Cause and bounded correction

The unchanged supported profile reproduced **1,221.93 ms Floor-request p95**, 3,187.81 ms p99, 5,000 requests and zero request errors. CLI exit 0 / `MEASURED` is not a passing budget comparison. A separate instrumented run attributed 28,848.64 ms of cumulative SQL time to just 54 expiry-reconciliation UPDATEs; the slowest took 2,829.97 ms while holding the provider-ordering lock. Cumulative advisory-lock waits reached 1,236,833.63 ms across 5,001 calls; concurrent wait totals are not wall time.

`EXPLAIN` under the actual application role/RLS showed a statistics-sensitive hashed subplan: the grant/assignment join repeatedly scanned the active-assignment set, discarding **12,502,490** join combinations. On freshly provisioned 5,000-participant data, paired original reads took **2,266.99 / 2,253.13 ms** and approximately **634,570 shared-buffer hits**; the equivalent candidate took **5.15 / 5.36 ms**, 4,836 hits. The diagnostic transactions rolled back. After automatic statistics refresh, both versions took about 0.15–0.22 ms; measuring only that later state would conceal the provisioning/burst defect. Both cold-statistics and later-plan artifacts are retained, with no manual production statistics change or global planner setting.

The expiry predicate now independently requires a valid transmit grant **for the same Organization/channel/holder** and an active Seat Assignment **for that same Organization/holder**. This is equivalent to existence of their original equality join, with the same revoked/expiry/Authority Epoch conditions. RLS and all tenant parameters remain. The query can validate both facts without the expensive join. The request path also reads the channel once with its existing `FOR UPDATE` lock, instead of reading it unlocked and then rereading/validating it under that lock. Authority remains locked first; permissions and adapter pins are checked before effects. No row-lock ordering or provider-ordering lock was removed.

The query-only intermediate candidate passed aggregate request p95 (240.40–295.80 ms), but its new grant-only measurement exposed a **500.27 ms p95 miss** in the first repetition. That miss is retained, not rounded to PASS. The final three runs below include removal of the duplicate channel read. No worker interval, concurrency, workload, lease duration or assertion was relaxed.

#### Final repeated measurements

Threshold: approved OPEN-019 / `deploy/load-fixtures/reference-profile.json`, Floor-grant p95 <=500 ms. The original combined granted/queued `floorRequest` metric is preserved for historical comparison; additive `floorGranted` and `floorQueued` summaries distinguish actual grants. The existing report schema accepts these fields. Every run uses ten Sessions, 500 Participants/requests per Session, concurrency 50 and pool maximum 60. The direct-service control path uses a no-op provider adapter; separate SFU traffic uses one synthetic audio publisher and 49 listeners for 20 seconds plus a restart. This is not 5,000 real audio publishers or production HTTP capacity.

| Observation | Unchanged baseline | Final 1 | Final 2 | Final 3 |
|---|---:|---:|---:|---:|
| Combined Floor-request p95 (ms) | **1,221.93 FAIL** | **269.22 PASS** | **226.05 PASS** | **242.54 PASS** |
| Granted-only p95 (ms) | Not retained by old report | **356.70 PASS** | **288.25 PASS** | **288.12 PASS** |
| Granted samples | Not retained by old report | 33 | 34 | 34 |
| Queued-only p95 (ms) | Not retained by old report | 269.02 | 224.85 | 242.41 |
| Combined p50 / p99 (ms) | 29.99 / 3,187.81 | 116.24 / 387.60 | 122.14 / 398.93 | 127.56 / 337.07 |
| Profile wall seconds, including SFU phases | 69.21 | 53.82 | 53.80 | 62.38 |
| Peak application RSS (MiB) | 210.39 | 228.55 | 224.62 | 229.38 |
| Peak database CPU (% Docker capacity) | 23.50 | 17.79 | 18.67 | 17.93 |
| Peak database connections / waiters | 51 / 49 | 51 / 44 | 51 / 43 | 51 / 44 |

The distribution changed: median request latency increased, while the long tail improved. These figures do not establish that every request became faster. The ordinary request performs one fewer SQL read; there is no additional polling or provider request. All final runs pass the existing sampled resource gate, with 4–5 database resource samples each; short runs do not establish the five-minute saturation or soak objective. Peak application CPU was 5.53–11.04%, database memory 2.40–2.42%; synthetic database growth 17.05–17.25 MiB. The workload's small grant subset is reported explicitly rather than hidden inside 5,000 mostly queued decisions.

Each final run records **5,000 requests = granted Events + queued Events = 5,000 transactional outbox rows**, zero request errors, duplicate queue Events or invalid queue positions, zero remaining active leases after cleanup and one typed injected provider failure. SFU packet loss was 0% before/after restart; restart recovery was 9.23 / 9.20 / 11.99 seconds. These SFU restart measurements are separate from provider Floor permission enforcement. Database-backend reconnect probes recovered in 1.32 / 1.39 / 31.12 ms.

Environment: approved PS-545 local lower-capacity equivalent, Windows x64 / Intel i7-12700H / 20 logical CPUs / 31.68 GiB, Node 24.22.1 and root lockfile; Docker Desktop 28.5.1 / 20 CPUs / 15.46 GiB. Loopback with no network/CPU shaping. Reused task-owned PostgreSQL container `plenum-ba12-sync-db-20261113` (`fdbb62481cda4bc6f10c69f6b9330c4730fbe618f7032dcdd63a3caa97557613`), pinned PostgreSQL 18.6 image `sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`, managed volume, port 65440, synchronous commit on, 16 MB WAL buffers, 15-minute checkpoints / 4 GB max WAL. Every profile created a new disposable database and removed only that database afterward. LiveKit 1.13.10 image digest `sha256:89ca9ce0791e18d6e03bf6e2c49ceb27e1c754eae8bd50c989386c1a5963791a`; existing verified CLI 2.19.2 executable SHA-256 `ad4a3a7d5e4bfee028abb4aa6552b570bac8a259b231cb97ba079993b6fe89b7`.

Reproduce from the repository root using the existing `npm run load:voice`, with `PLENUM_LOAD_DATABASE_ADMIN_URL` targeting a disposable cluster, `PLENUM_LOAD_DATABASE_CONTAINER` identifying that cluster, `PLENUM_LK_PATH` identifying the verified CLI and unique `PLENUM_LOAD_RUN_ID` per repetition. Ports 17880–17882 must be free. Use `ba12-floor-final-1/2/3` reports and `comparison.json`; diagnostics and query-only intermediate runs are not final acceptance repetitions. Profile `cost.wallSeconds` measures the profile body, excluding build/setup; static/integration/media command records separately retain complete command durations where captured.

#### Integrity, verification and remaining scope

The existing BA-04 database harness now also revokes a current holder's transmit grant while another participant remains eligible, verifies provider disable and rejects a new request from that holder. It records maximum simultaneous provider transmit permissions across all expiry, release, ambiguous-success, failed-disable, retry, process-restart, renewal and stale-epoch cases; the maximum must be **one**. Existing same-participant delayed-disable protection, exact revocation revision acknowledgement, idempotency and tenant denial checks remain intact. No new test bypass exists in production code.

| Command / check on the corrected product candidate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run test` | 175 PASS, 0 FAIL, 0 SKIP |
| `npm run lint` | PASS, including build and contract lint; existing chunk-size warnings remain |
| `npm run test:integration`, first attempt | 46 PASS / 1 FAIL / 1 SKIP. Production tenant-worker case failed with `fetch failed` / `ECONNRESET`; Floor recovery/exclusivity passed |
| Full integration rerun with failure-only fetch tracing | 47 PASS / 0 FAIL / 1 SKIP, 244.11 s test duration; no product/test assertions, retries or timeouts changed |
| BA-08 real rootless executor case | NOT RUN: qualifying Linux supervisor socket unavailable |
| Three final `npm run load:voice` repetitions | Local measured thresholds and exact request/Event/outbox integrity PASS, as tabulated above |

The first integration failure did not recur. Its cause is unresolved; the passing rerun does not explain or erase it. The diagnostic preload initially used a relative path and failed during the build's workspace change (`ERR_MODULE_NOT_FOUND`), before tests ran; the corrected absolute file URL produced the full result above. Expected startup connection refusals are visible in the trace, with no repeat of the failed connection reset. Artifacts retain all attempts (`integration*.log` / command records).

Initial `npm run test:e2e:media -- --reporter=line,json`: the BA-04 real-provider revocation test PASS, broader Runtime media test FAIL at **2,215.71 ms Floor p95** against 500 ms. Join p95 1,524.17 ms, speech-start median 153.35 ms and zero packet loss passed. The retained browser trace shows Floor HTTP responses of 77.56–770.36 ms; runner observation and media setup also contribute. A subsequent isolated diagnostic run, with unchanged assertions and added timing only, passed at 241.06 ms runner p95. Browser DOM transition times were 141.8–212.6 ms, including 51.5–104.3 ms HTTP; these are DOM measurements, not remote-audio latency. The probe patch and report are archived and removed from the final source. The initial slow run's cause remains unresolved; later passing samples must not be presented as a separate client fix.

Three final **uninstrumented**, fresh-database repetitions of the original `npm run test:e2e:media -- --reporter=line,json` each pass both existing tests, without any threshold, timeout or assertion change:

| Local browser observation | Final 1 | Final 2 | Final 3 | Approved limit |
|---|---:|---:|---:|---:|
| Key-to-visible transmission p95, 10 samples (ms) | 256.77 | 469.99 | 245.73 | <=500 |
| Join p95 (ms) | 958.57 | 2,780.52 | 1,409.18 | <=3,000 |
| Speech-start median (ms) | 72.48 | 97.51 | 73.89 | <=300 |
| Packet loss | 0% | 0% | 0% | <1% |
| Expiry/release/reconnect provider enforcement | PASS | PASS | PASS | No successor before revocation |

The second repetition has only 30.01 ms Floor headroom. A brief host sample during that run recorded approximately 83% CPU use; it is not proof of the initial failure's cause. No unrelated process was stopped. This shared Windows/Docker environment and ten-sample browser repetitions do not establish a stable production percentile. Raw reports are `media-final-1/2/3-measurements.json`, with matching command and Playwright reports. Initial failures remain retained, not replaced by these passes.

Final promptbook validation and whitespace checks PASS. All nine retained task databases report zero deadlocks and zero active backends. Generated tracked browser/Plugin fixtures were restored from preflight copies; hashes verify unrelated preexisting changes are preserved. `candidate-manifest.json`, `candidate.diff` and `artifact-manifest.json` identify source, lockfile, migration/configuration inputs and reports. The three task-owned containers were stopped with their synthetic data retained; none was deleted. PostgreSQL and LiveKit exited 0; the SeaweedFS fixture required Docker's 20-second stop timeout and exited 137 with `OOMKilled=false`, recorded in `resources-stopped.log`. This cleanup is not a graceful-storage-shutdown or restore acceptance claim.

Real-provider evidence uses Chromium synthetic audio and pinned local LiveKit 1.13.10 on ports 17880–17882. The BA-04 test advances the persisted deadline, never asks the old client to renew/release/mute, and observes provider `canPublish=false` and zero published tracks while that client remains connected. Only then does a successor publish. Explicit release, listen-only reconnect, rejection of an expired request ID and a fresh grant also pass. This proves provider enforcement under controlled expiry; it is not a real-user audio test or WAN/TURN/TLS deployment proof. Browser requests use the existing fixture authentication/composition; the production-entrypoint integration tests separately cover worker wiring using provider doubles. Neither is mislabeled as production OIDC plus real-provider end-to-end proof. The post-leave screenshot was inspected; no UI code changed and no full visual/a11y review is claimed.

Aggregate capacity, representative TURN/TLS/WAN and multi-tenant HTTP fairness, the changed candidate's combined app/voting/soak runs and PS-845 authority-transfer evidence remain separate obligations. No migration or operational policy change is required. Reverting only this follow-up restores the slow predicate/read path while preserving BA-04 recovery and follow-up 1; reverting the whole voice module would lose unrelated preserved work. No commit or deployment.
