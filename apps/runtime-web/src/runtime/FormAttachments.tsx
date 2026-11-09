import { displayStatus } from "../../../../packages/design-system/src/presentation.mjs";
import { useEffect, useId, useRef, useState } from "react";
import type { CommandEnvelopeV1, CommandReceiptV1, FormAttachmentV1, RuntimeArtifactV1 } from "@plenum/event-contracts";
import { FORM_LIMITS, formAttachmentMediaTypeLabel } from "@plenum/simulation-schema";

export function FormAttachments({ artifact, sessionId, deviceId, activeSessionRoleId, disabled, readOnly, onChanged }: {
  artifact: RuntimeArtifactV1; sessionId: string; deviceId: string; activeSessionRoleId: string; disabled: boolean; readOnly: boolean; onChanged(): Promise<void>;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FormAttachmentV1[]>([]), [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState(artifact.form.attachments?.allowedMediaTypes[0] ?? "text/plain");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const pending = useRef<{ attachmentId: string; command: CommandEnvelopeV1; file?: File; mediaType?: string; rescan: boolean; reconcile?: boolean } | null>(null);
  const base = `/v1/sessions/${sessionId}/runtime-artifacts/${artifact.id}/attachments`;
  const query = `?activeSessionRoleId=${encodeURIComponent(activeSessionRoleId)}`;
  const canUpload = !readOnly && artifact.actions.some((action) => action.operationType === "artifact.edit" && !action.editableFieldKeys);
  const headers = { "x-device-id": deviceId, "content-type": "application/json" };
  const load = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(base + query, { headers, ...(signal ? { signal } : {}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Attachments are unavailable.");
      if (!signal?.aborted) setFiles(body.attachments);
    } catch (error) { if (!signal?.aborted) { setFiles([]); setMessage(error instanceof Error ? error.message : "Attachments are unavailable."); } }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [base, query, artifact.version]);
  const command = (rescan: boolean): CommandEnvelopeV1 => ({ commandId: crypto.randomUUID(), deviceId, operationType: rescan ? "artifact.rescan_file" : "artifact.attach_file",
    aggregateId: artifact.id, expectedAggregateVersion: artifact.version, governingReleaseId: artifact.governingReleaseId, activeSessionRoleId, payload: {} });
  const submit = async (attachmentId?: string) => {
    if (!navigator.onLine) { setMessage("Attachments require a live connection. The selected file remains on this device."); return; }
    if (!pending.current) {
      if (!attachmentId && !file) return;
      if (!attachmentId && file && (file.size === 0 || file.size > FORM_LIMITS.attachmentBytes)) { setMessage("Choose a file between 1 byte and 20 MB."); return; }
      pending.current = { attachmentId: attachmentId ?? crypto.randomUUID(), command: command(!!attachmentId), rescan: !!attachmentId,
        ...(!attachmentId && file ? { file, mediaType } : {}) };
    }
    const request = pending.current;
    setBusy(true); setMessage("Local pending: uploading and scanning. Awaiting the server receipt.");
    try {
      const contentBase64 = request.file ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error("The selected file could not be read."));
        reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? ""); reader.readAsDataURL(request.file!);
      }) : undefined;
      const response = await fetch(base + (request.rescan ? `/${request.attachmentId}/rescan` : "") + query, { method: "POST", headers,
        body: JSON.stringify(request.rescan ? request.command : { command: request.command, attachmentId: request.attachmentId,
          fileName: request.file!.name, mediaType: request.mediaType, contentBase64 }) });
      const receipt = await response.json() as CommandReceiptV1 & { error?: { code: string; message: string } };
      if (!response.ok) {
        if (receipt.error?.code === "STALE_AGGREGATE_VERSION") { request.reconcile = true; await onChanged(); }
        throw new Error(receipt.error?.message ?? "The upload failed. Retry the same file.");
      }
      if (receipt.status === "accepted") {
        pending.current = null; setFile(null);
        if (fileInput.current) fileInput.current.value = "";
        setMessage(receipt.replayed ? "The original server receipt was recovered." : "The server accepted the attachment operation. Only clean files can be downloaded.");
      } else {
        request.reconcile = true;
        setMessage(`${receipt.status === "needs_reconciliation" ? "Refresh required" : "Server rejected the operation"}: ${receipt.message ?? receipt.errorCode}. The selected file is retained for retry.`);
      }
      await load(); await onChanged();
    } catch (error) { setMessage(`${error instanceof Error ? error.message : "The server receipt was not received."} Retry to recover the outcome; it is not confirmed accepted.`); }
    finally { setBusy(false); }
  };
  return <section className="card" aria-labelledby={`${id}-heading`}><h3 id={`${id}-heading`}>Attachments for {artifact.title}</h3>
    <p>10 files maximum · 20 MB each · 100 MB total. Files use this record’s access and retention rules. Scanning failures and infected files remain unavailable.</p>
    {files.length ? <ul className="runtime-resource-list">{files.map((item) => <li key={item.id}><div><strong>{item.fileName}</strong><span>{item.sizeBytes.toLocaleString()} bytes · {displayStatus(item.scanStatus)}</span></div>
      <div><button type="button" className="btn-secondary" aria-label={`Download ${item.fileName}`} disabled={disabled || busy || !item.available} onClick={async () => {
        setBusy(true);
        try {
          const response = await fetch(`${base}/${item.id}${query}`, { headers });
          if (!response.ok) { const body = await response.json(); throw new Error(body.error?.message ?? "The file is unavailable."); }
          const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = item.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { setMessage(error instanceof Error ? error.message : "Download unavailable."); }
        finally { setBusy(false); }
      }}>Download</button>
      {item.canRetryScan && canUpload ? <button type="button" className="btn-secondary" aria-label={`Retry scan for ${item.fileName}`} disabled={disabled || busy || !!pending.current} onClick={() => void submit(item.id)}>Retry scan</button> : null}</div>
    </li>)}</ul> : <p>No attached files.</p>}
    {canUpload ? <>
      <div className="field"><label htmlFor={`${id}-file`}>Choose attachment</label><input ref={fileInput} id={`${id}-file`} type="file" accept={artifact.form.attachments!.allowedMediaTypes.join(",")} disabled={disabled || busy || !!pending.current} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
      <div className="field"><label htmlFor={`${id}-type`}>File type</label><select id={`${id}-type`} value={mediaType} disabled={disabled || busy || !!pending.current} onChange={(event) => setMediaType(event.target.value as typeof mediaType)}>
        {artifact.form.attachments!.allowedMediaTypes.map((type) => <option value={type} key={type}>{formAttachmentMediaTypeLabel(type)}</option>)}
      </select></div>
      <button type="button" className="btn-primary" disabled={disabled || busy || (!file && !pending.current)} onClick={() => {
        if (pending.current?.reconcile) { pending.current.command = command(pending.current.rescan); pending.current.reconcile = false; }
        void submit();
      }}>{pending.current ? "Retry pending operation" : "Upload and scan"}</button>
    </> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
