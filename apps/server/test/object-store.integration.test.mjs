import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";

import { S3ObjectStore } from "../dist/index.js";

const endpoint = process.env.S3_ENDPOINT;
if (endpoint === undefined) throw new Error("S3_ENDPOINT is required for S3 integration tests");

const bucket = `plenum-ps130-${randomUUID()}`;
const client = new S3Client({
  endpoint,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "plenum-test",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "plenum-test-secret"
  }
});
const store = new S3ObjectStore(client, bucket, "release-packages");

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("PS-130-S3 verifies immutable S3-compatible put, get and conditional cleanup", async () => {
  assert.throws(() => new S3ObjectStore(client, bucket, "../outside"), /Invalid object key/);
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  const keys = ["same/package.json", "race/package.json"];
  try {
    const first = new TextEncoder().encode("first canonical package");
    const second = new TextEncoder().encode("different package bytes");
    await store.putImmutable(keys[0], first, digest(first));
    await store.putImmutable(keys[0], first, digest(first));
    assert.deepEqual(await store.get(keys[0]), first);
    await assert.rejects(store.putImmutable(keys[0], second, digest(second)), /Immutable object key collision/);
    assert.deepEqual(await store.get(keys[0]), first);
    assert.equal(await store.deleteIfDigest(keys[0], digest(second)), false);
    assert.equal(await store.deleteIfDigest(keys[0], digest(first)), true);
    await assert.rejects(store.get(keys[0]), (error) => error?.$metadata?.httpStatusCode === 404);

    const raced = await Promise.allSettled([
      store.putImmutable(keys[1], first, digest(first)),
      store.putImmutable(keys[1], second, digest(second))
    ]);
    assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(raced.filter((result) => result.status === "rejected").length, 1);
    const stored = await store.get(keys[1]);
    assert.equal([digest(first), digest(second)].includes(digest(stored)), true);
    assert.equal(await store.deleteIfDigest(keys[1], digest(stored)), true);
  } finally {
    for (const key of keys) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `release-packages/${key}` }));
    }
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    client.destroy();
  }
});
