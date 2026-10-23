-- Plenum 020: explainable adjudication records and immutable Action revision attribution.
-- Sources: PS-410, REQ-036..040, INV-008/014/020; OPEN-018 resolved 2026-10-22.

CREATE TABLE runtime.artifact_revisions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  artifact_version bigint NOT NULL CHECK (artifact_version > 0),
  governing_release_id uuid NOT NULL,
  state text NOT NULL,
  payload jsonb NOT NULL,
  author_person_id uuid NOT NULL REFERENCES identity.persons(id),
  author_participant_id uuid NOT NULL,
  author_display_name text NOT NULL,
  author_organization_name text NOT NULL,
  command_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, artifact_id, artifact_version),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, artifact_id) REFERENCES runtime.artifact_instances(organization_id, id),
  FOREIGN KEY (organization_id, session_id, author_participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.artifact_revision_authors (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  artifact_revision_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  participant_id uuid NOT NULL,
  display_name text NOT NULL,
  organization_name text NOT NULL,
  is_command_actor boolean NOT NULL,
  author_order smallint NOT NULL CHECK (author_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artifact_revision_id, participant_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, artifact_revision_id) REFERENCES runtime.artifact_revisions(organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE runtime.adjudication_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  adjudication_model_id text NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','in_progress','drafted','published','cancelled','failed')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  requested_by_person_id uuid NOT NULL REFERENCES identity.persons(id),
  requested_by_participant_id uuid NOT NULL,
  requested_by_display_name text NOT NULL,
  requested_by_organization_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, session_id, requested_by_participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

-- One row is one immutable Action snapshot; a request may contain several rows.
CREATE TABLE runtime.adjudication_request_actions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  request_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  artifact_version bigint NOT NULL CHECK (artifact_version > 0),
  artifact_type_key text NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payload_snapshot jsonb NOT NULL,
  UNIQUE (request_id, artifact_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, request_id) REFERENCES runtime.adjudication_requests(organization_id, id),
  FOREIGN KEY (organization_id, artifact_id) REFERENCES runtime.artifact_instances(organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE runtime.adjudication_reviews (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  request_id uuid NOT NULL,
  perspective_id text NOT NULL,
  recommendation jsonb NOT NULL,
  rationale text NOT NULL CHECK (length(trim(rationale)) > 0),
  evidence_artifact_ids uuid[] NOT NULL DEFAULT '{}',
  hidden_analytical_notes text,
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reviewer_person_id uuid NOT NULL REFERENCES identity.persons(id),
  reviewer_participant_id uuid NOT NULL,
  reviewer_session_role_id text NOT NULL,
  reviewer_display_name text NOT NULL,
  reviewer_organization_name text NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, perspective_id, reviewer_person_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, request_id) REFERENCES runtime.adjudication_requests(organization_id, id),
  FOREIGN KEY (organization_id, session_id, reviewer_participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE runtime.adjudication_records (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  request_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  lifecycle_status text NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft','published')),
  mechanism text NOT NULL CHECK (mechanism IN ('manual','rubric','rules','plugin','hybrid')),
  outcome jsonb NOT NULL,
  rationale text NOT NULL CHECK (length(trim(rationale)) > 0),
  participant_rationale text NOT NULL CHECK (length(trim(participant_rationale)) > 0),
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  synthesis text NOT NULL CHECK (length(trim(synthesis)) > 0),
  explanation_trace jsonb NOT NULL,
  suggestion jsonb,
  override_rationale text,
  effects jsonb NOT NULL DEFAULT '[]'::jsonb,
  publication_scope jsonb NOT NULL,
  lead_person_id uuid NOT NULL REFERENCES identity.persons(id),
  lead_participant_id uuid NOT NULL,
  lead_session_role_id text NOT NULL,
  lead_display_name text NOT NULL,
  lead_organization_name text NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  drafted_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CHECK ((lifecycle_status='published') = (published_at IS NOT NULL)),
  CHECK (suggestion IS NULL OR outcome = suggestion OR length(trim(override_rationale)) > 0),
  UNIQUE (request_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, request_id) REFERENCES runtime.adjudication_requests(organization_id, id),
  FOREIGN KEY (organization_id, session_id, lead_participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.adjudication_deliveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  adjudication_record_id uuid NOT NULL,
  record_version bigint NOT NULL CHECK (record_version > 0),
  recipient_participant_id uuid NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  viewed_at timestamptz,
  acknowledged_at timestamptz,
  UNIQUE (adjudication_record_id, record_version, recipient_participant_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, adjudication_record_id)
    REFERENCES runtime.adjudication_records(organization_id, id),
  FOREIGN KEY (organization_id, session_id, recipient_participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE INDEX artifact_revisions_artifact ON runtime.artifact_revisions (artifact_id, artifact_version);
CREATE INDEX adjudication_requests_session ON runtime.adjudication_requests (session_id, status, updated_at);
CREATE INDEX adjudication_reviews_request ON runtime.adjudication_reviews (request_id, perspective_id, submitted_at);
CREATE INDEX adjudication_deliveries_recipient ON runtime.adjudication_deliveries (recipient_participant_id, released_at);

GRANT SELECT, INSERT ON runtime.artifact_revisions, runtime.artifact_revision_authors, runtime.adjudication_request_actions,
  runtime.adjudication_reviews TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON runtime.adjudication_requests, runtime.adjudication_records,
  runtime.adjudication_deliveries TO plenum_app;

DO $$
DECLARE table_ref regclass;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'runtime.artifact_revisions'::regclass, 'runtime.artifact_revision_authors'::regclass,
    'runtime.adjudication_requests'::regclass,
    'runtime.adjudication_request_actions'::regclass, 'runtime.adjudication_reviews'::regclass,
    'runtime.adjudication_records'::regclass, 'runtime.adjudication_deliveries'::regclass
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
  END LOOP;
END $$;

CREATE TRIGGER artifact_revisions_append_only BEFORE UPDATE OR DELETE ON runtime.artifact_revisions
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER artifact_revision_authors_append_only BEFORE UPDATE OR DELETE ON runtime.artifact_revision_authors
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER adjudication_actions_append_only BEFORE UPDATE OR DELETE ON runtime.adjudication_request_actions
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER adjudication_reviews_append_only BEFORE UPDATE OR DELETE ON runtime.adjudication_reviews
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER adjudication_deliveries_append_only BEFORE DELETE ON runtime.adjudication_deliveries
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
