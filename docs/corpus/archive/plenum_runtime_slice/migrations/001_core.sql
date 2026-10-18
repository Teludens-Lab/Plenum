-- Plenum 001 core schema, source: POSTGRESQL_LOGICAL_DATA_MODEL_v1.0.md §4
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
