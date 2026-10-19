-- Plenum 014: authoritative Voice Channels, Media grants and bounded Floor leases.
-- Sources: REQ-079 to REQ-085; INV-026 to INV-028; DEC-48, DEC-49; ADR-015, ADR-016, ADR-017.

CREATE SCHEMA comms;

CREATE TABLE comms.voice_channels (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  definition_id text NOT NULL,
  definition_revision integer NOT NULL CHECK (definition_revision > 0),
  definition jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('open','closed','degraded','unavailable')),
  provider_binding_id text NOT NULL,
  provider_adapter_digest text NOT NULL CHECK (provider_adapter_digest ~ '^sha256:[0-9a-f]{64}$'),
  invited_participant_ids uuid[] NOT NULL DEFAULT '{}',
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  opened_by uuid NOT NULL REFERENCES identity.persons(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, definition_id, definition_revision),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id)
);

CREATE TABLE comms.voice_grants (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  seat_assignment_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  can_listen boolean NOT NULL,
  can_transmit boolean NOT NULL,
  can_moderate boolean NOT NULL,
  valid_until timestamptz NOT NULL,
  revoked_at timestamptz,
  provider_revoked_at timestamptz,
  policy_revision bigint NOT NULL CHECK (policy_revision > 0),
  access_revision bigint NOT NULL CHECK (access_revision > 0),
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (channel_id, seat_assignment_id),
  FOREIGN KEY (organization_id, channel_id) REFERENCES comms.voice_channels(organization_id, id),
  FOREIGN KEY (organization_id, seat_assignment_id) REFERENCES runtime.seat_assignments(organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id) REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE TABLE comms.floor_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  request_id uuid NOT NULL,
  device_id uuid NOT NULL,
  connection_id uuid NOT NULL,
  seat_assignment_id uuid NOT NULL,
  priority integer NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','granted','queued','released','expired','preempted','denied')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (channel_id, request_id),
  FOREIGN KEY (organization_id, channel_id) REFERENCES comms.voice_channels(organization_id, id),
  FOREIGN KEY (organization_id, seat_assignment_id) REFERENCES runtime.seat_assignments(organization_id, id),
  FOREIGN KEY (organization_id, device_id) REFERENCES sync.devices(organization_id, id)
);

CREATE TABLE comms.floor_leases (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  request_id uuid NOT NULL,
  holder_seat_assignment_id uuid NOT NULL,
  token_digest text NOT NULL CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  authority_epoch bigint NOT NULL CHECK (authority_epoch > 0),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  max_expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  released_at timestamptz,
  preempted_at timestamptz,
  preemption_reason text,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (organization_id, id),
  UNIQUE (channel_id, request_id),
  FOREIGN KEY (organization_id, channel_id) REFERENCES comms.voice_channels(organization_id, id),
  FOREIGN KEY (organization_id, holder_seat_assignment_id) REFERENCES runtime.seat_assignments(organization_id, id)
);
CREATE UNIQUE INDEX floor_leases_one_active_per_channel ON comms.floor_leases(channel_id) WHERE active;

CREATE TABLE comms.media_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  provider_binding_id text NOT NULL,
  provider_event_id text NOT NULL,
  observation_type text NOT NULL CHECK (observation_type IN ('joined','left','muted','disconnected','unavailable')),
  participant_id uuid,
  observed_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, provider_binding_id, provider_event_id),
  FOREIGN KEY (organization_id, channel_id) REFERENCES comms.voice_channels(organization_id, id)
);

CREATE FUNCTION comms.revoke_seat_voice_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.valid_to IS NULL AND NEW.valid_to IS NOT NULL THEN
    UPDATE comms.voice_grants SET revoked_at=transaction_timestamp(),updated_at=transaction_timestamp()
      WHERE organization_id=NEW.organization_id AND seat_assignment_id=NEW.id AND revoked_at IS NULL;
    UPDATE comms.floor_leases lease_row SET active=false,released_at=transaction_timestamp(),version=lease_row.version+1
      WHERE organization_id=NEW.organization_id AND holder_seat_assignment_id=NEW.id AND active;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seat_assignment_revokes_voice AFTER UPDATE OF valid_to ON runtime.seat_assignments
  FOR EACH ROW EXECUTE FUNCTION comms.revoke_seat_voice_access();

CREATE FUNCTION comms.revoke_stage_voice_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE comms.voice_grants grant_row SET revoked_at=transaction_timestamp(),updated_at=transaction_timestamp()
    FROM comms.voice_channels channel_row
    WHERE grant_row.organization_id=NEW.organization_id AND grant_row.session_id=NEW.session_id
      AND grant_row.channel_id=channel_row.id AND grant_row.revoked_at IS NULL
      AND (NEW.status <> 'active' OR (
        jsonb_typeof(channel_row.definition->'activeStageIds')='array' AND
        NOT (channel_row.definition->'activeStageIds' ? NEW.stage_id)
      ));
  UPDATE comms.floor_leases lease_row SET active=false,released_at=transaction_timestamp(),version=lease_row.version+1
    FROM comms.voice_channels channel_row
    WHERE lease_row.organization_id=NEW.organization_id AND lease_row.session_id=NEW.session_id
      AND lease_row.channel_id=channel_row.id AND lease_row.active
      AND (NEW.status <> 'active' OR (
        jsonb_typeof(channel_row.definition->'activeStageIds')='array' AND
        NOT (channel_row.definition->'activeStageIds' ? NEW.stage_id)
      ));
  RETURN NEW;
END $$;
CREATE TRIGGER stage_change_revokes_voice AFTER INSERT OR UPDATE ON runtime.session_stage_state
  FOR EACH ROW EXECUTE FUNCTION comms.revoke_stage_voice_access();

CREATE INDEX voice_channels_session_status ON comms.voice_channels(organization_id,session_id,status);
CREATE INDEX voice_grants_participant ON comms.voice_grants(organization_id,session_id,participant_id,revoked_at);
CREATE INDEX floor_requests_queue ON comms.floor_requests(organization_id,channel_id,status,priority DESC,requested_at,id);
CREATE INDEX floor_leases_expiry ON comms.floor_leases(organization_id,session_id,active,expires_at);

GRANT USAGE ON SCHEMA comms TO plenum_app;
GRANT SELECT,INSERT,UPDATE(status,version,closed_at,updated_at) ON comms.voice_channels TO plenum_app;
GRANT SELECT,INSERT,UPDATE(can_listen,can_transmit,can_moderate,valid_until,revoked_at,provider_revoked_at,policy_revision,access_revision,authority_epoch,updated_at) ON comms.voice_grants TO plenum_app;
GRANT SELECT,INSERT,UPDATE(status,updated_at) ON comms.floor_requests TO plenum_app;
GRANT SELECT,INSERT,UPDATE(expires_at,active,released_at,preempted_at,preemption_reason,version) ON comms.floor_leases TO plenum_app;
GRANT SELECT,INSERT ON comms.media_events TO plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY['comms.voice_channels','comms.voice_grants','comms.floor_requests','comms.floor_leases','comms.media_events'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('CREATE POLICY organization_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_delete BEFORE DELETE ON %s FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
  END LOOP;
END $$;

CREATE TRIGGER media_events_append_only BEFORE UPDATE ON comms.media_events
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
