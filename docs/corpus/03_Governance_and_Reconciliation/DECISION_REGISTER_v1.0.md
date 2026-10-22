# Plenum Studio — Decision Register

## Document control

| Field | Value |
|---|---|
| Document ID | DREG |
| Version | 1.0.10 |
| Date | 2026-10-21 |
| Status | Controlled. Single source of decisions for the Plenum corpus. |
| Owner | Product Owner |
| Approvers | Product Owner; Methodology Lead; Technical Lead; Security Owner; Operations Owner (role placeholders — see OPEN-001) |
| Supersedes | `Alignment__GOVERNING_DECISIONS_AND_ADRS.md` and `Upstream__DECISION_APPROVAL_REGISTER.md` (moved to `archive/` during governance consolidation) |
| Companion | `GLOSSARY_AND_CROSSWALK_v1.0.md` |
| Read by | Every Plenum document |

## 1. Rules

1. This register is the only place a decision is stated. Other documents cite the ID and may describe consequences, but they do not restate or reword the decision.
2. IDs are never reused or renumbered. A changed decision receives a new ID, and the earlier entry is marked Superseded with a pointer.
3. Approval is recorded here. Writing a document that uses a decision does not approve it.
4. Status values:

| Status | Meaning |
|---|---|
| Confirmed | Stated by the Product Owner. |
| Approved | Technical decision accepted by the Product Owner. Any additional sign-off named in the entry is still required. |
| Proposed | Recommended and not approved. Downstream documents may design against it but must label the dependency. |
| Assumed | A recommended default applied because no answer was given. Treated as Proposed until confirmed. |
| Open | Unresolved. The "Blocks" column states what cannot be finalized. |
| Deferred | Intentionally out of current scope. Reviving it requires a new decision. |
| Superseded / Retired | No longer in force. See the pointer. |

## 2. ID scheme

| Prefix | Use | Where the full text lives |
|---|---|---|
| DEC-nn | Owner-level product, methodology and corpus-governance decisions | This register |
| ADR-nnn | Technical architecture decisions | Summary here; rationale in 02 Platform Architecture |
| OPEN-nnn | Unresolved questions | This register |
| REQ-nnn | Normative requirements | 01 PRD |
| INV-nnn | Semantic invariants | 01 PRD |

ADR-001 through ADR-005 keep the meanings they had in the earlier governing-decisions file. GOV-001–010, PLENUM-NEW-01–08 and the Upstream register's "DEC-01–15" are retired; §8 maps every retired ID.

## 3. Owner approval and outstanding confirmation

The Product Owner directed on 2026-10-20 that every current Proposed governing document and ADR is accepted as Approved. Under the status definition above, additional specialist sign-off named in an ADR remains required. The following items still need separate confirmation because they are Assumed, Open, or an editor-selected term rather than Proposed documents:

- **Assumed decisions:** DEC-21 to DEC-27 and DEC-30 to DEC-40. Questions 1–22 of the 2026-10-17 questionnaire came back without visible selections, so the recommended options were applied as stated in that questionnaire.
- **Approved ADRs:** ADR-002, ADR-004, ADR-005, ADR-008 to ADR-014 and ADR-017 were accepted by Product Owner direction on 2026-10-20. ADR-006 and ADR-007 were already Approved. ADR-001, ADR-003, ADR-015, ADR-016 and ADR-018 remain Confirmed by Product Owner direction on 2026-10-19.
- **Completed specialist sign-off:** the Product Owner confirmed on 2026-10-21 that the Security Owner sign-off required by ADR-012 is complete.
- **Replacement term:** the name **Message Channel** in DEC-51 was chosen by the editor; the Product Owner confirmed only that "Voice Channel" keeps its name.
- **Approver identities:** OPEN-001.

To confirm or change any of these, reply with the ID and the decision.

## 4. Product decisions DEC-01 to DEC-20

Source: Foundational Product Definition v0.2 §2 and §16.1. All Confirmed by the Product Owner.

| ID | Decision | Status | Notes |
|---|---|---|---|
| DEC-01 | Fundamental SSG methodology concepts are preserved; individual concepts may be disabled, subject to dependency validation. | Confirmed | Dependency matrix: OPEN-004 |
| DEC-02 | Simulation structure and time vary per simulation; there is no hard-coded universal hierarchy. | Confirmed | Expressed through DEC-33 |
| DEC-03 | Human and external-model adjudication are both supported through one adjudication request/result contract. | Confirmed | |
| DEC-04 | Templates carry structure and workflows, not scenario content, by default. | Confirmed | Expressed through DEC-31, DEC-32 |
| DEC-05 | Live sessions remain editable under version control. Every change is versioned, attributable, validated and activated through controlled change management. | Confirmed | Policy: ADR-004 |
| DEC-06 | Delivery starts with a centrally hosted multi-organization cloud; self-hosting is not precluded. | Confirmed | Clarified by DEC-19 |
| DEC-07 | Studio users are SSG simulation experts who may not program; authoring is visual. | Confirmed | |
| DEC-08 | Workflows are hybrid: SSG workflow templates plus a guarded advanced workflow editor. | Confirmed | |
| DEC-09 | Arbitrary structured artifacts are supported; one artifact definition drives schema, form, workflow binding, visibility and export. | Confirmed | |
| DEC-10 | Information asymmetry is first-class and enforced at the trusted server boundary. | Confirmed | |
| DEC-11 | Specialist tools and adjudication engines are pluggable through small, versioned contracts; no unrestricted plugin code runs inside the trusted Runtime. | Confirmed | Framework: DEC-52 to DEC-60; categories: DEC-60 |
| DEC-12 | The participant interface is configurable from curated components, not free-form. | Confirmed | |
| DEC-13 | There is no general AI design copilot. | Confirmed | Refined by DEC-41 and DEC-57 |
| DEC-14 | The first proof is the Fractured Order essential model and the Scribe → Facilitator → White Cell journey, built and run without custom application code. | Confirmed | Reference workflow: DEC-42 |
| DEC-15 | Multiple designers edit the same draft concurrently, in the manner of Google Docs. | Confirmed | Mechanism: ADR-002 |
| DEC-16 | Reference workload: up to 500 participants per session and 10 concurrent sessions. This is a planning assumption, not a capacity claim. | Confirmed | Foundation wording "in a simulation" is read as "per session". Targets: OPEN-019 |
| DEC-17 | A LAN-hosted Runtime operates without Internet access, and individual participant devices may work while disconnected. | Confirmed | |
| DEC-18 | Consequential adjudications and workflow decisions are committed only by the single authoritative Runtime for each session. | Confirmed | Mechanism: ADR-001 |
| DEC-19 | Deployment profiles: centrally hosted, institutionally self-hosted, and air-gapped. | Confirmed | Packaging: ADR-013 |
| DEC-20 | Institutional evidence is tamper-evident and independently verifiable. | Confirmed | Mechanism: ADR-003 |

## 5. Decisions recorded 2026-10-17 (DEC-21 to DEC-45)

Source: owner questionnaire of 2026-10-17. "Q" numbers refer to that questionnaire.

### 5.1 Corpus governance

| ID | Decision | Status | Q |
|---|---|---|---|
| DEC-21 | The enterprise PRD v0.6 is treated as unavailable. It is rebuilt as 01 PRD v0.7 from Foundation v0.2, the v0.6a amendment and the architecture specifications. PRD v0.7 becomes the top authority. | Assumed | Q1 |
| DEC-22 | The Simulation Design and Research Canon is rebuilt as document 08. | Assumed | Q2 |
| DEC-23 | References to unavailable engineering governance files (PROJECT_BOOTSTRAP, AGENTS, QA_STANDARDS, UNIVERSAL_DESIGN_STANDARDS, Control Pack CTL-001–014, Prompt Book v1.4) are removed. | Assumed | Q3 |
| DEC-24 | Document numbering runs 01 PRD, 02 Platform Architecture, 03 Canonical Simulation Schema, 04 Design Studio, 05 Runtime and Adjudication, 06 Data, Security and Reporting, 07 Implementation Roadmap, 08 Simulation Design and Research Canon, 09 API, Event and Workflow Contracts. | Assumed | Q4 |
| DEC-25 | One decision register (this document) with the ID scheme in §2; every other document cites IDs only. | Assumed | Q6, Q7 |
| DEC-26 | The rebuilt set is released as PRD v0.7, architecture documents v1.3, data model and synchronization protocol v1.1. Amendments are merged into document bodies rather than appended. | Assumed | Q10 |
| DEC-27 | Detailed design and spike code may proceed in parallel with upstream approval, provided they are labeled non-authoritative until the governing documents are approved. | Assumed | Q11 |
| DEC-28 | Rebuilt documents are Markdown files written back into the Project in the existing folder structure; superseded files move to `archive/`. | Confirmed | Q31 |
| DEC-29 | Build order: glossary and decision register, then PRD, then architecture documents, then data model and synchronization protocol, then code. | Confirmed | Q32 |

### 5.2 Vocabulary and lifecycles

Full definitions live in `GLOSSARY_AND_CROSSWALK_v1.0.md`.

| ID | Decision | Status | Q |
|---|---|---|---|
| DEC-30 | The execution instance of a simulation is called a **Session**. "Run" is retired. | Assumed | Q12 |
| DEC-31 | Design hierarchy: Simulation Project contains a Core Design (reusable structure) and Scenarios (exercise content); validated drafts freeze into Definition Revisions; Definition Revisions compile into Simulation Releases. | Assumed | Q13 |
| DEC-32 | A Simulation Template is a Core Design published to the organization library for reuse. Starting from a template copies the Core Design; Scenario content is copied only if the designer chooses. | Assumed | Q14 (no default was offered) |
| DEC-33 | Time and structure use one concept, **Stage**, with a designer-chosen Stage Type label and optional grouping and nesting. | Assumed | Q15 |
| DEC-34 | **Inject** is a designed release of information. **Domain Event** is a committed system state change. **Evidence Event** is the tamper-evident record. | Assumed | Q16 |
| DEC-35 | **Artifact** is the generic structured record. A **Decision Record** is an Artifact whose type is marked decision-bearing. **Actions** are components inside a Decision Record. | Assumed | Q17 |
| DEC-36 | "Workspace" is removed; there is no level between Organization and Simulation Project. | Assumed | Q18 (no default was offered) |
| DEC-37 | Command outcomes: server statuses `received`, `accepted`, `rejected`, `needs_reconciliation`; client-only status `local_pending`; a replay returns the original receipt with a `replayed` flag. | Assumed | Q19 |
| DEC-38 | Commands use imperative dot-case (`artifact.submit`); events use past-tense dot-case (`artifact.submitted`). | Assumed | Q20 |
| DEC-39 | Publication lifecycle: Draft → Validated → In Review → Approved → Published → Superseded → Archived. A test session is not mandatory by default; an organization policy may require one before approval. | Assumed | Q21 |
| DEC-40 | Inject lifecycle: Draft → Scheduled → Eligible → Released → Acknowledged → Responded → Closed, with Cancelled and Expired as exits. | Assumed | Q22 |

### 5.3 Product and reference-slice decisions

| ID | Decision | Status | Q |
|---|---|---|---|
| DEC-41 | AI-assisted authoring content is moved to a "Deferred — requires a new product decision" appendix. Model-based adjudication (for example PLI) remains allowed as a plugin. | Confirmed | Q23; clarified by DEC-57 |
| DEC-42 | Reference artifact workflow return paths for the Fractured Order package: see §5.4. | Confirmed | Q28 |
| DEC-43 | A rejected command records a rejected receipt and an Evidence Event. | Confirmed | Q29 |
| DEC-44 | Organization Roles (Admin, Designer, Publisher, Operator) are separate from Session Roles. Session Roles are defined by the Simulation Release and assigned to Participants through Seats. | Superseded by DEC-61 | Q30 |
| DEC-45 | The reference code slice reads roles and workflow transitions from the published Simulation Release; no simulation-specific role names or transitions in code. | Confirmed | Q27 |

### 5.4 DEC-42 detail — reference workflow

This is configuration of the Fractured Order reference package, not a platform rule. The state and command names follow the glossary.

| From state | Command | Session Role | To state | Notes |
|---|---|---|---|---|
| (none) | `artifact.create` | Scribe | draft | |
| draft | `artifact.edit` | Scribe | draft | Content change only |
| draft | `artifact.submit` | Scribe | submitted | Goes to the Facilitator |
| submitted | `artifact.forward` | Facilitator | in_review | Goes to White Cell |
| submitted | `artifact.return` | Facilitator | returned | Goes back to the Scribe |
| in_review | `artifact.accept` | White Cell | accepted | Terminal |
| in_review | `artifact.return` | White Cell | returned | Goes back to the Scribe; Scribe and Facilitator are both notified |
| returned | `artifact.edit` | Scribe | returned | Content change only |
| returned | `artifact.submit` | Scribe | submitted | Resubmission always passes through the Facilitator again |

Not permitted: the Scribe withdrawing a submitted artifact; the Facilitator returning an artifact once it is with White Cell.

### 5.5 Feature specification decisions (DEC-46 to DEC-60)

Source: Product Owner answers of 2026-10-17 on three owner-supplied specifications. Those specifications continue the DEC-24 numbering as documents 10 (Extension Framework), 11 (Live Polling and Voting) and 12 (Voice and Radio) in `02_Updated_Architecture/`. All Confirmed unless noted.

| ID | Decision | Status | Owner document |
|---|---|---|---|
| DEC-46 | Live polling and voting is a core Runtime capability configured in Studio, and is first-release scope. Ranked-choice voting is deferred until a published method definition, tie rules and conformance tests exist. | Confirmed | 11 |
| DEC-47 | Voice and radio is a core Runtime capability configured in Studio, and is first-release scope. Modes: push-to-talk radio, open team room, private call, one-to-many broadcast. Video is deferred. | Confirmed | 12 |
| DEC-48 | Poll and ballot changes are Commands sent through the standard command endpoint (09 §3). Push-to-talk floor control (request, renew, release) is the one exception: dedicated low-latency endpoints, never queued offline and never replayed after reconnection. | Confirmed | 09, 11, 12 |
| DEC-49 | The voice media stack — a self-hosted WebRTC selective forwarding unit, TURN relays and any datastore the media server needs internally — is an approved exception to ADR-005 and ADR-013. It stays inside the media-provider boundary and never writes to the Plenum PostgreSQL database. | Confirmed | 12; ADR-017 |
| DEC-50 | Transcription of voice is allowed only with the consent of every participant whose speech is transcribed. Recording and transcription are off by default. | Confirmed | 12; OPEN-027 |
| DEC-51 | "Voice Channel" names an audio channel. The earlier "Communication Channel" (a message type) is renamed **Message Channel**. | Confirmed (term); replacement name Assumed | Glossary |
| DEC-52 | Plugin developers are limited to SSG developers, approved research partners and institutional customers. There is no public marketplace or anonymous submission. | Confirmed | 10 |
| DEC-53 | Designers do not write plugin code in Studio. They discover, configure, connect, test and bind approved plugins. | Confirmed | 10 |
| DEC-54 | Every consequential effect that a plugin or model composition proposes on authoritative Session state requires explicit approval by an authorized person before it is committed. Computation, precomputation and staging of proposals need no approval. The rule covers plugin and composition effects only; designer-authored rules, scheduled Injects and automatic Stage transitions run as configured in the Release. | Confirmed | 05, 10 |
| DEC-55 | Plugins can be composed into typed graphs. Sequential and parallel compositions are supported; bounded feedback loops are deferred; arbitrary cycles are never allowed. | Confirmed | 10 |
| DEC-56 | Approved plugins install in institutional self-hosted and air-gapped deployments without an external cloud. Plugins that need an external service are labeled, and a Release that enables one cannot be deployed to an air-gapped profile without a verified local replacement. | Confirmed | 10 |
| DEC-57 | Clarifies DEC-41: during a Session, plugins may propose choices for simulated actors and draft messages. These take effect only after a person approves them (DEC-54). AI-assisted authoring remains deferred. | Confirmed | 10; PRD Appendix A |
| DEC-58 | The whole Extension Framework is first-release scope: developer SDK, publisher intake and registry, execution host, composition builder, approval gate and offline installation bundles. | Confirmed | 07, 10 |
| DEC-59 | Voting-method adapters and media-provider adapters form a separate **Platform Adapter** class outside the plugin categories. They extend a core capability, are pinned and verified like plugins, and never hold authority. | Confirmed | 10, 11, 12 |
| DEC-60 | Plugin categories: four families (model, evidence, analysis, communication) with nine detailed categories (adjudication; world and simulation; agents and actor behavior; information and communication; evidence and observation; research and analysis; experimentation and evaluation; visualization and spatial; integration and data). A category is discovery metadata, never a permission. Resolves OPEN-021. | Confirmed | 10 §3 |

### 5.6 Decision recorded 2026-10-21 (DEC-61)

| ID | Decision | Status | Source |
|---|---|---|---|
| DEC-61 | Organization Roles are **Admin**, **Designer**, **Publisher**, **Operator**, **Reviewer** and **Research Analyst**. They remain separate from Release-defined Session Roles and may be combined on one Organization Membership. Reviewer authority is limited to project-scoped methodology review, publication approval and approval of governed live changes; it does not grant design editing, Organization administration or Session operation. Research Analyst authority is limited to project- or protocol-scoped, policy-approved research evidence and exports subject to classification, consent, retention and data-access approval; it does not grant identity mapping, unrestricted raw or restricted data, Organization administration, publication or Session operation. Additional authority requires a separately assigned role or explicit data-access approval. | Confirmed | Product Owner direction; resolves OPEN-025 and supersedes DEC-44 |

## 6. Architecture decisions

| ID | Decision | Status | Approvers still required | Maps from |
|---|---|---|---|---|
| ADR-001 | **Confirmed 2026-10-19 by Product Owner direction. Single session authority.** Each Session has exactly one authoritative Runtime writer, identified by deployment ID and a monotonically increasing authority epoch. Stale epochs are rejected on every consequential write. Authority transfer is an explicit, operator-run, fenced procedure. No automatic cloud-to-LAN failover. | Confirmed | Product Owner | Old ADR-001; GOV-009; Upstream DEC-10; Q8 item 3 |
| ADR-002 | **Approved 2026-10-20 by Product Owner direction. Two synchronization domains.** Studio drafts converge through a CRDT (Yjs is the candidate library); publication freezes and fully validates the merged draft. Runtime commands are server-authoritative, idempotent and replay-safe; they are never CRDT-merged. | Approved | Technical Lead | Old ADR-002; GOV-010; Upstream DEC-09; Q8 items 2 and 6 |
| ADR-003 | **Confirmed 2026-10-19 by Product Owner direction. Evidence integrity.** Every committed Runtime change writes an Evidence Event in the same transaction. Signed checkpoints over canonicalized event ranges are anchored with an independent custodian. | Confirmed | Product Owner | Old ADR-003; GOV-006 mechanism; Upstream DEC-11; Q8 item 5 |
| ADR-004 | **Approved 2026-10-20 by Product Owner direction. Live release activation.** In-flight workflow instances stay pinned to their Governing Release; harmless changes apply going forward; consequential changes require impact analysis and approval. No blind migration of live instances. | Approved | Methodology Lead | Old ADR-004; GOV-007; Upstream DEC-07; Q8 item 4 |
| ADR-005 | **Approved 2026-10-20 by Product Owner direction. Application and storage topology.** One modular monolith; one PostgreSQL cluster with schemas `identity`, `studio`, `registry`, `runtime`, `sync`, `evidence`; S3-compatible object storage; a background worker using a PostgreSQL-backed job queue. No message broker, cache tier or service split until measurements justify it. Schema list extended by ADR-016; media-stack exception DEC-49. | Approved | Technical Lead, Operations Owner | Old ADR-005; GOV-008; Upstream DEC-08; Q8 item 1 |
| ADR-006 | **No Supabase.** All profiles use self-hostable PostgreSQL, built-in authentication with optional OIDC/SAML single sign-on, and a realtime service operated with the application. | Approved | — | Q25; retires Platform §17 backend list |
| ADR-007 | **Frontend language.** The product frontend uses React and TypeScript. The reference code slice stays HTML, CSS and vanilla JavaScript. | Approved | — | Q24 |
| ADR-008 | **Approved 2026-10-20 by Product Owner direction. Backend runtime.** Node.js with TypeScript, sharing contract types with the frontend in one monorepo. Target Node.js 26 LTS (enters LTS October 2026); Node.js 24 LTS is the supported floor until its end of life in April 2028. | Approved | Technical Lead | Recommendation requested in Q24 |
| ADR-009 | **Approved 2026-10-20 by Product Owner direction. Database version.** PostgreSQL 18 is the minimum supported major version in every profile (supported until November 2030). Managed PostgreSQL in the cloud profile; packaged PostgreSQL in self-hosted and air-gapped profiles. Pin the latest minor release at build time; evaluate a newer major only after its first minor releases. The reference slice moves from PostgreSQL 16 to 18. | Approved | Technical Lead, Operations Owner | Recommendation requested in Q24 |
| ADR-010 | **Approved 2026-10-20 by Product Owner direction. Realtime transport.** Runtime: commands over HTTPS POST with idempotent receipts; server-to-client deltas over Server-Sent Events, using the SSE resume ID as the projection cursor, served over HTTP/2. Studio collaboration: authenticated WebSocket for CRDT update exchange. Fallback for restrictive networks: the polling delta endpoint already defined in the Synchronization Protocol. Voice media is a separate path (ADR-017). | Approved | Technical Lead, Security Owner | Recommendation requested in Q26 |
| ADR-011 | **Approved 2026-10-20 by Product Owner direction. Object storage.** The application talks only to an S3-compatible API. Cloud profile: the provider's object store. Self-hosted and air-gapped: Garage or SeaweedFS for small and medium installations, Ceph RGW for large institutions; final choice after evaluation. MinIO Community Edition is excluded because the project was archived in April 2026. | Approved | Technical Lead, Operations Owner | New |
| ADR-012 | **Approved 2026-10-20 by Product Owner direction; Security Owner sign-off confirmed complete 2026-10-21. Identity provider.** The application is an OIDC relying party. Self-hosted and air-gapped profiles bundle Keycloak for local accounts, MFA and SAML/OIDC/LDAP federation; the cloud profile accepts Keycloak or a customer identity provider over OIDC. | Approved | — | Implements ADR-006; OPEN-007 resolved 2026-10-21 |
| ADR-013 | **Approved 2026-10-20 by Product Owner direction. Deployment packaging.** One set of OCI container images for every profile. Reference single-node deployment with Docker Compose or Podman for LAN and air-gapped installations, shipped as an offline bundle with signed checksums. Cloud profile on a managed container service with managed PostgreSQL. Kubernetes is optional for institutions that already run it, not required. A reverse proxy terminates TLS and serves HTTP/2. The image set also carries the Extension Host, the media server and TURN relays (DEC-49). | Approved | Operations Owner, Security Owner | Implements DEC-19 |
| ADR-014 | **Approved 2026-10-20 by Product Owner direction. Persistence depth.** Current state lives in relational tables; history lives in the append-only Evidence Event journal. Full event sourcing is not required. | Approved | Technical Lead | Foundation §8; Platform §18 "event sourcing depth" |
| ADR-015 | **Confirmed 2026-10-19 by Product Owner direction. Tenant isolation layering.** Tenant identity comes only from authenticated server context. PostgreSQL row-level security is defense in depth under a non-owner application role without BYPASSRLS. Information asymmetry inside a Session is enforced by the application policy engine and server-side projections. | Confirmed | Product Owner | Platform §18 "multitenancy and row-level security" |
| ADR-016 | **Confirmed 2026-10-19 by Product Owner direction. Capability schemas.** Each core capability owns one PostgreSQL schema in the same cluster. Added to the ADR-005 list: `extension` (registry, bindings, runs, proposals, approvals), `voting` (polls, ballots, tallies, certifications) and `comms` (Voice Channel instances, grants, floor state, media events, recording references). | Confirmed | Product Owner | Documents 10–12 |
| ADR-017 | **Approved 2026-10-20 by Product Owner direction. Voice media path.** Audio travels over WebRTC through a self-hosted selective forwarding unit behind a Media Provider Adapter (LiveKit is the candidate, not a hard dependency). The Runtime issues short-lived credentials scoped to Session, channel, permission and Participant; media-provider events are untrusted observations. | Approved | Technical Lead, Security Owner | Document 12; DEC-49 |
| ADR-018 | **Confirmed 2026-10-19 by Product Owner direction. Extension Host isolation.** First-release Plugins run in hardened, rootless containers with read-only base images, resource limits and default-deny network egress through a controlled gateway. WASM/WASI is a later additional target for deterministic models. Hosts never receive database, object-store or secret-store access. Python/native targets remain deferred. | Confirmed | Product Owner | Document 10; narrows OPEN-022 |

### 6.1 Rationale for the recommendations requested in Q24 and Q26

**Database (ADR-009).** PostgreSQL is already the system of record in every Plenum design document. Version 18 has been the current major release since September 2025, with community support until November 2030, which covers the planning horizon. It runs the same way in a cloud-managed service, on an institutional server and on an air-gapped host.

**Deployment (ADR-013).** One image set keeps the three profiles identical, which is what DEC-19 requires. A single-node Compose deployment is the simplest thing an institution can install and recover without Internet access. Kubernetes adds operational burden the Foundation explicitly warns against, so it stays optional.

**Live updates (ADR-010).** For the Runtime, Server-Sent Events are the more stable and secure fit:

- Writes are already separate HTTPS commands with receipts, so the live channel only needs to flow server to client.
- SSE is ordinary HTTP. It passes through institutional proxies and TLS inspection, reuses the same authentication as every other request, and scales behind standard load balancers.
- SSE reconnects automatically and sends the last received ID, which maps directly onto the projection cursor in the Synchronization Protocol.

Studio collaboration is different: CRDT editing needs low-latency traffic in both directions, and the standard Yjs providers are built on WebSocket. Using WebSocket only there keeps the bidirectional channel confined to authenticated designers.

## 7. Open items

In the Origin column, section numbers refer to the superseded source documents kept under `archive/` in the Project.

| ID | Question | Blocks | Owner | Origin |
|---|---|---|---|---|
| OPEN-001 | Names or titles for the Product Owner, Methodology Lead, Technical Lead, Security Owner and Operations Owner roles. | Formal ratification of any document | Product Owner | Q9 |
| OPEN-002 | Owner approval of ADR-002, ADR-004 and ADR-005. **Resolved 2026-10-20: the Product Owner directed that every Proposed governing document be accepted as Approved. Named specialist sign-offs remain required under the Approved status definition.** | — | Product Owner | Q8 |
| OPEN-003 | Pin a Fractured Order commit SHA as the golden reference. **Resolved 2026-10-17: the Product Owner confirmed `ae5d5065bc04a53631815b1b1715a54e21e3ef5b`; the verified snapshot record is `references/fractured-order.snapshot.json`.** | — | Product Owner | Q5; Foundation §3 |
| OPEN-004 | Which methodology concepts are always enabled versus optional, and their dependency matrix. | Publication dependency validation (DEC-01) | Methodology Lead | Foundation §13.1 |
| OPEN-005 | **Resolved 2026-10-22 by Methodology Lead direction.** Permit acyclic sequential and nested Stages, priority-ordered conditional transitions, and bounded parallel forks with an explicit join and `all` or `first` completion. Parallel branches must be automatic, finite, and side-effect bounded; nested parallel branches, participant activities, completion requirements, positive-duration timers, loops and continuously timed structures are prohibited. | — | Methodology Lead | Foundation §13.2 |
| OPEN-006 | **Resolved for the PS-400 implementation baseline 2026-10-22 by Methodology Lead and Technical Lead direction.** Permit typed Gate conditions and uniquely prioritized transitions with at most one ungated lowest-priority fallback; assignment and approval quorum metadata; bounded automation; and a validator-proven path from every state to termination. Workflow loops, continuously running timers and authored code are prohibited. Human adjudication execution remains PS-410. | — | Methodology Lead, Technical Lead | Foundation §13.3 |
| OPEN-007 | **Resolved 2026-10-21 by Product Owner direction.** Plenum is always an OIDC relying party. Cloud deployments use a customer identity provider or Keycloak over OIDC. Self-hosted deployments bundle Keycloak for local accounts, passwordless sign-in and MFA under Organization policy, with optional upstream OIDC, SAML or LDAP federation. Air-gapped deployments bundle local Keycloak/accounts and MFA; federation is limited to locally reachable institutional systems with zero public egress. Keycloak terminates SAML and LDAP. Each Deployment allowlists issuer and audience, explicitly maps claims to Persons and Organization Memberships, and defines local signing-key rollover. | — | Security Owner | Foundation §13.4; ADR-012 |
| OPEN-008 | Migration policy for pending artifacts, in-progress stages and participant permissions during live activation; who may authorize disruptive changes. | ADR-004 approval | Methodology Lead | Foundation §13.5 |
| OPEN-009 | Data residency, sensitivity, retention, performance budgets and operational owner. | Production readiness | Operations Owner | Foundation §13.6 |
| OPEN-010 | Artifact schema and form constraints (field types, nesting, calculated fields, attachments) and import/export formats. | Form renderer contract | Methodology Lead | Foundation §13.7 |
| OPEN-011 | Which external tools and PLI adapters have stable contracts, approved licenses, security classification and release lifecycle. | Production plugin integration | Product Owner, Security Owner | Foundation §13.8 |
| OPEN-012 | Semantic diff and compatibility-versioning policy for Releases, plugins and persisted instances; compiler determinism. | Release compiler; activation classification | Technical Lead | Foundation §13.9; old register item 7 |
| OPEN-013 | Template governance, methodology approval roles, and whether publication or activation requires an approver distinct from the author. | Publication workflow controls | Product Owner, Methodology Lead | Foundation §13.10 |
| OPEN-014 | Air-gapped identity, cryptographic key custody, offline client data-at-rest protection and retention. | High-security deployment | Security Owner | Upstream DEC-12 |
| OPEN-015 | Offline credential lifetime, device revocation, maximum disconnection duration, and the list of command types permitted offline (rules for ballots, voice and effect approvals are already fixed in Sync §4.3). | Final synchronization schema | Product Owner, Security Owner | Upstream DEC-13; review finding |
| OPEN-016 | Authority transfer procedure, failover time objective and durable fencing store. | High-availability implementation | Technical Lead, Operations Owner | Upstream DEC-14 |
| OPEN-017 | RPO/RTO and independent evidence anchor and export custody. | Release assurance | Product Owner, Operations Owner | Upstream DEC-15 |
| OPEN-018 | Schema modeling questions: multiple Actions per Decision Record, co-authorship, revision after submission, one adjudication over many Actions, delayed effects, snapshot immutability, capability consumption, information access versus delivery, objective attachment. **PS-400 portion resolved 2026-10-22 by Methodology Lead direction:** delayed effects are one-shot, Release-pinned, limited to seven days and cancellable only before due; published Release snapshots are immutable; counted Capability consumption and renewal are atomic and never negative. The remaining adjudication, information and objective questions stay open for their owning tasks. | Canonical Schema approval outside the resolved PS-400 portion | Methodology Lead | Schema §26 |
| OPEN-019 | Capacity acceptance targets (latency percentiles, reconnect-burst behavior, hardware baseline) for the DEC-16 workload, including ballot bursts, plugin execution and a separate media profile (rooms, active speakers, relay use, bitrate). **The recommendation document was approved by Product Owner direction on 2026-10-20; this item remains open for Technical Lead and Operations Owner sign-off and measurement evidence.** | Load and reliability gate | Technical Lead, Operations Owner | Data model DB-10; Sync SYNC-15; VOTE-14; VOICE-12; EXT-19 |
| OPEN-020 | **Resolved 2026-10-19 by Product Owner direction.** Releases and offline bundles use a canonical manifest covering the complete payload/dependency digest closure and detached Ed25519 signatures. Verification uses institution-provisioned trust roots kept outside the Package; a Package cannot establish its own trust. | — | Product Owner | Foundation §7 |
| OPEN-021 | Plugin category taxonomy and per-category contracts. **Resolved 2026-10-17 by DEC-59 and DEC-60.** | — | Product Owner | Owner request, Q23 |
| OPEN-022 | **Resolved for the current implementation baseline 2026-10-19 by Product Owner direction.** Use JSON Schema 2020-12 and the existing workflow and policy engines; report generation remains in PS-520; Python and native scientific-model sandboxes are deferred and are not enabled by PS-220. | — | Product Owner | Platform §18; ADR-018 |
| OPEN-023 | If the original PRD v0.6 is recovered, reconcile it with PRD v0.7. | Nothing until recovered | Product Owner | DEC-21 |
| OPEN-024 | Information classification scheme for classified deployments beyond public, internal, confidential and restricted. | Air-gapped accreditation | Security Owner | Data §8 |
| OPEN-025 | **Resolved 2026-10-21 by Product Owner direction.** Add the Reviewer and Research Analyst Organization Roles with the least-privilege boundaries in DEC-61. | — | Product Owner | DEC-61; Foundation §4 |
| OPEN-026 | **Resolved 2026-10-19.** Plenum must make generic Orientation/coverage gates, bounded Control operations and decision-trace capabilities available as configurable options to every simulation. Each Release selects the capabilities and supplies its roles, forms, labels, timing, ordering, required combinations and gate rules. Fractured Order's observed Orientation content and exact Control semantics remain Release configuration, not platform hard-coding. | — | Methodology Lead | DEC-22; owner direction |
| OPEN-027 | How consent to recording and transcription is captured and withdrawn; legal basis; retention, access and export of recordings and transcripts; which transcription engines may run locally in air-gapped profiles. | Enabling recording or transcription in a production Session | Security Owner, Product Owner | DEC-50; document 12 |
| OPEN-028 | Secret-ballot protection: ballot encryption, eligibility tokens, key custody, whether any administrator can recover choices, and small-group suppression thresholds for results. | Secret-ballot polls in a production Session | Security Owner, research governance | Document 11 |
| OPEN-029 | **Resolved 2026-10-19 by Product Owner direction.** Use DEC-52 restricted publishers and registered signing keys; distribute signed revocation data and require freshness within 30 days for new installations or bindings (existing digest-pinned runs may continue); require an SBOM; block known critical vulnerabilities, with only time-limited, recorded exceptions for high severity; require Organization license acceptance; keep the catalog curated and installations Organization-scoped. | — | Product Owner | Document 10 |

## 8. Retired ID crosswalk

### 8.1 Requirements and invariants

| Retired | Now | Text owner |
|---|---|---|
| PLENUM-NEW-01 to PLENUM-NEW-08 | REQ-001 to REQ-008, same order | 01 PRD v0.7 |
| Foundation §5 invariants 1 to 10 | INV-001 to INV-010, same order | 01 PRD v0.7 |

REQ-009 onward and INV-011 onward are assigned in PRD v0.7.

### 8.2 Governance IDs

| Retired ID | Source file | Now |
|---|---|---|
| GOV-001 | Alignment governing decisions | DEC-15 |
| GOV-002 | Alignment governing decisions | DEC-16 |
| GOV-003 | Alignment governing decisions | DEC-17 |
| GOV-004 | Alignment governing decisions | DEC-18 |
| GOV-005 | Alignment governing decisions | DEC-19 |
| GOV-006 | Alignment governing decisions | DEC-20 (mechanism: ADR-003) |
| GOV-007 | Alignment governing decisions | ADR-004 |
| GOV-008 | Alignment governing decisions | ADR-005 |
| GOV-009 | Alignment governing decisions | ADR-001 |
| GOV-010 | Alignment governing decisions | ADR-002 |

### 8.3 Upstream register "DEC" IDs

These collided with the Foundation's DEC-01 to DEC-20 and are retired.

| Retired ID | Meaning in Upstream register | Now |
|---|---|---|
| Upstream DEC-01 | Concurrent draft collaboration | DEC-15 |
| Upstream DEC-02 | 500 × 10 workload | DEC-16 |
| Upstream DEC-03 | LAN and disconnected operation | DEC-17 |
| Upstream DEC-04 | Single adjudication writer | DEC-18 |
| Upstream DEC-05 | Hosted, institutional, air-gapped | DEC-19 |
| Upstream DEC-06 | Tamper-evident history | DEC-20 |
| Upstream DEC-07 | Safe activation | ADR-004 |
| Upstream DEC-08 | Modular monolith and storage | ADR-005 |
| Upstream DEC-09 | CRDT Studio, optimistic Runtime commands | ADR-002 |
| Upstream DEC-10 | Epoch fencing, no automatic failover | ADR-001 |
| Upstream DEC-11 | Evidence journal and signed checkpoints | ADR-003 |
| Upstream DEC-12 | Air-gapped identity, keys, offline data | OPEN-014 |
| Upstream DEC-13 | Offline auth expiry, revocation, disconnection | OPEN-015 |
| Upstream DEC-14 | Authority transfer and failover | OPEN-016 |
| Upstream DEC-15 | RPO/RTO and anchor custody | OPEN-017 |

### 8.4 Superseded content

| Superseded content | Replaced by |
|---|---|
| Platform Architecture §17 technology list (Supabase Auth, Realtime, Storage, Edge Functions; Vite or Next.js choice) | ADR-006 to ADR-013 |
| Platform §3.4 "AI-assisted design services"; Design Studio §19; Roadmap Phase 6 AI items | DEC-41 (moved to a Deferred appendix) |
| "Require human approval if the model says so" (Runtime v1.3 §12.3) and `requireHumanApproval` (Schema v1.3 §14) | DEC-54 |
| Owner-supplied Extension Framework, Live Polling and Voting, and Voice and Radio specifications v1.0 | Documents 10, 11 and 12 v1.1 |
| Old ADR-001 to ADR-005 texts | ADR-001 to ADR-005 above (same meanings, consolidated text) |

## 9. Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-17 | Created. Consolidates Foundation DEC-01–20, GOV-001–010, old ADR-001–005, Upstream register DEC-01–15 and PLENUM-NEW-01–08 into one scheme; records the 2026-10-17 questionnaire; adds ADR-006 to ADR-015 and OPEN-001 to OPEN-025. |
| 1.0.1 | 2026-10-17 | Added OPEN-026 (Canon methodology substance). |
| 1.0.2 | 2026-10-17 | Noted that Origin-column section numbers refer to archived sources. |
| 1.0.3 | 2026-10-17 | Added §5.5 (DEC-46 to DEC-60) for the voting, voice and extension specifications; added ADR-016 to ADR-018; extended ADR-005, ADR-010 and ADR-013 notes; resolved OPEN-021; added OPEN-027 to OPEN-029; updated OPEN-015, OPEN-019 and OPEN-022. |
| 1.0.4 | 2026-10-17 | Resolved OPEN-003 by recording the Product Owner's confirmation of Fractured Order commit `ae5d5065bc04a53631815b1b1715a54e21e3ef5b` as the official golden reference. |
| 1.0.5 | 2026-10-19 | Resolved OPEN-026: reusable Orientation, Control and decision-trace mechanics are platform options; release-specific substance remains Release configuration. |
| 1.0.6 | 2026-10-19 | Product Owner confirmed ADR-018 and resolved OPEN-020, OPEN-022 and OPEN-029 for the Plugin implementation baseline. |
| 1.0.7 | 2026-10-19 | Product Owner direction confirmed ADR-001 and ADR-003 for the PS-230 authority and evidence baseline. |
| 1.0.8 | 2026-10-19 | Product Owner confirmed ADR-015 tenant isolation layering and ADR-016 capability schemas. |
| 1.0.9 | 2026-10-20 | Product Owner accepted every current Proposed governing document and ADR as Approved; resolved OPEN-002. Named specialist sign-offs and all unrelated OPEN items remain. |
| 1.0.10 | 2026-10-21 | Recorded completed Security Owner sign-off for ADR-012; resolved OPEN-007 with deployment-profile federation rules; added DEC-61 and resolved OPEN-025 with Reviewer and Research Analyst Organization Roles. |
