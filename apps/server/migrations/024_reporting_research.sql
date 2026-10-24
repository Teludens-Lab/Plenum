-- Plenum 024: versioned reporting, research consent, retention, corrections and portable archives.
-- Sources: PS-520, REQ-054..062, INV-013/015/016.

CREATE SCHEMA IF NOT EXISTS reporting;
GRANT USAGE ON SCHEMA reporting TO plenum_app;

CREATE TABLE reporting.report_definitions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  definition_key text NOT NULL,
  definition_version integer NOT NULL CHECK (definition_version > 0),
  report_kind text NOT NULL CHECK (report_kind IN ('session_archive','after_action','team','control','research_dataset','organization_archive')),
  contract jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, definition_key, definition_version),
  UNIQUE (organization_id, id)
);

CREATE TABLE reporting.measurement_definitions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  measurement_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  research_question text NOT NULL,
  definition jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, measurement_key, version),
  UNIQUE (organization_id, id)
);

CREATE TABLE reporting.research_consents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  purpose_label text NOT NULL CHECK (length(trim(purpose_label)) BETWEEN 1 AND 400),
  consent_version text NOT NULL CHECK (length(trim(consent_version)) BETWEEN 1 AND 100),
  decision text NOT NULL CHECK (decision IN ('granted','withdrawn')),
  recorded_by uuid NOT NULL REFERENCES identity.persons(id),
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE TABLE reporting.retention_policies (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  policy_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  scope_type text NOT NULL CHECK (scope_type IN ('organization','project','artifact_type','message_channel','voice_channel','poll','session','export')),
  scope_reference text NOT NULL,
  period_days integer NOT NULL CHECK (period_days > 0),
  legal_hold_behavior text NOT NULL CHECK (legal_hold_behavior IN ('retain','block_action')),
  expiry_action text NOT NULL CHECK (expiry_action IN ('archive','anonymize','delete')),
  archive_destination text NOT NULL,
  approval_required boolean NOT NULL,
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, policy_key, version),
  UNIQUE (organization_id, id)
);

CREATE TABLE reporting.analytical_records (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  layer text NOT NULL CHECK (layer IN ('analytical_note','finding')),
  content jsonb NOT NULL,
  source_references text[] NOT NULL CHECK (cardinality(source_references) > 0),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  limitations text NOT NULL DEFAULT '',
  analyst_person_id uuid NOT NULL REFERENCES identity.persons(id),
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE reporting.corrections (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  target_reference text NOT NULL,
  original_value jsonb NOT NULL,
  corrected_value jsonb NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 4000),
  reports_must_regenerate boolean NOT NULL,
  corrected_by uuid NOT NULL REFERENCES identity.persons(id),
  corrected_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id)
);

CREATE TABLE reporting.export_jobs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  session_id uuid,
  project_id uuid,
  definition_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  format text NOT NULL CHECK (format IN ('json','jsonl','csv','html','pdf','zip')),
  status text NOT NULL CHECK (status = 'completed'),
  requested_by uuid NOT NULL REFERENCES identity.persons(id),
  completed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES studio.simulation_projects(organization_id, id),
  FOREIGN KEY (organization_id, definition_id) REFERENCES reporting.report_definitions(organization_id, id),
  CHECK (session_id IS NOT NULL OR project_id IS NOT NULL)
);

CREATE TABLE reporting.export_artifacts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  job_id uuid NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  bytes bytea NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, job_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, job_id) REFERENCES reporting.export_jobs(organization_id, id)
);

CREATE TABLE reporting.organization_imports (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  source_package_sha256 text NOT NULL CHECK (source_package_sha256 ~ '^[0-9a-f]{64}$'),
  source_manifest jsonb NOT NULL,
  imported_by uuid NOT NULL REFERENCES identity.persons(id),
  imported_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, source_package_sha256),
  UNIQUE (organization_id, id)
);

CREATE INDEX report_exports_session ON reporting.export_jobs (organization_id, session_id, completed_at DESC);
CREATE INDEX research_consents_current ON reporting.research_consents
  (organization_id, session_id, participant_id, purpose_label, recorded_at DESC);
CREATE INDEX analytical_records_session ON reporting.analytical_records (organization_id, session_id, layer, recorded_at);

GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA reporting TO plenum_app;

DO $$
DECLARE table_ref regclass;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'reporting.report_definitions'::regclass, 'reporting.measurement_definitions'::regclass,
    'reporting.research_consents'::regclass, 'reporting.retention_policies'::regclass,
    'reporting.analytical_records'::regclass, 'reporting.corrections'::regclass,
    'reporting.export_jobs'::regclass, 'reporting.export_artifacts'::regclass,
    'reporting.organization_imports'::regclass
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %s FROM plenum_app', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_update_delete BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
  END LOOP;
END $$;
