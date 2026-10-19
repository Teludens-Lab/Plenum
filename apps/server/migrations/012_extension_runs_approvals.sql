-- Plenum 012: isolated Model Runs, staged Effect Proposals, Approval Decisions and effect receipts.
-- Sources: REQ-036, REQ-038, REQ-088, REQ-091 to REQ-093; INV-008, INV-020, INV-026, INV-028; DEC-54; ADR-018.

CREATE TABLE extension.composition_runs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  trigger_command_id uuid NOT NULL,
  graph_digest text NOT NULL CHECK (graph_digest ~ '^sha256:[0-9a-f]{64}$'),
  input_snapshot_id uuid NOT NULL,
  input_snapshot jsonb NOT NULL,
  input_digest text NOT NULL CHECK (input_digest ~ '^sha256:[0-9a-f]{64}$'),
  execution_policy jsonb NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  status text NOT NULL CHECK (status IN ('pending','running','completed','failed','cancelled')),
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, trigger_command_id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE extension.model_runs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  composition_run_id uuid NOT NULL,
  binding_id uuid NOT NULL,
  artifact_digest text NOT NULL CHECK (artifact_digest ~ '^sha256:[0-9a-f]{64}$'),
  configuration_digest text NOT NULL CHECK (configuration_digest ~ '^sha256:[0-9a-f]{64}$'),
  governing_release_id uuid NOT NULL,
  input_snapshot_id uuid NOT NULL,
  input_digest text NOT NULL CHECK (input_digest ~ '^sha256:[0-9a-f]{64}$'),
  output_digest text CHECK (output_digest IS NULL OR output_digest ~ '^sha256:[0-9a-f]{64}$'),
  environment_digest text CHECK (environment_digest IS NULL OR environment_digest ~ '^sha256:[0-9a-f]{64}$'),
  seed bigint NOT NULL CHECK (seed >= 0),
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms >= 0),
  status text NOT NULL CHECK (status IN ('pending','running','completed','failed')),
  failure_code text CHECK (failure_code IS NULL OR failure_code IN ('timeout','output_invalid','execution_failed')),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, composition_run_id, binding_id, attempt),
  FOREIGN KEY (organization_id, composition_run_id) REFERENCES extension.composition_runs(organization_id, id),
  FOREIGN KEY (organization_id, binding_id) REFERENCES extension.plugin_bindings(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE extension.effect_proposals (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  model_run_id uuid NOT NULL,
  proposal_hash text NOT NULL CHECK (proposal_hash ~ '^sha256:[0-9a-f]{64}$'),
  target_aggregate_id uuid NOT NULL,
  target_state_variable_id text NOT NULL,
  scope_reference text NOT NULL DEFAULT '',
  operation text NOT NULL CHECK (operation IN ('set','adjust')),
  value jsonb NOT NULL,
  rationale text NOT NULL CHECK (length(rationale) BETWEEN 1 AND 2000),
  reviewer_role_ids text[] NOT NULL CHECK (cardinality(reviewer_role_ids) > 0),
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN ('staged','in_review','applied','rejected','returned','stale','failed')),
  expected_state_version bigint NOT NULL CHECK (expected_state_version >= 0),
  governing_release_id uuid NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  artifact_digest text NOT NULL CHECK (artifact_digest ~ '^sha256:[0-9a-f]{64}$'),
  configuration_digest text NOT NULL CHECK (configuration_digest ~ '^sha256:[0-9a-f]{64}$'),
  input_digest text NOT NULL CHECK (input_digest ~ '^sha256:[0-9a-f]{64}$'),
  output_digest text NOT NULL CHECK (output_digest ~ '^sha256:[0-9a-f]{64}$'),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  staged_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, model_run_id, proposal_hash),
  FOREIGN KEY (organization_id, model_run_id) REFERENCES extension.model_runs(organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, target_aggregate_id) REFERENCES runtime.state_values(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE extension.approval_decisions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  proposal_hash text NOT NULL CHECK (proposal_hash ~ '^sha256:[0-9a-f]{64}$'),
  reviewer_person_id uuid NOT NULL REFERENCES identity.persons(id),
  reviewer_participant_id uuid NOT NULL,
  reviewer_session_role_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','reject','return')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  governing_release_id uuid NOT NULL,
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  expected_state_version bigint NOT NULL CHECK (expected_state_version >= 0),
  command_id uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, proposal_id),
  UNIQUE (organization_id, session_id, command_id),
  FOREIGN KEY (organization_id, proposal_id) REFERENCES extension.effect_proposals(organization_id, id),
  FOREIGN KEY (organization_id, session_id, reviewer_participant_id) REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE extension.effect_receipts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  proposal_id uuid NOT NULL,
  approval_decision_id uuid NOT NULL,
  command_id uuid NOT NULL,
  applied_state_version bigint NOT NULL CHECK (applied_state_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, proposal_id),
  UNIQUE (organization_id, session_id, command_id),
  FOREIGN KEY (organization_id, proposal_id) REFERENCES extension.effect_proposals(organization_id, id),
  FOREIGN KEY (organization_id, approval_decision_id) REFERENCES extension.approval_decisions(organization_id, id)
);

CREATE INDEX composition_runs_session_status ON extension.composition_runs (organization_id, session_id, status, created_at);
CREATE INDEX model_runs_composition ON extension.model_runs (organization_id, composition_run_id, attempt);
CREATE INDEX effect_proposals_review ON extension.effect_proposals (organization_id, session_id, lifecycle_status, staged_at);
CREATE INDEX approval_decisions_session ON extension.approval_decisions (organization_id, session_id, decided_at);

GRANT SELECT, INSERT, UPDATE (status, completed_at) ON extension.composition_runs TO plenum_app;
GRANT SELECT, INSERT, UPDATE (status, failure_code, output_digest, environment_digest, duration_ms, started_at, completed_at) ON extension.model_runs TO plenum_app;
GRANT SELECT, INSERT, UPDATE (lifecycle_status, version, decided_at) ON extension.effect_proposals TO plenum_app;
GRANT SELECT, INSERT ON extension.approval_decisions, extension.effect_receipts TO plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'extension.composition_runs', 'extension.model_runs', 'extension.effect_proposals',
    'extension.approval_decisions', 'extension.effect_receipts'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY organization_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
    EXECUTE format('CREATE TRIGGER refuse_delete BEFORE DELETE ON %s FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
  END LOOP;
END
$$;

CREATE TRIGGER approval_decisions_append_only BEFORE UPDATE ON extension.approval_decisions
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER effect_receipts_append_only BEFORE UPDATE ON extension.effect_receipts
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
