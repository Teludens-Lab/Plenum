-- Plenum 022: additive Device metadata for the durable Offline Outbox policy.
-- Sources: REQ-003, REQ-008, REQ-043, REQ-044, INV-018, INV-026; Sync sections 4-7.

ALTER TABLE sync.devices
  ADD COLUMN offline_policy_version text,
  ADD COLUMN offline_enabled_at timestamptz,
  ADD COLUMN last_offline_bootstrap_at timestamptz,
  ADD CONSTRAINT devices_offline_policy_metadata
    CHECK (
      (offline_policy_version IS NULL AND offline_enabled_at IS NULL AND last_offline_bootstrap_at IS NULL)
      OR
      (offline_policy_version IS NOT NULL AND offline_enabled_at IS NOT NULL AND last_offline_bootstrap_at IS NOT NULL)
    );

COMMENT ON COLUMN sync.devices.offline_policy_version IS
  'Client storage contract last issued to this Device; never evidence of current authorization.';
