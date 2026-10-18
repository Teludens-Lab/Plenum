-- Plenum 006: complete Command Receipt and Domain Event fields for the transactional kernel.
-- Sources: REQ-004, REQ-035, REQ-053; DEC-37, DEC-43; ADR-001, ADR-003, ADR-014.

ALTER TABLE sync.command_receipts
  ADD COLUMN correlation_id uuid,
  ADD COLUMN message text;

ALTER TABLE evidence.events
  ADD COLUMN correlation_id uuid,
  ADD COLUMN causation_id uuid,
  ADD COLUMN aggregate_id uuid,
  ADD COLUMN aggregate_version bigint CHECK (aggregate_version IS NULL OR aggregate_version >= 0),
  ADD COLUMN occurred_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX events_one_recorded_outcome_per_command
  ON evidence.events (session_id, command_id)
  WHERE command_id IS NOT NULL;
