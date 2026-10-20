-- Plenum 015: persistent CRDT collaboration, validation freezes and publication fencing.
-- Sources: PS-300, REQ-001, REQ-011, REQ-021, REQ-043, ADR-002 and ADR-010 (Proposed).

ALTER TABLE studio.collaborative_documents
  ADD COLUMN generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0),
  ADD COLUMN state_vector bytea,
  ADD COLUMN materialized_document jsonb,
  ADD COLUMN update_count bigint NOT NULL DEFAULT 0 CHECK (update_count >= 0);

ALTER TABLE studio.document_updates
  ADD COLUMN generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0);

UPDATE studio.collaborative_documents document
   SET materialized_document = draft.document
  FROM studio.drafts draft
 WHERE draft.organization_id = document.organization_id
   AND draft.project_id = document.project_id
   AND document.materialized_document IS NULL;

CREATE INDEX document_updates_rate_limit
  ON studio.document_updates (organization_id, document_id, author_person_id, received_at DESC);

CREATE TABLE studio.publication_freezes (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  document_id uuid NOT NULL,
  generation bigint NOT NULL CHECK (generation > 0),
  state_vector bytea NOT NULL,
  state_vector_sha256 text NOT NULL CHECK (state_vector_sha256 ~ '^[0-9a-f]{64}$'),
  materialization jsonb NOT NULL,
  materialization_sha256 text NOT NULL CHECK (materialization_sha256 ~ '^[0-9a-f]{64}$'),
  validation_report jsonb NOT NULL,
  frozen_update_count bigint NOT NULL CHECK (frozen_update_count >= 0),
  frozen_by uuid NOT NULL REFERENCES identity.persons(id),
  frozen_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, project_id, generation),
  UNIQUE (organization_id, project_id, materialization_sha256),
  FOREIGN KEY (organization_id, project_id) REFERENCES studio.simulation_projects(organization_id, id),
  FOREIGN KEY (organization_id, document_id) REFERENCES studio.collaborative_documents(organization_id, id)
);

ALTER TABLE studio.definition_revisions
  ADD COLUMN source_freeze_id uuid,
  ADD CONSTRAINT definition_revision_source_freeze
    FOREIGN KEY (organization_id, source_freeze_id) REFERENCES studio.publication_freezes(organization_id, id),
  ADD CONSTRAINT definition_revision_source_freeze_unique UNIQUE (organization_id, source_freeze_id);

GRANT SELECT, INSERT, UPDATE ON studio.collaborative_documents TO plenum_app;
GRANT SELECT, INSERT ON studio.document_updates, studio.publication_freezes TO plenum_app;

ALTER TABLE studio.publication_freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio.publication_freezes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON studio.publication_freezes
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE, TRUNCATE ON studio.publication_freezes FROM plenum_app;
CREATE TRIGGER publication_freezes_refuse_update_delete
  BEFORE UPDATE OR DELETE ON studio.publication_freezes
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER publication_freezes_refuse_truncate
  BEFORE TRUNCATE ON studio.publication_freezes
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
