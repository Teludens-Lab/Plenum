import type { PoolClient } from "pg";
import type { CoreDesignV1 } from "@plenum/simulation-schema";
import { authorizationError } from "../errors.js";

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
