import type { PoolClient } from "pg";
import type { CoreDesignV1 } from "@plenum/simulation-schema";
import { authorizationError } from "../errors.js";

export const activeOrganizationHoldSql = `SELECT 1 FROM reporting.legal_hold_events placed
  WHERE placed.organization_id=$1 AND placed.action='placed' AND placed.scope_type='organization'
  AND NOT EXISTS (SELECT 1 FROM reporting.legal_hold_events released
    WHERE released.organization_id=placed.organization_id AND released.hold_id=placed.hold_id AND released.action='released')`;

// Owner-approved BA-07 policy: a legal hold preserves bytes, not expired participant access.
export const availableFormAttachmentSql = "upload_state='attached' AND expires_at>statement_timestamp()";

export async function formRetentionPolicy(client: PoolClient, organizationId: string, projectId: string, artifactTypeId: string, policyId: string, correlationId: string) {
  const policy = await client.query<{ period_days: number }>(
    `SELECT period_days FROM reporting.retention_policies WHERE organization_id=$1 AND id=$2
      AND expiry_action='delete' AND approval_required=false AND
        ((scope_type='organization' AND scope_reference IN ('*',$1::text)) OR
         (scope_type='project' AND scope_reference=$3) OR (scope_type='artifact_type' AND scope_reference=$4))`,
    [organizationId, policyId, projectId, artifactTypeId]);
  if (!policy.rows[0]) throw authorizationError("VALIDATION_FAILED", "Choose an applicable Retention Policy with automatic file deletion. Archive and anonymization policies do not support file attachments.", correlationId);
  return policy.rows[0];
}

export async function assertFormAttachmentRetention(client: PoolClient, organizationId: string, projectId: string, core: CoreDesignV1, correlationId: string): Promise<void> {
  for (const type of core.artifactTypes ?? []) if (core.forms?.find((form) => form.id === type.formId)?.attachments) {
    if (!type.retentionPolicyId || !/^[0-9a-f-]{36}$/iu.test(type.retentionPolicyId)) throw authorizationError("VALIDATION_FAILED", "Form attachments need an applicable Retention Policy.", correlationId);
    await formRetentionPolicy(client, organizationId, projectId, type.id, type.retentionPolicyId, correlationId);
  }
}
