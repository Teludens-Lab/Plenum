import type { Pool } from "pg";
import { withOrganizationTransaction } from "../database.js";
import { assertOrganizationJobAuthority, type OrganizationJobAuthority } from "../operations/job-authority.js";
import { createDueEvidenceCheckpoint, type EvidenceSigner, type EvidenceAnchor } from "./checkpoints.js";

export interface EvidenceCheckpointAdapters { signer: EvidenceSigner; anchor: EvidenceAnchor }

/** Ten Sessions per tenant pass; each resumes its frozen range before preparing another. */
export async function runEvidenceCheckpoints(pool: Pool, authority: OrganizationJobAuthority,
  adapters?: EvidenceCheckpointAdapters, signal?: AbortSignal): Promise<{ completed: number; unresolved: boolean }> {
  const sessions = await withOrganizationTransaction(pool, authority.organizationId, async client => {
    await assertOrganizationJobAuthority(client, authority);
    return (await client.query<{ id: string; authority_epoch: string; server_time: Date }>(`SELECT session.id,owner.authority_epoch,transaction_timestamp() AS server_time
      FROM runtime.sessions session JOIN runtime.session_authorities owner
        ON owner.organization_id=session.organization_id AND owner.session_id=session.id
      LEFT JOIN operations.evidence_checkpoint_work work ON work.organization_id=session.organization_id AND work.session_id=session.id
      LEFT JOIN LATERAL (SELECT last_sequence FROM evidence.checkpoint_batches
        WHERE organization_id=session.organization_id AND session_id=session.id ORDER BY last_sequence DESC LIMIT 1) previous ON true
      JOIN LATERAL (SELECT count(*) AS count,min(recorded_at) AS oldest FROM
        (SELECT recorded_at FROM evidence.events WHERE organization_id=session.organization_id AND session_id=session.id
          AND sequence>COALESCE(previous.last_sequence,0) ORDER BY sequence LIMIT 1000) batch) pending ON pending.count>0
      WHERE session.organization_id=$1 AND owner.deployment_id=$2 AND owner.status='active'
        AND (work.session_id IS NOT NULL OR pending.count>=1000 OR pending.oldest<=transaction_timestamp()-interval '5 minutes'
          OR session.status IN ('completed','locked','archived'))
        AND (work.retry_at IS NULL OR work.retry_at<=transaction_timestamp())
        AND (work.lease_until IS NULL OR work.lease_until<=transaction_timestamp())
      ORDER BY COALESCE(work.retry_at,pending.oldest),session.id LIMIT 10`, [authority.organizationId, authority.deploymentId])).rows;
  });
  let completed = 0, failed = false;
  for (const session of sessions) {
    if (signal?.aborted) break;
    try {
      if (await createDueEvidenceCheckpoint(pool, authority.organizationId, session.id, adapters?.signer, adapters?.anchor,
        session.server_time, { authority, authorityEpoch: Number(session.authority_epoch), ...(signal ? { signal } : {}) })) completed++;
    } catch { failed = true; }
  }
  const pending = await withOrganizationTransaction(pool, authority.organizationId, client => client.query(
    "SELECT 1 FROM operations.evidence_checkpoint_work WHERE organization_id=$1 LIMIT 1", [authority.organizationId]));
  return { completed, unresolved: failed || pending.rowCount !== 0 };
}
