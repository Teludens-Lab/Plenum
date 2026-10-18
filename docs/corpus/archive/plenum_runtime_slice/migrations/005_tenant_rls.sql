-- App connection role MUST lack BYPASSRLS; connection transaction sets app.organization_id after authenticating.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT table_schema,table_name FROM information_schema.columns
 WHERE column_name='organization_id' AND table_schema IN ('identity','studio','registry','runtime','sync','evidence')
 GROUP BY table_schema,table_name LOOP
 EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',r.table_schema,r.table_name);
 EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',r.table_schema,r.table_name);
 EXECUTE format('CREATE POLICY tenant_isolation ON %I.%I USING (organization_id = nullif(current_setting(''app.organization_id'',true),)::uuid) WITH CHECK (organization_id = nullif(current_setting(app.organization_id,true),)::uuid)',r.table_schema,r.table_name);
 END LOOP;
END $$;
-- Object mutation authorization is additionally enforced in application domain logic.
