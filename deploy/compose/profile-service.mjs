import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {
  authorizationError, beginOidcLogin, completeOidcLogin, createDatabasePool, createRuntimeHttpHandler,
  createStudioCollaborationGateway, S3ObjectStore
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
const s3Endpoint = required("S3_ENDPOINT");
const oidcIssuer = required("OIDC_ISSUER").replace(/\/$/u, "");
const mediaUrl = required("MEDIA_URL");
if (profile === "air_gapped" && [s3Endpoint, oidcIssuer, mediaUrl].some((value) => {
  const host = new URL(value).hostname;
  return !host.endsWith(".plenum.lan") && !["storage", "identity", "media"].includes(host);
})) throw new Error("Air-gapped dependencies must use institution-local endpoints");

const pool = createDatabasePool(databaseUrl);
const s3 = new S3Client({ endpoint: s3Endpoint, region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "0",
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  } } : {}) });
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
      array_agg(membership.organization_role ORDER BY membership.organization_role)::text[] AS organization_roles
    FROM identity.authentication_sessions session JOIN identity.memberships membership
      ON membership.organization_id=session.organization_id AND membership.person_id=session.person_id
    WHERE session.id=$1 AND session.revoked_at IS NULL AND session.expires_at>transaction_timestamp()
    GROUP BY session.id`, [token]);
  const row = result.rows[0];
  if (!row) throw authorizationError("UNAUTHENTICATED", "The authentication session is invalid or expired.", correlationId);
  return { authenticationSessionId: row.id, principalId: row.person_id, organizationId: row.organization_id,
    organizationRoles: row.organization_roles, authenticationStrength: row.authentication_strength, expiresAt: row.expires_at };
};
const mediaAdapter = media;
const api = createRuntimeHttpHandler({ pool, deploymentId: required("PLENUM_DEPLOYMENT_ID"), authenticate,
  objectStore: new S3ObjectStore(s3, s3Bucket), mediaAdapter, floorTokenSecret: required("FLOOR_TOKEN_SECRET") });
const collaboration = createStudioCollaborationGateway({ pool, authenticate });
const webRoot = fileURLToPath(new URL("../../apps/runtime-web/dist/web/", import.meta.url));
const studioRoot = fileURLToPath(new URL("../../apps/studio/dist/web/", import.meta.url));
const contentTypes = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8" };

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "https://plenum.invalid");
    if (request.method === "GET" && url.pathname === "/healthz") {
      await pool.query("SELECT 1");
      await s3.send(new ListObjectsV2Command({ Bucket: s3Bucket, MaxKeys: 1 }));
      if (await media.health() !== "available") throw new Error("Media unavailable");
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(`${JSON.stringify({ status: "ready", profile })}\n`); return;
    }
    if (request.method === "GET" && url.pathname === "/auth/login") {
      const login = await beginOidcLogin(pool, oidc);
      response.writeHead(302, { location: login.authorizationUrl, "cache-control": "no-store" }); response.end(); return;
    }
    if (request.method === "GET" && url.pathname === "/auth/callback") {
      const principal = await completeOidcLogin(pool, oidc, { code: url.searchParams.get("code") ?? "",
        state: url.searchParams.get("state") ?? "", correlationId: randomUUID() });
      const maxAge = Math.max(0, Math.floor((principal.expiresAt.getTime() - Date.now()) / 1000));
      response.writeHead(302, { location: "/", "set-cookie": `${cookieName}=${principal.authenticationSessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
        "cache-control": "no-store" }); response.end(); return;
    }
    if (await api(request, response)) return;
    const studio = url.pathname.startsWith("/studio/");
    const relative = url.pathname.startsWith("/assets/") ? normalize(url.pathname.slice(1)) :
      studio && url.pathname.startsWith("/studio/assets/") ? normalize(url.pathname.slice("/studio/".length)) : "index.html";
    if (relative.startsWith("..")) throw new Error("Unsafe static path");
    const file = await readFile(join(studio ? studioRoot : webRoot, relative));
    response.writeHead(200, { "content-type": contentTypes[extname(relative)] ?? "application/octet-stream",
      "content-security-policy": "default-src 'self'; connect-src 'self' wss:; img-src 'self' data:; style-src 'self'; script-src 'self'" });
    response.end(file);
  } catch {
    response.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
    response.end('{"error":"service_unavailable"}\n');
  }
});
server.on("upgrade", (request, socket, head) => void collaboration.handleUpgrade(request, socket, head).then((handled) => {
  if (!handled) socket.destroy();
}));
server.listen(Number(process.env.PORT ?? 8080), "0.0.0.0");
let closing = false;
async function close() {
  if (closing) return; closing = true;
  await collaboration.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await pool.end();
}
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());

