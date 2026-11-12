import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { S3Client, CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { canonicalizeJson } from "@plenum/event-contracts";
import { PINNED_EXTENSION_HOST_IMAGE, verifyHostRequest } from "@plenum/extension-host";
import { signedEffectFixture } from "../../../packages/extension-host/fixtures/signed-effect.mjs";
import { createProductionExtensionRuntime, resolveReleaseModelPlan, createModelRunWorker, createRuntimeHttpHandler,
  S3ObjectStore, withOrganizationTransaction, ensureBootstrapJobBinding } from "../dist/index.js";

const hash = value => `sha256:${createHash("sha256").update(canonicalizeJson(value)).digest("hex")}`;
async function eventually(check, label) {
  const deadline = Date.now() + 15000;
  while (!await check()) { assert.ok(Date.now() < deadline, label); await delay(30); }
}

// Real HTTP/PostgreSQL/S3 with a deterministic transport double. This is NOT deployed isolation proof.
export async function verifyGovernedModelRuns(owner, app, production = false) {
  if (production && (process.platform !== "linux" || !process.env.PLENUM_TEST_EXTENSION_SOCKET)) throw new Error("A qualifying Linux supervisor socket is required");
  const f = Object.fromEntries(["org", "person", "token", "project", "revision", "release", "session", "participant", "device", "assignment",
    "deployment", "artifact", "installation", "binding", "trust", "state", "effect"].map(key => [key, randomUUID()]));
  const signed = await signedEffectFixture(), manifest = signed.bundle.manifest;
  const bucket = `ba08-${randomUUID()}`, key = `plugins/${manifest.pluginId}/1.0.0/${signed.bundleDigest.slice(7)}.json`;
  const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: "us-east-1", forcePathStyle: true,
    credentials: { accessKeyId: "synthetic", secretAccessKey: "synthetic" } });
  const store = new S3ObjectStore(s3, bucket);
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  await store.putImmutable(key, signed.bytes, signed.bundleDigest.slice(7));
  const binding = { id: "binding", installationId: f.installation, pluginId: manifest.pluginId, pluginVersion: manifest.version,
    pluginDigest: manifest.digest, connectivity: "offline_capable", enabledInProfiles: ["cloud"], timeoutSeconds: 5, configuration: {}, configurationDigest: hash({}),
    inputMappings: [{ source: "state.synthetic_risk", target: "pressure" }, { source: "state.effect_id", target: "effectId" },
      { source: "state.target_id", target: "targetAggregateId" }] };
  const port = id => ({ id, label: id, dataType: "effect_proposal", unit: "", classification: "internal", carriesEffectProposals: true });
  const composition = { contractId: "composition-definition-v1", id: "governed", name: "Synthetic governed model", version: "1",
    executionPolicy: { seed: 43, triggerSessionRoleIds: ["reviewer"], allowedEffects: [{ stateVariableId: "synthetic_risk", scopeReference: "", operations: ["set"] }] },
    nodes: [{ id: "model", name: "Model", kind: "model", bindingId: "binding", inputPorts: [], outputPorts: [port("effects")] },
      { id: "review", name: "Review", kind: "approval_gate", approverSessionRoleIds: ["reviewer"], inputPorts: [port("effects")], outputPorts: [] }],
    edges: [{ id: "review", fromNodeId: "model", fromPortId: "effects", toNodeId: "review", toPortId: "effects" }], fixtures: [] };
  const core = { teams: [], sessionRoles: [{ id: "reviewer", name: "Reviewer", isControlRole: true }, { id: "viewer", name: "Viewer", isControlRole: false }],
    seats: [{ id: "seat", sessionRoleIds: ["reviewer", "viewer"] }], stages: [], artifactTypes: [],
    informationPolicies: [{ id: "visible", classification: "internal", grants: [{ audience: { public: true } }] },
      { id: "hidden", classification: "restricted", grants: [] }],
    stateVariables: ["synthetic_risk", "effect_id", "target_id"].map(id => ({ id, name: id, scope: "global", type: id === "synthetic_risk" ? "integer" : "string", informationPolicyId: "visible", historyMode: "full" })),
    communications: { messageChannels: [], routes: [] }, pluginBindings: [binding], compositions: [composition] };
  core.stateVariables.push({ id: "secret", name: "Hidden", scope: "global", type: "string", informationPolicyId: "hidden", historyMode: "full" });
  core.pluginBindings.push({ ...binding, id: "hidden-binding", inputMappings: [{ source: "state.secret", target: "pressure" }] });
  core.compositions.push({ ...structuredClone(composition), id: "hidden-plan", nodes: composition.nodes.map(node => node.kind === "model" ? { ...node, bindingId: "hidden-binding" } : node) });
  await owner.query("INSERT INTO identity.organizations(id,name) VALUES ($1,'BA-08 synthetic')", [f.org]);
  await owner.query("INSERT INTO identity.persons(id,display_name) VALUES ($1,'BA-08 synthetic actor')", [f.person]);
  await owner.query("INSERT INTO identity.memberships(organization_id,person_id,organization_role) VALUES ($1,$2,'admin'),($1,$2,'operator')", [f.org, f.person]);
  await owner.query(`INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at)
    VALUES ($1,$2,$3,'https://ba08.invalid','synthetic','mfa',now()+interval '1 day')`, [f.token, f.org, f.person]);
  await owner.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'BA-08 synthetic',$3)", [f.project, f.org, f.person]);
  await owner.query(`INSERT INTO studio.definition_revisions(id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
    VALUES ($1,$2,$3,$4,repeat('a',64),'v1',$5)`, [f.revision, f.org, f.project, { coreDesign: core, scenario: {} }, f.person]);
  await owner.query(`INSERT INTO registry.releases(id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
    VALUES ($1,$2,$3,$4,1,'BA-08 synthetic','1','1',repeat('a',64),'ba08',$5)`, [f.release, f.org, f.project, f.revision, f.person]);
  await owner.query("INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by) VALUES ($1,$2,$3,$4,'active',$5)", [f.session, f.org, f.project, f.release, f.person]);
  await owner.query("INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status) VALUES ($1,$2,$3,1,'active')", [f.session, f.org, f.deployment]);
  await owner.query(`INSERT INTO runtime.release_activations(id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
    VALUES ($1,$2,$3,$4,$5,1,'{}',$6)`, [randomUUID(), f.org, f.project, f.session, f.release, f.person]);
  await owner.query("INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2)", [f.session, f.org]);
  await owner.query("INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES ($1,$2,$3,$4)", [f.participant, f.org, f.session, f.person]);
  await owner.query(`INSERT INTO runtime.seat_assignments(id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
    VALUES ($1,$2,$3,$4,'reviewer','seat',$5)`, [f.assignment, f.org, f.session, f.participant, f.person]);
  await owner.query("INSERT INTO sync.devices(id,organization_id,person_id) VALUES ($1,$2,$3)", [f.device, f.org, f.person]);
  for (const [id, value] of [["synthetic_risk", 10], ["effect_id", f.effect], ["target_id", f.state]]) await owner.query(`INSERT INTO runtime.state_values
    (id,organization_id,session_id,governing_release_id,state_variable_id,scope_reference,value,version) VALUES ($1,$2,$3,$4,$5,'',$6,1)`,
  [id === "synthetic_risk" ? f.state : randomUUID(), f.org, f.session, f.release, id, JSON.stringify(value)]);
  await owner.query(`INSERT INTO extension.publishers(id,organization_id,principal_id,display_name,signature_key_id,public_key_pem,status,approved_by)
    VALUES ($1,$2,$3,'BA-08 fixture','synthetic',$4,'approved',$3)`, [manifest.publisher.id, f.org, f.person, signed.request.publisherPublicKey]);
  await owner.query(`INSERT INTO extension.trust_roots(id,organization_id,publisher_id,publisher_key_id,publisher_public_key_pem,revocation_key_id,revocation_public_key_pem,provisioned_by)
    VALUES ($1,$2,$3,'synthetic',$4,'synthetic',$4,$5)`, [f.trust, f.org, manifest.publisher.id, signed.request.publisherPublicKey, f.person]);
  await owner.query(`INSERT INTO extension.revocation_lists(id,organization_id,publisher_id,trust_root_id,document,document_sha256,generated_at,imported_by)
    VALUES ($1,$2,$3,$4,$5,$6,now(),$7)`, [randomUUID(), f.org, manifest.publisher.id, f.trust,
    { revokedDigests: [], revokedKeyIds: [] }, hash({}), f.person]);
  await owner.query(`INSERT INTO extension.plugin_artifacts(id,organization_id,publisher_id,plugin_id,version,digest,manifest_digest,bundle_digest,object_key,manifest,supply_chain,lifecycle_status,submitted_by,approved_by,approved_at)
    VALUES ($1,$2,$3,$4,'1.0.0',$5,$6,$7,$8,$9,'{}','approved',$10,$10,now())`,
  [f.artifact, f.org, manifest.publisher.id, manifest.pluginId, manifest.digest, signed.manifestDigest, signed.bundleDigest, key, manifest, f.person]);
  await owner.query(`INSERT INTO extension.plugin_installations(id,organization_id,deployment_id,artifact_id,artifact_digest,status,permitted_permissions,installed_by)
    VALUES ($1,$2,$3,$4,$5,'enabled',ARRAY['state_values.read:mapped','effects.propose'],$6)`, [f.installation, f.org, f.deployment, f.artifact, manifest.digest, f.person]);
  await owner.query(`INSERT INTO extension.plugin_bindings(id,organization_id,project_id,definition_revision_id,installation_id,artifact_digest,configuration_digest,deployment_profile,status,bound_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'connected','enabled',$8)`, [f.binding, f.org, f.project, f.revision, f.installation, manifest.digest, hash({}), f.person]);
  await ensureBootstrapJobBinding(app, f.org, f.deployment, f.person);
  const authority = { organizationId: f.org, deploymentId: f.deployment, actorPersonId: f.person, revision: 1 };
  const configured = createProductionExtensionRuntime(app, store, f.deployment, "cloud", "/not-configured.sock");
  assert.equal(await configured.isAvailable(), false);
  let mode = "valid", entered, resume, executions = 0, failures = 0;
  const runtime = { ...configured, isAvailable: async () => true,
    plans: (client, context, plan) => resolveReleaseModelPlan(client, context, plan, f.deployment, "cloud"),
    execute: async artifact => {
      executions++;
      verifyHostRequest({ ...artifact.verifiedBundle, inputs: artifact.inputs });
      assert.deepEqual(Object.keys(artifact.inputs).sort(), ["effectId", "pressure", "seed", "targetAggregateId"]);
      if (mode === "pause") { entered.resolve(); await resume.promise; }
      if (mode === "timeout") throw new Error("Plugin execution timed out");
      const outputs = mode === "invalid" ? {} : { outputs: { syntheticScore: 11 }, effectProposals: [{ effectId: artifact.inputs.effectId,
        targetAggregateId: f.state, targetStateVariableId: "synthetic_risk", scopeReference: "", operation: "set", value: 11, rationale: "Synthetic reviewed result" }] };
      return { outputs, outputDigest: hash(outputs), environmentDigest: `sha256:${createHash("sha256").update(PINNED_EXTENSION_HOST_IMAGE).digest("hex")}`, durationMs: 1 };
    } };
  let worker = createModelRunWorker(app, runtime, () => failures++);
  const principal = { organizationId: f.org, principalId: f.person, authenticationSessionId: f.token, authenticationStrength: "mfa",
    organizationRoles: ["admin", "operator"], expiresAt: new Date(Date.now() + 86400000) };
  const handler = createRuntimeHttpHandler({ pool: app, deploymentId: f.deployment, objectStore: store, extensionRuntime: runtime,
    authenticate: async () => principal });
  const server = createServer((req, res) => void handler(req, res)).listen(0, "127.0.0.1"); await once(server, "listening");
  const portNumber = server.address().port;
  let child, logs = "";
  const launch = async () => {
    child = spawn(process.execPath, ["deploy/compose/profile-service.mjs"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
      NODE_ENV: "production", NODE_TLS_REJECT_UNAUTHORIZED: "1", PORT: String(portNumber), METRICS_PORT: "0",
      PLENUM_DEPLOYMENT_PROFILE: "cloud", PLENUM_PUBLIC_BASE_URL: "https://ba08.invalid", PLENUM_DEPLOYMENT_ID: f.deployment,
      PLENUM_EXTENSION_SOCKET: process.env.PLENUM_TEST_EXTENSION_SOCKET, PLENUM_RETENTION_ACTOR_PERSON_ID: f.person,
      OIDC_ISSUER: "https://ba08.invalid", OIDC_PROVIDER_KEY: "synthetic", OIDC_ORGANIZATION_ID: f.org, OIDC_CLIENT_ID: "synthetic",
      OIDC_REDIRECT_URI: "https://ba08.invalid/auth/callback", S3_BUCKET: bucket, S3_ACCESS_KEY_ID: "synthetic", S3_SECRET_ACCESS_KEY: "synthetic",
      MEDIA_URL: "wss://ba08.invalid", MEDIA_API_KEY: "synthetic", MEDIA_API_SECRET: "synthetic", MEDIA_ADAPTER_DIGEST: hash({}),
      FLOOR_TOKEN_SECRET: "synthetic", INVITATION_DELIVERY_ENDPOINT: "https://ba08.invalid/delivery", INVITATION_DELIVERY_BEARER_TOKEN: "synthetic",
      INVITATION_DELIVERY_WEBHOOK_TOKEN: "synthetic", CONTENT_SCANNER_HOST: "", NOTIFICATIONS_HOSTNAME: "" } });
    child.stdout.on("data", b => { logs = (logs + b).slice(-16000); }); child.stderr.on("data", b => { logs = (logs + b).slice(-16000); });
    await eventually(async () => { assert.equal(child.exitCode, null, logs); return fetch(`http://127.0.0.1:${portNumber}`).then(r => r.ok).catch(() => false); }, "production startup");
  };
  const stopChild = async () => {
    if (!child || child.exitCode !== null) return;
    const exited = once(child, "exit"); child.kill("SIGTERM");
    await Promise.race([exited, delay(15000, undefined, { ref: false }).then(() => { if (child.exitCode === null) throw new Error("Production shutdown did not drain"); })]);
  };
  if (production) { await new Promise(resolve => server.close(resolve)); await launch(); }
  const url = `http://127.0.0.1:${portNumber}/v1/sessions/${f.session}`;
  const post = async command => { const response = await fetch(`${url}/commands`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${f.token}` }, body: JSON.stringify(command) }); return response.json(); };
  const startCommand = () => ({ commandId: randomUUID(), deviceId: f.device, operationType: "composition_run.start", aggregateId: randomUUID(),
    expectedAggregateVersion: 0, governingReleaseId: f.release, activeSessionRoleId: "reviewer", payload: { planId: "governed" } });
  const status = async id => (await owner.query("SELECT status,failure_code FROM extension.model_runs WHERE composition_run_id=$1", [id])).rows[0];
  const run = async (expected = "completed") => { const command = startCommand(); const receipt = await post(command); assert.equal(receipt.status, "accepted", JSON.stringify(receipt));
    if (!production) await Promise.all([worker.run(authority), worker.run(authority)]);
    await eventually(async () => (await status(command.aggregateId))?.status === expected, `Model Run ${expected}`); return command; };
  try {
    const hidden = await post({ ...startCommand(), payload: { planId: "hidden-plan" } });
    assert.equal(hidden.errorCode, "CAPABILITY_UNAVAILABLE", "hidden inputs cannot be frozen for a Plugin");
    const command = await run();
    if (!production) assert.equal(executions, 1, "overlapping ticks claim once");
    assert.equal((await post(command)).replayed, true);
    assert.equal((await post({ ...command, commandId: randomUUID() })).errorCode, "CONFLICT", "a new Command cannot recreate the same Run");
    const projection = await fetch(`${url}/effect-proposals`, { headers: { "x-device-id": f.device, authorization: `Bearer ${f.token}` } });
    const proposals = (await projection.json()).proposals; assert.equal(proposals.length, 1);
    const provenance = await fetch(`${url}/extension-provenance`, { headers: { authorization: `Bearer ${f.token}` } });
    assert.equal(provenance.status, 200);
    assert.equal((await provenance.text()).includes(f.token), false, "worker authentication context never enters exported provenance");
    assert.equal((await owner.query("SELECT value FROM runtime.state_values WHERE id=$1", [f.state])).rows[0].value, 10);
    const approve = () => ({ ...startCommand(), operationType: "effect_proposal.approve", aggregateId: f.effect, expectedAggregateVersion: 1,
      payload: { proposalHash: proposals[0].proposalHash, reason: "Reviewed synthetic output" } });
    await owner.query(`INSERT INTO runtime.seat_assignments(id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
      VALUES ($1,$2,$3,$4,'viewer','seat',$5)`, [randomUUID(), f.org, f.session, f.participant, f.person]);
    assert.equal((await post({ ...approve(), activeSessionRoleId: "viewer" })).errorCode, "PERMISSION_DENIED");
    const approval = approve();
    const receipts = await Promise.all([post(approval), post(approve())]);
    assert.deepEqual(receipts.map(r => r.status).sort(), ["accepted", "rejected"]);
    assert.equal((await post(approval)).replayed, true);
    assert.equal((await owner.query("SELECT value FROM runtime.state_values WHERE id=$1", [f.state])).rows[0].value, 11);
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM extension.effect_receipts WHERE organization_id=$1", [f.org])).rows[0].n, 1);
    if (production) {
      await stopChild(); await launch(); assert.equal((await post(command)).replayed, true); assert.equal((await post(approval)).replayed, true);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM extension.effect_receipts WHERE organization_id=$1", [f.org])).rows[0].n, 1);
      console.log(JSON.stringify({ acceptance: "BA-08-T01 production entrypoint and approved effect PASS", profile: "cloud", artifactDigest: manifest.digest,
        bundleDigest: signed.bundleDigest, environment: PINNED_EXTENSION_HOST_IMAGE, transport: "constrained Unix supervisor", restartReplay: "PASS" }));
      return;
    }
    await worker.stop(); worker = createModelRunWorker(app, runtime, () => failures++);
    await worker.run(authority); assert.equal(executions, 1, "restart never reexecutes completed runs");
    const corrupt = startCommand(); assert.equal((await post(corrupt)).status, "accepted");
    await owner.query("UPDATE extension.model_runs SET input_digest=$1 WHERE composition_run_id=$2", [`sha256:${"0".repeat(64)}`, corrupt.aggregateId]);
    await worker.run(authority); await eventually(async () => (await status(corrupt.aggregateId))?.status === "failed", "input digest mismatch fails before dispatch");
    assert.equal(executions, 1);
    for (const failure of ["invalid", "timeout"]) { mode = failure; const failed = await run("failed");
      assert.equal((await status(failed.aggregateId)).failure_code, failure === "timeout" ? "timeout" : "output_invalid"); }
    mode = "pause"; entered = Promise.withResolvers(); resume = Promise.withResolvers();
    const stale = startCommand(); assert.equal((await post(stale)).status, "accepted"); await worker.run(authority); await entered.promise;
    await owner.query("UPDATE extension.model_runs SET started_at=now()-interval '7 minutes' WHERE composition_run_id=$1", [stale.aggregateId]);
    const restarted = createModelRunWorker(app, runtime, () => failures++); await restarted.run(authority); await restarted.stop();
    resume.resolve(); await worker.stop();
    assert.equal((await status(stale.aggregateId)).status, "failed", "late output cannot revive recovered attempt");
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM extension.effect_proposals WHERE organization_id=$1", [f.org])).rows[0].n, 1);
    assert.ok(failures >= 3);
    for (const revoke of ["actor", "target", "authority"]) {
      await owner.query("UPDATE runtime.state_values SET value=$1,version=version+1 WHERE organization_id=$2 AND state_variable_id='effect_id'", [JSON.stringify(randomUUID()), f.org]);
      worker = createModelRunWorker(app, runtime, () => failures++);
      mode = "pause"; entered = Promise.withResolvers(); resume = Promise.withResolvers();
      const interrupted = startCommand(); assert.equal((await post(interrupted)).status, "accepted"); await worker.run(authority); await entered.promise;
      if (revoke === "actor") await owner.query("UPDATE identity.authentication_sessions SET revoked_at=now() WHERE id=$1", [f.token]);
      else if (revoke === "target") await owner.query("UPDATE runtime.state_values SET value='12',version=version+1 WHERE id=$1", [f.state]);
      else await owner.query("UPDATE runtime.session_authorities SET authority_epoch=authority_epoch+1 WHERE session_id=$1", [f.session]);
      resume.resolve(); await worker.stop();
      assert.equal((await status(interrupted.aggregateId)).status, "failed", `${revoke} revocation fences output`);
      if (revoke === "actor") await owner.query("UPDATE identity.authentication_sessions SET revoked_at=NULL WHERE id=$1", [f.token]);
    }
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM extension.effect_proposals WHERE organization_id=$1", [f.org])).rows[0].n, 1);
    await assert.rejects(configured.loadArtifact(f.artifact, randomUUID()), /unavailable/);
    const invalid = createProductionExtensionRuntime(app, { ...store, get: async () => Buffer.from("{}") }, f.deployment, "cloud", "/none.sock");
    await assert.rejects(invalid.loadArtifact(f.artifact, f.org));
    const revokedEffect = randomUUID();
    await owner.query("UPDATE runtime.state_values SET value=$1,version=version+1 WHERE organization_id=$2 AND state_variable_id='effect_id'", [JSON.stringify(revokedEffect), f.org]);
    mode = "valid"; worker = createModelRunWorker(app, runtime, () => failures++); await run();
    const staged = (await owner.query("SELECT proposal_hash FROM extension.effect_proposals WHERE id=$1", [revokedEffect])).rows[0];
    await owner.query("BEGIN");
    let revokingApproval;
    try {
      await owner.query("SELECT 1 FROM extension.publishers WHERE id=$1 FOR UPDATE", [manifest.publisher.id]);
      revokingApproval = post({ ...approve(), aggregateId: revokedEffect, payload: { proposalHash: staged.proposal_hash, reason: "Concurrent trust change" } });
      let earlyReceipt;
      void revokingApproval.then(receipt => { earlyReceipt = receipt; });
      await eventually(async () => {
        assert.equal(earlyReceipt, undefined, JSON.stringify(earlyReceipt));
        await owner.query("SELECT pg_stat_clear_snapshot()");
        return Number((await owner.query(`SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database()
          AND wait_event_type='Lock' AND query LIKE '%publisher.id AS publisher_id%'`)).rows[0].n) > 0;
      }, "approval waits on publisher trust lock");
      await owner.query(`INSERT INTO extension.revocation_lists(id,organization_id,publisher_id,trust_root_id,document,document_sha256,generated_at,imported_by)
        VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp(),$7)`, [randomUUID(), f.org, manifest.publisher.id, f.trust,
        { revokedDigests: [manifest.digest], revokedKeyIds: [] }, hash({ revoked: manifest.digest }), f.person]);
      await owner.query("COMMIT");
    } catch (error) { await owner.query("ROLLBACK"); await revokingApproval; throw error; }
    assert.equal((await revokingApproval).errorCode, "PLUGIN_NOT_APPROVED", "waiting approval reads the newly committed revocation list");
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM extension.effect_receipts WHERE organization_id=$1", [f.org])).rows[0].n, 1);
    await owner.query("UPDATE extension.plugin_artifacts SET lifecycle_status='revoked' WHERE id=$1", [f.artifact]);
    const denied = await post(startCommand()); assert.equal(denied.status, "rejected");
    console.log("BA-08 HTTP/DB/S3 harness PASS: Release resolver, signed custody, automatic worker claims, proposal approval, concurrent replay, invalid output, timeout, crash recovery, late output fence, cross-tenant and revoked artifact denial; isolation transport is a test double");
  } finally {
    resume?.resolve(); await worker.stop(); await stopChild(); server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve));
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); await s3.send(new DeleteBucketCommand({ Bucket: bucket })); s3.destroy();
  }
}
