-- Plenum 016: participant-scoped Voice consent and classified recording references.
-- Sources: REQ-083, INV-027, DEC-50, OPEN-027; Data Model 4.8.

ALTER TABLE comms.voice_channels
  ADD COLUMN recording_active boolean NOT NULL DEFAULT false,
  ADD COLUMN transcription_active boolean NOT NULL DEFAULT false;

CREATE TABLE comms.consent_records (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('recording','transcription')),
  action text NOT NULL CHECK (action IN ('given','withdrawn')),
  command_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (session_id, command_id),
  FOREIGN KEY (organization_id, channel_id) REFERENCES comms.voice_channels(organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id) REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE TABLE comms.recording_assets (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('recording','transcript')),
  object_key text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  classification text NOT NULL CHECK (classification IN ('public','internal','confidential','restricted')),
  retention_class text NOT NULL,
  consent_basis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, object_key),
  FOREIGN KEY (organization_id, channel_id) REFERENCES comms.voice_channels(organization_id, id)
);

CREATE INDEX consent_records_current ON comms.consent_records
  (organization_id,channel_id,kind,participant_id,recorded_at DESC,id DESC);
CREATE INDEX recording_assets_channel ON comms.recording_assets
  (organization_id,session_id,channel_id,kind,created_at);

GRANT SELECT,INSERT ON comms.consent_records,comms.recording_assets TO plenum_app;
GRANT UPDATE(recording_active,transcription_active,version,updated_at) ON comms.voice_channels TO plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY['comms.consent_records','comms.recording_assets'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('CREATE POLICY organization_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_delete BEFORE DELETE ON %s FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
  END LOOP;
END $$;

CREATE TRIGGER consent_records_append_only BEFORE UPDATE ON comms.consent_records
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER recording_assets_append_only BEFORE UPDATE ON comms.recording_assets
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
