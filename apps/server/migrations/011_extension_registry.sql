-- Plenum 011: restricted Plugin registry, trust roots, installations, and digest-pinned bindings.
-- Sources: REQ-038, REQ-086, REQ-090, REQ-094, INV-028; ADR-018; DEC-52.

CREATE SCHEMA extension;

CREATE TABLE extension.publishers (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  principal_id uuid NOT NULL REFERENCES identity.persons(id),
  display_name text NOT NULL,
  signature_key_id text NOT NULL,
  public_key_pem text NOT NULL,
  status text NOT NULL CHECK (status IN ('approved','suspended','revoked')),
  approved_by uuid NOT NULL REFERENCES identity.persons(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, principal_id, signature_key_id)
);

CREATE TABLE extension.trust_roots (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  publisher_id uuid NOT NULL,
  publisher_key_id text NOT NULL,
  publisher_public_key_pem text NOT NULL,
  revocation_key_id text NOT NULL,
  revocation_public_key_pem text NOT NULL,
  provisioned_by uuid NOT NULL REFERENCES identity.persons(id),
  provisioned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, publisher_id, publisher_key_id),
  FOREIGN KEY (organization_id, publisher_id) REFERENCES extension.publishers(organization_id, id)
);

CREATE TABLE extension.revocation_lists (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  publisher_id uuid NOT NULL,
  trust_root_id uuid NOT NULL,
  document jsonb NOT NULL,
  document_sha256 text NOT NULL CHECK (document_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  generated_at timestamptz NOT NULL,
  imported_by uuid NOT NULL REFERENCES identity.persons(id),
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, publisher_id, document_sha256),
  FOREIGN KEY (organization_id, publisher_id) REFERENCES extension.publishers(organization_id, id),
  FOREIGN KEY (organization_id, trust_root_id) REFERENCES extension.trust_roots(organization_id, id)
);

CREATE TABLE extension.license_acceptances (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  plugin_id text NOT NULL,
  license text NOT NULL,
  terms_digest text NOT NULL CHECK (terms_digest ~ '^sha256:[0-9a-f]{64}$'),
  accepted_by uuid NOT NULL REFERENCES identity.persons(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, plugin_id, license, terms_digest)
);

CREATE TABLE extension.plugin_artifacts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  publisher_id uuid NOT NULL,
  plugin_id text NOT NULL,
  version text NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  digest text NOT NULL CHECK (digest ~ '^sha256:[0-9a-f]{64}$'),
  manifest_digest text NOT NULL CHECK (manifest_digest ~ '^sha256:[0-9a-f]{64}$'),
  bundle_digest text NOT NULL CHECK (bundle_digest ~ '^sha256:[0-9a-f]{64}$'),
  object_key text NOT NULL,
  manifest jsonb NOT NULL,
  supply_chain jsonb NOT NULL,
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN ('contract_validated','approved','rejected','suspended','revoked','deprecated','quarantined')),
  submitted_by uuid NOT NULL REFERENCES identity.persons(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES identity.persons(id),
  approved_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, plugin_id, version),
  UNIQUE (organization_id, digest),
  UNIQUE (organization_id, bundle_digest),
  FOREIGN KEY (organization_id, publisher_id) REFERENCES extension.publishers(organization_id, id),
  CHECK ((lifecycle_status = 'approved') = (approved_by IS NOT NULL AND approved_at IS NOT NULL) OR lifecycle_status <> 'approved')
);

CREATE TABLE extension.plugin_installations (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  deployment_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  artifact_digest text NOT NULL CHECK (artifact_digest ~ '^sha256:[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('enabled','suspended','uninstalled')),
  permitted_permissions text[] NOT NULL,
  installed_by uuid NOT NULL REFERENCES identity.persons(id),
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, deployment_id, artifact_id),
  FOREIGN KEY (organization_id, artifact_id) REFERENCES extension.plugin_artifacts(organization_id, id)
);

CREATE TABLE extension.plugin_bindings (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES identity.organizations(id),
  project_id uuid NOT NULL,
  definition_revision_id uuid NOT NULL,
  installation_id uuid NOT NULL,
  artifact_digest text NOT NULL CHECK (artifact_digest ~ '^sha256:[0-9a-f]{64}$'),
  configuration_digest text NOT NULL CHECK (configuration_digest ~ '^sha256:[0-9a-f]{64}$'),
  deployment_profile text NOT NULL CHECK (deployment_profile IN ('connected','self_hosted','air_gapped')),
  status text NOT NULL CHECK (status IN ('enabled','disabled')),
  bound_by uuid NOT NULL REFERENCES identity.persons(id),
  bound_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, definition_revision_id, installation_id),
  FOREIGN KEY (organization_id, project_id, definition_revision_id)
    REFERENCES studio.definition_revisions(organization_id, project_id, id),
  FOREIGN KEY (organization_id, installation_id)
    REFERENCES extension.plugin_installations(organization_id, id)
);

CREATE INDEX plugin_artifacts_catalog ON extension.plugin_artifacts (organization_id, lifecycle_status, plugin_id, version);
CREATE INDEX plugin_installations_deployment ON extension.plugin_installations (organization_id, deployment_id, status);
CREATE INDEX plugin_bindings_revision ON extension.plugin_bindings (organization_id, project_id, definition_revision_id, status);
CREATE INDEX revocation_lists_latest ON extension.revocation_lists (organization_id, publisher_id, generated_at DESC);

GRANT USAGE ON SCHEMA extension TO plenum_app;
GRANT SELECT, INSERT ON extension.publishers, extension.plugin_artifacts TO plenum_app;
GRANT UPDATE (status) ON extension.publishers TO plenum_app;
GRANT UPDATE (lifecycle_status, approved_by, approved_at, revoked_at) ON extension.plugin_artifacts TO plenum_app;
GRANT SELECT, INSERT ON extension.trust_roots, extension.revocation_lists, extension.license_acceptances,
  extension.plugin_installations, extension.plugin_bindings TO plenum_app;

DO $$
DECLARE table_ref text;
BEGIN
  FOREACH table_ref IN ARRAY ARRAY[
    'extension.publishers',
    'extension.trust_roots',
    'extension.revocation_lists',
    'extension.license_acceptances',
    'extension.plugin_artifacts',
    'extension.plugin_installations',
    'extension.plugin_bindings'
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_ref);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_ref);
    EXECUTE format(
      'CREATE POLICY organization_isolation ON %s '
      'USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) '
      'WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      table_ref
    );
    EXECUTE format('CREATE TRIGGER refuse_delete BEFORE DELETE ON %s FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
    EXECUTE format('CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation()', table_ref);
  END LOOP;
END
$$;
