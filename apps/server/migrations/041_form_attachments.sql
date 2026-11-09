-- PS-830 / OPEN-010. Additive upload journal; historical records remain unchanged.
-- File bytes stay in the existing object store. Metadata precedes storage so interrupted writes are recoverable.
CREATE TABLE runtime.form_attachments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES identity.persons(id),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  media_type text NOT NULL CHECK (media_type IN ('text/plain','text/markdown','application/pdf','image/png','image/jpeg')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 20000000),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  blob_key text NOT NULL CHECK (length(blob_key) BETWEEN 1 AND 500),
  retention_policy_id uuid NOT NULL,
  scan_status text NOT NULL DEFAULT 'quarantined' CHECK (scan_status IN ('quarantined','clean','infected','failed')),
  scan_detail text NOT NULL DEFAULT '' CHECK (length(scan_detail) <= 1000),
  upload_state text NOT NULL DEFAULT 'pending' CHECK (upload_state IN ('pending','store_failed','attached','purge_pending','purged')),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  expires_at timestamptz NOT NULL,
  attached_at timestamptz,
  purged_at timestamptz,
  UNIQUE (organization_id,id),
  UNIQUE (blob_key),
  FOREIGN KEY (organization_id,artifact_id) REFERENCES runtime.artifact_instances(organization_id,id),
  FOREIGN KEY (organization_id,retention_policy_id) REFERENCES reporting.retention_policies(organization_id,id),
  CHECK ((upload_state = 'purged') = (purged_at IS NOT NULL)),
  CHECK (upload_state <> 'attached' OR attached_at IS NOT NULL)
);
CREATE INDEX form_attachments_artifact ON runtime.form_attachments(organization_id,artifact_id,created_at,id);
CREATE INDEX form_attachments_retention ON runtime.form_attachments(organization_id,expires_at) WHERE upload_state <> 'purged';
ALTER TABLE runtime.form_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime.form_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runtime.form_attachments
  USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid);
GRANT SELECT, INSERT ON runtime.form_attachments TO plenum_app;
GRANT UPDATE(scan_status,scan_detail,upload_state,attached_at,purged_at) ON runtime.form_attachments TO plenum_app;
REVOKE DELETE,TRUNCATE ON runtime.form_attachments FROM plenum_app;
