import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const git = (arguments_) => execFileSync("git", arguments_, { cwd: root, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 });

const secretPatterns = [
  ["private key", new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY-----"].join(""), "u")],
  ["AWS access key", new RegExp(["AKI", "A[0-9A-Z]{16}"].join(""), "u")],
  ["GitHub token", new RegExp(["gh", "[pousr]_[A-Za-z0-9]{36,255}"].join(""), "u")],
  ["Slack token", new RegExp(["xox", "[abprs]-[A-Za-z0-9-]{20,}"].join(""), "u")],
  ["Stripe live key", new RegExp(["sk", "_live_[A-Za-z0-9]{16,}"].join(""), "u")]
];

function findings(source, origin) {
  return secretPatterns.filter(([, pattern]) => pattern.test(source)).map(([name]) => `${origin}: ${name}`);
}

test("PS-550-T01 finds no committed secret material in the current tree or Git history", async () => {
  const files = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
  const sensitiveNames = files.filter((file) =>
    /(^|\/)\.env(?:\.|$)/u.test(file) && !file.endsWith(".env.example") ||
    /\.(?:key|pem|p12|pfx)$/iu.test(file) || /(^|\/)secrets\//u.test(file));
  assert.deepEqual(sensitiveNames, [], `Sensitive filenames are tracked: ${sensitiveNames.join(", ")}`);

  const currentFindings = [];
  for (const file of files) {
    const content = await readFile(resolve(root, file));
    if (content.includes(0)) continue;
    currentFindings.push(...findings(content.toString("utf8"), file));
  }
  assert.deepEqual(currentFindings, []);

  const revisions = git(["rev-list", "--all"]).trim().split(/\s+/u);
  const historyPattern = "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,255}|xox[abprs]-[A-Za-z0-9-]{20,}|sk_live_[A-Za-z0-9]{16,}";
  const history = spawnSync("git", ["grep", "-I", "-n", "-E", "-e", historyPattern, ...revisions, "--", "."],
    { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  assert.ok([0, 1].includes(history.status), history.stderr || history.error?.message);
  assert.equal(history.stdout, "", `Git history contains high-confidence secret material:\n${history.stdout}`);
});

test("REQ-051 deployment boundary requires protected credentials and browser security controls", async () => {
  const [service, institutional, example, rateLimit, retentionMigration] = await Promise.all([
    readFile(resolve(root, "deploy/compose/profile-service.mjs"), "utf8"),
    readFile(resolve(root, "deploy/compose/compose.institutional.yaml"), "utf8"),
    readFile(resolve(root, "deploy/compose/.env.example"), "utf8"),
    readFile(resolve(root, "apps/server/src/security/rate-limit.ts"), "utf8"),
    readFile(resolve(root, "apps/server/migrations/025_security_retention_enforcement.sql"), "utf8")
  ]);
  for (const required of ["HttpOnly", "Secure", "SameSite=Lax", "strict-transport-security",
    "content-security-policy", "permissions-policy", "x-content-type-options", "x-frame-options"]) {
    assert.match(service, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  for (const required of ["postgres-password", "identity-tls-key", "livekit-keys"]) assert.match(institutional, new RegExp(required, "u"));
  assert.match(example, /POSTGRES_PASSWORD_FILE=.*secrets/u);
  assert.match(example, /PLENUM_RETENTION_ACTOR_PERSON_ID=/u);
  assert.doesNotMatch(example, /AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u);
  assert.match(service, /consumeDeploymentRateLimit/u);
  assert.match(service, /RATE_LIMITED/u);
  assert.match(rateLimit, /operations\.consume_request_rate_limit/u);
  assert.match(retentionMigration, /legal_hold_events/u);
  assert.match(retentionMigration, /guard_export_artifact_retention/u);
});
