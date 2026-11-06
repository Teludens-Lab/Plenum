import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  OPERATIONAL_TELEMETRY_CONTRACT_ID,
  type OperationalTelemetryEventV1,
  type OperationalTelemetryOutcomeV1,
  type OperationalTelemetrySeverityV1
} from "@plenum/event-contracts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const traceParentPattern = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/iu;
const safeCategoryPattern = /^[a-z][a-z0-9_.-]{0,79}$/u;
const durationBuckets = [10, 50, 100, 250, 500, 1_000, 2_500, 5_000] as const;
const routeSegments = new Set([
  "auth", "callback", "content-library", "dead-letters", "domains", "events", "first-admin-invitations",
  "healthz", "injects", "internal", "lifecycle", "login", "messages", "metrics", "operator", "organizations",
  "platform", "postmark", "projection", "projects", "retry", "reissue", "revoke", "scim", "sessions", "stage",
  "studio", "suspend", "templates", "uploads", "users", "v1", "v2", "verify"
]);

export interface TelemetryRequestContext {
  correlationId: string;
  traceId: string;
  method: string;
  route: string;
  sessionId?: string;
  startedAt: bigint;
}

export interface OperationalTelemetryOptions {
  deploymentId: string;
  write?: (line: string) => void;
  now?: () => Date;
  clock?: () => bigint;
}

function escapeMetricLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

function boundedRoute(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean).slice(0, 12).map((segment) => {
    const decoded = (() => { try { return decodeURIComponent(segment); } catch { return segment; } })();
    if (uuidPattern.test(decoded)) return ":id";
    if (/^\d+$/u.test(decoded)) return ":number";
    if (/\.(?:css|js|html|ico|png|jpe?g|webp|svg|woff2?|txt|json|csv|pdf|mp3|wav|ogg|m4a)$/iu.test(decoded)) return ":asset";
    return routeSegments.has(decoded) ? decoded : ":value";
  });
  return `/${segments.join("/")}` || "/";
}

function sessionIdFrom(pathname: string): string | undefined {
  const match = pathname.match(/\/sessions\/([0-9a-f-]{36})(?:\/|$)/iu);
  const candidate = match?.[1];
  return candidate !== undefined && uuidPattern.test(candidate) ? candidate.toLowerCase() : undefined;
}

function traceIdFrom(request: IncomingMessage): string {
  const traceParent = typeof request.headers.traceparent === "string" ? request.headers.traceparent : "";
  const candidate = traceParent.match(traceParentPattern)?.[1]?.toLowerCase();
  return candidate !== undefined && candidate !== "0".repeat(32) ? candidate : randomUUID().replaceAll("-", "");
}

export class OperationalTelemetry {
  readonly #deploymentId: string;
  readonly #write: (line: string) => void;
  readonly #now: () => Date;
  readonly #clock: () => bigint;
  readonly #requests = new Map<string, number>();
  readonly #durations = new Map<string, number[]>();
  readonly #events = new Map<string, number>();

  constructor(options: OperationalTelemetryOptions) {
    if (!uuidPattern.test(options.deploymentId)) throw new Error("Operational telemetry requires a deployment UUID");
    this.#deploymentId = options.deploymentId;
    this.#write = options.write ?? ((line) => console.info(line));
    this.#now = options.now ?? (() => new Date());
    this.#clock = options.clock ?? (() => process.hrtime.bigint());
  }

  begin(request: IncomingMessage): TelemetryRequestContext {
    const pathname = new URL(request.url ?? "/", "http://plenum.invalid").pathname;
    const sessionId = sessionIdFrom(pathname);
    return {
      correlationId: randomUUID(),
      traceId: traceIdFrom(request),
      method: (request.method ?? "UNKNOWN").toUpperCase().slice(0, 12),
      route: boundedRoute(pathname),
      ...(sessionId === undefined ? {} : { sessionId }),
      startedAt: this.#clock()
    };
  }

  complete(context: TelemetryRequestContext, response: ServerResponse): void {
    const durationMs = Math.max(0, Number(this.#clock() - context.startedAt) / 1_000_000);
    const statusCode = response.statusCode;
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    const key = JSON.stringify([context.method, context.route, statusClass]);
    this.#requests.set(key, (this.#requests.get(key) ?? 0) + 1);
    const durations = this.#durations.get(key) ?? [];
    durations.push(durationMs);
    if (durations.length > 2_000) durations.shift();
    this.#durations.set(key, durations);
    this.emit({
      event: "http.request_completed",
      severity: statusCode >= 500 ? "error" : statusCode >= 400 ? "warning" : "info",
      outcome: statusCode >= 500 ? "failed" : statusCode >= 400 ? "denied" : "succeeded",
      correlationId: context.correlationId,
      traceId: context.traceId,
      method: context.method,
      route: context.route,
      statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId })
    });
  }

  emit(input: {
    event: string;
    severity: OperationalTelemetrySeverityV1;
    outcome: OperationalTelemetryOutcomeV1;
    correlationId: string;
    traceId?: string;
    method?: string;
    route?: string;
    statusCode?: number;
    durationMs?: number;
    sessionId?: string;
    category?: string;
  }): void {
    if (!safeCategoryPattern.test(input.event) || !uuidPattern.test(input.correlationId)) {
      throw new Error("Operational telemetry identifiers are invalid");
    }
    if (input.category !== undefined && !safeCategoryPattern.test(input.category)) {
      throw new Error("Operational telemetry category is invalid");
    }
    const event: OperationalTelemetryEventV1 = {
      contractId: OPERATIONAL_TELEMETRY_CONTRACT_ID,
      event: input.event,
      severity: input.severity,
      outcome: input.outcome,
      recordedAt: this.#now().toISOString(),
      correlationId: input.correlationId,
      traceId: input.traceId ?? input.correlationId.replaceAll("-", ""),
      deploymentId: this.#deploymentId,
      ...(input.method === undefined ? {} : { method: input.method }),
      ...(input.route === undefined ? {} : { route: input.route }),
      ...(input.statusCode === undefined ? {} : { statusCode: input.statusCode }),
      ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      ...(input.category === undefined ? {} : { category: input.category })
    };
    const eventKey = JSON.stringify([input.event, input.severity, input.outcome]);
    this.#events.set(eventKey, (this.#events.get(eventKey) ?? 0) + 1);
    this.#write(JSON.stringify(event));
  }

  metrics(): string {
    const lines = [
      "# HELP plenum_http_server_requests_total Completed HTTP requests.",
      "# TYPE plenum_http_server_requests_total counter",
      "# HELP plenum_http_server_request_duration_milliseconds HTTP request duration.",
      "# TYPE plenum_http_server_request_duration_milliseconds histogram",
      "# HELP plenum_operational_events_total Bounded operational events.",
      "# TYPE plenum_operational_events_total counter"
    ];
    for (const [key, count] of [...this.#events.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const [event, severity, outcome] = JSON.parse(key) as [string, string, string];
      lines.push(`plenum_operational_events_total{event="${escapeMetricLabel(event)}",severity="${severity}",outcome="${outcome}"} ${count}`);
    }
    for (const [key, count] of [...this.#requests.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const [method, route, statusClass] = JSON.parse(key) as [string, string, string];
      const labels = `method="${escapeMetricLabel(method)}",route="${escapeMetricLabel(route)}",status_class="${statusClass}"`;
      lines.push(`plenum_http_server_requests_total{${labels}} ${count}`);
      const values = this.#durations.get(key) ?? [];
      for (const bucket of durationBuckets) {
        lines.push(`plenum_http_server_request_duration_milliseconds_bucket{${labels},le="${bucket}"} ${values.filter((value) => value <= bucket).length}`);
      }
      lines.push(`plenum_http_server_request_duration_milliseconds_bucket{${labels},le="+Inf"} ${values.length}`);
      lines.push(`plenum_http_server_request_duration_milliseconds_sum{${labels}} ${values.reduce((sum, value) => sum + value, 0).toFixed(3)}`);
      lines.push(`plenum_http_server_request_duration_milliseconds_count{${labels}} ${values.length}`);
    }
    return `${lines.join("\n")}\n`;
  }
}
