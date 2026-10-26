# PS-545 command and Floor optimization evidence

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
