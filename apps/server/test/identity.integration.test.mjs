import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Pool } from "pg";

import {
  createOfflinePluginBundle,
  createPluginRevocations,
  pluginDigest
} from "@plenum/plugin-sdk";

import {
  beginOidcLogin,
  acceptPluginLicense,
  approvePluginArtifact,
  authorizePluginRun,
  bindPluginInstallation,
  completeOidcLogin,
  createDatabasePool,
  exportReleasePackage,
  getOperatorProjection,
  getRuntimeDeltas,
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
  resolveSessionAccessContext,
  revokeAuthenticationSession,
  revokePluginArtifact,
  submitPluginArtifact,
  verifyImportedPackage,
  withOrganizationTransaction
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

async function applyMigrations() {
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
    "apps/server/migrations/011_extension_registry.sql"
  ]) {
    await owner.query(await readFile(new URL(`../../../${path}`, import.meta.url), "utf8"));
  }
}

async function seed() {
  const client = await owner.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'Org A'),($2,'Org B')", [ids.orgA, ids.orgB]);
    await client.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'Operator A'),($2,'Operator B'),($3,'Participant C'),($4,'Approver D')", [ids.personA, ids.personB, ids.personC, ids.personD]);
    await client.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'operator'),($3,$4,'operator'),($3,$4,'publisher'),($3,$5,'admin'),($3,$5,'designer'),($3,$6,'admin')", [ids.orgA, ids.personA, ids.orgB, ids.personB, ids.personC, ids.personD]);
    await client.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'Project A',$3),($4,$5,'Project B',$6)", [ids.projectA, ids.orgA, ids.personA, ids.projectB, ids.orgB, ids.personB]);
    await client.query(
      "INSERT INTO studio.drafts(id,organization_id,project_id,document,updated_by) VALUES (gen_random_uuid(),$1,$2,$3::jsonb,$4)",
      [ids.orgB, ids.projectB, JSON.stringify(releaseMaterialization), ids.personB]
    );
    await client.query(`INSERT INTO studio.definition_revisions
      (id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
      VALUES ($1,$2,$3,'{}',repeat('a',64),'v1',$4),($5,$6,$7,'{}',repeat('b',64),'v1',$8)`,
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

test("Game Master projection requires Operator authorization and remains tenant/Session scoped", async () => {
  const projection = await getOperatorProjection(
    app, principal, ids.sessionA, "e0000000-0000-4000-8000-000000000010"
  );
  assert.equal(projection.sessionId, ids.sessionA);
  assert.equal(projection.releaseId, ids.releaseA);

  await assert.rejects(
    getOperatorProjection(
      app, { ...principal, organizationId: ids.orgB, principalId: ids.personB }, ids.sessionA,
      "e0000000-0000-4000-8000-000000000011"
    ),
    (error) => error?.envelope?.error?.code === "NOT_FOUND"
  );
  await assert.rejects(
    getOperatorProjection(
      app, { ...principal, organizationRoles: [] }, ids.sessionA,
      "e0000000-0000-4000-8000-000000000012"
    ),
    (error) => error?.envelope?.error?.code === "PERMISSION_DENIED"
  );
});

test("AC-10/AC-13 SYNC-05/06/07/12 DB-02/04 command outcomes stay atomic", async () => {
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
       (SELECT count(*) FROM evidence.audit_records WHERE action='participant.reassigned') audits,
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
