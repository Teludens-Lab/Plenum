-- Plenum 017: Session access, Seat staffing, Guest/Display principals and readiness.
-- Sources: REQ-018, REQ-045..049, REQ-069, INV-001/002; Platform 20; Runtime 2/4.

ALTER TABLE sync.command_receipts ALTER COLUMN actor_participant_id DROP NOT NULL;

ALTER TABLE runtime.seat_assignments
  ADD COLUMN team_id text,
  ADD COLUMN exclusive boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX seat_assignments_one_active_exclusive_seat
  ON runtime.seat_assignments (organization_id, session_id, seat_id)
  WHERE valid_to IS NULL AND exclusive;

CREATE TABLE identity.session_invitations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  session_id uuid NOT NULL,
  token_sha256 text NOT NULL CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  recipient_person_id uuid REFERENCES identity.persons(id),
  seat_id text,
  expires_at timestamptz NOT NULL,
  issued_by uuid NOT NULL REFERENCES identity.persons(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, token_sha256),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE identity.guest_identities (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  session_id uuid NOT NULL,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 200),
  seat_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  approved_by uuid NOT NULL REFERENCES identity.persons(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE identity.display_principals (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  session_id uuid NOT NULL,
  interface_profile_id text NOT NULL,
  classification_ceiling text NOT NULL,
  credential_sha256 text NOT NULL CHECK (credential_sha256 ~ '^[0-9a-f]{64}$'),
  credential_expires_at timestamptz NOT NULL,
  activated_by uuid NOT NULL REFERENCES identity.persons(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, credential_sha256),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE runtime.session_access_configs (
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  access_policy jsonb NOT NULL,
  session_code_sha256 text CHECK (session_code_sha256 IS NULL OR session_code_sha256 ~ '^[0-9a-f]{64}$'),
  assignment_version bigint NOT NULL DEFAULT 1 CHECK (assignment_version > 0),
  configured_by uuid NOT NULL REFERENCES identity.persons(id),
  configured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, session_id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE runtime.session_operators (
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  assigned_by uuid NOT NULL REFERENCES identity.persons(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (organization_id, session_id, person_id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE runtime.session_seats (
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  seat_id text NOT NULL,
  session_role_ids text[] NOT NULL CHECK (cardinality(session_role_ids) > 0),
  team_id text,
  min_occupancy integer NOT NULL CHECK (min_occupancy >= 0),
  max_occupancy integer CHECK (max_occupancy IS NULL OR max_occupancy >= min_occupancy),
  required boolean NOT NULL,
  join_mode text NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','reserved','occupied','vacated','disabled')),
  PRIMARY KEY (organization_id, session_id, seat_id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE runtime.join_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  invitation_id uuid,
  requested_seat_id text,
  status text NOT NULL CHECK (status IN ('assignment_pending','waiting_room','admitted','rejected','revoked','expired')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES identity.persons(id),
  decided_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, invitation_id) REFERENCES identity.session_invitations(organization_id, id)
);

CREATE TABLE runtime.roster_import_rows (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  import_id uuid NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 0),
  person_id uuid REFERENCES identity.persons(id),
  team_id text,
  session_role_id text,
  seat_id text,
  status text NOT NULL CHECK (status IN ('ready','review')),
  review_reasons text[] NOT NULL DEFAULT '{}',
  imported_by uuid NOT NULL REFERENCES identity.persons(id),
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, import_id, row_number),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id)
);

CREATE TABLE runtime.session_readiness_checks (
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  check_key text NOT NULL,
  label text NOT NULL,
  blocking boolean NOT NULL,
  governing_release_id uuid NOT NULL,
  assignment_version bigint NOT NULL CHECK (assignment_version > 0),
  completed_by uuid REFERENCES identity.persons(id),
  completed_at timestamptz,
  PRIMARY KEY (organization_id, session_id, check_key),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE INDEX session_invitations_active ON identity.session_invitations
  (organization_id, session_id, expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX join_requests_queue ON runtime.join_requests (organization_id, session_id, status, submitted_at);
CREATE INDEX roster_rows_review ON runtime.roster_import_rows (organization_id, session_id, status, imported_at);

GRANT SELECT, INSERT, UPDATE ON identity.session_invitations, identity.guest_identities, identity.display_principals TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON runtime.session_access_configs, runtime.session_operators, runtime.session_seats,
  runtime.join_requests, runtime.roster_import_rows, runtime.session_readiness_checks TO plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'identity.session_invitations','identity.guest_identities','identity.display_principals',
    'runtime.session_access_configs','runtime.session_operators','runtime.session_seats',
    'runtime.join_requests','runtime.roster_import_rows','runtime.session_readiness_checks'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
  END LOOP;
END
$$;
