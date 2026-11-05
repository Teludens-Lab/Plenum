-- Plenum 037: governed Organization workforce provisioning and access lifecycle.
-- Workforce state is authoritative for Organization entry. Memberships continue to
-- express roles, while invitations, SCIM credentials, group mappings, access reviews,
-- and lifecycle evidence remain tenant-scoped and non-destructive.

CREATE TABLE identity.organization_workforce_members (
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  primary_email text CHECK (primary_email IS NULL OR primary_email = lower(primary_email)),
  external_id text,
  source text NOT NULL CHECK (source IN ('legacy', 'invitation', 'scim')),
  status text NOT NULL CHECK (status IN ('invited', 'active', 'suspended', 'deprovisioned')),
  lifecycle_version bigint NOT NULL DEFAULT 1 CHECK (lifecycle_version > 0),
  invited_at timestamptz,
  joined_at timestamptz,
  suspended_at timestamptz,
  deprovisioned_at timestamptz,
  lifecycle_reason text,
  last_scim_seen_at timestamptz,
  last_access_reviewed_at timestamptz,
  last_access_reviewed_by uuid REFERENCES identity.persons(id),
  created_by uuid REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (organization_id, person_id),
  UNIQUE (organization_id, primary_email),
  UNIQUE (organization_id, external_id),
  CHECK ((status = 'suspended') = (suspended_at IS NOT NULL)),
  CHECK ((status = 'deprovisioned') = (deprovisioned_at IS NOT NULL))
);

CREATE INDEX organization_workforce_status
  ON identity.organization_workforce_members (organization_id, status, updated_at DESC);

CREATE TABLE identity.organization_workforce_invitations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  person_id uuid REFERENCES identity.persons(id),
  email text NOT NULL CHECK (email = lower(email)),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 200),
  requested_roles text[] NOT NULL CHECK (cardinality(requested_roles) > 0),
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  invited_by uuid NOT NULL REFERENCES identity.persons(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  identity_linked_at timestamptz,
  revoked_at timestamptz,
  delivery_id uuid NOT NULL UNIQUE,
  delivery_status text NOT NULL CHECK (delivery_status IN ('queued', 'sent', 'failed', 'cancelled')),
  delivery_attempt_count integer NOT NULL DEFAULT 0 CHECK (delivery_attempt_count BETWEEN 0 AND 3),
  provider_reference text,
  delivery_failure_reason text,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK (expires_at > created_at),
  CHECK (identity_linked_at IS NULL OR accepted_at IS NOT NULL)
);

CREATE UNIQUE INDEX organization_workforce_invitation_pending
  ON identity.organization_workforce_invitations (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE identity.organization_scim_credentials (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  label text NOT NULL CHECK (length(label) BETWEEN 2 AND 120),
  token_prefix text NOT NULL CHECK (length(token_prefix) BETWEEN 8 AND 24),
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, label)
);

CREATE TABLE identity.organization_group_role_mappings (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  identity_provider_id uuid,
  group_external_id text NOT NULL CHECK (length(group_external_id) BETWEEN 1 AND 300),
  group_display_name text NOT NULL CHECK (length(group_display_name) BETWEEN 1 AND 300),
  organization_role text NOT NULL
    CHECK (organization_role IN ('admin','designer','publisher','operator','reviewer','research_analyst')),
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  revoked_at timestamptz,
  UNIQUE (organization_id, group_external_id),
  FOREIGN KEY (organization_id, identity_provider_id)
    REFERENCES identity.organization_identity_provider_revisions(organization_id, id)
);

CREATE TABLE identity.organization_group_assignments (
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  mapping_id uuid NOT NULL REFERENCES identity.organization_group_role_mappings(id),
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  assigned_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  removed_at timestamptz,
  PRIMARY KEY (organization_id, mapping_id, person_id)
);

CREATE TABLE identity.organization_access_reviews (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  review_period_start timestamptz NOT NULL,
  review_period_end timestamptz NOT NULL,
  started_by uuid NOT NULL REFERENCES identity.persons(id),
  started_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  completed_by uuid REFERENCES identity.persons(id),
  completed_at timestamptz,
  CHECK (review_period_end > review_period_start),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL AND completed_by IS NOT NULL))
);

CREATE UNIQUE INDEX organization_access_review_open
  ON identity.organization_access_reviews (organization_id) WHERE status = 'open';

CREATE TABLE identity.organization_access_review_items (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  review_id uuid NOT NULL REFERENCES identity.organization_access_reviews(id),
  person_id uuid NOT NULL REFERENCES identity.persons(id),
  status_snapshot text NOT NULL,
  roles_snapshot text[] NOT NULL,
  decision text CHECK (decision IN ('retain', 'suspend', 'deprovision')),
  decision_reason text,
  reviewed_by uuid REFERENCES identity.persons(id),
  reviewed_at timestamptz,
  UNIQUE (review_id, person_id),
  CHECK ((decision IS NULL) = (reviewed_at IS NULL AND reviewed_by IS NULL))
);

INSERT INTO identity.organization_workforce_members(
  organization_id,person_id,source,status,joined_at
)
SELECT DISTINCT membership.organization_id,membership.person_id,'legacy','active',
       min(membership.created_at) OVER (PARTITION BY membership.organization_id,membership.person_id)
  FROM identity.memberships membership
ON CONFLICT (organization_id,person_id) DO NOTHING;

CREATE FUNCTION identity.ensure_workforce_for_membership() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, identity
AS $function$
BEGIN
  INSERT INTO identity.organization_workforce_members(
    organization_id,person_id,source,status,joined_at
  ) VALUES (NEW.organization_id,NEW.person_id,'legacy','active',transaction_timestamp())
  ON CONFLICT (organization_id,person_id) DO NOTHING;
  RETURN NEW;
END
$function$;

CREATE TRIGGER memberships_ensure_workforce
  AFTER INSERT ON identity.memberships
  FOR EACH ROW EXECUTE FUNCTION identity.ensure_workforce_for_membership();

CREATE FUNCTION identity.person_has_active_organization_access(
  target_organization_id uuid,
  target_person_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM identity.organization_workforce_members workforce
     WHERE workforce.organization_id=target_organization_id
       AND workforce.person_id=target_person_id
       AND workforce.status='active'
  )
$function$;

CREATE FUNCTION identity.resolve_scim_credential(token_digest text)
RETURNS TABLE (organization_id uuid, credential_id uuid, actor_person_id uuid)
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  UPDATE identity.organization_scim_credentials credential
     SET last_used_at=transaction_timestamp()
    FROM identity.organizations organization
   WHERE credential.token_sha256=token_digest
     AND credential.revoked_at IS NULL
     AND (credential.expires_at IS NULL OR credential.expires_at>transaction_timestamp())
     AND organization.id=credential.organization_id
     AND organization.lifecycle_status='active'
  RETURNING credential.organization_id,credential.id,credential.created_by
$function$;

CREATE FUNCTION identity.accept_organization_workforce_invitation(
  invitation_token_sha256 text,
  new_person_id uuid,
  new_display_name text,
  request_correlation_id uuid
) RETURNS TABLE (organization_id uuid, organization_name text, person_id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity, evidence
AS $function$
DECLARE
  invitation identity.organization_workforce_invitations%ROWTYPE;
  organization_name_value text;
BEGIN
  IF invitation_token_sha256 !~ '^[0-9a-f]{64}$'
     OR length(trim(new_display_name)) < 2
     OR length(trim(new_display_name)) > 200 THEN RETURN; END IF;
  SELECT candidate.* INTO invitation
    FROM identity.organization_workforce_invitations candidate
    JOIN identity.organizations organization ON organization.id=candidate.organization_id
   WHERE candidate.token_sha256=invitation_token_sha256
     AND candidate.accepted_at IS NULL
     AND candidate.revoked_at IS NULL
     AND candidate.expires_at>transaction_timestamp()
     AND organization.lifecycle_status='active'
   FOR UPDATE OF candidate;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO identity.persons(id,display_name) VALUES (new_person_id,trim(new_display_name));
  INSERT INTO identity.organization_workforce_members(
    organization_id,person_id,primary_email,source,status,invited_at,created_by
  ) VALUES (
    invitation.organization_id,new_person_id,invitation.email,'invitation','invited',
    invitation.created_at,invitation.invited_by
  );
  UPDATE identity.organization_workforce_invitations
     SET person_id=new_person_id,accepted_at=transaction_timestamp(),updated_at=transaction_timestamp()
   WHERE id=invitation.id;
  SELECT name INTO organization_name_value FROM identity.organizations WHERE id=invitation.organization_id;
  INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
  VALUES (gen_random_uuid(),invitation.organization_id,new_person_id,
    'organization.workforce_invitation_accepted','workforce_invitation:' || invitation.id,
    jsonb_build_object('correlationId',request_correlation_id));
  RETURN QUERY SELECT invitation.organization_id,organization_name_value,new_person_id,invitation.email;
END
$function$;

CREATE FUNCTION identity.link_organization_workforce_federated_identity(
  target_organization_id uuid,
  target_person_id uuid,
  target_identity_provider_id uuid,
  target_issuer text,
  target_subject text,
  target_email text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
BEGIN
  IF target_organization_id IS DISTINCT FROM
      nullif(current_setting('app.organization_id',true),'')::uuid THEN
    RAISE EXCEPTION 'Organization workforce identity scope is invalid' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM identity.organization_identity_provider_revisions provider
     WHERE provider.organization_id=target_organization_id
       AND provider.id=target_identity_provider_id AND provider.status='active'
  ) OR NOT EXISTS (
    SELECT 1 FROM identity.organization_workforce_members workforce
     WHERE workforce.organization_id=target_organization_id
       AND workforce.person_id=target_person_id
       AND workforce.primary_email=lower(target_email)
       AND (
         workforce.status='active'
         OR (
           workforce.status='invited'
           AND EXISTS (
             SELECT 1 FROM identity.organization_workforce_invitations invitation
              WHERE invitation.organization_id=workforce.organization_id
                AND invitation.person_id=workforce.person_id
                AND invitation.accepted_at IS NOT NULL
                AND invitation.revoked_at IS NULL
                AND invitation.identity_linked_at IS NULL
           )
         )
       )
  ) THEN
    RAISE EXCEPTION 'Organization workforce identity is not eligible for linking' USING ERRCODE='42501';
  END IF;
  INSERT INTO identity.federated_identities
    (id,organization_id,person_id,issuer,subject,provider_type,identity_provider_id,verified_email,last_authenticated_at)
  VALUES
    (gen_random_uuid(),target_organization_id,target_person_id,target_issuer,target_subject,'oidc',
     target_identity_provider_id,lower(target_email),transaction_timestamp());
END
$function$;

REVOKE ALL ON FUNCTION identity.person_has_active_organization_access(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.resolve_scim_credential(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.accept_organization_workforce_invitation(text,uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.link_organization_workforce_federated_identity(uuid,uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.person_has_active_organization_access(uuid,uuid) TO plenum_app;
GRANT EXECUTE ON FUNCTION identity.resolve_scim_credential(text) TO plenum_app;
GRANT EXECUTE ON FUNCTION identity.accept_organization_workforce_invitation(text,uuid,text,uuid) TO plenum_app;
GRANT EXECUTE ON FUNCTION identity.link_organization_workforce_federated_identity(uuid,uuid,uuid,text,text,text) TO plenum_app;

GRANT SELECT,INSERT,UPDATE ON identity.organization_workforce_members TO plenum_app;
GRANT SELECT,INSERT,UPDATE ON identity.organization_workforce_invitations TO plenum_app;
GRANT SELECT,INSERT,UPDATE ON identity.organization_scim_credentials TO plenum_app;
GRANT SELECT,INSERT,UPDATE ON identity.organization_group_role_mappings TO plenum_app;
GRANT SELECT,INSERT,UPDATE ON identity.organization_group_assignments TO plenum_app;
GRANT SELECT,INSERT,UPDATE ON identity.organization_access_reviews TO plenum_app;
GRANT SELECT,INSERT,UPDATE ON identity.organization_access_review_items TO plenum_app;

-- Organization workforce operations need to read their own verified domains and
-- licensed entitlements. Existing platform-only policies continue to govern all
-- writes; these tenant policies are SELECT-only and do not widen mutation authority.
CREATE POLICY organization_workforce_tenant_read ON identity.organization_provisioning
  FOR SELECT USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
CREATE POLICY organization_workforce_tenant_read ON identity.organization_domains
  FOR SELECT USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'identity.organization_workforce_members',
    'identity.organization_group_role_mappings',
    'identity.organization_group_assignments',
    'identity.organization_access_reviews',
    'identity.organization_access_review_items'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',table_ref);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid)',
      table_ref
    );
  END LOOP;
END
$$;

ALTER TABLE identity.organization_workforce_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity.organization_workforce_invitations
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);

ALTER TABLE identity.organization_scim_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity.organization_scim_credentials
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);

