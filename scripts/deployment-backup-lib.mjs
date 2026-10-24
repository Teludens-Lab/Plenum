import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import {
  CreateBucketCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { Pool } from "pg";
import { verifyRestoredEvidence } from "./recovery-evidence.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function databaseEnvironment(connectionString) {
  const url = new URL(connectionString);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get("sslmode") ?? "prefer"
  };
}

async function encryptionKey(path) {
  const text = (await readFile(path, "utf8")).trim();
  const bytes = Buffer.from(text, "base64");
  if (bytes.byteLength !== 32) throw new Error("The backup encryption key file must contain exactly 32 base64-encoded bytes");
  return bytes;
}

function encryptBytes(bytes, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { encrypted, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

function decryptBytes(bytes, key, encryption) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encryption.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encryption.tag, "base64"));
  return Buffer.concat([decipher.update(bytes), decipher.final()]);
}

function s3(environment, suffix = "") {
  const endpoint = required(environment, `S3${suffix}_ENDPOINT`);
  return {
    client: new S3Client({
      endpoint,
      region: environment[`S3${suffix}_REGION`] ?? "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: required(environment, `S3${suffix}_ACCESS_KEY_ID`),
        secretAccessKey: required(environment, `S3${suffix}_SECRET_ACCESS_KEY`)
      }
    }),
    bucket: required(environment, `S3${suffix}_BUCKET`)
  };
}

async function listObjects(client, bucket) {
  const objects = [];
  let continuationToken;
  do {
    const response = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
    objects.push(...(response.Contents ?? []).flatMap((item) => item.Key === undefined ? [] : [item.Key]));
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken !== undefined);
  return objects.sort();
}

async function readObject(client, bucket, key) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (response.Body === undefined) throw new Error(`Object ${key} has no body`);
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function createDeploymentBackup(environment = process.env) {
  const started = new Date();
  const output = resolve(required(environment, "PLENUM_BACKUP_DIRECTORY"));
  await mkdir(output, { recursive: false, mode: 0o700 });
  const key = await encryptionKey(required(environment, "PLENUM_BACKUP_ENCRYPTION_KEY_FILE"));
  const databaseUrl = required(environment, "DATABASE_URL");
  const databaseFile = "database.dump.enc";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const databaseOutput = createWriteStream(join(output, databaseFile), { mode: 0o600 });
  const pgDump = spawn("pg_dump", ["--format=custom", "--serializable-deferrable", "--no-owner", "--no-acl"], {
    env: { ...process.env, ...databaseEnvironment(databaseUrl) }, stdio: ["ignore", "pipe", "pipe"]
  });
  let dumpError = "";
  pgDump.stderr.setEncoding("utf8");
  pgDump.stderr.on("data", (chunk) => { dumpError += chunk; });
  const dumpExit = new Promise((resolvePromise, reject) => {
    pgDump.once("error", reject); pgDump.once("exit", resolvePromise);
  });
  await pipeline(pgDump.stdout, cipher, databaseOutput);
  const dumpCode = await dumpExit;
  if (dumpCode !== 0) throw new Error(`pg_dump failed with exit ${dumpCode}: ${dumpError.trim()}`);
  const databaseBytes = await readFile(join(output, databaseFile));

  const source = s3(environment);
  const objectEntries = [];
  for (const objectKey of await listObjects(source.client, source.bucket)) {
    const bytes = await readObject(source.client, source.bucket, objectKey);
    const contentDigest = digest(bytes);
    const encrypted = encryptBytes(bytes, key);
    const file = `object-${digest(objectKey).slice(0, 16)}-${contentDigest}.enc`;
    await writeFile(join(output, file), encrypted.encrypted, { mode: 0o600, flag: "wx" });
    objectEntries.push({ key: objectKey, file, sha256: contentDigest, bytes: bytes.byteLength,
      encryption: { algorithm: "AES-256-GCM", iv: encrypted.iv, tag: encrypted.tag } });
  }

  const evidence = [];
  for (const [name, sourcePath] of [
    ["trusted-public-keys.json", required(environment, "PLENUM_TRUSTED_PUBLIC_KEYS_FILE")],
    ["independent-anchors.json", required(environment, "PLENUM_INDEPENDENT_ANCHORS_FILE")]
  ]) {
    const plaintext = await readFile(sourcePath);
    const encrypted = encryptBytes(plaintext, key);
    const file = `${name}.enc`;
    await writeFile(join(output, file), encrypted.encrypted, { mode: 0o600, flag: "wx" });
    evidence.push({ name, file, sha256: digest(plaintext), encryption: { algorithm: "AES-256-GCM", iv: encrypted.iv, tag: encrypted.tag } });
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  let latestEvidenceAt;
  try {
    const result = await pool.query("SELECT max(recorded_at) AS recovery_point_at FROM evidence.events");
    latestEvidenceAt = result.rows[0]?.recovery_point_at?.toISOString() ?? null;
  } finally { await pool.end(); }
  const completed = new Date();
  const manifest = {
    contractId: "backup-manifest-v1",
    manifestVersion: 1,
    platformVersion: "0.1.0",
    schemaVersion: "024",
    generatedAt: completed.toISOString(),
    recoveryPointAt: started.toISOString(),
    latestEvidenceAt,
    rpoSeconds: Math.ceil((completed.getTime() - started.getTime()) / 1000),
    targets: { rpoSeconds: 900, rtoSeconds: 14_400 },
    encryption: { algorithm: "AES-256-GCM", keyReference: required(environment, "PLENUM_BACKUP_KEY_REFERENCE") },
    database: { file: databaseFile, sha256: digest(databaseBytes), bytes: databaseBytes.byteLength,
      encryption: { algorithm: "AES-256-GCM", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") } },
    objects: objectEntries,
    evidence,
    source: { profile: required(environment, "PLENUM_DEPLOYMENT_PROFILE"), bucket: source.bucket }
  };
  await writeFile(join(output, "backup-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  return manifest;
}

export async function restoreDeploymentBackup(environment = process.env) {
  if (environment.PLENUM_DISPOSABLE_RESTORE !== "1") {
    throw new Error("PLENUM_DISPOSABLE_RESTORE=1 is required; production restore is intentionally refused");
  }
  const started = Date.now();
  const input = resolve(required(environment, "PLENUM_BACKUP_DIRECTORY"));
  const manifest = JSON.parse(await readFile(join(input, "backup-manifest.json"), "utf8"));
  if (manifest.contractId !== "backup-manifest-v1" || manifest.schemaVersion !== "024") {
    throw new Error("The backup manifest is incompatible with this restore tool; use a documented forward-fix");
  }
  const key = await encryptionKey(required(environment, "PLENUM_BACKUP_ENCRYPTION_KEY_FILE"));
  const databaseUrl = required(environment, "DATABASE_RESTORE_URL");
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const occupied = await pool.query(
      `SELECT count(*)::int AS count FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog','information_schema')`
    );
    if (occupied.rows[0].count !== 0) throw new Error("Restore target database must be empty");
  } finally { await pool.end(); }

  const encryptedDump = join(input, basename(manifest.database.file));
  if (digest(await readFile(encryptedDump)) !== manifest.database.sha256) throw new Error("Encrypted database dump digest mismatch");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(manifest.database.encryption.iv, "base64"));
  decipher.setAuthTag(Buffer.from(manifest.database.encryption.tag, "base64"));
  const pgRestore = spawn("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", databaseEnvironment(databaseUrl).PGDATABASE], {
    env: { ...process.env, ...databaseEnvironment(databaseUrl) }, stdio: ["pipe", "ignore", "pipe"]
  });
  let restoreError = "";
  pgRestore.stderr.setEncoding("utf8");
  pgRestore.stderr.on("data", (chunk) => { restoreError += chunk; });
  const restoreExit = new Promise((resolvePromise, reject) => {
    pgRestore.once("error", reject); pgRestore.once("exit", resolvePromise);
  });
  await pipeline(createReadStream(encryptedDump), decipher, pgRestore.stdin);
  const restoreCode = await restoreExit;
  if (restoreCode !== 0) throw new Error(`pg_restore failed with exit ${restoreCode}: ${restoreError.trim()}`);

  const target = s3(environment, "_RESTORE");
  try { await target.client.send(new CreateBucketCommand({ Bucket: target.bucket })); } catch (error) {
    if (error?.name !== "BucketAlreadyOwnedByYou" && error?.name !== "BucketAlreadyExists") throw error;
  }
  if ((await listObjects(target.client, target.bucket)).length !== 0) throw new Error("Restore target object bucket must be empty");
  for (const object of manifest.objects) {
    const encrypted = await readFile(join(input, basename(object.file)));
    const plaintext = decryptBytes(encrypted, key, object.encryption);
    if (digest(plaintext) !== object.sha256) throw new Error(`Restored object digest mismatch for ${object.key}`);
    await target.client.send(new PutObjectCommand({ Bucket: target.bucket, Key: object.key, Body: plaintext,
      Metadata: { sha256: object.sha256 }, IfNoneMatch: "*" }));
  }
  const evidence = Object.fromEntries(await Promise.all(manifest.evidence.map(async (entry) => {
    const plaintext = decryptBytes(await readFile(join(input, basename(entry.file))), key, entry.encryption);
    if (digest(plaintext) !== entry.sha256) throw new Error(`${entry.name} digest mismatch`);
    return [entry.name, JSON.parse(plaintext.toString("utf8"))];
  })));
  const restored = new Pool({ connectionString: databaseUrl, max: 1 });
  let verification;
  try {
    verification = await verifyRestoredEvidence(restored, evidence["trusted-public-keys.json"], evidence["independent-anchors.json"]);
  } finally { await restored.end(); }
  if (verification.length === 0 || verification.some((result) => !result.verified)) {
    throw new Error(`Restored Evidence verification failed: ${JSON.stringify(verification)}`);
  }
  return { contractId: "restore-evidence-v1", status: "PASS", rtoSeconds: Math.ceil((Date.now() - started) / 1000),
    rpoSeconds: manifest.rpoSeconds, objectsRestored: manifest.objects.length, sessionsVerified: verification.length, verification };
}
