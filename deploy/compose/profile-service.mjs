import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {
  authorizationError, beginOidcLogin, classifyDeploymentRequest, completeOidcLogin, consumeDeploymentRateLimit,
  createDatabasePool, createRuntimeHttpHandler, createStudioCollaborationGateway, runRetentionEnforcement, S3ObjectStore,
  PostmarkInvitationAdapter, WebhookFirstAdminInvitationDelivery, resolveIdentityProviderForLoginState, resolveOrganizationIdentityProvider,
  createSystemIdentityMetadataFetcher
} from "../../apps/server/dist/index.js";
import { LiveKitLocalMediaProviderAdapter } from "../../packages/media-adapter/dist/index.js";

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
  firstAdminInvitationDelivery, invitationDeliveryBearerToken, invitationDeliveryWebhookToken,
  ...(notificationsHostname && postmarkInvitationAdapter ? { notificationsHostname, postmarkInvitationAdapter } : {}), publicBaseUrl,
  identityMetadataFetcher: createSystemIdentityMetadataFetcher({ allowPrivateNetworks: profile !== "cloud" }) });
const collaboration = createStudioCollaborationGateway({ pool, authenticate });
const webRoot = fileURLToPath(new URL("../../apps/runtime-web/dist/web/", import.meta.url));
const studioRoot = fileURLToPath(new URL("../../apps/studio/dist/web/", import.meta.url));
const contentTypes = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8" };
const securityHeaders = {
  "content-security-policy": "default-src 'self'; connect-src 'self' wss:; img-src 'self' data:; style-src 'self'; script-src 'self'",
  "permissions-policy": "camera=(), geolocation=(), microphone=(self)",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};
const serviceStartedAt = Date.now();
let retentionLastSucceededAt;

const server = createServer(async (request, response) => {
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
  try {
    const url = new URL(request.url ?? "/", "https://plenum.invalid");
    const rateLimitRule = classifyDeploymentRequest(request, trustedProxy);
    if (rateLimitRule !== null) {
      const decision = await consumeDeploymentRateLimit(pool, deploymentId, rateLimitRule);
      response.setHeader("x-ratelimit-limit", String(rateLimitRule.limit));
      response.setHeader("x-ratelimit-remaining", String(decision.remaining));
      if (!decision.allowed) {
        const correlationId = randomUUID();
        response.writeHead(429, { "content-type": "application/json", "cache-control": "no-store",
          "retry-after": String(decision.retryAfterSeconds) });
        response.end(`${JSON.stringify(authorizationError("RATE_LIMITED", "Request rate limit exceeded.", correlationId).envelope)}\n`);
        console.warn(JSON.stringify({ event: "security.rate_limit_exceeded", correlationId,
          deploymentId, category: rateLimitRule.category }));
        return;
      }
    }
    if (request.method === "GET" && url.pathname === "/healthz") {
      await pool.query("SELECT 1");
      await s3.send(new ListObjectsV2Command({ Bucket: s3Bucket, MaxKeys: 1 }));
      if (await media.health() !== "available") throw new Error("Media unavailable");
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
      response.writeHead(302, { location: login.authorizationUrl, "cache-control": "no-store" }); response.end(); return;
    }
    if (request.method === "GET" && url.pathname === "/auth/callback") {
      const state = url.searchParams.get("state") ?? "";
      const resolved = await resolveIdentityProviderForLoginState(pool, state,
        new URL("/auth/callback", publicBaseUrl).toString(), randomUUID());
      const principal = await completeOidcLogin(pool, resolved?.configuration ?? oidc, { code: url.searchParams.get("code") ?? "",
        state, correlationId: randomUUID() });
      const maxAge = Math.max(0, Math.floor((principal.expiresAt.getTime() - Date.now()) / 1000));
      response.writeHead(302, { location: principal.returnTo ?? "/",
        ...(principal.preserveSession === true ? {} : { "set-cookie": `${cookieName}=${principal.authenticationSessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}` }),
        "cache-control": "no-store" }); response.end(); return;
    }
    if (await api(request, response)) return;
    const studio = url.pathname.startsWith("/studio/");
    const relative = url.pathname.startsWith("/assets/") ? normalize(url.pathname.slice(1)) :
      studio && url.pathname.startsWith("/studio/assets/") ? normalize(url.pathname.slice("/studio/".length)) : "index.html";
    if (relative.startsWith("..")) throw new Error("Unsafe static path");
    const file = await readFile(join(studio ? studioRoot : webRoot, relative));
    response.writeHead(200, { "content-type": contentTypes[extname(relative)] ?? "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
    response.end('{"error":"service_unavailable"}\n');
  }
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
let retentionRunning = false;
async function enforceRetention() {
  if (retentionRunning) return;
  retentionRunning = true;
  const correlationId = randomUUID();
  try {
    const result = await runRetentionEnforcement(pool, oidc.organizationId, retentionActorPersonId, correlationId);
    retentionLastSucceededAt = Date.now();
    console.info(JSON.stringify({ event: "retention.enforcement_completed", correlationId, ...result }));
  } catch (error) {
    console.error(JSON.stringify({ event: "retention.enforcement_failed", correlationId,
      message: error instanceof Error ? error.message : "unknown error" }));
  } finally {
    retentionRunning = false;
  }
}
const retentionStart = setTimeout(() => void enforceRetention(), 30_000);
const retentionInterval = setInterval(() => void enforceRetention(), 24 * 60 * 60_000);
retentionStart.unref();
retentionInterval.unref();
let closing = false;
async function close() {
  if (closing) return; closing = true;
  clearTimeout(retentionStart); clearInterval(retentionInterval);
  await collaboration.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await pool.end();
}
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());

