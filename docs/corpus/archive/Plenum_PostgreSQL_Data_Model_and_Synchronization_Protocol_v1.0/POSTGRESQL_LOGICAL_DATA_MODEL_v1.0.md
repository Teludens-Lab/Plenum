# Plenum — PostgreSQL Logical Data Model v1.0

**Status:** Implementation-grade proposed specification under product-owner-approved architecture decisions; implementation and operational security controls unverified. **Date:** 2026-10-17. **Normative precedence:** enterprise PRD v0.6 (+ controlled v0.6a amendment on incorporation), Canonical Simulation Schema v1.2, API/Event Contracts v1.2, Platform/Runtime/Data Security v1.2, and Foundation v0.2. In case of disagreement, preserve governing product semantics and flag a contract conflict; do not silently change it. SQL below is a *reference design*, not an applied migration.

## 1. Database goals and boundaries

- One PostgreSQL transactional system of record **per authoritative deployment**; no concurrent cloud and LAN writers to the same session.
- Reference planning envelope: 10 simultaneous sessions × up to 500 participants each. This is not a verified throughput/SLA. Size tests must include reconnect storms, peak submissions, active projections, and export load.
- Separate `identity`, `studio`, `registry`, `runtime`, `sync`, `evidence`; cross-schema foreign keys permitted within one DB. Organization-level isolation in the database and permission-specific projection policy in domain services.
- Never store uploaded assets or package binaries directly in core relational rows: use immutable, checksum-verified object blobs with scoped metadata in PostgreSQL. Retention and legal holds require policy approval.
- The enterprise PRD's distinction between Simulation Project, Core Design, Scenario, Release and Session is canonical. Database shorthand `simulation_project` is not equivalent to a session, and an authored revision is not an executable Release.
- An in-progress workflow or artifact must retain its governing Release and definition identifiers. Release activation does not rewrite history.

## 2. Canonical logical entities

| Schema | Aggregate/root | Important entities and ownership |
|---|---|---|
| identity | Organization | `organizations`, `persons`, `organization_memberships`, `federated_identities`, `deployment_registrations`; multi-tenant identity and scoped membership |
| studio | Simulation Project | `simulation_projects`, `core_designs`, `scenarios`, `draft_branches`, `collaborative_documents`, `document_updates`, `definition_revisions`; mutable drafts vs immutable snapshots |
| registry | Simulation Release | `releases`, `package_manifests`, `package_blobs`, `release_compatibility`; published immutable, content-digested compiler output |
| runtime | Session | `sessions`, `session_authorities`, `authority_transfers`, `release_activations`, `participants`, `seats`, `seat_assignments`, `artifact_instances`, `artifact_versions`, `workflow_instances`, `adjudications` |
| sync | Session + device | `devices`, `command_receipts`, `session_delta_outbox`, `client_sync_cursors`, `projection_snapshots`, `projection_grants` |
| evidence | Session evidence sequence | `events`, `checkpoint_batches`, `checkpoint_signatures`, `anchor_receipts`, `evidence_export_jobs`; event data and proof custody |

All tenant-owned root tables have `organization_id`; children must be scoped via composite foreign keys `(organization_id,parent_id)` or rigorously checked parent association. Never trust `organization_id` from request bodies.

## 3. Conventions and invariants

- Primary IDs: UUIDs (UUIDv7 may be used only after library/DB compatibility review). Domain references use UUID, not database sequence keys across deployments. Time: UTC `timestamptz`; separate server receipt time, commit time, and nonauthoritative `device_observed_at`.
- Mutable aggregates use `version bigint NOT NULL DEFAULT 0 CHECK (version>=0)`; each successful mutation advances version once, guarded by matching expected version or row lock. Document updates use their own CRDT ordering semantics, not aggregate-version updates for every keystroke.
- `UNIQUE(organization_id,id)` on each root referenced through scoped FKs; `UNIQUE(session_id,command_id)` for replay-safe commands; `(session_id,sequence)` unique and strictly allocated under a serialized session append operation for authoritative evidence.
- `releases`, `definition_revisions`, `evidence.events`, completed signing checkpoints are immutable by application contract, role permissions, and tested DB-level guardrails. Governance correction is a new record, never silent overwrite.
- Never put dynamic authorization expressions directly into arbitrarily executable SQL sourced from authored configuration. Policies compile to a bounded, validated policy evaluator.
- `jsonb` holds schema-governed artifact payloads, CRDT update metadata, definition/presentation fragments and event contextual data; identity, status, ownership, release refs, adjudication and relevant joins remain relational. Avoid EAV.

## 4. Reference PostgreSQL DDL: critical vertical slice

The following is deliberately executable-looking, but **must be converted into versioned migrations and validated on the chosen PostgreSQL version**. It covers the core vertical slice, not every supporting entity in §2.

```sql
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS studio;
CREATE SCHEMA IF NOT EXISTS registry;
CREATE SCHEMA IF NOT EXISTS runtime;
CREATE SCHEMA IF NOT EXISTS sync;
CREATE SCHEMA IF NOT EXISTS evidence;

CREATE TABLE identity.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE studio.simulation_projects (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id)
);
CREATE TABLE studio.definition_revisions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  parent_revision_id uuid,
  snapshot jsonb NOT NULL,
  snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  methodology_version text NOT NULL,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES studio.simulation_projects(organization_id,id),
  FOREIGN KEY (organization_id,parent_revision_id) REFERENCES studio.definition_revisions(organization_id,id)
);
CREATE TABLE registry.releases (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  definition_revision_id uuid NOT NULL,
  release_label text NOT NULL,
  package_schema_version text NOT NULL,
  compiler_version text NOT NULL,
  package_sha256 text NOT NULL CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  blob_key text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,project_id,release_label),
  FOREIGN KEY (organization_id,project_id) REFERENCES studio.simulation_projects(organization_id,id),
  FOREIGN KEY (organization_id,definition_revision_id) REFERENCES studio.definition_revisions(organization_id,id)
);
CREATE TABLE runtime.sessions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  project_id uuid NOT NULL,
  initial_release_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('created','configured','ready','open','active','paused','completed','locked','archived')),
  version bigint NOT NULL DEFAULT 0 CHECK (version>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES studio.simulation_projects(organization_id,id),
  FOREIGN KEY (organization_id,initial_release_id) REFERENCES registry.releases(organization_id,id)
);
CREATE TABLE runtime.session_authorities (
  session_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  deployment_id uuid NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  status text NOT NULL CHECK (status IN ('active','transfer_pending','fenced','unavailable')),
  modified_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id)
);
CREATE TABLE runtime.release_activations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  release_id uuid NOT NULL,
  previous_activation_id uuid REFERENCES runtime.release_activations(id),
  activation_sequence bigint NOT NULL,
  compatibility_policy jsonb NOT NULL,
  approved_by uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id,activation_sequence),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id),
  FOREIGN KEY (organization_id,release_id) REFERENCES registry.releases(organization_id,id)
);
CREATE TABLE runtime.artifact_instances (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  artifact_definition_key text NOT NULL,
  creator_participant_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','submitted','in_review','returned','accepted','archived')),
  payload jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 0 CHECK (version>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id),
  FOREIGN KEY (organization_id,governing_release_id) REFERENCES registry.releases(organization_id,id)
);
CREATE TABLE runtime.workflow_instances (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  workflow_definition_key text NOT NULL,
  status text NOT NULL,
  current_node_key text NOT NULL,
  version bigint NOT NULL DEFAULT 0 CHECK (version>=0),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id),
  FOREIGN KEY (organization_id,governing_release_id) REFERENCES registry.releases(organization_id,id)
);
CREATE TABLE sync.command_receipts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  command_id uuid NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  device_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  authority_epoch bigint NOT NULL,
  operation_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('received','accepted','rejected','needs_reconciliation')),
  result_version bigint,
  rejection_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (session_id,command_id),
  FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id)
);
CREATE TABLE evidence.session_sequences (
  session_id uuid PRIMARY KEY,
  next_sequence bigint NOT NULL DEFAULT 1 CHECK (next_sequence>0),
  FOREIGN KEY (session_id) REFERENCES runtime.sessions(id)
);
CREATE TABLE evidence.events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK (sequence>0),
  command_id uuid,
  event_type text NOT NULL,
  actor_id uuid,
  governing_release_id uuid,
  authority_epoch bigint NOT NULL,
  body jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id,sequence),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id),
  FOREIGN KEY (organization_id,governing_release_id) REFERENCES registry.releases(organization_id,id)
);
CREATE TABLE sync.session_delta_outbox (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  event_id uuid NOT NULL,
  publication_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id),
  FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id),
  FOREIGN KEY (organization_id,event_id) REFERENCES evidence.events(organization_id,id)
);
CREATE INDEX ON sync.command_receipts (session_id,status,received_at);
CREATE INDEX ON evidence.events (session_id,sequence);
CREATE INDEX ON runtime.artifact_instances (session_id,status);
CREATE INDEX ON runtime.workflow_instances (session_id,status);
CREATE INDEX ON sync.session_delta_outbox (publication_status,created_at);
```

**Important SQL limitation:** These DDL excerpts do not by themselves prove release/project/session consistency or actor eligibility. Application/domain invariants and explicit composite constraints/triggers where appropriate must validate `initial_release_id` belongs to the session project, `release_activations` references the same session project, and `previous_activation_id` belongs to the same session. `creator_participant_id`, `actor_id`, and `device_id` are placeholders for relationships to the fully modeled identity/session-membership/device tables. Add those foreign keys before implementation. Install restrictive ownership/GRANTs and immutable-row triggers before production. Reject use of this excerpt as a complete production migration.

## 5. Collaboration storage

`studio.collaborative_documents` has `(organization_id, project_id, branch_id, document_key)` uniqueness, an access-controlled ACL, `schema_version`, and materialization pointer. `studio.document_updates` persists immutable binary Yjs/CRDT updates with `document_id`, `update_id`, `client_context`, `received_at`, content digest, and size. Do not assume a global human-readable update order denotes CRDT causal order. Snapshot compaction is performed with verified recovery, retaining append history as required by governance. On publish: establish fenced publish epoch, freeze an exact merged materialization, run full semantic validation, commit an immutable revision with hash, then compile Release; edits after freeze go to the next draft state.

## 6. Sync/client state and projections

A local client maintains its own encrypted-at-rest platform-managed store when feasible (`offline_snapshots`, `outbox_commands`, `command_results`, `projection_cursor`, `drafts`). IndexedDB is a browser option but cannot, by itself, satisfy high-assurance classified-device requirements. No authoritative adjudication is committed locally. The server's `projection_snapshots` retain per-principal scope and projection revision, expiration, disclosure policy, content digest and publication cursor. Event delivery is a filtered projection; unauthorized events and even metadata must never leak. Retention of snapshots and cursor history is bounded; expired cursors trigger a fresh authorized snapshot.

## 7. Signed evidence and custody

`evidence.checkpoint_batches` records `(session_id, first_sequence, last_sequence, previous_checkpoint_digest, batch_merkle_root, algorithm, checkpoint_digest, created_at)` with nonoverlapping ordered ranges. `evidence.checkpoint_signatures` records signing key ID, signature algorithm and signature bytes; `evidence.anchor_receipts` references independent retention endpoint, anchor identity, digest, verification result, and timestamp. Store private signing material outside DB, under segregated key custody; in air-gap profiles use approved institution-controlled key systems. Chain/hash across a canonical versioned serialization (raw JSONB textual output is not a stable canonicalization contract). Append-only evidence cannot prevent privileged tampering without externally protected anchors. Proof export must report gaps, missing anchors, revoked keys and trust-chain failures.

## 8. Tenancy, permissions and privacy

RLS must be enabled on applicable tenant tables with forced policies where required, and app DB roles must not own/bypass tenant tables or hold BYPASSRLS. Scoped FK/queries and server authorization remain mandatory. Authenticated user context is mapped by trusted middleware into transaction-local DB session variables; test connection pooling to prevent tenant context leak. Use tested source-level field projections and default-deny information policy for role/team/seat/phase/time access. Cached offline confidential material is inherently harder to revoke once delivered; strict expiry plus managed-device controls are required for high-security use.

## 9. Transaction and locking rules

1. Acquire idempotency identity and verify payload digest; simultaneous matching retries must serialize around a unique `(session_id,command_id)` record or equivalent transactional lock.
2. Lock session authority + target aggregate with a deterministic lock order; check `authority_epoch` matches committed session authority and deployment identity. Authority cannot be trusted from client claims.
3. Evaluate ACL, runtime policy, release compatibility, deadlines against server receipt/commit policy, and expected aggregate version.
4. Write aggregate and history/version, evidence event and command result atomically. Allocate per-session evidence sequence under locked counter row; rollback leaves no gap *for rolled back transactions*.
5. Write transactional outbox entry in same transaction. Deliver later at least once, deduplicate by event ID, and filter per current authorization.
6. Never make an external network call while holding the aggregate database transaction open.

## 10. Migrations, recovery, indexes, and capacity

- Apply versioned migrations using expand → backfill → switch → contract; test representative old schema and rolling compatibility. Never assume dropping a column is reversible.
- DB backups and object asset backups require integrity-consistent restore strategy; restores must preserve package objects, evidence sequence, signatures, and anchors; otherwise explicitly report unrecoverable proofs.
- Partition high-volume evidence/notification data only after benchmark; choose session scoping and retention/index strategy from measured workload.
- Test query isolation, hostile tenant IDs, simultaneous adjudications, duplicate retry collisions, release activation while device offline, loss of push delivery, and recovery after authority transfer.
- Security-owner to ratify offline device encryption/identity lifecycle, key custody and retention; operations owner to ratify RPO/RTO, backup, transfer runbook and institutional installs.

## 11. Implementable acceptance criteria

**DB-01** Cross-tenant reads/writes rejected under real app DB role and pooled connections. **DB-02** Artifact+evidence+outbox+receipt commit or rollback as one. **DB-03** Concurrent conflicting adjudications cannot both commit. **DB-04** Same command ID+same digest returns same result; different digest rejected. **DB-05** Release/revision rows immutable and every workflow references governing release. **DB-06** Signed anchor detects changed/missing event or digest. **DB-07** A revoked participant receives no new protected server projection. **DB-08** Old cursor causes safe snapshot resync. **DB-09** Schema upgrade preserves old-data read/forward compatibility. **DB-10** Load fixture meets measured capacity acceptance targets once targets are agreed.

## 12. Explicitly open operational parameters

Exact PostgreSQL major version, hosting provider, production RPO/RTO, signing key HSM/KMS design, regulated/classified accreditation boundary, offline identity TTL, max outbox/snapshot retention, accepted device types, package cryptographic signing policy, and detailed synchronization transport are operational parameters to finalize with the designated owners. Their absence does not reopen approved product requirements or authority invariants.
