import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const installer = await readFile("deploy/aws/scripts/install-secrets.ps1", "utf8");
const operationsInstaller = await readFile("deploy/aws/scripts/configure-operations.ps1", "utf8");

test("AWS secret installer fails closed before first-install writes", () => {
  assert.match(installer, /describe-parameters/u);
  assert.match(installer, /already exist[\s\S]*will not rotate or overwrite/u);
  assert.doesNotMatch(installer, /--overwrite/u);
});

test("AWS secret installer keeps prompted values out of visible input and command arguments", () => {
  assert.match(installer, /Read-Host -Prompt \$Prompt -AsSecureString/u);
  assert.match(installer, /--cli-input-json \$requestUri/u);
  assert.match(installer, /\$requestUri = "file:\/\/" \+ \$requestPath/u);
  assert.doesNotMatch(installer, /\$requestUri = "file:\/\/\/"/u);
  assert.doesNotMatch(installer, /ssm put-parameter[\s\S]{0,300}--value/u);
  assert.match(installer, /Remove-Item -LiteralPath \$temporaryDirectory -Recurse -Force/u);
});

test("AWS secret installer writes the complete runtime contract", () => {
  for (const key of [
    "DATABASE_URL",
    "FLOOR_TOKEN_SECRET",
    "INVITATION_DELIVERY_BEARER_TOKEN",
    "INVITATION_DELIVERY_WEBHOOK_TOKEN",
    "MEDIA_API_KEY",
    "MEDIA_API_SECRET",
    "POSTMARK_FROM",
    "POSTMARK_SERVER_TOKEN",
    "POSTMARK_WEBHOOK_PASSWORD"
  ]) assert.match(installer, new RegExp(key, "u"));

  for (const suffix of [
    "application",
    "postgres-password",
    "keycloak-admin-password",
    "test-user-password",
    "livekit-keys",
    "registry"
  ]) assert.match(installer, new RegExp(suffix, "u"));
  assert.match(installer, /operations/u);
  for (const key of ["ALERT_RECIPIENT", "DATABASE_PASSWORD", "POSTMARK_FROM", "POSTMARK_SERVER_TOKEN"]) {
    assert.match(installer, new RegExp(key, "u"));
  }
  assert.match(installer, /"\$\{mediaApiKey\}: \$\{mediaApiSecret\}`n"/u);
  assert.doesNotMatch(installer, /"keys:`n  \$\{mediaApiKey\}/u);
  assert.doesNotMatch(installer, /S3_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/u);
  assert.doesNotMatch(installer, /OCI object-storage/u);
});

test("AWS operations bootstrap is create-only and keeps receiver credentials out of arguments", () => {
  assert.match(operationsInstaller, /already exists[\s\S]*will not rotate or overwrite/u);
  assert.doesNotMatch(operationsInstaller, /--overwrite/u);
  assert.match(operationsInstaller, /Read-Host -Prompt \$Prompt -AsSecureString/u);
  assert.match(operationsInstaller, /--cli-input-json \$requestUri/u);
  assert.doesNotMatch(operationsInstaller, /ssm put-parameter[\s\S]{0,300}--value/u);
  assert.match(operationsInstaller, /Remove-Item -LiteralPath \$directory -Recurse -Force/u);
});
