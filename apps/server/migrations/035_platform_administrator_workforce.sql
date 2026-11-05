-- Plenum 035: governed Platform Administrator workforce lifecycle.
-- Routine privilege changes require a recent MFA-backed session and a distinct
-- approver. The owner-only break-glass function is deliberately not granted to
-- the application role and exists only to establish/recover the second approver.

ALTER TABLE identity.platform_role_assignments
  ADD COLUMN home_organization_id uuid REFERENCES identity.organizations(id),
  ADD COLUMN status text,
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN status_reason text,
  ADD COLUMN assignment_version bigint NOT NULL DEFAULT 1 CHECK (assignment_version > 0),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE identity.platform_role_assignments assignment
   SET home_organization_id = (
         SELECT membership.organization_id
           FROM identity.memberships membership
           JOIN identity.organizations organization ON organization.id = membership.organization_id
          WHERE membership.person_id = assignment.person_id
          ORDER BY (organization.lifecycle_status = 'active') DESC,
                   (membership.organization_role = 'admin') DESC,
                   membership.organization_id
          LIMIT 1
       ),
       status = CASE WHEN assignment.revoked_at IS NULL THEN 'active' ELSE 'revoked' END;

ALTER TABLE identity.platform_role_assignments
  ALTER COLUMN home_organization_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'active',
  ADD CONSTRAINT platform_role_assignment_status_check
    CHECK (status IN ('active', 'suspended', 'revoked')),
  ADD CONSTRAINT platform_role_assignment_revocation_check
    CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
  ADD CONSTRAINT platform_role_assignment_suspension_check
    CHECK ((status = 'suspended') = (suspended_at IS NOT NULL));

CREATE OR REPLACE FUNCTION identity.current_platform_administrator() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM identity.platform_role_assignments assignment
     WHERE assignment.person_id = nullif(current_setting('app.platform_actor_id', true), '')::uuid
       AND assignment.platform_role = 'platform_administrator'
       AND assignment.status = 'active'
       AND assignment.revoked_at IS NULL
  )
$function$;

CREATE FUNCTION identity.person_is_active_platform_administrator(candidate_person_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM identity.platform_role_assignments assignment
     WHERE assignment.person_id = candidate_person_id
       AND assignment.platform_role = 'platform_administrator'
       AND assignment.status = 'active'
       AND assignment.revoked_at IS NULL
  )
$function$;

REVOKE ALL ON FUNCTION identity.person_is_active_platform_administrator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.person_is_active_platform_administrator(uuid) TO plenum_app;

ALTER TABLE identity.platform_role_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_role_assignments_platform_read ON identity.platform_role_assignments;
CREATE POLICY platform_role_assignments_platform_read ON identity.platform_role_assignments
  FOR SELECT TO plenum_app
  USING (identity.current_platform_administrator());
GRANT SELECT ON identity.platform_role_assignments TO plenum_app;

CREATE OR REPLACE FUNCTION identity.bootstrap_platform_administrator(
  bootstrap_person_id uuid,
  request_correlation_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity, evidence
AS $function$
DECLARE
  bootstrap_organization_id uuid;
BEGIN
  LOCK TABLE identity.platform_role_assignments IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM identity.platform_role_assignments) THEN RETURN false; END IF;
  SELECT membership.organization_id INTO bootstrap_organization_id
    FROM identity.memberships membership
    JOIN identity.organizations organization ON organization.id = membership.organization_id
   WHERE membership.person_id = bootstrap_person_id
     AND membership.organization_role = 'admin'
     AND organization.lifecycle_status = 'active'
   ORDER BY membership.organization_id
   LIMIT 1;
  IF bootstrap_organization_id IS NULL THEN RETURN false; END IF;
  INSERT INTO identity.platform_role_assignments(
    person_id, platform_role, home_organization_id, assigned_by, status
  ) VALUES (
    bootstrap_person_id, 'platform_administrator', bootstrap_organization_id,
    bootstrap_person_id, 'active'
  );
  INSERT INTO evidence.platform_audit_records(
    id, actor_person_id, action, resource_organization_id, target_ref, after_state, details
  ) VALUES (
    gen_random_uuid(), bootstrap_person_id, 'platform.platform_administrator_bootstrapped',
    bootstrap_organization_id, 'platform_role_assignment:' || bootstrap_person_id,
    jsonb_build_object('platformRole', 'platform_administrator', 'status', 'active'),
    jsonb_build_object('correlationId', request_correlation_id)
  );
  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION identity.bootstrap_platform_administrator(uuid, uuid) FROM PUBLIC;

CREATE TABLE identity.platform_administrator_change_requests (
  id uuid PRIMARY KEY,
  change_type text NOT NULL CHECK (change_type IN ('invite', 'suspend', 'revoke', 'recover')),
  anchor_organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  target_person_id uuid REFERENCES identity.persons(id),
  target_email text CHECK (target_email IS NULL OR target_email = lower(target_email)),
  target_display_name text,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'expired')),
  requested_by uuid NOT NULL REFERENCES identity.persons(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  decided_by uuid REFERENCES identity.persons(id),
  decided_at timestamptz,
  decision_reason text,
  applied_at timestamptz,
  CHECK (expires_at > requested_at),
  CHECK (
    (change_type = 'invite' AND target_person_id IS NULL AND target_email IS NOT NULL AND target_display_name IS NOT NULL)
    OR
    (change_type <> 'invite' AND target_person_id IS NOT NULL AND target_email IS NULL AND target_display_name IS NULL)
  ),
  CHECK ((status = 'pending') = (decided_at IS NULL AND decided_by IS NULL)),
  CHECK (status <> 'applied' OR applied_at IS NOT NULL)
);

CREATE UNIQUE INDEX platform_administrator_pending_invite
  ON identity.platform_administrator_change_requests (target_email)
  WHERE change_type = 'invite' AND status = 'pending';
CREATE UNIQUE INDEX platform_administrator_pending_person_change
  ON identity.platform_administrator_change_requests (change_type, target_person_id)
  WHERE change_type <> 'invite' AND status = 'pending';
CREATE INDEX platform_administrator_change_time
  ON identity.platform_administrator_change_requests (requested_at DESC);

CREATE TABLE identity.platform_administrator_invitations (
  id uuid PRIMARY KEY,
  change_request_id uuid NOT NULL UNIQUE REFERENCES identity.platform_administrator_change_requests(id),
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  email text NOT NULL CHECK (email = lower(email)),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 200),
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  delivery_id uuid NOT NULL UNIQUE,
  delivery_status text NOT NULL CHECK (delivery_status IN ('queued', 'sent', 'failed', 'cancelled')),
  delivery_attempt_count integer NOT NULL DEFAULT 0 CHECK (delivery_attempt_count BETWEEN 0 AND 3),
  provider_reference text,
  delivery_failure_reason text,
  sent_at timestamptz,
  failed_at timestamptz,
  linked_person_id uuid REFERENCES identity.persons(id),
  identity_linked_at timestamptz,
  identity_issuer text,
  identity_subject_sha256 text CHECK (identity_subject_sha256 IS NULL OR identity_subject_sha256 ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((linked_person_id IS NULL) = (identity_linked_at IS NULL))
);

CREATE INDEX platform_administrator_invitation_email
  ON identity.platform_administrator_invitations (organization_id, email, expires_at DESC);

ALTER TABLE identity.oidc_login_attempts
  ADD COLUMN platform_administrator_invitation_id uuid REFERENCES identity.platform_administrator_invitations(id),
  ADD COLUMN return_to text;

GRANT SELECT, INSERT, UPDATE ON identity.platform_administrator_change_requests TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON identity.platform_administrator_invitations TO plenum_app;

ALTER TABLE identity.platform_administrator_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.platform_administrator_change_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_administrator_only ON identity.platform_administrator_change_requests
  USING (identity.current_platform_administrator())
  WITH CHECK (identity.current_platform_administrator());

-- Invitation resolution and identity linking are narrowly granted SECURITY
-- DEFINER operations, so this table is not forced through the administrator RLS
-- policy while an invited identity is still unauthenticated.
ALTER TABLE identity.platform_administrator_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_administrator_only ON identity.platform_administrator_invitations
  USING (identity.current_platform_administrator())
  WITH CHECK (identity.current_platform_administrator());

CREATE FUNCTION identity.platform_session_is_step_up(
  actor_person_id uuid,
  authentication_session_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM identity.authentication_sessions session
     WHERE session.id = authentication_session_id
       AND session.person_id = actor_person_id
       AND session.revoked_at IS NULL
       AND session.expires_at > transaction_timestamp()
       AND session.created_at >= transaction_timestamp() - interval '10 minutes'
       AND lower(session.authentication_strength) IN ('mfa', 'urn:mfa')
  )
$function$;

REVOKE ALL ON FUNCTION identity.platform_session_is_step_up(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.platform_session_is_step_up(uuid, uuid) TO plenum_app;

CREATE FUNCTION identity.resolve_platform_administrator_invitation(
  target_organization_id uuid,
  invitation_token_sha256 text
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
  SELECT invitation.id
    FROM identity.platform_administrator_invitations invitation
    JOIN identity.platform_administrator_change_requests change_request
      ON change_request.id = invitation.change_request_id
   WHERE invitation.organization_id = target_organization_id
     AND invitation.token_sha256 = invitation_token_sha256
     AND invitation.expires_at > transaction_timestamp()
     AND invitation.revoked_at IS NULL
     AND invitation.identity_linked_at IS NULL
     AND change_request.status = 'approved'
   LIMIT 1
$function$;

REVOKE ALL ON FUNCTION identity.resolve_platform_administrator_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.resolve_platform_administrator_invitation(uuid, text) TO plenum_app;

CREATE FUNCTION identity.apply_platform_administrator_change(
  request_id uuid,
  approving_person_id uuid,
  authentication_session_id uuid,
  approval_reason text,
  request_correlation_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity, evidence, sync, runtime
AS $function$
DECLARE
  change_request identity.platform_administrator_change_requests%ROWTYPE;
  current_assignment identity.platform_role_assignments%ROWTYPE;
  active_count integer;
  next_status text;
BEGIN
  IF NOT identity.current_platform_administrator()
     OR NOT identity.platform_session_is_step_up(approving_person_id, authentication_session_id) THEN
    RETURN 'permission_denied';
  END IF;
  SELECT candidate.* INTO change_request
    FROM identity.platform_administrator_change_requests candidate
   WHERE candidate.id = request_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF change_request.requested_by = approving_person_id THEN RETURN 'self_approval'; END IF;
  IF change_request.status <> 'pending' THEN RETURN 'invalid_transition'; END IF;
  IF change_request.expires_at <= transaction_timestamp() THEN
    UPDATE identity.platform_administrator_change_requests
       SET status = 'expired', decided_at = transaction_timestamp()
     WHERE id = request_id;
    RETURN 'expired';
  END IF;
  IF change_request.change_type = 'invite' THEN RETURN 'invalid_transition'; END IF;

  LOCK TABLE identity.platform_role_assignments IN SHARE ROW EXCLUSIVE MODE;
  SELECT assignment.* INTO current_assignment
    FROM identity.platform_role_assignments assignment
   WHERE assignment.person_id = change_request.target_person_id
     AND assignment.platform_role = 'platform_administrator'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  IF change_request.change_type IN ('suspend', 'revoke') THEN
    IF current_assignment.status <> 'active' THEN RETURN 'invalid_transition'; END IF;
    SELECT count(*) INTO active_count
      FROM identity.platform_role_assignments assignment
     WHERE assignment.platform_role = 'platform_administrator'
       AND assignment.status = 'active'
       AND assignment.revoked_at IS NULL;
    IF active_count <= 1 THEN RETURN 'last_active'; END IF;
    next_status := CASE WHEN change_request.change_type = 'suspend' THEN 'suspended' ELSE 'revoked' END;
  ELSE
    IF current_assignment.status <> 'suspended' THEN RETURN 'invalid_transition'; END IF;
    next_status := 'active';
  END IF;

  UPDATE identity.platform_role_assignments
     SET status = next_status,
         suspended_at = CASE WHEN next_status = 'suspended' THEN transaction_timestamp() ELSE NULL END,
         revoked_at = CASE WHEN next_status = 'revoked' THEN transaction_timestamp() ELSE NULL END,
         status_reason = trim(approval_reason),
         assignment_version = assignment_version + 1,
         updated_at = transaction_timestamp()
   WHERE person_id = change_request.target_person_id
     AND platform_role = 'platform_administrator';

  UPDATE identity.platform_administrator_change_requests
     SET status = 'applied', decided_by = approving_person_id,
         decided_at = transaction_timestamp(), decision_reason = trim(approval_reason),
         applied_at = transaction_timestamp()
   WHERE id = request_id;

  IF next_status IN ('suspended', 'revoked') THEN
    PERFORM set_config('app.organization_id', current_assignment.home_organization_id::text, true);
    UPDATE identity.authentication_sessions
       SET revoked_at = transaction_timestamp()
     WHERE organization_id = current_assignment.home_organization_id
       AND person_id = change_request.target_person_id
       AND revoked_at IS NULL;
    UPDATE sync.projection_grants grant_record
       SET revoked_at = transaction_timestamp()
      FROM runtime.participants participant
     WHERE grant_record.organization_id = current_assignment.home_organization_id
       AND grant_record.participant_id = participant.id
       AND participant.organization_id = current_assignment.home_organization_id
       AND participant.person_id = change_request.target_person_id
       AND grant_record.revoked_at IS NULL;
  END IF;

  INSERT INTO evidence.platform_audit_records(
    id, actor_person_id, action, resource_organization_id, target_ref,
    before_state, after_state, details
  ) VALUES (
    gen_random_uuid(), approving_person_id,
    CASE change_request.change_type
      WHEN 'suspend' THEN 'platform.platform_administrator_suspended'
      WHEN 'revoke' THEN 'platform.platform_administrator_revoked'
      ELSE 'platform.platform_administrator_recovered'
    END,
    change_request.anchor_organization_id,
    'platform_role_assignment:' || change_request.target_person_id,
    jsonb_build_object('status', current_assignment.status, 'version', current_assignment.assignment_version),
    jsonb_build_object('status', next_status, 'version', current_assignment.assignment_version + 1),
    jsonb_build_object('changeRequestId', request_id, 'requestedBy', change_request.requested_by,
      'reason', trim(approval_reason), 'correlationId', request_correlation_id)
  );
  RETURN 'applied';
END
$function$;

REVOKE ALL ON FUNCTION identity.apply_platform_administrator_change(uuid, uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.apply_platform_administrator_change(uuid, uuid, uuid, text, uuid) TO plenum_app;

CREATE FUNCTION identity.link_platform_administrator_oidc_identity(
  invitation_id uuid,
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
  invitation identity.platform_administrator_invitations%ROWTYPE;
  change_request identity.platform_administrator_change_requests%ROWTYPE;
  new_person_id uuid;
BEGIN
  IF verified_subject_sha256 !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  SELECT candidate.* INTO invitation
    FROM identity.platform_administrator_invitations candidate
    JOIN identity.platform_administrator_change_requests request ON request.id = candidate.change_request_id
   WHERE candidate.id = invitation_id
     AND candidate.organization_id = target_organization_id
     AND candidate.email = lower(trim(verified_email))
     AND candidate.expires_at > transaction_timestamp()
     AND candidate.revoked_at IS NULL
     AND candidate.identity_linked_at IS NULL
     AND request.status = 'approved'
   FOR UPDATE OF candidate;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT request.* INTO change_request
    FROM identity.platform_administrator_change_requests request
   WHERE request.id = invitation.change_request_id
     AND request.status = 'approved'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  new_person_id := gen_random_uuid();
  INSERT INTO identity.persons(id, display_name)
  VALUES (new_person_id, invitation.display_name);
  INSERT INTO identity.federated_identities(
    id, organization_id, person_id, issuer, subject, provider_type, last_authenticated_at
  ) VALUES (
    gen_random_uuid(), target_organization_id, new_person_id,
    verified_issuer, verified_subject, 'oidc', transaction_timestamp()
  );
  INSERT INTO identity.platform_role_assignments(
    person_id, platform_role, home_organization_id, assigned_by, status
  ) VALUES (
    new_person_id, 'platform_administrator', target_organization_id, change_request.decided_by, 'active'
  )
  ON CONFLICT (person_id, platform_role) DO UPDATE
    SET home_organization_id = EXCLUDED.home_organization_id,
        assigned_by = EXCLUDED.assigned_by,
        assigned_at = transaction_timestamp(), status = 'active',
        suspended_at = NULL, revoked_at = NULL, status_reason = NULL,
        assignment_version = identity.platform_role_assignments.assignment_version + 1,
        updated_at = transaction_timestamp();
  UPDATE identity.platform_administrator_invitations
     SET linked_person_id = new_person_id, identity_linked_at = transaction_timestamp(),
         identity_issuer = verified_issuer, identity_subject_sha256 = verified_subject_sha256,
         updated_at = transaction_timestamp()
   WHERE id = invitation_id;
  UPDATE identity.platform_administrator_change_requests
     SET status = 'applied', applied_at = transaction_timestamp()
   WHERE id = change_request.id;
  INSERT INTO evidence.platform_audit_records(
    id, actor_person_id, action, resource_organization_id, target_ref, after_state, details
  ) VALUES (
    gen_random_uuid(), change_request.decided_by, 'platform.platform_administrator_assigned',
    target_organization_id, 'platform_role_assignment:' || new_person_id,
    jsonb_build_object('status', 'active', 'platformRole', 'platform_administrator'),
    jsonb_build_object('changeRequestId', change_request.id, 'correlationId', request_correlation_id)
  ), (
    gen_random_uuid(), new_person_id, 'platform.platform_administrator_identity_linked',
    target_organization_id, 'platform_administrator_invitation:' || invitation_id,
    jsonb_build_object('status', 'linked', 'issuer', verified_issuer),
    jsonb_build_object('changeRequestId', change_request.id, 'correlationId', request_correlation_id)
  );
  RETURN new_person_id;
EXCEPTION
  WHEN unique_violation THEN RETURN NULL;
END
$function$;

REVOKE ALL ON FUNCTION identity.link_platform_administrator_oidc_identity(uuid, uuid, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.link_platform_administrator_oidc_identity(uuid, uuid, text, text, text, text, uuid) TO plenum_app;

CREATE FUNCTION identity.break_glass_recover_platform_administrator(
  recovery_actor_person_id uuid,
  target_person_id uuid,
  recovery_reason text,
  incident_reference text,
  request_correlation_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity, evidence
AS $function$
DECLARE
  target_organization_id uuid;
  active_count integer;
  prior_status text;
BEGIN
  LOCK TABLE identity.platform_role_assignments IN EXCLUSIVE MODE;
  IF recovery_actor_person_id = target_person_id
     OR length(trim(recovery_reason)) < 10
     OR length(trim(incident_reference)) < 3 THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM identity.memberships membership
    JOIN identity.organizations organization ON organization.id = membership.organization_id
    WHERE membership.person_id = recovery_actor_person_id
      AND membership.organization_role = 'admin'
      AND organization.lifecycle_status = 'active'
  ) THEN RETURN false; END IF;
  SELECT identity_record.organization_id INTO target_organization_id
    FROM identity.federated_identities identity_record
    JOIN identity.organizations organization ON organization.id = identity_record.organization_id
   WHERE identity_record.person_id = target_person_id
     AND organization.lifecycle_status = 'active'
   ORDER BY identity_record.created_at
   LIMIT 1;
  IF target_organization_id IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO active_count
    FROM identity.platform_role_assignments assignment
   WHERE assignment.platform_role = 'platform_administrator'
     AND assignment.status = 'active' AND assignment.revoked_at IS NULL;
  IF active_count >= 2 THEN RETURN false; END IF;
  SELECT status INTO prior_status FROM identity.platform_role_assignments
   WHERE person_id = target_person_id AND platform_role = 'platform_administrator';
  INSERT INTO identity.platform_role_assignments(
    person_id, platform_role, home_organization_id, assigned_by, status, status_reason
  ) VALUES (
    target_person_id, 'platform_administrator', target_organization_id,
    recovery_actor_person_id, 'active', trim(recovery_reason)
  )
  ON CONFLICT (person_id, platform_role) DO UPDATE
    SET home_organization_id = EXCLUDED.home_organization_id,
        assigned_by = EXCLUDED.assigned_by, assigned_at = transaction_timestamp(),
        status = 'active', suspended_at = NULL, revoked_at = NULL,
        status_reason = EXCLUDED.status_reason,
        assignment_version = identity.platform_role_assignments.assignment_version + 1,
        updated_at = transaction_timestamp();
  PERFORM set_config('app.organization_id', target_organization_id::text, true);
  UPDATE identity.authentication_sessions
     SET revoked_at = transaction_timestamp()
   WHERE organization_id = target_organization_id
     AND person_id = target_person_id
     AND revoked_at IS NULL;
  INSERT INTO evidence.platform_audit_records(
    id, actor_person_id, action, resource_organization_id, target_ref,
    before_state, after_state, details
  ) VALUES (
    gen_random_uuid(), recovery_actor_person_id, 'platform.platform_administrator_break_glass_recovered',
    target_organization_id, 'platform_role_assignment:' || target_person_id,
    jsonb_build_object('status', prior_status), jsonb_build_object('status', 'active'),
    jsonb_build_object('reason', trim(recovery_reason), 'incidentReference', trim(incident_reference),
      'correlationId', request_correlation_id)
  );
  RETURN true;
END
$function$;

REVOKE ALL ON FUNCTION identity.break_glass_recover_platform_administrator(uuid, uuid, text, text, uuid) FROM PUBLIC;
