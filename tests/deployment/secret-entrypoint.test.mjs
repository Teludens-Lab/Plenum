import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  OPTIONAL_SECRET_GROUPS,
  parseSecretBundle,
  readSecretBundle,
  SECRET_KEYS
} from "../../deploy/compose/secret-entrypoint.mjs";

const valid = Object.fromEntries(SECRET_KEYS.map((key) => [key, `${key.toLowerCase()}-test-value`]));

test("secret bundle accepts only the complete allowlisted contract", () => {
  assert.deepEqual(parseSecretBundle(JSON.stringify(valid)), valid);
  assert.throws(() => parseSecretBundle(JSON.stringify({ ...valid, EXTRA: "no" })), /Unknown Plenum secret keys/u);
  const incomplete = { ...valid };
  delete incomplete.DATABASE_URL;
  assert.throws(() => parseSecretBundle(JSON.stringify(incomplete)), /Missing Plenum secret keys: DATABASE_URL/u);
});

test("static S3 credentials are optional as a pair and never accepted partially", () => {
  const s3 = Object.fromEntries(OPTIONAL_SECRET_GROUPS[0].map((key) => [key, `${key.toLowerCase()}-test-value`]));
  assert.deepEqual(parseSecretBundle(JSON.stringify({ ...valid, ...s3 })), { ...valid, ...s3 });
  const incomplete = { ...valid, ...s3 };
  delete incomplete.S3_SECRET_ACCESS_KEY;
  assert.throws(() => parseSecretBundle(JSON.stringify(incomplete)), /Incomplete Plenum secret group/u);
});

test("Postmark credentials are optional as a group and never accepted partially", () => {
  const postmark = Object.fromEntries(OPTIONAL_SECRET_GROUPS[1].map((key) => [key, `${key.toLowerCase()}-test-value`]));
  assert.deepEqual(parseSecretBundle(JSON.stringify({ ...valid, ...postmark })), { ...valid, ...postmark });
  const incomplete = { ...valid, ...postmark };
  delete incomplete.POSTMARK_WEBHOOK_PASSWORD;
  assert.throws(() => parseSecretBundle(JSON.stringify(incomplete)), /Incomplete Plenum secret group/u);
});

test("file secret source is loaded without exposing a second source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "plenum-secret-test-"));
  const path = join(directory, "bundle.json");
  await writeFile(path, JSON.stringify(valid), { mode: 0o600 });
  assert.deepEqual(await readSecretBundle({ PLENUM_SECRET_BUNDLE_FILE: path }), valid);
  await assert.rejects(
    readSecretBundle({ PLENUM_SECRET_BUNDLE_FILE: path, PLENUM_SECRET_BUNDLE_OCID: "ocid1.vaultsecret.test" }),
    /one Plenum secret-bundle source/u
  );
});
