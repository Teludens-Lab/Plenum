-- Plenum 008: bounded, policy-scoped Runtime Projection Cursors.
-- Sources: REQ-044, REQ-047, INV-002; ADR-010; Synchronization Protocol sections 5 and 10.

ALTER TABLE sync.session_delta_outbox
  ADD COLUMN published_at timestamptz;

CREATE TABLE sync.projection_cursors (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  device_id uuid NOT NULL,
  active_session_role_id text NOT NULL,
  access_revision bigint NOT NULL CHECK (access_revision > 0),
  policy_version text NOT NULL,
  projection_version text NOT NULL,
  last_evidence_sequence bigint NOT NULL CHECK (last_evidence_sequence >= 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, session_id) REFERENCES runtime.sessions(organization_id, id),
  FOREIGN KEY (organization_id, session_id, participant_id)
    REFERENCES runtime.participants(organization_id, session_id, id),
  FOREIGN KEY (organization_id, device_id) REFERENCES sync.devices(organization_id, id)
);

CREATE INDEX projection_cursors_scope
  ON sync.projection_cursors (organization_id, session_id, participant_id, device_id, expires_at);
CREATE INDEX session_delta_outbox_published
  ON sync.session_delta_outbox (organization_id, session_id, publication_status, published_at);

GRANT SELECT, INSERT, DELETE ON sync.projection_cursors TO plenum_app;

ALTER TABLE sync.projection_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync.projection_cursors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sync.projection_cursors
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
