-- BA-04: retain provider obligations independently of the authoritative Floor lifetime.
-- Legacy leases are uncertain and must be disabled before any new grant. Drain old writers first.
ALTER TABLE comms.floor_leases
  ADD COLUMN provider_state text NOT NULL DEFAULT 'pending_disable'
    CHECK (provider_state IN ('pending_enable','enabled','pending_disable','disabled')),
  ADD COLUMN provider_attempts integer NOT NULL DEFAULT 0 CHECK (provider_attempts >= 0),
  ADD COLUMN provider_retry_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN provider_disabled_at timestamptz;

CREATE FUNCTION comms.retain_floor_disable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.active AND NOT NEW.active AND NEW.provider_state <> 'disabled' THEN
    NEW.provider_state := 'pending_disable';
    NEW.provider_retry_at := transaction_timestamp();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER floor_disable_pending BEFORE UPDATE OF active ON comms.floor_leases
  FOR EACH ROW EXECUTE FUNCTION comms.retain_floor_disable();
CREATE INDEX floor_provider_pending ON comms.floor_leases(organization_id,provider_retry_at,channel_id)
  WHERE provider_state <> 'disabled';
GRANT UPDATE(provider_state,provider_attempts,provider_retry_at,provider_disabled_at) ON comms.floor_leases TO plenum_app;
