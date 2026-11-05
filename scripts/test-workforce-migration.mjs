import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const baselineDatabase = `plenum_step6_baseline_${suffix}`;
const rehearsalDatabase = `plenum_step6_rehearsal_${suffix}`;
const recoveryDatabase = `plenum_step6_recovery_${suffix}`;
const adminUrl = new URL(process.env.PLENUM_MIGRATION_DATABASE_ADMIN_URL ??
  "postgres://plenum_owner:local-only@127.0.0.1:5432/postgres");
const databaseUrl = (name) => { const value = new URL(adminUrl); value.pathname = `/${name}`; return value.toString(); };
const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
const migrationFiles = [
  ...["001_core", "002_runtime_sync_evidence", "003_collaboration", "004_security"]
    .map((name) => `references/plenum-runtime-slice/migrations/${name}.sql`),
  ...["005_identity_oidc_context", "006_command_kernel", "007_release_packages", "008_projection_cursors",
    "009_runtime_capabilities", "010_information_messages_injects", "011_extension_registry", "012_extension_runs_approvals",
    "013_voting_core", "014_comms_voice_core", "015_collaboration_runtime", "016_voice_consent_assets",
    "017_session_access", "018_identity_roles_and_governance", "019_world_state_automation", "020_adjudication_records",
    "021_live_release_activation", "022_offline_devices", "023_evidence_checkpoints", "024_reporting_research",
    "025_security_retention_enforcement", "026_product_portal", "027_release_session_catalog", "028_content_library",
    "030_template_review_governance", "032_operations_administration", "033_platform_control_plane",
    "034_platform_onboarding_operations", "035_platform_administrator_workforce", "036_organization_identity_providers"]
    .map((name) => `apps/server/migrations/${name}.sql`)
];
const ids = {
  organizationA: "86000000-0000-4000-8000-000000000001",
  organizationB: "86000000-0000-4000-8000-000000000002",
  adminA: "86000000-0000-4000-8000-000000000011",
  designerA: "86000000-0000-4000-8000-000000000012",
  adminB: "86000000-0000-4000-8000-000000000013"
};

async function createDatabase(name, template = undefined) {
  await admin.query(`CREATE DATABASE ${name}${template === undefined ? "" : ` TEMPLATE ${template}`}`);
}

async function terminate(name) {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1", [name]);
}

try {
  try { await admin.query("CREATE ROLE plenum_app NOLOGIN"); } catch (error) { if (error?.code !== "42710") throw error; }
  await createDatabase(baselineDatabase);
  const baseline = new Pool({ connectionString: databaseUrl(baselineDatabase), max: 1 });
  try {
    for (const file of migrationFiles) await baseline.query(await readFile(file, "utf8"));
    await baseline.query("BEGIN");
    try {
      await baseline.query("INSERT INTO identity.organizations(id,name,lifecycle_status) VALUES ($1,'Representative Alpha','active'),($2,'Representative Beta','active')",
        [ids.organizationA, ids.organizationB]);
      await baseline.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'Existing Admin'),($2,'Existing Designer'),($3,'Second Tenant Admin')",
        [ids.adminA, ids.designerA, ids.adminB]);
      await baseline.query(`INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES
        ($1,$2,'admin'),($1,$3,'designer'),($4,$5,'admin')`,
      [ids.organizationA, ids.adminA, ids.designerA, ids.organizationB, ids.adminB]);
      await baseline.query(`INSERT INTO identity.organization_provisioning(
        organization_id,slug,legal_name,country_code,time_zone,deployment_profile,data_residency_region,
        entitlements,support_contact,configured_by,configuration_status
      ) VALUES ($1,'representative-alpha','Representative Alpha Ltd','ZA','Africa/Johannesburg','cloud','za-jnb-1',
          ARRAY['studio_authoring','session_delivery'],'ops@alpha.example',$3,'complete'),
        ($2,'representative-beta','Representative Beta Ltd','US','America/Indianapolis','self_hosted','us-east',
          ARRAY['studio_authoring'],'ops@beta.example',$4,'complete')`,
      [ids.organizationA, ids.organizationB, ids.adminA, ids.adminB]);
      await baseline.query("COMMIT");
    } catch (error) { await baseline.query("ROLLBACK"); throw error; }
  } finally { await baseline.end(); }

  await createDatabase(rehearsalDatabase, baselineDatabase);
  const rehearsal = new Pool({ connectionString: databaseUrl(rehearsalDatabase), max: 1 });
  let migrated;
  try {
    await rehearsal.query(await readFile("apps/server/migrations/037_organization_workforce.sql", "utf8"));
    await rehearsal.query(await readFile("apps/server/migrations/038_identity_workforce_operations.sql", "utf8"));
    const result = await rehearsal.query(`SELECT
      (SELECT count(*)::int FROM identity.memberships) AS membership_count,
      (SELECT count(*)::int FROM identity.organization_workforce_members) AS workforce_count,
      (SELECT count(*)::int FROM identity.organization_workforce_members WHERE source='legacy' AND status='active') AS active_legacy_count,
      (SELECT count(*)::int FROM identity.organization_provisioning_operations) AS operation_count`);
    migrated = result.rows[0];
    if (migrated.membership_count !== 3 || migrated.workforce_count !== 3 || migrated.active_legacy_count !== 3 ||
        migrated.operation_count !== 0) throw new Error(`Representative migration invariants failed: ${JSON.stringify(migrated)}`);
  } finally { await rehearsal.end(); }

  await createDatabase(recoveryDatabase, baselineDatabase);
  const recovered = new Pool({ connectionString: databaseUrl(recoveryDatabase), max: 1 });
  let recoveredMemberships;
  try {
    const result = await recovered.query("SELECT count(*)::int AS count FROM identity.memberships");
    recoveredMemberships = result.rows[0]?.count;
    const workforceTable = await recovered.query("SELECT to_regclass('identity.organization_workforce_members') AS table_name");
    if (recoveredMemberships !== 3 || workforceTable.rows[0]?.table_name !== null) {
      throw new Error("Pre-migration recovery copy did not preserve the representative baseline");
    }
  } finally { await recovered.end(); }

  const evidence = {
    status: "PASS", command: "npm run test:migration:workforce", migration: "037_organization_workforce",
    followUpMigration: "038_identity_workforce_operations", representativeOrganizations: 2,
    representativeMemberships: 3, migrated, recovery: {
      method: "disposable pre-migration database copy", recoveredMemberships,
      note: "Production recovery uses the documented encrypted database backup; schema rollback is not attempted."
    }
  };
  const evidenceDirectory = join(process.cwd(), "test-results", "migration");
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(join(evidenceDirectory, "step6-workforce-migration.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log("STEP6-WORKFORCE-MIGRATION PASS; evidence: test-results/migration/step6-workforce-migration.json");
} finally {
  for (const name of [rehearsalDatabase, recoveryDatabase, baselineDatabase]) {
    try { await terminate(name); await admin.query(`DROP DATABASE IF EXISTS ${name}`); } catch (error) {
      console.error(`Cleanup failed for ${name}:`, error);
    }
  }
  await admin.end();
}
