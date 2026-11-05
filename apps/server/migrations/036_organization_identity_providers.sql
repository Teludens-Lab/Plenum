-- Plenum 036: governed per-Organization identity-provider lifecycle.
-- Configuration revisions are append-only in practice: discovery and lifecycle
-- evidence may advance, but a replacement is always a new revision so an active
-- provider can be rolled back without reconstructing historical configuration.

CREATE TABLE identity.organization_identity_provider_revisions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  provider_key text NOT NULL CHECK (provider_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  version integer NOT NULL CHECK (version > 0),
  protocol text NOT NULL CHECK (protocol IN ('oidc', 'saml')),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 160),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'preflight_passed', 'tested', 'approved', 'active', 'suspended', 'superseded')),
  replaces_provider_id uuid REFERENCES identity.organization_identity_provider_revisions(id),
  discovery_url text NOT NULL,
  metadata_url text,
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 300),
  audience text NOT NULL CHECK (length(audience) BETWEEN 1 AND 300),
  issuer text,
  authorization_endpoint text,
  token_endpoint text,
  jwks_uri text,
  saml_entity_id text,
  saml_sso_url text,
  signing_key_fingerprints text[] NOT NULL DEFAULT ARRAY[]::text[],
  configuration_sha256 text CHECK (configuration_sha256 IS NULL OR configuration_sha256 ~ '^[0-9a-f]{64}$'),
  metadata_sha256 text CHECK (metadata_sha256 IS NULL OR metadata_sha256 ~ '^[0-9a-f]{64}$'),
  signing_keys_sha256 text CHECK (signing_keys_sha256 IS NULL OR signing_keys_sha256 ~ '^[0-9a-f]{64}$'),
  staged_by uuid NOT NULL REFERENCES identity.persons(id),
  staged_at timestamptz NOT NULL DEFAULT now(),
  preflighted_by uuid REFERENCES identity.persons(id),
  preflighted_at timestamptz,
  preflight_failure text,
  tested_by uuid REFERENCES identity.persons(id),
  tested_at timestamptz,
  approved_by uuid REFERENCES identity.persons(id),
  approved_at timestamptz,
  activated_by uuid REFERENCES identity.persons(id),
  activated_at timestamptz,
  suspended_by uuid REFERENCES identity.persons(id),
  suspended_at timestamptz,
  suspension_reason text,
  UNIQUE (organization_id, provider_key),
  UNIQUE (organization_id, version),
  UNIQUE (organization_id, id),
  CHECK ((protocol = 'oidc' AND metadata_url IS NULL) OR (protocol = 'saml' AND metadata_url IS NOT NULL)),
  CHECK (replaces_provider_id IS NULL OR replaces_provider_id <> id)
);

ALTER TABLE identity.organization_domains
  ADD CONSTRAINT organization_domains_organization_id_id_key UNIQUE (organization_id, id);

CREATE UNIQUE INDEX organization_identity_provider_active
  ON identity.organization_identity_provider_revisions (organization_id)
  WHERE status = 'active';
CREATE INDEX organization_identity_provider_history
  ON identity.organization_identity_provider_revisions (organization_id, version DESC);

CREATE TABLE identity.organization_identity_provider_domains (
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  provider_id uuid NOT NULL,
  domain_id uuid NOT NULL,
  PRIMARY KEY (provider_id, domain_id),
  FOREIGN KEY (organization_id, provider_id)
    REFERENCES identity.organization_identity_provider_revisions(organization_id, id),
  FOREIGN KEY (organization_id, domain_id)
    REFERENCES identity.organization_domains(organization_id, id)
);

ALTER TABLE identity.oidc_login_attempts
  ADD COLUMN identity_provider_id uuid,
  ADD COLUMN purpose text NOT NULL DEFAULT 'sign_in' CHECK (purpose IN ('sign_in', 'provider_test', 'platform_recovery')),
  ADD COLUMN initiated_by_person_id uuid REFERENCES identity.persons(id),
  ADD COLUMN initiating_session_id uuid REFERENCES identity.authentication_sessions(id),
  ADD CONSTRAINT oidc_login_attempt_provider_fk FOREIGN KEY (organization_id, identity_provider_id)
    REFERENCES identity.organization_identity_provider_revisions(organization_id, id),
  ADD CONSTRAINT oidc_provider_test_context CHECK (
    purpose <> 'provider_test'
    OR (identity_provider_id IS NOT NULL AND initiated_by_person_id IS NOT NULL AND initiating_session_id IS NOT NULL)
  );

-- Attempts created before this expansion used the deployment provider. Preserve
-- their callback behavior across a rolling deploy instead of misclassifying them
-- as customer-provider sign-ins.
UPDATE identity.oidc_login_attempts
   SET purpose = 'platform_recovery'
 WHERE identity_provider_id IS NULL;

ALTER TABLE identity.federated_identities
  ADD COLUMN identity_provider_id uuid,
  ADD COLUMN verified_email text CHECK (verified_email IS NULL OR verified_email = lower(verified_email)),
  ADD CONSTRAINT federated_identity_provider_fk FOREIGN KEY (organization_id, identity_provider_id)
    REFERENCES identity.organization_identity_provider_revisions(organization_id, id);

ALTER TABLE identity.authentication_sessions
  ADD COLUMN identity_provider_id uuid,
  ADD CONSTRAINT authentication_session_provider_fk FOREIGN KEY (organization_id, identity_provider_id)
    REFERENCES identity.organization_identity_provider_revisions(organization_id, id);

GRANT SELECT, INSERT, UPDATE ON identity.organization_identity_provider_revisions TO plenum_app;
GRANT SELECT, INSERT ON identity.organization_identity_provider_domains TO plenum_app;

ALTER TABLE identity.organization_identity_provider_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.organization_identity_provider_revisions FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_or_platform_scope ON identity.organization_identity_provider_revisions
  USING (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR identity.current_platform_administrator()
  )
  WITH CHECK (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR identity.current_platform_administrator()
  );

ALTER TABLE identity.organization_identity_provider_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.organization_identity_provider_domains FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_or_platform_scope ON identity.organization_identity_provider_domains
  USING (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR identity.current_platform_administrator()
  )
  WITH CHECK (
    organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
    OR identity.current_platform_administrator()
  );

CREATE FUNCTION identity.identity_provider_bound_domains(
  target_organization_id uuid,
  target_provider_id uuid
) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT COALESCE(array_agg(domain.domain ORDER BY domain.domain), ARRAY[]::text[])::text[]
    FROM identity.organization_identity_provider_domains binding
    JOIN identity.organization_domains domain
      ON domain.organization_id = binding.organization_id
     AND domain.id = binding.domain_id
   WHERE binding.organization_id = target_organization_id
     AND binding.provider_id = target_provider_id
$function$;

CREATE FUNCTION identity.identity_provider_accepts_email_domain(
  target_organization_id uuid,
  target_provider_id uuid,
  email_domain text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM identity.organization_identity_provider_revisions provider
      JOIN identity.organization_identity_provider_domains binding
        ON binding.organization_id = provider.organization_id
       AND binding.provider_id = provider.id
      JOIN identity.organization_domains domain
        ON domain.organization_id = binding.organization_id
       AND domain.id = binding.domain_id
     WHERE provider.organization_id = target_organization_id
       AND provider.id = target_provider_id
       AND provider.status = 'preflight_passed'
       AND domain.verified_at IS NOT NULL
       AND domain.domain = lower(email_domain)
  )
$function$;

REVOKE ALL ON FUNCTION identity.identity_provider_bound_domains(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.identity_provider_accepts_email_domain(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.identity_provider_bound_domains(uuid, uuid) TO plenum_app;
GRANT EXECUTE ON FUNCTION identity.identity_provider_accepts_email_domain(uuid, uuid, text) TO plenum_app;

CREATE FUNCTION identity.link_tested_identity_provider(
  target_organization_id uuid,
  target_provider_id uuid,
  target_person_id uuid,
  verified_issuer text,
  verified_subject text,
  verified_email text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
DECLARE
  affected integer;
BEGIN
  IF verified_email <> lower(verified_email)
     OR NOT identity.identity_provider_accepts_email_domain(
       target_organization_id,target_provider_id,split_part(verified_email,'@',2)
     )
     OR NOT EXISTS (
       SELECT 1 FROM identity.memberships membership
        WHERE membership.organization_id=target_organization_id
          AND membership.person_id=target_person_id
          AND membership.organization_role='admin'
     ) THEN
    RETURN false;
  END IF;

  INSERT INTO identity.federated_identities
    (id,organization_id,person_id,issuer,subject,provider_type,identity_provider_id,verified_email,last_authenticated_at)
  VALUES (gen_random_uuid(),target_organization_id,target_person_id,verified_issuer,verified_subject,
          'oidc',target_provider_id,verified_email,transaction_timestamp())
  ON CONFLICT (organization_id,issuer,subject) DO UPDATE
    SET identity_provider_id=EXCLUDED.identity_provider_id,
        verified_email=EXCLUDED.verified_email,
        last_authenticated_at=transaction_timestamp()
    WHERE federated_identities.person_id=EXCLUDED.person_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END
$function$;

REVOKE ALL ON FUNCTION identity.link_tested_identity_provider(uuid, uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.link_tested_identity_provider(uuid, uuid, uuid, text, text, text) TO plenum_app;

CREATE FUNCTION identity.resolve_active_identity_provider(
  organization_selector text,
  selector_is_domain boolean
) RETURNS TABLE (organization_id uuid, identity_provider_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT provider.organization_id, provider.id
    FROM identity.organization_identity_provider_revisions provider
    JOIN identity.organization_provisioning provisioning
      ON provisioning.organization_id = provider.organization_id
    JOIN identity.organizations organization
      ON organization.id = provider.organization_id
     AND organization.lifecycle_status = 'active'
    LEFT JOIN identity.organization_identity_provider_domains binding
      ON binding.provider_id = provider.id
    LEFT JOIN identity.organization_domains domain
      ON domain.id = binding.domain_id
     AND domain.organization_id = provider.organization_id
     AND domain.verified_at IS NOT NULL
   WHERE provider.status = 'active'
     AND (
       (NOT selector_is_domain AND provisioning.slug = lower(organization_selector))
       OR (selector_is_domain AND domain.domain = lower(organization_selector))
     )
   LIMIT 1
$function$;

REVOKE ALL ON FUNCTION identity.resolve_active_identity_provider(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.resolve_active_identity_provider(text, boolean) TO plenum_app;

CREATE FUNCTION identity.resolve_oidc_login_state(state_digest text)
RETURNS TABLE (organization_id uuid, identity_provider_id uuid, purpose text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT attempt.organization_id, attempt.identity_provider_id, attempt.purpose
    FROM identity.oidc_login_attempts attempt
    LEFT JOIN identity.organization_identity_provider_revisions provider
      ON provider.organization_id = attempt.organization_id
     AND provider.id = attempt.identity_provider_id
   WHERE attempt.state_sha256 = state_digest
     AND attempt.consumed_at IS NULL
     AND attempt.expires_at > transaction_timestamp()
     AND (
       attempt.purpose = 'platform_recovery'
       OR (attempt.purpose = 'sign_in' AND provider.status = 'active')
       OR (attempt.purpose = 'provider_test' AND provider.status = 'preflight_passed')
     )
   LIMIT 1
$function$;

REVOKE ALL ON FUNCTION identity.resolve_oidc_login_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.resolve_oidc_login_state(text) TO plenum_app;

-- Protect discovered configuration after preflight. Lifecycle evidence can advance,
-- but endpoints and domain bindings are replaced only by staging a new revision.
CREATE FUNCTION identity.refuse_identity_provider_configuration_mutation() RETURNS trigger
LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.preflighted_at IS NOT NULL AND (
    NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.provider_key IS DISTINCT FROM OLD.provider_key
    OR NEW.version IS DISTINCT FROM OLD.version
    OR NEW.protocol IS DISTINCT FROM OLD.protocol
    OR NEW.display_name IS DISTINCT FROM OLD.display_name
    OR NEW.replaces_provider_id IS DISTINCT FROM OLD.replaces_provider_id
    OR NEW.discovery_url IS DISTINCT FROM OLD.discovery_url
    OR NEW.metadata_url IS DISTINCT FROM OLD.metadata_url
    OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.audience IS DISTINCT FROM OLD.audience
    OR NEW.issuer IS DISTINCT FROM OLD.issuer
    OR NEW.authorization_endpoint IS DISTINCT FROM OLD.authorization_endpoint
    OR NEW.token_endpoint IS DISTINCT FROM OLD.token_endpoint
    OR NEW.jwks_uri IS DISTINCT FROM OLD.jwks_uri
    OR NEW.saml_entity_id IS DISTINCT FROM OLD.saml_entity_id
    OR NEW.saml_sso_url IS DISTINCT FROM OLD.saml_sso_url
    OR NEW.signing_key_fingerprints IS DISTINCT FROM OLD.signing_key_fingerprints
    OR NEW.configuration_sha256 IS DISTINCT FROM OLD.configuration_sha256
    OR NEW.metadata_sha256 IS DISTINCT FROM OLD.metadata_sha256
    OR NEW.signing_keys_sha256 IS DISTINCT FROM OLD.signing_keys_sha256
  ) THEN
    RAISE EXCEPTION 'identity provider configuration revisions are immutable after preflight';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER identity_provider_configuration_immutable
  BEFORE UPDATE ON identity.organization_identity_provider_revisions
  FOR EACH ROW EXECUTE FUNCTION identity.refuse_identity_provider_configuration_mutation();
