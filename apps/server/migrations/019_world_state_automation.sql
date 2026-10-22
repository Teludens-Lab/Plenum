-- Plenum 019: bounded world-state instances and append-only transaction history.
-- Sources: PS-400, REQ-031, INV-014, INV-019; OPEN-005, OPEN-006 and PS-400 portions of OPEN-018 resolved 2026-10-22.

CREATE TABLE runtime.capability_instances (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  capability_id text NOT NULL,
  scope_reference text NOT NULL DEFAULT '',
  state text NOT NULL,
  quantity numeric CHECK (quantity IS NULL OR quantity >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, capability_id, scope_reference),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.resource_balances (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  resource_id text NOT NULL,
  scope_reference text NOT NULL DEFAULT '',
  balance numeric NOT NULL CHECK (balance >= 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, resource_id, scope_reference),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.state_transactions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('state_value','capability','resource')),
  target_id uuid NOT NULL,
  definition_id text NOT NULL,
  scope_reference text NOT NULL DEFAULT '',
  operation text NOT NULL CHECK (operation IN ('set','increment','decrement','multiply','transition','consume','renew','credit','debit')),
  previous_value jsonb NOT NULL,
  new_value jsonb NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('inject','stage','workflow','outcome','plugin','control_intervention')),
  source_reference text NOT NULL,
  source_command_id uuid NOT NULL,
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  rationale text NOT NULL CHECK (length(trim(rationale)) > 0),
  version bigint NOT NULL CHECK (version > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, source_command_id, target_kind, target_id, version),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.scheduled_state_effects (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  effect jsonb NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','applied','cancelled')),
  source_type text NOT NULL CHECK (source_type IN ('inject','stage','workflow','outcome','plugin','control_intervention')),
  source_reference text NOT NULL,
  source_command_id uuid NOT NULL,
  effect_index integer NOT NULL CHECK (effect_index >= 0),
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  rationale text NOT NULL CHECK (length(trim(rationale)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (session_id, source_command_id, source_reference, effect_index),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE INDEX capability_instances_session ON runtime.capability_instances (session_id, capability_id);
CREATE INDEX resource_balances_session ON runtime.resource_balances (session_id, resource_id);
CREATE INDEX state_transactions_session ON runtime.state_transactions (session_id, occurred_at, id);
CREATE INDEX state_transactions_source ON runtime.state_transactions (session_id, source_command_id);
CREATE INDEX scheduled_state_effects_due ON runtime.scheduled_state_effects (session_id, status, due_at, id);

GRANT SELECT, INSERT, UPDATE ON runtime.capability_instances, runtime.resource_balances TO plenum_app;
GRANT SELECT, INSERT ON runtime.state_transactions TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON runtime.scheduled_state_effects TO plenum_app;

ALTER TABLE runtime.capability_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime.capability_instances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runtime.capability_instances
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE runtime.resource_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime.resource_balances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runtime.resource_balances
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE runtime.state_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime.state_transactions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runtime.state_transactions
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

CREATE TRIGGER state_transactions_append_only
  BEFORE UPDATE OR DELETE ON runtime.state_transactions
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();

ALTER TABLE runtime.scheduled_state_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime.scheduled_state_effects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runtime.scheduled_state_effects
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
