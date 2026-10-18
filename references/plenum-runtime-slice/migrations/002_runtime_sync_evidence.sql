-- Plenum 002: runtime, sync and evidence.
-- Source: PostgreSQL Logical Data Model v1.1 §4 and §5.

CREATE TABLE runtime.sessions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  project_id uuid NOT NULL,
  initial_release_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('created','configured','ready','open','active','paused','completed','locked','archived')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id, initial_release_id)
    REFERENCES registry.releases(organization_id, project_id, id)
);

CREATE TABLE runtime.session_authorities (
  session_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  deployment_id uuid NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  status text NOT NULL CHECK (status IN ('active','transfer_pending','fenced','unavailable')),
  modified_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

-- The activated release must belong to the same project as the session.
CREATE TABLE runtime.release_activations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  session_id uuid NOT NULL,
  release_id uuid NOT NULL,
  previous_activation_id uuid,
  activation_sequence bigint NOT NULL CHECK (activation_sequence > 0),
  compatibility_policy jsonb NOT NULL,
  approved_by uuid NOT NULL REFERENCES identity.persons(id),
  activated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, activation_sequence),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, id),
  FOREIGN KEY (organization_id, project_id, session_id) REFERENCES runtime.sessions(organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id, release_id) REFERENCES registry.releases(organization_id, project_id, id),
  FOREIGN KEY (organization_id, session_id, previous_activation_id) REFERENCES runtime.release_activations(organization_id, session_id, id)
);

CREATE TABLE runtime.participants (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, id),
  UNIQUE (session_id, person_id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

-- Session Roles come from the Release; the application validates session_role_id against it.
CREATE TABLE runtime.seat_assignments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  session_role_id text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  assigned_by uuid NOT NULL REFERENCES identity.persons(id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id) REFERENCES runtime.participants(organization_id, session_id, id)
);
CREATE UNIQUE INDEX seat_assignments_one_active_per_role
  ON runtime.seat_assignments (participant_id, session_role_id) WHERE valid_to IS NULL;

-- Workflow Instance is stored inline (one workflow per artifact in v1.1).
CREATE TABLE runtime.artifact_instances (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  artifact_type_key text NOT NULL,
  workflow_key text NOT NULL,
  form_version text NOT NULL,
  creator_participant_id uuid NOT NULL,
  state text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  visible_role_ids text[] NOT NULL DEFAULT '{}',
  version bigint NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id),
  FOREIGN KEY (organization_id, session_id, creator_participant_id) REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE TABLE sync.devices (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  registered_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (organization_id, id)
);

CREATE TABLE sync.command_receipts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  command_id uuid NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  device_id uuid NOT NULL,
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  actor_participant_id uuid NOT NULL,
  active_session_role_id text,
  authority_epoch bigint NOT NULL,
  operation_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('received','accepted','rejected','needs_reconciliation')),
  result_version bigint,
  evidence_sequence bigint,
  rejection_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (session_id, command_id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, device_id) REFERENCES sync.devices(organization_id, id),
  FOREIGN KEY (organization_id, session_id, actor_participant_id) REFERENCES runtime.participants(organization_id, session_id, id),
  CHECK ((status = 'accepted') = (rejection_code IS NULL))
);

CREATE TABLE evidence.session_sequences (
  session_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  next_sequence bigint NOT NULL DEFAULT 1 CHECK (next_sequence > 0),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE evidence.events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  event_version integer NOT NULL DEFAULT 1,
  command_id uuid,
  actor_person_id uuid REFERENCES identity.persons(id),
  actor_participant_id uuid,
  governing_release_id uuid NOT NULL,
  authority_epoch bigint NOT NULL,
  body jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, sequence),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id),
  FOREIGN KEY (organization_id, session_id, actor_participant_id) REFERENCES runtime.participants(organization_id, session_id, id)
);

-- Checkpoint schema only; no signer or anchor producer is implemented in the slice.
CREATE TABLE evidence.checkpoint_batches (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  first_sequence bigint NOT NULL CHECK (first_sequence > 0),
  last_sequence bigint NOT NULL,
  previous_checkpoint_digest text CHECK (previous_checkpoint_digest ~ '^[0-9a-f]{64}$'),
  batch_merkle_root text NOT NULL CHECK (batch_merkle_root ~ '^[0-9a-f]{64}$'),
  canonicalization text NOT NULL,
  algorithm text NOT NULL,
  checkpoint_digest text NOT NULL CHECK (checkpoint_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (last_sequence >= first_sequence),
  UNIQUE (session_id, first_sequence),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE evidence.checkpoint_signatures (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  checkpoint_id uuid NOT NULL,
  signing_key_id text NOT NULL,
  signature_algorithm text NOT NULL,
  signature bytea NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, checkpoint_id) REFERENCES evidence.checkpoint_batches(organization_id, id)
);

CREATE TABLE evidence.anchor_receipts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  checkpoint_id uuid NOT NULL,
  anchor_endpoint text NOT NULL,
  anchor_reference text NOT NULL,
  anchored_digest text NOT NULL CHECK (anchored_digest ~ '^[0-9a-f]{64}$'),
  verification_result text NOT NULL CHECK (verification_result IN ('pending','verified','failed')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, checkpoint_id) REFERENCES evidence.checkpoint_batches(organization_id, id)
);

CREATE TABLE sync.session_delta_outbox (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  event_id uuid NOT NULL UNIQUE,
  publication_status text NOT NULL DEFAULT 'pending' CHECK (publication_status IN ('pending','published','dead_lettered')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, event_id) REFERENCES evidence.events(organization_id, id)
);

CREATE INDEX command_receipts_session_status ON sync.command_receipts (session_id, status, received_at);
CREATE INDEX artifact_instances_session_state ON runtime.artifact_instances (session_id, state);
CREATE INDEX seat_assignments_session ON runtime.seat_assignments (session_id, participant_id);
CREATE INDEX session_delta_outbox_pending ON sync.session_delta_outbox (publication_status, created_at);
