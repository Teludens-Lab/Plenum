import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const image = process.env.PLENUM_APPLICATION_IMAGE ?? "plenum-platform:ps-530";
const build = spawnSync("docker", ["build", "--pull=false", "--tag", image, "--file", "deploy/compose/Dockerfile", "."], {
  encoding: "utf8", maxBuffer: 50 * 1024 * 1024
});
if (build.status !== 0) throw new Error(`Application image build failed:\n${build.stdout}\n${build.stderr}`);
const containerName = `plenum-ps530-smoke-${process.pid}`;
const environment = {
  PLENUM_DEPLOYMENT_PROFILE: "air_gapped", DATABASE_URL: "postgres://synthetic:synthetic@database:5432/plenum",
  S3_ENDPOINT: "http://storage:8333", S3_BUCKET: "plenum", OIDC_ISSUER: "https://identity.plenum.lan/realms/plenum",
  OIDC_PROVIDER_KEY: "synthetic", OIDC_ORGANIZATION_ID: "53000000-0000-4000-8000-000000000001",
  OIDC_CLIENT_ID: "plenum-web", OIDC_REDIRECT_URI: "https://plenum.plenum.lan/auth/callback",
  MEDIA_URL: "wss://media.plenum.lan", MEDIA_API_KEY: "synthetic", MEDIA_API_SECRET: "synthetic-media-secret",
  MEDIA_ADAPTER_DIGEST: `sha256:${"e".repeat(64)}`, PLENUM_DEPLOYMENT_ID: "53000000-0000-4000-8000-000000000007",
  PLENUM_PUBLIC_BASE_URL: "https://plenum.plenum.lan", INVITATION_DELIVERY_ENDPOINT: "https://notifications.plenum.lan/v1/messages",
  INVITATION_DELIVERY_BEARER_TOKEN: "synthetic-delivery-secret",
  INVITATION_DELIVERY_WEBHOOK_TOKEN: "synthetic-delivery-webhook-secret",
  PLENUM_RETENTION_ACTOR_PERSON_ID: "53000000-0000-4000-8000-000000000002",
  FLOOR_TOKEN_SECRET: "synthetic-floor-token-secret"
};
const launchArguments = ["run", "--detach", "--pull=never", "--name", containerName, "--network=none", "--read-only",
  "--user=65532:65532", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--tmpfs=/tmp:rw,noexec,nosuid,size=32m"];
for (const [name, value] of Object.entries(environment)) launchArguments.push("--env", `${name}=${value}`);
launchArguments.push(image);
const launched = spawnSync("docker", launchArguments, { encoding: "utf8" });
if (launched.status !== 0) throw new Error(`Application entrypoint failed to launch: ${launched.stderr}`);
try {
  let ready;
  for (let attempt = 0; attempt < 20 && ready?.status !== 0; attempt += 1) {
    ready = spawnSync("docker", ["exec", containerName, "node", "-e", `fetch('http://127.0.0.1:8080/').then(r=>{
      const expected={"content-security-policy":"default-src 'self'","permissions-policy":"microphone=(self)",
        "referrer-policy":"no-referrer","strict-transport-security":"max-age=31536000",
        "x-content-type-options":"nosniff","x-frame-options":"DENY"};
      process.exit(r.ok&&Object.entries(expected).every(([name,value])=>r.headers.get(name)?.includes(value))?0:1);
    }).catch(()=>process.exit(1))`]);
    if (ready.status !== 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  if (ready?.status !== 0) throw new Error("Application entrypoint did not serve the packaged UI");
} finally {
  spawnSync("docker", ["rm", "--force", containerName], { encoding: "utf8" });
}
const airGappedSessionRun = spawnSync("docker", ["run", "--rm", "--pull=never", "--network=none", "--read-only",
  "--user=65532:65532", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", image,
  "deploy/compose/airgap-session-smoke.mjs"], { encoding: "utf8" });
if (airGappedSessionRun.status !== 0) {
  throw new Error(`Air-gapped Session completion failed:\n${airGappedSessionRun.stdout}\n${airGappedSessionRun.stderr}`);
}
const airGappedSession = JSON.parse(airGappedSessionRun.stdout.trim());
if (airGappedSession.status !== "completed") throw new Error("Air-gapped Session did not complete");
const started = Date.now();
const run = spawnSync(process.execPath, ["--test", "tests/deployment/deployment-profiles.test.mjs"], {
  encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: { ...process.env, PLENUM_APPLICATION_IMAGE: image }
});
const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
const inspect = spawnSync("docker", ["image", "inspect", image, "--format", "{{.Id}}"], { encoding: "utf8" });
const evidence = {
  contractId: "deployment-smoke-evidence-v1",
  generatedAt: new Date().toISOString(),
  command: "npm run test:deployment",
  applicationImage: image,
  applicationImageId: inspect.stdout.trim(),
  profiles: ["cloud", "institutional", "air_gapped"],
  airGappedSession,
  evidenceIds: ["EXT-03", "EXT-04", "EXT-05", "VOTE-12", "VOICE-06", "PS-530-T01"],
  durationMs: Date.now() - started,
  exitCode: run.status,
  status: run.status === 0 ? "PASS" : "FAIL",
  outputSha256: createHash("sha256").update(output).digest("hex")
};
const directory = join(process.cwd(), "test-results", "deployment");
await mkdir(directory, { recursive: true });
const path = join(directory, "ps-530-smoke.json");
await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(output);
console.log(`CMD-DEPLOYMENT-SMOKE ${evidence.status}; evidence: ${path}`);
if (run.status !== 0) process.exitCode = run.status ?? 1;

