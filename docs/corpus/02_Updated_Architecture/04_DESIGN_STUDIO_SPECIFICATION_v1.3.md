# Plenum — Design Studio Specification

## Document control

| Field | Value |
|---|---|
| Document ID | SAS |
| Number | 04 |
| Version | 1.3.3 |
| Date | 2026-10-21 |
| Status | Draft for review. v1.2 amendment merged (DEC-26). |
| Owner | Product Owner |
| Approvers | Product Owner; Methodology Lead; Technical Lead (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 08 Canon; 03 Schema; Decision Register; Glossary |
| Read by | Studio frontend; validation engine; release compiler; 07 Roadmap |
| Authority | The no-code authoring model: workspaces, collaboration, validation, preview, review, Publication and live-change activation. |
| Supersedes | `04_DESIGN_STUDIO_SPECIFICATION_v1.2.md` |

---

## 1. Purpose

Studio is where Designers create and maintain a Simulation Project's Core Design and Scenarios (03). It makes sophisticated design possible without exposing code, JSON or database structures (REQ-009).

## 2. Design philosophy

Guided, constrained configuration rather than an unrestricted canvas (DEC-12):

- progressive disclosure;
- immediate preview;
- plain-language validation;
- reusable templates and safe defaults;
- server-enforced editing permissions;
- explicit Publication;
- no hidden runtime behavior.

## 3. Navigation

```text
Overview
Methodology
Research and Decisions
Teams
Session Roles and Seats
Stages
Activities
Forms and Artifacts
Workflows
Information Policy
Communications (Message Channels, routes, Voice Channels)
Polls
Injects
World State (State Variables, Capabilities, Resources)
Adjudication
Plugins and Model Compositions
Content Library
Interfaces
Access and Seats
Reports and Measurements
Test and Validate
Review and Publish
Live Changes
```

Navigation areas that belong to a disabled Methodology Concept are hidden, and their content is retained (08 Canon §2.2).

## 4. Collaboration

Real-time co-editing is first-release scope (DEC-15, REQ-001), using the Studio consistency domain in ADR-002.

### 4.1 Concurrent editing

- Multiple authenticated Designers edit the same Draft at once, with presence indicators and per-change attribution.
- Edit permissions are checked by the server for every update. Unauthorized or expired Authentication Sessions cannot synchronize or publish Draft content.
- Presence is ephemeral and never part of the Core Design.
- The Studio channel is an authenticated WebSocket (ADR-010).

### 4.2 Convergence is not validity

CRDT convergence guarantees that every Designer sees the same Draft; it does not guarantee a valid simulation. Studio continuously shows invalid references, duplicate semantic identifiers, policy contradictions and changes that will need review. Validation never blocks convergence; it blocks Publication.

### 4.3 Offline authoring

Studio distinguishes four save states (REQ-043):

| State | Meaning |
|---|---|
| Saved on this device | Stored locally; not yet received by the server |
| Synchronized | Received and merged on the server |
| Validation required | Merged, but the Draft has errors or unreviewed changes |
| Published | Frozen into a Definition Revision and Release |

Local writes are never presented as server commits. Studio shows a count of unsynchronized changes, retries automatically, and stops synchronizing if access is revoked. Concurrent offline edits to metadata that cannot be merged automatically (for example, two different titles) are presented for explicit resolution. Local Draft caches are protected according to the device security profile (OPEN-014).

### 4.4 Later collaboration features

Comments, suggested changes, section ownership, review requests and visual change comparison follow in Phase 5 of 07 Roadmap.

## 5. Overview workspace

Captures name, summary, purpose, learning objectives, audience, estimated duration, delivery modes, tags, branding, Terminology Profile, owner and collaborators. Shows a readiness summary and unresolved critical issues.

## 6. Methodology workspace

Lists Methodology Concepts (08 Canon §2) with an on/off control each. Disabling a concept referenced by enabled elements shows the dependent elements before confirming, and Publication is blocked until the conflict is resolved (REQ-012, INV-009).

## 7. Teams

**Team list.** Cards with name and short code, color and icon, Seat count, number of Session Roles, number of objectives, and missing-configuration warnings.

**Team editor tabs.** Identity · Briefing · Objectives · Resources · Relationships · Seats · Available actions · Content access.

**Relationships.** A matrix for simple cases and a graph for advanced design. Kinds: trust, alliance, rivalry, trade exposure, communication access, formal authority, dependency, custom.

## 8. Session Roles and Seats

### 8.1 Session Role editor

Name, description, eligible Teams, Interface Profiles, Stage restrictions, information clearance, whether the role is a control role, and capabilities (03 §7).

### 8.2 Capability groups

Capabilities are shown in plain-language groups:

| Group | Capabilities |
|---|---|
| Participation | View briefing; view objectives; view team resources; draft artifacts; edit team drafts; submit artifacts |
| Communication | Send messages; send proposals; respond to proposals; submit requests; publish statements |
| Review and adjudication | Review, forward, return and accept artifacts; score criteria; apply effects; approve outcomes; publish outcomes |
| Control | Control timer; advance Stage; release Injects; reassign Participants; override workflows; record interventions; export data |

Organization Roles are not configured here; they are managed in organization administration (DEC-61).

### 8.3 Preview as role

Designers can preview the exact interface and content available to any Session Role in any Stage (REQ-010). The preview uses the same projection logic as the Runtime.

## 9. Stages

- **Default view:** a linear timeline. Each Stage card shows name, Stage Type, duration, required Activities, required submissions, entry and exit Gates, and next Stage.
- **Advanced view:** a node-and-edge graph for branching and grouped structures (DEC-33). Stage Groups appear as containers (for example a move containing phases).
- **Stage editor sections:** identity and instructions · timer · visible modules · allowed Activities · required Artifacts · entry Gate · completion Gate · transitions · automatic actions · operator controls.

**Transition rule builder.** Rules read as sentences, and Studio shows the generated plain-language interpretation of each:

```text
WHEN [all required teams] [have submitted] [Action plan]
THEN [notify] [White Cell]
AND [unlock] [Adjudication]
```

The Studio may build acyclic sequential and nested Stages, priority-ordered conditional transitions, and bounded parallel forks with an explicit `all` or `first` join. It must reject loops, continuously timed structures, and parallel branches containing participant work, positive-duration timers, nested forks, completion requirements, or manual transitions.

## 10. Forms and Artifacts

### 10.1 Artifact Type wizard

1. Name the Artifact Type.
2. Choose ownership: individual, team or session.
3. Mark whether it is decision-bearing (DEC-35).
4. Select or create a Form.
5. Select a workflow template or a custom workflow.
6. Set creator Session Roles and recipients.
7. Choose the Information Policy, retention and export behavior.

### 10.2 Form canvas

Sections and fields with drag-and-drop ordering. Field settings: label, key, type, help text, required, default, validation, conditional visibility, editability, data classification, reporting label. Conditional logic reads as a sentence, for example:

```text
Show "Legislative Sponsor" when "Instrument Type" equals "Legislation".
```

Supported field types and limits follow OPEN-010.

### 10.3 Form preview

Desktop, tablet, mobile, role-specific, read-only review, and completed-artifact modes.

## 11. Workflows

### 11.1 Templates and advanced editor

Designers start from SSG workflow templates (DEC-08) or build a custom workflow in the advanced editor. Both produce the Workflow Definition in 03 §10.

### 11.2 State and transition settings

State: label, kind (draft, task, review, approval, wait, terminal, cancelled), holder Session Roles or "creator", assignment rule, due period, quorum. Transition: from state, command, to state, permitted Session Roles, Gate, notifications, automation, content-only flag.

### 11.3 Workflow validation

Studio detects: no initial state; no terminal state; unreachable states; states with no way out; unassigned task states; conflicting transitions; approvals with no eligible approver; permitted roles that lack the matching capability.

## 12. Information Policy

A matrix of records and fields against Session Roles, Teams and Seats, with release timing (immediate, at Stage, after a delay, on a Gate, manual). Every cell starts as denied (DEC-10). The leakage check reports any route by which restricted information could reach an unintended role — through communications, Injects, reports or interface modules (REQ-016).

## 13. Communications

**Communication matrix.** Senders as rows, recipients as columns; each cell lists permitted Message Channels.

**Message Channel editor.** Type; structured or free text; attachments; threading; approval requirement; retention and export; active Stages.

**Voice Channels.** Configured in §26.

## 14. Injects

**Library.** Title, recipients, release mode, trigger, Stage, lifecycle state, dependencies.

**Editor.** Content · media · sender · recipients · release logic · required response · world-state effects · follow-on Injects · control notes.

**Timeline view.** Inject density, pacing, dependencies and contingency branches across Stages.

## 15. World State

**State Variables.** Name, scope, type, initial value (Scenario), range, unit, Information Policy, edit rights, history mode, and display (number, progress bar, gauge, trend, status label, hidden).

**Capabilities and Resources.** States, readiness, activation Gates, degradation, recovery, costs, allocation and replenishment, ownership and visibility (08 Canon §2). Changes are always expressed as transactions and effects, never direct edits.

**Effect mapping.** Actions, Injects and Outcomes can change State Values; every effect shows its source.

## 16. Adjudication

| Setting | Options |
|---|---|
| Doctrine | Structured argument, expert judgment, rules-based, model-supported, probability-based, hybrid (08 Canon §8.1) |
| Mechanism | Manual, rubric-assisted, rules-based, plugin, hybrid |
| Rubric | Criteria with weight, scale, anchors, required evidence, eligible reviewers |
| Rules | Constrained sentence builder, never free code |
| Plugin | Approved Plugin Binding or Model Composition (§27), input mappings with classification ceilings, timeout, approving Session Roles. Approval of consequential effects is always on and cannot be switched off (DEC-54) |
| Perspectives | Optional reviewers by perspective with a lead synthesizer |
| Output | Outcome category, narrative rationale, confidence, revealed information, State effects, follow-on Injects, publication recipients |
| Precedent | None, advisory or binding |

## 17. Content Library

Rich text, documents, images, audio, video, links and datasets. Each item has an Information Policy and release rules, and supports team and control variants, version history, search, tags and reuse across projects in the same Organization.

## 18. Interfaces

Designers choose modules and layout templates (single column, main with sidebar, dashboard grid, workspace with tabs); they never position pixels. Module settings: title, data source, role and Stage visibility, read or write mode, empty-state text, help text, ordering. Responsive behavior comes from the platform design system; Designers do not configure breakpoints.

## 19. Research and Decisions

Before scenario mechanics can be published, the Designer defines Research Questions or learning objectives and fills in the decision traceability matrix for every decision-bearing Artifact Type (08 Canon §5, REQ-019). Studio validates completeness and exports the matrix with the Release.

## 20. Information and uncertainty

Designers can deliberately introduce missing, delayed, contradictory, deceptive, ambiguous, low-confidence, overloaded, siloed, outdated or misleading information. Each element records purpose, audience, representation, verification path, reduction mechanism and analytical capture (08 Canon §6).

## 21. Access and Seats

### 21.1 Join policy

Permitted methods: invitation only; session code plus verified email; institutional SSO; session code plus guest PIN; waiting-room admission; open seat selection; operator assignment only. The editor warns that a session code identifies a Session but never grants access by itself.

### 21.2 Seat planner

Shows each Team's Seat structure with minimum and maximum occupancy, required Seats, join mode, eligibility rules and fallback behavior, and previews how rosters map onto Seats.

### 21.3 Roster import

CSV import with validation of name, email or external identifier, Team, Session Role, Seat, participant type and invitation status. Invalid or ambiguous rows go to a review queue; they are never silently accepted.

### 21.4 Lobby and readiness

Designers choose onboarding steps, mark which block entry, set role-specific readiness requirements, and preview the Participant lobby and operator readiness dashboard.

### 21.5 Guests, displays and reassignment

- Guests: whether allowed, required identifying information, expiry, inclusion in research exports, per-guest operator approval.
- Shared displays: read-only team, plenary or observer displays, chosen by Interface Profile and classification ceiling; consequential capabilities cannot be assigned to a display.
- Reassignment: who may reassign, whether cross-team reassignment is allowed, whether approval is required, and the exposure warnings shown.

### 21.6 Access preview

Test mode previews: an invited Participant; a session-code Participant; a Guest; a waiting-room Participant; a team lead and a general team member; a multi-role operator; a shared display; and a reassigned Participant before and after the change.

## 22. Test and Validate

### 22.1 Automated checks

Structural completeness; broken references; disabled-concept dependencies; capability and permission conflicts; unreachable Stages; workflow defects (§11.3); missing approvers; invalid expressions and Fact References; hidden required content; empty role interfaces; Inject trigger conflicts; missing report data; Information Policy leakage; incomplete traceability matrix; accessibility issues; Poll definitions with undefined denominators or tie rules; Voice Channels unsupported by the installed Media Provider Adapter; Model Composition defects (cycles, type or unit mismatch, missing approval gates); external-service Plugins in an air-gapped target. Messages are in plain language and link to the element to fix (REQ-011).

### 22.2 Rehearsal and walkthrough

- Role walkthrough: step through the simulation as each Session Role in each Stage.
- Synthetic rehearsal: a test Session driven by simulated Participants or scripted actions, deterministic when repeated (REQ-020).
- Plugin test runs: run a bound Plugin or Model Composition against fixture inputs and see staged Effect Proposals without changing any state (10 §9).
- Extended preview: timeline, trigger simulation, state-transition preview, information-visibility preview, measurement preview, and a report explaining why each trigger did or did not fire and which rules, data and permissions were evaluated.

## 23. Review and Publish

Lifecycle (DEC-39): Draft → Validated → In Review → Approved → Published → Superseded → Archived.

| Requirement | Detail |
|---|---|
| Freeze | Publication freezes an exact materialization of the merged Draft; edits arriving after the freeze belong to the next Draft version (ADR-002). |
| Validation | No errors. Warnings must be acknowledged. |
| Version | Semantic version and release notes. |
| Approval | Approver identity; organization policy may require an approver other than the author (OPEN-013). |
| Test session | Optional by default; organization policy may require a passed test session (DEC-39). |
| Reviews | Data-classification review, retention-policy selection, accessibility review status (06 §21). |
| Output | Immutable Definition Revision; immutable Simulation Release with content digest, compiler version and validation report (REQ-021). |

Changes to an upstream element show affected downstream elements and historical compatibility.

## 24. Live Changes

Designers prepare a new Release for a running Session and review its impact before an Operator activates it (REQ-007, REQ-041, ADR-004).

The activation screen shows:

- the change class of each change (08 Canon §9);
- existing workflow instances affected;
- new operations affected;
- queued offline Commands that would become incompatible;
- migration choices for consequential changes;
- the default choice: **Keep existing workflows unchanged**.

Activation also lists Polls, Voice Channels and Plugin Bindings that would change; an open Poll is never changed (INV-023) and in-flight Composition Runs stay pinned (10 §15).

Activation is an audited Command (`release.activate`). Safe prospective changes apply after activation; consequential changes require explicit approval; existing workflow instances stay pinned unless a validated migration is approved.

## 25. Polls

Owned by 11 Live Polling and Voting (DEC-46).

**Poll editor.** Question and options; poll type and selection limits; scope (Session, Team, Stage); Electorate as an Information Policy selector with live preview of eligible Seats; secrecy mode with a plain-language explanation of secret ballot versus anonymous survey; threshold, denominator and abstention rules, written out as a sentence the designer confirms ("Passes if yes votes exceed half of valid votes; abstentions are not counted"); quorum; weights and vetoes by Seat; tie rule; open and close triggers; grace period (default none); result visibility; who certifies; optional workflow on certification; retention.

Studio refuses to publish a Poll whose counting rules are incomplete (REQ-072). A Voting Method Adapter is chosen from the installed catalog (DEC-59).

## 26. Voice Channels

Owned by 12 Voice and Radio (DEC-47).

**Voice Channel editor.** Name; mode (push-to-talk radio, open room, private call, broadcast); capacity; active Stages; who may listen, transmit, moderate and invite, each as an Information Policy selector; for radio, floor lease length, queue policy, preemption, maximum transmission and cooldown; priority by Session Role; recording (`off`, `on`, `with_consent`) and transcription (`off`, `with_consent`, DEC-50); retention.

**Voice matrix.** Session Roles and Teams against Voice Channels, showing listen, transmit and moderate rights, so the designer can check information asymmetry across voice as well as messages (REQ-016).

Studio checks the channel set against the Media Provider Adapter installed for each target profile and reports unsupported modes before publication.

## 27. Plugins and Model Compositions

Owned by 10 Extension Framework (DEC-52 to DEC-60). Designers never write plugin code (DEC-53).

**Plugin catalog.** Approved Plugins installed for the Organization, filtered by category (DEC-60), connectivity and data classification. Each entry shows publisher, version, digest, capabilities, requested permissions, input and output schemas, resource limits and which deployment profiles it can run in.

**Plugin Binding inspector.** Non-secret configuration; input mappings from Fact References with classification ceilings; timeout; enabled profiles; for `external_required` Plugins, the local replacement used in air-gapped profiles.

**Model Composition builder.** A canvas of typed nodes (model, transform, fan-out, join, approval gate, output) and edges from output ports to input ports. Studio shows types and units on every edge, rejects incompatible connections as they are drawn, and requires an approval gate on every path that carries Effect Proposals (DEC-54, DEC-55). Cycles cannot be drawn.

**Test run.** Run a binding or composition on fixture inputs and inspect each node's output and the staged Effect Proposals (§22.2).

## Change log

| Version | Date | Change |
|---|---|---|
| 1.3.0 | 2026-10-17 | Merged v1.2 amendment; made real-time collaboration first-release scope (DEC-15); added Methodology, Research and Decisions and Live Changes navigation areas; replaced phases with Stages (DEC-33); separated Session Roles from Organization Roles (DEC-44); adopted the Publication lifecycle (DEC-39); removed AI assistance (DEC-41, PRD Appendix A); renumbered sections. |
| 1.3.1 | 2026-10-17 | Replaced "Workspaces" with "Navigation areas" in §3 to avoid confusion with the removed Workspace level (DEC-36). |
| 1.3.2 | 2026-10-17 | Added §25 Polls, §26 Voice Channels and §27 Plugins and Model Compositions; renamed Channel editor to Message Channel editor (DEC-51); plugin approval always on (DEC-54); new validation checks, test runs and live-change notes. |
| 1.3.3 | 2026-10-21 | Repointed Organization Role governance from superseded DEC-44 to DEC-61. |
| 1.2.0 | 2026-10-17 | Alignment amendment (archived). |
