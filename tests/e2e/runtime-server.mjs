import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import {
  authorizationError,
  createStudioCollaborationGateway,
  createDatabasePool,
  createRuntimeHttpHandler,
  LocalObjectStore
} from "../../apps/server/dist/index.js";
import { LiveKitLocalMediaProviderAdapter } from "../../packages/media-adapter/dist/index.js";
import { fixture } from "./fixture.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
const pool = createDatabasePool(databaseUrl);
const fakeMediaAdapter = {
  id: "e2e-local-media",
  version: "e2e-v1",
  digest: `sha256:${"e".repeat(64)}`,
  async issueCredential(input) {
    return { contractId: "media-credential-v1", providerAdapterId: this.id, providerAdapterVersion: this.version,
      providerAdapterDigest: this.digest, serverUrl: "wss://media.plenum.invalid", room: input.channelId,
      participantIdentity: input.participantId, token: "synthetic-non-secret-token", permissions: input.permissions,
      expiresAt: new Date(Date.now() + 30_000).toISOString() };
  },
  async setTransmit() {}, async removeParticipant() {}, async closeChannel() {}, async health() { return "available"; }
};
async function createMediaAdapter() {
  const mediaUrl = process.env.MEDIA_TEST_URL;
  if (mediaUrl === undefined) return fakeMediaAdapter;
  const endpoint = new URL(mediaUrl);
  const loopback = ["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname);
  let apiKey = "devkey", apiSecret = "secret";
  if (!loopback) {
    const operatorFile = process.env.MEDIA_TEST_OPERATOR_FILE;
    if (operatorFile === undefined || !isAbsolute(operatorFile)) {
      throw new Error("MEDIA_TEST_OPERATOR_FILE must be an absolute path for non-loopback media");
    }
    const values = {};
    for (const rawLine of (await readFile(operatorFile, "utf8")).split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (line.length === 0) continue;
      const separator = line.indexOf("=");
      const name = separator < 1 ? "" : line.slice(0, separator);
      if (!["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"].includes(name) || values[name] !== undefined) {
        throw new Error("The media operator file has an invalid or duplicate field");
      }
      values[name] = line.slice(separator + 1);
    }
    if (typeof values.LIVEKIT_URL !== "string" || typeof values.LIVEKIT_API_KEY !== "string" ||
        typeof values.LIVEKIT_API_SECRET !== "string" || values.LIVEKIT_API_KEY.length === 0 ||
        values.LIVEKIT_API_SECRET.length < 16 || new URL(values.LIVEKIT_URL).origin !== endpoint.origin) {
      throw new Error("The media operator file is incomplete or does not match MEDIA_TEST_URL");
    }
    apiKey = values.LIVEKIT_API_KEY;
    apiSecret = values.LIVEKIT_API_SECRET;
  }
  return new LiveKitLocalMediaProviderAdapter({
    apiUrl: mediaUrl, websocketUrl: mediaUrl.replace(/^http/u, "ws"), apiKey, apiSecret,
    adapterDigest: `sha256:${"e".repeat(64)}`, allowedHosts: [endpoint.hostname], allowInsecureLoopback: loopback
  });
}
const mediaAdapter = await createMediaAdapter();
const roles = { operator: ["operator", "admin"], designerA: ["designer"], designerB: ["designer", "research_analyst"], publisher: ["designer", "publisher", "reviewer"] };
const principals = Object.fromEntries(Object.entries(fixture.tokens).map(([key, token]) => [token, {
  authenticationSessionId: fixture.authenticationSessions[key],
  principalId: fixture.people[key],
  organizationId: fixture.organizationId,
  organizationRoles: roles[key] ?? [],
  authenticationStrength: "mfa",
  expiresAt: new Date("2099-01-01T00:00:00.000Z")
}]));

const objectRoot = await mkdtemp(join(tmpdir(), "plenum-ps300-e2e-"));
const authenticate = async (request, correlationId) => {
  const authorization = request.headers.authorization;
  const principal = typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? principals[authorization.slice(7)]
    : undefined;
  if (principal === undefined) throw authorizationError("UNAUTHENTICATED", "A valid test identity is required.", correlationId);
  return principal;
};
const api = createRuntimeHttpHandler({
  pool,
  deploymentId: fixture.deploymentId,
  mediaAdapter,
  objectStore: new LocalObjectStore(objectRoot),
  floorTokenSecret: "synthetic-floor-token-secret-for-e2e-only",
  authenticate
});
const collaboration = createStudioCollaborationGateway({ pool, authenticate });

const webRoot = fileURLToPath(new URL("../../apps/runtime-web/dist/web/", import.meta.url));
const studioRoot = fileURLToPath(new URL("../../apps/studio/dist/web/", import.meta.url));
const contentTypes = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8" };

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/__test__/shutdown") {
    response.writeHead(204);
    response.end();
    setImmediate(() => void close());
    return;
  }
  if (await api(request, response)) return;
  try {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const studio = pathname.startsWith("/studio/");
    const relative = pathname.startsWith("/assets/") || pathname.startsWith("/branding/") ? normalize(pathname.slice(1)) :
      studio && pathname.startsWith("/studio/assets/") ? normalize(pathname.slice("/studio/".length)) : "index.html";
    if (relative.startsWith("..")) throw new Error("Unsafe static path");
    const file = await readFile(join(studio ? studioRoot : webRoot, relative));
    response.writeHead(200, { "content-type": contentTypes[extname(relative)] ?? "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});
server.on("upgrade", (request, socket, head) => void collaboration.handleUpgrade(request, socket, head).then((handled) => {
  if (!handled) socket.destroy();
}));

server.listen(4173, "127.0.0.1", () => console.log("PS-150 browser fixture listening on http://127.0.0.1:4173"));

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  const forcedExit = setTimeout(() => process.exit(0), 2_000);
  try {
    await collaboration.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    await rm(objectRoot, { recursive: true, force: true });
  } finally {
    clearTimeout(forcedExit);
    process.exit(0);
  }
}
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
