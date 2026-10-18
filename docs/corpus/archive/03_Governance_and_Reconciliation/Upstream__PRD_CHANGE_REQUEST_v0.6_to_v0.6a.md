# Governing PRD controlled change request — v0.6 → proposed v0.6a

**Status: Proposed product-owner-approved discussion decisions; awaiting incorporation into the authoritative PRD and owner review.** The PRD remains upstream authority. Its original text was accessible for review, but an authorized raw file copy was not available; this is an amendment proposal, **not** a claim to have edited the PRD.

## Add requirements and acceptance intent
- PLENUM-NEW-01: Multiple designers can concurrently edit one simulation draft with Google-Docs-style collaboration; domain-invalid merges never publish.
- PLENUM-NEW-02: Capacity planning targets 500 participants per session and 10 concurrent sessions (planning input, not demonstrated SLA).
- PLENUM-NEW-03: Sessions remain operational on an institutional LAN without Internet; authorized disconnected devices preserve drafts and permitted provisional commands.
- PLENUM-NEW-04: Exactly one authoritative adjudication/transition writer is designated per session; disconnected clients do not finalize consequential decisions.
- PLENUM-NEW-05: Product distribution supports hosted, institutionally self-hosted and air-gapped deployments without mandatory online dependencies for air-gapped execution.
- PLENUM-NEW-06: Institutional event records are tamper-evident, including independent verification of signed checkpoints, controlled key custody and export/proof verification.
- PLENUM-NEW-07: Release activation on active sessions is version-aware and impact assessed; in-flight workflows retain governing release by default; consequential migration needs review.
- PLENUM-NEW-08: Locally stored restricted data is minimized by participant-authorized projection, with expiry, reauthorization and revocation limitations explicitly stated.

## Reconciliation with existing PRD
The PRD already requires enterprise tenant isolation, immutable security/research auditability, encryption/key lifecycle, resilience and disaster recovery, customer data export, versioned integrations, and clear Studio/Runtime/Analysis boundaries. These new additions must refine—not replace—those obligations.

## Approval gate
Product owner: confirm this change request as the PRD intent; methodology owner: verify invariants and live version semantics; technical lead: accept feasibility and security assumptions. Convert temporary IDs into the PRD's canonical REQ and INV catalog, then mark the PRD revision approved.
