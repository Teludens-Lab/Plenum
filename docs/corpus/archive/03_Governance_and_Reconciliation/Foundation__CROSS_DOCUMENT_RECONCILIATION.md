# Foundational v0.2 ↔ Architecture v1.2 — reconciliation and decision status

| Topic | Foundation | Architecture Alignment / Upstream Reconciliation | Outcome |
|---|---|---|---|
| Methodology, structure, artifacts, information asymmetry | v0.1 DEC-01–14 carried forward | Existing Platform/Runtime/Schema v1.2 | Aligned; preserve |
| Simultaneous design | v0.2 DEC-15 | Studio v1.2 and Schema v1.2 | Matched requirement; CRDT vendor proposal pending ADR |
| Reference capacity | v0.2 DEC-16 | Platform/Roadmap v1.2 | Aligned planning assumption, not verified capacity |
| LAN and isolated device offline | v0.2 DEC-17 | Runtime/Data Security/API v1.2 | Aligned direction; detailed synchronization/auth still open |
| Single adjudication authority | v0.2 DEC-18 | Runtime/API v1.2 | Aligned requirement; fencing and transfer pending ADR |
| Hosted/self-hosted/air-gapped | v0.2 DEC-19 and DEC-06 clarification | Platform/Roadmap v1.2 | Scope qualification resolved; deployment test pending |
| Tamper-evident record | v0.2 DEC-20 | Data Security v1.2 | Aligned requirement; key/anchor policy pending |
| Canonical release vocabulary | v0.2 §16.2 | PRD v0.6 vs. Schema/API | Explicit crosswalk required before implementation |
| AI-assisted authoring | v0.2 DEC-13 clarification | Older Platform integration inventory | Excluded absent a new approved product decision |
| Activation defaults | v0.2 §16.3 | Existing Runtime v1.2 / Schema v1.2 | Candidate policy; methodology sign-off required |
| Offline client security | v0.2 §16.3 | Data Security/Upstream v1.2 | Policy open; cannot claim classified readiness |

## Acceptance status
- **Product requirements:** Confirmed by requester; captured in controlled Foundation revision and proposed PRD amendment.
- **Actual enterprise PRD file:** Not modified; amendment awaits formal merge and sign-off.
- **Technical ADRs:** Proposed only, not automatically approved by producing a document.
- **Implementation readiness:** Logical database and protocol may be designed as proposals, but security-dependent contracts stay explicitly pending.
- **No claims:** No end-to-end repository test, migration, cryptographic verification, capacity validation or deployed system audit.
