# PS-540 reference-load evidence

Date: 2026-10-24  
Status: **Harness implemented; one characterization run completed; capacity acceptance BLOCKED**

Superseding optimization evidence: [`PS-545-optimization.md`](./PS-545-optimization.md). PS-545 materially improves Command, Floor, and fan-out latency; adds durable PostgreSQL settings and raw resource telemetry; corrects the voting workload and soak scheduler; and passes the named lower-capacity-equivalent gate plus representative TURN/TLS media evidence, subject to the documented final-cache soak-timing caveat.

## Claim boundary

This report measures the DEC-16 planning workload on one local workstation. It is not a production capacity claim or an SLO. `OPEN-019` targets were fully approved on 2026-10-24, but passing them still requires three consecutive production-shaped runs, the 30-minute warm-up/60-minute steady-state period, and an institutional LAN/TURN media run.

## Environment and workload

- Baseline commit: `409eed3c856ca17e3d39fddfb1258ed304946d6f`; PS-540 harness changes were in the measured working tree.
- Host: Windows 10.0.19045 x64, Intel Core i7-12700H, 20 logical CPUs, 31.68 GiB host memory.
- Containers: Docker 28.5.1, 20 CPUs and 15.46 GiB visible memory.
- Runtime: Node 24.22.1; PostgreSQL 18.6, 100 connections, 128 MB shared buffers, local loopback.
- Seed: `ps-540-reference-v1`; synthetic data only; ten Sessions with 500 Participants each.
- Media: LiveKit CLI 2.19.2 (official release checksum verified) against digest-pinned LiveKit 1.13.10; one audio publisher, 49 subscribers, 20 seconds, loopback, no relay.
- Extension host: digest-pinned Node 24.22.0 Alpine container, four concurrent runs, no network, read-only root and uid 65532.
- Raw reports: `test-results/load/ps-540-{application,voting,voice,extensions}.json` (generated artifacts, not committed).

## Results

| Profile / measure | Samples | p50 | p95 | p99 | Errors | Product Owner recommendation comparison |
|---|---:|---:|---:|---:|---:|---|
| Reconnect snapshot | 5,000 | 47.08 ms | 67.69 ms | 96.80 ms | 0 | Within 10 s p95 / 30 s p99 |
| Command receipt burst | 1,000 | 7,475.78 ms | 15,376.23 ms | 16,622.14 ms | 0 | **Misses** 500 ms p95 / 2 s burst p99 |
| 500-recipient broadcast fan-out | 10 | 1,092.31 ms | 1,092.56 ms | 1,092.56 ms | 0 | Within 5 s p95 |
| 500-recipient Stage Inject fan-out | 10 | 3,678.22 ms | 3,678.45 ms | 3,678.45 ms | 0 | Within 5 s p95 |
| Ballot receipt burst | 5,000 | 187.28 ms | 430.82 ms | 586.47 ms | 0 | Within 2 s p99 |
| Certification after close | 10 | 40.36 ms | 52.61 ms | 52.61 ms | 0 | Within 5 s |
| Voice floor request | 5,000 | 9,334.71 ms | 12,610.12 ms | 14,653.81 ms | 0 | **Misses** 500 ms p95 |
| Isolated valid Plugin run | 24 | 1,252.51 ms | 1,434.80 ms | 1,440.87 ms | 0 | No approved Plugin latency budget |

The real-media run connected one audio publisher and 49 subscribers with 0% observed packet loss. The 20-second run completed in 28.20 seconds. After a LiveKit container restart, the three-second recovery profile completed with 0% observed packet loss; service restart plus recovery took 8.55 seconds. Join p95 and speech-start latency were not independently instrumented, so those recommended voice measures remain NOT RUN.

## Integrity, saturation, recovery, and cost

- Application: 5,000 Participants, 1,000 accepted notes, 5,000 broadcast recipients, 5,000 Inject recipients, and exact receipt/Event/outbox counts; duplicate replay returned the original receipt; unauthorized projection returned `NOT_A_PARTICIPANT`.
- Voting: 5,000 Ballots and current receipts, ten Certifications, zero Ballot-choice leakage into Evidence, duplicate vote rejected as `ALREADY_VOTED`, late vote rejected as `DEADLINE_EXPIRED`.
- Voice: 5,000 grants, 5,001 requests including the injected provider failure, no active lease left behind, and typed `MEDIA_UNAVAILABLE` evidence.
- Extensions: 24 deterministic outputs with one digest; two invalid outputs and two timeouts rejected; no host-state mutations. The run exposed and fixed code-124 timeout classification.
- Peak database use was 52 connections with 51 waiting in the application, voting, and voice profiles. Peak Node RSS was 710.04 MiB (application), 470.84 MiB (voting), 441.63 MiB (voice), and 283.71 MiB (extensions).
- Terminated PostgreSQL backends recovered in 0.62–11.17 ms. Runtime restart recovered in 660.30 ms. LiveKit restart recovered in 8.55 seconds.
- Wall time/database growth: application 170.84 s/25.18 MiB; voting 23.87 s/22.55 MiB; voice 950.82 s/19.31 MiB; extensions 18.38 s/0.05 MiB. External spend was $0.

## Bottleneck and scaling decision

The original sampler reported 51 waiting database connections out of a 52-connection peak. PS-545 later proved that this total incorrectly included idle pooled `ClientRead` connections; it is not a saturation measure. Separate PS-545 lock sampling still confirmed authority tuple-lock contention in the Command path and per-channel serialization in the Floor path, which became the optimization targets.

No cache, broker, database split, or new service is justified by this single local run. First measure query/lock time, bound the voice queue-position work, tune the existing connection/concurrency limits, and repeat on the approved topology. A service split would add operations cost without evidence that process separation is the limiting factor.

## Validation status

| Reference | Status | Evidence |
|---|---|---|
| `SYNC-15` | FAIL | Measurement and integrity completed; command-receipt latency fails the approved target and the three-run soak remains |
| `VOTE-14` | BLOCKED | One run meets the approved latency/integrity targets; required repetitions remain |
| `VOICE-12` | FAIL | Floor latency fails the approved target; local packet-loss/restart proof passes; LAN/TURN, join and speech-start evidence remain |
| `EXT-19` | BLOCKED | Isolation, deterministic load, invalid output and timeout behavior pass; required repetitions remain |

PS-540 is implementation-complete but not capacity-verified. `OPEN-019` is resolved because the targets are approved. PS-550 must still carry the failed command/Floor measurements and incomplete acceptance runs as release blockers until optimization and clean reruns pass, unless the same authorized owners formally amend the targets.
