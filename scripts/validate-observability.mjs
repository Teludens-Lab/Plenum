import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const alerts = JSON.parse(await readFile("deploy/observability/alerts.json", "utf8"));
const dashboard = JSON.parse(await readFile("deploy/observability/dashboard.json", "utf8"));
assert.equal(alerts.contractId, "operational-alerts-v1");
assert.equal(alerts.telemetryContractId, "operational-telemetry-v1");
assert.equal(alerts.retentionDays, 90);
assert.ok(Array.isArray(alerts.alerts) && alerts.alerts.length >= 5);
const alertIds = new Set();
for (const alert of alerts.alerts) {
  assert.match(alert.id, /^[a-z][a-z0-9-]+$/u);
  assert.equal(alertIds.has(alert.id), false, `duplicate alert ${alert.id}`);
  alertIds.add(alert.id);
  assert.ok(["page", "ticket"].includes(alert.action));
  assert.ok(["metric", "log"].includes(alert.signal));
  assert.equal(alert.owner, "platform-operations");
  assert.match(alert.runbook, /^docs\/operations\/PS-810-OBSERVABILITY-SECURITY\.md#/u);
  assert.ok(typeof alert.condition === "string" && alert.condition.length >= 8);
}
assert.equal(dashboard.contractId, "operational-dashboard-v1");
assert.equal(dashboard.telemetryContractId, "operational-telemetry-v1");
assert.ok(Array.isArray(dashboard.panels) && dashboard.panels.length >= 4);
for (const panel of dashboard.panels) {
  assert.match(panel.id, /^[a-z][a-z0-9-]+$/u);
  assert.ok(["metric", "log"].includes(panel.signal));
  assert.ok(typeof panel.query === "string" && panel.query.length >= 8);
}
const serialized = JSON.stringify({ alerts, dashboard }).toLowerCase();
for (const prohibited of ["authorization", "cookie", "password", "secret_access_key", "request.body", "user-agent"]) {
  assert.equal(serialized.includes(prohibited), false, `observability contract contains prohibited field ${prohibited}`);
}
console.log(`PS-810 observability contracts PASS; ${alerts.alerts.length} alerts; ${dashboard.panels.length} panels`);
