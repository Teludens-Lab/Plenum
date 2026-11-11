import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";

import type { Pool } from "pg";
import type { SessionAccessContextV1 } from "../identity/context.js";

export type DeploymentRateLimitCategory = "authentication" | "agent" | "upload" | "session_command" | "general";

export interface DeploymentRateLimitRule {
  category: DeploymentRateLimitCategory;
  limit: number;
  scope: string;
}

export interface DeploymentRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const limits: Record<DeploymentRateLimitCategory, number> = {
  authentication: 10,
  agent: 30,
  upload: 5,
  session_command: 120,
  general: 300
};

function clientAddress(request: IncomingMessage, trustedProxy: boolean): string {
  let address = request.socket.remoteAddress ?? "unknown";
  if (trustedProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    // The exclusive, immediate ingress must append its observed peer or replace this header.
    const peer = typeof forwarded === "string" ? forwarded.split(",").at(-1)?.trim() : undefined;
    if (peer !== undefined && isIP(peer) && !peer.includes("%")) address = peer;
  }
  if (isIP(address) === 6 && !address.includes("%")) return new URL(`http://[${address}]`).hostname;
  return isIP(address) === 4 ? address : "unknown";
}

/** Only call after resolving trusted authentication and Session access. */
export function sessionCommandRateLimits(context: SessionAccessContextV1): DeploymentRateLimitRule[] {
  const organization = context.organizationId.toLowerCase();
  return [
    { category: "session_command", limit: limits.session_command, scope: `command-principal:${organization}:${context.principalId.toLowerCase()}` },
    // Reference profile: 600 application Commands + 500 ballots/minute, with 100 requests of headroom.
    { category: "session_command", limit: 1_200, scope: `command-session:${organization}:${context.sessionId.toLowerCase()}` }
  ];
}

function authenticationToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) return authorization.slice(7);
  return request.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("plenum_session="))?.slice("plenum_session=".length);
}

export function classifyDeploymentRequest(
  request: IncomingMessage,
  trustedProxy = false
): DeploymentRateLimitRule | null {
  const path = new URL(request.url ?? "/", "https://plenum.invalid").pathname;
  if (!path.startsWith("/auth/") && !path.startsWith("/v1/")) return null;

  if (path.startsWith("/auth/")) {
    return { category: "authentication", limit: limits.authentication, scope: `ip:${clientAddress(request, trustedProxy)}` };
  }

  const sessionCommand = path.match(/^\/v1\/sessions\/([^/]+)\/commands(?:\/|$)/u);
  if (sessionCommand !== null) {
    // Ten reference Sessions can share ingress; unverified tokens and Session IDs never select its key.
    return { category: "session_command", limit: 12_000, scope: `command-ingress:ip:${clientAddress(request, trustedProxy)}` };
  }

  const category: DeploymentRateLimitCategory = /(?:^|\/)agents?(?:\/|$)/u.test(path) ? "agent" :
    /(?:^|\/)uploads?(?:\/|$)/u.test(path) ? "upload" : "general";
  const token = authenticationToken(request);
  return {
    category,
    limit: limits[category],
    scope: token === undefined ? `ip:${clientAddress(request, trustedProxy)}` : `session-token:${token}`
  };
}

export async function consumeDeploymentRateLimit(
  pool: Pool,
  deploymentId: string,
  rule: DeploymentRateLimitRule,
  now = new Date()
): Promise<DeploymentRateLimitResult> {
  if (!Number.isSafeInteger(rule.limit) || rule.limit < 1 || rule.scope.length === 0 || !Number.isFinite(now.getTime())) {
    throw new Error("Invalid deployment rate-limit input");
  }
  const scopeHash = createHash("sha256").update(deploymentId).update("\0").update(rule.category).update("\0")
    .update(rule.scope).digest("hex");
  const result = await pool.query<{ allowed: boolean; remaining: number; retry_after_seconds: number }>(
    "SELECT allowed,remaining,retry_after_seconds FROM operations.consume_request_rate_limit($1,$2,$3,$4)",
    [rule.category, scopeHash, rule.limit, now]
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error("Rate-limit decision was not returned");
  return { allowed: row.allowed, remaining: row.remaining, retryAfterSeconds: row.retry_after_seconds };
}
