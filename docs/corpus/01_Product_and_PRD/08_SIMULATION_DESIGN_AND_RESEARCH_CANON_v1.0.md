# Plenum — Simulation Design and Research Canon

## Document control

| Field | Value |
|---|---|
| Document ID | CANON |
| Number | 08 |
| Version | 1.0.1 |
| Date | 2026-10-17 |
| Status | Draft — reconstructed (DEC-22, Assumed). Methodology substance requires Methodology Lead approval (OPEN-026). |
| Owner | Methodology Lead |
| Approvers | Methodology Lead; Product Owner (role placeholders — OPEN-001) |
| Reads from | 01 PRD; Decision Register; Glossary |
| Read by | 02 Platform; 03 Schema; 04 Studio; 05 Runtime; 06 Data, Security and Reporting |
| Authority | Defines the methodological concepts, design obligations, adjudication and control doctrine, and research and analytical rules that the platform must support. |

**Reconstruction note.** The original Canon was not available. This version gathers every methodological commitment stated elsewhere in the corpus into one place, so that each has a single owner. It does not invent SSG doctrine. Where the corpus only says that a methodology rule must exist, this document records the obligation and marks the content as owed by the Methodology Lead.

---

## 1. Purpose and scope

The Canon separates **what a simulation means** from **how the platform runs it**. It defines:

1. the Methodology Concepts a Core Design is built from, and how they depend on each other;
2. what a well-formed simulation design must contain before Publication;
3. doctrine for decisions, information, control and adjudication;
4. rules for research evidence, measurement and reproducibility;
5. the process for extracting methodology from the Fractured Order reference without encoding its defects.

Platform mechanisms live in 02–06 and 09. When a mechanism and this Canon disagree about meaning, this Canon governs and the conflict is raised through the Decision Register.

## 2. Methodology Concepts

DEC-01 requires that fundamental concepts are preserved and that individual concepts can be disabled under dependency rules. The classification below is a **proposal** pending OPEN-004.

### 2.1 Concept registry

| Concept | Purpose | Proposed activation | Depends on |
|---|---|---|---|
| Stage | Structures simulation time and progression (DEC-33). | Always enabled | — |
| Session Role | Assigns responsibility and capability. | Always enabled | — |
| Seat | Binds Participants to Session Roles. | Always enabled | Session Role |
| Artifact Type | Structured records Participants create. | Always enabled | Form; Workflow Definition |
| Workflow Definition | Lifecycle of Artifacts. | Always enabled | Session Role |
| Information Policy | Who may see what, and when (DEC-10). | Always enabled | Session Role |
| Evidence | Institutional record of activity (DEC-20). | Always enabled | — |
| Team | Groups Participants with shared objectives and resources. | Optional | Seat |
| Decision Record | Committed choices with traceability (§4). | Optional, enabled by default | Artifact Type |
| Inject | Designed release of information (DEC-34). | Optional | Information Policy |
| Communication | Channels and routes between actors. | Optional | Information Policy |
| State Variable | Quantified world state. | Optional | — |
| Capability | Instruments actors can use and lose. | Optional | State Variable or Resource |
| Resource | Consumable or allocatable assets. | Optional | — |
| Objective | Goals for teams, roles or the Session. | Optional | — |
| Adjudication Model | Resolution of Decision Records (§8). | Optional | Decision Record |
| Effect | Consequences applied by Outcomes or Injects. | Optional | State Variable, Capability, Resource or Inject |
| Control Intervention | Bounded operator action outside normal flow (§7). | Always enabled | Session Role |
| Research Question | Why the simulation exists analytically (§5). | Optional, required when research exports are enabled | — |
| Measurement Definition | Versioned metrics (§10.2). | Optional | Research Question |

### 2.2 Dependency rule

If an enabled element references a concept that is disabled, Publication fails with an actionable error (INV-009, REQ-012). Disabling a concept never deletes authored content; it is retained and ignored until re-enabled.

## 3. Design completeness

A Core Design is methodologically complete for Publication when, in addition to the structural checks in REQ-011:

1. every Session Role has at least one Seat and at least one Interface Profile;
2. every decision-bearing Artifact Type is linked in the traceability matrix (§5);
3. every Adjudication Model declares its doctrine type (§8.1) and output contract;
4. every Effect names its source and its target State Variable, Capability, Resource or Inject;
5. every uncertainty element declares the fields in §6.2;
6. every Control Intervention power available to a role declares its category (§7);
7. if research exports are enabled, every Measurement Definition is linked to a Research Question.

Owed by the Methodology Lead: any further SSG-specific completeness rules (OPEN-026).

## 4. Decision-centric design

A **Decision Record** is an Artifact of a decision-bearing type (DEC-35). An **Action** is one executable component of a Decision Record.

The Runtime must preserve, for every Decision Record:

| Element | Description |
|---|---|
| Trigger | What prompted the decision. |
| Owner | The Session Role and Participant accountable. |
| Co-authors and supporting roles | Others who contributed. |
| Information viewed | The information objects the authors had access to and opened. |
| Options considered | Where the form captures them. |
| Constraints | Stated limits that applied. |
| Confidence | Authors' stated confidence. |
| Timing | Draft start, submission and approval times in simulation and wall-clock time. |
| Actions | The executable components. |
| Adjudication | The Adjudication Records that resolved it. |
| Outcomes and Effects | What resulted. |
| Measures | Measurement values computed from it. |

The default decision lifecycle is in Glossary §7.4. Unresolved modeling questions — multiple Actions per decision, co-authorship rules, revision after submission, one adjudication over several Actions, delayed effects — are OPEN-018.

## 5. Research and decision architecture

Before scenario mechanics are published, a design must define its Research Questions or learning objectives and connect each critical decision to:

owner · trigger · information requirements · constraints · available Actions · Resources · intended and unintended Effects · adjudication method · affected State Variables · Measurement Definitions · analytical purpose.

Studio generates and validates this as the **decision traceability matrix** (REQ-019). The matrix is part of every Release and every research export.

## 6. Information and uncertainty design

### 6.1 Access versus delivery

Information **access** (a Participant is permitted to see something) and information **delivery** (it was actually sent to, opened by or acknowledged by them) are modeled and recorded separately. Analysis must never infer delivery from access.

### 6.2 Deliberate uncertainty

Designs may include information that is missing, delayed, contradictory, deceptive, ambiguous, low-confidence, overloaded, siloed, outdated or open to misinterpretation. Each uncertainty element must declare:

| Field | Meaning |
|---|---|
| Purpose | What the uncertainty is meant to test or teach. |
| Audience | Which roles or teams receive it. |
| Representation | How it appears to Participants. |
| Verification path | How a Participant could check it. |
| Reduction mechanism | What reduces the uncertainty (requests for information, Injects, Resources). |
| Analytical capture | What is recorded about how Participants handled it. |

## 7. Control doctrine

Control staff (for example White Cell in Fractured Order) may intervene outside normal Participant flow. Every Control Intervention is bounded, auditable and recorded (REQ-034) with one category:

| Category | Meaning |
|---|---|
| Scenario control | Normal management of pace, Injects and Stages. |
| Adjudication | Resolving decisions. |
| External-actor representation | Acting as an actor not played by Participants. |
| Technical recovery | Correcting a system or operational fault. |
| Exceptional override | Departing from designed rules; requires reason and is highlighted in research exports. |

Interventions appear in research exports according to classification policy. Previously viewed information cannot be withdrawn; reassignment across teams or clearances triggers an exposure warning (REQ-049).

## 8. Adjudication doctrine

### 8.1 Doctrine types

Each Adjudication Model declares one doctrine: structured argument, expert judgment, rules-based, model-supported, probability-based or hybrid. Platform mechanisms (manual, rubric-assisted, rules-based, plugin-supported) implement these doctrines (REQ-036).

### 8.2 Record contents

An Adjudication Record captures: applicable rules, evidence, assumptions, confidence, disagreement among reviewers, resolution, immediate Effects, delayed Effects, Participant-facing rationale, hidden analytical notes and precedents consulted.

### 8.3 Human authority

Model-based and rules-based results are proposals until accepted by an authorized human where the model requires approval. Overrides require rationale. A failed or invalid plugin result is never an outcome (INV-008).

### 8.4 Precedent

Earlier Adjudication Records may be consulted as precedent. Precedent is advisory unless the Release explicitly makes it binding.

### 8.5 Multi-perspective adjudication

Designs may assign separate reviewers by perspective (economic, diplomatic, information, operational feasibility, legal, escalation risk, political sustainability, or designer-defined), with a lead adjudicator synthesizing a final record.

## 9. Live change methodology

Live editing (DEC-05) must never change the meaning of what already happened (INV-006). Proposed change classes, pending Methodology Lead approval under ADR-004 and OPEN-008:

| Class | Examples | Default handling |
|---|---|---|
| Safe prospective | Labels, help text, non-sensitive presentation | May apply to new and existing views after activation |
| Compatibility-dependent | New optional form fields, added Inject, new Stage after the current one | Applies to new work; existing instances stay pinned |
| Consequential | Permissions, Information Policy, workflow graphs, Gates, Form constraints, Stage order, deadlines, adjudication configuration, Seat topology | Requires impact review, explicit approval and, for existing instances, a validated migration |

## 10. Research and analytical model

### 10.1 Four layers

| Layer | Contents | Rule |
|---|---|---|
| Observations | Decisions, Actions, communications, information views and deliveries, approvals, events, adjudications, state changes, interventions, participant reflections | Raw; never overwritten |
| Derived Metrics | Reproducible transformations such as decision latency, coordination density, resource efficiency, information-use rate, adaptation frequency, confidence calibration, objective attainment, capability degradation | Versioned; recomputable |
| Analytical Notes | Attributed analyst interpretation, alternative explanations, confidence, limitations | Never presented as observed fact |
| Findings | Claims linked to evidence, confidence, applicability, limitations, recommended action | Must cite supporting records |

### 10.2 Metric contract

Every Measurement Definition has: stable ID, version, Research Question, definition, formula, source fields, aggregation level, time window, missing-data behavior, interpretation, misinterpretation risk, validation method, visualization and export format. A revised metric is a new version; historical outputs keep the version used.

### 10.3 Comparative analysis

Comparisons must be possible by team, Participant, Session Role, Session, Release, intervention condition, capability package, decision sequence and time period. Each output identifies source Session, Release, source records, transformation version, metric version, analyst, timestamp, missing data and confidence.

### 10.4 Captured history and reconstructed narrative

Captured History is what the Runtime recorded. A Reconstructed Narrative is assembled afterwards from records and annotations. Reports label each and never present narrative as a transcript (REQ-061).

## 11. Reproducibility

### 11.1 Session Reproducibility Manifest

Every Session stores a manifest referencing immutable versions of: product configuration, Scenario, Session Roles, interface configuration, Inject Definitions, rules, State Variable definitions, Capability and Resource definitions, measurement framework, adjudication guidance, plugin and model versions, imported content and random seed. The manifest accompanies every research export and replay request.

### 11.2 Replay

Given the same Release, initial state, Participant decisions, information deliveries, Control Interventions, adjudications, model versions and seed, a replay should reproduce the same history, except for documented nondeterministic integrations. Differences produce a machine-readable divergence report (REQ-060).

## 12. Golden reference extraction

Fractured Order is the reference (DEC-14). Extraction follows these steps:

1. Pin a Fractured Order commit (OPEN-003).
2. Build an as-built behavioral inventory: role × capability × Artifact × state transition × visibility × evidence.
3. Classify every behavior using one of the categories below.
4. Obtain Methodology Lead review of ambiguous classifications.
5. Never encode classified defects as methodology.

| Category | Meaning | Lands in |
|---|---|---|
| METHODOLOGY-CORE | A general SSG rule | This Canon and 03 Schema |
| FO-CONFIGURATION | Fractured Order's specific choices (team names, roles, forms) | The Fractured Order Release |
| PLATFORM-SERVICE | Generic runtime or studio capability | 02, 05 |
| PLUGIN | Specialized capability such as PLI | A Plugin (DEC-11) |
| SCENARIO-CONTENT | Exercise text, briefs and media | A Scenario |
| PARITY-UI | Interface details kept only for familiarity | Interface Profiles |
| LEGACY-DEFECT | Bugs or technical debt | Defect register; not reproduced |

This table merges the Foundation's categories (methodology core, FO configuration, runtime design system, parity UI, legacy/defect) with the Roadmap's (platform service, configurable definition, optional plugin, simulation content, technical debt).

## 13. Open methodology questions

OPEN-004 (concept activation and dependencies), OPEN-005 (Stage structures), OPEN-006 (workflow expressiveness), OPEN-008 (in-flight migration and authority), OPEN-010 (form constraints), OPEN-018 (schema modeling questions), OPEN-026 (SSG doctrine content for this Canon).

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-10-17 | Reconstructed from Foundation §3, §5, §8; Studio §20–§22; Runtime §17, §19, §21–§23; Schema §24–§27 and v1.2 addendum; Data §20–§22; Roadmap §2. |
| 1.0.1 | 2026-10-17 | Stated that section numbers in the 1.0.0 entry refer to the archived source documents. |
