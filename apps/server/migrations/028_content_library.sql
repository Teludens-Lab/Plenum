-- Plenum 028: project-scoped governed Content Library and immutable upload versions.
-- Sources: PS-740; REQ-009, REQ-011, REQ-016, REQ-050; INV-001, INV-004.

CREATE TABLE studio.content_items (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  current_version integer NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES studio.simulation_projects(organization_id, id)
);

CREATE TABLE studio.content_versions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  content_item_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  file_name text NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (length(trim(media_type)) BETWEEN 1 AND 100),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 524288),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  blob_key text NOT NULL CHECK (length(blob_key) BETWEEN 1 AND 500),
  scan_status text NOT NULL CHECK (scan_status IN ('quarantined','clean','infected','failed')),
  scan_detail text NOT NULL DEFAULT '' CHECK (length(scan_detail) <= 1000),
  available_at timestamptz,
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, content_item_id, version),
  FOREIGN KEY (organization_id, project_id, content_item_id)
    REFERENCES studio.content_items(organization_id, project_id, id),
  CHECK ((scan_status = 'clean') = (available_at IS NOT NULL))
);

CREATE TABLE studio.content_upload_receipts (
  organization_id uuid NOT NULL,
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  request_id uuid NOT NULL,
  project_id uuid NOT NULL,
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  response jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_id, actor_person_id, request_id),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES studio.simulation_projects(organization_id, id)
);

CREATE INDEX content_items_project ON studio.content_items (organization_id, project_id, updated_at DESC, id);
CREATE INDEX content_versions_item ON studio.content_versions (organization_id, content_item_id, version DESC);

GRANT SELECT, INSERT, UPDATE (title, current_version, updated_at) ON studio.content_items TO plenum_app;
GRANT SELECT, INSERT ON studio.content_versions, studio.content_upload_receipts TO plenum_app;
REVOKE DELETE, TRUNCATE ON studio.content_items, studio.content_versions, studio.content_upload_receipts FROM plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'studio.content_items', 'studio.content_versions', 'studio.content_upload_receipts'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s '
      'USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) '
      'WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
  END LOOP;
END
$$;

CREATE TRIGGER content_versions_refuse_update_delete
  BEFORE UPDATE OR DELETE ON studio.content_versions
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER content_versions_refuse_truncate
  BEFORE TRUNCATE ON studio.content_versions
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER content_upload_receipts_refuse_update_delete
  BEFORE UPDATE OR DELETE ON studio.content_upload_receipts
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER content_upload_receipts_refuse_truncate
  BEFORE TRUNCATE ON studio.content_upload_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
