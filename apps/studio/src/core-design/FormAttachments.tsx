import { useEffect, useId, useState } from "react";
import { FORM_ATTACHMENT_CONTRACT_ID, FORM_ATTACHMENT_MEDIA_TYPES, formAttachmentMediaTypeLabel, type RuntimeFormDefinitionV1 } from "@plenum/simulation-schema";
import type { StudioCollaborationClient } from "../collaboration/client.js";

export function FormAttachments({ projectId, artifactTypeId, form, formIndex, artifactIndex, retentionPolicyId, client }: {
  projectId: string; artifactTypeId: string; form: RuntimeFormDefinitionV1; formIndex: number; artifactIndex: number;
  retentionPolicyId: string | undefined; client: StudioCollaborationClient;
}) {
  const id = useId();
  const [policies, setPolicies] = useState<Array<{ id: string; label: string; artifactTypeId?: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/v1/projects/${projectId}/form-retention-policies`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message ?? "Retention policies are unavailable.");
        setPolicies(result.policies); setError("");
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Retention policies are unavailable."); }
    })();
    return () => controller.abort();
  }, [projectId]);
  const applicable = policies.filter((policy) => !policy.artifactTypeId || policy.artifactTypeId === artifactTypeId);
  return <fieldset className="nested-editor"><legend>Record attachments</legend>
    <p className="hint">Up to 10 files, 20 MB per file and 100 MB per record, using decimal bytes. Files share the record’s access rules and remain unavailable until a clean scan.</p>
    <label className="choice" htmlFor={id}><input id={id} type="checkbox" checked={!!form.attachments} disabled={!form.attachments && !applicable.length} onChange={(event) => client.transact(() => {
      if (event.target.checked) {
        client.setAtPath(["coreDesign", "forms", formIndex, "attachments"], { contractId: FORM_ATTACHMENT_CONTRACT_ID, allowedMediaTypes: ["text/plain", "application/pdf"] });
        if (!applicable.some((policy) => policy.id === retentionPolicyId)) client.setAtPath(["coreDesign", "artifactTypes", artifactIndex, "retentionPolicyId"], applicable[0]!.id);
      } else client.deleteAtPath(["coreDesign", "forms", formIndex, "attachments"]);
    })} />Allow attachments</label>
    {error ? <p role="status">{error}</p> : !applicable.length ? <p>An Organization Admin must create an applicable automatic-deletion Retention Policy before attachments can be enabled.</p> : null}
    {form.attachments ? <>
      <div className="field"><label htmlFor={`${id}-retention`}>Attachment retention</label><select id={`${id}-retention`} value={retentionPolicyId ?? ""} onChange={(event) => client.setAtPath(["coreDesign", "artifactTypes", artifactIndex, "retentionPolicyId"], event.target.value)}>
        <option value="">Choose a Retention Policy</option>{applicable.map((policy) => <option key={policy.id} value={policy.id}>{policy.label}</option>)}
      </select></div>
      <fieldset className="choice-group"><legend>Allowed file types</legend>{FORM_ATTACHMENT_MEDIA_TYPES.map((type) => <label className="choice" key={type}><input type="checkbox" checked={form.attachments!.allowedMediaTypes.includes(type)} onChange={(event) =>
        client.setAtPath(["coreDesign", "forms", formIndex, "attachments", "allowedMediaTypes"], event.target.checked ? [...form.attachments!.allowedMediaTypes, type] : form.attachments!.allowedMediaTypes.filter((item) => item !== type))} />{formAttachmentMediaTypeLabel(type)}</label>)}</fieldset>
    </> : null}
  </fieldset>;
}
