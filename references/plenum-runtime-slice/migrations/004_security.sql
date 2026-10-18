-- Plenum 004: application role, least-privilege grants, append-only enforcement and tenant RLS.
-- Source: PostgreSQL Logical Data Model v1.1 §6 and §10; ADR-015.
--
-- The application connects as (or switches to) plenum_app, which owns nothing and lacks BYPASSRLS,
-- so row-level security applies to it. The migration owner is never used for request handling.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'plenum_app') THEN
    CREATE ROLE plenum_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA identity, studio, registry, runtime, sync, evidence TO plenum_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA identity, studio, registry, runtime, sync, evidence TO plenum_app;

-- Append-only and immutable tables: no UPDATE for the application role.
REVOKE UPDATE ON
  studio.definition_revisions,
  studio.document_updates,
  registry.releases,
  runtime.release_activations,
  evidence.events,
  evidence.checkpoint_batches,
  evidence.checkpoint_signatures,
  evidence.anchor_receipts
FROM plenum_app;

-- Defense in depth: refuse UPDATE and DELETE on those tables for every role, including the owner.
CREATE FUNCTION evidence.refuse_mutation() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'append-only table %.%: % is not permitted', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END
$fn$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'studio.definition_revisions',
    'studio.document_updates',
    'registry.releases',
    'runtime.release_activations',
    'evidence.events',
    'evidence.checkpoint_batches',
    'evidence.checkpoint_signatures',
    'evidence.anchor_receipts'
  ] LOOP
    EXECUTE format('CREATE TRIGGER refuse_update_delete BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION evidence.refuse_mutation()', t);
    EXECUTE format('CREATE TRIGGER refuse_truncate BEFORE TRUNCATE ON %s FOR EACH STATEMENT EXECUTE FUNCTION evidence.refuse_mutation()', t);
  END LOOP;
END
$$;

-- Tenant isolation on every table that carries organization_id.
-- The request transaction sets app.organization_id from authenticated context (src/db.mjs).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name = 'organization_id'
      AND table_schema IN ('identity','studio','registry','runtime','sync','evidence')
    GROUP BY table_schema, table_name
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I.%I '
      'USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid) '
      'WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      r.table_schema, r.table_name);
  END LOOP;
END
$$;
