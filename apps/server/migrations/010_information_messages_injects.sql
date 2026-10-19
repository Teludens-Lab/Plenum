-- Plenum 010: policy-scoped Messages, Inject recipients and information delivery evidence.
-- Sources: REQ-016, REQ-029, REQ-030, REQ-047, REQ-050; INV-002, INV-014.

ALTER TABLE runtime.inject_instances
  DROP CONSTRAINT inject_instances_state_check,
  ADD CONSTRAINT inject_instances_state_check CHECK (
    state IN ('pending','scheduled','eligible','released','acknowledged','responded','closed','cancelled','expired')
  ),
  ADD COLUMN title text,
  ADD COLUMN content_id text,
  ADD COLUMN scheduled_at timestamptz,
  ADD COLUMN acknowledged_at timestamptz,
  ADD COLUMN responded_at timestamptz,
  ADD COLUMN closed_at timestamptz;

CREATE TABLE runtime.message_threads (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  channel_id text NOT NULL,
  source_artifact_id uuid NOT NULL,
  source_team_id text NOT NULL,
  recipient_team_id text NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','accepted_terms','closed')),
  accepted_at timestamptz,
  source_closed_at timestamptz,
  recipient_closed_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, channel_id, source_artifact_id, recipient_team_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id),
  FOREIGN KEY (organization_id, source_artifact_id) REFERENCES runtime.artifact_instances(organization_id, id)
);

CREATE TABLE runtime.messages (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  governing_release_id uuid NOT NULL,
  channel_id text NOT NULL,
  route_id text NOT NULL,
  thread_id uuid,
  operation_type text NOT NULL,
  sender_participant_id uuid NOT NULL,
  sender_session_role_id text NOT NULL,
  sender_team_id text,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, governing_release_id) REFERENCES registry.releases(organization_id, id),
  FOREIGN KEY (organization_id, session_id, sender_participant_id) REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, thread_id) REFERENCES runtime.message_threads(organization_id, id)
);

CREATE TABLE runtime.message_approvals (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  message_id uuid NOT NULL,
  release_route_id text NOT NULL,
  approved_by_participant_id uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, message_id) REFERENCES runtime.messages(organization_id, id),
  FOREIGN KEY (organization_id, session_id, approved_by_participant_id) REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE TABLE runtime.message_recipients (
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  message_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  PRIMARY KEY (message_id, participant_id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, message_id) REFERENCES runtime.messages(organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id) REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE TABLE runtime.inject_recipient_states (
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  inject_instance_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  released_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  responded_at timestamptz,
  response_artifact_id uuid,
  PRIMARY KEY (inject_instance_id, participant_id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, inject_instance_id) REFERENCES runtime.inject_instances(organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id) REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, response_artifact_id) REFERENCES runtime.artifact_instances(organization_id, id)
);

CREATE TABLE runtime.information_deliveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('message','inject')),
  record_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  released_at timestamptz NOT NULL,
  delivered_at timestamptz,
  viewed_at timestamptz,
  acknowledged_at timestamptz,
  UNIQUE (record_type, record_id, participant_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id) REFERENCES runtime.participants(organization_id, session_id, id)
);

CREATE INDEX message_threads_session ON runtime.message_threads (session_id, channel_id, updated_at);
CREATE INDEX messages_session ON runtime.messages (session_id, created_at);
CREATE INDEX message_recipients_participant ON runtime.message_recipients (session_id, participant_id, released_at);
CREATE INDEX inject_recipients_participant ON runtime.inject_recipient_states (session_id, participant_id, released_at);
CREATE INDEX information_deliveries_participant ON runtime.information_deliveries (session_id, participant_id, released_at);

GRANT SELECT, INSERT, UPDATE ON runtime.message_threads, runtime.inject_recipient_states TO plenum_app;
GRANT SELECT, INSERT ON runtime.messages, runtime.message_approvals, runtime.message_recipients, runtime.information_deliveries TO plenum_app;
GRANT UPDATE (delivered_at, read_at) ON runtime.message_recipients TO plenum_app;
GRANT UPDATE (delivered_at, viewed_at, acknowledged_at) ON runtime.information_deliveries TO plenum_app;

DO $$
DECLARE table_ref regclass;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'runtime.message_threads'::regclass, 'runtime.messages'::regclass,
    'runtime.message_approvals'::regclass, 'runtime.message_recipients'::regclass,
    'runtime.inject_recipient_states'::regclass, 'runtime.information_deliveries'::regclass
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %s USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
  END LOOP;
END $$;
