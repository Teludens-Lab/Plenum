import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ErrorEnvelopeV1, JsonObject } from "@plenum/event-contracts";
import { PlenumLoader } from "../PlenumLoader.js";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { "content-type": "application/json" } });
  const body = await response.json() as T | ErrorEnvelopeV1;
  if (!response.ok) throw new Error(typeof body === "object" && body !== null && "error" in body ? body.error.message : `Request failed with status ${response.status}`);
  return body as T;
}

type ResearchSession = { sessionId: string; title: string; projectTitle: string; releaseLabel: string };
type ResearchPreview = { capturedHistoryLabel?: string; reconstructedNarrativeLabel?: string;
  observations?: Array<{ elementId?: string; eventType?: string; subjectRef?: string | null; sourceReferences?: string[] }>;
  derivedMetrics?: Array<{ metricKey?: string; value?: number; sourceReferences?: string[] }>;
  provenance?: { sourceReconciliation?: JsonObject; reconstructedNarrativeIsTranscript?: boolean } };

export function ResearchReportingPortal() {
  const [sessions, setSessions] = useState<ResearchSession[] | null>(null);
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("Loading project-scoped Research Access Grants.");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<ResearchPreview | null>(null);
  const [artifacts, setArtifacts] = useState<Array<{ artifactId: string; filename: string; sha256: string; createdAt: string; purgedAt: string | null }>>([]);
  const load = useCallback(async () => {
    const result = await request<{ sessions: ResearchSession[] }>("/v1/research/reportable-sessions");
    setSessions(result.sessions); setSelected((current) => current || result.sessions[0]?.sessionId || "");
    setNotice(result.sessions.length === 0 ? "No active project-scoped Research Access Grant is available." : "Research reporting scope is current.");
  }, []);
  useEffect(() => { void load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Research scope did not load.")); }, [load]);
  useEffect(() => {
    if (selected === "") { setArtifacts([]); return; }
    void request<{ artifacts: typeof artifacts }>(`/v1/sessions/${selected}/reports`).then((result) => setArtifacts(result.artifacts))
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Report history did not load."));
  }, [selected]);
  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (selected === "" || pending) return; const data = new FormData(event.currentTarget);
    const format = String(data.get("format")); setPending(true); setNotice("Generating a consent-filtered research export.");
    try {
      const response = await fetch(`/v1/sessions/${selected}/reports`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), reportKind: "research_dataset", format, purposeLabel: String(data.get("purposeLabel")) }) });
      if (!response.ok) { const body = await response.json() as ErrorEnvelopeV1; throw new Error(body.error.message); }
      const blob = await response.blob();
      if (format === "json") setPreview(JSON.parse(await blob.text()) as ResearchPreview); else setPreview(null);
      const href = URL.createObjectURL(blob); const download = document.createElement("a"); download.href = href;
      download.download = `plenum-research-export.${format}`; download.click(); URL.revokeObjectURL(href);
      const history = await request<{ artifacts: typeof artifacts }>(`/v1/sessions/${selected}/reports`); setArtifacts(history.artifacts);
      setNotice(format === "json" ? "Research export downloaded and opened for provenance inspection." : "Research export downloaded.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The research export was not generated."); }
    finally { setPending(false); }
  };
  return <section className="administration-workspace reporting-workspace" aria-labelledby="research-reports-title">
    <div className="workspace-heading"><h1 id="research-reports-title">Consent-filtered reporting</h1>
      <p>Exports use pseudonyms, enforce purpose-scoped consent, omit identity mappings, and keep Observations, Derived Metrics, Analytical Notes, and Findings distinct.</p></div>
    <p className="live-region" role="status" aria-live="polite">{notice}</p>
    {sessions === null ? <PlenumLoader label="Loading authorized Research Sessions" /> : sessions.length === 0 ? <p className="empty-state">Ask an Admin for a time-bounded project Research Access Grant.</p> : <>
      <form className="card operation-form" onSubmit={(event) => void generate(event)}>
        <h2>Build a research export</h2><div className="field"><label htmlFor="research-session">Authorized Session</label><select id="research-session" value={selected} onChange={(event) => setSelected(event.target.value)}>
          {sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.title} · {session.projectTitle} · {session.releaseLabel}</option>)}</select></div>
        <div className="field"><label htmlFor="research-purpose">Approved research purpose</label><input id="research-purpose" name="purposeLabel" required maxLength={400} /></div>
        <div className="field"><label htmlFor="research-format">Portable format</label><select id="research-format" name="format" defaultValue="json"><option value="json">JSON with provenance preview</option><option value="jsonl">JSONL</option><option value="csv">CSV</option><option value="html">HTML</option><option value="pdf">PDF</option><option value="zip">ZIP package</option></select></div>
        <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Generating…" : "Generate consent-filtered export"}</button>
      </form>
      {preview === null ? <section className="report-inspector empty-state" aria-labelledby="research-trace-title"><h2 id="research-trace-title">Provenance inspection</h2>
        <p>Generate a JSON export to inspect consent-filtered observations and source references here.</p></section>
        : <section className="card report-trace report-inspector" aria-labelledby="research-trace-title"><h2 id="research-trace-title">Provenance inspection</h2>
        <p><strong>{preview.capturedHistoryLabel ?? "Captured History"}</strong> remains distinct from <strong>{preview.reconstructedNarrativeLabel ?? "Reconstructed Narrative"}</strong>, which is not a transcript.</p>
        <dl className="provenance-grid"><div><dt>Consented observations</dt><dd>{preview.observations?.length ?? 0}</dd></div><div><dt>Derived metrics</dt><dd>{preview.derivedMetrics?.length ?? 0}</dd></div></dl>
        <ol className="trace-list">{preview.observations?.slice(0, 20).map((item, index) => <li key={item.elementId ?? index}><span><strong>{item.eventType}</strong> · {item.subjectRef ?? "system"}</span><code>{item.sourceReferences?.join(", ")}</code></li>)}</ol>
      </section>}
      <section aria-labelledby="research-history-title"><h2 id="research-history-title">Your generated exports</h2>{artifacts.length === 0 ? <p className="empty-state">No authorized exports have been generated by this analyst.</p> :
        <ul className="administration-list compact">{artifacts.map((artifact) => <li key={artifact.artifactId}><span><strong>{artifact.filename}</strong> · {new Date(artifact.createdAt).toLocaleString()}</span>
          <details className="provenance-disclosure"><summary>Technical provenance</summary><code>{artifact.sha256}</code></details>
          {artifact.purgedAt === null ? <a className="btn-secondary link-button" href={`/v1/report-artifacts/${artifact.artifactId}`}>Download export</a> : <span>Purged under retention policy</span>}</li>)}</ul>}</section>
    </>}
  </section>;
}
