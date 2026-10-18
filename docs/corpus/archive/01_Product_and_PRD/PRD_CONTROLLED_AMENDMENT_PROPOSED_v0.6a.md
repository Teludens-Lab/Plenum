# Enterprise PRD — controlled amendment for v0.6 → proposed v0.6a

**Disposition:** OWNER-DIRECTED PRODUCT AMENDMENT FOR FORMAL INCORPORATION; NOT A CLAIM THAT THE CANONICAL PRD FILE WAS EDITED OR ORGANIZATIONALLY RATIFIED.
**Product authority:** `PLENUM_PRD_v0.6_ENTERPRISE_SESSION_INTEGRITY.md`.
**Supporting context:** `PLENUM_STUDIO_FOUNDATIONAL_PRODUCT_DEFINITION_v0.2.md` (§16).

## A. Normative requirements to insert into the authoritative PRD

| Provisional ID | Requirement | Acceptance criterion (design-level) | Primary owner |
|---|---|---|---|
| PLENUM-NEW-01 | Studio MUST support concurrent editing of the same mutable simulation draft by multiple authorized designers, with reconnectable work and validation before publication. | Concurrent edits converge without unintended published invalidity; reject invalid references/gates at publication. | Studio / Schema |
| PLENUM-NEW-02 | The reference capacity scenario SHALL include 500 participants in a session and 10 concurrent sessions, without implying a verified production SLO. | Load-test plan names representative actor mix, activity rate, environments and acceptance budgets. | Architecture / QA |
| PLENUM-NEW-03 | Plenum MUST support LAN-local live operation when Internet is unavailable, and permit individually disconnected participants to retain permitted offline work. | Internet outage leaves LAN Runtime operative; offline device stores permitted drafts and provisional commands for controlled reconnect. | Runtime / Security |
| PLENUM-NEW-04 | Only a designated authoritative Runtime per session MAY commit adjudications and consequential state transitions; isolated devices MUST NOT finalize these operations. | Simulated partition does not produce two accepted conflicting adjudications; duplicate/retried commands remain idempotent. | Runtime / Contracts |
| PLENUM-NEW-05 | Target deployment profiles SHALL encompass centrally hosted, institutionally self-hosted, and air-gapped operation without mandatory external network dependencies during air-gapped use. | Air-gapped topology and verified installation/recovery test designed; implementation phase explicitly gated. | Architecture / Operations |
| PLENUM-NEW-06 | Authoritative institutional simulation evidence MUST be tamper-evident and independently verifiable under governed signing/anchor custody. | Modified/omitted event batches fail proof verification against separately retained signed checkpoints. | Evidence / Governance |
| PLENUM-NEW-07 | Release activation in live sessions MUST be attributable, impact-assessed, version-aware and non-retroactive; in-flight workflow migration requires a governed policy. | Existing and newly created workflows can be distinguished by governing effective release; historical decisions preserve interpretation. | Methodology / Runtime |
| PLENUM-NEW-08 | Offline client storage MUST minimize participant-visible data and define encryption, expiry, retention and revocation limitations. | Offline bundles reveal no unauthorized role data in negative tests; loss/revocation behavior is documented and checked. | Security / Information Policy |

## B. Reconciliation rules

1. Preserve enterprise PRD requirements for strict tenancy, role/seat attribution, information asymmetry, human-controlled adjudication, provenance, reconstructable research evidence, modular extensions and immutable releases.
2. Cloud-first is rollout priority; it does not preclude target local and air-gapped execution. No claim of classified accreditation is implied.
3. Use the enterprise PRD vocabulary (Simulation Project, Core Design, Scenario, Simulation Release, Session) as canonical, with explicit aliases for historical `Simulation` and `Simulation Package`; never change existing API/event identifiers silently.
4. General AI design copilot remains excluded; model-based adjudication remains allowed through governed extensions.
5. Foundation §11 MVP scope remains a phased first vertical slice; target capabilities do not all become first-release delivery obligations.

## C. Approval sequence

1. Product owner incorporates and approves the eight provisional PRD requirements (six new requirement areas plus safe activation and offline security refinement).
2. Methodology owner ratifies in-flight release semantics and invariants.
3. Security/research governance approves device offline controls, signing, key custody, independent evidence anchor and correction policy.
4. Technical/operations leads ratify state authority/failover, RPO/RTO and deployment implementation ADRs.
5. Replace provisional `PLENUM-NEW-*` IDs with the canonical REQ/INV catalog IDs; issue a tracked new PRD version and cross-reference the architecture corpus.

**Approval record:** Product intent established in conversation; formal incorporation, institutional ratification, compatibility testing and production verification remain NOT COMPLETED.
