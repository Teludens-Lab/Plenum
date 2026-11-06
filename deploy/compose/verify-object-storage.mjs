import { createHash, randomUUID } from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { S3ObjectStore } from "../../apps/server/dist/index.js";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const endpoint = process.env.S3_ENDPOINT?.trim();
const client = new S3Client({
  ...(endpoint ? { endpoint } : {}),
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "0"
});
const bucket = required("S3_BUCKET");
const key = `staging-verification/${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}`;
const bytes = Buffer.from(`plenum-storage-verification:${randomUUID()}`, "utf8");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const store = new S3ObjectStore(client, bucket);

let deleted = false;
try {
  await store.putImmutable(key, bytes, sha256);
  const read = await store.get(key);
  if (!Buffer.from(read).equals(bytes)) throw new Error("Storage verification read did not match the uploaded bytes");
  deleted = await store.deleteIfDigest(key, sha256);
  if (!deleted) throw new Error("Storage verification object was not deleted");
  try {
    await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    throw new Error("Storage verification object remained readable after deletion");
  } catch (error) {
    if (error instanceof Error && error.message === "Storage verification object remained readable after deletion") throw error;
    const status = typeof error === "object" && error !== null && "$metadata" in error
      ? error.$metadata?.httpStatusCode
      : undefined;
    if (status !== 404) throw error;
  }
  console.log("object storage upload/read/delete: PASS");
} finally {
  if (!deleted) await store.deleteIfDigest(key, sha256).catch(() => undefined);
  client.destroy();
}
