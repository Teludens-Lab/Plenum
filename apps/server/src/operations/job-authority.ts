import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { withOrganizationTransaction, withRestrictedTransaction } from "../database.js";
import { authorizationError } from "../errors.js";
import type { AuthenticatedPrincipal } from "../identity/login.js";
import { requireCurrentOrganizationRole } from "../research/evidence.js";

export interface OrganizationJobAuthority {
  organizationId: string;
  deploymentId: string;
  actorPersonId: string;
  revision: number;
}
type Binding = OrganizationJobAuthority & { enabled: boolean };
type BindingRow = { organization_id: string; deployment_id: string; actor_person_id: string; revision: string; enabled: boolean };
const binding = (row: BindingRow): Binding => ({ organizationId: row.organization_id, deploymentId: row.deployment_id,
  actorPersonId: row.actor_person_id, revision: Number(row.revision), enabled: row.enabled });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function assertActiveJobActor(client: PoolClient, organizationId: string, actorPersonId: string): Promise<void> {
  const result = await client.query(`SELECT 1 FROM identity.organizations organization
    JOIN identity.memberships membership ON membership.organization_id=organization.id
    JOIN identity.organization_workforce_members workforce ON workforce.organization_id=membership.organization_id AND workforce.person_id=membership.person_id
    WHERE organization.id=$1 AND organization.lifecycle_status='active' AND membership.person_id=$2
      AND membership.organization_role='admin' AND workforce.status='active'
    FOR SHARE OF organization,membership,workforce`, [organizationId, actorPersonId]);
  if (result.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Scheduled work requires an active Organization Admin actor.", randomUUID());
}

export async function assertOrganizationJobAuthority(client: PoolClient, authority: OrganizationJobAuthority): Promise<void> {
  await assertActiveJobActor(client, authority.organizationId, authority.actorPersonId);
  const current = await client.query(`SELECT 1 FROM operations.organization_job_bindings
    WHERE organization_id=$1 AND deployment_id=$2 AND actor_person_id=$3 AND revision=$4 AND enabled FOR SHARE`,
  [authority.organizationId, authority.deploymentId, authority.actorPersonId, authority.revision]);
  if (current.rowCount !== 1) throw authorizationError("ACCESS_REVOKED", "Scheduled work authority is no longer current.", randomUUID());
}

export async function discoverOrganizationJobs(pool: Pool, deploymentId: string, after?: string): Promise<OrganizationJobAuthority[]> {
  return withRestrictedTransaction(pool, async (client) => {
    await client.query("SELECT set_config('app.deployment_id',$1,true)", [deploymentId]);
    const rows = await client.query<BindingRow>(`SELECT * FROM operations.organization_job_bindings
      WHERE deployment_id=$1 AND enabled AND ($2::uuid IS NULL OR organization_id>$2)
      ORDER BY organization_id LIMIT 10`, [deploymentId, after ?? null]);
    return rows.rows.map(binding);
  });
}

export async function getOrganizationJobBinding(pool: Pool, principal: AuthenticatedPrincipal, correlationId: string): Promise<Binding | null> {
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    await assertActiveJobActor(client, principal.organizationId, principal.principalId);
    const row = (await client.query<BindingRow>("SELECT * FROM operations.organization_job_bindings WHERE organization_id=$1", [principal.organizationId])).rows[0];
    return row ? binding(row) : null;
  });
}

async function writeBinding(client: PoolClient, organizationId: string, deploymentId: string, actorPersonId: string,
  enabled: boolean, authorizedBy: string, expectedRevision: number, correlationId: string): Promise<Binding> {
  if (enabled) await assertActiveJobActor(client, organizationId, actorPersonId);
  const current = (await client.query<BindingRow>("SELECT * FROM operations.organization_job_bindings WHERE organization_id=$1 FOR UPDATE", [organizationId])).rows[0];
  if (Number(current?.revision ?? 0) !== expectedRevision) throw authorizationError("STALE_AGGREGATE_VERSION", "Scheduled work authorization changed. Refresh and retry.", correlationId);
  const result = await client.query<BindingRow>(`INSERT INTO operations.organization_job_bindings
    (organization_id,deployment_id,actor_person_id,enabled,authorized_by) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (organization_id) DO UPDATE SET deployment_id=$2,actor_person_id=$3,enabled=$4,authorized_by=$5,
      revision=operations.organization_job_bindings.revision+1,updated_at=transaction_timestamp()
      WHERE operations.organization_job_bindings.revision=$6 RETURNING *`,
  [organizationId, deploymentId, actorPersonId, enabled, authorizedBy, expectedRevision]);
  if (result.rowCount !== 1) throw authorizationError("STALE_AGGREGATE_VERSION", "Scheduled work authorization changed. Refresh and retry.", correlationId);
  const updated = binding(result.rows[0]!);
  await client.query(`INSERT INTO evidence.audit_records(id,organization_id,actor_person_id,action,target_ref,details)
    VALUES ($1,$2,$3,'organization.jobs_configured',$4,$5::jsonb)`,
  [randomUUID(), organizationId, authorizedBy, `organization:${organizationId}`, JSON.stringify({ correlationId, ...updated })]);
  return updated;
}

export async function configureOrganizationJobs(pool: Pool, principal: AuthenticatedPrincipal, deploymentId: string,
  input: { actorPersonId: string; enabled: boolean; expectedRevision: number }, correlationId: string): Promise<Binding> {
  if (!uuid.test(input.actorPersonId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw authorizationError("VALIDATION_FAILED", "The scheduled work authorization is invalid.", correlationId);
  }
  return withOrganizationTransaction(pool, principal.organizationId, async (client) => {
    await requireCurrentOrganizationRole(client, principal, "admin", correlationId);
    await assertActiveJobActor(client, principal.organizationId, principal.principalId);
    return writeBinding(client, principal.organizationId, deploymentId, input.actorPersonId, input.enabled,
      principal.principalId, input.expectedRevision, correlationId);
  });
}

/** Preserve only the explicit legacy deployment configuration; never overwrite a revocation. */
export async function ensureBootstrapJobBinding(pool: Pool, organizationId: string, deploymentId: string, actorPersonId: string): Promise<void> {
  await withOrganizationTransaction(pool, organizationId, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext('bootstrap_job_binding'))", [organizationId]);
    if ((await client.query("SELECT 1 FROM operations.organization_job_bindings WHERE organization_id=$1", [organizationId])).rowCount) return;
    await writeBinding(client, organizationId, deploymentId, actorPersonId, true, actorPersonId, 0, randomUUID());
  });
}
