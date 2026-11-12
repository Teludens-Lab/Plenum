-- BA-08: completed history must not dominate bounded pending/recovery scans.
CREATE INDEX model_run_work_queue ON extension.model_runs(organization_id,status,started_at,id)
  WHERE status IN ('pending','running');
