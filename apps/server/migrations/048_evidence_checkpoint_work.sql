-- BA-10: one recoverable public checkpoint/signature per Session; no private keys or event bodies.
CREATE TABLE operations.evidence_checkpoint_work (
  organization_id uuid NOT NULL,
  session_id uuid PRIMARY KEY,
  checkpoint jsonb NOT NULL,
  signature jsonb,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  retry_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  last_failure text CHECK (last_failure IN ('signing_unavailable','signing_failed','anchoring_failed','interrupted')),
  FOREIGN KEY (organization_id,session_id) REFERENCES runtime.sessions(organization_id,id),
  CHECK (jsonb_typeof(checkpoint)='object'),
  CHECK (signature IS NULL OR (jsonb_typeof(signature)='object' AND NOT (signature->'publicKeyJwk' ? 'd') AND NOT (signature->'publicKeyJwk' ? 'k')))
);
CREATE INDEX evidence_checkpoint_work_due ON operations.evidence_checkpoint_work(organization_id,retry_at,session_id);
ALTER TABLE operations.evidence_checkpoint_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations.evidence_checkpoint_work FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_checkpoint_work_tenant ON operations.evidence_checkpoint_work
  USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE,DELETE ON operations.evidence_checkpoint_work TO plenum_app;
