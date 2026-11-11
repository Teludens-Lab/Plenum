import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { authorizationError, createRuntimeHttpHandler, createStudioCollaborationGateway,
  createOrganizationScimCredential, getCollaborativeDraft } from "../dist/index.js";

export async function verifyBrowserOriginBoundary(pool, owner, ids, designer, secondDesigner) {
  const approved = "https://app.plenum.test", projectId = randomUUID();
  const actors = [];
  for (const source of [designer, secondDesigner]) {
    const actor = { ...source, authenticationSessionId: randomUUID() };
    await owner.query(`INSERT INTO identity.authentication_sessions(id,organization_id,person_id,issuer,subject,authentication_strength,expires_at)
      VALUES ($1,$2,$3,'https://synthetic.example','ba03','mfa','2099-01-01')`, [actor.authenticationSessionId, actor.organizationId, actor.principalId]);
    actors.push(actor);
  }
  await owner.query("INSERT INTO studio.simulation_projects(id,organization_id,title,created_by) VALUES ($1,$2,'BA-03 synthetic',$3)", [projectId, ids.orgA, designer.principalId]);
  await owner.query(`INSERT INTO studio.drafts(id,organization_id,project_id,document,updated_by)
    SELECT gen_random_uuid(),organization_id,$1,document,$2 FROM studio.drafts WHERE project_id=$3`, [projectId, designer.principalId, ids.projectA]);
  let authenticationCalls = 0;
  const authenticate = async (request, correlationId) => {
    authenticationCalls++;
    const token = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7)
      : request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("plenum_session="))?.slice(15);
    const actor = actors.find(({ authenticationSessionId }) => authenticationSessionId === token);
    if (!actor) throw authorizationError("UNAUTHENTICATED", "Sign in is required.", correlationId);
    const active = await owner.query("SELECT 1 FROM identity.authentication_sessions WHERE id=$1 AND revoked_at IS NULL AND expires_at>now()", [token]);
    if (active.rowCount !== 1) throw authorizationError("UNAUTHENTICATED", "Sign in is required.", correlationId);
    return actor;
  };
  const api = createRuntimeHttpHandler({ pool, deploymentId: randomUUID(), authenticate, publicBaseUrl: approved });
  const gateway = createStudioCollaborationGateway({ pool, authenticate, publicBaseUrl: approved });
  const server = createServer((request, response) => void api(request, response));
  server.on("upgrade", (request, socket, head) => void gateway.handleUpgrade(request, socket, head));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = (actor) => `plenum_session=${actor.authenticationSessionId}`;
  const sockets = [];
  const connect = async (headers, target = projectId) => {
    const socket = new WebSocket(`${base.replace("http:", "ws:")}/v1/projects/${target}/collaboration`, { headers, handshakeTimeout: 5_000 });
    sockets.push(socket);
    const messages = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
    socket.on("error", () => {});
    const status = await new Promise((resolve, reject) => {
      socket.once("open", () => resolve(101));
      socket.once("unexpected-response", (_request, response) => {
        response.resume();
        response.once("end", () => { socket.terminate(); resolve(response.statusCode); });
      });
      socket.once("error", reject);
    });
    const next = async () => {
      if (messages.length === 0) await once(socket, "message", { signal: AbortSignal.timeout(10_000) });
      return messages.shift();
    };
    return { socket, status, messages, next };
  };
  const mutate = (path, headers, body, method = "POST") => fetch(`${base}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    for (const origin of [undefined, "null", "https://sibling.plenum.test", "https://app.plenum.test/", "malformed"]) {
      const before = authenticationCalls;
      const denied = await connect({ cookie: cookie(actors[0]), ...(origin === undefined ? {} : { origin }) });
      assert.equal(denied.status, 403);
      assert.deepEqual(denied.messages, []);
      assert.equal(authenticationCalls, before, "Origin denial precedes authentication and Draft reads");
    }
    assert.equal((await connect({ origin: approved })).status, 401);
    assert.equal((await connect({})).status, 401);
    const crossOrganization = await connect({ origin: approved, cookie: cookie(actors[0]) }, ids.projectB);
    assert.equal(crossOrganization.status, 401);
    assert.deepEqual(crossOrganization.messages, []);
    const machine = await connect({ authorization: `Bearer ${actors[0].authenticationSessionId}` });
    assert.equal(machine.status, 101);
    assert.equal((await machine.next()).type, "sync");
    machine.socket.close();
    const [a, b] = await Promise.all(actors.map((actor) => connect({ origin: approved, cookie: cookie(actor) })));
    assert.equal(a.status, 101); assert.equal(b.status, 101);
    const [initial, second] = await Promise.all([a.next(), b.next()]);
    assert.equal(initial.type, "sync"); assert.equal(second.stateVector, initial.stateVector);
    const document = new Y.Doc();
    Y.applyUpdate(document, Buffer.from(initial.update, "base64"));
    let delta;
    document.on("update", (update) => { delta = Buffer.from(update).toString("base64"); });
    document.getMap("draft").get("scenario").set("name", "BA-03 authorized collaborative edit");
    const message = { type: "update", generation: initial.generation, updateId: randomUUID(), update: delta };
    a.socket.send(JSON.stringify(message));
    assert.equal((await a.next()).type, "ack");
    assert.equal((await b.next()).type, "remote_update");
    a.socket.send(JSON.stringify(message));
    assert.equal((await a.next()).type, "ack");
    await b.next();
    assert.equal(Number((await owner.query("SELECT count(*) FROM studio.document_updates WHERE update_id=$1", [message.updateId])).rows[0].count), 1);
    const reconnected = await connect({ origin: approved, cookie: cookie(actors[1]) });
    const restored = new Y.Doc();
    Y.applyUpdate(restored, Buffer.from((await reconnected.next()).update, "base64"));
    assert.deepEqual(restored.getMap("draft").toJSON(), document.getMap("draft").toJSON());

    const projectsBefore = Number((await owner.query("SELECT count(*) FROM studio.simulation_projects")).rows[0].count);
    for (const origin of [undefined, "null", "https://sibling.plenum.test", "malformed"]) {
      const response = await mutate("/v1/projects", { cookie: cookie(actors[0]), "content-type": "application/json",
        ...(origin === undefined ? {} : { origin }), "x-forwarded-host": "app.plenum.test" }, { requestId: randomUUID(), title: "Denied" });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, "PERMISSION_DENIED");
      assert.equal(response.headers.has("access-control-allow-origin"), false);
    }
    for (const mediaType of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data", "application/scim+json"]) {
      const response = await mutate("/v1/projects", { cookie: cookie(actors[0]), origin: approved, "content-type": mediaType },
        { requestId: randomUUID(), title: "Denied" });
      assert.equal(response.status, 422);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal((await mutate("/v1/auth/logout", { cookie: cookie(actors[0]), origin: "https://sibling.plenum.test" }, undefined, method)).status, 403);
    }
    assert.equal((await mutate("/v1/auth/logout", { cookie: cookie(actors[0]), origin: approved, "content-type": "text/plain" }, {})).status, 422);
    assert.equal(Number((await owner.query("SELECT count(*) FROM studio.simulation_projects")).rows[0].count), projectsBefore);
    assert.equal((await mutate("/v1/projects", { cookie: cookie(actors[0]), origin: approved, "content-type": "application/json; charset=utf-8" },
      { requestId: randomUUID(), title: "BA-03 approved HTTP" })).status, 201);
    assert.equal((await mutate("/v1/projects", { authorization: `Bearer ${actors[0].authenticationSessionId}`, "content-type": "application/json" },
      { requestId: randomUUID(), title: "BA-03 machine HTTP" })).status, 201);

    const scim = await createOrganizationScimCredential(pool, actors[0], { label: "BA-03 synthetic SCIM" }, randomUUID());
    await owner.query(`INSERT INTO identity.organization_domains(id,organization_id,domain,verification_method,verified_by,verified_at,created_by)
      VALUES ($1,$2,'ba03.example.test','manual_contract',$3,now(),$3)`, [randomUUID(), ids.orgA, designer.principalId]);
    for (const type of ["application/scim+json", "application/json"]) {
      const response = await mutate("/scim/v2/Users", { authorization: `Bearer ${scim.credential}`, "content-type": type },
        { schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"], externalId: randomUUID(), userName: `${randomUUID()}@ba03.example.test`, displayName: "BA-03 synthetic", active: true });
      assert.equal(response.status, 201);
    }
    assert.equal((await mutate("/v1/auth/logout", { cookie: cookie(actors[0]), origin: approved })).status, 200);
    assert.equal((await connect({ cookie: cookie(actors[0]), origin: approved })).status, 401);
    document.getMap("draft").get("scenario").set("name", "Denied revoked edit");
    a.socket.send(JSON.stringify({ ...message, updateId: randomUUID(), update: delta }));
    assert.equal((await a.next()).type, "error");
    assert.equal((await getCollaborativeDraft(pool, actors[1], projectId, randomUUID())).materialization.scenario.name, "BA-03 authorized collaborative edit");
  } finally {
    for (const socket of sockets) socket.terminate();
    await gateway.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
