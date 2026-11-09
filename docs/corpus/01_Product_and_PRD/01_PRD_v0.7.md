# Plenum Studio — Product Requirements Document

## Document control

| Field | Value |
|---|---|
| Document ID | PRD |
| Number | 01 |
| Version | 0.7.6 |
| Date | 2026-11-08 |
| Status | Approved reconstructed product baseline; DEC-21 confirmed 2026-11-08, subject to the Decision Register and later approved decisions. Implementation and release acceptance remain separate. |
| Owner | Product Owner |
| Approvers | Product Owner; Methodology Lead; Technical Lead; Security Owner; Operations Owner (role placeholders — OPEN-001) |
| Authority | Top product authority for the Plenum corpus. Owns the REQ and INV catalogs. |
| Reads from | `DECISION_REGISTER_v1.0.md`; `GLOSSARY_AND_CROSSWALK_v1.0.md` |
| Read by | 02–12 and every implementation artifact |
| Supersedes | Enterprise PRD v0.6 (unavailable — OPEN-023); PRD controlled amendment v0.6a; Foundational Product Definition v0.2 as a product authority (retained in `archive/` as the discovery record) |

**Reconstruction note.** The original PRD v0.6 was not available. This document is rebuilt from Foundational Product Definition v0.2, the v0.6a amendment, the v1.2 architecture documents and the 2026-10-17 decisions. Where v0.6 content is unknown, nothing has been invented to replace it; if v0.6 is recovered, OPEN-023 reconciles the two.

**Citation rule.** Decisions are cited by ID (DEC, ADR, OPEN) and never restated here. Terms follow the Glossary.

---

## 1. Product definition

Plenum Studio is an enterprise visual simulation development environment. It lets Statecraft Simulations Group (SSG) simulation experts, including people who do not program, design, test, publish, operate and evolve simulations under the SSG methodology without writing application code.

The product has five parts:

| Part | Responsibility |
|---|---|
| SSG Methodology | Canonical simulation concepts and invariants (08 Canon). |
| Plenum Studio | The authoring and governance control plane: Drafts, validation, review and Publication. |
| Simulation Release | The immutable, validated, executable output of Publication. |
| Plenum Runtime | The execution plane: Sessions, Participants, workflows, adjudication and evidence. |
| Plugins and Platform Adapters | Approved, signed extensions from restricted developers, such as model-based adjudication, that can only propose effects (DEC-11, DEC-52 to DEC-56); Platform Adapters extend core capabilities such as voting and voice (DEC-59). |

**Product promise.** A designer models a simulation in Studio, publishes a validated Simulation Release, an operator starts a Session from it, and Participants run reproducible, role-scoped workflows — with no exercise-specific application code.

**Initial audience.** SSG simulation experts (DEC-07). Studio is a professional authoring workstation, not a general web page builder (DEC-12).

## 2. Goals and non-goals

### 2.1 Goals

1. Turn simulation design from bespoke development into a repeatable, governed capability.
2. Prove the platform by reproducing the essential Fractured Order model from configuration alone (DEC-14).
3. Preserve institutional integrity: information asymmetry, attributable decisions, tamper-evident evidence and reproducible research data.
4. Run the same product in hosted, institutional and air-gapped environments (DEC-19).

### 2.2 Non-goals

| Non-goal | Basis |
|---|---|
| General AI design copilot or AI-assisted authoring | DEC-13, DEC-41; Appendix A |
| Free-form page or pixel layout editor | DEC-12 |
| Simulation-specific code in the platform core | DEC-14, INV-022 |
| Public third-party plugin marketplace or arbitrary custom code execution | DEC-11, DEC-52, DEC-53 |
| Video communication in the first release | DEC-47 |
| Ranked-choice voting in the first release | DEC-46 |
| Feedback loops in Model Compositions | DEC-55 |
| Mandatory microservices, Kubernetes, CQRS or multi-cloud topology | ADR-005, ADR-013 |
| Commercial billing in the first slice | §8.3 |
| Claims of capacity, uptime or accreditation that have not been measured or granted | DEC-16; OPEN-019; OPEN-024 |

## 3. Users

| Persona | Primary jobs | Organization Role (DEC-61) |
|---|---|---|
| Simulation Designer | Define Core Design and Scenario: Teams, Session Roles, Seats, Stages, Artifact Types, workflows, Information Policies, interfaces. | Designer |
| Studio Administrator | Manage members, permissions, approved templates, plugins and deployment settings. | Admin |
| Reviewer / Methodology Owner | Check methodological conformance; approve publication and risky live changes. | Reviewer |
| Session Operator ("Game Master") | Create, staff, monitor, pause, complete, archive and export Sessions. | Operator |
| Control staff (e.g. White Cell in Fractured Order) | Run the timeline and injects, review and return artifacts, adjudicate or route to plugins. | Session Role defined by the Release |
| Participant | Use a role-specific interface; create and submit Artifacts; receive information under Information Policy. | Session Role defined by the Release |
| Subject-matter adjudicator | Review assigned matters, record outcomes with rationale and provenance. | Session Role defined by the Release |
| Research / evaluation analyst | Export permitted evidence, reconstruct sequence and provenance, separate observed from derived data. | Research Analyst |

Personas are not all mandatory seats in every simulation.

## 4. Governing decisions

This PRD implements the decisions below. Their text lives only in the Decision Register.

| Area | Decisions |
|---|---|
| Methodology and modeling | DEC-01, DEC-02, DEC-04, DEC-08, DEC-09, DEC-10, DEC-12, DEC-31 to DEC-36 |
| Adjudication and plugins | DEC-03, DEC-11, DEC-13, DEC-41, DEC-52 to DEC-60; ADR-018 |
| Polling, voting and voice | DEC-46 to DEC-51; ADR-016, ADR-017 |
| Live change | DEC-05; ADR-004 |
| Collaboration and offline | DEC-15, DEC-17, DEC-18; ADR-001, ADR-002 |
| Deployment and technology | DEC-06, DEC-19, DEC-49; ADR-005 to ADR-018 |
| Evidence | DEC-20, DEC-43; ADR-003 |
| Lifecycles and naming | DEC-37 to DEC-39; DEC-64 |
| First proof | DEC-14, DEC-42, DEC-45 |
| Workload | DEC-16 |

## 5. Domain summary

The full vocabulary is in the Glossary; the schema is in 03 Canonical Simulation Schema.

```text
Organization
 └─ Simulation Project
     ├─ Core Design ──┐
     ├─ Scenario(s) ──┴─> Draft ──freeze──> Definition Revision ──compile──> Simulation Release
     └─ Simulation Release ──instantiate──> Session
                                             ├─ Release Activations (governing releases)
                                             ├─ Participants ─> Seat Assignments ─> Session Roles
                                             ├─ Artifacts / Decision Records ─> Workflow Instances
                                             ├─ Injects, Messages, State Values
                                             ├─ Polls ─> Ballots ─> Tallies ─> Certifications
                                             ├─ Voice Channels ─> Floor Leases, Consent Records
                                             ├─ Composition Runs ─> Model Runs ─> Effect Proposals ─> Approval Decisions
                                             ├─ Adjudication Requests ─> Adjudication Records ─> Outcomes ─> Effects
                                             └─ Evidence Events ─> Checkpoints ─> Anchors
```

## 6. Requirements catalog

Keywords: **MUST** is mandatory for the stated scope; **SHOULD** is expected unless a documented reason exists. "Owner doc" is the document that specifies how the requirement is met. Acceptance criteria here are design-level; executable tests are defined in the owner documents and 07 Roadmap.

REQ-001 to REQ-008 replace PLENUM-NEW-01 to PLENUM-NEW-08 in order.

### 6.1 Authoring (Studio)

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-001 | Studio MUST let multiple authorized Designers edit the same Draft concurrently, with reconnectable work and full validation before Publication. | Concurrent edits converge; invalid merged states cannot publish; targeted errors identify each invalid reference or gate. | DEC-15; ADR-002 | 04 |
| REQ-009 | Every Core Design and Scenario element MUST be authorable through visual editors without writing code or raw JSON. | A non-programming Designer completes AC-01 using only Studio controls. | DEC-07 | 04 |
| REQ-010 | Studio MUST let Designers preview the exact interface and content available to any Session Role in any Stage. | Preview output matches the Runtime Projection for the same role, Stage and Release. | DEC-10, DEC-12 | 04 |
| REQ-011 | Studio MUST validate Drafts and report errors in plain language before Publication, covering at least: duplicate or missing references, unreachable Stages, Stages with no exit, circular automatic transitions, workflows without terminal states, unassigned tasks, approvals with no eligible approver, impossible inject conditions, interface modules inaccessible to their roles, effects referencing missing State Variables, routes with no valid recipient, reports referencing unavailable data, permission contradictions, and Information Policy leakage. | Each listed defect, seeded into a test Draft, blocks Publication with a specific message. | DEC-10; INV-009 | 03, 04 |
| REQ-012 | Studio MUST let Designers enable or disable Methodology Concepts and MUST block Publication when an enabled element depends on a disabled concept. | Disabling a concept referenced by an enabled workflow produces an actionable dependency error. | DEC-01; INV-009; OPEN-004 | 03, 08 |
| REQ-013 | Studio MUST model simulation structure as Stages with designer-chosen types and optional nesting; no fixed hierarchy. | A Draft with nested Stages and a Draft with a single flat Stage both publish and run. | DEC-02, DEC-33; OPEN-005 | 03, 04 |
| REQ-014 | Studio MUST support arbitrary Artifact Types whose single definition drives form, validation, workflow binding, Information Policy and export. | One Artifact Type definition renders a form, enforces its workflow and appears correctly in exports with no additional configuration. | DEC-09; OPEN-010 | 03, 04 |
| REQ-015 | Studio MUST provide reusable workflow templates and a guarded advanced workflow editor. | A templated workflow and a custom workflow both validate and run; an invalid custom workflow is blocked. | DEC-08; OPEN-006 | 04 |
| REQ-016 | Studio MUST provide an Information Policy designer that defaults to deny and flags routes that could expose restricted information to unintended roles. | A seeded leakage route is reported before Publication. | DEC-10 | 04 |
| REQ-017 | Starting a Project from a Simulation Template MUST copy the Core Design and MUST NOT copy Scenario content unless the Designer chooses to. | Template-based project contains no Scenario content by default. | DEC-04, DEC-32 | 04 |
| REQ-018 | Studio MUST configure Session access: join policies, Seat planning, roster import with a review queue for ambiguous rows, guest rules, shared displays and reassignment policy. | A session code alone never grants access; invalid roster rows enter review rather than being accepted. | Studio §25 | 04 |
| REQ-019 | Studio MUST let Designers define Research Questions and link each decision-bearing Artifact Type to its owner, trigger, information requirements, available actions, adjudication method, affected State Variables and Measurement Definitions, producing a traceability matrix. | A Release exports a complete decision traceability matrix. | 08 Canon | 04, 08 |
| REQ-020 | Studio SHOULD support role walkthroughs, trigger simulation and deterministic synthetic rehearsal, with an explanation of why each trigger did or did not fire. | A rehearsal of a published Release reproduces the same trace when repeated. | Studio §16, §24 | 04 |

### 6.2 Publication and Releases

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-021 | Publication MUST freeze a validated Draft into an immutable Definition Revision and compile it into an immutable Simulation Release with a content digest, schema version, compiler version, author and provenance. | Re-reading a Release returns identical bytes and digest; modification attempts are refused. | INV-005, INV-012 | 02, 03 |
| REQ-022 | Publication MUST follow the Publication lifecycle, with organization-configurable controls for approvers, release notes, validation evidence, data-classification review, accessibility review status and an optional test-session requirement. Production policy has a two-person integrity minimum: a Reviewer acting as Methodology Owner approves the exact frozen revision and cannot be its author; a Publisher publishes only a validated revision with current approval. | A Release cannot reach `published` without the controls its organization policy requires; production rejects author self-approval, a material change invalidates approval, and non-production sandbox self-approval remains explicitly identified. | DEC-39; resolved OPEN-013 | 04, 06 |
| REQ-023 | A Simulation Release MUST be exportable and importable as a portable Package that preserves identity and digest. | A Package exported from one Deployment imports into an air-gapped Deployment and verifies. | DEC-19; OPEN-020 | 02 |

### 6.3 Runtime

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-024 | The Runtime MUST execute any valid Simulation Release using generic engines; no code path may depend on a specific simulation, team or role name. | The Fractured Order reference Release and a materially different Release run on the same build. | DEC-14, DEC-45; INV-022 | 05 |
| REQ-025 | Sessions MUST follow the Session lifecycle; operator overrides (start, end, reopen, extend, skip or return a Stage) MUST require a reason and produce an Evidence Event. | Commands in a non-permitting Session state are rejected; every override appears in evidence with its reason. | Glossary §7.2 | 05 |
| REQ-026 | Stage progression and timers MUST be server-authoritative, survive pause and resume, and display correctly after reconnection. | Client clock changes do not alter deadlines. | INV-011 | 05 |
| REQ-027 | Workflow transitions MUST be evaluated at the trusted boundary against permissions, Gates, Stage, record version and Governing Release. | Direct API attempts to skip states or bypass roles fail. | INV-003 | 05, 09 |
| REQ-028 | Artifact drafting MUST provide autosave, conflict detection, recovery after reconnection and explicit submission; each submitted Artifact MUST reference the exact Form version used. | A stale write returns a conflict; a submitted Artifact can be re-rendered with its original Form. | INV-004 | 05 |
| REQ-029 | Every Message send MUST be checked against Communication Routes. | A send on a forbidden route is rejected and recorded. | DEC-10 | 05 |
| REQ-030 | Injects MUST follow the Inject lifecycle and support manual, scheduled, Stage-entry, Stage-exit and conditional release, cancellation, rescheduling and per-recipient acknowledgement and response tracking. | Each trigger type fires exactly once in a test Session. | DEC-64 | 05 |
| REQ-031 | Every State Value change MUST record previous value, new value, operation, source, actor and rationale, transactionally with its cause. | No State Value change exists without a matching source record. | Runtime §10 | 05 |
| REQ-032 | The operator console MUST show Session status, current Stage, timer, connected Participants, Seat occupancy, required submissions, active workflow tasks, pending Injects, adjudication queue, delivery failures, warnings and the event stream. | Console fields match authoritative state during a rehearsal. | Runtime §14 | 05 |
| REQ-033 | Recovery operations (reassign, reopen, correct recipients, release missed Injects, reprocess failed automation, extend deadlines, restore state, annotate) MUST NOT erase original history. | Every recovery action leaves the original record and a compensating record. | INV-004, INV-015 | 05 |
| REQ-034 | Every Control Intervention MUST record authority, reason, affected entities, previous and resulting state, simulation and wall-clock time, operator and category. | Interventions appear in research exports according to classification policy. | Runtime §21 | 05, 08 |
| REQ-004 | Only the designated Session Authority MAY commit adjudications and consequential state transitions; isolated devices MUST NOT finalize them. | A simulated partition never produces two accepted conflicting adjudications; retried commands stay idempotent. | DEC-18; ADR-001 | 05, 09 |
| REQ-035 | Mutating operations MUST be Commands with stable Command IDs, idempotent replay, optimistic concurrency where required, and the outcomes defined in DEC-37. A rejected Command MUST produce a rejected receipt and an Evidence Event. | Same ID and payload returns the original receipt; same ID and different payload is refused; a rejection is visible in evidence. | DEC-37, DEC-43 | 09 |

### 6.4 Adjudication and plugins

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-036 | Adjudication MUST support manual, rubric-assisted, rules-based, plugin-supported and hybrid models through one Adjudication Request and Adjudication Record contract, distinguishing human decisions, plugin proposals, overrides, approvals and failed executions. | A failed or timed-out plugin is never shown as an accepted outcome. | DEC-03; INV-008 | 05 |
| REQ-037 | Rules-based and rubric-assisted adjudication MUST produce an explanation trace; overriding a suggestion MUST require rationale. | Trace lists each condition evaluated and its result. | Runtime §11 | 05 |
| REQ-038 | Plugins MUST be approved, signed, pinned by digest and declare inputs, outputs, permissions, categories and connectivity; MUST run in the Extension Host outside the trusted Runtime; MUST receive only explicitly mapped, policy-filtered inputs; their outputs MUST be validated and staged as Effect Proposals, and a consequential effect MUST be committed only after explicit approval by an authorized person. | A plugin attempting direct state change is refused; an Effect Proposal leaves state unchanged until approved; plugin digest and execution metadata are recorded. | DEC-11, DEC-54; INV-020 | 02, 05, 10 |
| REQ-039 | Adjudication SHOULD support multiple reviewers by perspective with lead synthesis. | A multi-reviewer model produces one final Adjudication Record referencing each review. | Runtime §12 | 05 |
| REQ-040 | An Adjudication Record MUST remain a draft until published; publication may release narrative, reveal evidence, apply Effects, trigger Injects and unlock Stages. | Unpublished adjudications are invisible to Participants. | Runtime §13 | 05 |

### 6.5 Live change

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-007 | Release activation in a live Session MUST be attributable, impact-assessed, version-aware and non-retroactive; migrating in-flight workflows requires a governed policy. | Existing and new workflow instances are distinguishable by Governing Release; historical decisions keep their interpretation. | DEC-05; ADR-004; OPEN-008 | 05 |
| REQ-041 | Before activation, Studio MUST show affected existing workflows, affected new operations, incompatible queued offline commands and migration choices, with "keep existing workflows unchanged" as the default. | Activation without reviewing impact is impossible for consequential changes. | ADR-004 | 04 |
| REQ-042 | A Session MUST be reconstructable as initial Release plus accepted Release Activations plus recorded activity, without rewriting earlier records. | Reconstruction from evidence matches the live state at any Evidence Sequence. | INV-006 | 05, 06 |

### 6.6 Offline operation

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-003 | Plenum MUST keep operating on an institutional LAN when Internet access is lost, and MUST let individually disconnected Participants keep permitted offline work. | An Internet outage leaves the LAN Runtime working; an offline device stores permitted drafts and provisional Commands for controlled reconnection. | DEC-17 | 02, 05, 09 |
| REQ-008 | Offline client storage MUST minimize Participant-visible data and MUST define encryption, expiry, retention and revocation limits. | Offline bundles reveal no unauthorized role data in negative tests; loss and revocation behavior is documented and tested. | DEC-10; OPEN-014, OPEN-015 | 06, 09 |
| REQ-043 | Clients MUST distinguish "saved on this device", "synchronized", "validation required" and "published" (Studio) and `local_pending` from server outcomes (Runtime). | A queued command is never displayed as submitted. | DEC-37 | 04, 09 |
| REQ-044 | Reconnection MUST restore authoritative state; drafts MUST survive temporary disconnection; duplicate deliveries MUST NOT create duplicate effects. | Socket loss with duplicated and reordered deltas reconciles correctly. | ADR-010 | 09 |

### 6.7 Identity, access, tenancy and security

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-045 | Tenant identity MUST come only from authenticated server context; every tenant-owned record MUST be attributable to one Organization; cross-organization reads and writes MUST fail. | Hostile organization IDs in requests are ignored or refused under the real application database role. | ADR-015; INV-001 | 06 |
| REQ-046 | Authentication MUST support email and passwordless sign-in, institutional single sign-on (OIDC and SAML), multi-factor status and expiring Guest Identities; join codes MUST NOT grant access by themselves. | A code-only join is refused without identity verification and Seat eligibility. | ADR-006, ADR-012; OPEN-007 resolution | 02, 06 |
| REQ-047 | Authorization MUST combine role-based and attribute-based policy server-side; unauthorized information MUST NOT be sent to the client. | Hidden fields are absent from responses, not merely hidden in the UI. | INV-002 | 06, 09 |
| REQ-048 | Organization Roles and Session Roles MUST be separate; Session Roles are assigned only through Seats. | No Session Role exists as an Organization Membership. | DEC-61 | 03, 06 |
| REQ-049 | Participant reassignment MUST be transactional, preserve historical attribution, refresh access and warn operators about possible information exposure. | Reassignment closes the prior Seat Assignment and opens a new one atomically. | Platform §23.8 | 02, 05 |
| REQ-050 | Designers MUST be able to classify fields, forms, content, communications and exports; organization policy MAY forbid exporting or sending certain classifications to plugins. | A restricted field is excluded from a forbidden export and from plugin inputs. | OPEN-024 | 06 |
| REQ-051 | The platform MUST implement baseline security controls: input validation, output encoding, CSRF protection, secure token handling, rate limiting, upload type validation and malware scanning, encryption in transit and at rest, key lifecycle management, least-privilege service roles, secret rotation, dependency scanning and security event monitoring. | Each control has a test or operational check recorded before production. | Data §16 | 06 |
| REQ-052 | Administrative actions MUST produce Audit Records that ordinary Participants cannot read. | Participant credentials cannot read Audit Records. | Data §9 | 06 |

### 6.8 Evidence, reporting and research

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-006 | Authoritative Session evidence MUST be tamper-evident and independently verifiable under governed signing and anchor custody. | Modified or omitted event batches fail verification against separately retained signed Checkpoints. | DEC-20; ADR-003; OPEN-017 | 06 |
| REQ-053 | Every committed Session change and every rejected Command MUST produce an Evidence Event in the same transaction, with a strictly increasing per-Session Evidence Sequence. | No committed change lacks an Evidence Event; rollback leaves no sequence gap. | DEC-43; INV-015 | 06, 09 |
| REQ-054 | The platform MUST generate a Session archive, after-action report, team report, facilitator report and research dataset in CSV, JSON, JSONL, HTML and PDF; research deployments SHOULD also support Parquet and a portable research package. Every export MUST state Release, Session, generation time, export definition version, anonymization profile and included and excluded data classes. | Export metadata is present and matches source records. | Data §13, §14, §23 | 06 |
| REQ-055 | Every derived report element MUST trace to its source records. | Each report element links to the Evidence Events, Artifacts or Adjudication Records it came from. | Data §15 | 06 |
| REQ-056 | Observations, Derived Metrics, Analytical Notes and Findings MUST be stored and presented as distinct layers. | No derived value overwrites an Observation. | INV-016 | 06, 08 |
| REQ-057 | Measurement Definitions MUST be versioned contracts; historical outputs keep the version used. | Changing a metric creates a new version; old reports still cite the old one. | Data §21 | 06, 08 |
| REQ-058 | Research controls MUST include consent records, pseudonymous identifiers, separation of identity from behavioral data, field exclusion, anonymized exports, research-purpose labels and data-access approval. | An anonymized export contains no direct identifiers. | Data §11 | 06 |
| REQ-059 | Retention policies (period, legal hold, anonymization, deletion, archive, approval) MUST be configurable by organization, project, Artifact Type, channel, Session and export; corrections MUST preserve the original value. | A correction shows original value, corrected value, actor, reason and time. | Data §10, §19 | 06 |
| REQ-060 | Replaying a Session from the same Release, initial state, inputs, interventions, model versions and seed SHOULD reproduce the same history, except for documented nondeterministic integrations, and MUST produce a machine-readable divergence report when it does not. | A replay of the reference Session yields no unexplained divergence. | INV-013 | 05 |
| REQ-061 | Reports MUST label Captured History and Reconstructed Narrative distinctly. | No report presents reconstructed narrative as a transcript. | Runtime §17 | 06 |
| REQ-062 | Organizations MUST be able to export their own data in documented, portable formats. | A full organization export re-imports into a clean Deployment. | v0.6a reconciliation note | 06 |

### 6.9 Presentation and accessibility

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-063 | Participant interfaces MUST be composed from curated platform modules and layout templates, with configurable labels, navigation, Terminology Profiles and branding; Designers MUST NOT position arbitrary pixels. | Each Session Role and Stage resolves to an Interface Profile. | DEC-12 | 02, 04 |
| REQ-064 | Studio and Runtime MUST target WCAG 2.2 AA, including keyboard operation, screen-reader semantics, focus management, contrast, non-color status, captions, accessible form errors and adjustable timing. | Accessibility checks pass for every reference screen. | Data §17 | 04, 06 |

### 6.10 Deployment, operations and reliability

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-005 | Target deployment profiles SHALL include centrally hosted, institutionally self-hosted and air-gapped operation, with no mandatory external network dependency during air-gapped use. | An air-gapped installation, recovery and Session complete with no outbound requests. | DEC-19; ADR-013 | 02, 07 |
| REQ-065 | All profiles MUST run the same application build; external plugins unavailable in a profile MUST be disabled or replaced by a trusted local plugin. | Profile differences are configuration only. | ADR-013 | 02 |
| REQ-066 | Backup and restore MUST preserve Releases, objects, Evidence Sequence, Checkpoints and Anchors consistently, and restores MUST be rehearsed. | A restore drill verifies the checkpoint chain end to end. | ADR-003 | 06 |
| REQ-067 | Each Deployment's release configuration MUST state availability, RTO, RPO, latency and processing-delay targets, backup and restore-test frequency, and monitoring thresholds; security and recovery tests are acceptance gates. | Targets are recorded before a production Session. | OPEN-017, OPEN-019 | 06, 07 |
| REQ-068 | Operators MUST have a Session health view and a recovery path for failed or dead-lettered deliveries. | A forced delivery failure appears in the health view with a recovery action. | Platform §11, §21 | 05 |
| REQ-069 | Before a live Session, operators MUST complete a readiness check covering Release version, assignments, permissions, triggers, adjudication guidance, time controls, export path, fallback and recovery procedures, connectivity contingency and incident command. | A Session cannot move to `open` with an incomplete required check. | Roadmap §19 | 05, 07 |
| REQ-002 | The reference capacity scenario SHALL include 500 Participants in a Session and 10 concurrent Sessions, without implying a verified service level. | A load-test plan names actor mix, activity rate, environments and acceptance budgets. | DEC-16; OPEN-019 | 07 |

### 6.11 Contracts and compatibility

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-070 | API and event contracts MUST be versioned; breaking changes require a new version or explicit migration; Releases and historical Sessions keep their original contract references. | Contract tests verify every supported version. | OPEN-012 | 09 |
| REQ-071 | Every API field, event field, workflow state, database object and interface label MUST resolve to a Glossary term or an explicit Terminology Profile label. | A contract lint finds no unmapped terms. | DEC-25; Glossary rule 1 | All |

### 6.12 Polling and voting

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-072 | Designers MUST be able to define Polls of the types listed in 11 §1, with explicit thresholds, denominators, abstention treatment, quorum, weights, vetoes and tie rules; the platform MUST NOT apply an implicit default for any of them. | Publication rejects a Poll with an undefined denominator or tie rule. | DEC-46 | 03, 11 |
| REQ-073 | Ballots MUST be cast as `ballot.cast` Commands through the standard command endpoint, with eligibility decided server-side and one accepted Ballot per Seat Assignment unless revoting is configured. | A retried cast returns the original receipt; a second cast from the same Seat Assignment is rejected with `ALREADY_VOTED`. | DEC-48; INV-024 | 09, 11 |
| REQ-074 | A Poll MUST follow the Poll lifecycle; after opening it MUST NOT be edited, only voided and reissued. | Editing an open Poll is refused. | DEC-46; INV-023 | 05, 11 |
| REQ-075 | Tallies MUST be reproducible from the accepted Ballot set and pinned method version, and Certification MUST bind the result hash to that set; corrections MUST be new linked Certifications. | An independent recount yields the same counts and hash; two simultaneous certifications produce one current Certification. | DEC-46 | 11 |
| REQ-076 | Secret-ballot mode MUST store choices apart from voter identity and keep them out of shared streams, analytics, plugin inputs and research exports. | An unauthorized query or early result request reveals no choice or identity link. | INV-025; OPEN-028 | 06, 11 |
| REQ-077 | A certified result MAY start a workflow or change state only through an ordinary authorized Command. | The resulting change carries its own receipt and Evidence Event. | DEC-46 | 05, 11 |
| REQ-078 | Polls MUST run end to end on an institutional LAN with no Internet; a disconnected device MAY queue a Ballot but it is judged at server receipt time. | A Ballot queued offline and delivered after close is rejected with `DEADLINE_EXPIRED`. | DEC-17; INV-026 | 11, Sync |

### 6.13 Voice and radio

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-079 | The platform MUST support push-to-talk radio, open team rooms, private calls and one-to-many broadcast as designer-configured Voice Channels. | Each mode works in a test Session from a published Release. | DEC-47 | 03, 12 |
| REQ-080 | Voice access MUST be granted by the Runtime through short-lived Media Credentials scoped to Session, Voice Channel, permission and Participant, and revoked when Seat Assignment, Session Role or active Stage changes. | A Participant whose Session Role is revoked is removed or muted; an unauthorized credential request is denied. | ADR-017 | 05, 12 |
| REQ-081 | Push-to-talk MUST allow at most one Floor holder per channel, with server-side arbitration, bounded leases and recorded preemption by authorized holders only; floor requests MUST use the dedicated floor endpoints and MUST NOT be queued offline or replayed. | Simultaneous requests produce one valid lease; a stale token never grants the Floor. | DEC-48; INV-026 | 09, 12 |
| REQ-082 | Voice channel lifecycle, joins, moderation, recording and transcription changes MUST be Commands through the standard endpoint with Evidence Events. | Each change produces a receipt and an Evidence Event. | DEC-48 | 09, 12 |
| REQ-083 | Recording and transcription MUST be off by default; transcription MUST run only with the consent of every Participant transcribed and stop when consent is withdrawn. | Starting transcription without consent fails with `CONSENT_REQUIRED`. | DEC-50; INV-027; OPEN-027 | 06, 12 |
| REQ-084 | Voice MUST operate on an institutional LAN with zero public egress, using locally provisioned media and relay services; a disconnected device MUST show voice as unavailable. | VOICE-06 and VOICE-07 pass. | DEC-17, DEC-49 | 12 |
| REQ-085 | Voice controls MUST be keyboard operable with visible microphone state, and every essential instruction MUST have a non-audio path. | VOICE-11 passes. | REQ-064 | 06, 12 |

### 6.14 Extension framework

| ID | Requirement | Acceptance | Basis | Owner doc |
|---|---|---|---|---|
| REQ-086 | Only approved publishers MUST be able to submit Plugins; publisher approval, artifact approval, Organization installation, Release binding and per-run authorization MUST be separate steps. | An unauthorized publisher's submission is denied; an approved artifact is unusable until installed and bound. | DEC-52 | 10 |
| REQ-087 | Designers MUST be able to discover, configure, connect, test and bind approved Plugins and build Model Compositions in Studio without writing code. | A designer binds a Plugin and builds a two-node composition through Studio alone. | DEC-53, DEC-55 | 04, 10 |
| REQ-088 | Every consequential effect proposed by a Plugin or Model Composition MUST require an Approval Decision by an authorized person bound to the proposal hash, state version, Governing Release and Authority Epoch; a stale approval MUST fail with `STALE_PROPOSAL`. Designer-authored rules, scheduled Injects and automatic Stage transitions MUST NOT be subject to this step. | EXT-06, EXT-08, EXT-09 and EXT-20 pass. | DEC-54 | 05, 10 |
| REQ-089 | The Release compiler MUST reject Model Compositions with cycles, type or unit mismatches, missing inputs, classification leaks or effect paths without an approval gate. | EXT-14 passes. | DEC-55 | 03, 10 |
| REQ-090 | Plugins MUST declare connectivity; a Release with an `external_required` Plugin MUST NOT deploy to an air-gapped profile without a verified local replacement, and offline installation bundles MUST verify against an institution-provisioned trust root. | EXT-03 and EXT-05 pass. | DEC-56; OPEN-029 | 10 |
| REQ-091 | Plugin failures, timeouts, malformed outputs and revocations MUST fail visibly with no invented result and no state change. | EXT-11 and EXT-16 pass. | INV-008 | 05, 10 |
| REQ-092 | Plugins MAY propose simulated-actor choices and message drafts during a Session; these MUST take effect only after approval. | An actor-behavior Plugin's proposed message is not delivered until approved. | DEC-57 | 10 |
| REQ-093 | The provenance chain from triggering Command to committed state MUST be recorded for every consequential plugin effect, including rejections, failures and retries. | EXT-17 passes. | ADR-003 | 06, 10 |
| REQ-094 | The developer SDK MUST provide schema validators, a fixture runner, a contract-test harness, permission checks, host API stubs and signing tools. | A test Plugin is built, signed and contract-tested with the SDK alone. | DEC-58 | 10 |

## 7. Invariants

INV-001 to INV-010 replace the Foundation §5 invariants 1–10 in order. These hold in every deployment profile and every Release.

| ID | Invariant |
|---|---|
| INV-001 | Every mutation belongs to an Organization and a Simulation Project or Release context, and in the Runtime to a Session. |
| INV-002 | No Participant or operator obtains protected information because it is merely hidden in the interface; server-side Information Policy is authoritative. |
| INV-003 | A workflow transition is valid only if its preconditions, actor permissions, record version and Stage Gates pass at the trusted boundary. |
| INV-004 | Every persisted Artifact is attributable and versioned; committed history is never silently rewritten. |
| INV-005 | Publication produces a stable Release; a Session pins its initial Release and records every later Release Activation. |
| INV-006 | A live design change never retrospectively changes the meaning or outcome of a historical event. |
| INV-007 | Template reuse separates Core Design from Scenario content, credentials and Participant or Session data. |
| INV-008 | Adjudication records distinguish human decisions, plugin proposals, overrides, approvals and rejected or failed executions. |
| INV-009 | If a disabled Methodology Concept is referenced by an enabled workflow, Gate or interface, Publication fails with an actionable dependency error. |
| INV-010 | Incompatible live changes require an explicit migration plan; silent deletion or reinterpretation of live Session data is refused. |
| INV-011 | Simulation time is distinct from wall-clock time and is server-authoritative; device time is observational only. |
| INV-012 | Definition Revisions and Simulation Releases are immutable. |
| INV-013 | An active Session resolves to immutable configuration, rules, interface definitions, plugin and model versions, and random seeds where applicable. |
| INV-014 | State changes occur only through approved state-transition services. |
| INV-015 | Evidence Events are append-only; corrections are new compensating records. |
| INV-016 | Raw Observations are never overwritten by derived values, and interpretation is never presented as observed fact. |
| INV-017 | At most one Session Authority commits consequential changes for a Session at any time. |
| INV-018 | A disconnected device never finalizes adjudication, triggers an official Stage transition or establishes authoritative event order. |
| INV-019 | Each class of authoritative truth (simulation time, Release, Seat Assignment, access policy, decision status, adjudication status, State Values, capability availability, resource balances, measurement values) has exactly one owning subsystem; caches and client stores are projections. |
| INV-020 | Plugins never change Session state directly; a consequential effect they propose is committed only after explicit approval by an authorized person (DEC-54). |
| INV-021 | Every Artifact and Workflow Instance pins its Governing Release at creation. |
| INV-022 | No platform code path depends on a specific simulation, team, Session Role or Stage name. |
| INV-023 | Once a Poll is open its options, Electorate, secrecy mode, weights, deadline, tally method and quorum never change; a change requires voiding and reissuing the Poll. |
| INV-024 | No Ballot is accepted after the server-authoritative deadline unless a recorded grace policy in the Poll Definition allows it. |
| INV-025 | Secret-ballot choices are never linked to voter identity outside the restricted ballot store, and never appear in events, logs, analytics, plugin inputs or research exports. |
| INV-026 | A disconnected device never casts an authoritative Ballot, holds the Floor on a Voice Channel or issues an Approval Decision. |
| INV-027 | Voice is transcribed only while every Participant whose speech is transcribed has a current Consent Record. |
| INV-028 | A Release pins every Plugin and Platform Adapter by digest; nothing is fetched or substituted at run time. |

## 8. First vertical slice

### 8.1 Goal

Starting from a Studio Draft modeled on the essential Fractured Order structure, a non-programming Designer publishes a Release; an Operator starts a Session; a team Scribe authors a defined Artifact; a Facilitator reviews and forwards or returns it; White Cell accepts or returns it (DEC-42); the attributed history remains viewable across roles and exportable — without modifying Runtime source code (DEC-14, DEC-45).

### 8.2 In scope

One pilot Organization plus isolation checks; one Simulation Project and Release; configurable Team and Session Roles; one configurable Stage; one structured Artifact Type; the DEC-42 three-role workflow; role-scoped visibility; Studio form and workflow editing; Publication validation; role-specific Runtime interface; durable state; Evidence Events; basic export; deterministic test fixture; one authorized live-change demonstration.

### 8.3 Out of scope for the slice

Full Fractured Order parity; all Industry Turn Sheet variants; complex multi-recipient threads; realtime scale guarantees beyond fixtures; production PLI integration; unrestricted workflow authoring; commercial billing; institutional self-host installation; AI content generation.

### 8.4 Acceptance scenarios

| ID | Scenario |
|---|---|
| AC-01 Define | A non-programming Designer configures Teams, Session Roles, one Stage, an Artifact form and the review workflow in Studio; the model persists and validates without source edits. |
| AC-02 Publish | A valid model publishes to a uniquely identified immutable Release; invalid references, Gates or policies block Publication with targeted errors. |
| AC-03 Session | An authorized Operator starts a Session from the Release; unauthorized and cross-organization requests are denied. |
| AC-04 Handoff | A Scribe creates and submits an Artifact; it appears to the designated Facilitator and not to unauthorized roles; the Facilitator forwards it to White Cell or returns it to the Scribe. |
| AC-05 Review | White Cell accepts the Artifact or returns it to the Scribe, with Scribe and Facilitator notified; a returned Artifact travels Scribe → Facilitator → White Cell again. Direct API attempts to bypass authorization, Gates or intermediate states fail at the trusted boundary. |
| AC-06 Durability | Each actor reloads and sees permitted current state; author, version, status and history persist; the export agrees with canonical records. |
| AC-07 Revision | An authorized user changes a permitted live property, reviews the impact, activates a new Release, and the activation and its approver are recorded without changing historical actions. |
| AC-08 Failure | Invalid input, stale version, lost connection, double submission, unavailable plugin and denied visibility produce truthful states, recovery guidance and no false success. |
| AC-09 Reference fidelity | Every included Fractured Order behavior has a traceable baseline claim against the pinned reference (OPEN-003) and a parity test; known reference defects are not reproduced. |
| AC-10 Duplicate retry | The same Command submitted three times after a lost acknowledgement commits once and produces one Evidence Event. |
| AC-11 Queued reconnect | A submission queued offline is accepted, rejected or flagged for reconciliation on reconnect against current authorization and its Governing Release. |
| AC-12 Conflicting adjudication | Two competing adjudications on the same version yield exactly one accepted transition and one conflict. |
| AC-13 Rejection evidence | A rejected Command produces a rejected receipt and an Evidence Event (DEC-43). |

**Initial success metric.** One complete, reproducible Designer → Release → Session → Scribe → Facilitator → White Cell → evidence → export journey that passes the positive and negative checks above.

## 9. Delivery phasing

Delivery sequence, gates and evidence are owned by 07 Implementation Roadmap. Detailed design and spike code may run ahead of upstream approval when labeled non-authoritative (DEC-27). Capabilities in this PRD are targets; none is claimed as implemented until 07's acceptance evidence exists.

**First-release scope** includes live polling and voting (DEC-46), voice and radio (DEC-47) and the whole Extension Framework (DEC-58) in addition to the vertical slice in §8. The vertical slice itself is unchanged.

## 10. Open items affecting this PRD

All OPEN entries in Decision Register §7 have recorded resolutions as of 2026-11-08, including baseline-limited resolutions. DEC-21–27 and DEC-30–40 have been confirmed or superseded by the approved amendments DEC-62–64; DEC-51 is confirmed. Decision Register §3 retains specialist and release gates, and §7.5 identifies implementation/evidence work. Resolved decisions are not proof of delivery.

---

## Appendix A — Deferred: AI-assisted authoring

Moved here by DEC-41. Reviving any item requires a new product decision. Model-based adjudication through plugins is not affected, and DEC-57 allows plugins to propose simulated-actor choices and message drafts during a Session, subject to approval; neither is authoring assistance.

| Former item | Former location |
|---|---|
| AI-assisted design services in the integration layer | Platform §3.4 |
| Drafting teams and roles; converting guides into configuration; suggesting injects; proposing metrics; identifying missing decisions; detecting imbalance; drafting facilitator notes; explaining validation errors | Design Studio §19 |
| Guide-to-simulation drafting; AI-generated team and role proposals; inject suggestions; balance checks; automated facilitator-guide drafting | Roadmap Phase 6 |

## Appendix B — Reconstruction trace

Section numbers cited here refer to the superseded source documents (Foundation v0.2, PRD amendment v0.6a and architecture v1.1/v1.2), kept unchanged under `archive/` in the Project. In the requirement tables, a section number in the Basis column (for example "Platform §23.8") follows the same rule.

| PRD section | Sources |
|---|---|
| §1–3 | Foundation v0.2 §1, §4; project description |
| §6.1 | Foundation §6, §7; Design Studio §5–§25 and v1.2 amendment; v0.6a NEW-01 |
| §6.2 | Foundation §7; Design Studio §17, §23; Platform §6 |
| §6.3 | Runtime §2–§16, §21 and v1.2 amendment; API §3; v0.6a NEW-04 |
| §6.4 | Foundation §9; Platform §15; Runtime §11–§13; API §18 |
| §6.5 | Foundation §8, §16.3; v0.6a NEW-07; Studio v1.2 §C |
| §6.6 | v0.6a NEW-03, NEW-08; Platform §11; Studio v1.2 §B |
| §6.7 | Foundation §10; Platform §8, §23; Data §5–§9, §16 |
| §6.8 | Data §10–§15, §19–§23; Runtime §17, §23; v0.6a NEW-06 |
| §6.9 | Platform §14; Data §17 |
| §6.10 | Data §24 and v1.2 §D; Roadmap §19; v0.6a NEW-02, NEW-05 |
| §6.11 | API §8; Schema §24 |
| §7 | Foundation §5; Platform §19, §22; Runtime v1.2 §A |
| §8 | Foundation §11, §16.4; DEC-42, DEC-43 |
| §6.12 | Owner-supplied Live Polling and Voting specification v1.0; DEC-46, DEC-48 |
| §6.13 | Owner-supplied Voice and Radio specification v1.0; DEC-47 to DEC-51 |
| §6.14 | Owner-supplied Extension Framework specification v1.0; DEC-52 to DEC-60 |

## Change log

| Version | Date | Change |
|---|---|---|
| 0.7.0 | 2026-10-17 | Reconstructed. Incorporates v0.6a amendment as REQ-001 to REQ-008; adds REQ-009 to REQ-071 and INV-011 to INV-022; adopts Glossary terms; moves AI authoring to Appendix A. |
| 0.7.1 | 2026-10-17 | Appendix B: stated that cited section numbers refer to archived sources. |
| 0.7.2 | 2026-10-17 | Added §6.12 to §6.14 (REQ-072 to REQ-094) and INV-023 to INV-028 for polling and voting, voice and the Extension Framework; strengthened REQ-038 and INV-020 (DEC-54); stated first-release scope in §9; updated non-goals, governing decisions, domain summary and Appendix A note (DEC-57). |
| 0.7.3 | 2026-10-17 | Updated the open-item status note after the Product Owner resolved OPEN-003 by confirming the official Fractured Order golden reference. No requirement or acceptance criterion changed. |
| 0.7.4 | 2026-10-21 | Applied the OPEN-007 identity-profile resolution and DEC-61 Reviewer and Research Analyst Organization Roles; no requirement IDs changed. |
| 0.7.5 | 2026-11-01 | Applied resolved OPEN-013 to REQ-022: production two-person integrity, distinct-author approval and explicit sandbox-only self-approval; no requirement IDs changed. |
| 0.7.6 | 2026-11-08 | Aligned owner confirmation, DEC-64 and resolved decision status; retained implementation and release gates. |
