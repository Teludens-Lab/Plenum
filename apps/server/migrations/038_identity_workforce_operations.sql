-- Plenum 038: durable identity and workforce operation evidence.
-- This migration is additive. It makes provider requests, reconciliation runs,
-- and invitation delivery receipts observable without storing provider secrets
-- or allowing a failed synchronization to silently remove access.

CREATE TABLE identity.organization_provisioning_operations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  source text NOT NULL CHECK (source IN ('entra','okta','scim','invitation','reconciliation')),
  operation_type text NOT NULL CHECK (length(operation_type) BETWEEN 2 AND 120),
  target_ref text NOT NULL CHECK (length(target_ref) BETWEEN 2 AND 300),
  external_request_id text CHECK (external_request_id IS NULL OR length(external_request_id) BETWEEN 1 AND 300),
  status text NOT NULL CHECK (status IN ('received','succeeded','failed','retry_pending')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 10),
  actor_person_id uuid REFERENCES identity.persons(id),
  last_error_code text,
  last_error_reason text CHECK (last_error_reason IS NULL OR length(last_error_reason) <= 1000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  started_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  completed_at timestamptz,
  next_retry_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK ((status IN ('succeeded','failed')) = (completed_at IS NOT NULL)),
  CHECK ((status = 'retry_pending') = (next_retry_at IS NOT NULL))
);

CREATE UNIQUE INDEX organization_provisioning_operation_external_request
  ON identity.organization_provisioning_operations (organization_id,source,external_request_id)
  WHERE external_request_id IS NOT NULL;
CREATE INDEX organization_provisioning_operation_status
  ON identity.organization_provisioning_operations (organization_id,status,started_at DESC);

CREATE TABLE identity.organization_provisioning_operation_attempts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  operation_id uuid NOT NULL REFERENCES identity.organization_provisioning_operations(id),
  attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 10),
  outcome text NOT NULL CHECK (outcome IN ('succeeded','failed')),
  error_code text,
  error_reason text CHECK (error_reason IS NULL OR length(error_reason) <= 1000),
  correlation_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (operation_id,attempt_number)
);

CREATE FUNCTION identity.protect_provisioning_attempt() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'Provisioning operation attempts are immutable' USING ERRCODE='55000';
END
$function$;

CREATE TRIGGER organization_provisioning_attempt_immutable
  BEFORE UPDATE OR DELETE ON identity.organization_provisioning_operation_attempts
  FOR EACH ROW EXECUTE FUNCTION identity.protect_provisioning_attempt();

ALTER TABLE identity.first_admin_invitation_deliveries
  DROP CONSTRAINT first_admin_invitation_deliveries_status_check,
  ADD CONSTRAINT first_admin_invitation_deliveries_status_check
    CHECK (status IN ('queued','sent','delivered','bounced','failed','cancelled'));
ALTER TABLE identity.first_admin_invitation_deliveries
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN bounced_at timestamptz;

ALTER TABLE identity.platform_administrator_invitations
  DROP CONSTRAINT platform_administrator_invitations_delivery_status_check,
  ADD CONSTRAINT platform_administrator_invitations_delivery_status_check
    CHECK (delivery_status IN ('queued','sent','delivered','bounced','failed','cancelled'));
ALTER TABLE identity.platform_administrator_invitations
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN bounced_at timestamptz;

ALTER TABLE identity.organization_workforce_invitations
  DROP CONSTRAINT organization_workforce_invitations_delivery_status_check,
  ADD CONSTRAINT organization_workforce_invitations_delivery_status_check
    CHECK (delivery_status IN ('queued','sent','delivered','bounced','failed','cancelled'));
ALTER TABLE identity.organization_workforce_invitations
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN bounced_at timestamptz;

CREATE TABLE identity.invitation_delivery_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  invitation_kind text NOT NULL CHECK (invitation_kind IN ('first_admin','platform_administrator','organization_workforce')),
  delivery_id uuid NOT NULL,
  provider_event_id text NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 300),
  status text NOT NULL CHECK (status IN ('delivered','bounced','failed')),
  reason text CHECK (reason IS NULL OR length(reason) <= 1000),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (provider_event_id),
  UNIQUE (invitation_kind,delivery_id,provider_event_id)
);

CREATE TRIGGER invitation_delivery_event_immutable
  BEFORE UPDATE OR DELETE ON identity.invitation_delivery_events
  FOR EACH ROW EXECUTE FUNCTION identity.protect_provisioning_attempt();

CREATE FUNCTION identity.record_invitation_delivery_event(
  target_provider_event_id text,
  target_delivery_id uuid,
  target_status text,
  target_occurred_at timestamptz,
  target_reason text
) RETURNS TABLE (organization_id uuid, invitation_kind text, invitation_id uuid, duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $function$
DECLARE
  found_organization_id uuid;
  found_invitation_kind text;
  found_invitation_id uuid;
  inserted_count integer;
BEGIN
  IF length(target_provider_event_id) NOT BETWEEN 1 AND 300
     OR target_status NOT IN ('delivered','bounced','failed')
     OR target_occurred_at > transaction_timestamp() + interval '5 minutes'
     OR length(coalesce(target_reason,'')) > 1000 THEN
    RETURN;
  END IF;

  SELECT delivery.organization_id,'first_admin',delivery.invitation_id
    INTO found_organization_id,found_invitation_kind,found_invitation_id
    FROM identity.first_admin_invitation_deliveries delivery
   WHERE delivery.id=target_delivery_id
  UNION ALL
  SELECT invitation.organization_id,'platform_administrator',invitation.id
    FROM identity.platform_administrator_invitations invitation
   WHERE invitation.delivery_id=target_delivery_id
  UNION ALL
  SELECT invitation.organization_id,'organization_workforce',invitation.id
    FROM identity.organization_workforce_invitations invitation
   WHERE invitation.delivery_id=target_delivery_id
  LIMIT 1;

  IF found_organization_id IS NULL THEN RETURN; END IF;

  INSERT INTO identity.invitation_delivery_events(
    id,organization_id,invitation_kind,delivery_id,provider_event_id,status,reason,occurred_at
  ) VALUES (
    gen_random_uuid(),found_organization_id,found_invitation_kind,target_delivery_id,
    target_provider_event_id,target_status,nullif(trim(target_reason),''),target_occurred_at
  ) ON CONFLICT (provider_event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 1 THEN
    IF found_invitation_kind='first_admin' THEN
      UPDATE identity.first_admin_invitation_deliveries
         SET status=target_status,
             delivered_at=CASE WHEN target_status='delivered' THEN target_occurred_at ELSE delivered_at END,
             bounced_at=CASE WHEN target_status='bounced' THEN target_occurred_at ELSE bounced_at END,
             failed_at=CASE WHEN target_status='failed' THEN target_occurred_at ELSE failed_at END,
             failure_reason=CASE WHEN target_status IN ('bounced','failed') THEN nullif(trim(target_reason),'') ELSE NULL END,
             updated_at=transaction_timestamp()
       WHERE id=target_delivery_id AND status NOT IN ('cancelled');
    ELSIF found_invitation_kind='platform_administrator' THEN
      UPDATE identity.platform_administrator_invitations
         SET delivery_status=target_status,
             delivered_at=CASE WHEN target_status='delivered' THEN target_occurred_at ELSE delivered_at END,
             bounced_at=CASE WHEN target_status='bounced' THEN target_occurred_at ELSE bounced_at END,
             failed_at=CASE WHEN target_status='failed' THEN target_occurred_at ELSE failed_at END,
             delivery_failure_reason=CASE WHEN target_status IN ('bounced','failed') THEN nullif(trim(target_reason),'') ELSE NULL END,
             updated_at=transaction_timestamp()
       WHERE delivery_id=target_delivery_id AND revoked_at IS NULL;
    ELSE
      UPDATE identity.organization_workforce_invitations
         SET delivery_status=target_status,
             delivered_at=CASE WHEN target_status='delivered' THEN target_occurred_at ELSE delivered_at END,
             bounced_at=CASE WHEN target_status='bounced' THEN target_occurred_at ELSE bounced_at END,
             failed_at=CASE WHEN target_status='failed' THEN target_occurred_at ELSE failed_at END,
             delivery_failure_reason=CASE WHEN target_status IN ('bounced','failed') THEN nullif(trim(target_reason),'') ELSE NULL END,
             updated_at=transaction_timestamp()
       WHERE delivery_id=target_delivery_id AND revoked_at IS NULL;
    END IF;
  END IF;

  RETURN QUERY SELECT found_organization_id,found_invitation_kind,found_invitation_id,(inserted_count=0);
END
$function$;

REVOKE ALL ON FUNCTION identity.record_invitation_delivery_event(text,uuid,text,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.record_invitation_delivery_event(text,uuid,text,timestamptz,text) TO plenum_app;

GRANT SELECT,INSERT,UPDATE ON identity.organization_provisioning_operations TO plenum_app;
GRANT SELECT,INSERT ON identity.organization_provisioning_operation_attempts TO plenum_app;
GRANT SELECT ON identity.invitation_delivery_events TO plenum_app;

ALTER TABLE identity.organization_provisioning_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.organization_provisioning_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity.organization_provisioning_operations
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);

ALTER TABLE identity.organization_provisioning_operation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.organization_provisioning_operation_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity.organization_provisioning_operation_attempts
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);

ALTER TABLE identity.invitation_delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.invitation_delivery_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON identity.invitation_delivery_events
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
