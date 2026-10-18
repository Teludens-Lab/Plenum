-- Plenum 003: collaborative Studio draft storage (schema only; no CRDT server in the slice).
-- Source: PostgreSQL Logical Data Model v1.1 §7.

CREATE TABLE studio.collaborative_documents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  branch_key text NOT NULL,
  document_key text NOT NULL,
  schema_version text NOT NULL,
  snapshot bytea,
  snapshot_sha256 text CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id, branch_key, document_key),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES studio.simulation_projects(organization_id, id)
);

CREATE TABLE studio.document_updates (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL,
  update_id uuid NOT NULL,
  author_person_id uuid NOT NULL REFERENCES identity.persons(id),
  client_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  bytes bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, update_id),
  FOREIGN KEY (organization_id, document_id) REFERENCES studio.collaborative_documents(organization_id, id)
);
