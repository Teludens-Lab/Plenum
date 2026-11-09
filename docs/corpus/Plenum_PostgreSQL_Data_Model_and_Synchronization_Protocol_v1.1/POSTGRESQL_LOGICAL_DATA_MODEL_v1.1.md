# Plenum — PostgreSQL Logical Data Model

## Document control

| Field | Value |
|---|---|
| Document ID | PGLDM |
| Version | 1.1.5 |
| Date | 2026-11-08 |
| Status | Approved by Product Owner direction on 2026-10-20. Depends on ADR-001 to ADR-005 and ADR-014 to ADR-016; named specialist sign-offs remain required. OPEN-002 is resolved. |
| Owner | Technical Lead |
| Approvers | Technical Lead; Security Owner; Operations Owner (role placeholders — OPEN-001) |
| Reads from | 01 PRD; 02 Platform; 03 Schema; 05 Runtime; 06 Data, Security and Reporting; 09 Contracts; 10 Extension Framework; 11 Polling and Voting; 12 Voice and Radio; Decision Register; Glossary |
| Read by | Synchronization Protocol v1.1; implementation; tests |
| Authority | Logical tables, keys, integrity rules, transaction and locking rules, tenancy enforcement and database acceptance tests. |
| Supersedes | `POSTGRESQL_LOGICAL_DATA_MODEL_v1.0.md` |

**Executable reference.** The vertical-slice subset of this model is implemented and tested as migrations 001–004 in `plenum_runtime_slice/migrations/`. Those files are the normative DDL for the entities marked **Implemented** below; this document no longer duplicates SQL that could drift from them.

---

## 1. Goals and boundaries

- One PostgreSQL 18 cluster per Deployment (ADR-005, ADR-009); never two Deployments writing the same Session (ADR-001).
- Nine logical schemas, one database: `identity`, `studio`, `registry`, `runtime`, `sync`, `evidence` (ADR-005) and the capability schemas `extension`, `voting`, `comms` (ADR-016). The voice media server keeps its own state outside this database (DEC-49).
- Binary assets and Packages live in S3-compatible object storage (ADR-011) and are referenced by digest.
- Relational current state plus an append-only Evidence Event journal; no full event sourcing (ADR-014).
- Planning workload: DEC-16. Not a verified capacity; targets are OPEN-019.

## 2. Schema ownership

| Schema | Owns | Aggregate roots |
|---|---|---|
| identity | Organizations, Persons, Organization Role memberships, federated identities, Guest Identities, Display Principals, Deployment registrations | Organization, Person |
| studio | Simulation Projects, Drafts, collaborative documents and updates, Definition Revisions, validation reports | Simulation Project |
| registry | Simulation Releases, Package manifests, compatibility records | Simulation Release |
| runtime | Sessions, Session Authority, Release Activations, Participants, Seat Assignments, Artifacts and workflows, Stages, timers, Injects, Messages, state, adjudication, Control Interventions | Session |
| sync | Devices, Command Receipts, delta outbox, projection snapshots and grants, client cursors | Session, Device |
| evidence | Evidence sequence and events, Checkpoints, signatures, Anchors, Audit Records, evidence export jobs | Session evidence stream |
| voting | Polls, options, Electorate members, Ballots and receipts, Tallies, Certifications | Poll |
| comms | Voice Channels, voice grants, Floor Leases and requests, Consent Records, media events, recording references | Voice Channel |
| extension | Publishers, Plugin Artifacts, Plugin Installations and Bindings, compositions, Composition Runs, Model Runs, Effect Proposals, Approval Decisions, effect receipts | Plugin Artifact (catalog); Composition Run (Session) |

## 3. Conventions and invariants

- **Identifiers:** UUID primary keys; domain references use UUIDs, never sequences across Deployments.
- **Time:** `timestamptz` in UTC; server receipt and commit times are authoritative; device time is stored only as an observation (INV-011).
- **Tenancy:** every tenant-owned table has `organization_id` and `UNIQUE (organization_id, id)`; children reference parents through composite foreign keys `(organization_id, parent_id)` so a row can never point into another Organization.
- **Aggregate versions:** `version bigint` starting at 1 when the aggregate is created; a creation Command carries `expectedAggregateVersion = 0`; each accepted Command increments by exactly 1.
- **Release-defined identifiers:** Session Role IDs, Artifact Type keys, workflow keys and state keys are text defined by the Release. The application validates them against the Governing Release; the database never hard-codes them (INV-022).
- **JSONB:** schema-governed Artifact payloads, Draft documents, Definition Revision snapshots, Evidence Event bodies, compatibility policies. Identity, ownership, state, versions and references stay relational. No entity-attribute-value tables.
- **Immutability:** Definition Revisions, Releases, Release Activations, document updates, Evidence Events, Checkpoints, signatures and Anchors cannot be updated, deleted or truncated (§6.3).

## 4. Logical entity catalog

Status: **Implemented** (in migrations 001–004 and exercised by tests), **Schema only** (table exists; no producer), **Specified** (to be added; columns listed are the minimum).

### 4.1 identity

| Table | Key columns | Status |
|---|---|---|
| organizations | id, name | Implemented |
| persons | id, display_name | Implemented |
| memberships | (organization_id, person_id, organization_role ∈ admin, designer, publisher, operator; reviewer and research_analyst approved by DEC-61) | Implemented four-role baseline; DEC-61 migration pending |
| federated_identities | person_id, issuer, subject, provider_type, last_authenticated_at | Specified (ADR-012) |
| guest_identities | id, organization_id, session_id, display_name, expires_at, revoked_at | Specified |
| display_principals | id, organization_id, session_id, interface_profile_id, classification_ceiling, credential_rotated_at, revoked_at | Specified |
| deployment_registrations | deployment_id, profile (cloud, institutional, air_gapped), public_key, registered_at | Specified (ADR-001) |

### 4.2 studio

| Table | Key columns | Status |
|---|---|---|
| simulation_projects | id, organization_id, title, created_by | Implemented |
| drafts | id, organization_id, project_id (unique), document, version, updated_by | Implemented (single optimistic Draft per project; replaced by collaborative documents in Phase 3) |
| collaborative_documents | id, organization_id, project_id, branch_key, document_key (`core_design` or `scenario:<id>`), schema_version, snapshot, snapshot_sha256 | Schema only (ADR-002) |
| document_updates | id, document_id, update_id, author_person_id, client_context, bytes, size_bytes, sha256 | Schema only |
| definition_revisions | id, organization_id, project_id, parent_revision_id, snapshot, snapshot_sha256, methodology_version, author_id | Implemented; parent chain enforced within the same project |
| validation_reports | id, organization_id, project_id, revision_id or draft_version, errors, warnings, created_at | Specified (REQ-011) |
| simulation_templates | id, organization_id, source_project_id, version, frozen_sha256, published_by, published_at, lifecycle_status | Implemented baseline; governed version lifecycle extension specified by resolved OPEN-013 and PS-760 |
| template_approvals | id, organization_id, template_id, frozen_sha256, approver_person_id, approver_roles, policy_version, evidence, rationale, decided_at | Specified (REQ-022, resolved OPEN-013) |

A Core Design and its Scenarios are stored as collaborative documents in one project; a Definition Revision snapshot materializes them together as `{coreDesign, scenario}` (03 §3).

### 4.3 registry

| Table | Key columns | Status |
|---|---|---|
| releases | id, organization_id, project_id, definition_revision_id (unique), release_number, release_label, package_schema_version, compiler_version, package_sha256, blob_key, published_by | Implemented |
| release_approvals | id, organization_id, release_id, frozen_sha256, approver_person_id, approver_roles, policy_version, evidence, rationale, decision, decided_at | Implemented baseline; distinct-author and complete provenance extension specified by REQ-022, resolved OPEN-013 and PS-760 |
| package_manifests | release_id, manifest, signature, signing_key_id | Specified (OPEN-020) |
| release_compatibility | from_release_id, to_release_id, change_classes, report | Specified (ADR-004, OPEN-012) |

### 4.4 runtime

| Table | Key columns | Status |
|---|---|---|
| sessions | id, organization_id, project_id, initial_release_id, status, version | Implemented; the initial release must belong to the session's project (composite FK) |
| session_authorities | session_id, deployment_id, authority_epoch, status | Implemented; checked on every consequential write |
| authority_transfers | id, session_id, from_deployment_id, to_deployment_id, from_epoch, to_epoch, fencing_proof, operator_person_id, reason, status | Specified (resolved OPEN-016; implementation evidence pending) |
| release_activations | id, session_id, project_id, release_id, previous_activation_id, activation_sequence, compatibility_policy, approved_by | Implemented (initial activation only); release must belong to the session's project |
| release_activation_reviews | id, organization_id, session_id, from_release_id, to_release_id, report_sha256, change_classification, reviewed_by, reviewer_roles, policy_version, evidence, rationale, reviewed_at | Implemented baseline; fresh distinct-author consequential approval and complete provenance extension specified by resolved OPEN-013 and PS-760 |
| participants | id, organization_id, session_id, person_id (unique per session) | Implemented |
| seat_assignments | id, participant_id, session_role_id, valid_from, valid_to, assigned_by | Implemented; one active assignment per participant and role |
| session_seats | session_id, seat_id (Release-defined), state (open, reserved, occupied, vacated, disabled) | Specified |
| session_teams | session_id, team_id (Release-defined), status | Specified |
| artifact_instances | id, session_id, governing_release_id, artifact_type_key, workflow_key, form_version, creator_participant_id, state, payload, visible_role_ids, version | Implemented |
| artifact_versions | artifact_id, version, payload, state, changed_by, changed_at | Specified (history is currently reconstructable from Evidence Events) |
| decision_actions | id, artifact_id, action_key, payload, version | Specified (DEC-63; resolved OPEN-018) |
| stage_instances, timers | session_id, stage_id, status, started_at, deadline_at, paused_remaining | Specified |
| inject_instances, inject_recipient_states | session_id, inject_definition_id, state; per-recipient acknowledged_at, responded_at | Specified (DEC-64) |
| messages | session_id, channel_id, sender_participant_id, recipients, thread_id, content, approval_state, delivery_state | Specified |
| information_deliveries | session_id, record_ref, participant_id, released_at, delivered_at, viewed_at, acknowledged_at | Specified (08 Canon §6.1) |
| state_values, state_snapshots | session_id, state_variable_id, scope_ref, value; snapshot at evidence_sequence | Specified |
| capability_states, resource_transactions | capability state changes; resource debits and credits with source | Specified |
| adjudication_requests, adjudication_records, adjudication_reviews, effects | request scope and correlation; outcome, rationale, origin (human or plugin), plugin version, review disposition; per-perspective reviews; applied effects | Specified (REQ-036) |
| control_interventions | session_id, operator_person_id, authority, category, reason, before, after | Specified (REQ-034) |

**Workflow Instance storage (v1.1).** Each Artifact has exactly one Workflow Instance, stored inline on `artifact_instances` (`workflow_key`, `state`, `version`, `governing_release_id`). A separate `workflow_instances` table is added when parallel or multiple workflows per Artifact are approved (OPEN-006).

**Slice visibility column.** `visible_role_ids` records the Session Roles that held or were notified about an Artifact along its path (03 §10 `holderSessionRoleIds`, `notifySessionRoleIds`). It is a slice projection aid, not an Information Policy implementation.

### 4.5 sync

| Table | Key columns | Status |
|---|---|---|
| devices | id, organization_id, person_id, registered_at, revoked_at | Implemented |
| command_receipts | session_id, command_id (unique per session), payload_sha256, device_id, actor_person_id, actor_participant_id, active_session_role_id, authority_epoch, operation_type, aggregate_id, status, result_version, evidence_sequence, rejection_code | Implemented; `rejection_code` is null exactly when `status = accepted` |
| session_delta_outbox | event_id (unique), publication_status (pending, published, dead_lettered), attempts | Implemented (written; no publisher) |
| projection_snapshots | session_id, principal scope, projection_revision, policy_revision, expires_at, digest | Specified |
| projection_grants | session_id, participant_id, policy_revision, granted_fields, expires_at | Specified |
| client_sync_cursors | device_id, session_id, cursor, acknowledged_at | Specified |

### 4.6 evidence

| Table | Key columns | Status |
|---|---|---|
| session_sequences | session_id, next_sequence | Implemented; allocated under row lock |
| events | session_id, sequence (unique per session), event_type (past tense), event_version, command_id, actor_person_id, actor_participant_id, governing_release_id, authority_epoch, body | Implemented; includes `command.rejected` and `command.reconciliation_required` (DEC-43) |
| checkpoint_batches | session_id, first_sequence, last_sequence, previous_checkpoint_digest, batch_merkle_root, canonicalization, algorithm, checkpoint_digest | Schema only (ADR-003) |
| checkpoint_signatures | checkpoint_id, signing_key_id, signature_algorithm, signature | Schema only |
| anchor_receipts | checkpoint_id, anchor_endpoint, anchor_reference, anchored_digest, verification_result | Schema only (OPEN-017) |
| audit_records | id, organization_id, actor_person_id, action, target_ref, details, recorded_at | Specified (06 §9; not Session-scoped) |
| evidence_export_jobs | session_id, requested_by, status, format, object_key, digest | Specified |

### 4.7 voting

Owned by 11 §5. All Specified.

| Table | Key columns | Notes |
|---|---|---|
| polls | id, organization_id, session_id, governing_release_id, definition_id, definition_revision, status, opened_at, closed_at, certified_at, version, authority_epoch | Fields frozen at `open` are rejected by trigger once status leaves `scheduled` (INV-023) |
| poll_options | poll_id, option_id, label, ordinal | Immutable after open |
| electorate_members | poll_id, seat_assignment_id, weight, veto, policy_snapshot_digest, status | Frozen at open |
| ballot_receipts | session_id, command_id (unique per session), poll_id, seat_assignment_id, eligibility_consumption_id, status, accepted_sequence, accepted_at | Partial unique index on `(poll_id, seat_assignment_id)` where status is accepted and revoting is off |
| ballots | poll_id, ballot_revision, choice (or restricted pointer), accepted_sequence | Secret ballots: choice stored in a restricted table with no `seat_assignment_id`, readable only by the tally role (INV-025) |
| tallies | poll_id, ballot_set_sha256, method, method_version, counts, computed_at | Unofficial |
| certifications | poll_id, poll_revision, tally_sha256, result_sha256, certifier_person_id, authority_epoch, corrects_certification_id, certified_at | One current per Poll revision; append-only |

### 4.8 comms

Owned by 12 §4. All Specified. No audio bytes in any row.

| Table | Key columns | Notes |
|---|---|---|
| voice_channels | id, organization_id, session_id, governing_release_id, definition_id, status, opened_by, opened_at, closed_at, provider_binding_id, version | |
| voice_grants | channel_id, seat_assignment_id, can_listen, can_transmit, can_moderate, valid_until, revoked_at, policy_revision | Projection of Runtime policy |
| floor_leases | channel_id (unique where active), holder_seat_assignment_id, lease_token_sha256, lease_expires_at, authority_epoch, version | At most one active lease per push-to-talk channel |
| floor_requests | channel_id, request_id (unique per channel), seat_assignment_id, priority, requested_at, status | Not created from offline queues |
| consent_records | channel_id, participant_id, kind (recording, transcription), action (given, withdrawn), recorded_at | Append-only (DEC-50) |
| media_events | channel_id, provider_event_id (unique), kind, observed_at, ingested_at, source | Untrusted observations |
| recording_assets | channel_id, kind (recording, transcript), object_key, sha256, classification, retention_class, consent_basis | |

### 4.9 extension

Owned by 10 §11. All Specified.

| Table | Key columns | Notes |
|---|---|---|
| publishers | id, trust_classification, status, allowed_signing_key_ids | Platform catalog |
| plugin_artifacts | id, plugin_id, version, digest (unique), manifest_sha256, object_key, lifecycle, signature_verified_at | Shared catalog; `(plugin_id, version)` unique |
| plugin_installations | id, organization_id, deployment_id, artifact_digest, approved_by, status, permitted_capabilities, secret_refs | Tenant-scoped |
| plugin_bindings | id, organization_id, definition_revision_id, installation_id, artifact_digest, configuration_sha256, status | |
| compositions | id, organization_id, definition_revision_id, graph, graph_sha256, validation_status | |
| composition_runs | id, organization_id, session_id, governing_release_id, graph_sha256, trigger, input_snapshot_id, status, correlation_id | |
| model_runs | composition_run_id, node_id, attempt, artifact_digest, input_sha256, output_sha256, duration_ms, status, failure_code | Append-only |
| effect_proposals | id, organization_id, session_id, model_run_id, target_aggregate_id, payload, payload_sha256, status | Lifecycle Glossary §7.11 |
| approval_decisions | proposal_set_sha256, reviewer_person_id, decision, authority_epoch, expected_version, reason, scope | Append-only |
| effect_receipts | proposal_id, command_id (unique), applied_version, evidence_sequence | Links to the Command Receipt |

## 5. Migrations 001–004 (executable reference)

| Migration | Contents |
|---|---|
| 001_core | Six schemas; identity (organizations, persons, memberships); studio (projects, drafts, definition revisions); registry (releases) |
| 002_runtime_sync_evidence | Sessions, authorities, activations, participants, seat assignments, artifacts; devices, receipts, outbox; evidence sequence, events, checkpoint tables; indexes |
| 003_collaboration | Collaborative documents and updates |
| 004_security | `plenum_app` role; least-privilege grants; append-only triggers; forced row-level security on every table with `organization_id` |

Migrations are forward-only, each in its own transaction, under an advisory lock (`src/migrate.mjs`). The `voting`, `comms` and `extension` schemas will arrive as later migrations; the row-level security, grants and append-only triggers in 004 extend to them.

## 6. Integrity and security enforcement

### 6.1 Cross-reference consistency in the database

- A Session's initial Release belongs to the Session's project: `FOREIGN KEY (organization_id, project_id, initial_release_id) → releases(organization_id, project_id, id)`.
- A Release Activation's Release belongs to the same project as its Session, and its previous activation belongs to the same Session.
- A Release's Definition Revision belongs to the same project.
- Artifacts, receipts and evidence reference Participants of the same Session.

### 6.2 Application role

Requests run as `plenum_app`: no ownership, `NOBYPASSRLS`, `SELECT`/`INSERT`/`UPDATE` only, no `DELETE` or `TRUNCATE`. Locally the server switches with `SET LOCAL ROLE`; in production it connects as a login role with the same grants (ADR-015).

### 6.3 Append-only enforcement

`UPDATE` is revoked from `plenum_app` on immutable tables, and `BEFORE UPDATE OR DELETE` and `BEFORE TRUNCATE` triggers raise an error for every role, including the owner. Corrections are compensating records (INV-015). A database superuser can still disable triggers; tamper evidence against privileged actors depends on independent Anchors (ADR-003).

### 6.4 Row-level security

Every table with `organization_id` has forced row-level security comparing it with the transaction setting `app.organization_id`, which the server sets from authenticated context in the same transaction. With no setting, no rows are visible. Information asymmetry inside a Session is enforced by the application, not by row-level security (ADR-015).

## 7. Collaboration storage

`collaborative_documents` holds one row per project, branch and document key, with an access-controlled snapshot and its digest. `document_updates` stores immutable CRDT updates with update ID, author, client context, size and digest. Update arrival order is not assumed to be causal order. Snapshot compaction requires verified recovery and keeps the update history governance requires. Publication: take a fenced publish lock on the project, materialize the merged documents exactly, run full validation, commit an immutable Definition Revision with its digest, then compile the Release; updates arriving after the freeze belong to the next Draft state (ADR-002).

## 8. Client state and projections

A client keeps an encrypted local store where the platform allows: offline snapshots, Offline Outbox, Command results, projection cursor and drafts. Browser storage alone does not meet high-assurance requirements (REQ-008, OPEN-014). No adjudication is committed locally (INV-018). Server-side `projection_snapshots` record scope, projection revision, policy revision, expiry, disclosure policy and digest; deltas are filtered per Participant so that neither content nor metadata of hidden events leaks. Snapshot and cursor history are bounded; an expired cursor forces a fresh authorized snapshot.

## 9. Evidence custody

Checkpoints cover non-overlapping, ordered sequence ranges and chain to the previous checkpoint digest. Hashing uses a declared canonical serialization (`canonicalization` column), never raw JSONB text. Signatures record key ID and algorithm; private keys live outside the database under segregated custody, with institution-controlled key systems in air-gapped profiles. Anchors are held by an independent custodian. Proof export reports gaps, missing anchors, revoked keys and chain failures (06 §10).

## 10. Transaction and locking rules

1. **Lock order:** Session Authority row → Command Receipt lookup → target aggregate row → evidence sequence row. All Commands for a Session serialize on the Session Authority row, so concurrent retries of the same Command cannot both execute.
2. **Authority:** inside the transaction, the authority row must be `active` and name this Deployment; otherwise the request fails with `AUTHORITY_UNAVAILABLE` and nothing is recorded.
3. **Idempotency:** an existing receipt with the same canonical digest and the same Principal is returned as `replayed`; anything else with that Command ID is `IDEMPOTENCY_COLLISION`.
4. **Evaluation:** Session status, Active Role Context, target visibility, Governing Release, expected version, transition and required fields — using the target's Governing Release definition.
5. **Write:** state change (none for a rejection), Evidence Event with the next sequence, Command Receipt referencing that sequence, and outbox row — one transaction. Rollback leaves no sequence gap.
6. **No external calls** while the transaction is open; plugins and notifications run after commit from the outbox.

## 11. Migrations, recovery and capacity

- Production migrations follow expand → backfill → switch → contract, rehearsed on representative old data; dropping a column is never assumed reversible.
- Backups cover PostgreSQL and object storage consistently; restores verify the evidence sequence, checkpoints, signatures and anchors, and report any proof that cannot be recovered (REQ-066).
- Partition evidence and outbox tables only after measurements justify it; choose session-scoped indexes and retention from measured workload (OPEN-019).

## 12. Tests in the reference slice

| Test file | Covers |
|---|---|
| `test/domain.test.mjs` | Definition validation and data-driven transitions |
| `test/smoke.mjs` | End-to-end Commands, receipts, projections and evidence |
| `test/db.test.mjs` | Tenant isolation, append-only enforcement, concurrent idempotency, authority fencing |

## 13. Acceptance criteria

| ID | Criterion | Status (2026-10-17, PostgreSQL 16 local run) |
|---|---|---|
| DB-01 | Cross-tenant reads and writes are refused under the real application role and pooled connections. | Pass (`db.test` ×3, smoke cross-tenant check) |
| DB-02 | State, Evidence Event, outbox and receipt commit or roll back together. | Pass for accepted and rejected Commands (smoke, `db.test` concurrency) |
| DB-03 | Two conflicting adjudications cannot both commit. | Partial: version conflicts proven for Artifact transitions; adjudication tables not yet built |
| DB-04 | Same Command ID and digest returns the same result; different digest is refused. | Pass (including six concurrent retries) |
| DB-05 | Release, revision and evidence rows are immutable; every Artifact references its Governing Release. | Pass |
| DB-06 | An independent anchor detects a changed or missing event. | Not implemented |
| DB-07 | A revoked Participant receives no new protected projection. | Not implemented (no revocation endpoint) |
| DB-08 | An expired cursor triggers a safe snapshot resynchronization. | Not implemented |
| DB-09 | Schema upgrades preserve reading of old data. | Not run |
| DB-10 | The load fixture meets agreed capacity targets. | One local PS-540 characterization run completed with zero integrity mismatch but substantial database waiting and command/Floor latency failures against the approved targets; soak and clean reruns remain required. |
| DB-11 | A second accepted Ballot for one Seat Assignment cannot commit when revoting is off; an open Poll's frozen fields cannot change. | Not implemented |
| DB-12 | At most one active Floor Lease exists per push-to-talk channel under concurrent requests. | Not implemented |
| DB-13 | An Effect Proposal is applied at most once, and only with a matching Approval Decision. | Not implemented |

## 14. Operational parameters

OPEN-014, OPEN-015 and OPEN-017 resolve the managed-device, signing-key custody, offline credential/Command, RPO/RTO and independent-anchor parameters. Their implementation and operational evidence remain required. Open parameters are PostgreSQL minor version pinning and hosting (ADR-009), classification boundary (OPEN-024), Package signing (OPEN-020), secret-ballot key custody (OPEN-028), recording retention (OPEN-027) and plugin signing keys (OPEN-029).

## Change log

| Version | Date | Change |
|---|---|---|
| 1.1.3 | 2026-10-23 | Recorded resolved OPEN-014/015/017 operational policy and separated approved values from remaining open parameters. |
| 1.1.4 | 2026-11-01 | Applied resolved OPEN-013 to Template, Release approval and live-activation review provenance; additive enforcement remains assigned to PS-760 migration 030. |
| 1.1.2 | 2026-10-21 | Recorded DEC-61 Reviewer and Research Analyst roles and the explicit migration gap from the implemented four-role constraint. |
| 1.1.1 | 2026-10-17 | Added `voting`, `comms` and `extension` schemas (ADR-016) with entity catalogs §4.7 to §4.9 and DB-11 to DB-13. |
| 1.1.0 | 2026-10-17 | Adopted Glossary terms; added persons, Organization Role memberships and seat assignments (DEC-44); moved Release-defined identifiers out of `CHECK` constraints (DEC-45); added project-consistency foreign keys, application role, append-only triggers and corrected row-level security; recorded rejected and reconciliation receipts with evidence (DEC-43); split checkpoint storage into batches, signatures and anchors; replaced inline SQL with the tested migrations 001–004; added entity catalog with implementation status and acceptance test status. |
| 1.0.0 | 2026-10-17 | Initial proposal (archived). |
| 1.1.5 | 2026-11-08 | Aligned authority-transfer, single-Action and per-recipient Inject decision references; no database schema or migration change. |
