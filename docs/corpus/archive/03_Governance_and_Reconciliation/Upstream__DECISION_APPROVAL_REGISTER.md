# Decision and approval register — reconciliation v1.2

Status labels: **Confirmed requirement** (explicit owner direction); **Proposed ADR** (recommended engineering choice, not approved by assigned authority); **Open** (cannot be declared approved); **Blocked** (cannot finalize associated implementation contract).

| ID | Decision | Status | Owner / approval gate |
|---|---|---|---|
| DEC-01 | Simultaneous Google-Docs-style draft collaboration | Confirmed requirement | Product owner confirmed; implementation ADR technical review |
| DEC-02 | 500 participants per session, 10 concurrent sessions | Confirmed planning assumption | Performance validation required |
| DEC-03 | Both LAN operation without Internet and disconnected participant work | Confirmed requirement | Product owner confirmed |
| DEC-04 | One authoritative adjudication writer per session | Confirmed requirement | Product owner confirmed |
| DEC-05 | Hosted, institutional and air-gapped deployments | Confirmed requirement | Product owner confirmed |
| DEC-06 | Tamper-evident institutional history | Confirmed requirement | Product owner confirmed |
| DEC-07 | Safe activation: in-flight workflows pinned by default; impact-gated prospective changes | Proposed ADR | Product owner + methodology lead approval required |
| DEC-08 | Modular monolith, one PostgreSQL datastore, object storage, background worker | Proposed ADR | Technical lead + operations/security approval required |
| DEC-09 | CRDT-based Studio updates; ordinary Runtime commands use optimistic concurrency, not CRDT | Proposed ADR | Technical lead + Studio architect approval required |
| DEC-10 | Session authority epoch fencing and no automatic cloud/LAN writer failover | Proposed ADR | Technical lead + operations approval required |
| DEC-11 | Transactional evidence journal plus signed independently controlled checkpoints | Proposed ADR | Security + research governance approval required |
| DEC-12 | Air-gapped identity, crypto/key custody, offline client data-at-rest and retention policy | Open / blocking for high-security deployment | Security owner / deployment customer |
| DEC-13 | Offline command authentication expiry, device revocation and maximum disconnection duration | Open / blocking for final sync schema | Product + security |
| DEC-14 | Concrete authority transfer procedure, failover time objective, durable fencing store | Open / blocking for HA implementation | Technical lead + operations |
| DEC-15 | RPO/RTO and independent evidence anchor/export custody | Open / blocking for release assurance | Product + operations + governance |

**Approval statement:** These records do NOT claim sign-off for any Proposed ADR, Open item, or the PRD's actual amended text. Assistant analysis is not an organizational approval. The approved *product-level intent* is the six user-confirmed requirement areas; authorizing design proposals is a separate gate.
