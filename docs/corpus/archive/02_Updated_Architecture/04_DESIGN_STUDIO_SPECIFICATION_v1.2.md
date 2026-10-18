# Plenum No-Code Design Studio Specification

## Document Control

- **Document ID:** SAS
- **Version:** 1.2.0 (controlled alignment draft; retains v1.1 body)
- **Status:** Draft for review
- **Owner:** Plenum product owner
- **Approvers:** Product owner; simulation-methodology lead; technical lead
- **Reads from:** PRD; Simulation Design and Research Canon; Canonical Schema
- **Read by:** Frontend implementation; scenario-validation contracts; publishing workflow
- **Authority:** Defines the no-code authoring model, lifecycle, validation, preview, review, publication, and collaboration behavior.
- **Out of scope:** Decisions explicitly governed by another document in the specification hierarchy.

## 1. Purpose

The Design Studio is the frontend environment through which simulation designers create and manage the Canonical Simulation Definition. It must make sophisticated simulation design possible without exposing raw code or database structures.

## 2. Design Philosophy

The Studio should use guided, constrained configuration rather than a completely unrestricted visual editor.

Key principles:

- Progressive disclosure
- Immediate preview
- Plain-language validation
- Reusable templates
- Safe defaults
- Role-based editing permissions
- Explicit publishing
- No hidden runtime behavior

## 3. Primary Navigation

```text
Overview
Objectives
Teams and Actors
Roles and Seats
Flow and Phases
Activities
Forms and Artifacts
Workflows
Communications
Injects
World State
Adjudication
Content Library
Interfaces
Reports
Test and Validate
Publish
```

## 4. Simulation Overview Workspace

The overview captures:

- Name
- Summary
- Purpose
- Learning objectives
- Research questions
- Audience
- Estimated duration
- Delivery mode
- Tags
- Branding
- Terminology
- Ownership and collaborators

The page should display a readiness summary and unresolved critical issues.

## 5. Team and Actor Builder

### 5.1 Team list

Display teams as cards with:

- Name and short code
- Color and icon
- Seat count
- Number of roles
- Number of objectives
- Missing-configuration warnings

### 5.2 Team editor

Tabs:

- Identity
- Briefing
- Objectives
- Resources
- Relationships
- Roles and seats
- Available actions
- Content access

### 5.3 Relationship editor

Use a matrix for simple permissions and a graph for advanced relationship design.

Relationships may include:

- Trust
- Alliance
- Rivalry
- Trade exposure
- Communication access
- Formal authority
- Dependency

## 6. Role and Permission Builder

### 6.1 Role definition

The designer specifies:

- Role name
- Description
- Scope
- Eligible teams
- Seat assignment
- Interface profile
- Content visibility tags

### 6.2 Permission categories

Group permissions into understandable categories:

**Participation**
- View briefing
- View objectives
- View team resources
- Draft artifacts
- Edit team drafts
- Submit artifacts

**Communication**
- Send messages
- Send proposals
- Respond to proposals
- Submit requests
- Publish statements

**Review and adjudication**
- Review artifacts
- Score criteria
- Apply effects
- Approve outcomes
- Release outcomes

**Operations**
- Control timer
- Advance phase
- Release injects
- Reassign participants
- Override workflows
- Export data

### 6.3 Preview-as-role

The Studio must let designers preview the exact interface and content available to any role in any phase.

## 7. Flow and Phase Builder

### 7.1 Default view

Use a linear timeline for ordinary simulations.

Each phase card shows:

- Name
- Type
- Duration
- Required activities
- Required submissions
- Entry and exit rules
- Next phase

### 7.2 Advanced view

Use a node-and-edge graph for branching simulations.

### 7.3 Phase editor

Sections:

- Identity and instructions
- Timer
- Visible modules
- Allowed activities
- Required artifacts
- Entry conditions
- Completion conditions
- Transitions
- Automatic actions
- Operator controls

### 7.4 Transition rule builder

A rule should read like a sentence:

```text
WHEN [all required teams] [have submitted] [Action]
THEN [notify] [White Cell]
AND [unlock] [Adjudication]
```

The interface should show the generated plain-language interpretation of every rule.

## 8. Form and Artifact Builder

### 8.1 Artifact creation wizard

1. Name the artifact.
2. Choose ownership.
3. Select or create a form.
4. Select a workflow.
5. Set creator and recipient permissions.
6. Configure visibility and export behavior.

### 8.2 Form canvas

The canvas supports sections and fields. Drag-and-drop is appropriate here because field ordering is bounded and predictable.

### 8.3 Field settings

- Label
- Key
- Type
- Help text
- Required status
- Default value
- Validation
- Conditional visibility
- Editability
- Data classification
- Reporting label

### 8.4 Conditional logic

Designers create rules such as:

```text
Show "Legislative Sponsor" when "Instrument Type" equals "Legislation".
```

### 8.5 Form preview

Preview modes:

- Desktop
- Tablet
- Mobile
- Role-specific
- Read-only review
- Completed artifact

## 9. Workflow Builder

### 9.1 Node types

- Draft
- Human task
- Review
- Approval
- Automated action
- Wait
- Publish
- Complete
- Cancel

### 9.2 Configuration

Each node includes:

- Assignee rule
- Allowed actions
- Due period
- Required fields
- Notifications
- Escalation
- Completion criteria

### 9.3 Validation

The Studio must detect:

- No start node
- No completion node
- Unreachable nodes
- Circular loops without exit
- Unassigned tasks
- Conflicting transitions
- Approval steps with no eligible approver

## 10. Communication Builder

### 10.1 Communication matrix

Rows represent senders and columns represent recipients. Each cell controls permitted channels.

### 10.2 Channel editor

- Channel type
- Structured or free text
- Attachment support
- Threading
- Approval requirement
- Retention and export
- Active phases

### 10.3 Information leakage check

The validator should identify routes that allow restricted information to reach unintended roles.

## 11. Inject Builder

### 11.1 Inject library

Display:

- Title
- Recipients
- Release mode
- Trigger
- Phase
- Status
- Dependencies

### 11.2 Inject editor

Sections:

- Content
- Media
- Sender
- Recipients
- Release logic
- Required response
- World-state effects
- Follow-on injects
- Facilitator notes

### 11.3 Timeline view

The timeline should display inject density, pacing, dependencies, and contingency branches.

## 12. World-State Builder

### 12.1 Variable creation

- Name
- Scope
- Type
- Initial value
- Range
- Unit
- Visibility
- Edit rights

### 12.2 Dashboard configuration

Designers select how variables appear:

- Number
- Progress bar
- Gauge
- Trend
- Status label
- Hidden operator-only value

### 12.3 Effect mapping

Actions, injects, and adjudications can change variables. Every effect must show its source.

## 13. Adjudication Builder

### 13.1 Mode selection

- Manual
- Rubric-assisted
- Rules-based
- Plugin

### 13.2 Rubric editor

For each criterion:

- Name
- Description
- Weight
- Scale
- Anchor descriptions
- Required evidence
- Eligible reviewers

### 13.3 Rules editor

Rules use a constrained sentence builder rather than arbitrary code.

### 13.4 Output configuration

- Outcome category
- Narrative rationale
- Confidence
- Revealed information
- Variable effects
- Follow-on injects
- Publication recipients

## 14. Content Library

Content types:

- Rich text
- Documents
- Images
- Audio
- Video
- Links
- Datasets

Each item includes visibility and release rules.

Content should support:

- Team-specific variants
- Facilitator variants
- Version history
- Search and tagging
- Reuse across simulations

## 15. Interface Composer

### 15.1 Constraint model

The designer chooses modules and layout templates. The designer does not position arbitrary pixels.

### 15.2 Layout templates

- Single column
- Main content with sidebar
- Dashboard grid
- Workspace with tabs

### 15.3 Module configuration

Each module supports:

- Title override
- Data source
- Role and phase visibility
- Read/write mode
- Empty-state text
- Help text
- Ordering

### 15.4 Responsive behavior

The platform design system determines responsive behavior. Designers should not manually configure breakpoints in the MVP.

## 16. Test and Validate Workspace

### 16.1 Automated checks

- Structural completeness
- Broken references
- Permission conflicts
- Unreachable phases
- Workflow dead ends
- Missing approvers
- Invalid formulas
- Hidden required content
- Empty role interfaces
- Inject trigger conflicts
- Missing report data
- Accessibility issues

### 16.2 Synthetic rehearsal

The system should support a test session using simulated participants or scripted actions.

### 16.3 Role walkthrough

Designers can step through the simulation as each role and phase.

## 17. Publishing Workflow

```text
Draft → Validate → Review → Test Session → Approve → Publish
```

Publishing requirements:

- No critical validation errors
- Version number
- Release notes
- Approver identity
- Snapshot of all referenced content and assets
- Immutable package checksum

## 18. Collaboration

Post-MVP collaboration features:

- Comments
- Suggested changes
- Section ownership
- Review requests
- Approval workflows
- Change comparison
- Conflict resolution

## 19. AI Assistance

AI may assist with:

- Drafting teams and roles
- Converting existing guides into configuration
- Suggesting injects
- Proposing metrics
- Identifying missing decisions
- Detecting imbalance
- Drafting facilitator notes
- Explaining validation errors

AI-generated changes must remain drafts until explicitly accepted.

## 20. Research and Decision Architecture Workspace

Before scenario mechanics are published, the designer must define research or learning questions and connect each critical decision to its owner, trigger, information requirements, constraints, available actions, resources, intended and unintended effects, adjudication method, affected state variables, measures, and analytical purpose. The interface must generate and validate a decision traceability matrix.

## 21. Information and Uncertainty Designer

The authoring environment must support deliberate missing, delayed, contradictory, deceptive, ambiguous, low-confidence, overloaded, siloed, outdated, and misinterpreted information. Each uncertainty element must specify its purpose, audience, representation, verification path, reduction mechanism, and analytical capture. Information access and actual delivery must be modeled separately.

## 22. Capability and Resource Builder

Designers must be able to define capabilities, resources, availability states, readiness, allocation rules, activation conditions, degradation, recovery, exhaustion, replenishment, ownership, visibility, costs, and effects. Resource consumption and capability changes must be expressed through canonical transactions and state transitions rather than direct field mutation.

## 23. Formal Review and Change Control

The scenario lifecycle is: Draft → Internal Review → Validation Failed or Validation Passed → Approved → Published → Superseded → Archived. Transition authority, required fields, validation evidence, side effects, publication controls, and immutability rules must be configurable by organization policy. Any upstream design change must identify affected downstream contracts and historical compatibility.

## 24. Extended Preview and Test Mode

Preview must include role-based interface preview, timeline preview, trigger simulation, state-transition preview, information-visibility preview, measurement preview, dry run, deterministic synthetic rehearsal, and a validation report. The designer must be able to inspect why an event did or did not trigger and which rules, data, and permissions were evaluated.


## 25. Participant Access and Seat Configuration Workspace

The Design Studio must provide a dedicated workspace for configuring how people enter and occupy a simulation run.

### 25.1 Join policy editor

Designers configure permitted methods:

- Invitation only.
- Session code plus verified email.
- Institutional SSO.
- Session code plus guest PIN.
- Waiting-room admission.
- Open seat selection.
- Operator assignment only.

The editor must warn that a session code identifies a run but is not sufficient authorization by itself.

### 25.2 Seat planner

The seat planner displays each team’s role structure, minimum occupancy, maximum occupancy, required seats, join mode, eligibility rules, and fallback behavior. Designers can preview how rosters and unassigned participants will map into seats.

### 25.3 Roster import

The workspace must support CSV roster import with validation for:

- Name.
- Email or external identifier.
- Team.
- Role.
- Seat.
- Participant type.
- Invitation status.

Invalid or ambiguous mappings enter a review queue rather than being silently accepted.

### 25.4 Lobby and readiness designer

Designers choose required onboarding steps and determine which are blocking. The interface must support role-specific readiness requirements and preview the participant lobby and operator readiness dashboard.

### 25.5 Guest access configuration

Designers configure whether guests are allowed, what identifying information is required, guest expiry, whether guest activity may be used in research exports, and whether operators must approve each guest.

### 25.6 Shared display configuration

Designers can create read-only team, plenary, and observer displays by selecting an interface profile and information-classification ceiling. The UI must prevent the assignment of consequential permissions to a display profile.

### 25.7 Reassignment policy

Designers configure who may reassign participants, whether cross-team reassignment is permitted, whether approval is required, and what warnings or acknowledgements appear when information exposure may occur.

### 25.8 Access simulation preview

Test mode must allow a designer to preview:

- An invited participant.
- A session-code participant.
- A guest.
- A waiting-room participant.
- A team lead and general team member.
- A multi-role operator.
- A shared display.
- A reassigned participant before and after the assignment change.


---

## v1.2 Controlled Architecture Alignment Amendment (2026-10-17)

**Status:** Proposed for product owner, methodology lead, and technical lead ratification. This amendment supplements—not supersedes—the preceding v1.1 specification. If earlier text conflicts, the conflict is recorded in `CROSS_DOCUMENT_CONSISTENCY_MATRIX.md` and remains open until ratification; these decisions are not represented as deployed capabilities.

**Authoritative decision references:** GOV-001 through GOV-010 in `GOVERNING_DECISIONS_AND_ADRS.md`. **Scope:** v1.2 alignment only. **Explicit non-goal:** PostgreSQL physical or detailed logical schema implementation.

### A. Real-time authoring

- Multiple authenticated designers MAY concurrently edit the same draft, with presence, collaborator attribution, resilient reconnect, and durable local authoring cache. A CRDT library such as Yjs is a candidate, **not yet a pinned dependency**.
- Presence is ephemeral and not part of the canonical simulation definition. Collaborator edit permissions remain server-authoritative. Unauthorized or expired sessions MUST NOT publish or synchronize private definitions.
- Merge convergence does not guarantee semantic validity. The authoring surface must show invalid references, duplicate semantic identifiers, policy contradictions, and changes requiring review.
- Immutable definition revisions are committed server-side from validated draft snapshots; only those revisions can be compiled into packages. Publication MUST use a validated frozen snapshot and record compiler/package hashes.

### B. Offline authoring UX

- Distinguish `Saved on this device`, `Synchronized`, `Validation required`, and `Published`. Local writes are not authoritative server commits; support retry, access revocation, and a visible unsynced-changes count.
- Shared draft offline edits reconcile on reconnect; simultaneous edits to non-mergeable metadata or consequential actions require explicit resolution. Protect private draft caches according to local device security profile.

### C. In-session change activation UX

- Designers see impact before a release is activated in a live session. Harmless text/configuration changes can be prospectively applied; active workflows stay pinned by default; permissions, phase semantics, schema constraints, and adjudication changes require explicit operator review.
- Display affected existing workflows, affected new operations, incompatible incoming offline commands, migration choices, and a clear `Keep existing workflows unchanged` safe default. Activation is recorded as an audited command.
