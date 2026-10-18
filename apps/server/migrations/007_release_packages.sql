-- Plenum 007: immutable Release Package manifests and publication approvals.
-- Sources: REQ-021 to REQ-023, INV-005, INV-012, INV-013, INV-028; OPEN-012/013/020 remain open.

CREATE UNIQUE INDEX definition_revisions_one_content_per_project
  ON studio.definition_revisions (organization_id, project_id, snapshot_sha256);

CREATE TABLE registry.release_approvals (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  release_id uuid NOT NULL,
  approver_person_id uuid NOT NULL REFERENCES identity.persons(id),
  decision text NOT NULL CHECK (decision = 'approved'),
  notes text NOT NULL DEFAULT '',
  decided_at timestamptz NOT NULL,
  UNIQUE (organization_id, release_id, approver_person_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE registry.package_manifests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  release_id uuid NOT NULL,
  contract_id text NOT NULL CHECK (contract_id = 'package-import-v1'),
  manifest jsonb NOT NULL,
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  package_sha256 text NOT NULL CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  publication_status text NOT NULL CHECK (publication_status = 'published'),
  publication_controls jsonb NOT NULL,
  signature bytea,
  signing_key_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, release_id),
  UNIQUE (organization_id, package_sha256),
  FOREIGN KEY (organization_id, release_id) REFERENCES registry.releases(organization_id, id),
  CHECK ((signature IS NULL) = (signing_key_id IS NULL))
);

GRANT SELECT, INSERT ON registry.release_approvals, registry.package_manifests TO plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY['registry.release_approvals','registry.package_manifests'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s '
      'USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) '
      'WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
    EXECUTE format('CREATE TRIGGER refuse_update_delete BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
  END LOOP;
END
$$;
