import { randomUUID } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const databaseContainer = `plenum-ps820-db-${suffix}`;
const network = `plenum-ps820-${suffix}`;
const currentImage = process.env.PLENUM_APPLICATION_IMAGE ?? `plenum-platform:ps-820-${suffix}`;
const previousImage = process.env.PLENUM_PREVIOUS_APPLICATION_IMAGE ?? "ghcr.io/teludens-lab/plenum:staging-20261105-eb78bc8";
const databasePassword = "synthetic-ps820-database-password";
const profiles = ["cloud", "institutional", "air_gapped"];
const startedAt = Date.now();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, ...options });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result.stdout.trim();
}

function inspectImage(image) {
  return run("docker", ["image", "inspect", image, "--format", "{{.Id}}"]).trim();
}

function databaseArgs(image) {
  return ["run", "--rm", "--pull=never", "--network", network, "--entrypoint", "psql",
    "--env", `PGPASSWORD=${databasePassword}`, image, "-h", "database", "-U", "plenum_owner", "-d", "plenum",
    "-v", "ON_ERROR_STOP=1"];
}

function applyMigration(image, path) {
  run("docker", [...databaseArgs(image), "-f", path]);
}

function query(image, sql) {
  return run("docker", [...databaseArgs(image), "--tuples-only", "--no-align", "-c", sql]);
}

function imageMigrationNumbers(image) {
  const output = run("docker", ["run", "--rm", "--pull=never", "--entrypoint", "sh", image, "-c",
    "find /app/references/plenum-runtime-slice/migrations /app/apps/server/migrations -maxdepth 1 -type f -name '*.sql' -print"]);
  return new Set(output.split(/\r?\n/u).flatMap((path) => {
    const match = basename(path).match(/^(\d{3})_/u);
    return match === null ? [] : [Number(match[1])];
  }));
}

async function currentMigrations() {
  const files = [];
  for (const directory of ["references/plenum-runtime-slice/migrations", "apps/server/migrations"]) {
    for (const name of await readdir(directory)) {
      const match = name.match(/^(\d{3})_.*\.sql$/u);
      if (match !== null) files.push({ number: Number(match[1]), path: `/app/${directory}/${name}` });
    }
  }
  return files.sort((left, right) => left.number - right.number);
}

function applicationEnvironment(profile) {
  return {
    PLENUM_DEPLOYMENT_PROFILE: profile,
    DATABASE_URL: `postgres://plenum_owner:${databasePassword}@database:5432/plenum`,
    S3_ENDPOINT: "http://storage:8333", S3_BUCKET: "plenum",
    OIDC_ISSUER: "https://identity.plenum.lan/realms/plenum", OIDC_PROVIDER_KEY: "synthetic-keycloak",
    OIDC_ORGANIZATION_ID: "82000000-0000-4000-8000-000000000001", OIDC_CLIENT_ID: "plenum-web",
    OIDC_REDIRECT_URI: "https://plenum.plenum.lan/auth/callback", MEDIA_URL: "wss://media.plenum.lan",
    MEDIA_API_URL: "https://media.plenum.lan", MEDIA_API_KEY: "synthetic-key", MEDIA_API_SECRET: "synthetic-media-secret",
    MEDIA_ADAPTER_DIGEST: `sha256:${"e".repeat(64)}`, PLENUM_PUBLIC_BASE_URL: "https://plenum.plenum.lan",
    INVITATION_DELIVERY_ENDPOINT: "https://notifications.plenum.lan/v1/messages",
    INVITATION_DELIVERY_BEARER_TOKEN: "synthetic-delivery-secret",
    INVITATION_DELIVERY_WEBHOOK_TOKEN: "synthetic-delivery-webhook-secret",
    PLENUM_DEPLOYMENT_ID: "82000000-0000-4000-8000-000000000002",
    PLENUM_RETENTION_ACTOR_PERSON_ID: "82000000-0000-4000-8000-000000000003",
    FLOOR_TOKEN_SECRET: "synthetic-floor-token-secret"
  };
}

function verifyShell(image, profile, label) {
  const container = `plenum-ps820-app-${suffix}`;
  const args = ["run", "--detach", "--pull=never", "--name", container, "--network", network,
    "--read-only", "--user", "65532:65532", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
    "--tmpfs=/tmp:rw,noexec,nosuid,size=32m"];
  for (const [name, value] of Object.entries(applicationEnvironment(profile))) args.push("--env", `${name}=${value}`);
  args.push(image, "deploy/compose/profile-service.mjs");
  run("docker", args);
  let ready = false;
  let failureLogs = "";
  try {
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      const result = spawnSync("docker", ["exec", container, "node", "-e",
        "fetch('http://127.0.0.1:8080/').then(async r=>process.exit(r.ok&&(await r.text()).includes('id=\\\"root\\\"')?0:1)).catch(()=>process.exit(1))"],
      { encoding: "utf8" });
      ready = result.status === 0;
      if (!ready) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
    if (!ready) {
      const logs = spawnSync("docker", ["logs", container], { encoding: "utf8" });
      failureLogs = `${logs.stdout ?? ""}${logs.stderr ?? ""}`.trim();
    }
  } finally {
    spawnSync("docker", ["rm", "--force", container], { encoding: "utf8" });
  }
  if (!ready) throw new Error(`${label} did not reach the product shell:\n${failureLogs}`);
}

let currentImageCreated = false;
try {
  inspectImage(previousImage);
  run("docker", ["build", "--pull=false", "--tag", currentImage, "--file", "deploy/compose/Dockerfile", "."]);
  currentImageCreated = true;
  const previousImageId = inspectImage(previousImage);
  const currentImageId = inspectImage(currentImage);
  run("docker", ["network", "create", network]);
  run("docker", ["run", "--detach", "--pull=never", "--name", databaseContainer, "--network", network,
    "--network-alias", "database", "--env", "POSTGRES_USER=plenum_owner", "--env", `POSTGRES_PASSWORD=${databasePassword}`,
    "--env", "POSTGRES_DB=plenum", "postgres:18.6-alpine"]);
  let databaseReady = false;
  for (let attempt = 0; attempt < 60 && !databaseReady; attempt += 1) {
    const result = spawnSync("docker", ["exec", databaseContainer, "pg_isready", "-U", "plenum_owner", "-d", "plenum"], { encoding: "utf8" });
    databaseReady = result.status === 0;
    if (!databaseReady) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  if (!databaseReady) throw new Error("Disposable PostgreSQL did not become ready");
  run("docker", ["exec", databaseContainer, "psql", "-U", "plenum_owner", "-d", "plenum", "-v", "ON_ERROR_STOP=1",
    "-c", "CREATE ROLE plenum_app NOLOGIN"]);

  const previousNumbers = imageMigrationNumbers(previousImage);
  const migrations = await currentMigrations();
  for (const migration of migrations.filter(({ number }) => previousNumbers.has(number))) applyMigration(previousImage, migration.path);
  query(previousImage, `INSERT INTO identity.organizations(id,name) VALUES ('82000000-0000-4000-8000-000000000010','PS-820 upgrade preservation fixture')`);
  verifyShell(previousImage, "institutional", "Prior application on prior schema");

  const forwardFixMigrations = migrations.filter(({ number }) => !previousNumbers.has(number));
  if (forwardFixMigrations.length === 0) throw new Error("The prior image has no older schema boundary to rehearse");
  for (const migration of forwardFixMigrations) applyMigration(currentImage, migration.path);
  if (query(currentImage, "SELECT count(*) FROM identity.organizations WHERE id='82000000-0000-4000-8000-000000000010'") !== "1") {
    throw new Error("The upgrade did not preserve representative Organization data");
  }
  if (query(currentImage, "SELECT to_regclass('evidence.operational_security_event_feed') IS NOT NULL") !== "t") {
    throw new Error("The forward-fix migration did not create the expected current schema");
  }
  verifyShell(previousImage, "institutional", "Prior application after additive schema upgrade");
  for (const profile of profiles) verifyShell(currentImage, profile, `Current ${profile} profile`);

  const evidence = {
    contractId: "clean-install-evidence-v1",
    generatedAt: new Date().toISOString(),
    command: "npm run test:clean-install",
    status: "PASS",
    evidenceIds: ["PS-820-T01", "REQ-005", "REQ-065"],
    currentImage: { reference: currentImage, id: currentImageId },
    previousImage: { reference: previousImage, id: previousImageId, migrationCount: previousNumbers.size },
    migrations: { appliedFromPrevious: previousNumbers.size, forwardFixed: forwardFixMigrations.map(({ number }) => number) },
    profiles,
    assertions: {
      emptyDatabaseMigrated: true,
      priorImageReachedProductShell: true,
      representativeDataPreserved: true,
      priorImageCompatibleAfterAdditiveUpgrade: true,
      currentImageReachedProductShellInEveryProfile: true,
      schemaRollbackAttempted: false,
      rollbackPolicy: "Redeploy the prior image only while additive schema compatibility holds; otherwise forward-fix. Never roll schema back."
    },
    durationMs: Date.now() - startedAt
  };
  const evidenceDirectory = join(process.cwd(), "test-results", "clean-install");
  await mkdir(evidenceDirectory, { recursive: true });
  const evidencePath = join(evidenceDirectory, "ps-820-clean-install.json");
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`CMD-CLEAN-INSTALL PASS; evidence: ${evidencePath}`);
} finally {
  spawnSync("docker", ["rm", "--force", databaseContainer], { encoding: "utf8" });
  spawnSync("docker", ["network", "rm", network], { encoding: "utf8" });
  if (currentImageCreated) spawnSync("docker", ["image", "rm", currentImage], { encoding: "utf8" });
}
