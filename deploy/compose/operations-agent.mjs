import { appendFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import { readOperationsSecretBundle } from "./operations-secrets.mjs";

const { Pool } = pg;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const statePath = process.env.OPERATIONS_STATE_PATH ?? "/var/lib/plenum-operations/state.json";
const telemetryDirectory = `${dirname(statePath)}/telemetry`;
const pollIntervalMs = Number(process.env.OPERATIONS_POLL_INTERVAL_MS ?? 30_000);
const deploymentId = process.env.PLENUM_DEPLOYMENT_ID?.trim() ?? "";
const applicationHealthUrl = process.env.APPLICATION_HEALTH_URL ?? "http://application:8080/healthz";
const applicationMetricsUrl = process.env.APPLICATION_METRICS_URL ?? "http://application:9090/metrics";

const alertDefinitions = Object.freeze({
  "security.evidence_failed": ["security-evidence-failed", "page"],
  "security.upload_scan_failed": ["malware-scanner-unavailable", "page"],
  "security.upload_infected": ["infected-upload", "ticket"],
  "retention.enforcement_failed": ["retention-enforcement-failed", "page"]
});
const runbookBase = "docs/operations/PS-810-OBSERVABILITY-SECURITY.md";

function emptyState() {
  return { version: 1, initialized: false, cursor: null, previousMetrics: null, conditions: {} };
}

export function parsePrometheusSnapshot(text) {
  let requests = 0;
  let serverErrors = 0;
  const buckets = new Map();
  const events = {};
  for (const line of text.split("\n")) {
    if (line.startsWith("plenum_http_server_requests_total{")) {
      const value = Number(line.slice(line.lastIndexOf(" ") + 1));
      if (Number.isFinite(value)) {
        requests += value;
        if (line.includes('status_class="5xx"')) serverErrors += value;
      }
    } else if (line.startsWith("plenum_http_server_request_duration_milliseconds_bucket{")) {
      const label = line.match(/,le="([^"]+)"/u)?.[1];
      const value = Number(line.slice(line.lastIndexOf(" ") + 1));
      if (label !== undefined && Number.isFinite(value)) buckets.set(label, (buckets.get(label) ?? 0) + value);
    } else if (line.startsWith("plenum_operational_events_total{")) {
      const event = line.match(/event="([a-z][a-z0-9_.-]+)"/u)?.[1];
      const value = Number(line.slice(line.lastIndexOf(" ") + 1));
      if (event !== undefined && Number.isFinite(value)) events[event] = (events[event] ?? 0) + value;
    }
  }
  return { requests, serverErrors, buckets: Object.fromEntries(buckets), events };
}

function counterDelta(current, previous) {
  return current >= previous ? current - previous : current;
}

export function metricWindow(current, previous) {
  if (previous === null) return { errorRatio: 0, p95Milliseconds: 0, sampleCount: 0, eventDeltas: {} };
  const requests = counterDelta(current.requests, previous.requests);
  const errors = counterDelta(current.serverErrors, previous.serverErrors);
  const infinity = counterDelta(current.buckets["+Inf"] ?? 0, previous.buckets["+Inf"] ?? 0);
  const target = infinity * 0.95;
  let p95Milliseconds = infinity === 0 ? 0 : Number.POSITIVE_INFINITY;
  for (const boundary of Object.keys(current.buckets).filter((value) => value !== "+Inf").map(Number).sort((a, b) => a - b)) {
    const count = counterDelta(current.buckets[String(boundary)] ?? 0, previous.buckets[String(boundary)] ?? 0);
    if (count >= target) { p95Milliseconds = boundary; break; }
  }
  const eventDeltas = {};
  for (const [event, count] of Object.entries(current.events ?? {})) {
    eventDeltas[event] = counterDelta(count, previous.events?.[event] ?? 0);
  }
  return { errorRatio: requests === 0 ? 0 : errors / requests, p95Milliseconds, sampleCount: requests, eventDeltas };
}

export function evaluateSustainedCondition(current, active, nowMs, durationMs) {
  if (!active) return { since: null, notified: false, shouldNotify: false };
  const since = current?.since ?? nowMs;
  const notified = current?.notified === true;
  return { since, notified: notified || nowMs - since >= durationMs, shouldNotify: !notified && nowMs - since >= durationMs };
}

export async function deliverOperationalAlert(secret, alert, fetchImpl = fetch) {
  const response = await fetchImpl("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": secret.POSTMARK_SERVER_TOKEN
    },
    body: JSON.stringify({
      From: secret.POSTMARK_FROM,
      To: secret.ALERT_RECIPIENT,
      Subject: `[Plenum staging] ${alert.id}`,
      TextBody: [
        `Alert: ${alert.id}`,
        `Action: ${alert.action}`,
        `Deployment: ${alert.deploymentId}`,
        `Recorded at: ${alert.recordedAt}`,
        `Outcome: ${alert.outcome}`,
        ...(alert.category ? [`Category: ${alert.category}`] : []),
        ...(alert.correlationId ? [`Correlation ID: ${alert.correlationId}`] : []),
        `Runbook: ${alert.runbook}`
      ].join("\n"),
      MessageStream: secret.POSTMARK_MESSAGE_STREAM,
      Metadata: { alert_id: alert.id, deployment_id: alert.deploymentId }
    }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Operational alert delivery failed with status ${response.status}.`);
  const result = await response.json();
  if (typeof result.MessageID !== "string" || result.MessageID.length === 0) {
    throw new Error("Operational alert delivery returned no message identifier.");
  }
  return result.MessageID;
}

async function loadState() {
  try {
    const value = JSON.parse(await readFile(statePath, "utf8"));
    return value?.version === 1 ? value : emptyState();
  } catch (error) {
    if (error?.code === "ENOENT") return emptyState();
    throw error;
  }
}

async function saveState(state) {
  await mkdir(dirname(statePath), { recursive: true });
  const temporary = `${statePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  await rename(temporary, statePath);
}

async function recordTelemetrySample(sample) {
  await mkdir(telemetryDirectory, { recursive: true });
  const day = sample.recordedAt.slice(0, 10);
  await appendFile(`${telemetryDirectory}/${day}.jsonl`, `${JSON.stringify(sample)}\n`, { mode: 0o600 });
}

async function enforceTelemetryRetention(now = new Date()) {
  await mkdir(telemetryDirectory, { recursive: true });
  const cutoff = now.getTime() - 90 * 24 * 60 * 60_000;
  for (const name of await readdir(telemetryDirectory)) {
    const match = name.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/u);
    if (match !== null && Date.parse(`${match[1]}T00:00:00.000Z`) < cutoff) {
      await rm(`${telemetryDirectory}/${name}`);
    }
  }
}

async function responseOk(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return response.ok;
  } catch { return false; }
}

async function metricsSnapshot() {
  const response = await fetch(applicationMetricsUrl, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Metrics collection failed with status ${response.status}.`);
  return parsePrometheusSnapshot(await response.text());
}

export function securityEventCursor(row) {
  if (typeof row?.id !== "string" || typeof row?.recorded_at_cursor !== "string" || row.recorded_at_cursor.length === 0) {
    throw new Error("The operational security event cursor is invalid.");
  }
  return { recordedAt: row.recorded_at_cursor, id: row.id };
}

async function initializeCursor(pool, state) {
  const result = await pool.query(
    `SELECT recorded_at::text AS recorded_at_cursor,id FROM evidence.operational_security_event_feed
       WHERE deployment_id=$1 ORDER BY recorded_at DESC,id DESC LIMIT 1`, [deploymentId]
  );
  state.cursor = result.rows[0] ? securityEventCursor(result.rows[0]) : null;
  state.initialized = true;
}

export async function rehydrateSecurityEventCursor(pool, state, currentDeploymentId = deploymentId) {
  if (state.cursor === null) return false;
  const result = await pool.query(
    `SELECT recorded_at::text AS recorded_at_cursor,id FROM evidence.operational_security_event_feed
       WHERE deployment_id=$1 AND id=$2`, [currentDeploymentId, state.cursor.id]
  );
  if (result.rows[0] === undefined) return false;
  const cursor = securityEventCursor(result.rows[0]);
  if (cursor.recordedAt === state.cursor.recordedAt) return false;
  state.cursor = cursor;
  return true;
}

async function processSecurityEvents(pool, secret, state) {
  const parameters = [deploymentId];
  let cursorClause = "";
  if (state.cursor !== null) {
    parameters.push(state.cursor.recordedAt, state.cursor.id);
    cursorClause = "AND (recorded_at,id) > ($2::timestamptz,$3::uuid)";
  }
  const result = await pool.query(
    `SELECT id,event_type,severity,outcome,correlation_id,category,recorded_at,
            recorded_at::text AS recorded_at_cursor
       FROM evidence.operational_security_event_feed
      WHERE deployment_id=$1 ${cursorClause}
      ORDER BY recorded_at,id LIMIT 100`, parameters
  );
  for (const event of result.rows) {
    const definition = alertDefinitions[event.event_type];
    if (definition !== undefined) {
      await deliverOperationalAlert(secret, {
        id: definition[0], action: definition[1], deploymentId, outcome: event.outcome,
        recordedAt: event.recorded_at.toISOString(), correlationId: event.correlation_id,
        category: event.category, runbook: `${runbookBase}#${definition[0]}`
      });
      console.info(JSON.stringify({ event: "operations.alert_delivered", alertId: definition[0], severity: event.severity }));
    }
    state.cursor = securityEventCursor(event);
    await saveState(state);
  }
}

async function evaluateMetrics(secret, state) {
  const now = Date.now();
  const ready = await responseOk(applicationHealthUrl);
  let currentMetrics = null;
  try { currentMetrics = await metricsSnapshot(); } catch { /* readiness alert covers collection failure */ }
  const window = currentMetrics === null ? { errorRatio: 0, p95Milliseconds: 0, sampleCount: 0, eventDeltas: {} } :
    metricWindow(currentMetrics, state.previousMetrics);
  if ((window.eventDeltas["security.evidence_failed"] ?? 0) > 0) {
    await deliverOperationalAlert(secret, { id: "security-evidence-failed", action: "page", deploymentId,
      outcome: "failed", recordedAt: new Date(now).toISOString(),
      runbook: `${runbookBase}#security-evidence-failed` });
    console.info(JSON.stringify({ event: "operations.alert_delivered", alertId: "security-evidence-failed", severity: "error" }));
  }
  const conditions = [
    ["readiness-unavailable", !ready, 5 * 60_000, "page"],
    ["server-error-rate", window.sampleCount > 0 && window.errorRatio > 0.05, 10 * 60_000, "page"],
    ["request-latency", window.sampleCount > 0 && window.p95Milliseconds > 1_000, 15 * 60_000, "ticket"]
  ];
  for (const [id, active, duration, action] of conditions) {
    const next = evaluateSustainedCondition(state.conditions[id], active, now, duration);
    state.conditions[id] = { since: next.since, notified: next.notified };
    if (next.shouldNotify) {
      await deliverOperationalAlert(secret, { id, action, deploymentId, outcome: "failed",
        recordedAt: new Date(now).toISOString(), runbook: `${runbookBase}#${id}` });
      console.info(JSON.stringify({ event: "operations.alert_delivered", alertId: id, severity: "error" }));
    }
  }
  if (currentMetrics !== null) state.previousMetrics = currentMetrics;
  return { recordedAt: new Date(now).toISOString(), deploymentId, ready,
    errorRatio: window.errorRatio, p95Milliseconds: window.p95Milliseconds, sampleCount: window.sampleCount };
}

async function main() {
  if (!uuidPattern.test(deploymentId)) throw new Error("PLENUM_DEPLOYMENT_ID must be a UUID.");
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 5_000) throw new Error("The operations poll interval is invalid.");
  const secret = await readOperationsSecretBundle();
  const pool = new Pool({
    connectionString: `postgres://plenum_operations:${encodeURIComponent(secret.DATABASE_PASSWORD)}@database:5432/plenum`,
    max: 2, connectionTimeoutMillis: 5_000, statement_timeout: 10_000
  });
  const state = await loadState();
  try {
    if (!state.initialized) { await initializeCursor(pool, state); await saveState(state); }
    else if (await rehydrateSecurityEventCursor(pool, state)) await saveState(state);
    await enforceTelemetryRetention();
    while (true) {
      await processSecurityEvents(pool, secret, state);
      const sample = await evaluateMetrics(secret, state);
      await recordTelemetrySample(sample);
      await saveState(state);
      await writeFile("/tmp/plenum-operations-heartbeat", new Date().toISOString(), { mode: 0o600 });
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  } finally { await pool.end(); }
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(JSON.stringify({ event: "operations.collector_failed", message: error instanceof Error ? error.message : "unknown" }));
    process.exitCode = 1;
  });
}
