# Governing Decisions and Architecture Decision Register — v1.2

**Status:** Product-owner decisions confirmed in discussion; technical design proposals require architecture ratification. **Effective date:** 2026-10-17. This register does not supersede the PRD, canonical schema, or ratified ADRs without reconciliation.

| ID | Status | Decision / constraint | Rationale and limits | Primary owner |
|---|---|---|---|---|
| GOV-001 | Confirmed requirement | Google-Docs-style concurrent Studio collaboration | Design must support multiple simultaneous editors; CRDT/Yjs is a candidate, not approved dependency | Studio |
| GOV-002 | Confirmed planning assumption | 500 participants per session and 10 simultaneous sessions | 5,000 potential active participants, not benchmark or contractual capacity | Architecture/QA |
| GOV-003 | Confirmed requirement | Continue on isolated institutional LAN and allow independently disconnected participant devices | Local authoritative deployment plus local draft/command persistence | Runtime/Sync |
| GOV-004 | Confirmed requirement | Single centralized authoritative adjudication | Disconnected clients cannot finalize conflicting adjudications | Runtime |
| GOV-005 | Confirmed requirement | Cloud, self-hosted institutional and air-gapped deployments | Air-gapped execution must not require online services; accreditation remains distinct | Operations |
| GOV-006 | Confirmed requirement | Tamper-evident institutional evidence record | Signed, independently anchored evidence mechanism is a design proposal | Evidence |
| GOV-007 | Recommended policy, pending ratification | Safe release activation: existing workflows pinned, harmless changes prospective, consequential changes reviewed | Avoids silent reinterpretation or premature migration | Runtime/Studio |
| GOV-008 | Proposed implementation | Modular monolith + PostgreSQL + object storage + optional worker | Defer brokers, caches and splitting until evidenced | Platform |
| GOV-009 | Proposed invariant | Per-session authority/epoch fencing; no automatic cloud-to-LAN failover in initial delivery | Prevents split brain; requires durable transfer design | Runtime/Operations |
| GOV-010 | Proposed protocol separation | Studio CRDT collaboration; Runtime server-authoritative idempotent command replay | Not all operations can be merged | Studio/Runtime |

## Decision records requiring approval

**ADR-001: Deployment portability and authority** — Proposed: one portable app deployment, one writer per live session, durable epoch fencing. Rejected: active/active cross-deployment adjudication. Revisit if independently verified HA requirements demand managed failover.

**ADR-002: Offline sync separation** — Proposed: document convergence for Studio drafts, protected local outbox for participant commands, authoritative reconciliation. Rejected: CRDT-based authoritative workflows. Revisit for specific safe offline collaborative artifact editing needs.

**ADR-003: Evidence integrity** — Proposed: transactional journal plus canonicalized signed checkpoints and separate custody of anchors. Rejected: relying solely on mutable database audit rows. Revisit key management based on institutional security profile.

**ADR-004: Live release activation** — Proposed: preserve existing workflow definitions by default and apply new changes prospectively; review consequential modifications. Rejected: blindly migrate every live instance. Revisit after methodology-owner testing.

**ADR-005: Storage topology** — Proposed: one PostgreSQL cluster with schema ownership and object storage. Rejected: independent domain databases initially. Revisit on measured organizational/deployment/scale isolation needs.

## Outstanding decisions (not silently resolved)

1. Confirm whether the authoritative PRD `PLENUM_PRD_v0.6_ENTERPRISE_SESSION_INTEGRITY.md` permits these requirements, and assign stable requirement IDs.
2. Confirm canonical terms: Simulation Project, Core Design, Scenario, Release, Session, Participant, Seat, Decision Record and Evidence; avoid conflating user and actor.
3. Define session authority transfer custody/fencing design, handover operator controls and disaster recovery.
4. Determine device classes, encryption/key custody, permitted offline content, cache expiry and classifications for each deployment profile.
5. Define key custody and independent evidence checkpoint anchor verification protocol.
6. Define retention/export legal and institutional policies, RPO/RTO and possible classification standards.
7. Define package compiler determinism, compatibility contract, schema versions and concurrency/version semantics.
