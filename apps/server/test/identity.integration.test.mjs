import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, sign as signBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Pool } from "pg";
import * as Y from "yjs";

import {
  createOfflinePluginBundle,
  createPluginRevocations,
  pluginDigest
} from "@plenum/plugin-sdk";

import {
  archiveSession,
  beginOidcLogin,
  activateDisplayPrincipal,
  claimSeat,
  configureSessionAccess,
  confirmReadiness,
  createGuestIdentity,
  createSession,
  deleteSession,
  decideJoinRequest,
  acceptPluginLicense,
  approvePluginArtifact,
  authorizePluginRun,
  bindPluginInstallation,
  completeOidcLogin,
  createDatabasePool,
  exportReleasePackage,
  getOperatorProjection,
  getReadiness,
  getPluginCatalog,
  getRuntimeDeltas,
  getRuntimeBootstrap,
  getRuntimeSnapshot,
  getRuntimeSse,
  importReleasePackage,
  importOfflinePluginBundle,
  importPluginRevocations,
  installPluginArtifact,
  LocalObjectStore,
  publishRelease,
  publishPendingRuntimeDeltas,
  provisionPluginTrustRoot,
  registerPluginPublisher,
  reassignParticipant,
  reassignSeat,
  retryOperatorDelivery,
  removeParticipants,
  requireActiveGuest,
  resolveInvitationSession,
  resolvePrincipalCommandContext,
  resolveSessionAccessContext,
  revokeAuthenticationSession,
  revokeSessionPrincipal,
  importRoster,
  issueInvitation,
  markSessionReady,
  openSession,
  submitJoinRequest,
  revokePluginArtifact,
  submitRuntimeCommand,
  getEffectProposals,
  getAdjudications,
  exportExtensionProvenance,
  executePendingModelRun,
  computeBuiltInTally,
  getPollProjection,
  getPollResult,
  issueMediaCredential,
  exportResearchEvidenceBundle,
  applyStudioUpdate,
  assertStudioSyncAccess,
  getCollaborativeDraft,
  getRolePreview,
  approvePublicationFreeze,
  exportResearchEvidenceIndex,
  freezeCollaborativeDraft,
  grantResearchAccess,
  publishCollaborativeDraft,
  revokeResearchAccess,
  requestFloor,
  releaseFloor,
  submitPluginArtifact,
  verifyImportedPackage,
  withOrganizationTransaction,
  applyCapabilityQuantityChange,
  applyDueStateValueChanges,
  cancelScheduledStateValueChange,
  scheduleStateValueChange,
  activateRelease,
  getReleaseHistory,
  getReleaseImpact,
  reviewReleaseImpact,
  createDueEvidenceCheckpoint,
  exportEvidenceVerification,
  verifyEvidenceExport,
  generateSessionReport,
  recordResearchConsent,
  recordAnalysis,
  createRetentionPolicy,
  placeLegalHold,
  releaseLegalHold,
  runRetentionEnforcement,
  consumeDeploymentRateLimit,
  recordCorrection,
  replaySession,
  exportOrganizationArchive,
  importOrganizationArchive,
  listReleaseCatalog,
  getReleaseCatalogItem,
  listSessionCatalog,
  getSessionCatalogItem,
  createConfiguredSession,
  listProjectPortal,
  listSimulationTemplates,
  publishSimulationTemplate,
  recordTemplateLifecycle,
  createProject,
  archiveProject,
  reopenProject,
  listContentLibrary,
  uploadContentVersion,
  getDataPolicyOperations,
  getSessionRetentionStatus,
  listOrganizationMemberAdministration,
  listPluginOperations,
  listSessionReportArtifacts,
  replaceOrganizationMemberRoles
} from "../dist/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for PS-110 integration tests");

const ids = {
  orgA: "10000000-0000-4000-8000-000000000001",
  orgB: "10000000-0000-4000-8000-000000000002",
  personA: "20000000-0000-4000-8000-000000000001",
  personB: "20000000-0000-4000-8000-000000000002",
  personC: "20000000-0000-4000-8000-000000000003",
  personD: "20000000-0000-4000-8000-000000000004",
  personE: "20000000-0000-4000-8000-000000000005",
  personF: "20000000-0000-4000-8000-000000000006",
  projectA: "30000000-0000-4000-8000-000000000001",
  projectB: "30000000-0000-4000-8000-000000000002",
  revisionA: "40000000-0000-4000-8000-000000000001",
  revisionB: "40000000-0000-4000-8000-000000000002",
  releaseA: "50000000-0000-4000-8000-000000000001",
  releaseB: "50000000-0000-4000-8000-000000000002",
  sessionA: "60000000-0000-4000-8000-000000000001",
  sessionB: "60000000-0000-4000-8000-000000000002",
  participantA: "70000000-0000-4000-8000-000000000001",
  participantB: "70000000-0000-4000-8000-000000000002",
  participantC: "70000000-0000-4000-8000-000000000003",
  assignmentA: "80000000-0000-4000-8000-000000000001",
  assignmentB: "80000000-0000-4000-8000-000000000002",
  assignmentC: "80000000-0000-4000-8000-000000000003",
  deviceA: "90000000-0000-4000-8000-000000000001",
  deviceC: "90000000-0000-4000-8000-000000000003",
  deploymentA: "a0000000-0000-4000-8000-000000000001",
  deploymentB: "a0000000-0000-4000-8000-000000000002"
};

const accessIds = {
  project: "30000000-0000-4000-8000-000000000003",
  revision: "40000000-0000-4000-8000-000000000003",
  release: "50000000-0000-4000-8000-000000000003",
  session: "60000000-0000-4000-8000-000000000003",
  deviceD: "90000000-0000-4000-8000-000000000004",
  deviceE: "90000000-0000-4000-8000-000000000005"
};

const owner = new Pool({ connectionString: databaseUrl, max: 1 });
const app = createDatabasePool(databaseUrl);
let principal;
let objectRoot;
let objectStore;
let oldRoleCursor;

const principalC = {
  authenticationSessionId: "e1000000-0000-4000-8000-000000000003",
  principalId: ids.personC,
  organizationId: ids.orgA,
  organizationRoles: [],
  authenticationStrength: "mfa",
  expiresAt: new Date("2099-01-01T00:00:00.000Z")
};

const principalD = {
  authenticationSessionId: "e1000000-0000-4000-8000-000000000004",
  principalId: ids.personD,
  organizationId: ids.orgA,
  organizationRoles: ["admin", "designer", "publisher"],
  authenticationStrength: "mfa",
  expiresAt: new Date("2099-01-01T00:00:00.000Z")
};

const principalE = {
  authenticationSessionId: "e1000000-0000-4000-8000-000000000005",
  principalId: ids.personE,
  organizationId: ids.orgA,
  organizationRoles: ["designer"],
  authenticationStrength: "mfa",
  expiresAt: new Date("2099-01-01T00:00:00.000Z")
};

const principalF = {
  authenticationSessionId: "e1000000-0000-4000-8000-000000000006",
  principalId: ids.personF,
  organizationId: ids.orgA,
  organizationRoles: ["reviewer"],
  authenticationStrength: "mfa",
  expiresAt: new Date("2099-01-01T00:00:00.000Z")
};

const releaseMaterialization = {
  coreDesign: {
    pluginBindings: [{
      id: "binding-1",
      pluginId: "plugin-1",
      pluginVersion: "1.0.0",
      pluginDigest: `sha256:${"c".repeat(64)}`,
      installationId: "installation-1",
      categories: [],
      connectivity: "offline_capable",
      configuration: {},
      configurationDigest: "d".repeat(64),
      inputMappings: [],
      timeoutSeconds: 5,
      enabledInProfiles: ["institutional"]
    }],
    platformAdapters: [{ id: "adapter-1", digest: "e".repeat(64) }]
  },
  scenario: {
    id: "scenario-1",
    name: "Synthetic publication fixture",
    description: "Portable, non-personal test content",
    deliveryModes: ["in_person"],
    tags: []
  }
};

async function applyMigrations(database = owner) {
  for (const path of [
    "references/plenum-runtime-slice/migrations/001_core.sql",
    "references/plenum-runtime-slice/migrations/002_runtime_sync_evidence.sql",
    "references/plenum-runtime-slice/migrations/003_collaboration.sql",
    "references/plenum-runtime-slice/migrations/004_security.sql",
    "apps/server/migrations/005_identity_oidc_context.sql",
    "apps/server/migrations/006_command_kernel.sql",
    "apps/server/migrations/007_release_packages.sql",
    "apps/server/migrations/008_projection_cursors.sql",
    "apps/server/migrations/009_runtime_capabilities.sql",
    "apps/server/migrations/010_information_messages_injects.sql",
    "apps/server/migrations/011_extension_registry.sql",
    "apps/server/migrations/012_extension_runs_approvals.sql",
    "apps/server/migrations/013_voting_core.sql",
    "apps/server/migrations/014_comms_voice_core.sql",
    "apps/server/migrations/015_collaboration_runtime.sql",
    "apps/server/migrations/016_voice_consent_assets.sql",
    "apps/server/migrations/017_session_access.sql",
    "apps/server/migrations/018_identity_roles_and_governance.sql",
    "apps/server/migrations/019_world_state_automation.sql",
    "apps/server/migrations/020_adjudication_records.sql",
    "apps/server/migrations/021_live_release_activation.sql",
    "apps/server/migrations/022_offline_devices.sql",
    "apps/server/migrations/023_evidence_checkpoints.sql",
    "apps/server/migrations/024_reporting_research.sql",
    "apps/server/migrations/025_security_retention_enforcement.sql",
    "apps/server/migrations/026_product_portal.sql",
    "apps/server/migrations/027_release_session_catalog.sql",
    "apps/server/migrations/028_content_library.sql",
    "apps/server/migrations/030_template_review_governance.sql",
    "apps/server/migrations/032_operations_administration.sql"
  ]) {
    await database.query(await readFile(new URL(`../../../${path}`, import.meta.url), "utf8"));
  }
}

async function createCleanArchiveTarget(archive) {
  const databaseName = `plenum_archive_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const targetUrl = new URL(databaseUrl);
  targetUrl.pathname = `/${databaseName}`;
  const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  await admin.query(`CREATE DATABASE ${databaseName}`);
  const targetOwner = new Pool({ connectionString: targetUrl.toString(), max: 1 });
  try {
    await applyMigrations(targetOwner);
    const organization = archive.data.organization;
    const person = archive.data.persons.find(({ id }) => id === principalD.principalId);
    const adminMembership = archive.data.memberships.find(({ person_id, organization_role }) =>
      person_id === principalD.principalId && organization_role === "admin");
    assert.ok(person);
    assert.ok(adminMembership);
    await targetOwner.query(
      "INSERT INTO identity.organizations SELECT * FROM jsonb_populate_record(NULL::identity.organizations,$1::jsonb)",
      [JSON.stringify(organization)]
    );
    await targetOwner.query(
      "INSERT INTO identity.persons SELECT * FROM jsonb_populate_record(NULL::identity.persons,$1::jsonb)",
      [JSON.stringify(person)]
    );
    await targetOwner.query(
      "INSERT INTO identity.memberships SELECT * FROM jsonb_populate_record(NULL::identity.memberships,$1::jsonb)",
      [JSON.stringify(adminMembership)]
    );
    await targetOwner.query(`INSERT INTO identity.authentication_sessions
      (id,organization_id,person_id,issuer,subject,authentication_strength,expires_at)
      VALUES ($1,$2,$3,'https://archive-bootstrap.invalid','archive-admin','mfa','2099-01-01T00:00:00.000Z')`,
    [principalD.authenticationSessionId, principalD.organizationId, principalD.principalId]);
    const targetApp = createDatabasePool(targetUrl.toString());
    return {
      owner: targetOwner,
      app: targetApp,
      async close() {
        await targetApp.end();
        await targetOwner.end();
        await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1", [databaseName]);
        await admin.query(`DROP DATABASE ${databaseName}`);
        await admin.end();
      }
    };
  } catch (error) {
    await targetOwner.end();
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1", [databaseName]);
    await admin.query(`DROP DATABASE ${databaseName}`);
    await admin.end();
    throw error;
  }
}

async function seed() {
  const collaborativeMaterialization = JSON.parse(await readFile(
    new URL("../../../definitions/fractured-order/fractured-order-release.json", import.meta.url), "utf8"
  ));
  const client = await owner.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'Org A'),($2,'Org B')", [ids.orgA, ids.orgB]);
    await client.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'Operator A'),($2,'Operator B'),($3,'Participant C'),($4,'Approver D'),($5,'Designer E'),($6,'Reviewer F')", [ids.personA, ids.personB, ids.personC, ids.personD, ids.personE, ids.personF]);
    await client.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'operator'),($3,$4,'operator'),($3,$4,'publisher'),($3,$5,'admin'),($3,$5,'designer'),($3,$6,'admin'),($3,$6,'designer'),($3,$6,'publisher'),($1,$5,'designer'),($1,$5,'research_analyst'),($1,$6,'admin'),($1,$6,'designer'),($1,$6,'publisher'),($1,$7,'designer'),($1,$8,'reviewer')", [ids.orgA, ids.personA, ids.orgB, ids.personB, ids.personC, ids.personD, ids.personE, ids.personF]);
    await client.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'Project A',$3),($4,$5,'Project B',$6)", [ids.projectA, ids.orgA, ids.personA, ids.projectB, ids.orgB, ids.personB]);
    await client.query(
      "INSERT INTO studio.drafts(id,organization_id,project_id,document,updated_by) VALUES (gen_random_uuid(),$1,$2,$3::jsonb,$4)",
      [ids.orgB, ids.projectB, JSON.stringify(releaseMaterialization), ids.personB]
    );
    await client.query(
      "INSERT INTO studio.drafts(id,organization_id,project_id,document,updated_by) VALUES (gen_random_uuid(),$1,$2,$3::jsonb,$4)",
      [ids.orgA, ids.projectA, JSON.stringify(collaborativeMaterialization), ids.personC]
    );
    await client.query(`INSERT INTO studio.definition_revisions
      (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
      VALUES ($1,$2,$3,'{"sessionRoles":[{"id":"role-a","isControlRole":false},{"id":"role-control","isControlRole":true}]}',repeat('a',64),'v1',$4),
             ($5,$6,$7,'{"sessionRoles":[{"id":"role-b","isControlRole":false}]}',repeat('b',64),'v1',$8)`,
      [ids.revisionA, ids.orgA, ids.projectA, ids.personA, ids.revisionB, ids.orgB, ids.projectB, ids.personB]);
    await client.query(`INSERT INTO registry.releases
      (id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
      VALUES ($1,$2,$3,$4,1,'A','1','1',repeat('a',64),'a',$5),($6,$7,$8,$9,1,'B','1','1',repeat('b',64),'b',$10)`,
      [ids.releaseA, ids.orgA, ids.projectA, ids.revisionA, ids.personA, ids.releaseB, ids.orgB, ids.projectB, ids.revisionB, ids.personB]);
    await client.query("INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by) VALUES ($1,$2,$3,$4,'active',$5),($6,$7,$8,$9,'active',$10)", [ids.sessionA, ids.orgA, ids.projectA, ids.releaseA, ids.personA, ids.sessionB, ids.orgB, ids.projectB, ids.releaseB, ids.personB]);
    await client.query("INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status) VALUES ($1,$2,$3,1,'active'),($4,$5,$6,1,'active')", [ids.sessionA, ids.orgA, ids.deploymentA, ids.sessionB, ids.orgB, ids.deploymentB]);
    await client.query(`INSERT INTO runtime.release_activations
      (id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
      VALUES ('b0000000-0000-4000-8000-000000000001',$1,$2,$3,$4,1,'{}',$5),('b0000000-0000-4000-8000-000000000002',$6,$7,$8,$9,1,'{}',$10)`,
      [ids.orgA, ids.projectA, ids.sessionA, ids.releaseA, ids.personA, ids.orgB, ids.projectB, ids.sessionB, ids.releaseB, ids.personB]);
    await client.query("INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES ($1,$2,$3,$4),($5,$6,$7,$8),($9,$10,$11,$12)", [ids.participantA, ids.orgA, ids.sessionA, ids.personA, ids.participantB, ids.orgB, ids.sessionB, ids.personB, ids.participantC, ids.orgA, ids.sessionA, ids.personC]);
    await client.query("INSERT INTO runtime.seat_assignments(id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by) VALUES ($1,$2,$3,$4,'role-a','seat-a',$5),($6,$7,$8,$9,'role-b','seat-b',$10),($11,$12,$13,$14,'role-c-viewer','seat-c-viewer',$15)", [ids.assignmentA, ids.orgA, ids.sessionA, ids.participantA, ids.personA, ids.assignmentB, ids.orgB, ids.sessionB, ids.participantB, ids.personB, ids.assignmentC, ids.orgA, ids.sessionA, ids.participantC, ids.personA]);
    await client.query("INSERT INTO runtime.participant_access_revisions(organization_id,session_id,participant_id) VALUES ($1,$2,$3),($4,$5,$6),($7,$8,$9)", [ids.orgA, ids.sessionA, ids.participantA, ids.orgB, ids.sessionB, ids.participantB, ids.orgA, ids.sessionA, ids.participantC]);
    await client.query("INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3),($4,$5,$6)", [ids.deviceA, ids.orgA, ids.personA, ids.deviceC, ids.orgA, ids.personC]);
    await client.query("INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2),($3,$4)", [ids.sessionA, ids.orgA, ids.sessionB, ids.orgB]);
    await client.query("INSERT INTO identity.federated_identities(id,organization_id,person_id,issuer,subject,provider_type) VALUES ('c0000000-0000-4000-8000-000000000001',$1,$2,'https://issuer.example','operator-a','oidc')", [ids.orgA, ids.personA]);
    await client.query("INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at) VALUES ($1,$2,$3,'https://issuer.example','participant-c','mfa','2099-01-01T00:00:00.000Z')", [principalC.authenticationSessionId, ids.orgA, ids.personC]);
    await client.query("INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at) VALUES ($1,$2,$3,'https://issuer.example','publisher-d','mfa','2099-01-01T00:00:00.000Z')", [principalD.authenticationSessionId, ids.orgA, ids.personD]);
    await client.query("INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at) VALUES ($1,$2,$3,'https://issuer.example','designer-e','mfa','2099-01-01T00:00:00.000Z')", [principalE.authenticationSessionId, ids.orgA, ids.personE]);
    await client.query("INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at) VALUES ($1,$2,$3,'https://issuer.example','reviewer-f','mfa','2099-01-01T00:00:00.000Z')", [principalF.authenticationSessionId, ids.orgA, ids.personF]);
    await client.query("INSERT INTO sync.projection_grants(id,organization_id,session_id,participant_id,policy_revision,access_revision,expires_at) VALUES ('d0000000-0000-4000-8000-000000000001',$1,$2,$3,'policy-decision-v1',1,now()+interval '1 hour')", [ids.orgA, ids.sessionA, ids.participantA]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

before(async () => {
  await applyMigrations();
  await seed();
  objectRoot = await mkdtemp(join(tmpdir(), "plenum-release-"));
  objectStore = new LocalObjectStore(objectRoot);
});

after(async () => {
  await app.end();
  await owner.end();
  await rm(objectRoot, { recursive: true, force: true });
});

test("PS-110-T01 maps a verified OIDC subject through server configuration", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "integration-key";
  const configuration = {
    providerKey: "test",
    organizationId: ids.orgA,
    issuer: "https://issuer.example",
    audience: "plenum",
    clientId: "plenum",
    redirectUri: "https://plenum.example/callback",
    authorizationEndpoint: "https://issuer.example/authorize",
    tokenEndpoint: "https://issuer.example/token",
    jwks: { keys: [jwk] }
  };
  const login = await beginOidcLogin(app, configuration);
  const pending = await owner.query(
    "SELECT nonce FROM identity.oidc_login_attempts WHERE organization_id=$1 AND state_sha256 IS NOT NULL",
    [ids.orgA]
  );
  const now = Math.floor(Date.now() / 1000);
  const idToken = await new SignJWT({ nonce: pending.rows[0].nonce, acr: "mfa" })
    .setProtectedHeader({ alg: "RS256", kid: "integration-key" })
    .setIssuer(configuration.issuer).setAudience(configuration.audience).setSubject("operator-a")
    .setIssuedAt(now).setExpirationTime(now + 600).sign(privateKey);
  principal = await completeOidcLogin(
    app,
    configuration,
    { code: "code", state: login.state, correlationId: "e0000000-0000-4000-8000-000000000001" },
    async () => new Response(JSON.stringify({ id_token: idToken }), { status: 200 })
  );
  assert.equal(principal.principalId, ids.personA);
  assert.equal(principal.organizationId, ids.orgA);
  assert.deepEqual(principal.organizationRoles, ["operator"]);
});

test("DB-01 keeps pooled real-app-role reads and writes tenant isolated", async () => {
  const a = await withOrganizationTransaction(app, ids.orgA, (client) =>
    client.query("SELECT organization_id,title FROM studio.simulation_projects ORDER BY title"));
  const b = await withOrganizationTransaction(app, ids.orgB, (client) =>
    client.query("SELECT organization_id,title FROM studio.simulation_projects ORDER BY title"));
  assert.deepEqual(a.rows, [{ organization_id: ids.orgA, title: "Project A" }]);
  assert.deepEqual(b.rows, [{ organization_id: ids.orgB, title: "Project B" }]);
  await assert.rejects(
    withOrganizationTransaction(app, ids.orgA, (client) => client.query(
      "INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES (gen_random_uuid(),$1,'Hostile',$2)",
      [ids.orgB, ids.personB]
    )),
    /row-level security policy/
  );
  await assert.rejects(
    withOrganizationTransaction(app, ids.orgA, (client) => client.query("SELECT * FROM evidence.audit_records")),
    /permission denied/
  );
});

test("PS-790-T01 administration is tenant-scoped, least-privilege, auditable, and concurrency safe", async () => {
  const members = await listOrganizationMemberAdministration(app, principalD, randomUUID());
  assert.equal(members.contractId, "operations-admin-v1");
  assert.equal(members.members.every((member) => member.personId !== ids.personB), true);
  const reviewer = members.members.find((member) => member.personId === ids.personF);
  assert.ok(reviewer);
  assert.deepEqual(reviewer.roles, ["reviewer"]);

  const changed = await replaceOrganizationMemberRoles(app, principalD, ids.personF,
    { roles: ["operator", "reviewer"], expectedRevision: reviewer.revision }, randomUUID());
  assert.deepEqual(changed.roles, ["operator", "reviewer"]);
  await assert.rejects(
    replaceOrganizationMemberRoles(app, principalD, ids.personF,
      { roles: ["reviewer"], expectedRevision: reviewer.revision }, randomUUID()),
    (error) => error?.envelope?.error?.code === "STALE_AGGREGATE_VERSION"
  );
  const restored = await replaceOrganizationMemberRoles(app, principalD, ids.personF,
    { roles: ["reviewer"], expectedRevision: changed.revision }, randomUUID());
  assert.deepEqual(restored.roles, ["reviewer"]);

  const admin = members.members.find((member) => member.personId === ids.personD);
  assert.ok(admin);
  await assert.rejects(
    replaceOrganizationMemberRoles(app, principalD, ids.personD,
      { roles: admin.roles.filter((role) => role !== "admin"), expectedRevision: admin.revision }, randomUUID()),
    (error) => error?.envelope?.error?.code === "INVALID_TRANSITION"
  );
  const auditRows = await owner.query(
    "SELECT action,target_ref FROM evidence.audit_records WHERE organization_id=$1 AND action='organization.roles_replaced' AND target_ref=$2",
    [ids.orgA, `person:${ids.personF}`]
  );
  assert.equal(auditRows.rowCount, 2);

  const publisherOnly = { ...principalD, organizationRoles: ["publisher"] };
  const plugins = await listPluginOperations(app, publisherOnly, randomUUID());
  assert.deepEqual(plugins.permissions, { canSubmit: true, canApprove: false, canInstall: false, canRevoke: false });
  await assert.rejects(listPluginOperations(app, principalF, randomUUID()),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED");

  const policies = await getDataPolicyOperations(app, principalD, randomUUID());
  assert.equal(policies.contractId, "operations-admin-v1");
  const retention = await getSessionRetentionStatus(app, principalD, ids.sessionA, randomUUID());
  assert.equal(retention.sessionId, ids.sessionA);
  assert.match(retention.consequences.join(" "), /immutable Governing Release/u);
  assert.deepEqual((await listSessionReportArtifacts(app, principalD, ids.sessionA, randomUUID())).artifacts, []);
  await assert.rejects(getDataPolicyOperations(app, principalF, randomUUID()),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED");
});

test("PS-710-T02 Project and Template lifecycle is tenant-scoped, replay-safe, versioned, and least-privilege", async () => {
  const templateId = "31000000-0000-4000-8000-000000000001";
  await owner.query(
    `INSERT INTO studio.simulation_templates
       (id,organization_id,title,summary,source_project_id,core_design,scenario,published_by)
     VALUES ($1,$2,'Reusable Core Design','Synthetic PS-710 template',$3,$4::jsonb,$5::jsonb,$6)`,
    [templateId, ids.orgA, ids.projectA, JSON.stringify(releaseMaterialization.coreDesign),
      JSON.stringify({ ...releaseMaterialization.scenario, content: [{ id: "scenario-secret" }] }), ids.personD]
  );

  const designerView = await listProjectPortal(app, principalE, { status: "all", limit: 10 }, randomUUID());
  assert.equal(designerView.contractId, "project-portal-v1");
  assert.equal(designerView.projects.some(({ id }) => id === ids.projectA), true);
  assert.equal(designerView.projects.some(({ id }) => id === ids.projectB), false);
  assert.equal(designerView.members, undefined);
  const adminView = await listProjectPortal(app, principalD, { status: "all", limit: 10 }, randomUUID());
  assert.equal(adminView.permissions.canViewMembers, true);
  assert.ok(adminView.members?.some(({ id }) => id === ids.personF));
  await owner.query(`INSERT INTO studio.project_collaborators
    (organization_id,project_id,person_id,project_role,added_by) VALUES ($1,$2,$3,'reviewer',$4)`,
  [ids.orgA, ids.projectA, ids.personF, ids.personD]);
  const reviewerView = await listProjectPortal(app, principalF, { status: "all" }, randomUUID());
  assert.equal(reviewerView.permissions.canCreateProject, false);
  assert.deepEqual(reviewerView.projects.map(({ id }) => id), [ids.projectA]);
  assert.deepEqual((await listSimulationTemplates(app, principalF, {}, randomUUID())).templates, []);
  await assert.rejects(() => listProjectPortal(app, principal, {}, randomUUID()),
    (error) => error.envelope?.error.code === "ACCESS_REVOKED");

  const library = await listSimulationTemplates(app, principalE, { limit: 10 }, randomUUID());
  assert.equal(library.contractId, "template-library-v1");
  assert.equal(library.templates[0]?.id, templateId);
  const requestId = randomUUID();
  const concurrent = await Promise.all([createProject(app, principalE, {
    requestId, title: "Template copy without Scenario", templateId
  }, randomUUID()), createProject(app, principalE, {
    requestId, title: "Template copy without Scenario", templateId
  }, randomUUID())]);
  const created = concurrent.find(({ replayed }) => !replayed);
  assert.ok(created);
  assert.equal(new Set(concurrent.map(({ projectId }) => projectId)).size, 1);
  assert.deepEqual(concurrent.map(({ replayed }) => replayed).sort(), [false, true]);
  const replay = await createProject(app, principalE, {
    requestId, title: "Template copy without Scenario", templateId
  }, randomUUID());
  assert.equal(replay.projectId, created.projectId);
  assert.equal(replay.replayed, true);
  await assert.rejects(() => createProject(app, principalE, {
    requestId, title: "Idempotency collision", templateId
  }, randomUUID()), (error) => error.envelope?.error.code === "IDEMPOTENCY_COLLISION");
  const copied = (await owner.query("SELECT document FROM studio.drafts WHERE project_id=$1", [created.projectId])).rows[0].document;
  assert.deepEqual(copied.scenario, { id: copied.scenario.id, name: "Untitled Scenario", description: "", deliveryModes: [], tags: [] });
  assert.deepEqual(copied.coreDesign, releaseMaterialization.coreDesign);
  const explicitScenario = await createProject(app, principalE, {
    requestId: randomUUID(), title: "Template copy with Scenario", templateId, includeScenario: true
  }, randomUUID());
  const explicitDocument = (await owner.query("SELECT document FROM studio.drafts WHERE project_id=$1", [explicitScenario.projectId])).rows[0].document;
  assert.deepEqual(explicitDocument.scenario.content, [{ id: "scenario-secret" }]);
  const interruptedTitle = "Missing Template remains atomic";
  await assert.rejects(() => createProject(app, principalE, {
    requestId: randomUUID(), title: interruptedTitle, templateId: randomUUID()
  }, randomUUID()), (error) => error.envelope?.error.code === "TARGET_NOT_FOUND");
  assert.equal(Number((await owner.query("SELECT count(*) FROM studio.simulation_projects WHERE title=$1", [interruptedTitle])).rows[0].count), 0);

  const releaseCount = Number((await owner.query("SELECT count(*) FROM registry.releases WHERE project_id=$1", [ids.projectA])).rows[0].count);
  const archiveRequestId = randomUUID();
  const archived = await archiveProject(app, principalE, created.projectId,
    { requestId: archiveRequestId, expectedVersion: 1 }, randomUUID());
  assert.equal(archived.lifecycleStatus, "archived");
  const archiveReplay = await archiveProject(app, principalE, created.projectId,
    { requestId: archiveRequestId, expectedVersion: 1 }, randomUUID());
  assert.equal(archiveReplay.replayed, true);
  await assert.rejects(() => reopenProject(app, principalE, created.projectId,
    { requestId: randomUUID(), expectedVersion: 1 }, randomUUID()),
  (error) => error.envelope?.error.code === "STALE_AGGREGATE_VERSION");
  const reopened = await reopenProject(app, principalE, created.projectId,
    { requestId: randomUUID(), expectedVersion: 2 }, randomUUID());
  assert.equal(reopened.lifecycleStatus, "active");
  assert.equal(Number((await owner.query("SELECT count(*) FROM registry.releases WHERE project_id=$1", [ids.projectA])).rows[0].count), releaseCount);
  await assert.rejects(() => archiveProject(app, principalD, ids.projectB,
    { requestId: randomUUID(), expectedVersion: 1 }, randomUUID()),
  (error) => error.envelope?.error.code === "TARGET_NOT_FOUND");

  await owner.query("DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2 AND organization_role='designer'", [ids.orgA, ids.personE]);
  try {
    await assert.rejects(() => archiveProject(app, principalE, created.projectId,
      { requestId: randomUUID(), expectedVersion: 3 }, randomUUID()),
    (error) => error.envelope?.error.code === "ACCESS_REVOKED");
  } finally {
    await owner.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'designer')", [ids.orgA, ids.personE]);
  }

  await owner.query("DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2 AND organization_role='reviewer'", [ids.orgA, ids.personF]);
  try {
    await assert.rejects(() => listProjectPortal(app, principalF, {}, randomUUID()),
      (error) => error.envelope?.error.code === "ACCESS_REVOKED");
  } finally {
    await owner.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'reviewer')", [ids.orgA, ids.personF]);
  }
});

test("PS-740-T01 Content Library is tenant-scoped, immutable, replay-safe, and fails closed", async () => {
  const cleanScanner = { async scan() { return { status: "clean", detail: "No threat detected." }; } };
  const safeBytes = Buffer.from("Synthetic governed content for PS-740.", "utf8");
  const requestId = randomUUID();
  const input = {
    requestId,
    title: "PS-740 governed content",
    fileName: "governed-content.txt",
    mediaType: "text/plain",
    bytes: safeBytes
  };

  const initial = await listContentLibrary(app, principalE, ids.projectA, randomUUID());
  assert.equal(initial.contractId, "content-library-v1");
  assert.equal(initial.items.length, 0);

  const concurrent = await Promise.all([
    uploadContentVersion(app, objectStore, cleanScanner, principalE, ids.projectA, input, randomUUID()),
    uploadContentVersion(app, objectStore, cleanScanner, principalE, ids.projectA, input, randomUUID())
  ]);
  assert.equal(new Set(concurrent.map(({ contentItem }) => contentItem.id)).size, 1);
  assert.deepEqual(concurrent.map(({ replayed }) => replayed).sort(), [false, true]);
  const contentItemId = concurrent[0].contentItem.id;
  assert.equal(concurrent[0].contentItem.versions[0].scanStatus, "clean");
  assert.notEqual(concurrent[0].contentItem.versions[0].availableAt, null);

  const second = await uploadContentVersion(app, objectStore, cleanScanner, principalE, ids.projectA, {
    ...input,
    requestId: randomUUID(),
    contentItemId,
    title: "PS-740 governed content revision",
    bytes: Buffer.from("Synthetic governed content version two.", "utf8")
  }, randomUUID());
  assert.equal(second.contentItem.currentVersion, 2);
  const afterVersion = await listContentLibrary(app, principalE, ids.projectA, randomUUID());
  assert.equal(afterVersion.items.length, 1);
  assert.deepEqual(afterVersion.items[0].versions.map(({ version }) => version), [2, 1]);

  const infected = await uploadContentVersion(app, objectStore, {
    async scan() { return { status: "infected", detail: "Synthetic threat signature detected." }; }
  }, principalE, ids.projectA, {
    ...input, requestId: randomUUID(), title: "Quarantined content", fileName: "quarantined.txt",
    bytes: Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE", "utf8")
  }, randomUUID());
  assert.equal(infected.contentItem.versions[0].scanStatus, "infected");
  assert.equal(infected.contentItem.versions[0].availableAt, null);

  const failed = await uploadContentVersion(app, objectStore, {
    async scan() { throw new Error("synthetic scanner outage"); }
  }, principalE, ids.projectA, {
    ...input, requestId: randomUUID(), title: "Failed scan content", fileName: "failed.txt"
  }, randomUUID());
  assert.equal(failed.contentItem.versions[0].scanStatus, "failed");
  assert.equal(failed.contentItem.versions[0].availableAt, null);

  await assert.rejects(() => uploadContentVersion(app, objectStore, cleanScanner, principalE, ids.projectA, {
    ...input, requestId: randomUUID(), mediaType: "application/pdf"
  }, randomUUID()), (error) => error.envelope?.error.code === "VALIDATION_FAILED");
  await assert.rejects(() => uploadContentVersion(app, objectStore, cleanScanner, principalE, ids.projectA, {
    ...input, requestId: randomUUID(), bytes: Buffer.alloc(512 * 1024 + 1, 65)
  }, randomUUID()), (error) => error.envelope?.error.code === "TOO_LARGE");
  await assert.rejects(() => listContentLibrary(app, principalF, ids.projectA, randomUUID()),
    (error) => error.envelope?.error.code === "ACCESS_REVOKED");
  await assert.rejects(() => listContentLibrary(app, principalE, ids.projectB, randomUUID()),
    (error) => error.envelope?.error.code === "ACCESS_REVOKED");
  const interruptedRequestId = randomUUID();
  const interruptedBytes = Buffer.from("Interrupted content version.", "utf8");
  await assert.rejects(() => uploadContentVersion(app, objectStore, cleanScanner, principalE, ids.projectA, {
    ...input, requestId: interruptedRequestId, contentItemId: randomUUID(), bytes: interruptedBytes
  }, randomUUID()), (error) => error.envelope?.error.code === "NOT_FOUND");
  const interruptedDigest = createHash("sha256").update(interruptedBytes).digest("hex");
  await assert.rejects(() => objectStore.get(
    `studio-content/${ids.orgA}/${ids.projectA}/${interruptedRequestId}/${interruptedDigest}`
  ), (error) => error?.code === "ENOENT");
  await assert.rejects(() => owner.query(
    "UPDATE studio.content_versions SET scan_detail='mutated' WHERE content_item_id=$1", [contentItemId]
  ), /append-only/i);
});

test("PS-720-T01/T02 AC-03 catalogs immutable Releases and creates one configured Session exactly once", async () => {
  const projectId = "30000000-0000-4000-8000-000000000720";
  const revisionId = "40000000-0000-4000-8000-000000000720";
  const releaseId = "50000000-0000-4000-8000-000000000720";
  const sessionId = "60000000-0000-4000-8000-000000000720";
  const commandId = "f0000000-0000-4000-8000-000000000720";
  const snapshot = {
    coreDesign: {
      accessPolicy: { readiness: [
        { key: "staffing", label: "Required Seats are staffed", blocking: true },
        { key: "operator_check", label: "Operator review is complete", blocking: true }
      ] },
      seats: [{ id: "control", sessionRoleIds: ["role-control"], minOccupancy: 1,
        maxOccupancy: 1, required: true, joinMode: "assigned" }]
    },
    scenario: { id: "scenario-720", name: "Lifecycle fixture", description: "Synthetic", deliveryModes: [], tags: [] }
  };
  await owner.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'PS-720 Lifecycle',$3)",
    [projectId, ids.orgA, ids.personA]);
  await owner.query(`INSERT INTO studio.definition_revisions
    (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
    VALUES ($1,$2,$3,$4::jsonb,repeat('7',64),'v1',$5)`,
  [revisionId, ids.orgA, projectId, JSON.stringify(snapshot), ids.personA]);
  await owner.query(`INSERT INTO registry.releases
    (id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,
     compiler_version,package_sha256,blob_key,published_by)
    VALUES ($1,$2,$3,$4,1,'PS-720 immutable Release','release-package-v1','compiler-v1',repeat('7',64),'ps-720/release.json',$5)`,
  [releaseId, ids.orgA, projectId, revisionId, ids.personD]);

  const publisherCatalog = await listReleaseCatalog(app, principalD, { query: "PS-720", limit: 10 }, randomUUID());
  assert.equal(publisherCatalog.contractId, "release-catalog-v1");
  assert.deepEqual(publisherCatalog.permissions, { canExportPackage: true, canImportPackage: true, canCreateSession: false });
  assert.deepEqual(publisherCatalog.releases.map(({ id }) => id), [releaseId]);
  assert.equal((await getReleaseCatalogItem(app, principalD, releaseId, randomUUID())).immutable, true);
  const operatorCatalog = await listReleaseCatalog(app, principal, { query: "PS-720" }, randomUUID());
  assert.equal(operatorCatalog.permissions.canCreateSession, true);
  assert.equal(operatorCatalog.permissions.canExportPackage, false);
  await assert.rejects(() => listReleaseCatalog(app, principalF, {}, randomUUID()),
    (error) => error.envelope?.error.code === "ACCESS_REVOKED");
  await assert.rejects(() => listReleaseCatalog(app, { ...principal, organizationId: ids.orgB }, {}, randomUUID()),
    (error) => error.envelope?.error.code === "ACCESS_REVOKED");

  const command = {
    commandId, deviceId: ids.deviceA, operationType: "session.create", aggregateId: sessionId,
    expectedAggregateVersion: 0, governingReleaseId: releaseId,
    payload: { title: "PS-720 configured Session", scheduledStartAt: "2030-02-03T14:30:00.000Z" }
  };
  const duplicate = await Promise.all([
    createConfiguredSession(app, principal, releaseId, command, randomUUID(), ids.deploymentA),
    createConfiguredSession(app, principal, releaseId, command, randomUUID(), ids.deploymentA)
  ]);
  assert.deepEqual(duplicate.map(({ replayed }) => replayed).sort(), [false, true]);
  assert.equal(new Set(duplicate.map(({ sessionId: id }) => id)).size, 1);
  const replay = await createConfiguredSession(app, principal, releaseId, command, randomUUID(), ids.deploymentA);
  assert.equal(replay.replayed, true);
  await assert.rejects(() => createConfiguredSession(app, principal, releaseId, {
    ...command, payload: { ...command.payload, title: "Collision" }
  }, randomUUID(), ids.deploymentA), (error) => error.envelope?.error.code === "IDEMPOTENCY_COLLISION");

  const sessions = await listSessionCatalog(app, principal, { query: "PS-720", status: "configured" }, randomUUID());
  assert.equal(sessions.contractId, "session-catalog-v1");
  assert.deepEqual(sessions.sessions.map(({ id }) => id), [sessionId]);
  const detail = await getSessionCatalogItem(app, principal, sessionId, randomUUID());
  assert.equal(detail.governingRelease.id, releaseId);
  assert.equal(detail.status, "configured");
  assert.equal(detail.urls.detail, `/sessions/${sessionId}`);
  const adminSessions = await listSessionCatalog(app, principalD, { query: "PS-720" }, randomUUID());
  assert.deepEqual(adminSessions.permissions, { canCreateSession: false, canOperateSessions: false });
  assert.deepEqual(adminSessions.sessions.map(({ id }) => id), [sessionId]);
  await assert.rejects(() => listSessionCatalog(app, principalF, {}, randomUUID()),
    (error) => error.envelope?.error.code === "ACCESS_REVOKED");
  await assert.rejects(() => getSessionCatalogItem(app, { ...principal, organizationId: ids.orgB }, sessionId, randomUUID()),
    (error) => error.envelope?.error.code === "ACCESS_REVOKED");

  const persisted = await owner.query(`SELECT
    (SELECT count(*)::int FROM runtime.sessions WHERE id=$1) AS sessions,
    (SELECT count(*)::int FROM sync.command_receipts WHERE session_id=$1 AND command_id=$2) AS receipts,
    (SELECT count(*)::int FROM evidence.events WHERE session_id=$1) AS events,
    (SELECT count(*)::int FROM sync.session_delta_outbox WHERE session_id=$1) AS outbox,
    (SELECT count(*)::int FROM evidence.audit_records WHERE target_ref=$3) AS audits,
    (SELECT package_sha256 FROM registry.releases WHERE id=$4) AS release_digest`,
  [sessionId, commandId, `session:${sessionId}`, releaseId]);
  assert.deepEqual(persisted.rows[0], { sessions: 1, receipts: 1, events: 2, outbox: 2, audits: 1,
    release_digest: "7".repeat(64) });
});

test("PS-550-T01 shares atomic request limits across concurrent application connections", async () => {
  const deploymentId = randomUUID();
  const rule = { category: "authentication", limit: 10, scope: `ip:${randomUUID()}` };
  const now = new Date("2026-10-26T12:00:30.000Z");
  const firstWindow = await Promise.all(Array.from({ length: 10 }, () =>
    consumeDeploymentRateLimit(app, deploymentId, rule, now)));
  assert.equal(firstWindow.every(({ allowed }) => allowed), true);
  const denied = await consumeDeploymentRateLimit(app, deploymentId, rule, now);
  assert.deepEqual({ allowed: denied.allowed, remaining: denied.remaining, retryAfterSeconds: denied.retryAfterSeconds },
    { allowed: false, remaining: 0, retryAfterSeconds: 30 });
  assert.equal((await consumeDeploymentRateLimit(app, deploymentId, rule,
    new Date("2026-10-26T12:01:00.000Z"))).allowed, true);
});

test("AC-03 creates a tenant-scoped Session from a published Release atomically", async () => {
  const correlationId = randomUUID();
  const created = await createSession(app, principal, ids.projectA, ids.releaseA, correlationId, ids.deploymentA);
  assert.deepEqual(created, {
    contractId: "session-onboarding-v1",
    sessionId: created.sessionId,
    projectId: ids.projectA,
    governingReleaseId: ids.releaseA,
    status: "created"
  });
  const persisted = await owner.query(
    `SELECT session.status,activation.release_id,authority.deployment_id,operator.person_id,
            sequence.next_sequence,audit.details->>'correlationId' AS correlation_id
       FROM runtime.sessions session
       JOIN runtime.release_activations activation ON activation.organization_id=session.organization_id AND activation.session_id=session.id
       JOIN runtime.session_authorities authority ON authority.organization_id=session.organization_id AND authority.session_id=session.id
       JOIN runtime.session_operators operator ON operator.organization_id=session.organization_id AND operator.session_id=session.id
       JOIN evidence.session_sequences sequence ON sequence.organization_id=session.organization_id AND sequence.session_id=session.id
       JOIN evidence.audit_records audit ON audit.organization_id=session.organization_id AND audit.target_ref='session:'||session.id::text
      WHERE session.organization_id=$1 AND session.id=$2`,
    [ids.orgA, created.sessionId]
  );
  assert.deepEqual(persisted.rows[0], {
    status: "created",
    release_id: ids.releaseA,
    deployment_id: ids.deploymentA,
    person_id: ids.personA,
    next_sequence: "1",
    correlation_id: correlationId
  });
  await assert.rejects(
    createSession(app, principalC, ids.projectA, ids.releaseA, randomUUID(), ids.deploymentA),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED"
  );
  await assert.rejects(
    createSession(app, principal, ids.projectA, ids.releaseB, randomUUID(), ids.deploymentA),
    (error) => error?.envelope?.error?.code === "REFERENCE_INVALID"
  );
});

test("AC-03 PS-340-T01/T02 gates verified onboarding, exclusive Seats, reassignment and readiness", async () => {
  const accessPolicy = {
    joinMethods: ["invitation", "code_and_verified_email", "waiting_room", "open_seat_selection", "operator_assignment"],
    guests: { allowed: true, requiredFields: ["displayName"], expiryHours: 2, includeInResearchExports: false, operatorApproval: true },
    displays: [{ interfaceProfileId: "observer", classificationCeiling: "internal" }],
    reassignment: { allowedBy: "operator", crossTeamAllowed: true, exposureAcknowledgementRequired: true },
    readiness: [
      { key: "permissions", label: "Permissions verified", blocking: true },
      { key: "recovery", label: "Recovery rehearsed", blocking: true }
    ]
  };
  const snapshot = { coreDesign: { accessPolicy, seats: [
    { id: "blue-lead", name: "Blue lead", sessionRoleIds: ["lead"], teamId: "blue", minOccupancy: 1, maxOccupancy: 1, required: true, joinMode: "open_seat_selection" },
    { id: "red-lead", name: "Red lead", sessionRoleIds: ["lead"], teamId: "red", minOccupancy: 0, maxOccupancy: 1, required: false, joinMode: "operator_assignment" }
  ] } };
  await owner.query("BEGIN");
  try {
    await owner.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'PS-340 access',$3)", [accessIds.project, ids.orgA, ids.personA]);
    await owner.query(`INSERT INTO studio.definition_revisions
      (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
      VALUES ($1,$2,$3,$4::jsonb,repeat('c',64),'1.3.1',$5)`, [accessIds.revision, ids.orgA, accessIds.project, JSON.stringify(snapshot), ids.personA]);
    await owner.query(`INSERT INTO registry.releases
      (id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
      VALUES ($1,$2,$3,$4,1,'PS-340 release','1.0.0','0.1.0',repeat('d',64),'fixture://ps-340',$5)`,
      [accessIds.release, ids.orgA, accessIds.project, accessIds.revision, ids.personA]);
    await owner.query("INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by) VALUES ($1,$2,$3,$4,'created',$5)",
      [accessIds.session, ids.orgA, accessIds.project, accessIds.release, ids.personA]);
    await owner.query("INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status) VALUES ($1,$2,$3,1,'active')",
      [accessIds.session, ids.orgA, ids.deploymentA]);
    await owner.query(`INSERT INTO runtime.release_activations
      (id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
      VALUES (gen_random_uuid(),$1,$2,$3,$4,1,'{}',$5)`, [ids.orgA, accessIds.project, accessIds.session, accessIds.release, ids.personA]);
    await owner.query("INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2)", [accessIds.session, ids.orgA]);
    await owner.query("INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3),($4,$2,$5)",
      [accessIds.deviceD, ids.orgA, ids.personD, accessIds.deviceE, ids.personE]);
    await owner.query("COMMIT");
  } catch (error) { await owner.query("ROLLBACK"); throw error; }

  const operator = await resolvePrincipalCommandContext(app, principal, accessIds.session, ids.deviceA, randomUUID());
  const claimantD = await resolvePrincipalCommandContext(app, principalD, accessIds.session, accessIds.deviceD, randomUUID());
  const claimantE = await resolvePrincipalCommandContext(app, principalE, accessIds.session, accessIds.deviceE, randomUUID());
  const command = (context, operationType, aggregateId, payload = {}, expectedAggregateVersion = 0) => ({
    commandId: randomUUID(), deviceId: context.deviceId, operationType, aggregateId, expectedAggregateVersion,
    governingReleaseId: accessIds.release, payload
  });

  const configured = await configureSessionAccess(app, operator,
    command(operator, "session.configure", accessIds.session, { sessionCode: "verified-code" }), randomUUID(), ids.deploymentA);
  assert.equal(configured.status, "accepted");

  const invitationId = randomUUID();
  const issued = await issueInvitation(app, operator,
    command(operator, "invitation.issue", invitationId, { recipientPersonId: ids.personD, seatId: "blue-lead", expiresInHours: 1 }), randomUUID(), ids.deploymentA);
  assert.equal(issued.receipt.status, "accepted");
  assert.ok(issued.invitationToken);
  assert.equal(await resolveInvitationSession(app, principalD, issued.invitationToken, randomUUID()), accessIds.session);
  const storedInvitation = await owner.query("SELECT token_sha256 FROM identity.session_invitations WHERE id=$1", [invitationId]);
  assert.equal(storedInvitation.rows[0].token_sha256, createHash("sha256").update(issued.invitationToken).digest("hex"));
  assert.notEqual(storedInvitation.rows[0].token_sha256, issued.invitationToken);
  const joinCommand = command(claimantD, "join_request.submit", randomUUID(), { invitationToken: issued.invitationToken });
  const joined = await submitJoinRequest(app, claimantD, joinCommand, randomUUID(), ids.deploymentA);
  assert.equal(joined.status, "accepted");
  assert.equal((await submitJoinRequest(app, claimantD, joinCommand, randomUUID(), ids.deploymentA)).replayed, true);
  assert.equal((await claimSeat(app, claimantD,
    command(claimantD, "seat.claim", randomUUID(), { seatId: "blue-lead", sessionRoleId: "lead" }), randomUUID(), ids.deploymentA)).errorCode, "PERMISSION_DENIED");
  assert.equal((await decideJoinRequest(app, operator,
    command(operator, "participant.admit", ids.personD), randomUUID(), ids.deploymentA, "admit")).status, "accepted");
  const codeOnly = await submitJoinRequest(app, claimantE,
    command(claimantE, "join_request.submit", randomUUID(), {}), randomUUID(), ids.deploymentA);
  assert.deepEqual([codeOnly.status, codeOnly.errorCode], ["rejected", "PERMISSION_DENIED"]);
  const issuedE = await issueInvitation(app, operator,
    command(operator, "invitation.issue", randomUUID(), { recipientPersonId: ids.personE, expiresInHours: 1 }), randomUUID(), ids.deploymentA);
  assert.ok(issuedE.invitationToken);
  assert.equal((await submitJoinRequest(app, claimantE,
    command(claimantE, "join_request.submit", randomUUID(), { invitationToken: issuedE.invitationToken }), randomUUID(), ids.deploymentA)).status, "accepted");
  assert.equal((await decideJoinRequest(app, operator,
    command(operator, "participant.admit", ids.personE), randomUUID(), ids.deploymentA, "admit")).status, "accepted");
  assert.equal((await issueInvitation(app, claimantD,
    command(claimantD, "invitation.issue", randomUUID(), { expiresInHours: 1 }), randomUUID(), ids.deploymentA)).receipt.errorCode, "PERMISSION_DENIED");
  const expiredInvitationId = randomUUID();
  const expiredInvitation = await issueInvitation(app, operator,
    command(operator, "invitation.issue", expiredInvitationId, { recipientPersonId: ids.personD, expiresInHours: 1 }), randomUUID(), ids.deploymentA);
  await owner.query("UPDATE identity.session_invitations SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [expiredInvitationId]);
  assert.equal((await submitJoinRequest(app, claimantD,
    command(claimantD, "join_request.submit", randomUUID(), { invitationToken: expiredInvitation.invitationToken }), randomUUID(), ids.deploymentA)).errorCode,
  "PERMISSION_DENIED");

  const importId = randomUUID();
  const roster = await importRoster(app, operator, command(operator, "roster.import", importId, { rows: [
    { personId: ids.personD, teamId: "blue", sessionRoleId: "lead", seatId: "blue-lead" },
    { teamId: "blue", sessionRoleId: "lead", seatId: "blue-lead" }
  ] }), randomUUID(), ids.deploymentA);
  assert.equal(roster.reviewCount, 1);
  const reviewQueue = await owner.query("SELECT status,review_reasons FROM runtime.roster_import_rows WHERE import_id=$1 ORDER BY row_number", [importId]);
  assert.deepEqual(reviewQueue.rows.map(({ status }) => status), ["ready", "review"]);
  assert.ok(reviewQueue.rows[1].review_reasons.includes("person_unresolved"));

  const claims = await Promise.all([
    claimSeat(app, claimantD, command(claimantD, "seat.claim", randomUUID(), { seatId: "blue-lead", sessionRoleId: "lead" }), randomUUID(), ids.deploymentA),
    claimSeat(app, claimantE, command(claimantE, "seat.claim", randomUUID(), { seatId: "blue-lead", sessionRoleId: "lead" }), randomUUID(), ids.deploymentA)
  ]);
  assert.equal(claims.filter(({ status }) => status === "accepted").length, 1);
  assert.equal(claims.filter(({ status }) => status === "rejected").length, 1);
  const losingClaimant = claims[0].status === "accepted" ? claimantE : claimantD;

  const active = await owner.query("SELECT id,participant_id FROM runtime.seat_assignments WHERE session_id=$1 AND seat_id='blue-lead' AND valid_to IS NULL", [accessIds.session]);
  const revision = await owner.query("SELECT access_revision FROM runtime.participant_access_revisions WHERE participant_id=$1", [active.rows[0].participant_id]);
  const needsWarning = await reassignSeat(app, operator, command(operator, "participant.reassign", active.rows[0].participant_id, {
    previousSeatAssignmentId: active.rows[0].id, newSeatId: "red-lead", newSessionRoleId: "lead", reason: "Cross-Team staffing"
  }, Number(revision.rows[0].access_revision)), randomUUID(), ids.deploymentA);
  assert.deepEqual([needsWarning.status, needsWarning.errorCode], ["rejected", "VALIDATION_FAILED"]);
  const reassigned = await reassignSeat(app, operator, command(operator, "participant.reassign", active.rows[0].participant_id, {
    previousSeatAssignmentId: active.rows[0].id, newSeatId: "red-lead", newSessionRoleId: "lead", reason: "Cross-Team staffing", exposureAcknowledged: true
  }, Number(revision.rows[0].access_revision)), randomUUID(), ids.deploymentA);
  assert.equal(reassigned.status, "accepted");
  assert.equal((await claimSeat(app, losingClaimant, command(losingClaimant, "seat.claim", randomUUID(), { seatId: "blue-lead", sessionRoleId: "lead" }), randomUUID(), ids.deploymentA)).status, "accepted");

  const premature = await markSessionReady(app, operator, command(operator, "session.ready", accessIds.session), randomUUID(), ids.deploymentA);
  assert.deepEqual([premature.status, premature.errorCode], ["rejected", "VALIDATION_FAILED"]);
  for (const checkKey of ["permissions", "recovery"]) {
    assert.equal((await confirmReadiness(app, operator,
      command(operator, "readiness.confirm", accessIds.session, { checkKey }), randomUUID(), ids.deploymentA)).status, "accepted");
  }
  assert.equal((await getReadiness(app, principal, accessIds.session, randomUUID())).ready, true);
  assert.equal((await markSessionReady(app, operator, command(operator, "session.ready", accessIds.session), randomUUID(), ids.deploymentA)).status, "accepted");
  assert.equal((await openSession(app, operator, command(operator, "session.open", accessIds.session), randomUUID(), ids.deploymentA)).status, "accepted");

  const guestId = randomUUID();
  assert.equal((await createGuestIdentity(app, operator, command(operator, "guest_identity.create", guestId,
    { displayName: "Synthetic guest", seatId: "blue-lead", expiresInHours: 1 }), randomUUID(), ids.deploymentA)).status, "accepted");
  assert.equal((await requireActiveGuest(app, ids.orgA, guestId, randomUUID())).seatId, "blue-lead");
  assert.equal((await revokeSessionPrincipal(app, operator, command(operator, "principal.revoke", guestId,
    { principalType: "guest" }), randomUUID(), ids.deploymentA)).status, "accepted");
  await assert.rejects(requireActiveGuest(app, ids.orgA, guestId, randomUUID()), (error) => error?.envelope?.error?.code === "ACCESS_REVOKED");
  const expiredGuestId = randomUUID();
  assert.equal((await createGuestIdentity(app, operator, command(operator, "guest_identity.create", expiredGuestId,
    { displayName: "Expiring synthetic guest", seatId: "blue-lead", expiresInHours: 1 }), randomUUID(), ids.deploymentA)).status, "accepted");
  await owner.query("UPDATE identity.guest_identities SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [expiredGuestId]);
  await assert.rejects(requireActiveGuest(app, ids.orgA, expiredGuestId, randomUUID()), (error) => error?.envelope?.error?.code === "ACCESS_REVOKED");

  const display = await activateDisplayPrincipal(app, operator, command(operator, "display_principal.activate", randomUUID(),
    { interfaceProfileId: "observer", classificationCeiling: "internal" }), randomUUID(), ids.deploymentA);
  assert.equal(display.receipt.status, "accepted");
  assert.ok(display.credential);
  assert.ok(await publishPendingRuntimeDeltas(app, ids.orgA) > 0);

  const staffed = await getReadiness(app, principal, accessIds.session, randomUUID());
  const filtered = await getReadiness(app, principal, accessIds.session, randomUUID(), "red-lead");
  assert.equal(filtered.staffing.assignments.length, 1);
  assert.equal(filtered.staffing.assignments[0].seatId, "red-lead");
  const failedDelivery = await owner.query(
    `WITH target AS (
       SELECT id,publication_status,attempts,published_at FROM sync.session_delta_outbox
        WHERE organization_id=$1 AND session_id=$2 ORDER BY created_at,id LIMIT 1
     )
     UPDATE sync.session_delta_outbox item SET publication_status='dead_lettered',attempts=3,published_at=NULL
      FROM target WHERE item.id=target.id
      RETURNING item.id,target.publication_status,target.attempts,target.published_at`,
    [ids.orgA, accessIds.session]
  );
  assert.equal(failedDelivery.rowCount, 1);
  const failedId = failedDelivery.rows[0].id;
  const staleRetry = await retryOperatorDelivery(app, operator,
    command(operator, "delivery.retry", failedId, { reason: "Stale delivery recovery", confirmed: true }, 2),
    randomUUID(), ids.deploymentA);
  assert.deepEqual([staleRetry.status, staleRetry.errorCode], ["needs_reconciliation", "STALE_AGGREGATE_VERSION"]);
  const deniedRetry = await retryOperatorDelivery(app, { ...operator, organizationRoles: [] },
    command(operator, "delivery.retry", failedId, { reason: "Unauthorized recovery", confirmed: true }, 3),
    randomUUID(), ids.deploymentA);
  assert.deepEqual([deniedRetry.status, deniedRetry.errorCode], ["rejected", "PERMISSION_DENIED"]);
  const retryCommand = command(operator, "delivery.retry", failedId,
    { reason: "Retry failed Runtime delivery", confirmed: true }, 3);
  const recovered = await retryOperatorDelivery(app, operator, retryCommand, randomUUID(), ids.deploymentA);
  assert.deepEqual([recovered.status, recovered.aggregateVersion, recovered.replayed], ["accepted", 4, false]);
  const replayed = await retryOperatorDelivery(app, operator, retryCommand, randomUUID(), ids.deploymentA);
  assert.deepEqual([replayed.status, replayed.aggregateVersion, replayed.replayed], ["accepted", 4, true]);
  const recovery = await owner.query(
    `SELECT item.publication_status,
            (SELECT count(*) FROM evidence.events WHERE session_id=$1 AND event_type='delivery.retried' AND aggregate_id=$2) events,
            (SELECT count(*) FROM sync.command_receipts WHERE session_id=$1 AND command_id=$3) receipts
       FROM sync.session_delta_outbox item WHERE item.organization_id=$4 AND item.id=$2`,
    [accessIds.session, failedId, retryCommand.commandId, ids.orgA]
  );
  assert.deepEqual(recovery.rows[0], { publication_status: "pending", events: "1", receipts: "1" });
  const participantIds = staffed.staffing.assignments.map(({ participantId }) => participantId);
  assert.equal(participantIds.length, 2);
  const removed = await removeParticipants(app, operator,
    command(operator, "participant.remove_bulk", accessIds.session,
      { participantIds, reason: "Parity bulk removal" }), randomUUID(), ids.deploymentA);
  assert.equal(removed.status, "accepted");
  assert.equal((await claimSeat(app, claimantD,
    command(claimantD, "seat.claim", randomUUID(), { seatId: "blue-lead", sessionRoleId: "lead" }),
    randomUUID(), ids.deploymentA)).errorCode, "PERMISSION_DENIED");

  assert.equal((await archiveSession(app, operator,
    command(operator, "session.archive", accessIds.session, { reason: "Parity archive" }),
    randomUUID(), ids.deploymentA)).status, "accepted");
  assert.equal((await deleteSession(app, operator,
    command(operator, "session.delete", accessIds.session, { reason: "Parity logical deletion" }),
    randomUUID(), ids.deploymentA)).status, "accepted");
  await assert.rejects(
    issueInvitation(app, operator,
      command(operator, "invitation.issue", randomUUID(), { expiresInHours: 1 }), randomUUID(), ids.deploymentA),
    (error) => error?.envelope?.error?.code === "AUTHORITY_UNAVAILABLE"
  );
  const retained = await owner.query(
    `SELECT session.status,authority.status AS authority_status,
            (SELECT count(*) FROM runtime.participants WHERE organization_id=$1 AND session_id=$2) participants,
            (SELECT count(*) FROM runtime.seat_assignments WHERE organization_id=$1 AND session_id=$2) assignments,
            (SELECT count(*) FROM evidence.audit_records WHERE organization_id=$1 AND target_ref='session:'||$2::text
              AND action IN ('participant.bulk_removed','session.archived','session.deleted')) audits
       FROM runtime.sessions session
       JOIN runtime.session_authorities authority ON authority.organization_id=session.organization_id AND authority.session_id=session.id
      WHERE session.organization_id=$1 AND session.id=$2`,
    [ids.orgA, accessIds.session]
  );
  assert.deepEqual(retained.rows[0], {
    status: "archived", authority_status: "fenced", participants: "2", assignments: "3", audits: "3"
  });
  assert.ok(await publishPendingRuntimeDeltas(app, ids.orgA) >= 4);
});

test("Game Master projection requires Operator authorization and remains tenant/Session scoped", async () => {
  const failed = await owner.query(
    `WITH target AS (
       SELECT id,publication_status,attempts,published_at FROM sync.session_delta_outbox
        WHERE organization_id=$1 AND session_id=$2 ORDER BY created_at,id LIMIT 1
     )
     UPDATE sync.session_delta_outbox item SET publication_status='dead_lettered',attempts=3,published_at=NULL
      FROM target WHERE item.id=target.id
      RETURNING item.id,target.publication_status,target.attempts,target.published_at`,
    [ids.orgA, accessIds.session]
  );
  assert.equal(failed.rowCount, 1);
  const projection = await getOperatorProjection(
    app, principal, accessIds.session, "e0000000-0000-4000-8000-000000000010"
  );
  assert.equal(projection.sessionId, accessIds.session);
  assert.equal(projection.releaseId, accessIds.release);
  assert.equal(projection.deliveryHealth.deadLettered, 1);
  assert.equal(projection.deliveryHealth.deadLetters[0].attempts, 3);

  await assert.rejects(
    getOperatorProjection(
      app, { ...principal, organizationId: ids.orgB, principalId: ids.personB }, ids.sessionA,
      "e0000000-0000-4000-8000-000000000011"
    ),
    (error) => error?.envelope?.error?.code === "ACCESS_REVOKED"
  );
  await assert.rejects(
    getOperatorProjection(
      app, { ...principal, organizationRoles: [] }, ids.sessionA,
      "e0000000-0000-4000-8000-000000000012"
    ),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED"
  );
  await owner.query(
    "UPDATE sync.session_delta_outbox SET publication_status=$1,attempts=$2,published_at=$3 WHERE organization_id=$4 AND id=$5",
    [failed.rows[0].publication_status, failed.rows[0].attempts, failed.rows[0].published_at, ids.orgA, failed.rows[0].id]
  );
});

test("AC-11/SYNC-08/SYNC-14 bootstrap derives offline authority and policy from trusted server state", async () => {
  const input = {
    pool: app,
    principal,
    sessionId: ids.sessionA,
    deviceId: ids.deviceA,
    activeSessionRoleId: "role-a",
    correlationId: randomUUID()
  };
  const bootstrap = await getRuntimeBootstrap(input);
  assert.deepEqual(bootstrap.offlineCommandTypes,
    ["artifact.create", "artifact.edit", "artifact.submit", "ballot.cast"]);
  assert.deepEqual({
    participantId: bootstrap.participantId,
    activeSessionRoleId: bootstrap.activeSessionRoleId,
    authorityEpoch: bootstrap.authorityEpoch,
    governingReleaseId: bootstrap.governingReleaseId,
    credentialExpiresAt: bootstrap.credentialExpiresAt
  }, {
    participantId: ids.participantA,
    activeSessionRoleId: "role-a",
    authorityEpoch: 1,
    governingReleaseId: ids.releaseA,
    credentialExpiresAt: principal.expiresAt.toISOString()
  });
  const metadata = await owner.query(
    "SELECT offline_policy_version,offline_enabled_at IS NOT NULL AS enabled,last_offline_bootstrap_at IS NOT NULL AS bootstrapped FROM sync.devices WHERE id=$1",
    [ids.deviceA]
  );
  assert.deepEqual(metadata.rows[0], { offline_policy_version: "offline-outbox-v1", enabled: true, bootstrapped: true });

  const controlAssignment = randomUUID();
  await owner.query(
    `INSERT INTO runtime.seat_assignments
      (id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
     VALUES ($1,$2,$3,$4,'role-control','seat-control',$5)`,
    [controlAssignment, ids.orgA, ids.sessionA, ids.participantA, ids.personA]
  );
  const control = await getRuntimeBootstrap({
    ...input, activeSessionRoleId: "role-control", correlationId: randomUUID()
  });
  assert.equal(control.isControlRole, true);
  assert.deepEqual(control.offlineCommandTypes, []);
  await owner.query("UPDATE runtime.seat_assignments SET valid_to=transaction_timestamp() WHERE id=$1", [controlAssignment]);
});

test("PS-545-T01 AC-10/AC-13 SYNC-05/06/07/12 DB-02/04 command outcomes stay atomic", async () => {
  const context = await withOrganizationTransaction(app, ids.orgA, (client) =>
    resolveSessionAccessContext(client, principal, {
      sessionId: ids.sessionA,
      deviceId: ids.deviceA,
      correlationId: "e0000000-0000-4000-8000-000000000002"
    }));
  assert.equal(context.organizationId, ids.orgA);
  assert.equal(context.activeSessionRoleId, "role-a");
  oldRoleCursor = (await getRuntimeSnapshot({
    pool: app,
    principal,
    sessionId: ids.sessionA,
    deviceId: ids.deviceA,
    activeSessionRoleId: "role-a",
    correlationId: "e0000000-0000-4000-8000-000000000008"
  })).cursor;

  const command = {
    commandId: "f0000000-0000-4000-8000-000000000001",
    deviceId: ids.deviceA,
    operationType: "participant.reassign",
    aggregateId: ids.participantA,
    expectedAggregateVersion: 1,
    governingReleaseId: ids.releaseA,
    activeSessionRoleId: "role-a",
    payload: {
      previousSeatAssignmentId: ids.assignmentA,
      newSessionRoleId: "role-c",
      newSeatId: "seat-c",
      reason: "Operational reassignment"
    }
  };
  const receipts = await Promise.all(Array.from({ length: 6 }, () =>
    reassignParticipant(app, context, command, "e0000000-0000-4000-8000-000000000003", ids.deploymentA)));
  assert.equal(receipts.filter((receipt) => !receipt.replayed).length, 1);
  assert.equal(receipts.filter((receipt) => receipt.replayed).length, 5);
  assert.equal(new Set(receipts.map((receipt) => receipt.evidenceSequence)).size, 1);
  assert.equal(receipts[0].aggregateVersion, 2);

  const state = await owner.query(
    `SELECT
       (SELECT count(*) FROM runtime.seat_assignments WHERE participant_id=$1 AND valid_to IS NULL) active,
       (SELECT count(*) FROM runtime.seat_assignments WHERE id=$2 AND valid_to IS NOT NULL) closed,
       (SELECT access_revision FROM runtime.participant_access_revisions WHERE participant_id=$1) revision,
       (SELECT count(*) FROM sync.projection_grants WHERE participant_id=$1 AND revoked_at IS NOT NULL) revoked,
       (SELECT count(*) FROM evidence.events WHERE session_id=$3 AND event_type='seat_assignment.changed') events,
       (SELECT count(*) FROM evidence.audit_records WHERE action='participant.reassigned' AND target_ref='participant:' || $1::text) audits,
       (SELECT count(*) FROM sync.session_delta_outbox WHERE session_id=$3) outbox`,
    [ids.participantA, ids.assignmentA, ids.sessionA]
  );
  assert.deepEqual(state.rows[0], {
    active: "1", closed: "1", revision: "2", revoked: "1", events: "1", audits: "1", outbox: "1"
  });

  await assert.rejects(
    reassignParticipant(app, context, { ...command, payload: { ...command.payload, reason: "Different payload" } },
      "e0000000-0000-4000-8000-000000000003", ids.deploymentA),
    (error) => error?.envelope?.error?.code === "IDEMPOTENCY_COLLISION"
  );

  const currentAssignment = await owner.query(
    "SELECT id FROM runtime.seat_assignments WHERE participant_id=$1 AND valid_to IS NULL",
    [ids.participantA]
  );
  const currentAssignmentId = currentAssignment.rows[0].id;
  const staleCommand = {
    ...command,
    commandId: "f0000000-0000-4000-8000-000000000002",
    expectedAggregateVersion: 1,
    activeSessionRoleId: "role-c",
    payload: { previousSeatAssignmentId: currentAssignmentId, newSessionRoleId: "role-d", newSeatId: "seat-d", reason: "Stale version" }
  };
  const stale = await reassignParticipant(
    app, { ...context, activeSessionRoleId: "role-c", accessRevision: 2 }, staleCommand,
    "e0000000-0000-4000-8000-000000000004", ids.deploymentA
  );
  assert.deepEqual([stale.status, stale.errorCode], ["needs_reconciliation", "STALE_AGGREGATE_VERSION"]);

  const denied = await reassignParticipant(
    app, { ...context, activeSessionRoleId: "role-c", organizationRoles: [], accessRevision: 2 },
    { ...staleCommand, commandId: "f0000000-0000-4000-8000-000000000006", expectedAggregateVersion: 2 },
    "e0000000-0000-4000-8000-000000000007", ids.deploymentA
  );
  assert.deepEqual([denied.status, denied.errorCode], ["rejected", "PERMISSION_DENIED"]);
  const recordedOutcomes = await owner.query(
    `SELECT receipt.status, event.event_type
       FROM sync.command_receipts receipt
       JOIN evidence.events event
         ON event.session_id=receipt.session_id AND event.sequence=receipt.evidence_sequence
      WHERE receipt.command_id IN ($1,$2)
      ORDER BY receipt.status`,
    [staleCommand.commandId, "f0000000-0000-4000-8000-000000000006"]
  );
  assert.deepEqual(recordedOutcomes.rows, [
    { status: "needs_reconciliation", event_type: "command.reconciliation_required" },
    { status: "rejected", event_type: "command.rejected" }
  ]);

  for (const [commandId, changedContext, deploymentId] of [
    ["f0000000-0000-4000-8000-000000000003", { ...context, activeSessionRoleId: "role-c", authorityEpoch: 99 }, ids.deploymentA],
    ["f0000000-0000-4000-8000-000000000004", { ...context, activeSessionRoleId: "role-c" }, ids.deploymentB]
  ]) {
    await assert.rejects(
      reassignParticipant(app, changedContext, { ...staleCommand, commandId, expectedAggregateVersion: 2 },
        "e0000000-0000-4000-8000-000000000005", deploymentId),
      (error) => error?.envelope?.error?.code === "AUTHORITY_UNAVAILABLE"
    );
  }
  const unrecorded = await owner.query(
    "SELECT count(*) AS count FROM sync.command_receipts WHERE command_id IN ($1,$2)",
    ["f0000000-0000-4000-8000-000000000003", "f0000000-0000-4000-8000-000000000004"]
  );
  assert.equal(unrecorded.rows[0].count, "0");

  await owner.query(
    `CREATE FUNCTION sync.fail_test_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN IF NEW.command_id='f0000000-0000-4000-8000-000000000005' THEN RAISE EXCEPTION 'forced receipt failure'; END IF; RETURN NEW; END $$;
     CREATE TRIGGER fail_test_receipt BEFORE INSERT ON sync.command_receipts
       FOR EACH ROW EXECUTE FUNCTION sync.fail_test_receipt()`
  );
  await assert.rejects(
    reassignParticipant(app, { ...context, activeSessionRoleId: "role-c", accessRevision: 2 }, {
      ...command,
      commandId: "f0000000-0000-4000-8000-000000000005",
      expectedAggregateVersion: 2,
      activeSessionRoleId: "role-c",
      payload: { previousSeatAssignmentId: currentAssignmentId, newSessionRoleId: "role-d", newSeatId: "seat-d", reason: "Force rollback" }
    }, "e0000000-0000-4000-8000-000000000006", ids.deploymentA),
    /forced receipt failure/
  );
  const rolledBack = await owner.query(
    `SELECT
       (SELECT count(*) FROM runtime.seat_assignments WHERE participant_id=$1 AND valid_to IS NULL) active,
       (SELECT access_revision FROM runtime.participant_access_revisions WHERE participant_id=$1) revision,
       (SELECT count(*) FROM evidence.events WHERE session_id=$2 AND event_type='seat_assignment.changed') events,
       (SELECT next_sequence FROM evidence.session_sequences WHERE session_id=$2) next_sequence`,
    [ids.participantA, ids.sessionA]
  );
  assert.deepEqual(rolledBack.rows[0], { active: "1", revision: "2", events: "1", next_sequence: "4" });
  await owner.query("DROP TRIGGER fail_test_receipt ON sync.command_receipts; DROP FUNCTION sync.fail_test_receipt() ");
});

test("SYNC-08/10/11 Runtime reconnect is scoped, replayable and gap-free", async () => {
  const request = {
    pool: app,
    principal,
    sessionId: ids.sessionA,
    deviceId: ids.deviceA,
    activeSessionRoleId: "role-c",
    correlationId: "e0000000-0000-4000-8000-000000000009"
  };
  await assert.rejects(
    getRuntimeDeltas({ ...request, cursor: oldRoleCursor }),
    (error) => error?.envelope?.error?.code === "SYNC_CURSOR_EXPIRED"
  );
  await assert.rejects(
    getRuntimeDeltas({ ...request, cursor: "4" }),
    (error) => error?.envelope?.error?.code === "SYNC_CURSOR_EXPIRED"
  );
  await assert.rejects(
    getRuntimeSnapshot({ ...request, deviceId: "invalid" }),
    (error) => error?.envelope?.error?.code === "INVALID_ID"
  );

  const snapshot = await getRuntimeSnapshot(request);
  assert.deepEqual(
    [snapshot.state.activeSessionRoleId, snapshot.state.accessRevision, snapshot.aggregateVersions[ids.participantA]],
    ["role-c", 2, 2]
  );
  const beforePublish = await getRuntimeDeltas({ ...request, cursor: snapshot.cursor });
  assert.deepEqual(beforePublish.deltas, []);
  await assert.rejects(publishPendingRuntimeDeltas(app, ids.orgA, 101), /between 1 and 100/);
  assert.equal(await publishPendingRuntimeDeltas(app, ids.orgA), 3);

  const polled = await getRuntimeDeltas({ ...request, cursor: snapshot.cursor });
  assert.deepEqual(polled.deltas.map((delta) => delta.eventType), [
    "seat_assignment.changed",
    "command.reconciliation_required",
    "command.rejected"
  ]);
  assert.equal(JSON.stringify(polled).includes("evidenceSequence"), false);
  assert.equal(JSON.stringify(polled).includes("Operational reassignment"), false);
  const replayed = await getRuntimeDeltas({ ...request, cursor: snapshot.cursor });
  assert.deepEqual(replayed.deltas.map((delta) => delta.deltaId), polled.deltas.map((delta) => delta.deltaId));
  const sse = await getRuntimeSse({ ...request, cursor: snapshot.cursor });
  assert.equal(sse.contentType, "text/event-stream");
  assert.equal((sse.body.match(/^event: delta$/gmu) ?? []).length, 3);
  assert.match(sse.body, /^event: cursor$/mu);

  const viewerRequest = {
    pool: app,
    principal: principalC,
    sessionId: ids.sessionA,
    deviceId: ids.deviceC,
    activeSessionRoleId: "role-c-viewer",
    correlationId: "e0000000-0000-4000-8000-000000000010"
  };
  const viewerSnapshot = await getRuntimeSnapshot(viewerRequest);
  await owner.query("BEGIN");
  try {
    await owner.query(
      `INSERT INTO evidence.events
         (id,organization_id,session_id,sequence,event_type,event_version,actor_person_id,
          actor_participant_id,governing_release_id,authority_epoch,body,aggregate_id,aggregate_version)
       VALUES ('e2000000-0000-4000-8000-000000000004',$1,$2,4,'seat_assignment.changed',1,$3,$4,$5,1,$6::jsonb,$4,3)`,
      [ids.orgA, ids.sessionA, ids.personA, ids.participantA, ids.releaseA,
        JSON.stringify({ participantId: ids.participantA, newSessionRoleId: "role-hidden", accessRevision: 3 })]
    );
    await owner.query(
      "INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id) VALUES ('e3000000-0000-4000-8000-000000000004',$1,$2,'e2000000-0000-4000-8000-000000000004')",
      [ids.orgA, ids.sessionA]
    );
    await owner.query("UPDATE evidence.session_sequences SET next_sequence=5 WHERE session_id=$1", [ids.sessionA]);
    await owner.query("COMMIT");
  } catch (error) {
    await owner.query("ROLLBACK");
    throw error;
  }
  assert.equal(await publishPendingRuntimeDeltas(app, ids.orgA), 1);
  const omitted = await getRuntimeDeltas({ ...viewerRequest, cursor: viewerSnapshot.cursor });
  assert.deepEqual(omitted.deltas, []);
  assert.equal(JSON.stringify(omitted).includes("role-hidden"), false);
  assert.match(omitted.nextCursor, /^[0-9a-f-]{36}$/u);

  await owner.query("BEGIN");
  try {
    await owner.query(
      `WITH inserted AS (
         INSERT INTO evidence.events
           (id,organization_id,session_id,sequence,event_type,event_version,actor_person_id,
            actor_participant_id,governing_release_id,authority_epoch,body,aggregate_id,aggregate_version)
         SELECT gen_random_uuid(),$1::uuid,$2::uuid,value,'seat_assignment.changed',1,$3::uuid,$4::uuid,$5::uuid,1,
                jsonb_build_object('participantId',$4::uuid::text,'newSessionRoleId','role-c-viewer','accessRevision',value),
                $4::uuid,value
           FROM generate_series(5,105) value
         RETURNING organization_id,session_id,id
       )
       INSERT INTO sync.session_delta_outbox(id,organization_id,session_id,event_id)
       SELECT gen_random_uuid(),organization_id,session_id,id FROM inserted`,
      [ids.orgA, ids.sessionA, ids.personC, ids.participantC, ids.releaseA]
    );
    await owner.query("UPDATE evidence.session_sequences SET next_sequence=106 WHERE session_id=$1", [ids.sessionA]);
    await owner.query("COMMIT");
  } catch (error) {
    await owner.query("ROLLBACK");
    throw error;
  }
  assert.equal(await publishPendingRuntimeDeltas(app, ids.orgA), 100);
  assert.equal(await publishPendingRuntimeDeltas(app, ids.orgA), 1);
  const bounded = await getRuntimeDeltas({ ...viewerRequest, cursor: omitted.nextCursor });
  assert.equal(bounded.deltas.length, 100);
  const remainder = await getRuntimeDeltas({ ...viewerRequest, cursor: bounded.nextCursor });
  assert.equal(remainder.deltas.length, 1);
});

test("revocation invalidates Authentication Sessions and active projections", async () => {
  await owner.query(
    `INSERT INTO sync.projection_grants
       (id,organization_id,session_id,participant_id,policy_revision,access_revision,expires_at)
     VALUES ('d0000000-0000-4000-8000-000000000002',$1,$2,$3,'policy-decision-v1',2,now()+interval '1 hour')`,
    [ids.orgA, ids.sessionA, ids.participantA]
  );
  await revokeAuthenticationSession(app, principal, "e0000000-0000-4000-8000-000000000005");
  const result = await owner.query(
    `SELECT
       (SELECT count(*) FROM identity.authentication_sessions WHERE id=$1 AND revoked_at IS NOT NULL) sessions,
       (SELECT count(*) FROM sync.projection_grants WHERE participant_id=$2 AND revoked_at IS NULL) grants`,
    [principal.authenticationSessionId, ids.participantA]
  );
  assert.deepEqual(result.rows[0], { sessions: "1", grants: "0" });
  await assert.rejects(
    getRuntimeSnapshot({
      pool: app,
      principal,
      sessionId: ids.sessionA,
      deviceId: ids.deviceA,
      activeSessionRoleId: "role-c",
      correlationId: "e0000000-0000-4000-8000-000000000011"
    }),
    (error) => error?.envelope?.error?.code === "AUTH_EXPIRED"
  );
  await assert.rejects(
    getRuntimeBootstrap({
      pool: app,
      principal,
      sessionId: ids.sessionA,
      deviceId: ids.deviceA,
      activeSessionRoleId: "role-c",
      correlationId: randomUUID()
    }),
    (error) => error?.envelope?.error?.code === "AUTH_EXPIRED"
  );
});

test("AC-02/AC-06 PS-130-T01 publication is immutable, deterministic and concurrency safe", async () => {
  const publisher = {
    authenticationSessionId: "f1000000-0000-4000-8000-000000000001",
    principalId: ids.personB,
    organizationId: ids.orgB,
    organizationRoles: ["publisher"],
    authenticationStrength: "mfa",
    expiresAt: new Date("2026-10-19T00:00:00.000Z")
  };
  const input = {
    projectId: ids.projectB,
    releaseLabel: "Release 2",
    semanticVersion: "2.0.0",
    methodologyVersion: "1.3.1",
    releaseNotes: "Immutable publication fixture",
    controls: {
      validationReportId: "f2000000-0000-4000-8000-000000000001",
      validationPassed: true,
      warningsAcknowledged: true,
      classificationReviewId: "classification-review-1",
      accessibilityReviewStatus: "passed",
      retentionPolicyId: "retention-policy-1",
      approvedBy: [ids.personB],
      approvalNotes: "Approved"
    },
    policy: { requireDistinctApprover: false, requireTestSession: false },
    correlationId: "f3000000-0000-4000-8000-000000000001"
  };

  await assert.rejects(
    publishRelease(app, objectStore, { ...publisher, organizationRoles: ["operator"] }, input),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED"
  );
  await assert.rejects(
    publishRelease(app, objectStore, publisher, {
      ...input,
      controls: { ...input.controls, approvedBy: ["f4000000-0000-4000-8000-000000000001"] }
    }),
    (error) => error?.envelope?.error?.code === "REFERENCE_INVALID"
  );
  assert.equal((await readdir(objectRoot, { recursive: true })).filter((path) => path.endsWith(".json")).length, 0);

  const attempts = await Promise.allSettled([
    publishRelease(app, objectStore, publisher, input, new Date("2026-10-18T12:00:00.000Z")),
    publishRelease(app, objectStore, publisher, input, new Date("2026-10-18T12:00:00.000Z"))
  ]);
  const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
  const rejected = attempts.filter((attempt) => attempt.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason?.envelope?.error?.code, "ALREADY_PUBLISHED");
  const published = fulfilled[0].value;

  const firstRead = await exportReleasePackage(app, objectStore, publisher, published.releaseId, input.correlationId);
  const secondRead = await exportReleasePackage(app, objectStore, publisher, published.releaseId, input.correlationId);
  assert.deepEqual(firstRead, secondRead);
  await assert.rejects(
    exportReleasePackage(app, objectStore, { ...publisher, principalId: ids.personA }, published.releaseId, input.correlationId),
    (error) => error?.envelope?.error?.code === "ACCESS_REVOKED"
  );
  assert.equal(verifyImportedPackage(firstRead, published.packageDigest).release.manifest.releaseId, published.releaseId);
  assert.equal(new TextDecoder().decode(firstRead).includes("do-not-package"), false);
  assert.equal(new TextDecoder().decode(firstRead).toLowerCase().includes("participants"), false);
  assert.equal((await importReleasePackage(app, objectStore, publisher, firstRead, published.packageDigest, input.correlationId)).imported, false);

  const counts = await owner.query(
    `SELECT
       (SELECT count(*) FROM registry.releases WHERE organization_id=$1 AND project_id=$2) releases,
       (SELECT count(*) FROM registry.package_manifests WHERE organization_id=$1) manifests,
       (SELECT count(*) FROM registry.release_approvals WHERE organization_id=$1) approvals`,
    [ids.orgB, ids.projectB]
  );
  assert.deepEqual(counts.rows[0], { releases: "2", manifests: "1", approvals: "1" });
  await assert.rejects(owner.query("UPDATE registry.releases SET release_label='changed' WHERE id=$1", [published.releaseId]), /append-only/);
  await assert.rejects(owner.query("UPDATE registry.package_manifests SET manifest='{}' WHERE release_id=$1", [published.releaseId]), /append-only/);
});

test("PS-130-T02 rejects a tampered portable Package before import", async () => {
  const manifest = await owner.query(
    "SELECT release_id,package_sha256 FROM registry.package_manifests WHERE organization_id=$1",
    [ids.orgB]
  );
  const publisher = {
    authenticationSessionId: "f1000000-0000-4000-8000-000000000001",
    principalId: ids.personB,
    organizationId: ids.orgB,
    organizationRoles: ["publisher"],
    authenticationStrength: "mfa",
    expiresAt: new Date("2026-10-19T00:00:00.000Z")
  };
  const bytes = await exportReleasePackage(app, objectStore, publisher, manifest.rows[0].release_id, "f3000000-0000-4000-8000-000000000002");
  const tampered = Uint8Array.from(bytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    importReleasePackage(app, objectStore, publisher, tampered, manifest.rows[0].package_sha256, "f3000000-0000-4000-8000-000000000002"),
    (error) => error?.envelope?.error?.code === "VALIDATION_FAILED"
  );
});

test("EXT-01/02/16 separates Plugin submit, approval, install, bind, run authorization, and revocation", async () => {
  const publisherKeys = generateKeyPairSync("ed25519");
  const revocationKeys = generateKeyPairSync("ed25519");
  const publicKeyPem = publisherKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  const revocationPublicKeyPem = revocationKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  const publisherId = "22000000-0000-4000-8000-000000000001";
  const trustRootId = "22000000-0000-4000-8000-000000000002";
  const revocationListId = "22000000-0000-4000-8000-000000000003";
  const licenseAcceptanceId = "22000000-0000-4000-8000-000000000004";
  const installationId = "22000000-0000-4000-8000-000000000005";
  const bindingId = "22000000-0000-4000-8000-000000000006";
  const deploymentId = "22000000-0000-4000-8000-000000000007";
  const missingBindingId = "22000000-0000-4000-8000-000000000008";
  const correlationId = "22000000-0000-4000-8000-000000000009";
  const offlineInstallationId = "22000000-0000-4000-8000-00000000000a";
  const offlineDeploymentId = "22000000-0000-4000-8000-00000000000d";
  const now = new Date("2026-10-19T12:00:00.000Z");
  const admin = {
    authenticationSessionId: "22000000-0000-4000-8000-00000000000b",
    principalId: ids.personC,
    organizationId: ids.orgB,
    organizationRoles: ["admin", "designer"],
    authenticationStrength: "mfa",
    expiresAt: new Date("2099-01-01T00:00:00.000Z")
  };
  const publisher = {
    authenticationSessionId: "22000000-0000-4000-8000-00000000000c",
    principalId: ids.personB,
    organizationId: ids.orgB,
    organizationRoles: ["publisher"],
    authenticationStrength: "mfa",
    expiresAt: new Date("2099-01-01T00:00:00.000Z")
  };
  const operator = { ...publisher, organizationRoles: ["operator"] };
  const secondAdmin = { ...admin, principalId: ids.personD, organizationRoles: ["admin"] };
  const pluginBytes = new TextEncoder().encode("synthetic fixture only");
  const offlinePluginBytes = new TextEncoder().encode("synthetic offline fixture only");
  const inputSchema = new TextEncoder().encode(JSON.stringify({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["seed"],
    properties: { seed: { type: "integer" } }
  }));
  const outputSchema = new TextEncoder().encode(JSON.stringify({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["syntheticScore"],
    properties: { syntheticScore: { type: "number" } }
  }));
  const manifest = {
    contractId: "plugin-manifest-v1",
    manifestVersion: "1.0.0",
    pluginId: "org.ssg.fixtures.registry-score",
    version: "1.0.0",
    digest: pluginDigest(pluginBytes),
    artifactPath: "plugin/payload.bin",
    publisher: { id: publisherId, signatureKeyId: "publisher-key-1" },
    categories: ["world_and_simulation"],
    capabilities: ["compute"],
    execution: { mode: "container", entrypoint: "plugin/payload.bin", rootless: true, readOnlyRoot: true },
    connectivity: "offline_capable",
    contracts: { inputSchema: "schemas/input.json", outputSchema: "schemas/output.json" },
    compatibility: { hostApi: ">=1.0.0 <2.0.0", releaseSchema: ">=1.3.0 <2.0.0" },
    limits: { timeoutSeconds: 5, memoryMiB: 64, cpuMillis: 1000, outputBytes: 4096 },
    requestedPermissions: ["state_values.read:mapped"],
    dataClassificationMaximum: "internal",
    reproducibility: { deterministic: true, seedInput: "seed" },
    dependencies: [],
    provenance: { sourceRevision: "synthetic-only", buildSystem: "none" },
    license: "synthetic-license-v1"
  };
  const built = createOfflinePluginBundle({
    manifest,
    files: new Map([
      ["plugin/payload.bin", pluginBytes],
      ["schemas/input.json", inputSchema],
      ["schemas/output.json", outputSchema],
      ["sbom/sbom.json", new TextEncoder().encode("{\"bomFormat\":\"CycloneDX\"}")]
    ]),
    supplyChain: {
      sbomPath: "sbom/sbom.json",
      attestationType: "synthetic-test",
      attestedAt: now.toISOString(),
      vulnerabilities: [],
      vulnerabilityExceptions: [],
      license: manifest.license
    },
    privateKey: publisherKeys.privateKey
  });
  const offlineBuilt = createOfflinePluginBundle({
    manifest: { ...manifest, version: "1.0.1", digest: pluginDigest(offlinePluginBytes) },
    files: new Map([
      ["plugin/payload.bin", offlinePluginBytes],
      ["schemas/input.json", inputSchema],
      ["schemas/output.json", outputSchema],
      ["sbom/sbom.json", new TextEncoder().encode("{\"bomFormat\":\"CycloneDX\"}")]
    ]),
    supplyChain: built.bundle.supplyChain,
    privateKey: publisherKeys.privateKey
  });

  await registerPluginPublisher(app, admin, {
    publisherId,
    publisherPrincipalId: ids.personB,
    displayName: "Synthetic fixture publisher",
    signatureKeyId: "publisher-key-1",
    publicKeyPem,
    correlationId
  });
  await provisionPluginTrustRoot(app, admin, {
    trustRootId,
    publisherId,
    publisherKeyId: "publisher-key-1",
    publisherPublicKeyPem: publicKeyPem,
    revocationKeyId: "revocation-key-1",
    revocationPublicKeyPem,
    correlationId
  });
  await importPluginRevocations(app, admin, {
    revocationListId,
    publisherId,
    document: createPluginRevocations({
      generatedAt: now.toISOString(),
      publisherId,
      keyId: "revocation-key-1",
      privateKey: revocationKeys.privateKey
    }),
    correlationId
  }, now);
  await acceptPluginLicense(app, admin, {
    acceptanceId: licenseAcceptanceId,
    pluginId: manifest.pluginId,
    license: manifest.license,
    termsDigest: `sha256:${"1".repeat(64)}`,
    correlationId
  });

  await assert.rejects(
    submitPluginArtifact(app, objectStore, operator, built.bytes, correlationId, now),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED"
  );
  const submitted = await submitPluginArtifact(app, objectStore, publisher, built.bytes, correlationId, now);
  assert.equal(submitted.lifecycleStatus, "contract_validated");
  const approved = await approvePluginArtifact(app, admin, submitted.artifactId, correlationId, now);
  assert.equal(approved.lifecycleStatus, "approved");
  await assert.rejects(
    authorizePluginRun(app, operator, missingBindingId, correlationId),
    (error) => error?.envelope?.error?.code === "NOT_FOUND"
  );

  const offline = await importOfflinePluginBundle(app, objectStore, admin, offlineBuilt.bytes, {
    artifactId: "22000000-0000-4000-8000-00000000000e",
    compatibility: { hostApiVersion: "1.0.0", releaseSchemaVersion: "1.3.1", deploymentProfile: "air_gapped" },
    correlationId
  }, now);
  assert.equal(offline.lifecycleStatus, "contract_validated");
  await approvePluginArtifact(app, secondAdmin, offline.artifactId, correlationId, now);
  const offlineInstalled = await installPluginArtifact(app, objectStore, secondAdmin, {
    installationId: offlineInstallationId,
    deploymentId: offlineDeploymentId,
    artifactId: offline.artifactId,
    permittedPermissions: ["state_values.read:mapped"],
    compatibility: { hostApiVersion: "1.0.0", releaseSchemaVersion: "1.3.1", deploymentProfile: "air_gapped" },
    correlationId
  }, now);
  assert.equal(offlineInstalled.deploymentId, offlineDeploymentId);

  const installed = await installPluginArtifact(app, objectStore, admin, {
    installationId,
    deploymentId,
    artifactId: submitted.artifactId,
    permittedPermissions: ["state_values.read:mapped"],
    compatibility: { hostApiVersion: "1.0.0", releaseSchemaVersion: "1.3.1", deploymentProfile: "air_gapped" },
    correlationId
  }, now);
  assert.equal(installed.digest, manifest.digest);
  const catalog = await getPluginCatalog(app, admin, correlationId, ids.projectB);
  assert.ok(catalog.some((entry) => entry.installationId === installationId && entry.digest === manifest.digest));
  assert.equal(catalog.every((entry) => entry.lifecycleStatus === "approved"), true);
  await assert.rejects(getPluginCatalog(app, operator, correlationId, ids.projectB),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED");
  await assert.rejects(getPluginCatalog(app, admin, correlationId, ids.projectA),
    (error) => error?.envelope?.error?.code === "NOT_FOUND");
  await assert.rejects(
    withOrganizationTransaction(app, ids.orgB, (client) => client.query(
      "UPDATE extension.plugin_artifacts SET digest=$1 WHERE id=$2",
      [`sha256:${"f".repeat(64)}`, submitted.artifactId]
    )),
    (error) => error?.code === "42501"
  );
  await bindPluginInstallation(app, admin, {
    bindingId,
    projectId: ids.projectB,
    definitionRevisionId: ids.revisionB,
    installationId,
    configurationDigest: `sha256:${"2".repeat(64)}`,
    compatibility: { hostApiVersion: "1.0.0", releaseSchemaVersion: "1.3.1", deploymentProfile: "air_gapped" },
    correlationId
  }, now);
  assert.equal((await authorizePluginRun(app, operator, bindingId, correlationId)).artifactDigest, manifest.digest);

  await revokePluginArtifact(app, admin, submitted.artifactId, correlationId, now);
  await assert.rejects(
    authorizePluginRun(app, operator, bindingId, correlationId),
    (error) => error?.envelope?.error?.code === "PLUGIN_NOT_APPROVED"
  );
  const retained = await owner.query(
    `SELECT
       (SELECT count(*) FROM extension.plugin_artifacts WHERE id=$1) artifacts,
       (SELECT count(*) FROM extension.plugin_installations WHERE id=$2) installations,
       (SELECT count(*) FROM extension.plugin_bindings WHERE id=$3) bindings,
       (SELECT count(*) FROM evidence.audit_records WHERE organization_id=$4 AND action LIKE 'plugin_%') audits`,
    [submitted.artifactId, installationId, bindingId, ids.orgB]
  );
  assert.deepEqual(retained.rows[0], { artifacts: "1", installations: "1", bindings: "1", audits: "12" });
});

test("EXT-06/07/08/09/10/17/18/20 isolates runs and applies one approved effect through the Command kernel", async () => {
  const publisherId = "23000000-0000-4000-8000-000000000001";
  const artifactId = "23000000-0000-4000-8000-000000000002";
  const installationId = "23000000-0000-4000-8000-000000000003";
  const bindingId = "23000000-0000-4000-8000-000000000004";
  const compositionRunId = "23000000-0000-4000-8000-000000000005";
  const modelRunId = "23000000-0000-4000-8000-000000000006";
  const stateValueId = "23000000-0000-4000-8000-000000000007";
  const proposalId = "23000000-0000-4000-8000-000000000008";
  const trustRootId = "23000000-0000-4000-8000-000000000017";
  const revocationListId = "23000000-0000-4000-8000-000000000018";
  const digest = `sha256:${"3".repeat(64)}`;
  const configurationDigest = `sha256:${"4".repeat(64)}`;
  const inputDigest = `sha256:${"5".repeat(64)}`;
  const outputDigest = `sha256:${"6".repeat(64)}`;
  const proposalHash = `sha256:${"7".repeat(64)}`;
  const manifest = {
    contractId: "plugin-manifest-v1", manifestVersion: "1.0.0", pluginId: "org.ssg.fixtures.effect", version: "1.0.0",
    digest, artifactPath: "plugin.mjs", publisher: { id: publisherId, signatureKeyId: "fixture" }, categories: ["world_and_simulation"],
    capabilities: ["compute", "propose_effect"], execution: { mode: "container", entrypoint: "plugin.mjs", rootless: true, readOnlyRoot: true },
    connectivity: "offline_capable", contracts: { inputSchema: "input.json", outputSchema: "output.json" },
    compatibility: { hostApi: ">=1.0.0 <2.0.0", releaseSchema: ">=1.3.0 <2.0.0" },
    limits: { timeoutSeconds: 5, memoryMiB: 64, cpuMillis: 1000, outputBytes: 8192 },
    requestedPermissions: ["state_values.read:mapped", "effects.propose"], dataClassificationMaximum: "internal",
    reproducibility: { deterministic: true, seedInput: "seed" }, dependencies: [], provenance: { sourceRevision: "fixture", buildSystem: "none" }, license: "fixture"
  };
  await owner.query("BEGIN");
  try {
    await owner.query(`INSERT INTO extension.publishers(id,organization_id,principal_id,display_name,signature_key_id,public_key_pem,status,approved_by)
      VALUES ($1,$2,$3,'Fixture','fixture','fixture','approved',$3)`, [publisherId, ids.orgA, ids.personA]);
    await owner.query(`INSERT INTO extension.trust_roots
      (id,organization_id,publisher_id,publisher_key_id,publisher_public_key_pem,revocation_key_id,revocation_public_key_pem,provisioned_by)
      VALUES ($1,$2,$3,'fixture','fixture','fixture-revocation','fixture',$4)`,
      [trustRootId, ids.orgA, publisherId, ids.personA]);
    await owner.query(`INSERT INTO extension.revocation_lists
      (id,organization_id,publisher_id,trust_root_id,document,document_sha256,generated_at,imported_by)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,now(),$7)`,
      [revocationListId, ids.orgA, publisherId, trustRootId, JSON.stringify({
        contractId: "plugin-revocations-v1", generatedAt: new Date().toISOString(), publisherId,
        revokedKeyIds: [], revokedDigests: [], signature: { algorithm: "Ed25519", keyId: "fixture-revocation", value: "fixture" }
      }), `sha256:${"e".repeat(64)}`, ids.personA]);
    await owner.query(`INSERT INTO extension.plugin_artifacts
      (id,organization_id,publisher_id,plugin_id,version,digest,manifest_digest,bundle_digest,object_key,manifest,supply_chain,lifecycle_status,submitted_by,approved_by,approved_at)
      VALUES ($1,$2,$3,'org.ssg.fixtures.effect','1.0.0',$4,$5,$6,'fixture',$7::jsonb,'{}','approved',$8,$8,now())`,
      [artifactId, ids.orgA, publisherId, digest, `sha256:${"8".repeat(64)}`, `sha256:${"9".repeat(64)}`, JSON.stringify(manifest), ids.personA]);
    await owner.query(`INSERT INTO extension.plugin_installations
      (id,organization_id,deployment_id,artifact_id,artifact_digest,status,permitted_permissions,installed_by)
      VALUES ($1,$2,$3,$4,$5,'enabled',ARRAY['state_values.read:mapped','effects.propose'],$6)`,
      [installationId, ids.orgA, ids.deploymentA, artifactId, digest, ids.personA]);
    await owner.query(`INSERT INTO extension.plugin_bindings
      (id,organization_id,project_id,definition_revision_id,installation_id,artifact_digest,configuration_digest,deployment_profile,status,bound_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'air_gapped','enabled',$8)`,
      [bindingId, ids.orgA, ids.projectA, ids.revisionA, installationId, digest, configurationDigest, ids.personA]);
    await owner.query(`INSERT INTO runtime.state_values
      (id,organization_id,session_id,governing_release_id,state_variable_id,scope_reference,value,version)
      VALUES ($1,$2,$3,$4,'synthetic_risk','','10',1)`, [stateValueId, ids.orgA, ids.sessionA, ids.releaseA]);
    await owner.query(`INSERT INTO extension.composition_runs
      (id,organization_id,session_id,governing_release_id,trigger_command_id,graph_digest,input_snapshot_id,input_snapshot,input_digest,execution_policy,authority_epoch,status,correlation_id,completed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'{"pressure":10}',$8,'{"reviewerSessionRoleIds":["role-c"],"allowedEffects":[]}',1,'completed',$9,now())`,
      [compositionRunId, ids.orgA, ids.sessionA, ids.releaseA, "23000000-0000-4000-8000-000000000009", `sha256:${"a".repeat(64)}`,
        "23000000-0000-4000-8000-00000000000a", inputDigest, "23000000-0000-4000-8000-00000000000b"]);
    await owner.query(`INSERT INTO extension.model_runs
      (id,organization_id,session_id,composition_run_id,binding_id,artifact_digest,configuration_digest,governing_release_id,input_snapshot_id,input_digest,output_digest,environment_digest,seed,status,completed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,42,'completed',now())`,
      [modelRunId, ids.orgA, ids.sessionA, compositionRunId, bindingId, digest, configurationDigest, ids.releaseA,
        "23000000-0000-4000-8000-00000000000a", inputDigest, outputDigest, `sha256:${"b".repeat(64)}`]);
    await owner.query(`INSERT INTO extension.effect_proposals
      (id,organization_id,session_id,model_run_id,proposal_hash,target_aggregate_id,target_state_variable_id,scope_reference,operation,value,rationale,reviewer_role_ids,lifecycle_status,expected_state_version,governing_release_id,authority_epoch,artifact_digest,configuration_digest,input_digest,output_digest)
      VALUES ($1,$2,$3,$4,$5,$6,'synthetic_risk','','adjust','5','Synthetic effect',ARRAY['role-c'],'in_review',1,$7,1,$8,$9,$10,$11)`,
      [proposalId, ids.orgA, ids.sessionA, modelRunId, proposalHash, stateValueId, ids.releaseA, digest, configurationDigest, inputDigest, outputDigest]);
    await owner.query("COMMIT");
  } catch (error) { await owner.query("ROLLBACK"); throw error; }

  const context = {
    authenticationSessionId: "fixture", principalId: ids.personA, organizationId: ids.orgA, sessionId: ids.sessionA,
    sessionStatus: "active", participantId: ids.participantA, seatAssignmentIds: [ids.assignmentA], activeSessionRoleId: "role-c",
    seatId: "seat-a", organizationRoles: ["operator"], activeReleaseId: ids.releaseA, authenticationStrength: "mfa",
    featureFlags: [], authorityEpoch: 1, accessRevision: 1, deviceId: ids.deviceA
  };
  assert.equal((await owner.query("SELECT value FROM runtime.state_values WHERE id=$1", [stateValueId])).rows[0].value, 10);
  assert.equal((await getEffectProposals(app, context)).length, 1);

  const failedRunId = "23000000-0000-4000-8000-000000000013";
  await owner.query(`INSERT INTO runtime.state_values
    (id,organization_id,session_id,governing_release_id,state_variable_id,scope_reference,value,version)
    VALUES ('23000000-0000-4000-8000-000000000014',$1,$2,$3,'hidden_secret','','"must-not-leak"',1)`,
    [ids.orgA, ids.sessionA, ids.releaseA]);
  const plan = {
    id: "malformed-output-plan", governingReleaseId: ids.releaseA, bindingId, graphDigest: `sha256:${"c".repeat(64)}`,
    seed: 42, triggerSessionRoleIds: ["role-c"], reviewerSessionRoleIds: ["role-c"],
    inputMappings: [{ inputKey: "pressure", stateVariableId: "synthetic_risk", scopeReference: "" }],
    allowedEffects: [{ stateVariableId: "synthetic_risk", scopeReference: "", operations: ["set"] }]
  };
  const started = await submitRuntimeCommand(app, context, {
    commandId: "23000000-0000-4000-8000-000000000015", deviceId: ids.deviceA, operationType: "composition_run.start",
    aggregateId: failedRunId, expectedAggregateVersion: 0, governingReleaseId: ids.releaseA, activeSessionRoleId: "role-c",
    payload: { planId: plan.id }
  }, "23000000-0000-4000-8000-000000000016", ids.deploymentA, new Map([[plan.id, plan]]));
  assert.equal(started.status, "accepted");
  await executePendingModelRun(app, ids.orgA, failedRunId, {
    plans: new Map([[plan.id, plan]]),
    loadArtifact: async () => ({ manifest, pluginDirectory: ".", inputSchema: {}, outputSchema: {} }),
    execute: async () => ({ outputs: {}, outputDigest, environmentDigest: `sha256:${"d".repeat(64)}`, durationMs: 1 })
  });
  const failed = await owner.query(`SELECT composition.input_snapshot,run.status,run.failure_code,
    (SELECT count(*) FROM extension.effect_proposals WHERE model_run_id=run.id) proposals
    FROM extension.composition_runs composition JOIN extension.model_runs run ON run.composition_run_id=composition.id
    WHERE composition.id=$1`, [failedRunId]);
  assert.deepEqual(failed.rows[0], { input_snapshot: { seed: 42, pressure: 10 }, status: "failed", failure_code: "output_invalid", proposals: "0" });

  const timeoutRunId = "23000000-0000-4000-8000-000000000020";
  const timeoutStarted = await submitRuntimeCommand(app, context, {
    commandId: "23000000-0000-4000-8000-000000000021", deviceId: ids.deviceA, operationType: "composition_run.start",
    aggregateId: timeoutRunId, expectedAggregateVersion: 0, governingReleaseId: ids.releaseA, activeSessionRoleId: "role-c",
    payload: { planId: plan.id }
  }, "23000000-0000-4000-8000-000000000022", ids.deploymentA, new Map([[plan.id, plan]]));
  assert.equal(timeoutStarted.status, "accepted");
  await executePendingModelRun(app, ids.orgA, timeoutRunId, {
    plans: new Map([[plan.id, plan]]),
    loadArtifact: async () => ({ manifest, pluginDirectory: ".", inputSchema: {}, outputSchema: {} }),
    execute: async () => { throw new Error("Plugin execution timed out"); }
  });
  assert.deepEqual((await owner.query(`SELECT run.status,run.failure_code,
    (SELECT count(*) FROM extension.effect_proposals WHERE model_run_id=run.id) proposals
    FROM extension.model_runs run WHERE run.composition_run_id=$1`, [timeoutRunId])).rows[0],
  { status: "failed", failure_code: "timeout", proposals: "0" });

  const unauthorized = await submitRuntimeCommand(app, { ...context, principalId: ids.personC, participantId: ids.participantC,
    seatAssignmentIds: [ids.assignmentC], activeSessionRoleId: "role-c-viewer", deviceId: ids.deviceC, organizationRoles: [] }, {
    commandId: "23000000-0000-4000-8000-00000000000c", deviceId: ids.deviceC, operationType: "effect_proposal.approve",
    aggregateId: proposalId, expectedAggregateVersion: 1, governingReleaseId: ids.releaseA, activeSessionRoleId: "role-c-viewer",
    payload: { proposalHash, reason: "Unauthorized attempt" }
  }, "23000000-0000-4000-8000-00000000000d", ids.deploymentA);
  assert.equal(unauthorized.errorCode, "PERMISSION_DENIED");
  const blankReason = await submitRuntimeCommand(app, context, {
    commandId: "23000000-0000-4000-8000-000000000023", deviceId: ids.deviceA, operationType: "effect_proposal.approve",
    aggregateId: proposalId, expectedAggregateVersion: 1, governingReleaseId: ids.releaseA, activeSessionRoleId: "role-c",
    payload: { proposalHash, reason: "   " }
  }, "23000000-0000-4000-8000-000000000024", ids.deploymentA);
  assert.equal(blankReason.errorCode, "VALIDATION_FAILED");

  const command = (commandId) => ({ commandId, deviceId: ids.deviceA, operationType: "effect_proposal.approve", aggregateId: proposalId,
    expectedAggregateVersion: 1, governingReleaseId: ids.releaseA, activeSessionRoleId: "role-c", payload: { proposalHash, reason: "Reviewed fixture" } });
  const [first, second] = await Promise.all([
    submitRuntimeCommand(app, context, command("23000000-0000-4000-8000-00000000000e"), "23000000-0000-4000-8000-000000000010", ids.deploymentA),
    submitRuntimeCommand(app, context, command("23000000-0000-4000-8000-00000000000f"), "23000000-0000-4000-8000-000000000011", ids.deploymentA)
  ]);
  assert.deepEqual([first.status, second.status].sort(), ["accepted", "rejected"]);
  const acceptedCommandId = first.status === "accepted" ? first.commandId : second.commandId;
  const replayed = await submitRuntimeCommand(app, context, command(acceptedCommandId), "23000000-0000-4000-8000-000000000012", ids.deploymentA);
  assert.equal(replayed.replayed, true);
  const outcome = await owner.query(`SELECT
    (SELECT value FROM runtime.state_values WHERE id=$1) value,
    (SELECT count(*) FROM extension.approval_decisions WHERE proposal_id=$2) decisions,
    (SELECT count(*) FROM extension.effect_receipts WHERE proposal_id=$2) effects,
    (SELECT count(*) FROM evidence.events WHERE aggregate_id=$2 AND event_type='effect_proposal.applied') events,
    (SELECT count(*) FROM runtime.state_transactions WHERE target_id=$1 AND source_type='plugin') transactions`, [stateValueId, proposalId]);
  assert.deepEqual(outcome.rows[0], { value: 15, decisions: "1", effects: "1", events: "1", transactions: "1" });
  const transaction = (await owner.query(
    `SELECT previous_value,new_value,source_reference,source_command_id,actor_person_id,rationale,version
       FROM runtime.state_transactions WHERE target_id=$1`, [stateValueId])).rows[0];
  assert.deepEqual(transaction, { previous_value: 10, new_value: 15, source_reference: proposalId,
    source_command_id: acceptedCommandId, actor_person_id: ids.personA, rationale: "Reviewed fixture", version: "2" });

  const staleProposalId = "23000000-0000-4000-8000-000000000019";
  const staleProposalHash = `sha256:${"f".repeat(64)}`;
  await owner.query(`INSERT INTO extension.effect_proposals
    (id,organization_id,session_id,model_run_id,proposal_hash,target_aggregate_id,target_state_variable_id,scope_reference,operation,value,rationale,reviewer_role_ids,lifecycle_status,expected_state_version,governing_release_id,authority_epoch,artifact_digest,configuration_digest,input_digest,output_digest)
    VALUES ($1,$2,$3,$4,$5,$6,'synthetic_risk','','set','20','Stale synthetic effect',ARRAY['role-c'],'in_review',1,$7,1,$8,$9,$10,$11)`,
    [staleProposalId, ids.orgA, ids.sessionA, modelRunId, staleProposalHash, stateValueId, ids.releaseA, digest, configurationDigest, inputDigest, outputDigest]);
  const stale = await submitRuntimeCommand(app, context, {
    commandId: "23000000-0000-4000-8000-00000000001a", deviceId: ids.deviceA, operationType: "effect_proposal.approve",
    aggregateId: staleProposalId, expectedAggregateVersion: 1, governingReleaseId: ids.releaseA, activeSessionRoleId: "role-c",
    payload: { proposalHash: staleProposalHash, reason: "This approval is stale" }
  }, "23000000-0000-4000-8000-00000000001b", ids.deploymentA);
  assert.equal(stale.status, "needs_reconciliation");
  assert.equal(stale.errorCode, "STALE_PROPOSAL");
  assert.equal((await owner.query("SELECT value FROM runtime.state_values WHERE id=$1", [stateValueId])).rows[0].value, 15);

  await owner.query("UPDATE extension.plugin_artifacts SET lifecycle_status='revoked',revoked_at=now() WHERE id=$1", [artifactId]);
  const provenance = await exportExtensionProvenance(
    app, principal, ids.sessionA, "23000000-0000-4000-8000-00000000001c"
  );
  assert.equal(provenance.runs.length, 3);
  assert.equal(provenance.runs.some((run) => run.status === "failed" && run.failure_code === "output_invalid"), true);
  assert.equal(provenance.runs.some((run) => run.status === "failed" && run.failure_code === "timeout"), true);
  assert.equal(provenance.proposals.length, 2);
  assert.equal(provenance.proposals.some((proposal) => proposal.evidence_sequence !== null), true);
  await assert.rejects(
    exportExtensionProvenance(app, { ...principal, organizationRoles: [] }, ids.sessionA, "23000000-0000-4000-8000-00000000001d"),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED"
  );
  await assert.rejects(
    exportExtensionProvenance(app, principal, ids.sessionB, "23000000-0000-4000-8000-00000000001e"),
    (error) => error?.envelope?.error?.code === "TARGET_NOT_FOUND"
  );
});

test("VOTE-01..10 preserve authoritative voting, privacy, replay, deadline, recount and certification invariants", async () => {
  const pollId = "24000000-0000-4000-8000-000000000001";
  const secretPollId = "24000000-0000-4000-8000-000000000002";
  const voteRevisionId = "24000000-0000-4000-8000-000000000003";
  const voteReleaseId = "24000000-0000-4000-8000-000000000004";
  const pollDefinition = {
    id: "resolution-vote", scope: "session", question: "Adopt the synthetic resolution?",
    options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }, { id: "abstain", label: "Abstain" }],
    pollType: "yes_no_abstain", tallyMethod: "builtin_count", tallyMethodVersion: "builtin-count-v1",
    electoratePolicyId: "voters", oneBallotPer: "seat_assignment", allowRevote: false, secrecy: "open",
    thresholdRule: { kind: "simple_majority", denominator: "valid_votes", abstentionCountsTowardDenominator: false },
    quorumRule: { basis: "electorate_at_open", minimum: 1, abstentionCountsTowardParticipation: true },
    weights: [{ seatId: "seat-a", weight: 2 }], vetoRule: { holderSeatIds: [] }, tieRule: "no_decision",
    openTrigger: { mode: "manual" }, closeTrigger: { mode: "manual" }, deadlinePolicy: { graceSeconds: 0 },
    resultVisibilityPolicyId: "results", certificationPolicy: { certifierSessionRoleIds: ["role-c"] }
  };
  const coreDesign = {
    polls: [pollDefinition, { ...pollDefinition, id: "secret-resolution", secrecy: "secret_ballot" }],
    informationPolicies: [
      { id: "voters", grants: [{ audience: { sessionRoleIds: ["role-c"] } }] },
      { id: "results", grants: [{ audience: { sessionRoleIds: ["role-c", "role-c-viewer"] } }] }
    ],
    sessionRoles: [{ id: "role-c", isControlRole: true }, { id: "role-c-viewer" }],
    seats: [{ id: "seat-a", sessionRoleIds: ["role-c"] }, { id: "seat-c-viewer", sessionRoleIds: ["role-c-viewer"] }]
  };
  await owner.query(`INSERT INTO studio.definition_revisions
    (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
    VALUES ($1,$2,$3,$4::jsonb,repeat('2',64),'v1',$5)`,
    [voteRevisionId, ids.orgA, ids.projectA, JSON.stringify({ coreDesign }), ids.personA]);
  await owner.query(`INSERT INTO registry.releases
    (id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
    VALUES ($1,$2,$3,$4,2,'Voting fixture','1','1',repeat('2',64),'voting-fixture',$5)`,
    [voteReleaseId, ids.orgA, ids.projectA, voteRevisionId, ids.personA]);
  await owner.query(`INSERT INTO runtime.release_activations
    (id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
    VALUES ('24000000-0000-4000-8000-000000000005',$1,$2,$3,$4,2,'{}',$5)`,
    [ids.orgA, ids.projectA, ids.sessionA, voteReleaseId, ids.personA]);
  const context = { authenticationSessionId: "fixture", principalId: ids.personA, principalType: "person",
    organizationId: ids.orgA, sessionId: ids.sessionA, sessionStatus: "active", participantId: ids.participantA,
    seatAssignmentIds: [ids.assignmentA], activeSessionRoleId: "role-c", seatId: "seat-a", organizationRoles: ["operator"],
    activeReleaseId: voteReleaseId, authenticationStrength: "mfa", featureFlags: [], authorityEpoch: 1, accessRevision: 2, deviceId: ids.deviceA };
  const observer = { ...context, principalId: ids.personC, participantId: ids.participantC, seatAssignmentIds: [ids.assignmentC],
    activeSessionRoleId: "role-c-viewer", seatId: "seat-c-viewer", organizationRoles: [], deviceId: ids.deviceC, accessRevision: 1 };
  const command = (commandId, operationType, aggregateId, expectedAggregateVersion, payload, actor = context) => ({
    commandId, deviceId: actor.deviceId, operationType, aggregateId, expectedAggregateVersion, governingReleaseId: voteReleaseId,
    activeSessionRoleId: actor.activeSessionRoleId, payload
  });

  const opened = await submitRuntimeCommand(app, context, command("24000000-0000-4000-8000-000000000010", "poll.open", pollId, 0,
    { definitionId: "resolution-vote", definitionRevision: 1 }), "24000000-0000-4000-8000-000000000011", ids.deploymentA);
  assert.equal(opened.status, "accepted");
  const participantPoll = (await withOrganizationTransaction(app, ids.orgA, (client) => getPollProjection(client, context)))[0];
  assert.equal(participantPoll.eligible, true);
  assert.equal(typeof participantPoll.ballotCapability, "string");
  const observerPoll = (await withOrganizationTransaction(app, ids.orgA, (client) => getPollProjection(client, observer)))[0];
  assert.equal(observerPoll.eligible, false);
  assert.equal(observerPoll.ballotCapability, null);
  assert.equal(observerPoll.tally, null);
  await assert.rejects(getPollResult(app, observer, pollId, "24000000-0000-4000-8000-000000000012"),
    (error) => error?.envelope?.error?.code === "RESULT_NOT_RELEASED");

  const ballotPayload = { pollDefinitionRevision: 1, ballotCapability: participantPoll.ballotCapability, optionIds: ["yes"] };
  const castA = command("24000000-0000-4000-8000-000000000020", "ballot.cast", pollId, 1, ballotPayload);
  const castB = command("24000000-0000-4000-8000-000000000021", "ballot.cast", pollId, 1, ballotPayload);
  const concurrent = await Promise.all([
    submitRuntimeCommand(app, context, castA, "24000000-0000-4000-8000-000000000022", ids.deploymentA),
    submitRuntimeCommand(app, context, castB, "24000000-0000-4000-8000-000000000023", ids.deploymentA)
  ]);
  assert.deepEqual(concurrent.map(({ status }) => status).sort(), ["accepted", "rejected"]);
  assert.equal(concurrent.find(({ status }) => status === "rejected")?.errorCode, "ALREADY_VOTED");
  const acceptedCommand = concurrent.find(({ status }) => status === "accepted")?.commandId;
  const replay = await submitRuntimeCommand(app, context, acceptedCommand === castA.commandId ? castA : castB,
    "24000000-0000-4000-8000-000000000024", ids.deploymentA);
  assert.equal(replay.replayed, true);
  assert.equal((await owner.query("SELECT count(*) FROM voting.ballots WHERE poll_id=$1", [pollId])).rows[0].count, "1");
  const eventBody = (await owner.query("SELECT body FROM evidence.events WHERE aggregate_id=$1 AND event_type='ballot.accepted'", [pollId])).rows[0].body;
  assert.equal(JSON.stringify(eventBody).includes("yes"), false);
  await assert.rejects(withOrganizationTransaction(app, ids.orgA, (client) =>
    client.query("UPDATE voting.poll_options SET label='Changed' WHERE poll_id=$1", [pollId])), /permission denied|immutable/u);

  const closed = await submitRuntimeCommand(app, context, command("24000000-0000-4000-8000-000000000030", "poll.close", pollId, 1, {}),
    "24000000-0000-4000-8000-000000000031", ids.deploymentA);
  assert.equal(closed.status, "accepted");
  const late = await submitRuntimeCommand(app, context, command("24000000-0000-4000-8000-000000000032", "ballot.cast", pollId, 2, ballotPayload),
    "24000000-0000-4000-8000-000000000033", ids.deploymentA);
  assert.equal(late.errorCode, "DEADLINE_EXPIRED");
  const tallied = await submitRuntimeCommand(app, context, command("24000000-0000-4000-8000-000000000040", "poll.tally", pollId, 2, {}),
    "24000000-0000-4000-8000-000000000041", ids.deploymentA);
  assert.equal(tallied.status, "accepted");
  const stored = (await owner.query("SELECT ballot_set_sha256,result_sha256 FROM voting.tallies WHERE poll_id=$1", [pollId])).rows[0];
  const source = (await owner.query(`SELECT ballot.id,ballot.ballot_revision,ballot.choices,ballot.accepted_sequence,member.weight,member.veto
    FROM voting.ballot_receipts receipt JOIN voting.ballots ballot ON ballot.id=receipt.ballot_id
    JOIN voting.electorate_members member ON member.id=receipt.eligibility_consumption_id WHERE receipt.poll_id=$1 AND receipt.is_current`, [pollId])).rows;
  const recount = computeBuiltInTally(pollDefinition, source, 1, new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(recount.ballotSetSha256, stored.ballot_set_sha256);
  assert.equal(recount.resultSha256, stored.result_sha256);

  const certify = (id) => submitRuntimeCommand(app, context, command(id, "poll.certify", pollId, 3, { resultSha256: stored.result_sha256 }),
    randomUUID(), ids.deploymentA);
  const certifications = await Promise.all([certify("24000000-0000-4000-8000-000000000050"), certify("24000000-0000-4000-8000-000000000051")]);
  assert.deepEqual(certifications.map(({ status }) => status).sort(), ["accepted", "needs_reconciliation"]);
  assert.equal((await owner.query("SELECT count(*) FROM voting.certifications WHERE poll_id=$1 AND is_current", [pollId])).rows[0].count, "1");
  const released = await getPollResult(app, observer, pollId, "24000000-0000-4000-8000-000000000052");
  assert.equal(released.tally.resultSha256, stored.result_sha256);

  const secret = await submitRuntimeCommand(app, context, command("24000000-0000-4000-8000-000000000060", "poll.open", secretPollId, 0,
    { definitionId: "secret-resolution", definitionRevision: 1 }), "24000000-0000-4000-8000-000000000061", ids.deploymentA);
  assert.equal(secret.errorCode, "CAPABILITY_UNAVAILABLE");
});

test("PS-545-T02 VOICE-01..05/09/11/13/14 enforce grants, consent, immediate withdrawal, Floor and revocation", async () => {
  const revisionId = "25000000-0000-4000-8000-000000000001";
  const releaseId = "25000000-0000-4000-8000-000000000002";
  const channelId = "25000000-0000-4000-8000-000000000003";
  const adapterDigest = `sha256:${"e".repeat(64)}`;
  const definition = {
    id: "priority-radio", name: "Priority radio", mode: "radio_ptt", capacity: 8,
    priorityPolicy: [{ sessionRoleId: "role-c", priority: 10 }, { sessionRoleId: "role-c-viewer", priority: 100 }],
    canListen: { sessionRoleIds: ["role-c", "role-c-viewer"] },
    canTransmit: { sessionRoleIds: ["role-c", "role-c-viewer"] },
    canModerate: { sessionRoleIds: ["role-c"] },
    radio: { floorLeaseMs: 5000, queuePolicy: "priority", preemption: "authorized_emergency", maxTransmissionMs: 15000, cooldownMs: 0 },
    recordingPolicy: "off", transcriptionPolicy: "with_consent", retentionPolicyId: "voice-short", mediaProviderAdapterBindingId: "adapter-1"
  };
  const privateDefinition = {
    id: "private-consultation", name: "Private consultation", mode: "private_call", capacity: 4,
    canListen: { sessionRoleIds: ["role-c", "role-c-viewer"] }, canTransmit: { sessionRoleIds: ["role-c", "role-c-viewer"] },
    canModerate: { sessionRoleIds: ["role-c"] }, canInvite: { sessionRoleIds: ["role-c"] },
    recordingPolicy: "off", transcriptionPolicy: "off", mediaProviderAdapterBindingId: "adapter-1"
  };
  const broadcastDefinition = {
    id: "control-broadcast", name: "Control broadcast", mode: "broadcast", capacity: 8,
    canListen: { sessionRoleIds: ["role-c", "role-c-viewer"] }, canTransmit: { sessionRoleIds: ["role-c"] },
    canModerate: { sessionRoleIds: ["role-c"] }, recordingPolicy: "off", transcriptionPolicy: "off",
    mediaProviderAdapterBindingId: "adapter-1"
  };
  const coreDesign = { communications: { voiceChannels: [definition, privateDefinition, broadcastDefinition] },
    platformAdapters: [{ id: "adapter-1", digest: "e".repeat(64) }],
    sessionRoles: [{ id: "role-c", isControlRole: true }, { id: "role-c-viewer" }],
    seats: [{ id: "seat-a" }, { id: "seat-c-viewer" }] };
  await owner.query(`INSERT INTO studio.definition_revisions
    (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
    VALUES ($1,$2,$3,$4::jsonb,repeat('5',64),'v1',$5)`,
  [revisionId,ids.orgA,ids.projectA,JSON.stringify({coreDesign}),ids.personA]);
  await owner.query(`INSERT INTO registry.releases
    (id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
    VALUES ($1,$2,$3,$4,3,'Voice fixture','1','1',repeat('5',64),'voice-fixture',$5)`,
  [releaseId,ids.orgA,ids.projectA,revisionId,ids.personA]);
  await owner.query(`INSERT INTO runtime.release_activations
    (id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
    VALUES ('25000000-0000-4000-8000-000000000004',$1,$2,$3,$4,3,'{}',$5)`,
  [ids.orgA,ids.projectA,ids.sessionA,releaseId,ids.personA]);
  const accessA=Number((await owner.query("SELECT access_revision FROM runtime.participant_access_revisions WHERE participant_id=$1",[ids.participantA])).rows[0].access_revision);
  const accessC=Number((await owner.query("SELECT access_revision FROM runtime.participant_access_revisions WHERE participant_id=$1",[ids.participantC])).rows[0].access_revision);
  const context={authenticationSessionId:"fixture",principalId:ids.personA,principalType:"person",organizationId:ids.orgA,sessionId:ids.sessionA,
    sessionStatus:"active",participantId:ids.participantA,seatAssignmentIds:[ids.assignmentA],activeSessionRoleId:"role-c",seatId:"seat-a",
    organizationRoles:["operator"],activeReleaseId:releaseId,authenticationStrength:"mfa",featureFlags:[],authorityEpoch:1,accessRevision:accessA,deviceId:ids.deviceA};
  const high={...context,principalId:ids.personC,participantId:ids.participantC,seatAssignmentIds:[ids.assignmentC],activeSessionRoleId:"role-c-viewer",
    seatId:"seat-c-viewer",organizationRoles:[],accessRevision:accessC,deviceId:ids.deviceC};
  const media={id:"fixture-media",version:"fixture-v1",digest:adapterDigest,transmit:[],
    async issueCredential(input){return{contractId:"media-credential-v1",providerAdapterId:this.id,providerAdapterVersion:this.version,
      providerAdapterDigest:this.digest,serverUrl:"wss://media.fixture.invalid",room:input.channelId,participantIdentity:input.participantId,
      token:"fixture-token",permissions:input.permissions,expiresAt:new Date(Date.now()+30000).toISOString()};},
    async setTransmit(input,enabled){this.transmit.push([input.participantId,enabled]);},async removeParticipant(){},async closeChannel(){},async health(){return"available";}};
  const submit=(actor,command)=>submitRuntimeCommand(app,actor,command,randomUUID(),ids.deploymentA,new Map(),media);
  const make=(actor,id,operation,version,payload={})=>({commandId:id,deviceId:actor.deviceId,operationType:operation,aggregateId:channelId,
    expectedAggregateVersion:version,governingReleaseId:releaseId,activeSessionRoleId:actor.activeSessionRoleId,payload});
  assert.equal((await submit(context,make(context,"25000000-0000-4000-8000-000000000010","voice_channel.open",0,
    {definitionId:"priority-radio",definitionRevision:1}))).status,"accepted");
  await assert.rejects(issueMediaCredential(app,high,channelId,media,randomUUID()),error=>error?.envelope?.error?.code==="ACCESS_REVOKED");
  assert.equal((await submit(context,make(context,"25000000-0000-4000-8000-000000000011","voice_channel.join",1))).status,"accepted");
  assert.equal((await submit(high,make(high,"25000000-0000-4000-8000-000000000012","voice_channel.join",1))).status,"accepted");
  const consentRequired=await submit(context,make(context,"25000000-0000-4000-8000-000000000013","voice_transcription.start",1));
  assert.equal(consentRequired.errorCode,"CONSENT_REQUIRED");
  assert.equal((await submit(context,make(context,"25000000-0000-4000-8000-000000000014","voice_consent.give",1,{kind:"transcription"}))).status,"accepted");
  assert.equal((await submit(high,make(high,"25000000-0000-4000-8000-000000000015","voice_consent.give",1,{kind:"transcription"}))).status,"accepted");
  assert.equal((await submit(context,make(context,"25000000-0000-4000-8000-000000000016","voice_transcription.start",1))).aggregateVersion,2);
  assert.equal((await owner.query("SELECT transcription_active FROM comms.voice_channels WHERE id=$1",[channelId])).rows[0].transcription_active,true);
  assert.equal((await submit(high,make(high,"25000000-0000-4000-8000-000000000017","voice_consent.withdraw",2,{kind:"transcription"}))).aggregateVersion,3);
  assert.equal((await owner.query("SELECT transcription_active FROM comms.voice_channels WHERE id=$1",[channelId])).rows[0].transcription_active,false);
  assert.equal((await owner.query("SELECT count(*) FROM evidence.events WHERE aggregate_id=$1 AND event_type IN ('voice_consent.withdrawn','voice_transcription.stopped')",[channelId])).rows[0].count,"2");
  assert.equal((await submit(context,make(context,"25000000-0000-4000-8000-000000000018","voice_recording.start",3))).errorCode,"INVALID_TRANSITION");
  await assert.rejects(owner.query("UPDATE comms.consent_records SET action='given' WHERE command_id=$1",["25000000-0000-4000-8000-000000000017"]));
  assert.equal((await owner.query("SELECT count(*) FROM comms.recording_assets WHERE channel_id=$1",[channelId])).rows[0].count,"0");
  const credential=await issueMediaCredential(app,context,channelId,media,randomUUID());
  assert.equal(credential.providerAdapterDigest,adapterDigest);
  assert.equal(credential.permissions.includes("transmit"),false);

  const floor=(actor,requestId,connectionId,reason)=>({pool:app,context:actor,channelId,deviceId:actor.deviceId,correlationId:randomUUID(),
    deploymentId:ids.deploymentA,tokenSecret:"fixture-floor-secret",mediaAdapter:media,
    input:{requestId,connectionId,expectedAuthorityEpoch:1,...(reason===undefined?{}:{reason})}});
  const lowRequest="25000000-0000-4000-8000-000000000020",lowConnection="25000000-0000-4000-8000-000000000021";
  const low=await requestFloor(floor(context,lowRequest,lowConnection));
  assert.equal(low.status,"granted");
  assert.deepEqual(await requestFloor(floor(context,lowRequest,lowConnection)),low);
  await assert.rejects(requestFloor(floor(context,lowRequest,"25000000-0000-4000-8000-000000000028")),
    error=>error?.envelope?.error?.code==="FLOOR_TOKEN_EXPIRED");
  assert.equal((await owner.query("SELECT count(*) FROM comms.floor_requests WHERE request_id=$1",[lowRequest])).rows[0].count,"1");
  const highRequest="25000000-0000-4000-8000-000000000022",highConnection="25000000-0000-4000-8000-000000000023";
  const preempted=await requestFloor(floor(high,highRequest,highConnection,"Control priority"));
  assert.equal(preempted.status,"granted");
  await assert.rejects(releaseFloor({...floor(context,lowRequest,lowConnection),input:{requestId:lowRequest,connectionId:lowConnection,
    expectedAuthorityEpoch:1,floorToken:low.floorToken}}),error=>error?.envelope?.error?.code==="FLOOR_TOKEN_EXPIRED");
  await releaseFloor({...floor(high,highRequest,highConnection),input:{requestId:highRequest,connectionId:highConnection,
    expectedAuthorityEpoch:1,floorToken:preempted.floorToken}});

  const simultaneous=await Promise.all([
    requestFloor(floor(context,"25000000-0000-4000-8000-000000000024","25000000-0000-4000-8000-000000000025")),
    requestFloor(floor(high,"25000000-0000-4000-8000-000000000026","25000000-0000-4000-8000-000000000027","Priority"))
  ]);
  assert.equal(simultaneous.every(({status})=>status==="granted"||status==="queued"),true);
  assert.equal((await owner.query("SELECT count(*) FROM comms.floor_leases WHERE channel_id=$1 AND active",[channelId])).rows[0].count,"1");
  await owner.query("UPDATE comms.voice_grants SET revoked_at=transaction_timestamp() WHERE channel_id=$1 AND participant_id=$2",
    [channelId,high.participantId]);
  await assert.rejects(
    requestFloor(floor(high,"25000000-0000-4000-8000-000000000029","25000000-0000-4000-8000-00000000002a")),
    error=>error?.envelope?.error?.code==="PERMISSION_DENIED"
  );
  const privateChannelId="25000000-0000-4000-8000-000000000030";
  const privateCommand=(id,operation,version,payload={})=>({...make(context,id,operation,version,payload),aggregateId:privateChannelId});
  assert.equal((await submit(context,privateCommand("25000000-0000-4000-8000-000000000031","voice_channel.open",0,
    {definitionId:"private-consultation",definitionRevision:1}))).errorCode,"VALIDATION_FAILED");
  assert.equal((await submit(context,privateCommand("25000000-0000-4000-8000-000000000032","voice_channel.open",0,
    {definitionId:"private-consultation",definitionRevision:1,invitedParticipantIds:[ids.participantC]}))).status,"accepted");
  assert.equal((await submit(high,{...privateCommand("25000000-0000-4000-8000-000000000033","voice_channel.join",1),
    deviceId:high.deviceId,activeSessionRoleId:high.activeSessionRoleId})).status,"accepted");
  const broadcastChannelId="25000000-0000-4000-8000-000000000034";
  const broadcastCommand=(id,operation,version,payload={})=>({...make(context,id,operation,version,payload),aggregateId:broadcastChannelId});
  assert.equal((await submit(context,broadcastCommand("25000000-0000-4000-8000-000000000035","voice_channel.open",0,
    {definitionId:"control-broadcast",definitionRevision:1}))).status,"accepted");
  assert.equal((await submit(high,{...broadcastCommand("25000000-0000-4000-8000-000000000036","voice_channel.join",1),
    deviceId:high.deviceId,activeSessionRoleId:high.activeSessionRoleId})).status,"accepted");
  assert.equal((await issueMediaCredential(app,high,broadcastChannelId,media,randomUUID())).permissions.includes("transmit"),false);
  await owner.query("UPDATE runtime.seat_assignments SET valid_to=now() WHERE id=$1",[ids.assignmentC]);
  assert.equal((await owner.query("SELECT count(*) FROM comms.voice_grants WHERE seat_assignment_id=$1 AND revoked_at IS NULL",[ids.assignmentC])).rows[0].count,"0");
  assert.equal((await owner.query("SELECT count(*) FROM comms.floor_leases WHERE holder_seat_assignment_id=$1 AND active",[ids.assignmentC])).rows[0].count,"0");
  await assert.rejects(issueMediaCredential(app,{...context,organizationId:ids.orgB},channelId,media,randomUUID()),
    error=>error?.envelope?.error?.code==="TARGET_NOT_FOUND");
  assert.equal(Number((await owner.query("SELECT count(*) FROM evidence.events WHERE aggregate_id=$1 AND event_type='floor_lease.preempted'",[channelId])).rows[0].count)>=1,true);
});

function collaborativeDocument(update) {
  const document = new Y.Doc();
  Y.applyUpdate(document, Buffer.from(update, "base64"), "server");
  return document;
}

function captureUpdate(document, change) {
  let update;
  const listener = (value, origin) => { if (origin !== "server") update = value; };
  document.on("update", listener);
  change();
  document.off("update", listener);
  assert.ok(update instanceof Uint8Array);
  return Buffer.from(update).toString("base64");
}

test("PS-300 SYNC-01 SYNC-02 AC-01 concurrent offline edits converge byte-for-byte and invalid merges cannot publish", async () => {
  const preview = await getRolePreview(app, principalE, ids.projectA, {
    sessionRoleId: "scribe", stageId: "orientation", teamId: "blue"
  }, randomUUID());
  assert.equal(preview.contractId, "role-preview-v1");
  assert.equal(preview.interfaceProfileId, "participant-author");
  assert.ok(preview.modules.some(({ type }) => type === "artifact_form"));
  assert.deepEqual(preview.content.map(({ id }) => id), ["opening-brief"]);
  await owner.query(
    "DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2 AND organization_role='designer'",
    [ids.orgA, principalE.principalId]
  );
  await assert.rejects(
    getCollaborativeDraft(app, principalE, ids.projectA, randomUUID()),
    (error) => error.envelope?.error?.code === "ACCESS_REVOKED"
  );
  await assert.rejects(
    getRolePreview(app, principalE, ids.projectA, { sessionRoleId: "scribe", stageId: "orientation", teamId: "blue" }, randomUUID()),
    (error) => error.envelope?.error?.code === "ACCESS_REVOKED"
  );
  await owner.query(
    "INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'designer')",
    [ids.orgA, principalE.principalId]
  );
  const initial = await getCollaborativeDraft(app, principalE, ids.projectA, randomUUID());
  await assert.rejects(
    applyStudioUpdate(app, principalE, { projectId: ids.projectA, updateId: randomUUID(), connectionId: randomUUID(),
      expectedGeneration: initial.generation, update: Buffer.alloc(256 * 1024 + 1).toString("base64") }, randomUUID()),
    (error) => error.envelope?.error?.code === "TOO_LARGE"
  );
  const first = collaborativeDocument(initial.update);
  const second = collaborativeDocument(initial.update);
  const firstScenario = first.getMap("draft").get("scenario");
  const secondScenario = second.getMap("draft").get("scenario");
  assert.ok(firstScenario instanceof Y.Map && secondScenario instanceof Y.Map);
  const firstUpdate = captureUpdate(first, () => firstScenario.set("name", "Joint planning exercise"));
  const secondUpdate = captureUpdate(second, () => secondScenario.set("description", "Merged while both Designers were offline."));

  await applyStudioUpdate(app, principalD, { projectId: ids.projectA, updateId: randomUUID(), connectionId: randomUUID(),
    expectedGeneration: initial.generation, update: secondUpdate }, randomUUID());
  const firstUpdateId = randomUUID();
  await applyStudioUpdate(app, principalE, { projectId: ids.projectA, updateId: firstUpdateId, connectionId: randomUUID(),
    expectedGeneration: initial.generation, update: firstUpdate }, randomUUID());
  await applyStudioUpdate(app, principalE, { projectId: ids.projectA, updateId: firstUpdateId, connectionId: randomUUID(),
    expectedGeneration: initial.generation, update: firstUpdate }, randomUUID());

  const merged = await getCollaborativeDraft(app, principalD, ids.projectA, randomUUID());
  const reconnectedA = collaborativeDocument(merged.update);
  const reconnectedB = collaborativeDocument(merged.update);
  assert.deepEqual(Buffer.from(Y.encodeStateAsUpdate(reconnectedA)), Buffer.from(Y.encodeStateAsUpdate(reconnectedB)));
  assert.equal(reconnectedA.getMap("draft").toJSON().scenario.name, "Joint planning exercise");
  assert.equal(reconnectedA.getMap("draft").toJSON().scenario.description, "Merged while both Designers were offline.");
  assert.equal(merged.validation.valid, true);
  const synchronizedStorage = await owner.query(
    `SELECT document.materialized_document IS NULL AS snapshot_authoritative,draft.document->'scenario'->>'description' AS description
       FROM studio.collaborative_documents document JOIN studio.drafts draft
         ON draft.organization_id=document.organization_id AND draft.project_id=document.project_id
      WHERE document.organization_id=$1 AND document.project_id=$2`, [ids.orgA, ids.projectA]
  );
  assert.deepEqual(synchronizedStorage.rows[0], {
    snapshot_authoritative: true, description: "Merged while both Designers were offline."
  });

  const workflows = reconnectedA.getMap("draft").get("coreDesign").get("workflows");
  assert.ok(workflows instanceof Y.Array);
  const workflow = workflows.get(0);
  assert.ok(workflow instanceof Y.Map);
  const invalidUpdate = captureUpdate(reconnectedA, () => workflow.set("initialState", "missing-state"));
  const invalid = await applyStudioUpdate(app, principalE, { projectId: ids.projectA, updateId: randomUUID(), connectionId: randomUUID(),
    expectedGeneration: merged.generation, update: invalidUpdate }, randomUUID());
  assert.equal(invalid.validation.valid, false);
  assert.ok(invalid.validation.issues.some(({ path }) => path.includes("workflow-team-review")));
  await assert.rejects(
    publishCollaborativeDraft(app, objectStore, principalD, ids.projectA, {
      releaseLabel: "Rejected invalid merge", semanticVersion: "1.0.0", methodologyVersion: "1.3.1", releaseNotes: "test",
      warningsAcknowledged: true, classificationReviewId: "class-review", accessibilityReviewStatus: "reviewed",
      retentionPolicyId: "standard", approvalNotes: "synthetic test"
    }, randomUUID()),
    (error) => error.envelope?.error?.code === "VALIDATION_FAILED"
  );
});

test("PS-300 AC-02 publication freezes one valid state vector and later edits remain in the next Draft", async () => {
  await getCollaborativeDraft(app, principalF, ids.projectA, randomUUID());
  await assert.rejects(
    assertStudioSyncAccess(app, principalF, ids.projectA, randomUUID()),
    (error) => error.envelope?.error?.code === "ACCESS_REVOKED"
  );
  const invalid = await getCollaborativeDraft(app, principalD, ids.projectA, randomUUID());
  const repairedDocument = collaborativeDocument(invalid.update);
  const workflows = repairedDocument.getMap("draft").get("coreDesign").get("workflows");
  const workflow = workflows.get(0);
  assert.ok(workflow instanceof Y.Map);
  const repair = captureUpdate(repairedDocument, () => workflow.set("initialState", "draft"));
  const ready = await applyStudioUpdate(app, principalD, { projectId: ids.projectA, updateId: randomUUID(), connectionId: randomUUID(),
    expectedGeneration: invalid.generation, update: repair }, randomUUID());
  assert.equal(ready.validation.valid, true);
  const frozenDescription = ready.materialization.scenario.description;

  let signalUpload;
  let releaseUpload;
  const uploading = new Promise((resolve) => { signalUpload = resolve; });
  const continueUpload = new Promise((resolve) => { releaseUpload = resolve; });
  const delayedStore = {
    async putImmutable(...args) { signalUpload(); await continueUpload; return objectStore.putImmutable(...args); },
    get: objectStore.get.bind(objectStore),
    deleteIfDigest: objectStore.deleteIfDigest.bind(objectStore)
  };
  const frozen = await freezeCollaborativeDraft(app, principalD, ids.projectA, randomUUID());
  await assert.rejects(
    approvePublicationFreeze(app, principalD, ids.projectA, frozen.freezeId, "Admin authority is not methodology authority.", randomUUID()),
    (error) => error.envelope?.error?.code === "ACCESS_REVOKED"
  );
  await owner.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'reviewer')",
    [ids.orgA, ids.personD]);
  try {
    await assert.rejects(
      approvePublicationFreeze(app, { ...principalD, organizationRoles: [...principalD.organizationRoles, "reviewer"] },
        ids.projectA, frozen.freezeId, "An author must not self-approve.", randomUUID()),
      (error) => error.envelope?.error?.code === "PERMISSION_DENIED"
    );
  } finally {
    await owner.query("DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2 AND organization_role='reviewer'",
      [ids.orgA, ids.personD]);
  }
  await assert.rejects(
    publishCollaborativeDraft(app, delayedStore, principalD, ids.projectA, {
      freezeId: frozen.freezeId, releaseLabel: "Unreviewed", semanticVersion: "2.0.0", methodologyVersion: "1.3.1",
      releaseNotes: "must fail", warningsAcknowledged: true, classificationReviewId: "class-review",
      accessibilityReviewStatus: "reviewed", retentionPolicyId: "standard", approvalNotes: "synthetic test"
    }, randomUUID()),
    (error) => error.envelope?.error?.code === "PERMISSION_DENIED" && error.envelope.error.details?.freezeId === frozen.freezeId
  );
  await approvePublicationFreeze(app, principalF, ids.projectA, frozen.freezeId, "Methodology reviewed.", randomUUID());
  await owner.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'publisher')",
    [ids.orgA, ids.personF]);
  const reviewerPublisher = { ...principalF, organizationRoles: ["reviewer", "publisher"] };
  const publishing = publishCollaborativeDraft(app, delayedStore, reviewerPublisher, ids.projectA, {
    freezeId: frozen.freezeId,
    releaseLabel: "Frozen collaboration proof", semanticVersion: "2.0.0", methodologyVersion: "1.3.1",
    releaseNotes: "PS-300 publication fence proof", warningsAcknowledged: true, classificationReviewId: "class-review",
    accessibilityReviewStatus: "reviewed", retentionPolicyId: "standard", approvalNotes: "synthetic test"
  }, randomUUID());
  await uploading;

  const afterFreeze = await getCollaborativeDraft(app, principalE, ids.projectA, randomUUID());
  assert.equal(afterFreeze.generation, ready.generation + 1);
  const nextDocument = collaborativeDocument(afterFreeze.update);
  const scenario = nextDocument.getMap("draft").get("scenario");
  assert.ok(scenario instanceof Y.Map);
  const laterUpdate = captureUpdate(nextDocument, () => scenario.set("description", "This edit belongs only to the next Draft."));
  await applyStudioUpdate(app, principalE, { projectId: ids.projectA, updateId: randomUUID(), connectionId: randomUUID(),
    expectedGeneration: ready.generation, update: laterUpdate }, randomUUID());
  releaseUpload();
  const published = await publishing;
  const template = await publishSimulationTemplate(app, reviewerPublisher, ids.projectA, {
    title: "PS-760 governed Template", summary: "Exact approved freeze Template.", includeScenario: false,
    rationale: "Publish the independently reviewed exact revision."
  }, randomUUID());
  assert.ok(Number.isSafeInteger(template.version) && template.version > 0);
  assert.equal(template.immutable, true);
  await recordTemplateLifecycle(app, reviewerPublisher, template.templateId, "deprecated", "Superseded by the next governed method.", randomUUID());
  await recordTemplateLifecycle(app, reviewerPublisher, template.templateId, "archived", "Retain attributable history without active use.", randomUUID());
  await assert.rejects(
    recordTemplateLifecycle(app, reviewerPublisher, template.templateId, "archived", "Duplicate archive must fail.", randomUUID()),
    (error) => error.envelope?.error?.code === "VERSION_CONFLICT"
  );
  const templates = await listSimulationTemplates(app, reviewerPublisher, { query: "PS-760 governed Template", limit: 10 }, randomUUID());
  const governedTemplate = templates.templates.find(({ id }) => id === template.templateId);
  assert.equal(governedTemplate?.lifecycleStatus, "archived");
  assert.deepEqual(governedTemplate?.lifecycleHistory.map(({ eventType }) => eventType), ["published", "deprecated", "archived"]);
  await owner.query("DELETE FROM identity.memberships WHERE organization_id=$1 AND person_id=$2 AND organization_role='publisher'",
    [ids.orgA, ids.personF]);

  const evidence = await owner.query(
    `SELECT r.snapshot,r.source_freeze_id,f.generation
       FROM studio.definition_revisions r JOIN studio.publication_freezes f ON f.id=r.source_freeze_id
      WHERE r.id=$1`, [published.definitionRevisionId]
  );
  assert.equal(evidence.rows[0].snapshot.scenario.description, frozenDescription);
  assert.equal(evidence.rows[0].source_freeze_id, published.freezeId);
  assert.equal(Number(evidence.rows[0].generation), ready.generation);
  const nextDraft = await getCollaborativeDraft(app, principalD, ids.projectA, randomUUID());
  assert.equal(nextDraft.materialization.scenario.description, "This edit belongs only to the next Draft.");
  await assert.rejects(owner.query("UPDATE studio.definition_revisions SET snapshot='{}'::jsonb WHERE id=$1", [published.definitionRevisionId]), /append-only/iu);

  await owner.query(
    `INSERT INTO studio.document_updates
       (id,organization_id,document_id,update_id,author_person_id,client_context,bytes,size_bytes,sha256,generation)
     SELECT gen_random_uuid(),$1,$2,gen_random_uuid(),$3,'{}'::jsonb,decode('00','hex'),1,repeat('0',64),$4
       FROM generate_series(1,120)`,
    [ids.orgA, nextDraft.documentId, principalE.principalId, nextDraft.generation]
  );
  const rateLimitedDocument = collaborativeDocument(nextDraft.update);
  const rateLimitedScenario = rateLimitedDocument.getMap("draft").get("scenario");
  assert.ok(rateLimitedScenario instanceof Y.Map);
  const rateLimitedUpdate = captureUpdate(rateLimitedDocument, () => rateLimitedScenario.set("description", "Rejected by rate limit."));
  await assert.rejects(
    applyStudioUpdate(app, principalE, { projectId: ids.projectA, updateId: randomUUID(), connectionId: randomUUID(),
      expectedGeneration: nextDraft.generation, update: rateLimitedUpdate }, randomUUID()),
    (error) => error.envelope?.error?.code === "CAPABILITY_UNAVAILABLE"
  );
});

test("DEC-61 Research Analyst exports only a granted, PII-free Evidence index", async () => {
  const analyst = { ...principalC, organizationRoles: ["research_analyst"] };
  await assert.rejects(
    owner.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'invented_role')", [ids.orgA, ids.personC]),
    /memberships_organization_role_check/iu
  );
  await assert.rejects(
    exportResearchEvidenceIndex(app, analyst, ids.sessionA, randomUUID()),
    (error) => error.envelope?.error?.code === "PERMISSION_DENIED"
  );
  await assert.rejects(
    grantResearchAccess(app, analyst, {
      projectId: ids.projectA, analystPersonId: ids.personC, protocolReference: "PROTO-DENIED",
      expiresAt: new Date("2098-01-01T00:00:00.000Z")
    }, randomUUID()),
    (error) => error.envelope?.error?.code === "PERMISSION_DENIED"
  );
  const grant = await grantResearchAccess(app, principalD, {
    projectId: ids.projectA,
    analystPersonId: ids.personC,
    protocolReference: "PROTO-SYNTHETIC-001",
    expiresAt: new Date("2098-01-01T00:00:00.000Z")
  }, randomUUID());
  const exported = await exportResearchEvidenceIndex(app, analyst, ids.sessionA, randomUUID(), 0, 10,
    new Date("2026-10-21T12:00:00.000Z"));
  assert.equal(exported.protocolReference, "PROTO-SYNTHETIC-001");
  assert.ok(exported.events.length > 0);
  assert.equal("body" in exported.events[0], false);
  assert.equal("actorPersonId" in exported.events[0], false);
  const generatedAt = new Date("2026-10-21T12:00:00.000Z");
  const formats = await Promise.all(["json", "csv", "html", "zip"].map((format) =>
    exportResearchEvidenceBundle(app, analyst, ids.projectA, format, randomUUID(), generatedAt)));
  assert.deepEqual(formats.map(({ contentType }) => contentType), [
    "application/json", "text/csv; charset=utf-8", "text/html; charset=utf-8", "application/zip"
  ]);
  const [json, csvExport, htmlExport, archive] = formats;
  const jsonBody = JSON.parse(Buffer.from(json.bytes).toString("utf8"));
  assert.ok(jsonBody.sessions.length >= 2);
  assert.equal(jsonBody.events.every(({ captureMode }) => captureMode === "captured"), true);
  assert.match(Buffer.from(csvExport.bytes).toString("utf8"), /^"sessionId","sequence","eventType"/u);
  assert.match(Buffer.from(htmlExport.bytes).toString("utf8"), /Research evidence report/u);
  assert.deepEqual(Buffer.from(archive.bytes.subarray(0, 4)), Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  assert.equal(Buffer.from(archive.bytes).includes(Buffer.from("manifest.json")), true);
  assert.equal(archive.manifest.sourceReconciliation.matched, true);
  assert.equal(archive.manifest.sourceReconciliation.sourceRows, archive.manifest.sourceReconciliation.exportedRows);
  assert.deepEqual(archive.manifest.captureModes, ["captured"]);
  assert.equal(archive.manifest.formalReportSource.path, "report.html");
  await revokeResearchAccess(app, principalD, grant.grantId, randomUUID());
  await assert.rejects(
    exportResearchEvidenceIndex(app, analyst, ids.sessionA, randomUUID()),
    (error) => error.envelope?.error?.code === "PERMISSION_DENIED"
  );
});

test("AC-06 PS-520-T01/T02/T03 generates traceable reports, consent-filtered research, replay, and portable archives", async () => {
  const analyst = { ...principalC, organizationRoles: ["research_analyst"] };
  await grantResearchAccess(app, principalD, {
    projectId: ids.projectA, analystPersonId: ids.personC, protocolReference: "PS-520-SYNTHETIC",
    expiresAt: new Date("2098-01-01T00:00:00.000Z")
  }, randomUUID());
  const next = await owner.query("SELECT COALESCE(max(sequence),0)+1 AS sequence FROM evidence.events WHERE session_id=$1", [ids.sessionA]);
  const participantEventId = randomUUID();
  await owner.query(`INSERT INTO evidence.events
    (id,organization_id,session_id,sequence,event_type,event_version,actor_person_id,actor_participant_id,
     governing_release_id,authority_epoch,body)
    VALUES ($1,$2,$3,$4,'research.observed',1,$5,$6,$7,1,$8::jsonb)`,
  [participantEventId, ids.orgA, ids.sessionA, Number(next.rows[0].sequence), ids.personC, ids.participantC,
    ids.releaseA, JSON.stringify({ observation: "synthetic behavior", directName: "must-not-export" })]);
  await owner.query("UPDATE evidence.session_sequences SET next_sequence=$2 WHERE session_id=$1",
    [ids.sessionA, Number(next.rows[0].sequence) + 1]);
  await recordResearchConsent(app, analyst, ids.sessionA, "PS-520 purpose", "1.0", "granted", randomUUID());
  const analysis = await recordAnalysis(app, analyst, ids.sessionA, {
    layer: "analytical_note", content: { statement: "Synthetic analyst interpretation" },
    sourceReferences: [`evidence.event:${participantEventId}`], confidence: 0.75,
    limitations: "Synthetic evidence only"
  }, randomUUID(), new Date("2026-10-23T11:00:00.000Z"));

  const researchKey = randomUUID();
  const research = await generateSessionReport(app, analyst, ids.sessionA, {
    idempotencyKey: researchKey, reportKind: "research_dataset", format: "json", purposeLabel: "PS-520 purpose"
  }, randomUUID(), new Date("2026-10-23T12:00:00.000Z"));
  const researchBody = JSON.parse(Buffer.from(research.bytes).toString("utf8"));
  assert.equal(researchBody.contractId, "research-export-v1");
  assert.equal(researchBody.observations.some(({ elementId }) => elementId === participantEventId), true);
  assert.equal(researchBody.observations.every(({ sourceReferences }) => sourceReferences.length > 0), true);
  assert.equal(researchBody.derivedMetrics[0].measurementDefinitionVersion, 1);
  assert.equal(researchBody.analyticalNotes[0].elementId, analysis.analysisId);
  assert.deepEqual(researchBody.analyticalNotes[0].sourceReferences, [`evidence.event:${participantEventId}`]);
  assert.deepEqual(researchBody.findings, []);
  const serializedResearch = Buffer.from(research.bytes).toString("utf8");
  assert.equal(serializedResearch.includes(ids.personC), false);
  assert.equal(serializedResearch.includes(ids.participantC), false);
  assert.equal(serializedResearch.includes("must-not-export"), false);
  assert.ok(researchBody.excludedDataClasses.includes("secret_ballot_choices"));
  assert.ok(researchBody.excludedDataClasses.includes("protected_voice_assets"));
  const replayedArtifact = await generateSessionReport(app, analyst, ids.sessionA, {
    idempotencyKey: researchKey, reportKind: "research_dataset", format: "json", purposeLabel: "PS-520 purpose"
  }, randomUUID(), new Date("2026-10-24T12:00:00.000Z"));
  assert.deepEqual([replayedArtifact.artifactId, replayedArtifact.replayed], [research.artifactId, true]);
  await assert.rejects(generateSessionReport(app, analyst, ids.sessionA, {
    idempotencyKey: researchKey, reportKind: "research_dataset", format: "csv", purposeLabel: "PS-520 purpose"
  }, randomUUID()), (error) => error.envelope?.error?.code === "IDEMPOTENCY_COLLISION");

  await recordResearchConsent(app, analyst, ids.sessionA, "PS-520 purpose", "1.0", "withdrawn", randomUUID());
  const afterWithdrawal = await generateSessionReport(app, analyst, ids.sessionA, {
    idempotencyKey: randomUUID(), reportKind: "research_dataset", format: "json", purposeLabel: "PS-520 purpose"
  }, randomUUID());
  assert.equal(JSON.parse(Buffer.from(afterWithdrawal.bytes).toString("utf8")).observations.some(({ elementId }) => elementId === participantEventId), false);

  const firstStandardKey = randomUUID();
  const firstStandard = await generateSessionReport(app, principalD, ids.sessionA, {
    idempotencyKey: firstStandardKey, reportKind: "after_action", format: "json"
  }, randomUUID());
  await owner.query(`INSERT INTO reporting.measurement_definitions
    (id,organization_id,measurement_key,version,research_question,definition,created_by)
    VALUES ($1,$2,'evidence_event_count',2,'Same question, revised validation','{"formula":"count(observations)","validationMethod":"reconciled-v2"}',$3)`,
  [randomUUID(), ids.orgA, ids.personD]);
  const secondStandard = await generateSessionReport(app, principalD, ids.sessionA, {
    idempotencyKey: randomUUID(), reportKind: "after_action", format: "json"
  }, randomUUID());
  const firstBody = JSON.parse(Buffer.from(firstStandard.bytes).toString("utf8"));
  const secondBody = JSON.parse(Buffer.from(secondStandard.bytes).toString("utf8"));
  assert.equal(firstBody.reportDefinition.excludedDataClasses.includes("direct_identity"), false);
  assert.equal(firstBody.derivedMetrics[0].measurementDefinitionVersion, 1);
  assert.equal(secondBody.derivedMetrics[0].measurementDefinitionVersion, 2);
  assert.notEqual(firstStandard.artifactId, secondStandard.artifactId);
  for (const format of ["jsonl", "csv", "html", "pdf", "zip"]) {
    const artifact = await generateSessionReport(app, principalD, ids.sessionA, {
      idempotencyKey: randomUUID(), reportKind: "session_archive", format
    }, randomUUID());
    assert.ok(artifact.bytes.byteLength > 20, `${format} artifact should not be empty`);
  }
  await assert.rejects(generateSessionReport(app, principalE, ids.sessionA, {
    idempotencyKey: randomUUID(), reportKind: "team", format: "json"
  }, randomUUID()), (error) => error.envelope?.error?.code === "PERMISSION_DENIED");

  const policy = await createRetentionPolicy(app, principalD, {
    policyKey: "synthetic-session", version: 1, scopeType: "session", scopeReference: ids.sessionA,
    periodDays: 3650, legalHoldBehavior: "retain", expiryAction: "archive",
    archiveDestination: "institutional-cold-store", approvalRequired: true
  }, randomUUID());
  const correction = await recordCorrection(app, principalD, { targetReference: `report_artifact:${firstStandard.artifactId}`,
    originalValue: { label: "old" }, correctedValue: { label: "corrected" }, reason: "Synthetic correction proof",
    reportsMustRegenerate: true }, randomUUID());
  await assert.rejects(owner.query("UPDATE reporting.corrections SET reason='overwrite' WHERE id=$1", [correction.correctionId]), /append-only/iu);
  assert.equal(policy.version, 1);

  await assert.rejects(placeLegalHold(app, principalE, {
    scopeType: "export", scopeReference: firstStandard.artifactId, reason: "Unauthorized hold"
  }, randomUUID()), (error) => error.envelope?.error?.code === "PERMISSION_DENIED");
  const hold = await placeLegalHold(app, principalD, {
    scopeType: "export", scopeReference: firstStandard.artifactId, reason: "Synthetic litigation hold"
  }, randomUUID());
  const retentionTime = new Date(Date.now() + 91 * 86_400_000);
  await assert.rejects(runRetentionEnforcement(app, ids.orgA, ids.personE, randomUUID(), retentionTime),
    /service actor must be a current Organization Admin/u);
  const held = await runRetentionEnforcement(app, ids.orgA, ids.personD, randomUUID(), retentionTime);
  assert.equal(held.heldArtifacts >= 1, true);
  assert.equal((await owner.query("SELECT bytes IS NOT NULL AS retained FROM reporting.export_artifacts WHERE id=$1",
    [firstStandard.artifactId])).rows[0].retained, true);
  await releaseLegalHold(app, principalD, hold.holdId, "Synthetic matter closed", randomUUID());
  await assert.rejects(releaseLegalHold(app, principalD, hold.holdId, "Duplicate release", randomUUID()),
    (error) => error.envelope?.error?.code === "INVALID_TRANSITION");
  const enforced = await runRetentionEnforcement(app, ids.orgA, ids.personD, randomUUID(), retentionTime);
  assert.equal(enforced.purgedArtifacts >= 1, true);
  const expired = await owner.query(
    "SELECT bytes IS NULL AS purged,purged_by,sha256 FROM reporting.export_artifacts WHERE id=$1", [firstStandard.artifactId]
  );
  assert.deepEqual([expired.rows[0].purged, expired.rows[0].purged_by, expired.rows[0].sha256.length],
    [true, ids.personD, 64]);
  await assert.rejects(generateSessionReport(app, principalD, ids.sessionA, {
    idempotencyKey: firstStandardKey, reportKind: "after_action", format: "json"
  }, randomUUID()), (error) => error.envelope?.error?.code === "NOT_FOUND");
  const retentionAudit = await owner.query(
    "SELECT action FROM evidence.audit_records WHERE organization_id=$1 AND action LIKE 'retention.%' ORDER BY recorded_at,id",
    [ids.orgA]
  );
  assert.ok(retentionAudit.rows.some(({ action }) => action === "retention.enforcement_completed"));

  const matchedReplay = await replaySession(app, principalD, ids.sessionA, { async replay(input) { return structuredClone(input); } }, randomUUID());
  assert.deepEqual([matchedReplay.matched, matchedReplay.divergences.length], [true, 0]);
  const divergedReplay = await replaySession(app, principalD, ids.sessionA, { async replay(input) {
    return { manifest: input.manifest, events: input.events.slice(1) };
  } }, randomUUID());
  assert.equal(divergedReplay.matched, false);
  assert.ok(divergedReplay.divergences.some(({ code }) => code === "event_reordered" || code === "missing_event"));

  const archive = await exportOrganizationArchive(app, principalD, randomUUID(), new Date("2026-10-23T12:00:00.000Z"));
  assert.equal(archive.dataSha256.length, 64);
  assert.equal(archive.data.persons.some(({ id }) => id === ids.personC), true);
  assert.equal(archive.data.analyticalRecords.some(({ id }) => id === analysis.analysisId), true);
  assert.equal(archive.excludedDataClasses.includes("secret_ballot_choices"), true);
  const target = await createCleanArchiveTarget(archive);
  try {
    const imported = await importOrganizationArchive(target.app, principalD, archive, randomUUID());
    assert.equal(imported.replayed, false);
    assert.ok(imported.restoredRows > 0);
    const restoredTables = {
      projects: "studio.simulation_projects", simulationTemplates: "studio.simulation_templates",
      projectCollaborators: "studio.project_collaborators", projectMutationReceipts: "studio.project_mutation_receipts",
      collaborativeDocuments: "studio.collaborative_documents",
      publicationFreezes: "studio.publication_freezes", revisions: "studio.definition_revisions",
      releases: "registry.releases", sessions: "runtime.sessions", sessionAuthorities: "runtime.session_authorities",
      activationReviews: "runtime.release_activation_reviews", activations: "runtime.release_activations",
      participants: "runtime.participants", seatAssignments: "runtime.seat_assignments", artifacts: "runtime.artifact_instances",
      sessionSequences: "evidence.session_sequences", events: "evidence.events", checkpointBatches: "evidence.checkpoint_batches",
      checkpointSignatures: "evidence.checkpoint_signatures", anchorReceipts: "evidence.anchor_receipts",
      reportDefinitions: "reporting.report_definitions", measurementDefinitions: "reporting.measurement_definitions",
      researchConsents: "reporting.research_consents", analyticalRecords: "reporting.analytical_records",
      retentionPolicies: "reporting.retention_policies", legalHoldEvents: "reporting.legal_hold_events",
      corrections: "reporting.corrections",
      exportJobs: "reporting.export_jobs", exportArtifacts: "reporting.export_artifacts"
    };
    for (const [key, table] of Object.entries(restoredTables)) {
      const count = await target.owner.query(`SELECT count(*)::integer AS count FROM ${table} WHERE organization_id=$1`, [ids.orgA]);
      assert.equal(count.rows[0].count, archive.data[key].length, `${key} should be logically restored`);
    }
    const replay = await replaySession(target.app, principalD, ids.sessionA, { async replay(input) { return structuredClone(input); } }, randomUUID());
    assert.equal(replay.matched, true);
    const regenerated = await generateSessionReport(target.app, principalD, ids.sessionA, {
      idempotencyKey: randomUUID(), reportKind: "after_action", format: "json"
    }, randomUUID());
    assert.ok(regenerated.bytes.byteLength > 20);
    const importedAgain = await importOrganizationArchive(target.app, principalD, archive, randomUUID());
    assert.deepEqual([importedAgain.importId, importedAgain.replayed, importedAgain.restoredRows], [imported.importId, true, 0]);
  } finally {
    await target.close();
  }
});

test("PS-400-T02 consumes counted capabilities atomically and applies or cancels pinned delayed effects once", async () => {
  const capabilityId = "ps400-response-team";
  const capabilityInstanceId = randomUUID();
  await owner.query(`INSERT INTO runtime.capability_instances
    (id,organization_id,session_id,governing_release_id,capability_id,scope_reference,state,quantity,version)
    VALUES ($1,$2,$3,$4,$5,'','available',2,1)`,
  [capabilityInstanceId, ids.orgA, ids.sessionA, ids.releaseA, capabilityId]);
  const source = (commandId, rationale) => ({ type: "workflow", reference: "ps400-capability-test", commandId,
    actorPersonId: ids.personA, rationale });
  const consumed = await applyCapabilityQuantityChange(owner, {
    organizationId: ids.orgA, sessionId: ids.sessionA, governingReleaseId: ids.releaseA
  }, { capabilityId, operation: "consume", amount: 1, maximumQuantity: 3 }, source(randomUUID(), "Use one response team"));
  assert.deepEqual({ previous: consumed.previousValue, next: consumed.newValue, operation: consumed.operation },
    { previous: 2, next: 1, operation: "consume" });
  await assert.rejects(applyCapabilityQuantityChange(owner, {
    organizationId: ids.orgA, sessionId: ids.sessionA, governingReleaseId: ids.releaseA
  }, { capabilityId, operation: "consume", amount: 2, maximumQuantity: 3 }, source(randomUUID(), "Over-consume")), /insufficient/u);

  const stateVariableId = "ps400-delayed-risk";
  const stateValueId = randomUUID();
  await owner.query(`INSERT INTO runtime.state_values
    (id,organization_id,session_id,governing_release_id,state_variable_id,scope_reference,value,version)
    VALUES ($1,$2,$3,$4,$5,'','0'::jsonb,1)`, [stateValueId, ids.orgA, ids.sessionA, ids.releaseA, stateVariableId]);
  const scheduledId = await scheduleStateValueChange(owner, {
    organizationId: ids.orgA, sessionId: ids.sessionA, governingReleaseId: ids.releaseA
  }, { stateVariableId, operation: "increment", value: 5, delaySeconds: 30 }, 0,
  source(randomUUID(), "Apply a one-shot delayed increase"));
  await owner.query("UPDATE runtime.scheduled_state_effects SET due_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [scheduledId]);
  assert.equal((await applyDueStateValueChanges(owner, { organizationId: ids.orgA, sessionId: ids.sessionA })).length, 1);
  assert.equal((await applyDueStateValueChanges(owner, { organizationId: ids.orgA, sessionId: ids.sessionA })).length, 0);
  assert.equal((await owner.query("SELECT value FROM runtime.state_values WHERE id=$1", [stateValueId])).rows[0].value, 5);

  const cancelledId = await scheduleStateValueChange(owner, {
    organizationId: ids.orgA, sessionId: ids.sessionA, governingReleaseId: ids.releaseA
  }, { stateVariableId, operation: "increment", value: 9, delaySeconds: 60 }, 0,
  source(randomUUID(), "Cancel before due"));
  assert.equal(await cancelScheduledStateValueChange(owner, { organizationId: ids.orgA, sessionId: ids.sessionA }, cancelledId), true);
  assert.equal((await owner.query("SELECT status,governing_release_id FROM runtime.scheduled_state_effects WHERE id=$1", [cancelledId])).rows[0].status, "cancelled");
});

test("PS-410-T02 preserves reviewer inputs, denies direct publication, and accepts one competing synthesis", async () => {
  const requestId = "26000000-0000-4000-8000-000000000001";
  const actionA = "26000000-0000-4000-8000-000000000002";
  const actionB = "26000000-0000-4000-8000-000000000003";
  const nonAction = "26000000-0000-4000-8000-000000000018";
  const invalidRequestId = "26000000-0000-4000-8000-000000000019";
  const revisionId = "26000000-0000-4000-8000-000000000004";
  const releaseId = "26000000-0000-4000-8000-000000000005";
  const reviewerAssignmentId = "26000000-0000-4000-8000-000000000006";
  const outsiderParticipantId = "26000000-0000-4000-8000-000000000007";
  const outsiderAssignmentId = "26000000-0000-4000-8000-000000000008";
  const outsiderDeviceId = "26000000-0000-4000-8000-000000000009";
  const adjudicationDefinition = { coreDesign: {
    adjudicationModels: [{ id: "rules-resolution", name: "Rules resolution", mechanism: "rules",
      appliesToArtifactTypeIds: ["action"],
      reviewerSessionRoleIds: ["ps410-reviewer"], leadReviewerSessionRoleIds: ["ps410-reviewer"],
      perspectives: [{ id: "operational", label: "Operational", reviewerSessionRoleIds: ["ps410-reviewer"] }],
      rules: [{ id: "ready", label: "Both Actions are ready", when: { operator: "all", conditions: [
        { fact: "actions.ready", operator: "equals", value: true }
      ] }, outcome: "accept" }], publicationScope: { public: true } }],
    artifactTypes: [{ id: "action", key: "action", decisionBearing: true }], stateVariables: []
  }, scenario: {} };
  await owner.query(`INSERT INTO studio.definition_revisions
    (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
    VALUES ($1,$2,$3,$4::jsonb,repeat('c',64),'ps-410',$5)`,
    [revisionId, ids.orgA, ids.projectA, JSON.stringify(adjudicationDefinition), ids.personA]);
  await owner.query(`INSERT INTO registry.releases
    (id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,
     compiler_version,package_sha256,blob_key,published_by)
    VALUES ($1,$2,$3,$4,99,'PS-410 fixture','1','1',repeat('d',64),'ps410',$5)`,
    [releaseId, ids.orgA, ids.projectA, revisionId, ids.personA]);
  await owner.query(`INSERT INTO runtime.release_activations
    (id,organization_id,project_id,session_id,release_id,previous_activation_id,activation_sequence,compatibility_policy,approved_by)
    SELECT gen_random_uuid(),organization_id,project_id,session_id,$1,id,activation_sequence+1,'{}'::jsonb,$2
      FROM runtime.release_activations WHERE organization_id=$3 AND session_id=$4 ORDER BY activation_sequence DESC LIMIT 1`,
    [releaseId, ids.personA, ids.orgA, ids.sessionA]);
  await owner.query(`INSERT INTO runtime.seat_assignments
    (id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
    VALUES ($1,$2,$3,$4,'ps410-reviewer','ps410-reviewer-seat',$5)`,
    [reviewerAssignmentId, ids.orgA, ids.sessionA, ids.participantA, ids.personA]);
  await owner.query("INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES ($1,$2,$3,$4)",
    [outsiderParticipantId, ids.orgA, ids.sessionA, ids.personE]);
  await owner.query("INSERT INTO runtime.participant_access_revisions(organization_id,session_id,participant_id) VALUES ($1,$2,$3)",
    [ids.orgA, ids.sessionA, outsiderParticipantId]);
  await owner.query("INSERT INTO runtime.seat_assignments(id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by) VALUES ($1,$2,$3,$4,'ps410-outsider','ps410-outsider-seat',$5)",
    [outsiderAssignmentId, ids.orgA, ids.sessionA, outsiderParticipantId, ids.personA]);
  await owner.query("INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3)",
    [outsiderDeviceId, ids.orgA, ids.personE]);
  await owner.query(`INSERT INTO runtime.artifact_instances
    (id,organization_id,session_id,governing_release_id,artifact_type_key,workflow_key,form_version,
     creator_participant_id,state,payload,visible_role_ids,version)
    VALUES ($1,$3,$4,$5,'action','action','1',$6,'completed',$7::jsonb,ARRAY['ps410-reviewer'],3),
           ($2,$3,$4,$5,'action','action','1',$6,'completed',$8::jsonb,ARRAY['ps410-reviewer'],2),
           ($9,$3,$4,$5,'note','note','1',$6,'completed',$10::jsonb,ARRAY['ps410-reviewer'],1)`,
    [actionA, actionB, ids.orgA, ids.sessionA, releaseId, ids.participantA,
      JSON.stringify({ title: "Synthetic Action A" }), JSON.stringify({ title: "Synthetic Action B" }), nonAction,
      JSON.stringify({ notes: "Not an Action" })]);
  const context = { principalId: ids.personA, principalType: "person", authenticationSessionId: "unused",
    deviceId: ids.deviceA, organizationId: ids.orgA, sessionId: ids.sessionA, sessionStatus: "active",
    participantId: ids.participantA, seatAssignmentIds: [reviewerAssignmentId], activeSessionRoleId: "ps410-reviewer",
    seatId: "ps410-reviewer-seat", organizationRoles: ["operator"], activeReleaseId: releaseId,
    authenticationStrength: "mfa", featureFlags: [], authorityEpoch: 1, accessRevision: 1 };
  const command = (commandId, operationType, version, payload) => ({ commandId, deviceId: ids.deviceA,
    operationType, aggregateId: requestId, expectedAggregateVersion: version, governingReleaseId: releaseId,
    activeSessionRoleId: "ps410-reviewer", payload });
  const ineligible = await submitRuntimeCommand(app, context, { ...command("26000000-0000-4000-8000-00000000001a",
    "adjudication.request", 0, { modelId: "rules-resolution", actionIds: [nonAction] }), aggregateId: invalidRequestId },
    randomUUID(), ids.deploymentA);
  assert.deepEqual([ineligible.status, ineligible.errorCode], ["rejected", "REFERENCE_INVALID"]);
  const requested = await submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-000000000010",
    "adjudication.request", 0, { modelId: "rules-resolution", actionIds: [actionA, actionB] }), randomUUID(), ids.deploymentA);
  assert.equal(requested.status, "accepted");
  const directPublish = await submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-000000000011",
    "adjudication.publish", 1, {}), randomUUID(), ids.deploymentA);
  assert.deepEqual([directPublish.status, directPublish.errorCode], ["rejected", "INVALID_TRANSITION"]);

  await owner.query("UPDATE runtime.artifact_instances SET creator_participant_id=$1,visible_role_ids='{}' WHERE id=ANY($2::uuid[])",
    [outsiderParticipantId, [actionA, actionB]]);
  assert.deepEqual(await getAdjudications(app, context), []);
  const policyDenied = await submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-00000000001c",
    "adjudication.review", 1, { perspectiveId: "operational", recommendation: "approve", rationale: "No current evidence access",
      confidence: 0.8, evidenceArtifactIds: [actionA] }), randomUUID(), ids.deploymentA);
  assert.deepEqual([policyDenied.status, policyDenied.errorCode], ["rejected", "PERMISSION_DENIED"]);
  await owner.query("UPDATE runtime.artifact_instances SET creator_participant_id=$1,visible_role_ids=ARRAY['ps410-reviewer'] WHERE id=ANY($2::uuid[])",
    [ids.participantA, [actionA, actionB]]);

  const hiddenContext = { ...context, principalId: ids.personE, participantId: outsiderParticipantId,
    deviceId: outsiderDeviceId, seatAssignmentIds: [outsiderAssignmentId], seatId: "ps410-outsider-seat", activeSessionRoleId: "ps410-outsider",
    organizationRoles: [] };
  assert.deepEqual(await getAdjudications(app, hiddenContext), []);
  const reviewed = await submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-000000000012",
    "adjudication.review", 1, { perspectiveId: "operational", recommendation: "approve", rationale: "Evidence supports approval",
      hiddenAnalyticalNotes: "Restricted reviewer note", confidence: 0.8, evidenceArtifactIds: [actionA] }), randomUUID(), ids.deploymentA);
  assert.equal(reviewed.status, "accepted");
  const duplicateReview = await submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-00000000001b",
    "adjudication.review", 2, { perspectiveId: "operational", recommendation: "approve", rationale: "Duplicate review",
      confidence: 0.8, evidenceArtifactIds: [actionA] }), randomUUID(), ids.deploymentA);
  assert.deepEqual([duplicateReview.status, duplicateReview.errorCode], ["rejected", "CONFLICT"]);

  const draftPayload = { outcome: "reject", rationale: "Lead judgment", participantRationale: "The Actions require revision",
    synthesis: "The review was considered separately", confidence: 0.7, overrideRationale: "New control information supersedes the rule",
    effects: [], facts: { "actions.ready": true }, rubricScores: {}, pluginProposalIds: [] };
  const malformedEffect = await submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-000000000017",
    "adjudication.draft", 2, { ...draftPayload, effects: [{ operation: "execute", value: "unbounded" }] }), randomUUID(), ids.deploymentA);
  assert.deepEqual([malformedEffect.status, malformedEffect.errorCode], ["rejected", "VALIDATION_FAILED"]);
  const competing = await Promise.all([
    submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-000000000013", "adjudication.draft", 2, draftPayload), randomUUID(), ids.deploymentA),
    submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-000000000014", "adjudication.draft", 2, { ...draftPayload, outcome: "accept" }), randomUUID(), ids.deploymentA)
  ]);
  assert.equal(competing.filter(({ status }) => status === "accepted").length, 1);
  assert.equal(competing.filter(({ status }) => status === "needs_reconciliation").length, 1);
  const workspace = await getAdjudications(app, context);
  assert.equal(workspace[0].actionSnapshots.length, 2);
  assert.equal(workspace[0].reviews[0].hiddenAnalyticalNotes, "Restricted reviewer note");
  assert.ok(workspace[0].record.explanationTrace.some(({ source }) => source === "rule"));

  const denied = await submitRuntimeCommand(app, hiddenContext, { ...command("26000000-0000-4000-8000-000000000015",
    "adjudication.publish", 3, {}), deviceId: outsiderDeviceId, activeSessionRoleId: "ps410-outsider" }, randomUUID(), ids.deploymentA);
  assert.deepEqual([denied.status, denied.errorCode], ["rejected", "PERMISSION_DENIED"]);
  const published = await submitRuntimeCommand(app, context, command("26000000-0000-4000-8000-000000000016",
    "adjudication.publish", 3, {}), randomUUID(), ids.deploymentA);
  assert.equal(published.status, "accepted");
  const participantView = await getAdjudications(app, hiddenContext);
  assert.equal(participantView.length, 1);
  assert.deepEqual(participantView[0].reviews, []);
  assert.equal(participantView[0].record.rationale, participantView[0].record.participantRationale);
  assert.deepEqual(participantView[0].record.explanationTrace, []);
  assert.equal(participantView[0].record.suggestion, null);
  const delivery = await owner.query(`SELECT released_at,delivered_at,viewed_at FROM runtime.adjudication_deliveries
    WHERE adjudication_record_id=$1 AND recipient_participant_id=$2`, [participantView[0].record.id, outsiderParticipantId]);
  assert.equal(delivery.rowCount, 1);
  assert.ok(delivery.rows[0].released_at instanceof Date && delivery.rows[0].delivered_at instanceof Date);
  assert.ok(delivery.rows[0].released_at < delivery.rows[0].delivered_at);
  assert.equal(delivery.rows[0].viewed_at, null);
});

test("AC-07/AC-11 SYNC-09 EXT-15 activates reviewed Releases without rewriting live history", async () => {
  const current = await owner.query(`SELECT activation.release_id,activation.activation_sequence,revision.snapshot
    FROM runtime.release_activations activation
    JOIN registry.releases release ON release.id=activation.release_id
    JOIN studio.definition_revisions revision ON revision.id=release.definition_revision_id
    WHERE activation.organization_id=$1 AND activation.session_id=$2
    ORDER BY activation.activation_sequence DESC LIMIT 1`, [ids.orgA, ids.sessionA]);
  const currentReleaseId = current.rows[0].release_id;
  const candidateRevisionId = "27000000-0000-4000-8000-000000000001";
  const candidateReleaseId = "27000000-0000-4000-8000-000000000002";
  const openPollId = "27000000-0000-4000-8000-000000000003";
  const compositionId = "27000000-0000-4000-8000-000000000004";
  const candidate = structuredClone(current.rows[0].snapshot);
  candidate.coreDesign.adjudicationModels[0].name = "Updated rules resolution";
  const snapshotDigest = createHash("sha256").update(JSON.stringify(candidate)).digest("hex");
  await owner.query(`INSERT INTO studio.definition_revisions
    (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
    VALUES ($1,$2,$3,$4::jsonb,$5,'ps-420',$6)`,
    [candidateRevisionId, ids.orgA, ids.projectA, JSON.stringify(candidate), snapshotDigest, ids.personA]);
  await owner.query(`INSERT INTO registry.releases
    (id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,
     compiler_version,package_sha256,blob_key,published_by)
    VALUES ($1,$2,$3,$4,100,'PS-420 fixture','1','1',repeat('e',64),'ps420',$5)`,
    [candidateReleaseId, ids.orgA, ids.projectA, candidateRevisionId, ids.personA]);
  await owner.query(`INSERT INTO runtime.session_operators(organization_id,session_id,person_id,assigned_by)
    VALUES ($1,$2,$3,$3) ON CONFLICT (organization_id,session_id,person_id) DO UPDATE SET revoked_at=NULL`,
    [ids.orgA, ids.sessionA, ids.personA]);
  await owner.query(`INSERT INTO voting.polls
    (id,organization_id,session_id,governing_release_id,definition_id,definition_revision,definition,
     definition_sha256,status,opened_at,version,authority_epoch,created_by)
    VALUES ($1,$2,$3,$4,'ps420-open-poll',1,'{}'::jsonb,repeat('f',64),'open',now(),1,1,$5)`,
    [openPollId, ids.orgA, ids.sessionA, currentReleaseId, ids.personA]);
  await owner.query(`INSERT INTO extension.composition_runs
    (id,organization_id,session_id,governing_release_id,trigger_command_id,graph_digest,input_snapshot_id,
     input_snapshot,input_digest,execution_policy,authority_epoch,status,correlation_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'{}'::jsonb,$8,'{}'::jsonb,1,'running',$9)`,
    [compositionId, ids.orgA, ids.sessionA, currentReleaseId, randomUUID(), `sha256:${"a".repeat(64)}`,
      randomUUID(), `sha256:${"b".repeat(64)}`, randomUUID()]);

  const impact = await getReleaseImpact(app, principal, ids.sessionA, candidateReleaseId, randomUUID());
  assert.equal(impact.report.classification, "consequential");
  assert.equal(impact.report.requiresImpactReview, true);
  assert.deepEqual(impact.report.blockedReasons, []);
  assert.ok(impact.existingWorkflows.some(({ governing_release_id }) => governing_release_id === currentReleaseId));
  assert.equal(impact.openPolls.some(({ id }) => id === openPollId), true);
  assert.equal(impact.inFlightCompositions.some(({ id }) => id === compositionId), true);
  await assert.rejects(reviewReleaseImpact(app, principal, ids.sessionA, {
    candidateReleaseId, reportDigest: impact.reportDigest, existingInstanceHandling: "keep_existing"
  }, randomUUID()), (error) => error.envelope?.error?.code === "PERMISSION_DENIED");
  const review = await reviewReleaseImpact(app, principalF, ids.sessionA, {
    candidateReleaseId, reportDigest: impact.reportDigest, existingInstanceHandling: "keep_existing"
  }, randomUUID());
  const context = await resolvePrincipalCommandContext(app, principal, ids.sessionA, ids.deviceA, randomUUID());
  const command = {
    commandId: "27000000-0000-4000-8000-000000000010",
    deviceId: ids.deviceA,
    operationType: "release.activate",
    aggregateId: ids.sessionA,
    expectedAggregateVersion: impact.activationSequence,
    governingReleaseId: currentReleaseId,
    payload: { candidateReleaseId, impactReviewId: review.impactReviewId,
      reportDigest: impact.reportDigest, existingInstanceHandling: "keep_existing" }
  };
  const activated = await activateRelease(app, principal, context, command, randomUUID(), ids.deploymentA);
  assert.deepEqual([activated.status, activated.aggregateVersion], ["accepted", impact.activationSequence + 1]);
  const replay = await activateRelease(app, principal, context, command, randomUUID(), ids.deploymentA);
  assert.equal(replay.replayed, true);
  const stale = await activateRelease(app, principal, context, { ...command,
    commandId: "27000000-0000-4000-8000-000000000011" }, randomUUID(), ids.deploymentA);
  assert.deepEqual([stale.status, stale.errorCode], ["needs_reconciliation", "INCOMPATIBLE_RELEASE"]);

  const history = await getReleaseHistory(app, principal, ids.sessionA, randomUUID());
  assert.equal(history.activeReleaseId, candidateReleaseId);
  assert.equal(history.activations.at(-1).impactReviewId, review.impactReviewId);
  const pinned = await owner.query(`SELECT
    (SELECT governing_release_id FROM voting.polls WHERE id=$1) AS poll_release,
    (SELECT governing_release_id FROM extension.composition_runs WHERE id=$2) AS composition_release,
    (SELECT count(*)::int FROM runtime.artifact_instances WHERE session_id=$3 AND governing_release_id=$4) AS workflow_count`,
    [openPollId, compositionId, ids.sessionA, currentReleaseId]);
  assert.equal(pinned.rows[0].poll_release, currentReleaseId);
  assert.equal(pinned.rows[0].composition_release, currentReleaseId);
  assert.ok(pinned.rows[0].workflow_count > 0);
  const evidence = await owner.query(`SELECT event_type,body->>'toReleaseId' AS to_release_id
    FROM evidence.events WHERE session_id=$1 AND command_id=$2`, [ids.sessionA, command.commandId]);
  assert.deepEqual(evidence.rows[0], { event_type: "release.activated", to_release_id: candidateReleaseId });
  await assert.rejects(owner.query("UPDATE runtime.release_activation_reviews SET report='{}'::jsonb WHERE id=$1",
    [review.impactReviewId]), /append-only/iu);
});

test("SYNC-13 creates, anchors, exports, and independently verifies a due Evidence checkpoint", async () => {
  const pair = generateKeyPairSync("ed25519");
  const publicKeyJwk = pair.publicKey.export({ format: "jwk" });
  let anchorInput;
  const checkpoint = await createDueEvidenceCheckpoint(app, ids.orgA, ids.sessionA, {
    async signCheckpoint(input) {
      return {
        keyId: "kms/evidence/integration-1",
        algorithm: "Ed25519",
        signature: signBytes(null, input.digestBytes, pair.privateKey),
        publicKeyJwk
      };
    }
  }, {
    async anchorCheckpoint(input) {
      anchorInput = input;
      return {
        endpoint: "integration-custodian",
        reference: `integration-custodian/${input.checkpointId}`,
        anchoredDigest: input.checkpointDigest,
        verificationResult: "verified",
        recordedAt: new Date()
      };
    }
  }, new Date(Date.now() + 6 * 60 * 1_000));
  assert.ok(checkpoint);
  assert.deepEqual(Object.keys(anchorInput).sort(), [
    "checkpointCreatedAt", "checkpointDigest", "checkpointId", "firstSequence", "idempotencyKey",
    "keyId", "lastSequence", "sessionId"
  ]);
  assert.equal(await createDueEvidenceCheckpoint(app, ids.orgA, ids.sessionA, {
    async signCheckpoint() { throw new Error("No second signature expected"); }
  }, {
    async anchorCheckpoint() { throw new Error("No second anchor expected"); }
  }, new Date(Date.now() + 12 * 60 * 1_000)), null);

  const exported = await exportEvidenceVerification(app, principalD, ids.sessionA, randomUUID());
  await assert.rejects(
    exportEvidenceVerification(app, principalE, ids.sessionA, randomUUID()),
    (error) => error.envelope?.error?.code === "PERMISSION_DENIED"
  );
  assert.equal(exported.checkpoints.length, 1);
  assert.equal("body" in exported.checkpoints[0].events[0], false);
  const receipt = exported.checkpoints[0].anchorReceipts[0];
  assert.deepEqual(verifyEvidenceExport(exported, { "kms/evidence/integration-1": publicKeyJwk }, [{
    endpoint: receipt.endpoint,
    reference: receipt.reference,
    anchoredDigest: receipt.anchoredDigest,
    keyId: receipt.keyId
  }]), { verified: true, issues: [] });

  await owner.query(`INSERT INTO evidence.events
    (id,organization_id,session_id,sequence,event_type,event_version,governing_release_id,authority_epoch,body)
    VALUES (gen_random_uuid(),$1,$2,1,'checkpoint.tested',1,$3,1,'{}'::jsonb)`, [ids.orgB, ids.sessionB, ids.releaseB]);
  await owner.query("UPDATE evidence.session_sequences SET next_sequence=2 WHERE session_id=$1", [ids.sessionB]);
  await assert.rejects(createDueEvidenceCheckpoint(app, ids.orgB, ids.sessionB, {
    async signCheckpoint(input) {
      return { keyId: "kms/evidence/failure-test", algorithm: "Ed25519",
        signature: signBytes(null, input.digestBytes, pair.privateKey), publicKeyJwk };
    }
  }, {
    async anchorCheckpoint() { throw new Error("synthetic custodian outage"); }
  }, new Date(Date.now() + 6 * 60 * 1_000)), /custodian outage/iu);
  assert.equal((await owner.query("SELECT count(*) FROM evidence.checkpoint_batches WHERE session_id=$1", [ids.sessionB])).rows[0].count, "0");
});
