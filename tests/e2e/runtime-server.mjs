import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import {
  authorizationError,
  createDatabasePool,
  createRuntimeHttpHandler
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
const mediaAdapter = process.env.MEDIA_TEST_URL === undefined ? fakeMediaAdapter : new LiveKitLocalMediaProviderAdapter({
  apiUrl: process.env.MEDIA_TEST_URL,
  websocketUrl: process.env.MEDIA_TEST_URL.replace(/^http/u, "ws"),
  apiKey: "devkey",
  apiSecret: "secret",
  adapterDigest: `sha256:${"e".repeat(64)}`,
  allowedHosts: ["127.0.0.1"],
  allowInsecureLoopback: true
});
const principals = Object.fromEntries(Object.entries(fixture.tokens).map(([key, token]) => [token, {
  authenticationSessionId: fixture.authenticationSessions[key],
  principalId: fixture.people[key],
  organizationId: fixture.organizationId,
  organizationRoles: key === "operator" ? ["operator"] : [],
  authenticationStrength: "mfa",
  expiresAt: new Date("2099-01-01T00:00:00.000Z")
}]));

const api = createRuntimeHttpHandler({
  pool,
  deploymentId: fixture.deploymentId,
  mediaAdapter,
  floorTokenSecret: "synthetic-floor-token-secret-for-e2e-only",
  authenticate: async (request, correlationId) => {
    const authorization = request.headers.authorization;
    const principal = typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? principals[authorization.slice(7)]
      : undefined;
    if (principal === undefined) throw authorizationError("UNAUTHENTICATED", "A valid test identity is required.", correlationId);
    return principal;
  }
});

const webRoot = fileURLToPath(new URL("../../apps/runtime-web/dist/web/", import.meta.url));
const contentTypes = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8" };

const server = createServer(async (request, response) => {
  if (await api(request, response)) return;
  try {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const relative = pathname.startsWith("/assets/") ? normalize(pathname.slice(1)) : "index.html";
    if (relative.startsWith("..")) throw new Error("Unsafe static path");
    const file = await readFile(join(webRoot, relative));
    response.writeHead(200, { "content-type": contentTypes[extname(relative)] ?? "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(4173, "127.0.0.1", () => console.log("PS-150 browser fixture listening on http://127.0.0.1:4173"));

async function close() {
  server.close();
  await pool.end();
}
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
