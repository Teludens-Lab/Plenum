-- Additive provenance for Release-authored scheduled Injects. Existing instances
-- retain their state and historical data; no backfill or data rewrite is needed.
BEGIN;
ALTER TABLE runtime.inject_instances
  ADD COLUMN scheduling_command_id uuid,
  ADD COLUMN scheduled_by_person_id uuid REFERENCES identity.persons(id),
  ADD CONSTRAINT inject_schedule_provenance_pair CHECK (
    (scheduling_command_id IS NULL) = (scheduled_by_person_id IS NULL)
  ),
  ADD CONSTRAINT inject_schedule_command FOREIGN KEY (session_id, scheduling_command_id)
    REFERENCES sync.command_receipts(session_id, command_id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX inject_instances_due ON runtime.inject_instances (organization_id, scheduled_at, session_id)
  WHERE state = 'scheduled';
COMMIT;
