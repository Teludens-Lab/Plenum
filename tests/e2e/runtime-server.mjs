import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import {
  authorizationError,
  createStudioCollaborationGateway,
  createDatabasePool,
  createRuntimeHttpHandler,
  LocalObjectStore,
  startScheduledInjectWorker,
  withOrganizationTransaction
} from "../../apps/server/dist/index.js";
import { LiveKitLocalMediaProviderAdapter } from "../../packages/media-adapter/dist/index.js";
import { compileRelease } from "../../packages/release-compiler/dist/index.js";
import { fixture } from "./fixture.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) throw new Error("DATABASE_URL is required");
const localUserTest = process.argv.includes("--local-user-test");
const generalizationJourney = process.argv.includes("--generalization-journey");
const goldenJourney = process.argv.includes("--golden-journey") || generalizationJourney;
const seedUserTest = process.argv.includes("--seed-user-test");
const runtimePort = Number(process.env.PLENUM_E2E_PORT ?? 4173);
if (seedUserTest && !localUserTest) throw new Error("--seed-user-test requires --local-user-test");
if (seedUserTest) await (await import("./global-setup.mjs")).default();
const localUserTestCookieName = "plenum_ps700_identity";
const localOfflineCookie = "plenum_ps700_offline=1";
const userTestFixtureRoot = join(process.cwd(), "output", "user-test", "ps-740");
if (seedUserTest) {
  await mkdir(userTestFixtureRoot, { recursive: true });
  await Promise.all([
    writeFile(join(userTestFixtureRoot, "ps-740-safe.txt"), "Safe synthetic PS-740 governed content.\n"),
    writeFile(join(userTestFixtureRoot, "ps-740-eicar.txt"), "EICAR-STANDARD-ANTIVIRUS-TEST-FILE\n"),
    writeFile(join(userTestFixtureRoot, "ps-740-scanner-failure.txt"), "PS740-SCANNER-FAILURE\n"),
    writeFile(join(userTestFixtureRoot, "ps-740-oversized.txt"), Buffer.alloc(512 * 1024 + 1, 65))
  ]);
}
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
const roles = { operator: ["operator", "admin"], designerA: ["designer"], designerB: ["designer", "research_analyst"],
  publisher: ["designer", "publisher", "reviewer"], finalReviewer: ["reviewer"], portalOperator: ["operator"] };
const localPersonas = {
  designerA: { label: "Designer", description: "Create, find, archive, reopen, and resume Projects." },
  designerB: { label: "Designer B", description: "Collaborate on the same Project from a separate browser profile." },
  researchAnalyst: { label: "Research Analyst", description: "Generate consent-filtered, pseudonymized reports with source provenance.", tokenKey: "designerB" },
  operator: { label: "Admin", description: "Inspect Organization members and their Organization Roles." },
  finalReviewer: { label: "Reviewer", description: "Open assigned Project review work without mutation controls." },
  portalOperator: { label: "Operator only", description: "Find Releases, create configured Sessions, and verify Project data remains denied." },
  publisher: { label: "Publisher", description: "Find immutable Releases and verify Package export and import." },
  invitedParticipant: { label: "Invited Participant", description: "Accept an invitation, choose an eligible Seat, and enter the role-scoped Runtime." }
};
const principals = Object.fromEntries(Object.entries(fixture.tokens).map(([key, token]) => [token, {
  authenticationSessionId: fixture.authenticationSessions[key],
  principalId: fixture.people[key],
  organizationId: fixture.organizationId,
  organizationRoles: roles[key] ?? [],
  authenticationStrength: "mfa",
  expiresAt: new Date("2099-01-01T00:00:00.000Z")
}]));

const goldenDatabase = new URL(databaseUrl).pathname.slice(1);
if (goldenJourney && !(generalizationJourney ? /^plenum_ps840_browser[0-9]+$/u : /^plenum_ps830_g_browser[0-9]+$/u).test(goldenDatabase)) throw new Error("Journey server requires its dedicated database");
const objectRoot = goldenJourney ? join(process.cwd(), "output", "playwright", generalizationJourney ? "ps-840" : "golden-journey", "objects", goldenDatabase)
  : await mkdtemp(join(tmpdir(), "plenum-ps300-e2e-"));
const objectStore = new LocalObjectStore(objectRoot);
const contentScanner = {
  async scan(bytes) {
    const content = Buffer.from(bytes).toString("utf8");
    if (content.includes("PS740-SCANNER-FAILURE")) throw new Error("Synthetic scanner outage");
    return content.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
      ? { status: "infected", detail: "Synthetic scanner detected the EICAR test marker." }
      : { status: "clean", detail: "Synthetic loopback scanner found no malware marker." };
  }
};
let packagesSeeded = false;
let packageSeedPromise;
async function ensureFixturePackages() {
  if (goldenJourney) return; // Golden Packages exist only after publication through the product UI.
  if (packagesSeeded) return;
  if (packageSeedPromise !== undefined) return packageSeedPromise;
  packageSeedPromise = (async () => {
    let packageRows;
    try {
      packageRows = await withOrganizationTransaction(pool, fixture.organizationId, (client) => client.query(`SELECT release.id AS release_id,release.project_id,release.definition_revision_id,
      release.release_label,release.blob_key,release.package_sha256,revision.snapshot,manifest.manifest
      FROM registry.releases release
      JOIN studio.definition_revisions revision ON revision.organization_id=release.organization_id AND revision.id=release.definition_revision_id
      JOIN registry.package_manifests manifest ON manifest.organization_id=release.organization_id AND manifest.release_id=release.id
      WHERE release.organization_id=$1`, [fixture.organizationId]));
    } catch (error) {
      const schemaIsNotReady = error?.code === "42P01" ||
        (error?.code === "22023" && error?.message === 'role "plenum_app" does not exist');
      if (schemaIsNotReady) return;
      throw error;
    }
    for (const row of packageRows.rows) {
      const manifest = row.manifest;
      const compiled = compileRelease({ releaseId: row.release_id, projectId: row.project_id,
        definitionRevisionId: row.definition_revision_id, releaseLabel: row.release_label,
        semanticVersion: manifest.semanticVersion, methodologyVersion: manifest.methodologyVersion,
        materialization: row.snapshot, publishedBy: manifest.publishedBy, approvedBy: manifest.approvedBy,
        publishedAt: manifest.publishedAt, releaseNotes: manifest.releaseNotes, validationReportId: manifest.validationReportId });
      if (compiled.packageDigest !== row.package_sha256) throw new Error(`Fixture Package digest mismatch for ${row.release_id}`);
      await objectStore.putImmutable(row.blob_key, compiled.bytes, compiled.packageDigest);
    }
    packagesSeeded = packageRows.rowCount > 0;
  })().finally(() => { packageSeedPromise = undefined; });
  return packageSeedPromise;
}
function cookieValue(request, name) {
  const prefix = `${name}=`;
  const value = request.headers.cookie?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(prefix));
  try { return value === undefined ? undefined : decodeURIComponent(value.slice(prefix.length)); } catch { return undefined; }
}

const authenticate = async (request, correlationId) => {
  const authorization = request.headers.authorization;
  const persona = localUserTest ? cookieValue(request, localUserTestCookieName) : undefined;
  const personaKey = persona !== undefined && Object.hasOwn(localPersonas, persona) ? (localPersonas[persona].tokenKey ?? persona) : undefined;
  const cookieIdentity = personaKey === undefined ? undefined : fixture.tokens[personaKey];
  const token = typeof authorization === "string" && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : cookieIdentity;
  const principal = token === undefined ? undefined : principals[token];
  if (principal === undefined) throw authorizationError("UNAUTHENTICATED", "A valid test identity is required.", correlationId);
  return principal;
};
const api = createRuntimeHttpHandler({
  pool,
  deploymentId: fixture.deploymentId,
  mediaAdapter,
  objectStore,
  replayAdapter: { async replay(input) { return input; } },
  contentScanner,
  floorTokenSecret: "synthetic-floor-token-secret-for-e2e-only",
  publicBaseUrl: `http://127.0.0.1:${runtimePort}`,
  domainVerificationResolver: {
    async resolveTxt(name) {
      const result = await pool.query(
        "SELECT challenge_value FROM identity.organization_domains WHERE challenge_name=$1",
        [name]
      );
      return result.rows.map(({ challenge_value }) => challenge_value);
    }
  },
  firstAdminInvitationDelivery: {
    async deliver(input) {
      return { providerReference: `synthetic:${input.deliveryId}`, previewUrl: input.invitationUrl };
    }
  },
  invitationDeliveryWebhookToken: "synthetic-invitation-delivery-webhook-token",
  authenticate
});
const collaboration = createStudioCollaborationGateway({ pool, authenticate });

const webRoot = fileURLToPath(new URL("../../apps/runtime-web/dist/web/", import.meta.url));
const studioRoot = fileURLToPath(new URL("../../apps/studio/dist/web/", import.meta.url));
const contentTypes = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".html": "text/html; charset=utf-8" };

function safeReturnTo(value) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

async function personaPage(returnTo, error = "") {
  const webIndex = await readFile(join(webRoot, "index.html"), "utf8");
  const stylesheet = webIndex.match(/href="([^"]+\.css)"/u)?.[1];
  if (stylesheet === undefined) throw new Error("Runtime web stylesheet was not found");
  const choices = Object.entries(localPersonas).map(([value, persona]) =>
    `<option value="${value}">${persona.label}</option>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
    <meta name="color-scheme" content="light dark"><script>try{document.documentElement.dataset.theme=localStorage.getItem("plenum.theme")==="dark"?"dark":"light"}catch{document.documentElement.dataset.theme="light"}</script><title>Choose a test role / Plenum</title><link rel="stylesheet" href="${stylesheet}"></head>
    <body class="entry-auth-body"><a class="skip-link" href="#main-content">Skip to main content</a><header class="app-header entry-auth-header">
      <a class="brand-wordmark" href="/" aria-label="Plenum home"><img class="brand-wordmark-dark" src="/branding/plenum-wordmark-primary.png" alt="Plenum" width="2170" height="725"><img class="brand-wordmark-light" src="/branding/plenum-wordmark-primary.png" alt="" width="2170" height="725" aria-hidden="true"></a>
      <a class="entry-auth-close" href="/" aria-label="Close sign-in"><svg class="entry-close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg></a></header><main id="main-content" class="entry-auth-page" tabindex="-1">
      <section class="entry-auth-panel" aria-labelledby="entry-auth-title"><h1 id="entry-auth-title">Choose a test role</h1><p class="entry-auth-intro">Enter a seeded workspace as a synthetic user.</p>
      ${error === "" ? "" : `<p class="field-error" id="persona-error" role="alert">${error}</p>`}
      <form class="persona-form" method="post" action="/__test__/identity?returnTo=${encodeURIComponent(returnTo)}">
      <div class="field"><label for="persona">Test role</label><select id="persona" name="persona" required ${error === "" ? "" : "aria-describedby=\"persona-error\""}><option value="">Select a role</option>${choices}</select></div>
      <button class="entry-auth-submit" type="submit"><span>Continue</span><svg class="entry-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M14 7l5 5-5 5"/></svg></button></form>
      <p class="entry-auth-note">Synthetic data only.</p></section></main>
      <div class="plenum-loader-overlay" aria-hidden="true"><div class="plenum-loader" role="status" aria-live="polite" aria-atomic="true" aria-label="Resolving next state" aria-busy="true"><svg class="plenum-loader__star" viewBox="-16 -16 32 32" aria-hidden="true" focusable="false">${[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => `<line class="plenum-loader__petal" x1="0" y1="-6" x2="0" y2="-13" transform="rotate(${angle})"></line>`).join("")}</svg></div></div>
      <script>document.querySelector(".persona-form")?.addEventListener("submit",function(event){if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;event.preventDefault();var overlay=document.querySelector(".plenum-loader-overlay");overlay?.setAttribute("aria-hidden","false");overlay?.classList.add("is-visible");document.querySelector("#main-content")?.setAttribute("aria-busy","true");window.setTimeout(()=>this.submit(),160);});</script></body></html>`;
}

async function formBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024) throw new Error("User-test form is too large");
  }
  return new URLSearchParams(body);
}

const server = createServer(async (request, response) => {
  await ensureFixturePackages();
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  if (localUserTest && request.method === "GET" && ["/auth/login", "/__test__/personas"].includes(requestUrl.pathname)) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(await personaPage(safeReturnTo(requestUrl.searchParams.get("returnTo"))));
    return;
  }
  if (localUserTest && request.method === "POST" && requestUrl.pathname === "/__test__/identity") {
    const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"));
    const persona = (await formBody(request)).get("persona");
    if (persona === null || !Object.hasOwn(localPersonas, persona)) {
      response.writeHead(422, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(await personaPage(returnTo, "Choose one of the available synthetic personas."));
      return;
    }
    response.writeHead(303, { location: returnTo,
      "set-cookie": `${localUserTestCookieName}=${encodeURIComponent(persona)}; Path=/; HttpOnly; SameSite=Strict` });
    response.end();
    return;
  }
  if (localUserTest && request.method === "GET" && requestUrl.pathname === "/__test__/offline") {
    response.writeHead(303, { location: "/", "set-cookie": `${localOfflineCookie}; Path=/; HttpOnly; SameSite=Strict` });
    response.end();
    return;
  }
  if (localUserTest && request.method === "GET" && requestUrl.pathname === "/__test__/online") {
    response.writeHead(303, {
      location: "/",
      "set-cookie": "plenum_ps700_offline=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
    });
    response.end();
    return;
  }
  const localOffline = localUserTest && request.headers.cookie?.split(";").map((value) => value.trim()).includes(localOfflineCookie);
  if (localOffline && requestUrl.pathname.startsWith("/v1/")) {
    request.socket.destroy();
    return;
  }
  if (localUserTest && request.method === "POST" && requestUrl.pathname === "/v1/auth/logout") {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `${localUserTestCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
    });
    response.end(JSON.stringify({ signedOut: true }));
    return;
  }
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

server.listen(runtimePort, "127.0.0.1", () => console.log(
  `${localUserTest ? "PS-710 through PS-790 local user-test" : "PS-150 browser fixture"} listening on http://127.0.0.1:${runtimePort}${localUserTest ? `; PS-740 files: ${userTestFixtureRoot}; PS-790 files: ${join(process.cwd(), "output", "user-test", "ps-790")}` : ""}`
));

const stopInjectWorker = startScheduledInjectWorker(pool, fixture.organizationId, fixture.deploymentId, (error, sessionId) => {
  const code = typeof error?.code === "string" && /^[A-Z0-9]{5}$/u.test(error.code) ? error.code : "unexpected";
  console.error(JSON.stringify({ event: "inject.schedule_failed", code, sessionId }));
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  const forcedExit = setTimeout(() => process.exit(0), 2_000);
  try {
    await stopInjectWorker();
    await collaboration.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
    if (!goldenJourney) await rm(objectRoot, { recursive: true, force: true });
  } finally {
    clearTimeout(forcedExit);
    process.exit(0);
  }
}
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
