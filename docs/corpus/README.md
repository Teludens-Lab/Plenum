# Plenum Studio — Document Set

**Rebuilt:** 2026-10-17. **Approval update:** 2026-10-20. **Governance update:** 2026-11-01 (`OPEN-013` resolved). The Product Owner accepted every current Proposed document as Approved. Draft documents and explicitly named specialist sign-offs remain subject to their recorded gates; approver identities remain OPEN-001.

## Where to start

1. `03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — every decision (DEC), architecture decision (ADR) and open item (OPEN) in one numbering scheme, with status.
2. `03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — the canonical terms and the mapping from old terms and event names.
3. `01_Product_and_PRD/01_PRD_v0.7.md` — product requirements (REQ), invariants (INV) and acceptance criteria (AC).

## Contents

| Folder | Document | Version | Status |
|---|---|---|---|
| 01_Product_and_PRD | `01_PRD_v0.7.md` | 0.7.5 | Draft; replaces Foundation v0.2 and the v0.6a amendment |
| 01_Product_and_PRD | `08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` | 1.0.2 | Draft; OPEN-026 resolved, formal ratification remains open |
| 02_Updated_Architecture | `02_PLATFORM_ARCHITECTURE_v1.3.md` | 1.3.1 | Draft for review |
| 02_Updated_Architecture | `03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` | 1.3.1 | Draft for review |
| 02_Updated_Architecture | `04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` | 1.3.4 | Draft for review |
| 02_Updated_Architecture | `05_RUNTIME_AND_ADJUDICATION_v1.3.md` | 1.3.1 | Draft for review |
| 02_Updated_Architecture | `06_DATA_SECURITY_REPORTING_v1.3.md` | 1.3.1 | Draft for review |
| 02_Updated_Architecture | `07_IMPLEMENTATION_ROADMAP_v1.3.md` | 1.3.2 | Draft for review |
| 02_Updated_Architecture | `09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md` | 1.3.1 | Draft for review |
| 02_Updated_Architecture | `10_EXTENSION_FRAMEWORK_v1.1.md` | 1.1.0 | Product decisions Confirmed; technical design Approved; first release |
| 02_Updated_Architecture | `11_LIVE_POLLING_AND_VOTING_v1.1.md` | 1.1.0 | Product decisions Confirmed; technical design Approved; first release |
| 02_Updated_Architecture | `12_VOICE_AND_RADIO_v1.1.md` | 1.1.0 | Product decisions Confirmed; technical design Approved; first release |
| 03_Governance_and_Reconciliation | `DECISION_REGISTER_v1.0.md` | 1.0.15 | Controlled |
| 03_Governance_and_Reconciliation | `GLOSSARY_AND_CROSSWALK_v1.0.md` | 1.0.1 | Controlled draft |
| 03_Governance_and_Reconciliation | `CHANGE_LOG.md` | — | Consolidated history of the corpus |
| Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1 | `POSTGRESQL_LOGICAL_DATA_MODEL_v1.1.md` | 1.1.4 | Approved 2026-10-20; OPEN-013 provenance extension specified; named specialist sign-offs remain |
| Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1 | `SYNCHRONIZATION_PROTOCOL_v1.1.md` | 1.1.1 | Approved 2026-10-20; named specialist sign-offs remain |
| Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1 | `README.md` | — | Folder guide |
| `references/plenum-runtime-slice/` | Reference code slice, v0.2.0 | 0.2.0 | Executable spike; not production code (see its README) |
| archive | Superseded files, unchanged | — | For reference only |

The numbering 01–09 follows the original corpus; 10–12 are the feature specifications added on 2026-10-17. The Glossary and Decision Register sit in folder 03.

## How the documents depend on each other

```text
Decision Register + Glossary
        |
       PRD  <->  Simulation Design and Research Canon
        |
Platform Architecture -> Canonical Schema -> Design Studio / Runtime / Data, Security, Reporting
        |                                         |
API, Event and Workflow Contracts  ->  Feature specifications 10, 11, 12
        |                                         |
        +-------------->  Data Model + Synchronization Protocol  ->  reference code slice
        |
Implementation Roadmap
```

A higher document wins over a lower one. Any conflict found is recorded in the Decision Register rather than resolved silently.

## Reference code slice

`references/plenum-runtime-slice/` runs the Fractured Order Scribe → Facilitator → White Cell workflow from a published Release against PostgreSQL. It uses HTML, CSS and vanilla JavaScript on Node.js, plus SQL. Its README lists how to run it and what was tested on 2026-10-17: 12 unit tests, 31 end-to-end checks, 7 database tests and a browser walkthrough. The tests ran on a local PostgreSQL 16; the PostgreSQL 18 container in `docker-compose.yml` has not been run yet.

## Archive

`archive/` keeps every superseded file byte for byte at its original relative path: Foundation v0.2, the v0.6a amendment, the v1.2 architecture files, the old governance records, Data Model and Synchronization Protocol v1.0, the v0.1 code slice, the previous version of this README, and the three owner-supplied v1.0 specifications for the Extension Framework, Live Polling and Voting, and Voice and Radio.

## Still open

- Confirm or change the Assumed decisions (Decision Register §3).
- Name the five approver roles (OPEN-001).
- Complete the named specialist sign-offs for Approved ADRs; Product Owner approval is recorded and OPEN-002 is resolved.
- Confirm "Message Channel" as the new name for the old Communication Channel (DEC-51).
- Consent, legal basis and retention for recording and transcription (OPEN-027); secret-ballot key custody (OPEN-028); plugin signing and trust operations (OPEN-029).
