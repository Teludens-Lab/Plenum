-- BA-07: keep retry scheduling in the existing attachment deletion journal.
ALTER TABLE runtime.form_attachments ADD COLUMN retention_attempted_at timestamptz;
GRANT UPDATE(retention_attempted_at) ON runtime.form_attachments TO plenum_app;
CREATE INDEX form_attachments_retry ON runtime.form_attachments(organization_id,retention_attempted_at NULLS FIRST,created_at,id)
  WHERE upload_state <> 'purged';
