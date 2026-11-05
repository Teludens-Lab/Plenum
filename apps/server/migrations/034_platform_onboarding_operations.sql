-- Plenum 034: operational Organization onboarding.
-- Additive expansion plus an explicit legacy reconciliation state. Existing
-- Organizations are made visible without inventing deployment or contact facts.

ALTER TABLE identity.organization_provisioning
  ADD COLUMN configuration_status text NOT NULL DEFAULT 'complete'
    CHECK (configuration_status IN ('complete', 'needs_reconciliation'));

ALTER TABLE identity.organization_provisioning
  DROP CONSTRAINT organization_provisioning_deployment_profile_check,
  DROP CONSTRAINT organization_provisioning_entitlements_check,
  ALTER COLUMN country_code DROP NOT NULL,
  ALTER COLUMN time_zone DROP NOT NULL,
  ALTER COLUMN data_residency_region DROP NOT NULL,
  ALTER COLUMN support_contact DROP NOT NULL,
  ALTER COLUMN configured_by DROP NOT NULL;

ALTER TABLE identity.organization_provisioning
  ADD CONSTRAINT organization_provisioning_deployment_profile_check
    CHECK (deployment_profile IN ('unconfigured', 'cloud', 'self_hosted', 'air_gapped')),
  ADD CONSTRAINT organization_provisioning_complete_check CHECK (
    configuration_status = 'needs_reconciliation'
    OR (
      deployment_profile <> 'unconfigured'
      AND country_code IS NOT NULL
      AND time_zone IS NOT NULL
      AND data_residency_region IS NOT NULL
      AND cardinality(entitlements) > 0
      AND support_contact IS NOT NULL
      AND configured_by IS NOT NULL
    )
  );

ALTER TABLE identity.organization_provisioning NO FORCE ROW LEVEL SECURITY;

INSERT INTO identity.organization_provisioning(
  organization_id, slug, legal_name, country_code, time_zone,
  deployment_profile, data_residency_region, entitlements, support_contact,
  security_contact, configured_by, configuration_status
)
SELECT organization.id,
       'legacy-' || replace(organization.id::text, '-', ''),
       organization.name,
       NULL,
       NULL,
       'unconfigured',
       NULL,
       ARRAY[]::text[],
       NULL,
       NULL,
       NULL,
       'needs_reconciliation'
  FROM identity.organizations organization
 WHERE NOT EXISTS (
   SELECT 1 FROM identity.organization_provisioning provisioning
    WHERE provisioning.organization_id = organization.id
 );

ALTER TABLE identity.organization_provisioning FORCE ROW LEVEL SECURITY;

ALTER TABLE identity.organization_domains
  ADD COLUMN challenge_name text,
  ADD COLUMN challenge_value text,
  ADD COLUMN challenge_issued_at timestamptz,
  ADD COLUMN challenge_expires_at timestamptz,
  ADD COLUMN verification_attempts integer NOT NULL DEFAULT 0 CHECK (verification_attempts >= 0),
  ADD COLUMN last_checked_at timestamptz,
  ADD COLUMN verification_failure text;

ALTER TABLE identity.organization_domains NO FORCE ROW LEVEL SECURITY;
UPDATE identity.organization_domains
   SET challenge_name = '_plenum-verification.' || domain,
       challenge_value = 'plenum-verification=' || replace(gen_random_uuid()::text, '-', ''),
       challenge_issued_at = transaction_timestamp(),
       challenge_expires_at = transaction_timestamp() + interval '72 hours'
 WHERE verification_method = 'dns_txt' AND verified_at IS NULL;
ALTER TABLE identity.organization_domains FORCE ROW LEVEL SECURITY;

ALTER TABLE identity.organization_domains
  ADD CONSTRAINT organization_domain_dns_challenge_check CHECK (
    verification_method <> 'dns_txt'
    OR verified_at IS NOT NULL
    OR (
      challenge_name IS NOT NULL
      AND challenge_value IS NOT NULL
      AND challenge_issued_at IS NOT NULL
      AND challenge_expires_at IS NOT NULL
      AND challenge_expires_at > challenge_issued_at
    )
  );

ALTER TABLE identity.first_admin_invitations
  ADD COLUMN identity_linked_at timestamptz,
  ADD COLUMN identity_issuer text,
  ADD COLUMN identity_subject_sha256 text
    CHECK (identity_subject_sha256 IS NULL OR identity_subject_sha256 ~ '^[0-9a-f]{64}$');

CREATE TABLE identity.first_admin_invitation_deliveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  invitation_id uuid NOT NULL REFERENCES identity.first_admin_invitations(id),
  recipient_email text NOT NULL CHECK (recipient_email = lower(recipient_email)),
  channel text NOT NULL CHECK (channel = 'email'),
  template_ref text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  provider_reference text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invitation_id)
);

CREATE INDEX first_admin_invitation_delivery_status
  ON identity.first_admin_invitation_deliveries (status, scheduled_at);

GRANT SELECT, INSERT, UPDATE ON identity.first_admin_invitation_deliveries TO plenum_app;
ALTER TABLE identity.first_admin_invitation_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.first_admin_invitation_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_administrator_only ON identity.first_admin_invitation_deliveries
  USING (identity.current_platform_administrator())
  WITH CHECK (identity.current_platform_administrator());

CREATE FUNCTION identity.bootstrap_platform_administrator(
  bootstrap_person_id uuid,
  request_correlation_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity, evidence
AS $function$
BEGIN
  LOCK TABLE identity.platform_role_assignments IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM identity.platform_role_assignments) THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM identity.memberships membership
      JOIN identity.organizations organization
        ON organization.id = membership.organization_id
     WHERE membership.person_id = bootstrap_person_id
       AND membership.organization_role = 'admin'
       AND organization.lifecycle_status = 'active'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO identity.platform_role_assignments(person_id, platform_role, assigned_by)
  VALUES (bootstrap_person_id, 'platform_administrator', bootstrap_person_id);
  INSERT INTO evidence.platform_audit_records(
    id, actor_person_id, action, target_ref, after_state, details
  ) VALUES (
    gen_random_uuid(), bootstrap_person_id, 'platform.platform_administrator_bootstrapped',
    'platform_role_assignment:' || bootstrap_person_id,
    jsonb_build_object('platformRole', 'platform_administrator', 'status', 'active'),
    jsonb_build_object('correlationId', request_correlation_id)
  );
  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION identity.bootstrap_platform_administrator(uuid, uuid) FROM PUBLIC;

CREATE FUNCTION identity.link_accepted_first_admin_oidc_identity(
  target_organization_id uuid,
  verified_issuer text,
  verified_subject text,
  verified_subject_sha256 text,
  verified_email text,
  request_correlation_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity, evidence
AS $function$
DECLARE
  linked_person_id uuid;
  invitation_id uuid;
BEGIN
  IF verified_subject_sha256 !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT invitation.accepted_person_id, invitation.id
    INTO linked_person_id, invitation_id
    FROM identity.first_admin_invitations invitation
    JOIN identity.organizations organization ON organization.id = invitation.organization_id
   WHERE invitation.organization_id = target_organization_id
     AND invitation.email = lower(trim(verified_email))
     AND invitation.accepted_at IS NOT NULL
     AND invitation.revoked_at IS NULL
     AND invitation.identity_linked_at IS NULL
     AND organization.lifecycle_status = 'active'
   ORDER BY invitation.accepted_at DESC
   LIMIT 1
   FOR UPDATE OF invitation;
  IF linked_person_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO identity.federated_identities(
    id, organization_id, person_id, issuer, subject, provider_type, last_authenticated_at
  ) VALUES (
    gen_random_uuid(), target_organization_id, linked_person_id,
    verified_issuer, verified_subject, 'oidc', transaction_timestamp()
  );
  UPDATE identity.first_admin_invitations
     SET identity_linked_at = transaction_timestamp(),
         identity_issuer = verified_issuer,
         identity_subject_sha256 = verified_subject_sha256
   WHERE id = invitation_id;
  INSERT INTO evidence.platform_audit_records(
    id, actor_person_id, action, resource_organization_id, target_ref, after_state, details
  ) VALUES (
    gen_random_uuid(), linked_person_id, 'platform.first_admin_identity_linked',
    target_organization_id, 'first_admin_invitation:' || invitation_id,
    jsonb_build_object('status', 'linked', 'issuer', verified_issuer),
    jsonb_build_object('correlationId', request_correlation_id)
  );
  RETURN linked_person_id;
EXCEPTION
  WHEN unique_violation THEN RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION identity.link_accepted_first_admin_oidc_identity(uuid, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.link_accepted_first_admin_oidc_identity(uuid, text, text, text, text, uuid) TO plenum_app;
