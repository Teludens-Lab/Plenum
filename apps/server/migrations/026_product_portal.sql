-- Plenum 026: Organization-scoped Project portal and Simulation Template library.
-- Sources: PS-710; REQ-009, REQ-017, REQ-045, REQ-047, REQ-048, REQ-052; INV-001, INV-007; DEC-04, DEC-61.

CREATE TABLE studio.simulation_templates (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 1000),
  source_project_id uuid NOT NULL,
  core_design jsonb NOT NULL,
  scenario jsonb,
  published_by uuid NOT NULL REFERENCES identity.persons(id),
  published_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, source_project_id)
    REFERENCES studio.simulation_projects(organization_id, id)
);

ALTER TABLE studio.simulation_projects
  ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'archived')),
  ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by uuid REFERENCES identity.persons(id),
  ADD COLUMN source_template_id uuid,
  ADD CONSTRAINT simulation_projects_archive_state CHECK (
    (lifecycle_status = 'active' AND archived_at IS NULL AND archived_by IS NULL) OR
    (lifecycle_status = 'archived' AND archived_at IS NOT NULL AND archived_by IS NOT NULL)
  ),
  ADD CONSTRAINT simulation_projects_source_template_fk
    FOREIGN KEY (organization_id, source_template_id)
    REFERENCES studio.simulation_templates(organization_id, id);

CREATE TABLE studio.project_collaborators (
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  project_role text NOT NULL CHECK (project_role IN ('owner', 'designer', 'publisher', 'reviewer')),
  added_by uuid NOT NULL REFERENCES identity.persons(id),
  added_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_id, project_id, person_id, project_role),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES studio.simulation_projects(organization_id, id)
);

INSERT INTO studio.project_collaborators
  (organization_id, project_id, person_id, project_role, added_by, added_at)
SELECT organization_id, id, created_by, 'owner', created_by, created_at
FROM studio.simulation_projects;

CREATE TABLE studio.project_mutation_receipts (
  organization_id uuid NOT NULL,
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  request_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('project.create', 'project.archive', 'project.reopen')),
  project_id uuid NOT NULL,
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  response jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_id, actor_person_id, request_id),
  FOREIGN KEY (organization_id, project_id)
    REFERENCES studio.simulation_projects(organization_id, id)
);

CREATE INDEX simulation_projects_portal_list
  ON studio.simulation_projects (organization_id, lifecycle_status, updated_at DESC, id DESC);
CREATE INDEX simulation_templates_library_list
  ON studio.simulation_templates (organization_id, published_at DESC, id DESC);
CREATE INDEX project_collaborators_project
  ON studio.project_collaborators (organization_id, project_id, person_id);

GRANT SELECT, INSERT ON studio.simulation_templates TO plenum_app;
GRANT SELECT, INSERT ON studio.project_collaborators TO plenum_app;
GRANT SELECT, INSERT ON studio.project_mutation_receipts TO plenum_app;
REVOKE DELETE, TRUNCATE ON studio.simulation_templates, studio.project_collaborators, studio.project_mutation_receipts FROM plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'studio.simulation_templates',
    'studio.project_collaborators',
    'studio.project_mutation_receipts'
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

REVOKE UPDATE ON studio.project_mutation_receipts FROM plenum_app;
CREATE TRIGGER simulation_templates_refuse_update_delete
  BEFORE UPDATE OR DELETE ON studio.simulation_templates
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER simulation_templates_refuse_truncate
  BEFORE TRUNCATE ON studio.simulation_templates
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER project_mutation_receipts_refuse_update_delete
  BEFORE UPDATE OR DELETE ON studio.project_mutation_receipts
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER project_mutation_receipts_refuse_truncate
  BEFORE TRUNCATE ON studio.project_mutation_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
