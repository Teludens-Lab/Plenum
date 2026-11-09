import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
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
    const path = resolve(root, file);
    try {
      if (!(await stat(path)).isFile()) continue;
      const content = await readFile(path);
      if (content.includes(0)) continue;
      currentFindings.push(...findings(content.toString("utf8"), file));
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
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
  for (const required of ["HttpOnly", "Secure", "SameSite=Lax", "buildSecurityHeaders"]) {
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

test("public edge emits one HSTS value while retaining direct-service transport protection", async () => {
  const [serviceHeaders, caddy] = await Promise.all([
    readFile(resolve(root, "deploy/compose/security-headers.mjs"), "utf8"),
    readFile(resolve(root, "deploy/oci/runtime/Caddyfile.tftpl"), "utf8")
  ]);
  assert.match(serviceHeaders, /"strict-transport-security": "max-age=31536000; includeSubDomains"/u);
  assert.match(caddy, /\$\{application_hostname\}[\s\S]*?header_down -Strict-Transport-Security/u);
  assert.equal((caddy.match(/header Strict-Transport-Security/gmu) ?? []).length, 4);
});

test("staging DAST dispatch and guard allow only the approved target", async () => {
  const dast = await readFile(resolve(root, ".github/workflows/staging-dast.yml"), "utf8");
  assert.match(dast, /^    environment:\n      name: staging-security\n      deployment: false$/mu);
  const input = dast.match(/^      target:\n([\s\S]*?)(?=^\S)/mu)?.[1];
  assert.ok(input, "staging target input must exist");
  assert.match(input, /^        default: https:\/\/plenum-stage-01\.duckdns\.org$/mu);
  assert.match(input, /^        type: choice$/mu);
  assert.deepEqual([...input.matchAll(/^          - (.+)$/gmu)].map((match) => match[1]),
    ["https://plenum-stage-01.duckdns.org"]);
  assert.match(dast, /TARGET_URL: \$\{\{ inputs\.target \}\}/u);
  assert.match(dast, /target: \$\{\{ inputs\.target \}\}/u);
  const guard = dast.match(/^        run: (test "\$TARGET_URL" = "[^"]+")$/mu);
  assert.ok(guard, "staging target guard must exist");
  assert.ok(guard.index < dast.indexOf("zaproxy/action-baseline@"), "guard must run before the scanner");
  for (const [target, expected] of [
    ["https://plenum-stage-01.duckdns.org", 0],
    ["https://example.com", 1],
    ["", 1],
    ["https://plenum-stage-01.duckdns.org.example.com", 1]
  ]) {
    const result = spawnSync("bash", ["-e", "-c", guard[1]], { env: { ...process.env, TARGET_URL: target } });
    assert.equal(result.status, expected, `unexpected guard result for ${JSON.stringify(target)}`);
  }
});

test("PS-810 CI and operational security controls fail closed without sensitive telemetry", async () => {
  const workflowDirectory = resolve(root, ".github/workflows");
  const workflowNames = (await readdir(workflowDirectory)).filter((name) => name.endsWith(".yml")).sort();
  assert.deepEqual(workflowNames, ["ci.yml", "release-provenance.yml", "security.yml", "staging-dast.yml"]);
  for (const name of workflowNames) {
    const workflow = await readFile(resolve(workflowDirectory, name), "utf8");
    assert.doesNotMatch(workflow, /pull_request_target/u);
    for (const match of workflow.matchAll(/^\s*- uses:\s+([^\s#]+)/gmu)) {
      assert.match(match[1], /^[^@\s]+@[0-9a-f]{40}$/u, `${name} must pin ${match[1]} to a full commit`);
    }
  }

  const [ci, security, dast, dastRules, provenance, telemetry, migration, readerMigration, compose, operationsAgent] = await Promise.all([
    readFile(resolve(workflowDirectory, "ci.yml"), "utf8"),
    readFile(resolve(workflowDirectory, "security.yml"), "utf8"),
    readFile(resolve(workflowDirectory, "staging-dast.yml"), "utf8"),
    readFile(resolve(root, ".zap/rules.tsv"), "utf8"),
    readFile(resolve(workflowDirectory, "release-provenance.yml"), "utf8"),
    readFile(resolve(root, "apps/server/src/observability/telemetry.ts"), "utf8"),
    readFile(resolve(root, "apps/server/migrations/039_operational_security_events.sql"), "utf8"),
    readFile(resolve(root, "apps/server/migrations/040_operational_security_reader.sql"), "utf8"),
    readFile(resolve(root, "deploy/oci/runtime/compose.functional-free.yaml.tftpl"), "utf8"),
    readFile(resolve(root, "deploy/compose/operations-agent.mjs"), "utf8")
  ]);
  for (const gate of ["typecheck", "lint", "npm test", "test:integration", "test:e2e:product", "test:a11y",
    "test:security", "test:supply-chain", "test:deployment", "audit:product-completeness"]) assert.equal(ci.includes(gate), true);
  assert.doesNotMatch(ci, /server -s3 -ip=0\.0\.0\.0(?:\s|$)/u);
  assert.match(ci, /server -s3 -ip=127\.0\.0\.1 -ip\.bind=0\.0\.0\.0 -s3\.ip\.bind=0\.0\.0\.0/u);
  assert.match(security, /codeql:\s+[\s\S]*?permissions:\s+[\s\S]*?actions: read[\s\S]*?contents: read/u);
  assert.doesNotMatch(security, /security-events: write/u);
  assert.match(security, /github\/codeql-action\/analyze@[0-9a-f]{40}/u);
  assert.match(security, /output: codeql-results[\s\S]*?upload: never/u);
  assert.match(security, /actions\/upload-artifact@[0-9a-f]{40}[\s\S]*?path: codeql-results\/\*\.sarif/u);
  assert.match(security, /actions\/dependency-review-action@[0-9a-f]{40}/u);
  assert.match(dast, /test "\$TARGET_URL" = "https:\/\/plenum-stage-01\.duckdns\.org"/u);
  assert.match(dast, /rules_file_name: \.zap\/rules\.tsv/u);
  assert.match(dast, /cmd_options: -c \.zap\/rules\.tsv/u);
  assert.match(dast, /fail_action: true/u);
  const reviewedDastRules = dastRules.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/u).slice(0, 2).join(" "));
  assert.deepEqual(reviewedDastRules, ["10015 INFO", "10049 INFO", "10109 INFO"]);
  assert.match(provenance, /attestations: write/u);
  assert.match(provenance, /sbom-path: test-results\/supply-chain\/sbom\.cdx\.json/u);
  for (const prohibited of ["authorization", "cookie", "user-agent", "request.body", "email"]) {
    assert.doesNotMatch(telemetry.toLowerCase(), new RegExp(prohibited.replace(".", "\\."), "u"));
  }
  assert.match(migration, /GRANT INSERT ON evidence\.operational_security_events TO plenum_app/u);
  assert.match(migration, /REVOKE SELECT, UPDATE, DELETE, TRUNCATE/u);
  assert.match(readerMigration, /CREATE ROLE plenum_operations_evidence_reader NOLOGIN/u);
  assert.match(readerMigration, /GRANT SELECT ON evidence\.operational_security_event_feed/u);
  assert.match(compose, /clamav\/clamav-debian:1\.4\.6@sha256:[0-9a-f]{64}/u);
  assert.match(compose, /CONTENT_SCANNER_HOST: malware-scanner/u);
  assert.match(compose, /malware-scanner:\s*\n\s+condition: service_healthy/u);
  assert.match(operationsAgent, /https:\/\/api\.postmarkapp\.com\/email/u);
  assert.doesNotMatch(operationsAgent, /S3_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)|AWS_SECRET/u);
});
