# OPEN-019 measurable acceptance recommendation

Status: **APPROVED by the Owner acting as Product Owner, Technical Lead, and Operations Owner on 2026-10-24; OPEN-019 resolved**. These numbers are the accepted release criteria, not a claim that the current build meets them.

Measurement update, 2026-10-26: PS-545 passes these targets on the owner-approved lower-capacity equivalent with a full 30/60-minute soak, three final application/voting/voice/Extension sets, and representative segmented-LAN TURN/TLS media evidence. The exact results and the final read-cache/soak timing caveat are recorded in `docs/performance/PS-545-optimization.md`. Production-institution operations and release approval remain separate gates.

## Named baseline

- Test the planned production topology, or a documented lower-capacity equivalent, with PostgreSQL 18 and the supported Node 24 line.
- Record application/database CPU and memory, storage class, network path, process counts, connection-pool limits and exact build/Release identifiers with every result.
- Use 10 concurrent Sessions with 500 Participants each (5,000 connected Participants), synthetic identities and production-shaped data.

## Workload and duration

Run a 30-minute warm-up, a 60-minute mixed steady-state workload and the following bursts. Pass three consecutive clean runs:

1. Reconnect all 5,000 Participants uniformly over 60 seconds after a simulated interruption.
2. Submit 100 commands per Session (1,000 total) over 10 seconds, including artifacts and messages.
3. Submit 500 ballots per Session (5,000 total) over 30 seconds and certify each Poll after close.
4. Send one broadcast Message and one Stage-entry Inject per Session to all 500 Participants.
5. Execute the approved Extension concurrency limit with valid, timeout, invalid-output and unavailable-host cases.
6. Run voice separately with named room, listener, active-speaker, relay and bitrate assumptions; media traffic must not be mixed into the authoritative command SLO.

## Approved pass thresholds

| Measure | Approved acceptance threshold |
|---|---|
| Accepted command receipt | p95 ≤ 500 ms; p99 ≤ 1 s steady state and ≤ 2 s during declared bursts |
| Authorized projection update after acceptance | p95 ≤ 1 s; p99 ≤ 2 s |
| Full reconnect to a consistent projection | p95 ≤ 10 s; p99 ≤ 30 s from reconnect attempt |
| 500-recipient Message or Inject fan-out | p95 ≤ 5 s to durable recipient/delivery records |
| Ballot receipt and certification | receipt p99 ≤ 2 s; Certification available ≤ 5 s after Poll close |
| Availability/error rate | ≥ 99.9% successful valid operations during the run; invalid operations fail with their expected typed error |
| Data integrity | zero lost or duplicate accepted effects, cross-Session/tenant disclosures, unauthorized projections, sequence gaps or receipt/event/outbox mismatches |
| Saturation | application CPU, memory, database connections and queue depth remain below 80% for more than five consecutive minutes; no unbounded growth |
| Recovery | return to the steady-state latency thresholds within five minutes after each burst |

For voice, recommend join p95 ≤ 3 seconds, floor-grant p95 ≤ 500 ms, median speech-start latency ≤ 300 ms and packet loss below 1% on the named LAN profile. The owner must approve or replace these media thresholds after selecting the conferencing/SFU topology.

## Evidence required to pass capacity acceptance

- Raw latency distributions (not averages), error counts, integrity reconciliation and saturation time series for all three runs.
- Exact workload generator, seeds, configuration and environment manifest sufficient to repeat the run.
- A separate voice report and Extension report, because their infrastructure and failure modes differ from ordinary Runtime commands.
- Owner, Technical Lead, and Operations Owner sign-off is complete. The measurements must now meet the approved thresholds; approval does not waive a failed result.
