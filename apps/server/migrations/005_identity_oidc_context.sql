-- Plenum 005: OIDC bindings, Authentication Sessions, access revisions and Audit Records.
-- Sources: REQ-045 to REQ-052; Platform sections 8, 9, 20 and 21; ADR-012 and ADR-015.

CREATE TABLE identity.federated_identities (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  issuer text NOT NULL,
  subject text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('oidc', 'saml', 'ldap')),
  last_authenticated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, issuer, subject),
  UNIQUE (organization_id, id)
);

CREATE TABLE identity.oidc_login_attempts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  provider_key text NOT NULL,
  state_sha256 text NOT NULL CHECK (state_sha256 ~ '^[0-9a-f]{64}$'),
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider_key, state_sha256),
  UNIQUE (organization_id, id)
);

CREATE TABLE identity.authentication_sessions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  issuer text NOT NULL,
  subject text NOT NULL,
  authentication_strength text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

ALTER TABLE runtime.seat_assignments
  ADD COLUMN seat_id text,
  ADD COLUMN ended_by uuid REFERENCES identity.persons(id),
  ADD COLUMN end_reason text;

CREATE TABLE runtime.participant_access_revisions (
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  access_revision bigint NOT NULL DEFAULT 1 CHECK (access_revision > 0),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, session_id, participant_id),
  FOREIGN KEY (organization_id, session_id, participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE TABLE sync.projection_grants (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  policy_revision text NOT NULL,
  access_revision bigint NOT NULL CHECK (access_revision > 0),
  granted_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE TABLE evidence.audit_records (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  action text NOT NULL,
  target_ref text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX federated_identities_subject
  ON identity.federated_identities (organization_id, issuer, subject);
CREATE INDEX authentication_sessions_active
  ON identity.authentication_sessions (organization_id, person_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX projection_grants_active
  ON sync.projection_grants (organization_id, session_id, participant_id)
  WHERE revoked_at IS NULL;
CREATE INDEX audit_records_organization_time
  ON evidence.audit_records (organization_id, recorded_at DESC);

GRANT SELECT, UPDATE ON identity.federated_identities TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON identity.oidc_login_attempts TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON identity.authentication_sessions TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON runtime.participant_access_revisions TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON sync.projection_grants TO plenum_app;
GRANT INSERT ON evidence.audit_records TO plenum_app;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON evidence.audit_records FROM plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'identity.federated_identities',
    'identity.oidc_login_attempts',
    'identity.authentication_sessions',
    'runtime.participant_access_revisions',
    'sync.projection_grants',
    'evidence.audit_records'
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

CREATE TRIGGER audit_records_refuse_update_delete
  BEFORE UPDATE OR DELETE ON evidence.audit_records
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER audit_records_refuse_truncate
  BEFORE TRUNCATE ON evidence.audit_records
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
