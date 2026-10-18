-- Plenum 001: schemas, identity, studio and registry.
-- Source: PostgreSQL Logical Data Model v1.1 §4 and §5.
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

CREATE TABLE identity.persons (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Organization Roles only (DEC-44). Session Roles are assigned through runtime.seat_assignments.
CREATE TABLE identity.memberships (
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  organization_role text NOT NULL CHECK (organization_role IN ('admin','designer','publisher','operator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, person_id, organization_role)
);

CREATE TABLE studio.simulation_projects (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  title text NOT NULL,
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

-- One mutable Draft per project in the slice. Collaborative CRDT storage is in 003.
CREATE TABLE studio.drafts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  document jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by uuid NOT NULL REFERENCES identity.persons(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (project_id),
  FOREIGN KEY (organization_id, project_id) REFERENCES studio.simulation_projects(organization_id, id)
);

CREATE TABLE studio.definition_revisions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  parent_revision_id uuid,
  snapshot jsonb NOT NULL,
  snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  methodology_version text NOT NULL,
  author_id uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES studio.simulation_projects(organization_id, id),
  FOREIGN KEY (organization_id, project_id, parent_revision_id) REFERENCES studio.definition_revisions(organization_id, project_id, id)
);

CREATE TABLE registry.releases (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  definition_revision_id uuid NOT NULL UNIQUE,
  release_number integer NOT NULL CHECK (release_number > 0),
  release_label text NOT NULL,
  package_schema_version text NOT NULL,
  compiler_version text NOT NULL,
  package_sha256 text NOT NULL CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  blob_key text NOT NULL,
  published_by uuid NOT NULL REFERENCES identity.persons(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, project_id, id),
  UNIQUE (project_id, release_number),
  FOREIGN KEY (organization_id, project_id, definition_revision_id)
    REFERENCES studio.definition_revisions(organization_id, project_id, id)
);
