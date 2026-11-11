import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {
  AuthorizationError, authorizationError, beginOidcLogin, classifyDeploymentRequest, completeOidcLogin, consumeDeploymentRateLimit,
  oidcLoginCookie, readOidcLoginCookie, validateOidcReturnTo,
  createDatabasePool, createRuntimeHttpHandler, createStudioCollaborationGateway, runRetentionEnforcement, S3ObjectStore,
  PostmarkInvitationAdapter, WebhookFirstAdminInvitationDelivery, resolveIdentityProviderForLoginState, resolveOrganizationIdentityProvider,
  createSystemIdentityMetadataFetcher, ClamAvContentScanner, OperationalTelemetry, recordOperationalSecurityEvent,
  startScheduledInjectWorker
} from "../../apps/server/dist/index.js";
import { LiveKitLocalMediaProviderAdapter } from "../../packages/media-adapter/dist/index.js";
import { buildSecurityHeaders } from "./security-headers.mjs";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const profile = required("PLENUM_DEPLOYMENT_PROFILE");
if (!["cloud", "institutional", "air_gapped"].includes(profile)) throw new Error("Invalid PLENUM_DEPLOYMENT_PROFILE");
const databaseUrl = required("DATABASE_URL");
const s3Endpoint = process.env.S3_ENDPOINT?.trim();
const oidcIssuer = required("OIDC_ISSUER").replace(/\/$/u, "");
const mediaUrl = required("MEDIA_URL");
const publicBaseUrl = required("PLENUM_PUBLIC_BASE_URL");
const invitationDeliveryEndpoint = required("INVITATION_DELIVERY_ENDPOINT");
const invitationDeliveryBearerToken = required("INVITATION_DELIVERY_BEARER_TOKEN");
const invitationDeliveryWebhookToken = required("INVITATION_DELIVERY_WEBHOOK_TOKEN");
const notificationsHostname = process.env.NOTIFICATIONS_HOSTNAME?.trim();
const deploymentId = required("PLENUM_DEPLOYMENT_ID");
const retentionActorPersonId = required("PLENUM_RETENTION_ACTOR_PERSON_ID");
const trustedProxy = process.env.PLENUM_TRUST_PROXY === "1";
if (new URL(publicBaseUrl).protocol !== "https:") throw new Error("PLENUM_PUBLIC_BASE_URL must use HTTPS");
if (profile === "air_gapped" && (!s3Endpoint || [s3Endpoint, oidcIssuer, mediaUrl, invitationDeliveryEndpoint].some((value) => {
  const host = new URL(value).hostname;
  return !host.endsWith(".plenum.lan") && !["storage", "identity", "media"].includes(host);
}))) throw new Error("Air-gapped dependencies must use institution-local endpoints");

const pool = createDatabasePool(databaseUrl);
const s3 = new S3Client({
  ...(s3Endpoint ? { endpoint: s3Endpoint } : {}),
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "0",
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  } } : {})
});
const s3Bucket = required("S3_BUCKET");
const clientId = required("OIDC_CLIENT_ID");
const oidc = {
  providerKey: required("OIDC_PROVIDER_KEY"), organizationId: required("OIDC_ORGANIZATION_ID"), issuer: oidcIssuer,
  audience: process.env.OIDC_AUDIENCE ?? clientId, clientId, redirectUri: required("OIDC_REDIRECT_URI"),
  authorizationEndpoint: `${oidcIssuer}/protocol/openid-connect/auth`, tokenEndpoint: `${oidcIssuer}/protocol/openid-connect/token`,
  jwksUri: `${oidcIssuer}/protocol/openid-connect/certs`
};
if (oidc.redirectUri !== new URL("/auth/callback", publicBaseUrl).toString()) {
  throw new Error("OIDC_REDIRECT_URI must be /auth/callback on PLENUM_PUBLIC_BASE_URL");
}
const media = new LiveKitLocalMediaProviderAdapter({
  apiUrl: process.env.MEDIA_API_URL ?? mediaUrl.replace(/^ws/u, "http"), websocketUrl: mediaUrl,
  apiKey: required("MEDIA_API_KEY"), apiSecret: required("MEDIA_API_SECRET"),
  adapterDigest: required("MEDIA_ADAPTER_DIGEST"), allowedHosts: [new URL(mediaUrl).hostname]
});
const cookieName = "plenum_session";
const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const authenticate = async (request, correlationId) => {
  const bearer = typeof request.headers.authorization === "string" && request.headers.authorization.startsWith("Bearer ")
    ? request.headers.authorization.slice(7) : undefined;
  const cookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const token = bearer ?? cookie;
  if (!token || !tokenPattern.test(token)) throw authorizationError("UNAUTHENTICATED", "Sign in is required.", correlationId);
  const result = await pool.query(`SELECT session.id,session.person_id,session.organization_id,session.authentication_strength,session.expires_at,
      COALESCE(array_agg(membership.organization_role ORDER BY membership.organization_role)
        FILTER (WHERE membership.organization_role IS NOT NULL),ARRAY[]::text[])::text[] AS organization_roles
    FROM identity.authentication_sessions session LEFT JOIN identity.memberships membership
      ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
    WHERE session.id=$1 AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
      AND ((membership.person_id IS NOT NULL AND identity.person_has_active_organization_access(session.organization_id,session.person_id))
        OR (session.identity_provider_id IS NULL AND identity.person_is_active_platform_administrator(session.person_id)))
    GROUP BY session.id`, [token]);
  const row = result.rows[0];
  if (!row) throw authorizationError("UNAUTHENTICATED", "The authentication session is invalid or expired.", correlationId);
  return { authenticationSessionId: row.id, principalId: row.person_id, organizationId: row.organization_id,
    organizationRoles: row.organization_roles, authenticationStrength: row.authentication_strength, expiresAt: row.expires_at };
};
const mediaAdapter = media;
const contentScanner = process.env.CONTENT_SCANNER_HOST?.trim() ? new ClamAvContentScanner({
  host: process.env.CONTENT_SCANNER_HOST.trim(),
  port: Number(process.env.CONTENT_SCANNER_PORT ?? 3310),
  timeoutMs: Number(process.env.CONTENT_SCANNER_TIMEOUT_MS ?? 10_000)
}) : undefined;
const telemetry = new OperationalTelemetry({ deploymentId });
const firstAdminInvitationDelivery = new WebhookFirstAdminInvitationDelivery({
  endpoint: invitationDeliveryEndpoint,
  bearerToken: invitationDeliveryBearerToken
});
const postmarkInvitationAdapter = notificationsHostname ? new PostmarkInvitationAdapter({
  serverToken: required("POSTMARK_SERVER_TOKEN"),
  from: required("POSTMARK_FROM"),
  webhookPassword: required("POSTMARK_WEBHOOK_PASSWORD"),
  messageStream: process.env.POSTMARK_MESSAGE_STREAM ?? "outbound"
}) : undefined;
const api = createRuntimeHttpHandler({ pool, deploymentId, authenticate,
  objectStore: new S3ObjectStore(s3, s3Bucket), mediaAdapter, floorTokenSecret: required("FLOOR_TOKEN_SECRET"),
  ...(contentScanner === undefined ? {} : { contentScanner }),
  firstAdminInvitationDelivery, invitationDeliveryBearerToken, invitationDeliveryWebhookToken,
  ...(notificationsHostname && postmarkInvitationAdapter ? { notificationsHostname, postmarkInvitationAdapter } : {}), publicBaseUrl,
  identityMetadataFetcher: createSystemIdentityMetadataFetcher({ allowPrivateNetworks: profile !== "cloud" }),
  async onSecurityEvent(event) {
    telemetry.emit({ event: event.eventType, severity: event.severity, outcome: event.outcome,
      correlationId: event.correlationId, category: event.category });
    try {
      await recordOperationalSecurityEvent(pool, { deploymentId, ...event });
    } catch {
      telemetry.emit({ event: "security.evidence_failed", severity: "error", outcome: "failed",
        correlationId: event.correlationId, category: event.category });
    }
  } });
const collaboration = createStudioCollaborationGateway({ pool, authenticate });
const webRoot = fileURLToPath(new URL("../../apps/runtime-web/dist/web/", import.meta.url));
const studioRoot = fileURLToPath(new URL("../../apps/studio/dist/web/", import.meta.url));
const contentTypes = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const securityHeaders = buildSecurityHeaders({ publicBaseUrl, mediaUrl });
const serviceStartedAt = Date.now();
let retentionLastSucceededAt;

const server = createServer(async (request, response) => {
  const telemetryContext = telemetry.begin(request);
  response.setHeader("x-correlation-id", telemetryContext.correlationId);
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
  try {
    const url = new URL(request.url ?? "/", "https://plenum.invalid");
    if (request.method === "GET" && url.pathname === "/internal/metrics") {
      const address = request.socket.remoteAddress;
      if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") {
        response.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" });
        response.end('{"error":"not_found"}\n'); return;
      }
      response.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8", "cache-control": "no-store" });
      response.end(telemetry.metrics()); return;
    }
    // Command ingress is address-only here; principal/Session quotas follow authenticated Session access in api.
    const rateLimitRule = classifyDeploymentRequest(request, trustedProxy);
    if (rateLimitRule !== null) {
      const decision = await consumeDeploymentRateLimit(pool, deploymentId, rateLimitRule);
      response.setHeader("x-ratelimit-limit", String(rateLimitRule.limit));
      response.setHeader("x-ratelimit-remaining", String(decision.remaining));
      if (!decision.allowed) {
        response.writeHead(429, { "content-type": "application/json", "cache-control": "no-store",
          "retry-after": String(decision.retryAfterSeconds) });
        response.end(`${JSON.stringify(authorizationError("RATE_LIMITED", "Request rate limit exceeded.", telemetryContext.correlationId).envelope)}\n`);
        telemetry.emit({ event: "security.rate_limit_exceeded", severity: "warning", outcome: "denied",
          correlationId: telemetryContext.correlationId, traceId: telemetryContext.traceId, category: rateLimitRule.category });
        await recordOperationalSecurityEvent(pool, { deploymentId, eventType: "security.rate_limited",
          severity: "warning", outcome: "denied", correlationId: telemetryContext.correlationId,
          category: rateLimitRule.category }).catch(() => telemetry.emit({ event: "security.evidence_failed",
            severity: "error", outcome: "failed", correlationId: telemetryContext.correlationId,
            traceId: telemetryContext.traceId, category: "rate_limit" }));
        return;
      }
    }
    if (request.method === "GET" && url.pathname === "/healthz") {
      await pool.query("SELECT 1");
      await s3.send(new ListObjectsV2Command({ Bucket: s3Bucket, MaxKeys: 1 }));
      if (await media.health() !== "available") throw new Error("Media unavailable");
      if (contentScanner !== undefined && await contentScanner.health() !== "available") throw new Error("Malware scanner unavailable");
      if (Date.now() - serviceStartedAt > 60_000 &&
          (retentionLastSucceededAt === undefined || Date.now() - retentionLastSucceededAt > 26 * 60 * 60_000)) {
        throw new Error("Retention enforcement unavailable");
      }
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(`${JSON.stringify({ status: "ready", profile })}\n`); return;
    }
    if (request.method === "GET" && url.pathname === "/auth/login") {
      const recovery = url.searchParams.get("platformRecovery") === "1" || url.searchParams.has("platformAdminInvitation");
      const email = url.searchParams.get("email")?.trim().toLowerCase();
      const organization = url.searchParams.get("organization")?.trim().toLowerCase();
      if (!recovery && !email && !organization) {
        response.writeHead(302, { location: "/?signIn=1", "cache-control": "no-store" }); response.end(); return;
      }
      const configuration = recovery ? oidc : await resolveOrganizationIdentityProvider(pool,
        email ? { domain: email.split("@").at(-1) } : { slug: organization },
        new URL("/auth/callback", publicBaseUrl).toString(), randomUUID());
      const login = await beginOidcLogin(pool, configuration, {
        ...(url.searchParams.has("platformAdminInvitation") ? {
          platformAdministratorInvitationToken: url.searchParams.get("platformAdminInvitation") ?? ""
        } : {}),
        ...(url.searchParams.has("returnTo") ? { returnTo: url.searchParams.get("returnTo") ?? "" } : {}),
        stepUp: url.searchParams.get("stepUp") === "1",
        purpose: recovery ? "platform_recovery" : "sign_in"
      });
      response.writeHead(302, { location: login.authorizationUrl,
        "set-cookie": oidcLoginCookie(login.state, login.browserCredential), "cache-control": "no-store" }); response.end(); return;
    }
    if (request.method === "GET" && url.pathname === "/auth/callback") {
      const state = url.searchParams.get("state") ?? "";
      const browserCredential = readOidcLoginCookie(state, request.headers.cookie);
      if (/^[A-Za-z0-9_-]{43}$/u.test(state)) response.setHeader("set-cookie", oidcLoginCookie(state));
      if (browserCredential === undefined) throw authorizationError("UNAUTHENTICATED",
        "The OIDC login state is invalid or expired.", telemetryContext.correlationId);
      const resolved = await resolveIdentityProviderForLoginState(pool, state,
        new URL("/auth/callback", publicBaseUrl).toString(), randomUUID());
      const principal = await completeOidcLogin(pool, resolved?.configuration ?? oidc, { code: url.searchParams.get("code") ?? "",
        state, browserCredential, correlationId: telemetryContext.correlationId });
      const maxAge = Math.max(0, Math.floor((principal.expiresAt.getTime() - Date.now()) / 1000));
      response.writeHead(302, { location: validateOidcReturnTo(principal.returnTo ?? "/", publicBaseUrl),
        "set-cookie": [oidcLoginCookie(state), ...(principal.preserveSession === true ? [] :
          [`${cookieName}=${principal.authenticationSessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`])],
        "cache-control": "no-store" }); response.end(); return;
    }
    if (await api(request, response, telemetryContext.correlationId)) return;
    const studio = url.pathname.startsWith("/studio/");
    const relative = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/branding/") ? normalize(url.pathname.slice(1)) :
      studio && url.pathname.startsWith("/studio/assets/") ? normalize(url.pathname.slice("/studio/".length)) : "index.html";
    if (relative.startsWith("..")) throw new Error("Unsafe static path");
    const file = await readFile(join(studio ? studioRoot : webRoot, relative));
    response.writeHead(200, { "content-type": contentTypes[extname(relative)] ?? "application/octet-stream" });
    response.end(file);
  } catch (error) {
    if (error instanceof AuthorizationError && error.envelope.error.code === "UNAUTHENTICATED" && !response.headersSent) {
      response.writeHead(401,
        { "content-type": "application/json", "cache-control": "no-store" });
      response.end(`${JSON.stringify(error.envelope)}\n`); return;
    }
    if (error?.code === "ENOENT" && !response.headersSent) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("Not found\n"); return;
    }
    telemetry.emit({ event: "service.request_failed", severity: "error", outcome: "failed",
      correlationId: telemetryContext.correlationId, traceId: telemetryContext.traceId,
      method: telemetryContext.method, route: telemetryContext.route, category: "unhandled" });
    response.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
    response.end('{"error":"service_unavailable"}\n');
  } finally {
    telemetry.complete(telemetryContext, response);
  }
});
// Keep the collector endpoint on the private Compose network. The public
// listener deliberately continues to expose /internal/metrics only to its own
// loopback interface.
const metricsServer = createServer((request, response) => {
  if (request.method !== "GET" || request.url !== "/metrics") {
    response.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" });
    response.end('{"error":"not_found"}\n');
    return;
  }
  response.writeHead(200, {
    "content-type": "text/plain; version=0.0.4; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(telemetry.metrics());
});
server.on("upgrade", (request, socket, head) => void (async () => {
  const rule = classifyDeploymentRequest(request, trustedProxy);
  if (rule !== null && !(await consumeDeploymentRateLimit(pool, deploymentId, rule)).allowed) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  if (!await collaboration.handleUpgrade(request, socket, head)) socket.destroy();
})().catch(() => socket.destroy()));
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
metricsServer.listen(Number(process.env.METRICS_PORT ?? 9090), "0.0.0.0");
let retentionRunning = false;
async function enforceRetention() {
  if (retentionRunning) return;
  retentionRunning = true;
  const correlationId = randomUUID();
  try {
    const result = await runRetentionEnforcement(pool, oidc.organizationId, retentionActorPersonId, correlationId);
    retentionLastSucceededAt = Date.now();
    telemetry.emit({ event: "retention.enforcement_completed", severity: "info", outcome: "succeeded",
      correlationId, category: result.heldArtifacts > 0 ? "legal_holds_present" : "standard" });
  } catch {
    telemetry.emit({ event: "retention.enforcement_failed", severity: "error", outcome: "failed",
      correlationId, category: "scheduled_run" });
    await recordOperationalSecurityEvent(pool, { deploymentId, eventType: "retention.enforcement_failed",
      severity: "error", outcome: "failed", correlationId, category: "scheduled_run" })
      .catch(() => telemetry.emit({ event: "security.evidence_failed", severity: "error", outcome: "failed",
        correlationId, category: "retention_enforcement" }));
  } finally {
    retentionRunning = false;
  }
}
const retentionStart = setTimeout(() => void enforceRetention(), 30_000);
const retentionInterval = setInterval(() => void enforceRetention(), 24 * 60 * 60_000);
retentionStart.unref();
retentionInterval.unref();
const stopInjectWorker = startScheduledInjectWorker(pool, oidc.organizationId, deploymentId, (error, sessionId) => {
  const code = typeof error?.code === "string" && /^[A-Z0-9]{5}$/u.test(error.code) ? error.code : "unexpected";
  telemetry.emit({ event: "inject.schedule_failed", severity: "error", outcome: "failed", correlationId: randomUUID(),
    category: code, ...(sessionId === undefined ? {} : { sessionId }) });
});
let closing = false;
async function close() {
  if (closing) return; closing = true;
  clearTimeout(retentionStart); clearInterval(retentionInterval);
  await stopInjectWorker();
  await collaboration.close();
  server.closeAllConnections();
  metricsServer.closeAllConnections();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => metricsServer.close(resolve))
  ]);
  await pool.end();
}
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());

