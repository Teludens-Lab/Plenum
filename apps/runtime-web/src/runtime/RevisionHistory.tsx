import { formatDate } from "../../../../packages/design-system/src/presentation.mjs";
import { useEffect, useId, useRef, useState } from "react";
import type { RuntimeArtifactHistoryV1, RuntimeArtifactV1, RuntimeModuleV1 } from "@plenum/event-contracts";
import { ArtifactContent } from "./ArtifactForms.js";
import { moduleArtifacts } from "./ArtifactWorkspace.js";

export function RevisionHistory({ module, artifacts, active, online, load }: {
  module: RuntimeModuleV1; artifacts: RuntimeArtifactV1[]; active: boolean; online: boolean;
  load(artifactId: string, beforeVersion?: number): Promise<RuntimeArtifactHistoryV1>;
}) {
  const id = useId();
  const records = moduleArtifacts(module, artifacts);
  const [selectedId, setSelectedId] = useState("");
  const selected = records.find((record) => record.id === selectedId) ?? records[0];
  const [history, setHistory] = useState<RuntimeArtifactHistoryV1 | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setHistory(null); setError(""); setPending(false);
    if (!active || !online || selected === undefined) return;
    setPending(true);
    void load(selected.id).then((result) => { if (generation.current === current) setHistory(result); })
      .catch(() => { if (generation.current === current) setError("Could not load revision history. Try again."); })
      .finally(() => { if (generation.current === current) setPending(false); });
    return () => { generation.current++; };
  }, [selected?.id, selected?.version, active, online, retry]);
  const older = async () => {
    if (selected === undefined || history?.nextBeforeVersion == null || pending) return;
    const current = generation.current;
    setPending(true); setError("");
    try {
      const next = await load(selected.id, history.nextBeforeVersion);
      if (generation.current === current) setHistory({ ...next, revisions: [...history.revisions, ...next.revisions] });
    } catch { if (generation.current === current) setError("Could not load older revisions. Try again."); }
    finally { if (generation.current === current) setPending(false); }
  };
  return <section id={`runtime-module-${module.id}`} className="card revision-history" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>{module.title}</h2>
    <p className="hint">Review saved submission versions and returned work. Private drafts are excluded.</p>
    {records.length === 0 ? <p>{module.emptyStateText}</p> : <div className="field"><label htmlFor={`${id}-record`}>Submission</label>
      <select id={`${id}-record`} value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
        {records.map((record) => <option key={record.id} value={record.id}>{String(record.payload.title ?? record.title)} — {record.stateLabel}</option>)}
      </select>
    </div>}
    {!online ? <p>Reconnect to view revision history.</p> : null}
    {error === "" ? null : <div role="alert"><p>{error}</p><button className="btn-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
    {pending ? <p role="status">Loading revisions…</p> : null}
    {history?.revisions.length === 0 ? <p>No submitted revisions are available yet.</p> : null}
    {history?.revisions.map((revision) => <details key={revision.version} className="artifact-edit">
      <summary>Version {revision.version} — {revision.stateLabel}</summary>
      <p className="hint">{revision.authorDisplayName} · <time dateTime={revision.recordedAt}>{formatDate(revision.recordedAt)}</time></p>
      <ArtifactContent form={revision.form} payload={revision.payload} />
    </details>)}
    {history?.nextBeforeVersion == null ? null : <button className="btn-secondary" type="button" disabled={pending || !online} onClick={() => void older()}>Load older revisions</button>}
  </section>;
}
