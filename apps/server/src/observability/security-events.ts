import { randomUUID } from "node:crypto";

import type { Pool } from "pg";

import { withRestrictedTransaction } from "../database.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventPattern = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/u;
const categoryPattern = /^[a-z][a-z0-9_.-]{0,79}$/u;

export interface OperationalSecurityEventInput {
  deploymentId: string;
  organizationId?: string;
  sessionId?: string;
  actorPersonId?: string;
  eventType: string;
  severity: "info" | "warning" | "error";
  outcome: "succeeded" | "failed" | "denied";
  correlationId: string;
  category?: string;
}

/** Stores a bounded, append-only security event without accepting arbitrary details. */
export async function recordOperationalSecurityEvent(pool: Pool, input: OperationalSecurityEventInput): Promise<string> {
  for (const value of [input.deploymentId, input.correlationId, input.organizationId, input.sessionId, input.actorPersonId]) {
    if (value !== undefined && !uuidPattern.test(value)) throw new Error("Operational security event UUID is invalid");
  }
  if (!eventPattern.test(input.eventType)) throw new Error("Operational security event type is invalid");
  if (input.category !== undefined && !categoryPattern.test(input.category)) throw new Error("Operational security event category is invalid");
  if (input.sessionId !== undefined && input.organizationId === undefined) throw new Error("Session security events require an Organization");
  const id = randomUUID();
  await withRestrictedTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO evidence.operational_security_events
       (id,deployment_id,organization_id,session_id,actor_person_id,event_type,severity,outcome,correlation_id,category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, input.deploymentId, input.organizationId ?? null, input.sessionId ?? null, input.actorPersonId ?? null,
        input.eventType, input.severity, input.outcome, input.correlationId, input.category ?? null]
    );
  });
  return id;
}
