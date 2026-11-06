-- Plenum 040: least-privilege operational security evidence reader.
--
-- The login credential is created outside migrations from the staging secret
-- bundle. This migration owns only the stable NOLOGIN capability role and a
-- deliberately narrow, read-only view over scrubbed operational evidence.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'plenum_operations_evidence_reader') THEN
    CREATE ROLE plenum_operations_evidence_reader NOLOGIN
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

CREATE OR REPLACE VIEW evidence.operational_security_event_feed
WITH (security_barrier = true)
AS
SELECT id,
       deployment_id,
       session_id,
       event_type,
       severity,
       outcome,
       correlation_id,
       category,
       recorded_at
FROM evidence.operational_security_events;

REVOKE ALL ON evidence.operational_security_events FROM plenum_operations_evidence_reader;
REVOKE ALL ON evidence.operational_security_event_feed FROM PUBLIC;
REVOKE ALL ON evidence.operational_security_event_feed FROM plenum_app;
GRANT USAGE ON SCHEMA evidence TO plenum_operations_evidence_reader;
GRANT SELECT ON evidence.operational_security_event_feed TO plenum_operations_evidence_reader;

COMMENT ON VIEW evidence.operational_security_event_feed IS
  'Scrubbed read-only PS-810 feed for the separately credentialed staging operations agent.';
