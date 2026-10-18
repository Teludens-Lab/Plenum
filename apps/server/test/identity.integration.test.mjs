import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Pool } from "pg";

import {
  beginOidcLogin,
  completeOidcLogin,
  createDatabasePool,
  reassignParticipant,
  resolveSessionAccessContext,
  revokeAuthenticationSession,
  withOrganizationTransaction
} from "../dist/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for PS-110 integration tests");

const ids = {
  orgA: "10000000-0000-4000-8000-000000000001",
  orgB: "10000000-0000-4000-8000-000000000002",
  personA: "20000000-0000-4000-8000-000000000001",
  personB: "20000000-0000-4000-8000-000000000002",
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
  assignmentA: "80000000-0000-4000-8000-000000000001",
  assignmentB: "80000000-0000-4000-8000-000000000002",
  deviceA: "90000000-0000-4000-8000-000000000001",
  deploymentA: "a0000000-0000-4000-8000-000000000001",
  deploymentB: "a0000000-0000-4000-8000-000000000002"
};

const owner = new Pool({ connectionString: databaseUrl, max: 1 });
const app = createDatabasePool(databaseUrl);
let principal;

async function applyMigrations() {
  for (const path of [
    "references/plenum-runtime-slice/migrations/001_core.sql",
    "references/plenum-runtime-slice/migrations/002_runtime_sync_evidence.sql",
    "references/plenum-runtime-slice/migrations/003_collaboration.sql",
    "references/plenum-runtime-slice/migrations/004_security.sql",
    "apps/server/migrations/005_identity_oidc_context.sql"
  ]) {
    await owner.query(await readFile(new URL(`../../../${path}`, import.meta.url), "utf8"));
  }
}

async function seed() {
  const client = await owner.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'Org A'),($2,'Org B')", [ids.orgA, ids.orgB]);
    await client.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'Operator A'),($2,'Operator B')", [ids.personA, ids.personB]);
    await client.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'operator'),($3,$4,'operator')", [ids.orgA, ids.personA, ids.orgB, ids.personB]);
    await client.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'Project A',$3),($4,$5,'Project B',$6)", [ids.projectA, ids.orgA, ids.personA, ids.projectB, ids.orgB, ids.personB]);
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
    await client.query("INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)", [ids.participantA, ids.orgA, ids.sessionA, ids.personA, ids.participantB, ids.orgB, ids.sessionB, ids.personB]);
    await client.query("INSERT INTO runtime.seat_assignments(id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by) VALUES ($1,$2,$3,$4,'role-a','seat-a',$5),($6,$7,$8,$9,'role-b','seat-b',$10)", [ids.assignmentA, ids.orgA, ids.sessionA, ids.participantA, ids.personA, ids.assignmentB, ids.orgB, ids.sessionB, ids.participantB, ids.personB]);
    await client.query("INSERT INTO runtime.participant_access_revisions(organization_id,session_id,participant_id) VALUES ($1,$2,$3),($4,$5,$6)", [ids.orgA, ids.sessionA, ids.participantA, ids.orgB, ids.sessionB, ids.participantB]);
    await client.query("INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3)", [ids.deviceA, ids.orgA, ids.personA]);
    await client.query("INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2),($3,$4)", [ids.sessionA, ids.orgA, ids.sessionB, ids.orgB]);
    await client.query("INSERT INTO identity.federated_identities(id,organization_id,person_id,issuer,subject,provider_type) VALUES ('c0000000-0000-4000-8000-000000000001',$1,$2,'https://issuer.example','operator-a','oidc')", [ids.orgA, ids.personA]);
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
});

after(async () => {
  await app.end();
  await owner.end();
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

test("PS-110-T03 resolves context and commits reassignment atomically", async () => {
  const context = await withOrganizationTransaction(app, ids.orgA, (client) =>
    resolveSessionAccessContext(client, principal, {
      sessionId: ids.sessionA,
      deviceId: ids.deviceA,
      correlationId: "e0000000-0000-4000-8000-000000000002"
    }));
  assert.equal(context.organizationId, ids.orgA);
  assert.equal(context.activeSessionRoleId, "role-a");

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
  const receipt = await reassignParticipant(app, context, command, "e0000000-0000-4000-8000-000000000003");
  assert.equal(receipt.accessRevision, 2);
  assert.equal(receipt.replayed, false);
  const replay = await reassignParticipant(app, context, command, "e0000000-0000-4000-8000-000000000003");
  assert.equal(replay.replayed, true);

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

  await owner.query(
    `CREATE FUNCTION evidence.fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN IF NEW.action='participant.reassigned' THEN RAISE EXCEPTION 'forced audit failure'; END IF; RETURN NEW; END $$;
     CREATE TRIGGER fail_test_audit BEFORE INSERT ON evidence.audit_records
       FOR EACH ROW EXECUTE FUNCTION evidence.fail_test_audit()`
  );
  await assert.rejects(
    reassignParticipant(app, { ...context, activeSessionRoleId: "role-c", accessRevision: 2 }, {
      ...command,
      commandId: "f0000000-0000-4000-8000-000000000002",
      expectedAggregateVersion: 2,
      activeSessionRoleId: "role-c",
      payload: { previousSeatAssignmentId: receipt.seatAssignmentId, newSessionRoleId: "role-d", newSeatId: "seat-d", reason: "Force rollback" }
    }, "e0000000-0000-4000-8000-000000000004"),
    /forced audit failure/
  );
  const rolledBack = await owner.query(
    `SELECT
       (SELECT count(*) FROM runtime.seat_assignments WHERE participant_id=$1 AND valid_to IS NULL) active,
       (SELECT access_revision FROM runtime.participant_access_revisions WHERE participant_id=$1) revision,
       (SELECT count(*) FROM evidence.events WHERE session_id=$2 AND event_type='seat_assignment.changed') events`,
    [ids.participantA, ids.sessionA]
  );
  assert.deepEqual(rolledBack.rows[0], { active: "1", revision: "2", events: "1" });
  await owner.query("DROP TRIGGER fail_test_audit ON evidence.audit_records; DROP FUNCTION evidence.fail_test_audit() ");
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
});
