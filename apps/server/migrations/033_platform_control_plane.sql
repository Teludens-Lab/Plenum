-- Plenum 033: Platform Administrator authority and Organization provisioning lifecycle.
-- Platform authority is intentionally separate from Organization Roles. Platform
-- administrators can provision Organization boundaries without acquiring access to
-- customer Projects, Releases, Sessions, or evidence.

ALTER TABLE identity.organizations
  ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('pending', 'active', 'suspended', 'offboarded')),
  ADD COLUMN lifecycle_version bigint NOT NULL DEFAULT 1 CHECK (lifecycle_version > 0),
  ADD COLUMN activated_at timestamptz,
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN offboarded_at timestamptz;

CREATE TABLE identity.platform_role_assignments (
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  platform_role text NOT NULL CHECK (platform_role = 'platform_administrator'),
  assigned_by uuid REFERENCES identity.persons(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (person_id, platform_role)
);

CREATE FUNCTION identity.current_platform_administrator() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM identity.platform_role_assignments assignment
     WHERE assignment.person_id = nullif(current_setting('app.platform_actor_id', true), '')::uuid
       AND assignment.platform_role = 'platform_administrator'
       AND assignment.revoked_at IS NULL
  )
$function$;

REVOKE ALL ON FUNCTION identity.current_platform_administrator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.current_platform_administrator() TO plenum_app;

CREATE TABLE identity.organization_provisioning (
  organization_id uuid PRIMARY KEY REFERENCES identity.organizations(id),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legal_name text NOT NULL,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  time_zone text NOT NULL,
  deployment_profile text NOT NULL CHECK (deployment_profile IN ('cloud', 'self_hosted', 'air_gapped')),
  data_residency_region text NOT NULL,
  entitlements text[] NOT NULL CHECK (cardinality(entitlements) > 0),
  support_contact text NOT NULL,
  security_contact text,
  configured_by uuid NOT NULL REFERENCES identity.persons(id),
  configured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity.organization_domains (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  domain text NOT NULL CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'),
  verification_method text NOT NULL CHECK (verification_method IN ('dns_txt', 'manual_contract')),
  verification_reference text,
  verified_by uuid REFERENCES identity.persons(id),
  verified_at timestamptz,
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, domain),
  UNIQUE (domain)
);

CREATE TABLE identity.first_admin_invitations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  email text NOT NULL CHECK (email = lower(email)),
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  invited_by uuid NOT NULL REFERENCES identity.persons(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_person_id uuid REFERENCES identity.persons(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((accepted_at IS NULL) = (accepted_person_id IS NULL))
);

CREATE UNIQUE INDEX first_admin_invitation_pending
  ON identity.first_admin_invitations (organization_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE evidence.platform_audit_records (
  id uuid PRIMARY KEY,
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  action text NOT NULL,
  resource_organization_id uuid REFERENCES identity.organizations(id),
  target_ref text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_audit_resource_time
  ON evidence.platform_audit_records (resource_organization_id, recorded_at DESC);

REVOKE ALL ON identity.platform_role_assignments FROM plenum_app;
GRANT SELECT, INSERT, UPDATE ON identity.organization_provisioning TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON identity.organization_domains TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON identity.first_admin_invitations TO plenum_app;
GRANT SELECT, INSERT ON evidence.platform_audit_records TO plenum_app;
REVOKE UPDATE, DELETE, TRUNCATE ON evidence.platform_audit_records FROM plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'identity.organization_provisioning',
    'identity.organization_domains'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY platform_administrator_only ON %s USING (identity.current_platform_administrator()) WITH CHECK (identity.current_platform_administrator())',
      table_ref
    );
  END LOOP;
END
$$;

-- Invitation acceptance is a narrowly granted SECURITY DEFINER operation. These
-- tables keep application-role RLS but intentionally do not FORCE the table owner
-- through the policy, so the definer can complete the one-time atomic acceptance.
ALTER TABLE identity.first_admin_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_administrator_only ON identity.first_admin_invitations
  USING (identity.current_platform_administrator())
  WITH CHECK (identity.current_platform_administrator());
ALTER TABLE evidence.platform_audit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_administrator_only ON evidence.platform_audit_records
  USING (identity.current_platform_administrator())
  WITH CHECK (identity.current_platform_administrator());

ALTER TABLE identity.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_or_platform_scope ON identity.organizations
  USING (
    id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR identity.current_platform_administrator()
  )
  WITH CHECK (
    id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR identity.current_platform_administrator()
  );

CREATE TRIGGER platform_audit_records_refuse_update_delete
  BEFORE UPDATE OR DELETE ON evidence.platform_audit_records
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER platform_audit_records_refuse_truncate
  BEFORE TRUNCATE ON evidence.platform_audit_records
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();

CREATE FUNCTION identity.accept_first_admin_invitation(
  invitation_token_sha256 text,
  new_person_id uuid,
  new_display_name text,
  request_correlation_id uuid
) RETURNS TABLE (organization_id uuid, organization_name text, person_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity, evidence
AS $function$
DECLARE
  invitation identity.first_admin_invitations%ROWTYPE;
  organization_name_value text;
BEGIN
  IF invitation_token_sha256 !~ '^[0-9a-f]{64}$'
     OR length(trim(new_display_name)) < 2
     OR length(trim(new_display_name)) > 200 THEN
    RETURN;
  END IF;

  SELECT candidate.*
    INTO invitation
    FROM identity.first_admin_invitations candidate
    JOIN identity.organizations organization ON organization.id = candidate.organization_id
   WHERE candidate.token_sha256 = invitation_token_sha256
     AND candidate.accepted_at IS NULL
     AND candidate.revoked_at IS NULL
     AND candidate.expires_at > transaction_timestamp()
     AND organization.lifecycle_status = 'pending'
   FOR UPDATE OF candidate;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO identity.persons(id, display_name)
  VALUES (new_person_id, trim(new_display_name));
  INSERT INTO identity.memberships(organization_id, person_id, organization_role)
  VALUES (invitation.organization_id, new_person_id, 'admin');
  UPDATE identity.first_admin_invitations
     SET accepted_at = transaction_timestamp(), accepted_person_id = new_person_id
   WHERE id = invitation.id;
  SELECT name INTO organization_name_value
    FROM identity.organizations WHERE id = invitation.organization_id;
  INSERT INTO evidence.platform_audit_records(
    id, actor_person_id, action, resource_organization_id, target_ref, after_state, details
  ) VALUES (
    gen_random_uuid(), new_person_id, 'platform.first_admin_invitation_accepted',
    invitation.organization_id, 'first_admin_invitation:' || invitation.id,
    jsonb_build_object('status', 'accepted'),
    jsonb_build_object('correlationId', request_correlation_id)
  );
  RETURN QUERY SELECT invitation.organization_id, organization_name_value, new_person_id;
END
$function$;

REVOKE ALL ON FUNCTION identity.accept_first_admin_invitation(text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.accept_first_admin_invitation(text, uuid, text, uuid) TO plenum_app;
