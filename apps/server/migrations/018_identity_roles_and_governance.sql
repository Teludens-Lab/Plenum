-- Plenum 018: approved Organization Roles and governed publication/research access.
-- Sources: DEC-61, OPEN-025 resolution and ADR-012 approval.

ALTER TABLE identity.memberships
  DROP CONSTRAINT memberships_organization_role_check,
  ADD CONSTRAINT memberships_organization_role_check
    CHECK (organization_role IN ('admin','designer','publisher','operator','reviewer','research_analyst'));

ALTER TABLE studio.publication_freezes
  ADD CONSTRAINT publication_freezes_project_identity UNIQUE (organization_id, project_id, id);

CREATE TABLE studio.publication_reviews (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id uuid NOT NULL,
  freeze_id uuid NOT NULL,
  reviewer_person_id uuid NOT NULL REFERENCES identity.persons(id),
  decision text NOT NULL CHECK (decision = 'approved'),
  notes text NOT NULL CHECK (length(trim(notes)) BETWEEN 1 AND 4000),
  decided_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, freeze_id, reviewer_person_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, project_id, freeze_id)
    REFERENCES studio.publication_freezes(organization_id, project_id, id)
);

CREATE TABLE evidence.research_access_grants (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  project_id uuid NOT NULL,
  analyst_person_id uuid NOT NULL REFERENCES identity.persons(id),
  protocol_reference text NOT NULL CHECK (length(trim(protocol_reference)) BETWEEN 1 AND 400),
  classification_ceiling text NOT NULL CHECK (classification_ceiling IN ('public','internal')),
  approved_by uuid NOT NULL REFERENCES identity.persons(id),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, project_id) REFERENCES studio.simulation_projects(organization_id, id)
);

CREATE INDEX research_access_grants_active
  ON evidence.research_access_grants (organization_id, analyst_person_id, project_id, expires_at)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT ON studio.publication_reviews TO plenum_app;
GRANT SELECT, INSERT ON evidence.research_access_grants TO plenum_app;
GRANT UPDATE (revoked_at) ON evidence.research_access_grants TO plenum_app;

ALTER TABLE studio.publication_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio.publication_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON studio.publication_reviews
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE evidence.research_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.research_access_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON evidence.research_access_grants
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

REVOKE UPDATE, DELETE, TRUNCATE ON studio.publication_reviews FROM plenum_app;
CREATE TRIGGER publication_reviews_refuse_update_delete
  BEFORE UPDATE OR DELETE ON studio.publication_reviews
  FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation();
CREATE TRIGGER publication_reviews_refuse_truncate
  BEFORE TRUNCATE ON studio.publication_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation();

REVOKE DELETE, TRUNCATE ON evidence.research_access_grants FROM plenum_app;
