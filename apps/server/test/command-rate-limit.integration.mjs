import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { setImmediate } from "node:timers/promises";
import { classifyDeploymentRequest, consumeDeploymentRateLimit, sessionCommandRateLimits } from "../dist/index.js";

const hash = (deployment, rule) => createHash("sha256").update(`${deployment}\0${rule.category}\0${rule.scope}`).digest("hex");
const ingress = (ip) => classifyDeploymentRequest({ url: "/v1/sessions/known/commands", headers: {}, socket: { remoteAddress: ip } });

export async function verifyCommandLimitWindows(pool, owner) {
  const deployment = randomUUID(), now = new Date("2030-01-01T12:00:30Z");
  const context = { organizationId: randomUUID(), principalId: randomUUID(), sessionId: randomUUID() };
  const rules = [...sessionCommandRateLimits(context), ingress("192.0.2.1")];
  for (const rule of rules) {
    // Fixture the state immediately before the boundary; concurrent updates use the real database function.
    await owner.query(`INSERT INTO operations.request_rate_limit_windows VALUES ($1,$2,$3,$4,$3::timestamptz+interval '1 minute')`,
      [rule.category, hash(deployment, rule), new Date("2030-01-01T12:00:00Z"), rule.limit - 2]);
    const results = await Promise.all(Array.from({ length: 8 }, () => consumeDeploymentRateLimit(pool, deployment, rule, now)));
    assert.equal(results.filter(({ allowed }) => allowed).length, 2);
    assert.equal(results.filter(({ allowed }) => !allowed).every(({ remaining, retryAfterSeconds }) => remaining === 0 && retryAfterSeconds === 30), true);
    assert.deepEqual(await consumeDeploymentRateLimit(pool, deployment, rule, new Date("2030-01-01T12:01:00Z")),
      { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 });
  }
  const otherPrincipal = sessionCommandRateLimits({ ...context, principalId: randomUUID() })[0];
  assert.equal((await consumeDeploymentRateLimit(pool, deployment, otherPrincipal, now)).allowed, true);
  const profile = JSON.parse(await readFile(new URL("../../../deploy/load-fixtures/reference-profile.json", import.meta.url), "utf8"));
  const applicationCommands = profile.application.commandsPerSession * 60 / profile.application.commandWindowSeconds;
  // Repeat the application's actor set each 10-second window, then add one ballot per voter.
  const workloadIngress = ingress("192.0.2.2");
  for (let session = 0; session < profile.sessions; session++) {
    const sessionContext = { ...context, sessionId: randomUUID() };
    const principals = Array.from({ length: profile.participantsPerSession }, () => randomUUID());
    const rules = Array.from({ length: applicationCommands + profile.voting.ballotsPerSession }, (_, index) =>
      sessionCommandRateLimits({ ...sessionContext, principalId: principals[index < applicationCommands ? index % profile.application.commandsPerSession : index - applicationCommands] }));
    for (let offset = 0; offset < rules.length; offset += 50) {
      await Promise.all(rules.slice(offset, offset + 50).map(async ([principalRule, sessionRule]) => {
        for (const rule of [workloadIngress, principalRule, sessionRule]) {
          assert.equal((await consumeDeploymentRateLimit(pool, deployment, rule, now)).allowed, true);
        }
      }));
    }
  }
  await consumeDeploymentRateLimit(pool, deployment, rules[0], new Date("2030-01-01T12:07:00Z"));
  const expired = await owner.query("SELECT count(*)::int AS count FROM operations.request_rate_limit_windows WHERE expires_at < $1::timestamptz-interval '5 minutes'", ["2030-01-01T12:07:00Z"]);
  assert.equal(expired.rows[0].count, 0);
}

async function freePort() {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function verifyCommandLimitHttp(owner, ids, principal, principalC, principalD) {
  const sessionId = randomUUID(), releaseId = randomUUID(), revisionId = randomUUID(), deployment = randomUUID();
  const coreDesign = {
    sessionRoles: [{ id: "voter", isControlRole: true }], seats: [{ id: "a", sessionRoleIds: ["voter"] }, { id: "c", sessionRoleIds: ["voter"] }],
    informationPolicies: [{ id: "voters", grants: [{ audience: { sessionRoleIds: ["voter"] } }] }],
    polls: [{ id: "vote", scope: "session", question: "Synthetic BA-02 vote?", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
      pollType: "single_choice", tallyMethod: "builtin_count", tallyMethodVersion: "builtin-count-v1", electoratePolicyId: "voters",
      oneBallotPer: "seat_assignment", allowRevote: false, secrecy: "open",
      thresholdRule: { kind: "simple_majority", denominator: "valid_votes", abstentionCountsTowardDenominator: false },
      quorumRule: { basis: "electorate_at_open", minimum: 1, abstentionCountsTowardParticipation: true },
      weights: [], vetoRule: { holderSeatIds: [] }, tieRule: "no_decision", openTrigger: { mode: "manual" }, closeTrigger: { mode: "manual" },
      deadlinePolicy: { graceSeconds: 0 }, resultVisibilityPolicyId: "voters", certificationPolicy: { certifierSessionRoleIds: ["voter"] } }]
  };
  await owner.query(`INSERT INTO studio.definition_revisions(id,organization_id,project_id,snapshot,snapshot_sha256,methodology_version,author_id)
    VALUES ($1,$2,$3,$4,repeat('b',64),'v1',$5)`, [revisionId, ids.orgA, ids.projectA, { coreDesign }, ids.personA]);
  await owner.query(`INSERT INTO registry.releases(id,organization_id,project_id,definition_revision_id,release_number,release_label,package_schema_version,compiler_version,package_sha256,blob_key,published_by)
    VALUES ($1,$2,$3,$4,902,'BA-02 synthetic','1','1',repeat('b',64),'ba02',$5)`, [releaseId, ids.orgA, ids.projectA, revisionId, ids.personA]);
  await owner.query(`INSERT INTO runtime.sessions(id,organization_id,project_id,initial_release_id,status,created_by) VALUES ($1,$2,$3,$4,'active',$5)`,
    [sessionId, ids.orgA, ids.projectA, releaseId, ids.personA]);
  await owner.query(`INSERT INTO runtime.session_authorities(session_id,organization_id,deployment_id,authority_epoch,status) VALUES ($1,$2,$3,1,'active')`, [sessionId, ids.orgA, deployment]);
  await owner.query(`INSERT INTO runtime.release_activations(id,organization_id,project_id,session_id,release_id,activation_sequence,compatibility_policy,approved_by)
    VALUES ($1,$2,$3,$4,$5,1,'{}',$6)`, [randomUUID(), ids.orgA, ids.projectA, sessionId, releaseId, ids.personA]);
  await owner.query("INSERT INTO evidence.session_sequences(session_id,organization_id) VALUES ($1,$2)", [sessionId, ids.orgA]);
  for (const [person, seat] of [[ids.personA, "a"], [ids.personC, "c"]]) {
    const participant = randomUUID();
    await owner.query("INSERT INTO runtime.participants(id,organization_id,session_id,person_id) VALUES ($1,$2,$3,$4)", [participant, ids.orgA, sessionId, person]);
    await owner.query(`INSERT INTO runtime.seat_assignments(id,organization_id,session_id,participant_id,session_role_id,seat_id,assigned_by)
      VALUES ($1,$2,$3,$4,'voter',$5,$6)`, [randomUUID(), ids.orgA, sessionId, participant, seat, ids.personA]);
  }
  const appPort = await freePort(), metricsPort = await freePort();
  const origin = `http://127.0.0.1:${appPort}`, publicOrigin = `https://localhost:${appPort}`;
  const observedAt = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 30_000);
  const clock = `import { mock } from 'node:test'; mock.timers.enable({ apis: ['Date'], now: ${observedAt.getTime()} });`;
  const service = spawn(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(clock)}`, "deploy/compose/profile-service.mjs"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production", NODE_TLS_REJECT_UNAUTHORIZED: "1", PORT: String(appPort), METRICS_PORT: String(metricsPort),
      PLENUM_DEPLOYMENT_PROFILE: "cloud", PLENUM_TRUST_PROXY: "1", PLENUM_PUBLIC_BASE_URL: publicOrigin,
      PLENUM_DEPLOYMENT_ID: deployment, PLENUM_RETENTION_ACTOR_PERSON_ID: ids.personA, OIDC_ISSUER: publicOrigin,
      OIDC_PROVIDER_KEY: "ba02", OIDC_ORGANIZATION_ID: ids.orgA, OIDC_CLIENT_ID: "ba02", OIDC_REDIRECT_URI: `${publicOrigin}/auth/callback`,
      S3_BUCKET: "ba02-synthetic", MEDIA_URL: "wss://localhost", MEDIA_API_KEY: "synthetic", MEDIA_API_SECRET: "synthetic-media-secret",
      MEDIA_ADAPTER_DIGEST: `sha256:${"e".repeat(64)}`, FLOOR_TOKEN_SECRET: "synthetic-floor-token-secret",
      INVITATION_DELIVERY_ENDPOINT: `${publicOrigin}/synthetic-delivery`, INVITATION_DELIVERY_BEARER_TOKEN: "synthetic-delivery",
      INVITATION_DELIVERY_WEBHOOK_TOKEN: "synthetic-webhook", NOTIFICATIONS_HOSTNAME: "" } });
  const logs = [];
  service.stdout.on("data", (data) => logs.push(data.toString()));
  service.stderr.resume();
  const post = async (command, token, ip = "192.0.2.2", target = sessionId, extra = {}) => {
    const response = await fetch(`${origin}/v1/sessions/${target}/commands`, { method: "POST", headers: {
      "content-type": "application/json", "x-forwarded-for": ip, ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra
    }, body: JSON.stringify(command) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  const context = { organizationId: ids.orgA, principalId: ids.personA, sessionId };
  const [principalRule, sessionRule] = sessionCommandRateLimits(context);
  const principalCRule = sessionCommandRateLimits({ ...context, principalId: ids.personC })[0];
  const keys = [principalRule, principalCRule, sessionRule].map((rule) => hash(deployment, rule));
  const quotaCount = async () => Number((await owner.query("SELECT coalesce(sum(request_count),0) AS count FROM operations.request_rate_limit_windows WHERE scope_hash=ANY($1)", [keys])).rows[0].count);
  // Only the test child clock is frozen; production has no clock override or limiter bypass.
  const prefill = async (rule, count) => owner.query(`INSERT INTO operations.request_rate_limit_windows(category,scope_hash,window_started_at,request_count,expires_at)
    VALUES ($1,$2,date_trunc('minute',$4::timestamptz),$3,date_trunc('minute',$4::timestamptz)+interval '1 minute')
    ON CONFLICT (category,scope_hash,window_started_at) DO UPDATE SET request_count=excluded.request_count`, [rule.category, hash(deployment, rule), count, observedAt]);
  const command = { commandId: randomUUID(), deviceId: ids.deviceA, operationType: "poll.open", aggregateId: randomUUID(),
    expectedAggregateVersion: 0, governingReleaseId: releaseId, activeSessionRoleId: "voter", payload: { definitionId: "vote", definitionRevision: 1 } };
  try {
    const deadline = Date.now() + 20_000;
    while (true) {
      assert.equal(service.exitCode, null, "production service must remain alive");
      if (await fetch(`${origin}/`).then((r) => r.status === 200).catch(() => false)) break;
      assert.ok(Date.now() < deadline, "production service startup timed out");
      await setImmediate();
    }
    for (const token of [undefined, "invalid", randomUUID()]) assert.equal((await post(command, token)).status, 401);
    const deniedMember = await post(command, principalD.authenticationSessionId);
    assert.equal(deniedMember.body.error.code, "NOT_A_PARTICIPANT");
    assert.equal((await post(command, principal.authenticationSessionId, "192.0.2.2", ids.sessionB)).body.error.code, "TARGET_NOT_FOUND");
    assert.equal(await quotaCount(), 0, "authentication/access denial must not debit Command quotas");
    await prefill(ingress("192.0.2.1"), 11_999);
    const anonymous = await Promise.all(Array.from({ length: 8 }, () => post(command, undefined, "attacker-prefix, 192.0.2.1")));
    assert.deepEqual(anonymous.map(({ status }) => status).sort(), [401, 429, 429, 429, 429, 429, 429, 429]);
    for (const token of ["invalid", randomUUID(), principalD.authenticationSessionId]) {
      assert.equal((await post(command, token, "spoof, 192.0.2.1")).status, 429);
    }
    assert.equal(await quotaCount(), 0);
    assert.equal((await post(command, principal.authenticationSessionId)).status, 200);
    await prefill(principalRule, 119);
    const retries = await Promise.all(Array.from({ length: 8 }, () => post(command, principal.authenticationSessionId,
      "198.51.100.1, 192.0.2.2", sessionId, { "x-principal-id": ids.personC, "x-organization-id": ids.orgB })));
    assert.deepEqual(retries.map(({ status }) => status).sort(), [200, 429, 429, 429, 429, 429, 429, 429]);
    const limited = retries.find(({ status }) => status === 429);
    assert.equal(limited.body.error.code, "RATE_LIMITED");
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);
    assert.equal(limited.headers.get("cache-control"), "no-store");
    const throttledId = randomUUID();
    assert.equal((await post({ ...command, commandId: throttledId }, principal.authenticationSessionId)).status, 429);
    assert.equal(Number((await owner.query("SELECT count(*) FROM sync.command_receipts WHERE command_id=$1", [throttledId])).rows[0].count), 0);
    const receipt = await fetch(`${origin}/v1/sessions/${sessionId}/commands/${command.commandId}`, { headers: { authorization: `Bearer ${principal.authenticationSessionId}`, "x-forwarded-for": "192.0.2.2" } });
    assert.equal(receipt.status, 200, "receipt reads remain available after principal exhaustion");
    const projection = await fetch(`${origin}/v1/sessions/${sessionId}/polls/${command.aggregateId}`, { headers: {
      authorization: `Bearer ${principalC.authenticationSessionId}`, "x-device-id": ids.deviceC } }).then((r) => r.json());
    const ballot = { ...command, commandId: randomUUID(), deviceId: ids.deviceC, operationType: "ballot.cast", expectedAggregateVersion: 1,
      payload: { pollDefinitionRevision: 1, ballotCapability: projection.ballotCapability, optionIds: ["yes"] } };
    const ballots = await Promise.all(Array.from({ length: 6 }, () => post(ballot, principalC.authenticationSessionId)));
    assert.deepEqual(ballots.map(({ status }) => status), Array(6).fill(200));
    const counts = await owner.query(`SELECT (SELECT count(*)::int FROM voting.ballots WHERE poll_id=$1) AS ballots,
      (SELECT count(*)::int FROM sync.command_receipts WHERE session_id=$2) AS receipts,
      (SELECT count(*)::int FROM evidence.events WHERE session_id=$2) AS events,
      (SELECT count(*)::int FROM sync.session_delta_outbox WHERE session_id=$2) AS outbox`, [command.aggregateId, sessionId]);
    assert.deepEqual(counts.rows[0], { ballots: 1, receipts: 2, events: 2, outbox: 2 });
    await prefill(sessionRule, 1_200);
    assert.equal((await post(ballot, principalC.authenticationSessionId)).status, 429, "aggregate protection remains bounded");
    // Expire only this deployment's synthetic windows, then retry the identical ballot.
    await owner.query("UPDATE operations.request_rate_limit_windows SET expires_at=now()-interval '10 minutes' WHERE scope_hash=ANY($1)", [keys]);
    assert.equal((await post(ballot, principalC.authenticationSessionId)).status, 200);
    assert.equal(Number((await owner.query("SELECT count(*) FROM voting.ballots WHERE poll_id=$1", [command.aggregateId])).rows[0].count), 1);
    const rateEvents = logs.join("").split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((event) => event.event.startsWith("security.rate_"));
    assert.ok(rateEvents.length > 0);
    for (const event of rateEvents) for (const key of ["sessionId", "principalId", "organizationId", "scope", "address"]) assert.equal(key in event, false);
  } finally {
    service.kill();
    await once(service, "exit");
  }
}
