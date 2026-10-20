# Plenum — Data, Security, Reporting and Governance

## Document control

| Field | Value |
|---|---|
| Document ID | DSR |
| Number | 06 |
| Version | 1.3.1 |
| Date | 2026-10-17 |
| Status | Draft for review. v1.2 amendment merged (DEC-26). |
| Owner | Security Owner, with Technical Lead |
| Approvers | Product Owner; Methodology Lead; Technical Lead; Security Owner (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 08 Canon; 02 Platform; 03 Schema; Decision Register; Glossary |
| Read by | PostgreSQL Logical Data Model; Synchronization Protocol; authorization; analytics; exports; operations |
| Authority | Data domains, tenancy, authentication and authorization policy, classification, audit, evidence integrity, retention, research controls, reporting, exports, security controls, accessibility, publication governance and recovery targets. Table design is delegated to the Data Model. |
| Supersedes | `06_DATA_SECURITY_REPORTING_v1.2.md` |

---

## 1. Purpose

Defines how Plenum stores, protects, audits, reports on and governs data. The v1.1 table list and artifact DDL are retired in favor of the PostgreSQL Logical Data Model v1.1.

## 2. Data domains

| Domain | Contents |
|---|---|
| Organizational | Organizations, Persons, Memberships and Organization Roles, invitations, branding, entitlements |
| Design-time | Simulation Projects, Drafts, collaborative document updates, Definition Revisions, Simulation Releases, Packages |
| Runtime | Sessions, Session Authority, Release Activations, Participants, Seat Assignments, Stages and timers, Artifacts and workflows, Messages, Inject Instances, State Values, capability and resource transactions, adjudications, Control Interventions, Observations |
| Synchronization | Devices, Command Receipts, outbox, projection snapshots, cursors |
| Evidence | Evidence Events, Checkpoints, signatures, Anchors, evidence exports |
| Governance | Audit Records, publication approvals, classifications, retention policies, consent records, export history, correction history |

## 3. Logical storage ownership

One PostgreSQL cluster per Deployment with six schemas (ADR-005): `identity`, `studio`, `registry`, `runtime`, `sync`, `evidence`. These are logical boundaries, not separate servers. Assets and Packages live in S3-compatible object storage, referenced by digest (ADR-011).

## 4. Flexible artifact storage

Identity, ownership, workflow state, Governing Release, Form version, timestamps and relationships are relational columns; Release-defined form content is JSONB validated against the pinned Form version. No entity-attribute-value tables.

## 5. Multitenancy

- Every tenant-owned record belongs to exactly one Organization, directly or through a guaranteed parent (INV-001).
- Tenant identity comes only from authenticated server context; client-supplied organization IDs are ignored or refused (REQ-045).
- Row-level security is enabled and forced on tenant tables and applied under a non-owner application role without BYPASSRLS; it is defense in depth, not the primary control (ADR-015).
- Information asymmetry within a Session is enforced by the policy engine and server-side projections, not by row-level security.
- Template sharing across Organizations is explicit; ownership transfer is explicit.
- Connection pooling is tested to prove that tenant context never leaks between requests.

## 6. Authentication

Email and passwordless sign-in; institutional SSO over OIDC and SAML; multi-factor status; optional external identity providers; Guest Identities; session codes for low-friction joining that never bypass authorization (REQ-046). The application is an OIDC relying party; self-hosted and air-gapped profiles bundle Keycloak (ADR-012). Air-gapped Deployments provide local identity, key management and verification without any cloud dependency.

## 7. Authorization

Role- and attribute-based. Inputs: Organization Roles; project collaborator rights; Session Operator assignment; Seat Assignments and Active Role Context; Session Team; Stage; Artifact ownership and workflow state; content classification; Session status. Unauthorized data is never sent to the client (REQ-047).

## 8. Data classification

Levels: public, internal, confidential, restricted (extensions for classified deployments: OPEN-024). Designers classify fields, forms, content, communications and exports. Organization policy may forbid exporting a classification or sending it to plugins (REQ-050).

## 9. Audit Records and Evidence Events

| Record | Covers | Storage |
|---|---|---|
| Audit Record | Authentication, membership changes, Organization Role changes, project edits, publication approvals, plugin submission, approval, installation and revocation (10 §6), export generation, data deletion, retention execution | Administrative audit store; append-only; not readable by Participants (REQ-052) |
| Evidence Event | Every committed Session change and every recorded Command rejection | `evidence` schema; append-only; tamper-evident (§10) |

## 10. Evidence integrity

Implements DEC-20 under confirmed ADR-003.

- A Session state change and its Evidence Event commit atomically, with a strictly increasing per-Session Evidence Sequence (REQ-053).
- Evidence rows cannot be updated or deleted: enforced by database privileges and immutability triggers, not only by application convention.
- Checkpoints cover contiguous sequence ranges using a stable canonical serialization (not raw JSONB text), chain to the previous Checkpoint digest, and are signed with a key identified by key ID.
- Checkpoint digests are anchored with an independently controlled custodian. Without an independent anchor, a privileged party could rewrite both events and chain; tamper evidence is claimed only once anchoring is in place (OPEN-017).
- Signing keys live outside the database under segregated custody; air-gapped profiles use institution-controlled key systems (OPEN-014).
- Cryptographic integrity proves records were not altered after commit. It does not prove human inputs were accurate, device clocks were correct, or that history is absolutely immutable.
- Required procedures: key rotation, correction by compensating event, retention, redaction of protected fields in exports, verification export, compromise response.

## 11. Retention

Retention policies apply at Organization, Simulation Project, Artifact Type, Message Channel, Voice Channel recording, Poll, Session and export level. Each policy states period, legal hold behavior, anonymization, deletion, archive destination and approval requirement (REQ-059). Evidence retention must preserve verifiability; redaction uses compensating records and documented proofs rather than deletion of chained records.

## 12. Corrections and deletion

Historical records are never silently overwritten. A correction records original value, corrected value, actor, reason, time and whether reports must be regenerated. Deletion follows policy and never leaves orphaned references.

## 13. Research controls

Participant consent records; pseudonymous identifiers; separation of identity data from behavioral data; field exclusion; anonymized exports; research-purpose labels; project or protocol identifiers; data-access approval workflows (REQ-058).

## 14. Reporting

Reports draw on: the Simulation Release; Session metadata; Evidence Events; Artifact history; Messages and proposals where authorized; Adjudication Records; State Value history; Observations; operator annotations.

| Standard report | Contents |
|---|---|
| Session archive | Complete machine-readable package for preservation and replay, including the Session Reproducibility Manifest |
| After-action report | Summary, objectives, participation, chronology, key decisions, adjudicated outcomes, world-state changes, observations, lessons, appendices |
| Team report | Objectives, decisions, communications, outcomes, performance evidence |
| Control report | Pacing, interventions, workflow bottlenecks, overrides, operational issues |
| Research dataset | Structured export with documented fields, identifiers, timestamps and anonymization profile |

## 15. Exports

Formats: CSV, JSON, JSONL, HTML, PDF; research deployments add Parquet and a portable research package (run manifest, canonical schemas, event stream, snapshots, Observations, Derived Metrics, metric contracts, Analytical Notes, Findings, provenance, data dictionary). Every export states Release, Session, generation time, export definition version, anonymization profile, and included and excluded data classes (REQ-054). Organizations can export all their own data (REQ-062).

## 16. Provenance

Every derived report element traces to its sources (REQ-055): an outcome paragraph to its Adjudication Record; a metric chart to State Value changes and the Measurement Definition version; a timeline item to Evidence Events; a decision summary to Artifact versions.

## 17. Analytical layers

Observations, Derived Metrics, Analytical Notes and Findings are stored and presented separately (08 Canon §10; REQ-056, REQ-057, INV-016). Comparative outputs identify source Session, Release, records, transformation version, metric version, analyst, time, missing data and confidence.

## 18. Offline privacy

- Offline bundles are Participant-scoped projections, never a full Release (03 §19). Each states provenance, Governing Release, projection version, permitted fields, cache expiry and sensitivity.
- On-device data and Offline Outboxes are protected at rest where the platform allows; browser storage alone does not meet high-assurance requirements (REQ-008).
- On reconnection the server re-checks authentication, membership, current revocations and device policy.
- Revocation cannot guarantee erasure of material already delivered to a device. High-security deployments need an explicit device-custody model and accreditation, not a generic compliance claim (OPEN-014, OPEN-015).

## 19. Security controls

| Area | Controls |
|---|---|
| Application | Input validation; output encoding; CSRF protection where cookies are used; secure token handling; rate limiting; upload type validation; malware scanning; plugin input and output validation |
| Extensions | Signed, digest-pinned Plugin Artifacts; Extension Host isolation with default-deny egress (ADR-018); trust root provisioned by the institution; emergency revocation (10 §13; OPEN-029) |
| Voice media | Short-lived scoped Media Credentials; provider events treated as untrusted; media stack confined to its own boundary (DEC-49, ADR-017) |
| Database | Row-level security under a non-owner role; least-privilege grants; immutability triggers on append-only tables; encryption in transit and at rest; restricted administrative access |
| Keys and secrets | Key lifecycle management; secret rotation; signing keys outside the database |
| Operations | Environment separation; dependency scanning; vulnerability management; incident response; security event monitoring |

Each control has a test or operational check before production (REQ-051).

## 20. Accessibility

WCAG 2.2 AA for Studio and Runtime: keyboard operation, screen-reader semantics, focus management, contrast, non-color status indicators, captions and transcripts, responsive layouts, accessible form errors, adjustable timing or operator accommodations (REQ-064). Ballots and voice controls meet the same standard, including keyboard push-to-talk, visible microphone state and a non-audio path for essential instructions (REQ-085; VOTE-15, VOICE-11). Captions generated by transcription follow the consent rule in §24.2.

## 21. Governance of published Releases

Publication requires a named owner, semantic version, validation report, release notes, approver identity, data-classification review, retention-policy selection and accessibility review status (REQ-022, DEC-39).

## 22. Backup, recovery and reliability

- Backups cover PostgreSQL and object storage together so a restore is consistent: Releases, assets, Evidence Sequence, Checkpoints, signatures and Anchors (REQ-066).
- Every restore drill verifies the checkpoint chain end to end and reports any proof that cannot be recovered.
- Each Deployment's release configuration states availability, RTO, RPO, maximum event-processing delay, maximum state-update delay, maximum submission latency, backup frequency, restore-test frequency, audit retention, export recovery behavior and monitoring thresholds (REQ-067; OPEN-017, OPEN-019).
- Security and recovery tests are acceptance gates, not post-launch tasks.
- The DEC-16 workload is a sizing assumption; no throughput or uptime is promised until measured.

## 23. Mandatory negative tests

Tampered Evidence Event; missing Evidence Event; rewritten chain without independent Anchor; stale permissions after revocation; cross-tenant read and write under the real application role and pooled connections; lost and duplicated Command Receipts; restricted field in an export or plugin input; offline bundle containing another role's data; secret-ballot choice exposed through an event, log, export or early result; transcription without consent; tampered or untrusted plugin bundle; plugin effect committed without approval.

## 24. Polling, voice and extension data controls

### 24.1 Ballots

- Secret-ballot choices are stored in a restricted part of the `voting` schema, apart from voter identity, with purpose-specific access. Tally readers never see identities (INV-025).
- `ballot.accepted` Evidence Events for secret ballots carry the receipt and Ballot-set membership, never the choice. Checkpoints still cover them, so integrity is verifiable without disclosure.
- Research exports include Poll definition digest, Electorate digest, accepted Ballot-set digest, method version, Tally and Certification chain; individual secret choices are excluded.
- Small-group suppression, ballot encryption, eligibility tokens, key custody and administrator recovery: OPEN-028.

### 24.2 Recordings and transcripts

- Off by default. Transcription runs only with the consent of every Participant transcribed (DEC-50, INV-027); recording consent follows Organization policy and law (OPEN-027).
- Consent Records are Evidence Events. Withdrawal stops transcription and is recorded.
- Recordings and transcripts are encrypted object-storage assets with classification, retention class and hash. They never appear in logs, analytics or debugging output, and are exported only under the export policy for their classification.
- In air-gapped profiles only locally installed transcription engines may run.

### 24.3 Plugin data

- Plugin inputs are policy-filtered snapshots; protected payloads never enter ordinary logs or telemetry (10 §8).
- Model Runs, Effect Proposals and Approval Decisions are append-only provenance and survive Plugin removal (10 §11).
- Plugin secrets live in the institutional secret store and are referenced by the Plugin Installation; they never appear in Releases, Packages or exports.

## Change log

| Version | Date | Change |
|---|---|---|
| 1.3.1 | 2026-10-17 | Added §24 (ballot secrecy, recordings and transcripts, plugin data); retention levels now name Message Channels (DEC-51), Voice Channel recordings and Polls; extension and voice security controls; accessibility for ballots and voice; new mandatory negative tests. |
| 1.3.0 | 2026-10-17 | Merged v1.2 amendment; retired v1.1 table list and artifact DDL in favor of Data Model v1.1; separated Audit Records from Evidence Events; specified database-enforced immutability; removed Supabase-specific assumptions; adopted Glossary terms; renumbered sections. |
| 1.2.0 | 2026-10-17 | Alignment amendment (archived). |
