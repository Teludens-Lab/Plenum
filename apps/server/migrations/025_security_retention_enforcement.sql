-- Plenum 025: shared request-rate windows and audited export-retention enforcement.
-- Sources: PS-550, REQ-051, OPEN-009.

CREATE SCHEMA operations;
GRANT USAGE ON SCHEMA operations TO plenum_app;

CREATE TABLE operations.request_rate_limit_windows (
  category text NOT NULL CHECK (category IN ('authentication','agent','upload','session_command','general')),
  scope_hash text NOT NULL CHECK (scope_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (category, scope_hash, window_started_at)
);

CREATE INDEX request_rate_limit_expiry ON operations.request_rate_limit_windows (expires_at);
REVOKE ALL ON operations.request_rate_limit_windows FROM PUBLIC, plenum_app;

CREATE FUNCTION operations.consume_request_rate_limit(
  requested_category text,
  requested_scope_hash text,
  requested_limit integer,
  observed_at timestamptz
) RETURNS TABLE (allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, operations
AS $function$
DECLARE
  window_start timestamptz := date_trunc('minute', observed_at);
  current_count integer;
BEGIN
  IF requested_category NOT IN ('authentication','agent','upload','session_command','general') OR
     requested_scope_hash !~ '^[0-9a-f]{64}$' OR requested_limit < 1 THEN
    RAISE EXCEPTION 'invalid request-rate-limit input' USING ERRCODE = '22023';
  END IF;

  DELETE FROM operations.request_rate_limit_windows
   WHERE expires_at < observed_at - interval '5 minutes';

  INSERT INTO operations.request_rate_limit_windows
    (category,scope_hash,window_started_at,request_count,expires_at)
  VALUES (requested_category,requested_scope_hash,window_start,1,window_start + interval '1 minute')
  ON CONFLICT (category,scope_hash,window_started_at) DO UPDATE
    SET request_count=operations.request_rate_limit_windows.request_count + 1
  RETURNING request_count INTO current_count;

  RETURN QUERY SELECT current_count <= requested_limit,
    greatest(requested_limit-current_count,0),
    CASE WHEN current_count <= requested_limit THEN 0
         ELSE greatest(1,ceil(extract(epoch FROM window_start + interval '1 minute' - observed_at))::integer)
    END;
END
$function$;

REVOKE ALL ON FUNCTION operations.consume_request_rate_limit(text,text,integer,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operations.consume_request_rate_limit(text,text,integer,timestamptz) TO plenum_app;

CREATE TABLE reporting.legal_hold_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  hold_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('placed','released')),
  scope_type text NOT NULL CHECK (scope_type IN ('organization','export')),
  scope_reference text NOT NULL CHECK (length(trim(scope_reference)) BETWEEN 1 AND 200),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 4000),
  recorded_by uuid NOT NULL REFERENCES identity.persons(id),
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,hold_id,action)
);

CREATE INDEX legal_hold_events_current
  ON reporting.legal_hold_events (organization_id,hold_id,recorded_at DESC,id DESC);

ALTER TABLE reporting.legal_hold_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.legal_hold_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON reporting.legal_hold_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
GRANT SELECT, INSERT ON reporting.legal_hold_events TO plenum_app;
REVOKE UPDATE, DELETE, TRUNCATE ON reporting.legal_hold_events FROM plenum_app;
CREATE TRIGGER refuse_update_delete BEFORE UPDATE OR DELETE ON reporting.legal_hold_events
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON reporting.legal_hold_events
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();

ALTER TABLE reporting.export_artifacts
  ALTER COLUMN bytes DROP NOT NULL,
  ADD COLUMN purged_at timestamptz,
  ADD COLUMN purged_by uuid REFERENCES identity.persons(id),
  ADD CONSTRAINT export_artifact_purge_complete CHECK (
    (bytes IS NOT NULL AND purged_at IS NULL AND purged_by IS NULL) OR
    (bytes IS NULL AND purged_at IS NOT NULL AND purged_by IS NOT NULL)
  );

DROP TRIGGER refuse_update_delete ON reporting.export_artifacts;
CREATE FUNCTION reporting.guard_export_artifact_retention() RETURNS trigger
LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.bytes IS NOT NULL AND NEW.bytes IS NULL AND
     OLD.purged_at IS NULL AND NEW.purged_at IS NOT NULL AND
     OLD.purged_by IS NULL AND NEW.purged_by IS NOT NULL AND
     ROW(NEW.id,NEW.organization_id,NEW.job_id,NEW.filename,NEW.content_type,NEW.sha256,NEW.manifest,NEW.created_at)
       IS NOT DISTINCT FROM
     ROW(OLD.id,OLD.organization_id,OLD.job_id,OLD.filename,OLD.content_type,OLD.sha256,OLD.manifest,OLD.created_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'append-only table %.%: % is not permitted', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END
$function$;

CREATE TRIGGER guard_retention_update_delete BEFORE UPDATE OR DELETE ON reporting.export_artifacts
  FOR EACH ROW EXECUTE FUNCTION reporting.guard_export_artifact_retention();
GRANT UPDATE (bytes,purged_at,purged_by) ON reporting.export_artifacts TO plenum_app;
CREATE INDEX export_artifacts_retention_due ON reporting.export_artifacts (organization_id,created_at,id)
  WHERE bytes IS NOT NULL;
