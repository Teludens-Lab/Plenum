import type { Pool } from "pg";
import { withOrganizationTransaction } from "../database.js";
import { releaseDueScheduledInjects } from "./information-flow.js";
import { assertOrganizationJobAuthority, type OrganizationJobAuthority } from "../operations/job-authority.js";

/** Bounded, retryable worker for one configured Organization and owning deployment.
 * A paused Session retains its UTC deadline; overdue work runs after resume.
 * No delivery occurs in a completed/locked Session or under another authority.
 */
export async function runScheduledInjects(pool: Pool, organizationId: string, deploymentId: string, jobAuthority?: OrganizationJobAuthority, signal?: AbortSignal): Promise<{
  released: number; failures: Array<{ sessionId: string; error: unknown }>;
}> {
  if (jobAuthority && (jobAuthority.organizationId !== organizationId || jobAuthority.deploymentId !== deploymentId)) throw new Error("Inject authority mismatch");
  const sessions = await withOrganizationTransaction(pool, organizationId, async (client) =>
    (await client.query<{ session_id: string }>(
      `SELECT instance.session_id FROM runtime.inject_instances instance
         JOIN runtime.sessions session ON session.organization_id=instance.organization_id AND session.id=instance.session_id
         JOIN runtime.session_authorities authority ON authority.organization_id=session.organization_id AND authority.session_id=session.id
        WHERE instance.organization_id=$1 AND instance.state='scheduled' AND instance.scheduling_command_id IS NOT NULL
          AND instance.scheduled_at<=transaction_timestamp() AND session.status='active'
          AND authority.deployment_id=$2 AND authority.status='active'
        GROUP BY instance.session_id ORDER BY min(instance.scheduled_at),instance.session_id LIMIT 50`,
      [organizationId, deploymentId]
    )).rows);
  let released = 0;
  const failures: Array<{ sessionId: string; error: unknown }> = [];
  for (const { session_id: sessionId } of sessions) {
    if (signal?.aborted) break;
    try {
      released += await withOrganizationTransaction(pool, organizationId, async (client) => {
        if (jobAuthority) await assertOrganizationJobAuthority(client, jobAuthority);
        // Same authority-before-lifecycle lock ordering as the Command processor.
        const authority = (await client.query<{ authority_epoch: string }>(
          `SELECT authority_epoch FROM runtime.session_authorities WHERE organization_id=$1 AND session_id=$2
             AND deployment_id=$3 AND status='active' FOR SHARE`, [organizationId, sessionId, deploymentId]
        )).rows[0];
        if (!authority) return 0;
        const session = (await client.query<{ status: string }>(
          "SELECT status FROM runtime.sessions WHERE organization_id=$1 AND id=$2 FOR UPDATE SKIP LOCKED",
          [organizationId, sessionId]
        )).rows[0];
        if (session?.status !== "active") return 0;
        return releaseDueScheduledInjects(client, { organizationId, sessionId, authorityEpoch: Number(authority.authority_epoch) });
      });
    } catch (error) {
      // Surface each failure to the composition root while allowing unrelated
      // Sessions to progress. The failed transaction remains due for retry.
      failures.push({ sessionId, error });
    }
  }
  return { released, failures };
}

/** Composition-root lifecycle: one in-flight bounded batch, drained on shutdown. */
export function startScheduledInjectWorker(pool: Pool, organizationId: string, deploymentId: string,
  onFailure: (error: unknown, sessionId?: string) => void): () => Promise<void> {
  let stopped = false;
  let running: Promise<void> | undefined;
  const tick = () => {
    if (stopped || running) return;
    running = runScheduledInjects(pool, organizationId, deploymentId)
      .then(({ failures }) => { for (const failure of failures) onFailure(failure.error, failure.sessionId); })
      .catch((error: unknown) => onFailure(error))
      .finally(() => { running = undefined; });
  };
  const timer = setInterval(tick, 1_000);
  timer.unref();
  tick();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
