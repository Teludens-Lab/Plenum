-- Plenum 039: scrubbed operational security evidence for PS-810.
-- This migration is additive. Event payloads are deliberately constrained so
-- credentials, request bodies, personal addresses, and raw exception text do
-- not enter the durable operational record.

CREATE TABLE evidence.operational_security_events (
  id uuid PRIMARY KEY,
  deployment_id uuid NOT NULL,
  organization_id uuid REFERENCES identity.organizations(id),
  session_id uuid,
  actor_person_id uuid REFERENCES identity.persons(id),
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  severity text NOT NULL CHECK (severity IN ('info','warning','error')),
  outcome text NOT NULL CHECK (outcome IN ('succeeded','failed','denied')),
  correlation_id uuid NOT NULL,
  category text CHECK (category IS NULL OR category ~ '^[a-z][a-z0-9_.-]{0,79}$'),
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  CHECK (session_id IS NULL OR organization_id IS NOT NULL)
);

CREATE INDEX operational_security_events_correlation
  ON evidence.operational_security_events (correlation_id, recorded_at DESC);
CREATE INDEX operational_security_events_severity_time
  ON evidence.operational_security_events (severity, recorded_at DESC);
CREATE INDEX operational_security_events_session_time
  ON evidence.operational_security_events (organization_id, session_id, recorded_at DESC)
  WHERE session_id IS NOT NULL;

GRANT INSERT ON evidence.operational_security_events TO plenum_app;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON evidence.operational_security_events FROM plenum_app;

CREATE TRIGGER operational_security_events_refuse_update_delete
  BEFORE UPDATE OR DELETE ON evidence.operational_security_events
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER operational_security_events_refuse_truncate
  BEFORE TRUNCATE ON evidence.operational_security_events
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
