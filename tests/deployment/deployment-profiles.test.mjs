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
  PLENUM_PUBLIC_BASE_URL: "https://plenum.plenum.lan",
  INVITATION_DELIVERY_ENDPOINT: "https://notifications.plenum.lan/v1/messages",
  INVITATION_DELIVERY_BEARER_TOKEN: "synthetic-delivery-secret",
  INVITATION_DELIVERY_WEBHOOK_TOKEN: "synthetic-delivery-webhook-secret",
  PLENUM_DEPLOYMENT_ID: "53000000-0000-4000-8000-000000000007",
  PLENUM_RETENTION_ACTOR_PERSON_ID: "53000000-0000-4000-8000-000000000002",
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
  LIVEKIT_KEYS_FILE: "synthetic/livekit-keys.yaml",
  PLENUM_LAB_BIND_IP: "192.0.2.10",
  PLENUM_LAB_LIVEKIT_CONFIG_FILE: "C:/synthetic/livekit.yaml",
  PLENUM_LAB_TLS_CERT_FILE: "C:/synthetic/media-tls.crt",
  PLENUM_LAB_TLS_KEY_FILE: "C:/synthetic/media-tls.key"
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
  assert.deepEqual(institutional.services.database.command, [
    "postgres", "-c", "wal_buffers=16MB", "-c", "checkpoint_timeout=15min", "-c", "max_wal_size=4GB"
  ]);
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

test("PS-545 representative media lab pins its proxy and forces the Windows client through TURN/TLS", async () => {
  const lab = profile("deploy/media-lab/compose.yaml");
  assert.match(lab.services.gateway.image, /^nginx:1\.29\.2-alpine@sha256:[0-9a-f]{64}$/u);
  assert.match(lab.services.media.image, /^livekit\/livekit-server:v1\.13\.10@sha256:[0-9a-f]{64}$/u);
  assert.equal(lab.services.gateway.read_only, true);
  assert.deepEqual(lab.services.gateway.cap_drop, ["ALL"]);
  assert.deepEqual(lab.services.media.command, ["--config", "/etc/livekit.yaml"]);
  const published = Object.values(lab.services).flatMap((service) => service.ports ?? [])
    .map(({ published: port, protocol }) => `${port}/${protocol}`).sort();
  assert.deepEqual(published, ["443/tcp", ...Array.from({ length: 101 }, (_, index) => `${50_000 + index}/udp`),
    "7881/tcp", "8443/tcp"].sort());
  const firewall = await readFile("deploy/media-lab/force-turn-tls-linux.sh", "utf8");
  assert.match(firewall, /--ctorigdst "\$host_ip" --ctorigdstport 443 -j ACCEPT/u);
  assert.match(firewall, /--ctorigdst "\$host_ip" --ctorigdstport 8443 -j ACCEPT/u);
  assert.match(firewall, /-p tcp --dport 7881 -j REJECT/u);
  assert.match(firewall, /-p udp -j REJECT/u);
  const setup = await readFile("deploy/media-lab/setup-linux-host.sh", "utf8");
  assert.match(setup, /tls_port: 443/u);
  assert.match(setup, /allow_restricted_peer_cidrs:\s*\n\s*- \$host_ip\/32/u);
  assert.match(setup, /LIVEKIT_URL=https:\/\/media\.plenum\.lan:8443/u);
});

test("PS-545 acceptance soak reuses the reference database with the institutional PostgreSQL settings", () => {
  const override = profile("references/plenum-runtime-slice/docker-compose.yml",
    "deploy/load-fixtures/compose.postgres-tuned.yaml");
  assert.deepEqual(override.services.postgres.command, [
    "postgres", "-c", "wal_buffers=16MB", "-c", "checkpoint_timeout=15min", "-c", "max_wal_size=4GB"
  ]);
});

