# Plenum Studio — Consolidated Change Log

This log replaces the four separate change logs and reconciliation records that the corpus previously carried (Foundation, Upstream, Alignment and per-document addenda). Those records are kept unchanged under `archive/03_Governance_and_Reconciliation/`. Each document still keeps its own change log table at the end.

## 2026-10-20 — Proposed documents approved

The Product Owner directed that every current Proposed governing document be accepted as Approved. Decision Register v1.0.9 records ADR-002, ADR-004, ADR-005, ADR-008 to ADR-014 and ADR-017 as Approved and resolves OPEN-002. The Data Model, Synchronization Protocol, feature-specification document controls and OPEN-019 acceptance recommendation now reflect that approval. Named specialist sign-offs, Assumed decisions and unrelated OPEN items remain unchanged; OPEN-019 remains open until its Technical Lead and Operations Owner sign-offs are complete.

## 2026-10-17 — Fractured Order golden reference

The Product Owner confirmed commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b` as the official Fractured Order golden reference. OPEN-003 is resolved in Decision Register v1.0.4. The immutable export and verification metadata are recorded under `references/`; parity classification and AC-09 execution remain pending work.

## 2026-10-17 — Feature specifications 10, 11 and 12

### Why

The Product Owner supplied three specifications (Extension Framework and Model Composition, Live Polling and Voting, Voice and Radio) and answered the questions their integration raised. All three are first-release scope.

### Decisions

| Change | Where |
|---|---|
| DEC-46 to DEC-60: voting and voice as core first-release capabilities; Poll and Ballot changes through the command endpoint with push-to-talk as the only exception; media stack exception to ADR-005 and ADR-013; transcription only with consent; Voice Channel and Message Channel names; restricted plugin developers; no plugin code in Studio; mandatory approval of plugin and composition effects only; compositions without cycles; air-gapped installation; actor proposals allowed with approval (clarifies DEC-41); whole Extension Framework in the first release; Platform Adapter class; plugin categories | Decision Register §5.5 |
| ADR-016 (capability schemas `extension`, `voting`, `comms`), ADR-017 (voice media path), ADR-018 (Extension Host isolation), all Proposed | Decision Register §6 |
| OPEN-021 resolved; OPEN-027 (recording and transcription consent), OPEN-028 (secret ballots), OPEN-029 (plugin trust) added | Decision Register §7 |

### Documents

| Document | Change |
|---|---|
| 10, 11, 12 (new, v1.1.0) | Owner specifications rewritten in current terms, command model, event names and error codes |
| PRD 0.7.2 | REQ-072 to REQ-094; INV-023 to INV-028; REQ-038 and INV-020 now require approval of plugin effects; first-release scope stated |
| Glossary 1.0.1 | Voting, voice and extension terms; four new lifecycles; Message Channel rename; Adapter replaced by Plugin Installation |
| 02 Platform 1.3.1 | New services, schemas, deployment components, transports and failure modes; §18 now summarizes 10 |
| 03 Schema 1.3.1 | `PollDefinition`, `VoiceChannelDefinition`, `ModelCompositionDefinition`, digest-pinned `PluginBinding`; `requireHumanApproval` removed |
| 04 Studio 1.3.2 | Poll, Voice Channel and plugin and composition editors |
| 05 Runtime 1.3.1 | Voice Channels, mandatory plugin approval, Polls, new state machines and tests |
| 06 Data and Security 1.3.1 | §24 ballot secrecy, recordings and transcripts, plugin data; new controls and negative tests |
| 07 Roadmap 1.3.2 | Extension Framework, polls and voice moved into Phases 2 and 3; epics L to N |
| 09 Contracts 1.3.1 | Commands, events, state machines, eleven error codes, push-to-talk endpoints |
| Data Model 1.1.1 | §4.7 to §4.9 and DB-11 to DB-13 |
| Sync Protocol 1.1.1 | §4.3 offline rules for Ballots, voice, floor control and approvals; SYNC-16 and SYNC-17 |

### Cross-reference check

Every section citation added in this round resolves to a heading, and every DEC, ADR, OPEN, REQ, INV, AC, DB, SYNC, EXT, VOTE and VOICE identifier cited is defined. The three uploaded specifications are archived unchanged under `archive/02_Updated_Architecture/`.

## 2026-10-17 — Corpus reconstruction

### Why

A review of the corpus found six classes of problem: competing decision numbering, inconsistent terminology, architecture files carrying unmerged addenda with mismatched version headers, missing upstream documents (no current PRD and no Simulation Design Canon in the Project), a code slice that hard-coded its roles and allowed workflow paths the product owner had not approved, and no single statement of what was decided versus open. The product owner answered a 32-item questionnaire on the same day; the answers and the defaults applied where no answer came back are recorded in the Decision Register.

### Governance

| Change | Where |
|---|---|
| One ID scheme: DEC, ADR, OPEN, REQ, INV. Retired IDs (Foundation DEC-01–20, GOV-001–010, old ADR-001–005, Upstream DEC-01–15, PLENUM-NEW-01–08) mapped to the new ones | Decision Register §2, §8 |
| DEC-21 to DEC-45 recorded from the questionnaire; Assumed entries marked as such | Decision Register §3, §5 |
| ADR-006 to ADR-015 added: no Supabase; React/TypeScript product frontend; Node.js 26 LTS target with 24 LTS floor; PostgreSQL 18; HTTPS commands with SSE deltas and WebSocket Studio collaboration; S3-compatible object storage (MinIO excluded); Keycloak/OIDC; OCI images with Compose or Podman; relational state plus append-only evidence; layered tenant isolation | Decision Register §6 |
| OPEN-001 to OPEN-026 consolidated, each with owner and blocking effect | Decision Register §7 |
| Canonical terms adopted: Session (not Run), Simulation Project, Core Design, Scenario, Definition Revision, Simulation Release, Stage, Organization Role vs Session Role, Inject vs Domain Event vs Evidence Event; Workspace removed | Glossary |
| Command and event naming: imperative dot-case commands, past-tense events; outcome set received / accepted / rejected / needs_reconciliation | Glossary; 09 §3–§4 |

### Product

| Change | Where |
|---|---|
| PRD v0.7 written from Foundation v0.2, the v0.6a amendment and the architecture corpus; REQ-001 to REQ-008 replace PLENUM-NEW-01 to 08 | 01_PRD_v0.7.md |
| AI-assisted authoring moved to a deferred appendix; PLI and model-based adjudication remain allowed | PRD Appendix A; DEC-41 |
| DEC-42 return paths fixed: Facilitator may return a submitted artifact to the Scribe; White Cell returns go to the Scribe with both Scribe and Facilitator notified; no Facilitator return once with White Cell; no Scribe withdrawal | Decision Register DEC-42; 03 §10.1; 05 §8.4 |
| Rejected commands keep a receipt and an Evidence Event | DEC-43; 09; Sync §3 |
| Simulation Design and Research Canon v1.0 reconstructed from methodology content scattered across the corpus | 08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md |

### Architecture

| Change | Where |
|---|---|
| v1.2 addenda merged into the body of 02, 03, 04, 05, 06, 07 and 09; all issued as v1.3 | 02_Updated_Architecture |
| 03 and 09 version headers corrected (they read 1.1.0 and 1.0.0 in files named v1.2) | 03, 09 document control |
| 07 duplicate §15/§16 numbering fixed; 09 section numbering repaired | 07, 09 |
| Workflow definitions made data-driven, including `holderRelation` and `notifyCreator` | 03 §10 |

### Data model, synchronization and code

| Change | Where |
|---|---|
| Data Model v1.1: entity catalog with Implemented / Schema only / Specified status, enforcement, locking, migrations, DB-01 to DB-10 with test status | Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1 |
| Synchronization Protocol v1.1: command envelope, receipts, offline client, reconnection, authority fencing, SYNC-01 to SYNC-15 with status | same folder |
| Reference slice v0.2.0: roles and transitions read from the Release definition; Organization Roles separated from Session Roles; DEC-42 paths exactly; rejected receipts with evidence; row-level security under a non-owner role; append-only triggers; authority fencing; migrations consolidated to 001–004 | plenum_runtime_slice |
| Tests on 2026-10-17 (local PostgreSQL 16): 12 unit, 31 end-to-end, 7 database, plus a browser walkthrough; all passed | plenum_runtime_slice/README.md |

### Cross-reference check

All section citations between current documents resolve to an existing heading, and every DEC, ADR, OPEN, REQ, INV, AC, DB and SYNC identifier cited is defined. Citations of the form "Platform §23.8" in the PRD Basis column, PRD Appendix B, the Register Origin column and the Canon 1.0.0 change-log entry point to archived source documents; each of those places now says so. 04 §3 wording changed from "Workspaces" to "Navigation areas" so it does not suggest the removed Workspace level.

### Archived

Moved unchanged to `archive/` at their original relative paths: Foundation v0.2; PRD amendment v0.6a; architecture 02–07 and 09 at v1.2; the eleven Alignment, Foundation and Upstream governance records; Data Model, Synchronization Protocol, README and Source Alignment v1.0; the sixteen files of the v0.1 code slice (including migrations 002_integrity, 004_collaboration and 005_tenant_rls, which no longer exist in v0.2); the previous root README. Copies whose SHA-256 appears in the upstream provenance record were checked against it.

## Still awaiting confirmation

See Decision Register §3 (Assumed decisions and outstanding specialist sign-offs) and OPEN-001 (approver identities).
