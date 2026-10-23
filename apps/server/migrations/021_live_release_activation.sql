-- Plenum 021: reviewed, immutable live Release activation without historical rewrites.
-- OPEN-008 and OPEN-012 approve fail-closed keep-existing activation; this migration records that policy.

CREATE TABLE runtime.release_activation_reviews (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  session_id uuid NOT NULL,
  from_release_id uuid NOT NULL,
  to_release_id uuid NOT NULL,
  report jsonb NOT NULL,
  report_sha256 text NOT NULL CHECK (report_sha256 ~ '^[0-9a-f]{64}$'),
  change_classification text NOT NULL CHECK (change_classification IN ('safe_prospective','compatibility_dependent','consequential')),
  existing_instance_handling text NOT NULL CHECK (existing_instance_handling = 'keep_existing'),
  reviewed_by uuid NOT NULL REFERENCES identity.persons(id),
  reviewed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, session_id, id),
  FOREIGN KEY (organization_id, project_id, session_id) REFERENCES runtime.sessions(organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id, from_release_id) REFERENCES registry.releases(organization_id, project_id, id),
  FOREIGN KEY (organization_id, project_id, to_release_id) REFERENCES registry.releases(organization_id, project_id, id),
  CHECK (from_release_id <> to_release_id)
);

ALTER TABLE runtime.release_activations
  ADD COLUMN impact_review_id uuid,
  ADD COLUMN change_classification text,
  ADD COLUMN existing_instance_handling text,
  ADD CONSTRAINT release_activation_review_fk
    FOREIGN KEY (organization_id, session_id, impact_review_id)
    REFERENCES runtime.release_activation_reviews(organization_id, session_id, id),
  ADD CONSTRAINT reviewed_activation_metadata_check CHECK (
    (impact_review_id IS NULL AND change_classification IS NULL AND existing_instance_handling IS NULL)
    OR
    (impact_review_id IS NOT NULL
      AND change_classification IN ('safe_prospective','compatibility_dependent','consequential')
      AND existing_instance_handling = 'keep_existing')
  );

CREATE INDEX release_activation_reviews_session_idx
  ON runtime.release_activation_reviews (organization_id, session_id, reviewed_at DESC);

GRANT SELECT, INSERT ON runtime.release_activation_reviews TO plenum_app;

ALTER TABLE runtime.release_activation_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime.release_activation_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON runtime.release_activation_reviews
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
CREATE TRIGGER refuse_update_delete BEFORE UPDATE OR DELETE ON runtime.release_activation_reviews
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON runtime.release_activation_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
