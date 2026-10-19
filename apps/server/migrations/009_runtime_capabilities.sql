-- Plenum 009: generic Stage, Inject, state and Control Intervention records.
-- Sources: REQ-024, REQ-025, REQ-030, REQ-031; INV-003, INV-004, INV-011.

ALTER TABLE runtime.artifact_instances ADD COLUMN owner_team_id text;
CREATE INDEX artifact_instances_session_team ON runtime.artifact_instances (session_id, owner_team_id);

CREATE TABLE runtime.session_stage_state (
  session_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  stage_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('not_started','active','paused','completed')),
  started_at timestamptz,
  paused_at timestamptz,
  accumulated_pause_seconds bigint NOT NULL DEFAULT 0 CHECK (accumulated_pause_seconds >= 0),
  extension_seconds bigint NOT NULL DEFAULT 0 CHECK (extension_seconds >= 0),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.stage_transition_history (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  from_stage_id text,
  to_stage_id text NOT NULL,
  operation_type text NOT NULL,
  reason text NOT NULL,
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  stage_version bigint NOT NULL CHECK (stage_version > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.control_interventions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  category text NOT NULL,
  reason text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.state_values (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  state_variable_id text NOT NULL,
  scope_reference text NOT NULL DEFAULT '',
  value jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, state_variable_id, scope_reference),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.inject_instances (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  inject_definition_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','released','cancelled')),
  released_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (session_id, inject_definition_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE INDEX stage_transition_history_session ON runtime.stage_transition_history (session_id, occurred_at);
CREATE INDEX control_interventions_session ON runtime.control_interventions (session_id, occurred_at);
CREATE INDEX state_values_session ON runtime.state_values (session_id, state_variable_id);
CREATE INDEX inject_instances_session_state ON runtime.inject_instances (session_id, state);

GRANT SELECT, INSERT, UPDATE ON runtime.session_stage_state, runtime.state_values, runtime.inject_instances TO plenum_app;
GRANT SELECT, INSERT ON runtime.stage_transition_history, runtime.control_interventions TO plenum_app;

DO $$
DECLARE table_ref regclass;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'runtime.session_stage_state'::regclass, 'runtime.stage_transition_history'::regclass,
    'runtime.control_interventions'::regclass, 'runtime.state_values'::regclass,
    'runtime.inject_instances'::regclass
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
  END LOOP;
END $$;
