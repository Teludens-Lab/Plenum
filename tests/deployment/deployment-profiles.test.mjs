import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { assertRuntimeCoreDesign } from "@plenum/simulation-schema";
import { restoreDeploymentBackup } from "../../scripts/deployment-backup-lib.mjs";

const image = process.env.PLENUM_APPLICATION_IMAGE ?? "plenum-platform:ps-530";
const environment = {
  ...process.env,
  PLENUM_APPLICATION_IMAGE: image,
  PLENUM_DEPLOYMENT_PROFILE: "cloud",
  DATABASE_URL: "postgres://plenum_app:synthetic@database:5432/plenum",
  S3_ENDPOINT: "http://storage:8333",
  S3_BUCKET: "plenum",
  OIDC_ISSUER: "https://identity.plenum.lan/realms/plenum",
  OIDC_PROVIDER_KEY: "synthetic-keycloak",
  OIDC_ORGANIZATION_ID: "53000000-0000-4000-8000-000000000001",
  OIDC_CLIENT_ID: "plenum-web",
  OIDC_REDIRECT_URI: "https://plenum.plenum.lan/auth/callback",
  MEDIA_URL: "wss://media.plenum.lan:7880",
  MEDIA_API_KEY: "synthetic-key",
  MEDIA_API_SECRET: "synthetic-media-secret",
  MEDIA_ADAPTER_DIGEST: `sha256:${"e".repeat(64)}`,
  PLENUM_DEPLOYMENT_ID: "53000000-0000-4000-8000-000000000007",
  FLOOR_TOKEN_SECRET: "synthetic-floor-token-secret",
  POSTGRES_USER: "plenum_owner",
  POSTGRES_PASSWORD_FILE: "synthetic/postgres-password",
  KEYCLOAK_ADMIN_USERNAME: "synthetic-admin",
  KEYCLOAK_ADMIN_PASSWORD: "synthetic-admin-password",
  KEYCLOAK_DATABASE_URL: "jdbc:postgresql://database:5432/plenum",
  KEYCLOAK_DATABASE_USERNAME: "plenum_owner",
  KEYCLOAK_DATABASE_PASSWORD: "synthetic-database-password",
  KEYCLOAK_HOSTNAME: "identity.plenum.lan",
  KEYCLOAK_TLS_CERTIFICATE: "synthetic/identity-tls.crt",
  KEYCLOAK_TLS_PRIVATE_KEY: "synthetic/identity-tls.key",
  LIVEKIT_KEYS_FILE: "synthetic/livekit-keys.yaml"
};

function profile(...files) {
  const args = files.flatMap((file) => ["-f", file]);
  const result = spawnSync("docker", ["compose", ...args, "config", "--format", "json"], { encoding: "utf8", env: environment });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("PS-530-T01 runs the identical application image in cloud, institutional, and air-gapped profiles", () => {
  const cloud = profile("deploy/compose/compose.yaml", "deploy/compose/compose.cloud.yaml");
  const institutional = profile("deploy/compose/compose.yaml", "deploy/compose/compose.institutional.yaml");
  const airGapped = profile("deploy/compose/compose.yaml", "deploy/compose/compose.institutional.yaml", "deploy/compose/compose.air-gapped.yaml");
  for (const configured of [cloud, institutional, airGapped]) {
    assert.equal(configured.services.application.image, image);
  }
  assert.equal(airGapped.networks.plenum.internal, true);
  for (const service of [institutional.services.database, institutional.services.storage,
    institutional.services.identity, institutional.services.media]) assert.match(service.image, /@sha256:[0-9a-f]{64}$/u);
});

test("EXT-03 EXT-04 EXT-05 block an external-required Plugin in the air-gapped profile without a local replacement", async () => {
  const release = JSON.parse(await readFile("definitions/fractured-order/fractured-order-release.json", "utf8"));
  release.coreDesign.pluginBindings = [{
    id: "external-synthetic", pluginId: "org.plenum.synthetic.external", pluginVersion: "1.0.0",
    pluginDigest: `sha256:${"a".repeat(64)}`, installationId: "synthetic-installation", categories: [],
    connectivity: "external_required", configuration: {}, configurationDigest: "b".repeat(64), inputMappings: [],
    timeoutSeconds: 5, enabledInProfiles: ["air_gapped"]
  }];
  assert.throws(() => assertRuntimeCoreDesign(release.coreDesign), /verified local replacement/u);
});

test("VOTE-12 VOICE-06 application image starts with a denied public network and contains local media configuration", async () => {
  const run = spawnSync("docker", ["run", "--rm", "--pull=never", "--network=none", "--read-only",
    "--user=65532:65532", "--cap-drop=ALL", "--security-opt=no-new-privileges:true", image,
    "-e", "process.stdout.write(process.version)"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^v24\./u);
  const media = await readFile("deploy/media/livekit.yaml", "utf8");
  assert.match(media, /use_external_ip:\s*false/u);
  assert.doesNotMatch(media, /stun|\.com|\.net|\.org/u);
});

test("PS-530-T02 refuses a restore unless the target is explicitly marked disposable", async () => {
  await assert.rejects(restoreDeploymentBackup({}), /PLENUM_DISPOSABLE_RESTORE=1/u);
});

