# Fractured Order parity test plan

## Status and authority

Source identity is **PINNED**. The Product Owner confirmed commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b` as the official Fractured Order golden reference, and `references/fractured-order.snapshot.json` records the verified tree and archive digest. Parity itself is **NOT RUN**: PS-000 must classify the snapshot and create the inventory; PS-200 then performs extraction and AC-09 comparison. The v0.2.0 slice remains separate executable evidence, not the golden product reference.

## Pinning protocol

1. **PASS:** Product Owner supplied and approved the exact immutable commit SHA.
2. **PASS:** `references/fractured-order.snapshot.json` records retrieval method, commit, tree, archive digest, file count, size, exclusions, and verification.
3. **PASS:** `references/fractured-order/` preserves the clean tracked-file snapshot without Git metadata, secrets, dependencies, build output, coverage, or caches.
4. **PENDING PS-000:** classify observed behavior, define intentional differences, and route ambiguous rows or waivers for approval.
5. **PENDING PS-200:** run old and new implementations from clean, version-pinned environments against the same deterministic scenarios.

## Parity dimensions

| Dimension | Observable comparison | Evidence |
|---|---|---|
| Role and stage surfaces | Same authorized controls/content for each role and Stage; no forbidden data | Screen/state captures plus authorization denials |
| Workflow | Artifact transitions, approvals, adjudications, timers, injects, and state changes agree | Ordered command/receipt/event transcript |
| Reconnect and sync | Same authoritative result after disconnect, stale cursor, and retry | `SYNC-*` evidence and projection hashes |
| Voting | Eligibility, accepted Ballots, tally, Certification, close/deadline behavior | `VOTE-*` evidence; privacy-safe hashes for secret ballots |
| Voice | Grant, join/listen/transmit, floor lease, preemption, revoke, expiry | `VOICE-*` evidence; media transport remains non-authoritative |
| Extensions | Inputs, output validation, effect review, approval/denial, isolation | `EXT-*` evidence and reproducibility manifest |
| Database | Migration, constraints, tenant isolation, transaction atomicity | `DB-*` evidence on PostgreSQL 18 |
| Reports | Stable definitions, counts, provenance, captured/reconstructed labels | Reconciled export and evidence-package hashes |

## Required scenarios

- Normal Fractured Order Session from a published Release through reports.
- Duplicate command and duplicate ballot replay.
- Unauthorized cross-role and cross-tenant access.
- Disconnect, reconnect, stale Authority Epoch, and reconnect after Poll close.
- Partial failure around state/event/receipt/outbox atomicity.
- Plugin timeout, invalid output, rejected effect, and unavailable host.
- Exclusive floor contention, expiry, authorized preemption, and DEC-48 non-replay.
- Secret-ballot export proving Certification without identity-to-choice leakage.

## Determinism and tolerances

Use seeded fixtures, a controlled clock, identical Governing Release and method versions, and canonical event ordering. Exact equality is required for domain state, accepted command results, ballot set/result hash, and evidence identity. UI pixel identity is not required; observable content, permissions, semantics, keyboard operation, and state transitions are. Performance is evaluated separately against named hardware and OPEN-019 targets.

## Exit rule

AC-09 passes only when all non-waived scenarios pass, every waiver cites an approved decision, evidence is immutable and traceable, and the owner signs the parity report. Resolving OPEN-003 satisfies source identity only and does not satisfy AC-09.
