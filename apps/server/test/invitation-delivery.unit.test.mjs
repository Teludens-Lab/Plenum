import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import test from "node:test";

import {
  createRuntimeHttpHandler,
  parseGovernedInvitationMessage,
  PostmarkInvitationAdapter
} from "../dist/index.js";

const deliveryId = "53000000-0000-4000-8000-000000000008";
const message = {
  messageId: deliveryId,
  type: "PLATFORM_FIRST_ADMIN_INVITATION",
  channel: "EMAIL",
  mandatory: true,
  recipient: "admin@example.test",
  templateRef: "platform-first-admin-v1",
  variables: {
    organizationName: "Synthetic Organization",
    invitationUrl: "https://plenum.example/platform/invitations/synthetic",
    expiresAt: "2030-01-01T00:00:00.000Z"
  }
};

function adapter(fetcher = async () => new Response(JSON.stringify({
  ErrorCode: 0,
  Message: "OK",
  MessageID: "postmark-message-1"
}), { status: 200, headers: { "content-type": "application/json" } })) {
  return new PostmarkInvitationAdapter({
    serverToken: "synthetic-postmark-server-token",
    from: "Plenum <notifications@example.test>",
    webhookPassword: "synthetic-postmark-webhook-password",
    fetcher
  });
}

function basic(password = "synthetic-postmark-webhook-password") {
  return `Basic ${Buffer.from(`plenum-postmark:${password}`).toString("base64")}`;
}

test("governed invitation messages reject unknown fields, template substitution and insecure links", () => {
  assert.deepEqual(parseGovernedInvitationMessage(message), message);
  assert.throws(() => parseGovernedInvitationMessage({ ...message, extra: true }), /unknown field/u);
  assert.throws(() => parseGovernedInvitationMessage({ ...message, templateRef: "hostile-template" }), /invalid/u);
  assert.throws(() => parseGovernedInvitationMessage({ ...message,
    variables: { ...message.variables, invitationUrl: "http://plenum.example/invitation" } }), /invalid/u);
});

test("Postmark adapter sends the governed template without tracking or secret leakage", async () => {
  let observedUrl = "";
  let observedInit;
  const provider = adapter(async (url, init) => {
    observedUrl = String(url);
    observedInit = init;
    return new Response(JSON.stringify({ ErrorCode: 0, Message: "OK", MessageID: "postmark-message-1" }), { status: 200 });
  });
  assert.deepEqual(await provider.send(parseGovernedInvitationMessage(message)), { messageId: "postmark-message-1" });
  assert.equal(observedUrl, "https://api.postmarkapp.com/email/withTemplate");
  assert.equal(observedInit.headers["x-postmark-server-token"], "synthetic-postmark-server-token");
  const body = JSON.parse(observedInit.body);
  assert.equal(body.TemplateAlias, "platform-first-admin-v1");
  assert.deepEqual(body.Metadata, { deliveryId, messageType: "PLATFORM_FIRST_ADMIN_INVITATION" });
  assert.equal(body.TrackOpens, false);
  assert.equal(body.TrackLinks, "None");
  assert.equal(JSON.stringify(body).includes("synthetic-postmark-server-token"), false);
});

test("Postmark adapter authenticates and normalizes delivery and bounce callbacks", () => {
  const provider = adapter();
  assert.equal(provider.webhookAuthorized(basic()), true);
  assert.equal(provider.webhookAuthorized(basic("wrong-postmark-webhook-password")), false);
  assert.equal(provider.webhookAuthorized("Bearer wrong"), false);

  assert.deepEqual(provider.normalizeWebhook({
    RecordType: "Delivery",
    MessageID: "postmark-message-1",
    DeliveredAt: "2029-01-01T00:00:00.000Z",
    Recipient: "must-not-be-projected@example.test",
    Metadata: { deliveryId }
  }, "postmark-trace-1"), {
    providerEventId: "postmark-trace-1",
    deliveryId,
    status: "delivered",
    occurredAt: "2029-01-01T00:00:00.000Z"
  });
  assert.deepEqual(provider.normalizeWebhook({
    RecordType: "Bounce",
    MessageID: "postmark-message-1",
    BouncedAt: "2029-01-01T00:01:00.000Z",
    Description: "Mailbox unavailable",
    Email: "must-not-be-projected@example.test",
    Metadata: { deliveryId }
  }), {
    providerEventId: "postmark:Bounce:postmark-message-1:2029-01-01T00:01:00.000Z",
    deliveryId,
    status: "bounced",
    occurredAt: "2029-01-01T00:01:00.000Z",
    reason: "Mailbox unavailable"
  });
  assert.equal(provider.normalizeWebhook({ RecordType: "Delivery", MessageID: "verification-event" }), null);
  assert.equal(provider.normalizeWebhook({ RecordType: "Open", MessageID: "ignored" }), null);
});

function fakePool(observedParameters) {
  const client = {
    async query(sql, parameters = []) {
      if (String(sql).includes("identity.record_invitation_delivery_event")) {
        observedParameters.push(parameters);
        return { rows: [{ organization_id: "synthetic", invitation_kind: "first_admin",
          invitation_id: "synthetic", duplicate: false }] };
      }
      return { rows: [] };
    },
    release() {}
  };
  return { async connect() { return client; } };
}

async function withApi(run) {
  const providerRequests = [];
  const eventParameters = [];
  const provider = adapter(async (_url, init) => {
    providerRequests.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ ErrorCode: 0, Message: "OK", MessageID: "postmark-message-1" }), { status: 200 });
  });
  const handler = createRuntimeHttpHandler({
    pool: fakePool(eventParameters),
    deploymentId: "53000000-0000-4000-8000-000000000009",
    authenticate: async () => { throw new Error("notification routes must not use a user session"); },
    invitationDeliveryBearerToken: "synthetic-delivery-bearer-token",
    notificationsHostname: "notifications.example.test",
    postmarkInvitationAdapter: provider
  });
  const server = createServer((request, response) => void handler(request, response));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run({ port: address.port, providerRequests, eventParameters });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function request({ port, path, host = "notifications.example.test", authorization, body }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const outgoing = httpRequest({ hostname: "127.0.0.1", port, path, method: "POST",
      headers: { host, authorization, "content-type": "application/json", "content-length": Buffer.byteLength(payload) } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    outgoing.on("error", reject);
    outgoing.end(payload);
  });
}

test("notification HTTP boundary enforces host and credentials, then records normalized events", async () => {
  await withApi(async ({ port, providerRequests, eventParameters }) => {
    const wrongHost = await request({ port, path: "/v1/messages", host: "plenum.example.test",
      authorization: "Bearer synthetic-delivery-bearer-token", body: message });
    assert.equal(wrongHost.status, 404);

    const unauthenticated = await request({ port, path: "/v1/messages", authorization: "Bearer wrong", body: message });
    assert.equal(unauthenticated.status, 401);

    const accepted = await request({ port, path: "/v1/messages",
      authorization: "Bearer synthetic-delivery-bearer-token", body: message });
    assert.equal(accepted.status, 202);
    assert.deepEqual(accepted.body, { messageId: "postmark-message-1" });
    assert.equal(providerRequests.length, 1);

    const rejectedWebhook = await request({ port, path: "/v1/events/postmark", authorization: basic("wrong-password"),
      body: { RecordType: "Delivery" } });
    assert.equal(rejectedWebhook.status, 401);

    const recorded = await request({ port, path: "/v1/events/postmark", authorization: basic(), body: {
      RecordType: "Delivery", MessageID: "postmark-message-1", DeliveredAt: "2029-01-01T00:00:00.000Z",
      Recipient: "must-not-enter-the-database@example.test", Metadata: { deliveryId }
    } });
    assert.equal(recorded.status, 202);
    assert.deepEqual(recorded.body, { accepted: true, duplicate: false });
    assert.equal(eventParameters.length, 1);
    assert.deepEqual(eventParameters[0].slice(1, 4), [deliveryId, "delivered", new Date("2029-01-01T00:00:00.000Z")]);
    assert.equal(JSON.stringify(eventParameters).includes("must-not-enter-the-database"), false);
  });
});
