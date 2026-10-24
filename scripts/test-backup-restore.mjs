import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeleteBucketCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const sourceDatabase = `plenum_ps530_source_${suffix}`;
const restoreDatabase = `plenum_ps530_restore_${suffix}`;
const sourceBucket = `plenum-ps530-source-${suffix}`;
const restoreBucket = `plenum-ps530-restore-${suffix}`;
const ownerUrl = new URL(process.env.PLENUM_RECOVERY_DATABASE_ADMIN_URL ?? "postgres://plenum_owner:local-only@127.0.0.1:5432/postgres");
const sourceUrl = new URL(ownerUrl); sourceUrl.pathname = `/${sourceDatabase}`;
const restoreUrl = new URL(ownerUrl); restoreUrl.pathname = `/${restoreDatabase}`;
const endpoint = process.env.PLENUM_RECOVERY_S3_ENDPOINT ?? "http://127.0.0.1:18333";
const containerEndpoint = process.env.PLENUM_RECOVERY_CONTAINER_S3_ENDPOINT ?? "http://host.docker.internal:18333";
const image = process.env.PLENUM_APPLICATION_IMAGE ?? "plenum-platform:ps-530";
const directory = await mkdtemp(join(tmpdir(), "plenum-ps530-recovery-"));
const backupDirectory = join(directory, "backup");
const keyFile = join(directory, "backup.key");
const publicKeys = join(directory, "trusted-public-keys.json");
const anchors = join(directory, "independent-anchors.json");
const admin = new Pool({ connectionString: ownerUrl.toString(), max: 1 });
const s3 = new S3Client({ endpoint, region: "us-east-1", forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" } });
const evidenceDirectory = join(process.cwd(), "test-results", "recovery");

function run(command, args, environment = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, env: { ...process.env, ...environment } });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}
function container(script, environment) {
  const args = ["run", "--rm", "--pull=never", "--network=bridge", "--read-only", "--user=65532:65532",
    "--cap-drop=ALL", "--security-opt=no-new-privileges:true", "--tmpfs=/tmp:rw,noexec,nosuid,size=32m",
    "--mount", `type=bind,source=${directory},target=/recovery`];
  for (const [name, value] of Object.entries(environment)) args.push("--env", `${name}=${value}`);
  args.push(image, script);
  return run("docker", args);
}
async function deleteBucket(bucket) {
  try {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket }));
    if ((listed.Contents?.length ?? 0) > 0) await s3.send(new DeleteObjectsCommand({ Bucket: bucket,
      Delete: { Objects: listed.Contents.map(({ Key }) => ({ Key })) } }));
    await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
  } catch (error) { if (error?.name !== "NoSuchBucket") throw error; }
}

try {
  run("docker", ["build", "--pull=false", "--tag", image, "--file", "deploy/compose/Dockerfile", "."]);
  try { await admin.query("CREATE ROLE plenum_app NOLOGIN"); } catch (error) { if (error?.code !== "42710") throw error; }
  await admin.query(`CREATE DATABASE ${sourceDatabase}`);
  await admin.query(`CREATE DATABASE ${restoreDatabase}`);
  const seeded = JSON.parse(run(process.execPath, ["scripts/seed-recovery-fixture.mjs"], {
    DATABASE_URL: sourceUrl.toString(), S3_ENDPOINT: endpoint, S3_REGION: "us-east-1", S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test", S3_BUCKET: sourceBucket, PLENUM_TRUSTED_PUBLIC_KEYS_FILE: publicKeys,
    PLENUM_INDEPENDENT_ANCHORS_FILE: anchors, PLENUM_BACKUP_ENCRYPTION_KEY_FILE: keyFile
  }));
  const common = {
    S3_ENDPOINT: containerEndpoint, S3_REGION: "us-east-1", S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test",
    S3_BUCKET: sourceBucket, PLENUM_BACKUP_DIRECTORY: "/recovery/backup",
    PLENUM_BACKUP_ENCRYPTION_KEY_FILE: "/recovery/backup.key", PLENUM_TRUSTED_PUBLIC_KEYS_FILE: "/recovery/trusted-public-keys.json",
    PLENUM_INDEPENDENT_ANCHORS_FILE: "/recovery/independent-anchors.json", PLENUM_BACKUP_KEY_REFERENCE: "kms://synthetic/ps-530",
    PLENUM_DEPLOYMENT_PROFILE: "institutional"
  };
  const sourceContainerUrl = new URL(sourceUrl); sourceContainerUrl.hostname = "host.docker.internal";
  const restoreContainerUrl = new URL(restoreUrl); restoreContainerUrl.hostname = "host.docker.internal";
  container("scripts/backup-deployment.mjs", { ...common, DATABASE_URL: sourceContainerUrl.toString() });
  container("scripts/restore-deployment.mjs", { ...common, DATABASE_RESTORE_URL: restoreContainerUrl.toString(),
    S3_RESTORE_ENDPOINT: containerEndpoint, S3_RESTORE_REGION: "us-east-1", S3_RESTORE_ACCESS_KEY_ID: "test",
    S3_RESTORE_SECRET_ACCESS_KEY: "test", S3_RESTORE_BUCKET: restoreBucket, PLENUM_DISPOSABLE_RESTORE: "1" });
  const restored = JSON.parse(await readFile(join(backupDirectory, "restore-evidence.json"), "utf8"));
  const target = new Pool({ connectionString: restoreUrl.toString(), max: 1 });
  try {
    const rows = await target.query(`SELECT release.id AS release_id,sequence.next_sequence-1 AS last_sequence
      FROM registry.releases release JOIN runtime.sessions session ON session.initial_release_id=release.id
      JOIN evidence.session_sequences sequence ON sequence.session_id=session.id WHERE release.id=$1`, [seeded.release]);
    if (rows.rows[0]?.release_id !== seeded.release || Number(rows.rows[0]?.last_sequence) !== 1) throw new Error("Restored Release or sequence is missing");
  } finally { await target.end(); }
  const restoredObject = await s3.send(new GetObjectCommand({ Bucket: restoreBucket, Key: seeded.objectKey }));
  const restoredObjectBody = restoredObject.Body === undefined ? "" : Buffer.from(await restoredObject.Body.transformToByteArray()).toString("utf8");
  if (restoredObjectBody !== '{"contractId":"synthetic-recovery-release-v1"}\n') throw new Error("Restored Release object is missing or changed");
  if (restored.rpoSeconds > 900 || restored.rtoSeconds > 14_400 || restored.status !== "PASS") throw new Error("Recovery objectives were not met");
  const evidence = { ...restored, command: "npm run test:backup-restore", evidenceIds: ["PS-530-T02"],
    sourceDatabase, restoreDatabase, releaseId: seeded.release, objectKey: seeded.objectKey };
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(join(evidenceDirectory, "ps-530-restore.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`CMD-BACKUP-RESTORE PASS; evidence: ${join(evidenceDirectory, "ps-530-restore.json")}`);
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ($1,$2)", [sourceDatabase, restoreDatabase]);
  await admin.query(`DROP DATABASE IF EXISTS ${sourceDatabase}`);
  await admin.query(`DROP DATABASE IF EXISTS ${restoreDatabase}`);
  await admin.end();
  await deleteBucket(sourceBucket);
  await deleteBucket(restoreBucket);
  await rm(directory, { recursive: true, force: true });
}

