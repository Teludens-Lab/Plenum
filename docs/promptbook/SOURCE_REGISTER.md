# Source register

Authority and status remain owned by the source documents. "Read" means inspected while generating or reconciling this promptbook through 2026-11-08; it does not mean ratified.

| Path | Version | Corpus status | Owner | Verified read | Contradictions / notes |
|---|---:|---|---|---|---|
| `docs/corpus/README.md` | 2026-10-20 | Corpus contents table | Product Owner | Yes | Records the 2026-10-20 Product Owner approval update; drafts and named specialist gates remain |
| `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` | 1.0.16 | Controlled | Product Owner | Yes | Sole decision authority; 2026-11-08 approvals recorded; implementation and release evidence remain separate |
| `references/fractured-order.snapshot.json` and `references/fractured-order/` | `ae5d5065bc04a53631815b1b1715a54e21e3ef5b` | Official immutable golden reference | Product Owner | Yes | Tree `771510b6180bd4826dc5688789d131f2109eeb62`; 1,111 files; 151,409,464 bytes; archive SHA-256 recorded in manifest |
| `references/teludens-design-system-catalog/` | 1.3 catalog / 1.0 specifications | Binding Plenum UI, interaction and branding reference by Product Owner direction 2026-10-29, amended 2026-11-05 for the approved primary wordmark | Product Owner / Design owner | Yes | Applies to every platform surface including Fractured Order; the exact approved primary Plenum wordmark with shared theme-safe presentation is platform branding. PS-700 versions the production token map and reconciles the catalog's rendered Graphite/Mineral Sage decision mapping with the specification's Electric Vermilion decision token. |
| `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` | 1.0.3 | Controlled | Product Owner | Yes | Canonical terminology; former assumptions and both DEC-51 names confirmed; DEC-63/64 amend historical entries |
| `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` | 0.7.6 | Approved reconstructed baseline | Product Owner | Yes | Owns REQ/INV/AC; subject to Decision Register and later decisions; delivery evidence separate |
| `docs/corpus/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md` | 1.0.3 | Approved reconstructed Canon | Methodology Lead | Yes | OPEN-004/010 resolved; implementation evidence assigned to PS-830/840 |
| `docs/corpus/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md` | 1.3.3 | Draft for review | Technical Lead | Yes | Owns topology and stack; its ADRs are Confirmed or Product Owner Approved, with named specialist sign-offs still required where recorded |
| `docs/corpus/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md` | 1.3.4 | Draft for review | Technical + Methodology Leads | Yes | Owns portable design types; compatibility follows resolved OPEN-012 |
| `docs/corpus/02_Updated_Architecture/09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md` | 1.3.3 | Draft for review | Technical Lead | Yes | Owns event and error catalogs; OPEN-015 resolved |
| `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` | 1.3.5 | Draft for review | Product Owner | Yes | Owns no-code authoring behavior; production publication and activation controls reflect resolved OPEN-013 |
| `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` | 1.3.2 | Draft for review | Technical Lead | Yes | Owns Runtime behavior |
| `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` | 1.3.2 | Draft for review | Security Owner | Yes | Owns data, security, reporting, accessibility and recovery; OPEN-014/015/017 resolved, implementation evidence pending |
| `docs/corpus/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md` | 1.1.0 | Confirmed product; Approved technical | Technical Lead | Yes | First-release scope; trust OPEN-029 and named specialist sign-off remain |
| `docs/corpus/02_Updated_Architecture/11_LIVE_POLLING_AND_VOTING_v1.1.md` | 1.1.0 | Confirmed product; Approved technical | Technical Lead | Yes | OPEN-028 resolved for version 1 by disabling production secret ballots |
| `docs/corpus/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md` | 1.1.0 | Confirmed product; Approved technical | Technical Lead | Yes | OPEN-027 resolved for version 1 by disabling production recording/transcription |
| `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/POSTGRESQL_LOGICAL_DATA_MODEL_v1.1.md` | 1.1.5 | Approved | Technical Lead | Yes | OPEN-013 Template/Release/activation provenance extension specified for PS-760; implementation status is recorded per entity and named specialist sign-off remains |
| `docs/corpus/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md` | 1.1.3 | Approved | Technical Lead | Yes | OPEN-002/014/015/017 resolved; fixed feature offline rules are preserved and named specialist sign-off remains |
| `docs/corpus/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md` | 1.3.3 | Draft for review | Product Owner + Technical Lead | Yes | Owns sequencing and evidence, not product meaning |
| `docs/corpus/03_Governance_and_Reconciliation/CHANGE_LOG.md` | n/a | Consolidated history | Product Owner | Registered, not used as authority | Not cited for requirements |
| `references/plenum-runtime-slice/` | 0.2.0 | Executable spike; non-authoritative | Technical Lead | Yes | Preserved as an observed baseline; upstream source revision is not recorded |
| `references/plenum-runtime-slice/package-lock.json` | lockfile v3 | Implemented baseline | Technical Lead | Yes | Resolves `pg` 8.23.1; package declares Node >=24 |
| `references/plenum-runtime-slice/migrations/001-004` | v0.2.0 | Implemented baseline | Technical Lead | Yes | Historical PASS on Pg 16; Pg 18 not verified here |
| `references/plenum-runtime-slice/contracts/openapi.yaml` | 0.2.0 / OpenAPI 3.1 | Implemented slice contract | Technical Lead | Yes | Demo headers are local-only and must not migrate to production |
| `references/plenum-runtime-slice/definitions/fractured-order-reference.json` | slice-1 | Implemented fixture | Technical Lead | Yes | Reference configuration, not methodology law |
| `docs/promptbook/source/MASTER_PROMPTBOOK_GENERATOR_v1.3.md` | 1.4 content (legacy filename) | Promptbook instruction | User | Yes | Governs this generated artifact only; extended with P07-P11 and the Teludens direction; it is not a Plenum product authority |

## Missing inputs

- Confirmations listed in Decision Register section 3.
- Passing implementation and institutional operating evidence for the resolved OPEN-009, 014, 015, 017, 019, 024, 027, 028 and 029 policies.
- A supported Node 24+ runtime and running PostgreSQL 18 environment for PS-001.

No archived file was used as current authority. `QA_STANDARDS.md`, `UNIVERSAL_DESIGN_STANDARDS.md`, and other DEC-23-retired corpus references were not used as Plenum product sources; their relevant functions are taken from Roadmap sections 8, 13, 16, PRD REQ-064, and document 06 as directed.
