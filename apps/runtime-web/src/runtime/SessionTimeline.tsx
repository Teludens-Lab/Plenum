import { useEffect, useId, useRef, useState } from "react";
import type { RuntimeTimelineV1 } from "@plenum/event-contracts";

export function SessionTimeline({ firstPage, online, loadOlder }: {
  firstPage: RuntimeTimelineV1 | undefined; online: boolean; loadOlder(before: number): Promise<RuntimeTimelineV1>;
}) {
  const id = useId();
  const [pages, setPages] = useState<RuntimeTimelineV1[]>([]);
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => { generation.current++; setPages([]); setError(""); setBusy(false); }, [firstPage]);
  const entries = [...new Map([...(firstPage?.entries ?? []), ...pages.flatMap((page) => page.entries)].map((entry) => [entry.id, entry])).values()];
  const filtered = entries.filter((entry) => category === "all" || entry.category === category);
  const before = pages.at(-1)?.nextBefore ?? (pages.length === 0 ? firstPage?.nextBefore : null);
  return <section className="card session-timeline" aria-label="Session timeline">
    <div className="field"><label htmlFor={id}>Activity type</label><select id={id} value={category} onChange={(event) => setCategory(event.target.value)}>
      <option value="all">All activity</option><option value="artifact">Actions and captures</option><option value="message">Messages</option>
      <option value="stage">Stage controls</option><option value="inject">Injects</option>
    </select></div>
    <p className="hint">Newest first. Activity is limited to records available to your current role.</p>
    {firstPage === undefined ? <p>Timeline is unavailable in this view. Refresh while connected to load it.</p>
      : filtered.length === 0 ? <p className="empty-state">No matching activity in the loaded history.</p>
        : <ol className="event-list">{filtered.map((entry) => <li key={entry.id}>
          <div><strong>{entry.title}</strong><span> {entry.activity}{entry.version === null ? "" : ` · version ${entry.version}`}</span></div>
          <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time>
        </li>)}</ol>}
    <p role="status">{busy ? "Loading earlier activity…" : error || `${filtered.length} matching events loaded.`}</p>
    {before == null ? null : <button className="btn-secondary" type="button" disabled={busy || !online} onClick={async () => {
      setBusy(true); setError("");
      const request = generation.current;
      try { const page = await loadOlder(before); if (request === generation.current) setPages((current) => [...current, page]); }
      catch { if (request === generation.current) setError("Earlier activity could not be loaded. Try again."); }
      finally { if (request === generation.current) setBusy(false); }
    }}>{error ? "Retry earlier activity" : "Load earlier activity"}</button>}
  </section>;
}
