# Plenum Data, Security, Reporting, and Governance Specification

## Document Control

- **Document ID:** DSR
- **Version:** 1.2.0 (controlled alignment draft; retains v1.1 body)
- **Status:** Draft for review
- **Owner:** Plenum product owner
- **Approvers:** Product owner; simulation-methodology lead; technical lead
- **Reads from:** PRD; Simulation Design and Research Canon; Platform Architecture; Canonical Schema
- **Read by:** Database implementation; authorization; analytics; exports; governance and operations
- **Authority:** Defines persistence, tenancy, security, provenance, analytical separation, reporting, retention, and governance.
- **Out of scope:** Decisions explicitly governed by another document in the specification hierarchy.

## 1. Purpose

This document defines the persistent data model, security controls, audit requirements, reporting architecture, and governance standards for Plenum Studio and its runtime.

## 2. Data Domains

### 2.1 Organizational data

- Organizations
- Memberships
- Invitations
- Roles
- Billing or entitlement metadata
- Institutional branding

### 2.2 Design-time data

- Simulations
- Draft versions
- Teams
- Roles
- Phases
- Forms
- Workflows
- Injects
- Variables
- Interface definitions
- Content
- Reports

### 2.3 Runtime data

- Sessions
- Participants
- Assignments
- Session state
- Phase instances
- Timers
- Artifacts
- Messages
- Inject instances
- Variable values
- Adjudications
- Observations
- Events

### 2.4 Governance data

- Audit records
- Publication approvals
- Data classifications
- Retention policies
- Consent records
- Export history
- Correction history

## 3. Recommended Core Tables

### Design-time

```text
organizations
organization_members
simulations
simulation_versions
simulation_collaborators
team_definitions
role_definitions
seat_definitions
phase_definitions
activity_definitions
artifact_type_definitions
form_definitions
form_schema_versions
workflow_definitions
workflow_nodes
workflow_transitions
communication_channels
communication_routes
inject_definitions
variable_definitions
adjudication_definitions
interface_definitions
content_items
report_definitions
plugin_bindings
validation_results
```

### Runtime

```text
sessions
session_teams
session_roles
session_seats
participants
participant_assignments
session_state
phase_instances
timer_instances
artifacts
artifact_versions
artifact_relationships
workflow_instances
workflow_task_instances
messages
message_threads
announcements
inject_instances
notifications
variable_values
variable_changes
adjudication_instances
adjudication_reviews
adjudication_effects
observations
event_log
session_exports
```

## 4. Flexible Artifact Storage

Use a hybrid model:

- Normalized columns for identity, ownership, status, timestamps, permissions, and relationships.
- JSONB for simulation-defined form payloads.
- Schema-version references for validation and historical interpretation.

```sql
CREATE TABLE artifacts (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  artifact_type_definition_id uuid NOT NULL,
  schema_version_id uuid NOT NULL,
  owner_type text NOT NULL,
  owner_id uuid,
  created_by uuid NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 5. Multitenancy

Every relevant record must be scoped to an organization directly or through a guaranteed parent relationship.

Requirements:

- Organization isolation
- Row-level security
- No cross-organization identifiers exposed without authorization
- Organization-specific export controls
- Controlled template sharing
- Explicit ownership transfer

## 6. Authentication

Support:

- Email-based authentication
- Passwordless links
- Institutional single sign-on
- Optional external identity providers
- Session join codes for low-friction participants

Low-friction joining must not bypass session authorization or data access policies.

## 7. Authorization

Use role-based and attribute-based access control.

Decision inputs include:

- Platform role
- Organization membership
- Simulation collaborator role
- Session operator role
- Team assignment
- Simulation role
- Current phase
- Artifact ownership
- Content classification
- Session status

## 8. Data Classification

Recommended levels:

- Public
- Internal
- Confidential
- Restricted

Designers may classify fields, forms, content, communications, and exports. Organization policy may prohibit certain classifications from being exported or processed by external plugins.

## 9. Audit Logging

Audit events include:

- Authentication events
- Membership changes
- Simulation edits
- Publication
- Permission changes
- Session creation
- Participant reassignment
- Operator overrides
- Adjudication changes
- State changes
- Export generation
- Data deletion
- Retention-policy execution

Audit records should be tamper-evident and inaccessible to ordinary participants.

## 10. Data Retention

Retention policies may apply at:

- Organization
- Simulation
- Artifact type
- Communication channel
- Session
- Export

A policy specifies:

- Retention period
- Legal hold behavior
- Anonymization behavior
- Deletion behavior
- Archive destination
- Approval requirements

## 11. Research and Evaluation Controls

The platform should support:

- Participant consent records
- Pseudonymous participant identifiers
- Separation of identity data from behavioral data
- Selective field exclusion
- Anonymized exports
- Research-purpose labels
- Protocol or project identifiers
- Data-access approval workflows

## 12. Reporting Model

Reports draw from:

- Published simulation definition
- Session metadata
- Event history
- Artifact history
- Messages and proposals where authorized
- Adjudication records
- Variable changes
- Observations
- Operator annotations

## 13. Standard Reports

### 13.1 Session archive

A complete machine-readable package for preservation or replay.

### 13.2 After-action report

Includes:

- Session summary
- Objectives
- Participation
- Chronology
- Key decisions
- Adjudicated outcomes
- World-state changes
- Observations
- Lessons
- Appendices

### 13.3 Team report

Includes team objectives, actions, communications, outcomes, and performance evidence.

### 13.4 Facilitator report

Includes pacing, interventions, workflow bottlenecks, overrides, and operational issues.

### 13.5 Research dataset

A structured export with documented fields, identifiers, timestamps, and anonymization profile.

## 14. Export Formats

- CSV for tabular analysis
- JSON for structured records
- JSONL for event streams
- HTML for portable interactive reports
- PDF for formal distribution

Every export must include:

- Simulation version
- Session identifier
- Generation timestamp
- Export definition version
- Anonymization profile
- Included and excluded data classes

## 15. Data Provenance

Every derived report element should be traceable to source records.

Examples:

- An outcome paragraph references the adjudication instance.
- A metric chart references variable-change events.
- A timeline item references domain events.
- A decision summary references artifact versions.

## 16. Security Controls

### Application controls

- Input validation
- Output encoding
- CSRF protection where applicable
- Secure cookies and token handling
- Rate limiting
- File-type validation
- Malware scanning for uploads
- Plugin input and output validation

### Database controls

- Row-level security
- Least-privilege service roles
- Encryption in transit and at rest
- Restricted administrative access
- Backup and restore testing

### Operational controls

- Environment separation
- Secret rotation
- Dependency scanning
- Vulnerability management
- Incident response procedures
- Security event monitoring

## 17. Accessibility and Inclusive Design

The platform should target WCAG 2.2 AA.

Requirements include:

- Keyboard navigation
- Screen-reader semantics
- Focus management
- Sufficient contrast
- Non-color status indicators
- Captions and transcripts
- Responsive layouts
- Accessible form errors
- Adjustable timing or operator accommodations

## 18. Governance of Published Simulations

Publishing should require:

- Named owner
- Version number
- Validation report
- Release notes
- Approval identity
- Data classification review
- Retention-policy selection
- Accessibility review status

## 19. Corrections and Deletion

Historical records should not be silently overwritten.

Corrections should:

- Preserve original value
- Record corrected value
- Identify actor
- Record reason
- Record timestamp
- Indicate whether reports must be regenerated

Deletion must follow organization policy and must not leave orphaned references.

## 20. Analytical Data Layers

The analytical model must keep four layers distinct:

1. **Raw observations:** decisions, actions, communications, information views and deliveries, approvals, events, adjudications, state changes, interventions, and participant reflections.
2. **Derived metrics:** reproducible transformations such as decision latency, coordination density, resource efficiency, information-use rate, adaptation frequency, confidence calibration, objective attainment, and capability degradation.
3. **Analyst interpretation:** observations, explanatory notes, alternative explanations, confidence assessments, and limitations attributable to a named analyst.
4. **Findings:** claims linked to supporting evidence, confidence, applicability, limitations, and recommended action.

Derived values may never overwrite raw observations, and interpretation may never be represented as directly observed fact.

## 21. Metric Contract

Every metric requires a stable ID, version, research question, definition, formula, source fields, aggregation level, time window, missing-data behavior, interpretation, misinterpretation risk, validation method, visualization, and export format. Metric revisions create new versions; historical outputs retain the version used.

## 22. Comparative Analysis and Provenance

The platform must support comparison by team, participant, role, run, scenario version, intervention condition, capability package, decision sequence, and time period. Every output identifies source run, scenario version, source records, transformation version, metric version, analyst, timestamp, missing data, and confidence.

## 23. Export and Research Packages

In addition to CSV, JSON, JSONL, HTML, and PDF, research-oriented deployments should support Parquet and a portable research package containing the run manifest, canonical schemas, event stream, snapshots, raw observations, derived metrics, metric contracts, analyst notes, findings, provenance, and data dictionary.

## 24. Reliability and Recovery Targets

Release configuration must define availability, RTO, RPO, maximum event-processing delay, maximum state-update delay, maximum submission latency, backup frequency, restoration test frequency, audit retention, export recovery behavior, and monitoring thresholds. Security and recovery tests are acceptance gates rather than post-launch operational tasks.



---

## v1.2 Controlled Architecture Alignment Amendment (2026-10-17)

**Status:** Proposed for product owner, methodology lead, and technical lead ratification. This amendment supplements—not supersedes—the preceding v1.1 specification. If earlier text conflicts, the conflict is recorded in `CROSS_DOCUMENT_CONSISTENCY_MATRIX.md` and remains open until ratification; these decisions are not represented as deployed capabilities.

**Authoritative decision references:** GOV-001 through GOV-010 in `GOVERNING_DECISIONS_AND_ADRS.md`. **Scope:** v1.2 alignment only. **Explicit non-goal:** PostgreSQL physical or detailed logical schema implementation.

### A. Additional logical data ownership (no detailed DDL yet)

- Distinguish mutable Studio CRDT document/update state, immutable DefinitionRevision, immutable compiled SimulationRelease, authoritative runtime aggregate state, idempotent command receipts, and tamper-evident institutional evidence.
- Proposed logical schema ownership: `identity`, `studio`, `registry`, `runtime`, `sync`, `evidence` within a PostgreSQL deployment; these are not additional servers. Table names and foreign-key detail are reserved for PostgreSQL Logical Data Model v1.0.
- Store canonical tenant attribution and test cross-tenant reads and writes. RLS may enforce tenant isolation as defense-in-depth; session information-asymmetry policy belongs to the application policy engine with server-side projections.

### B. Offline privacy and identity

- Offline bundles MUST be participant-scoped projections, never a full hidden-content simulation package. Include provenance, governing release/projection version, permitted fields, cache expiry, and sensitivity classification.
- Protect on-device persistence and command queues; enforce reauthentication, session membership, current revocations and device policy on reconnect. Revocations cannot guarantee erasure of previously viewed offline material. Classified deployments require an explicit security accreditation and device-custody model, not generic claims of compliance.
- Air-gapped deployment MUST provide local identity, key management, backups, package import/export controls and artifact verification without a cloud dependency.

### C. Institutional evidence contract

- Authoritative runtime state changes and their evidence entry MUST be atomic. Evidence uses a monotonic sequence per session and a stable canonical serialization specification.
- Use append-only storage with cryptographic hash chaining or Merkle batch commitments, signed checkpoints with key identifiers, and independently controlled retained anchors. Specify independent custodian and verification/export workflow before claiming tamper evidence.
- Cryptographic integrity is not equivalent to accurate human input, trustworthy device clock or absolute immutability. Define key rotation, correction-by-compensating-event, retention, redaction of protected fields, audit exports and compromise response.
- Add negative tests for tampered events, missing entries, rewritten hash chains without independent anchor, stale permissions, cross-tenant data, and lost/duplicated command receipts.

### D. Operations and sizing

- 500 participants × 10 concurrent sessions is a design workload assumption only. Benchmark and define RPO/RTO according to institutional contractual needs; test restore and verify restored evidence/checkpoint consistency. No unmeasured throughput or uptime promises.
