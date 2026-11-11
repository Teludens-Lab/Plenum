import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { MediaProviderAdapter } from "@plenum/media-adapter";
import { withOrganizationTransaction } from "../database.js";
import { reconcileFloorPermissions } from "../comms/voice.js";
import { runScheduledInjects } from "../runtime/inject-scheduler.js";
import { runRetentionEnforcement } from "../reporting/service.js";
import { publishPendingRuntimeDeltas } from "../sync/runtime-sync.js";
import { assertOrganizationJobAuthority, discoverOrganizationJobs, ensureBootstrapJobBinding, type OrganizationJobAuthority } from "./job-authority.js";

type Job = "discovery" | "authority" | "inject" | "floor" | "retention" | "publication";

/** Ten bindings per page, two Organizations in flight, one sweep batch at a time. */
export function startOrganizationJobs(pool: Pool, deploymentId: string, bootstrap: { organizationId: string; actorPersonId: string },
  media: MediaProviderAdapter, onFailure: (job: Job) => void | Promise<void>,
  onRetention: (held: boolean) => void): { stop: () => Promise<void>; healthy: () => boolean } {
  const cancellation = new AbortController();
  let initialized = false, running: Promise<void> | undefined, cursor: string | undefined;
  let sweepFailed = false, lastSweepAt = 0, lastSweepOk = false, retryAt = 0, bootstrapRetryAt = 0;
  const fail = async (job: Job) => { sweepFailed = true; lastSweepOk = false; await onFailure(job); };
  const run = async (authority: OrganizationJobAuthority) => {
    try {
      const eligible = await withOrganizationTransaction(pool, authority.organizationId, async (client) => {
        const organization = (await client.query<{ lifecycle_status: string }>("SELECT lifecycle_status FROM identity.organizations WHERE id=$1", [authority.organizationId])).rows[0];
        if (organization?.lifecycle_status !== "active") return false;
        await assertOrganizationJobAuthority(client, authority);
        return true;
      });
      if (!eligible || cancellation.signal.aborted) return;
    } catch { await fail("authority"); return; }
    const jobs = [
      publishPendingRuntimeDeltas(pool, authority.organizationId, 100, authority).catch(() => fail("publication")),
      runScheduledInjects(pool, authority.organizationId, deploymentId, authority, cancellation.signal)
        .then(({ failures }) => { if (failures.length) return fail("inject"); }).catch(() => fail("inject")),
      reconcileFloorPermissions(pool, authority.organizationId, deploymentId, media, authority, cancellation.signal)
        .then(({ unresolved }) => { if (unresolved && !cancellation.signal.aborted) return fail("floor"); }).catch(() => fail("floor")),
      runRetentionEnforcement(pool, authority.organizationId, authority.actorPersonId, randomUUID(), undefined, authority)
        .then((result) => { if (!result.skipped) onRetention(result.heldArtifacts > 0); }).catch(() => fail("retention"))
    ];
    await Promise.allSettled(jobs);
  };
  const batch = async () => {
    if (!initialized && Date.now() >= bootstrapRetryAt) {
      try {
        await ensureBootstrapJobBinding(pool, bootstrap.organizationId, deploymentId, bootstrap.actorPersonId);
        initialized = true;
      } catch { await fail("authority"); bootstrapRetryAt = Date.now() + 5_000; }
    }
    const authorities = await discoverOrganizationJobs(pool, deploymentId, cursor);
    let index = 0;
    await Promise.allSettled(Array.from({ length: 2 }, async () => {
      while (!cancellation.signal.aborted && index < authorities.length) await run(authorities[index++]!);
    }));
    if (authorities.length < 10) {
      cursor = undefined; lastSweepAt = Date.now(); lastSweepOk = initialized && !sweepFailed; sweepFailed = false;
    } else cursor = authorities.at(-1)!.organizationId;
  };
  const tick = () => {
    if (cancellation.signal.aborted || running || Date.now() < retryAt) return;
    running = batch().catch(async () => { await fail("discovery"); retryAt = Date.now() + 5_000; })
      .finally(() => { running = undefined; });
  };
  const timer = setInterval(tick, 250);
  timer.unref(); tick();
  return {
    healthy: () => !cancellation.signal.aborted && lastSweepOk && Date.now() - lastSweepAt < 60_000,
    stop: async () => { cancellation.abort(); clearInterval(timer); await running; }
  };
}
