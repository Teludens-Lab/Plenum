-- Plenum 030: exact-revision publication provenance and immutable Template lifecycle history.
-- Sources: PS-760, resolved OPEN-013, REQ-022, INV-006.

ALTER TABLE studio.publication_freezes
  ADD COLUMN author_person_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN policy_version text NOT NULL DEFAULT 'OPEN-013.v1',
  ADD COLUMN validation_report_sha256 text;

UPDATE studio.publication_freezes
   SET author_person_ids = ARRAY[frozen_by],
       validation_report_sha256 = encode(sha256(convert_to(validation_report::text, 'UTF8')), 'hex')
 WHERE cardinality(author_person_ids) = 0 OR validation_report_sha256 IS NULL;

ALTER TABLE studio.publication_freezes
  ALTER COLUMN validation_report_sha256 SET NOT NULL,
  ADD CONSTRAINT publication_freeze_validation_digest CHECK (validation_report_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT publication_freeze_has_author CHECK (cardinality(author_person_ids) > 0);

ALTER TABLE studio.publication_reviews
  ADD COLUMN artifact_sha256 text,
  ADD COLUMN validation_report_sha256 text,
  ADD COLUMN policy_version text NOT NULL DEFAULT 'OPEN-013.v1',
  ADD COLUMN reviewer_roles text[] NOT NULL DEFAULT ARRAY['reviewer']::text[],
  ADD COLUMN evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE studio.publication_reviews AS review
   SET artifact_sha256 = frozen.materialization_sha256,
       validation_report_sha256 = frozen.validation_report_sha256
  FROM studio.publication_freezes AS frozen
 WHERE frozen.organization_id = review.organization_id
   AND frozen.id = review.freeze_id
   AND (review.artifact_sha256 IS NULL OR review.validation_report_sha256 IS NULL);

ALTER TABLE studio.publication_reviews
  ALTER COLUMN artifact_sha256 SET NOT NULL,
  ALTER COLUMN validation_report_sha256 SET NOT NULL,
  ADD CONSTRAINT publication_review_artifact_digest CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT publication_review_validation_digest CHECK (validation_report_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE runtime.release_activation_reviews
  ADD COLUMN reviewer_roles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN policy_version text NOT NULL DEFAULT 'OPEN-013.v1',
  ADD COLUMN artifact_sha256 text,
  ADD COLUMN rationale text NOT NULL DEFAULT 'Compatibility impact reviewed.',
  ADD COLUMN evidence jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE runtime.release_activation_reviews
   SET artifact_sha256 = report_sha256,
       reviewer_roles = ARRAY['operator']::text[]
 WHERE artifact_sha256 IS NULL OR cardinality(reviewer_roles) = 0;

ALTER TABLE runtime.release_activation_reviews
  ALTER COLUMN artifact_sha256 SET NOT NULL,
  ADD CONSTRAINT release_activation_review_artifact_digest CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE studio.simulation_templates
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN source_freeze_id uuid,
  ADD COLUMN artifact_sha256 text,
  ADD COLUMN supersedes_template_id uuid,
  ADD CONSTRAINT simulation_template_source_freeze
    FOREIGN KEY (organization_id, source_project_id, source_freeze_id)
    REFERENCES studio.publication_freezes(organization_id, project_id, id),
  ADD CONSTRAINT simulation_template_supersedes
    FOREIGN KEY (organization_id, supersedes_template_id)
    REFERENCES studio.simulation_templates(organization_id, id),
  ADD CONSTRAINT simulation_template_version_unique
    UNIQUE (organization_id, source_project_id, version),
  ADD CONSTRAINT simulation_template_artifact_digest
    CHECK (artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$');

CREATE TABLE studio.template_lifecycle_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  template_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('published','superseded','deprecated','archived')),
  actor_person_id uuid NOT NULL REFERENCES identity.persons(id),
  actor_roles text[] NOT NULL,
  policy_version text NOT NULL,
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  rationale text NOT NULL CHECK (length(trim(rationale)) BETWEEN 1 AND 4000),
  evidence jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, template_id) REFERENCES studio.simulation_templates(organization_id, id)
);

GRANT SELECT, INSERT ON studio.template_lifecycle_events TO plenum_app;
ALTER TABLE studio.template_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio.template_lifecycle_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON studio.template_lifecycle_events
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
REVOKE UPDATE, DELETE, TRUNCATE ON studio.template_lifecycle_events FROM plenum_app;
CREATE TRIGGER template_lifecycle_events_refuse_update_delete
  BEFORE UPDATE OR DELETE ON studio.template_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER template_lifecycle_events_refuse_truncate
  BEFORE TRUNCATE ON studio.template_lifecycle_events
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();
