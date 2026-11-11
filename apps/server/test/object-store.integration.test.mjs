import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
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

test("BA-07 storage read deadline cancels a stalled body, including conditional deletion", async (t) => {
  const controller = new AbortController(), entered = Promise.withResolvers();
  t.mock.method(AbortSignal, 'timeout', milliseconds => { assert.equal(milliseconds, 10_000); return controller.signal; });
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-length': '100', etag: '"synthetic"' }); response.write('partial'); entered.resolve();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const stalledClient = new S3Client({ endpoint: `http://127.0.0.1:${server.address().port}`, region: 'us-east-1', forcePathStyle: true,
    credentials: { accessKeyId: 'synthetic', secretAccessKey: 'synthetic' }, maxAttempts: 1 });
  try {
    const rejected = assert.rejects(new S3ObjectStore(stalledClient, 'synthetic').deleteIfDigest('file', 'a'.repeat(64)), /abort|reset|closed/i);
    await entered.promise; controller.abort(); await rejected;
  } finally { stalledClient.destroy(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

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
