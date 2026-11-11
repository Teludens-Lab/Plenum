-- BA-05: explicit tenant delegation; existing Person/Admin identities remain authoritative.
CREATE TABLE operations.organization_job_bindings (
  organization_id uuid PRIMARY KEY REFERENCES identity.organizations(id),
  deployment_id uuid NOT NULL,
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  enabled boolean NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  authorized_by uuid NOT NULL REFERENCES identity.persons(id),
  retention_due_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
CREATE INDEX organization_job_discovery ON operations.organization_job_bindings(deployment_id,organization_id) WHERE enabled;
GRANT SELECT,INSERT,UPDATE ON operations.organization_job_bindings TO plenum_app;
ALTER TABLE operations.organization_job_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.organization_job_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_job_owner ON operations.organization_job_bindings
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
-- Only this metadata table has deployment-scoped reads. Business tables retain tenant RLS.
CREATE POLICY organization_job_discovery ON operations.organization_job_bindings FOR SELECT
  USING (deployment_id=nullif(current_setting('app.deployment_id',true),'')::uuid);
