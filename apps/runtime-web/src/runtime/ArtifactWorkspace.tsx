import { useEffect, useRef, useState, type ReactNode } from "react";
import type { RuntimeArtifactV1, RuntimeModuleV1 } from "@plenum/event-contracts";
import { RuntimeIcon } from "./RuntimeFrame.js";

/** Presentation filters only: the server projection remains the authority for visibility and actions. */
export function moduleArtifacts<T extends { artifactTypeKey: string }>(module: RuntimeModuleV1, records: T[]): T[] {
  const keys = module.configuration.artifactTypeKeys;
  return Array.isArray(keys) ? records.filter((record) => keys.includes(record.artifactTypeKey)) : records;
}

export function ArtifactWorkspace({ module, artifacts, renderArtifact }: {
  module: RuntimeModuleV1; artifacts: RuntimeArtifactV1[]; renderArtifact(artifact: RuntimeArtifactV1): ReactNode;
}) {
  const [type, setType] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const fullScreenButton = useRef<HTMLButtonElement>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [presentationNotice, setPresentationNotice] = useState("");
  const presenting = module.type === "artifact_presentation";
  useEffect(() => {
    const change = () => {
      const active = document.fullscreenElement === root.current;
      setFullScreen(active);
      if (active) root.current?.focus();
      else if (presenting) fullScreenButton.current?.focus();
    };
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, [presenting]);
  const records = moduleArtifacts(module, artifacts).slice().reverse();
  const types = [...new Map(records.map((record) => [record.artifactTypeKey, record.form.name])).entries()];
  const activeType = types.some(([key]) => key === type) ? type : "all";
  const filtered = activeType === "all" ? records : records.filter((record) => record.artifactTypeKey === activeType);
  const selected = filtered.find((record) => record.id === selectedId) ?? filtered[0];
  const index = selected === undefined ? -1 : filtered.indexOf(selected);
  const review = module.configuration.presentation === "review" || module.type === "artifact_presentation";
  const recent = module.configuration.presentation === "recent";
  return <section ref={root} id={`runtime-module-${module.id}`} className={`artifact-workspace${review ? " is-review" : ""}${recent ? " is-recent" : ""}${presenting ? " is-presentation" : ""}`}
    aria-label={module.title} tabIndex={presenting ? 0 : undefined} onKeyDown={(event) => {
      if (!presenting || event.altKey || event.ctrlKey || event.metaKey || filtered.length === 0) return;
      if ((event.target as HTMLElement).closest("input, textarea, select")) return;
      const target = event.key === "Home" ? 0 : event.key === "End" ? filtered.length - 1
        : ["ArrowLeft", "PageUp"].includes(event.key) ? Math.max(0, index - 1)
          : ["ArrowRight", "PageDown"].includes(event.key) ? Math.min(filtered.length - 1, index + 1) : null;
      if (target !== null) { event.preventDefault(); setSelectedId(filtered[target]!.id); }
    }}>
    {presenting ? <div className="artifact-presentation-toolbar">
      <p className="hint">Use Left/Right arrows or Page Up/Down to change records, Home/End for first/last, and Escape to leave full screen.</p>
      <button ref={fullScreenButton} className="btn-secondary" type="button" onClick={() => {
        const result = fullScreen ? document.exitFullscreen() : root.current?.requestFullscreen?.();
        if (result === undefined) setPresentationNotice("Full screen is unavailable in this browser. The presentation remains usable here.");
        else void result.catch(() => setPresentationNotice("Full screen could not open. The presentation remains usable here."));
      }}>{fullScreen ? "Exit full screen" : "Enter full screen"}</button>
      {presentationNotice === "" ? null : <p role="status">{presentationNotice}</p>}
    </div> : null}
    <h2 className={recent ? "runtime-page-eyebrow" : "sr-only"}>{module.title}</h2>
    {types.length < 2 || recent ? null : <div className="artifact-type-tabs" role="group" aria-label="Filter records by form">
      <button type="button" aria-pressed={activeType === "all"} onClick={() => { setType("all"); setSelectedId(null); }}>All records <span>{records.length}</span></button>
      {types.map(([key, label]) => <button key={key} type="button" aria-pressed={activeType === key}
        onClick={() => { setType(key); setSelectedId(null); }}>{label} <span>{records.filter((record) => record.artifactTypeKey === key).length}</span></button>)}
    </div>}
    {filtered.length === 0 ? <div className="artifact-empty"><RuntimeIcon name={recent ? "edit" : "list"} />
      <h3>{recent ? "No captures yet" : "No records yet"}</h3><p>{module.emptyStateText}</p></div>
      : review && selected !== undefined ? <div className="artifact-review-layout">
        <nav aria-label="Choose a record" className="artifact-record-index">{filtered.map((record) => <button key={record.id} type="button"
          aria-current={record.id === selected.id ? "true" : undefined} onClick={() => setSelectedId(record.id)}>
          <strong>{typeof record.payload.title === "string" ? record.payload.title : record.title}</strong><span>{record.stateLabel}</span>
        </button>)}</nav>
        <div className="artifact-review-detail">
          <div className="artifact-pager" role="group" aria-label="Record navigation">
            {presenting ? <button className="btn-secondary" type="button" disabled={index <= 0} onClick={() => setSelectedId(filtered[0]!.id)}>First</button> : null}
            <button className="btn-secondary" type="button" aria-label="Previous record" disabled={index <= 0}
              onClick={() => setSelectedId(filtered[index - 1]!.id)}><RuntimeIcon name="chevronLeft" /></button>
            <span role="status">{index + 1} of {filtered.length}</span>
            <button className="btn-secondary" type="button" aria-label="Next record" disabled={index >= filtered.length - 1}
              onClick={() => setSelectedId(filtered[index + 1]!.id)}><RuntimeIcon name="chevronRight" /></button>
            {presenting ? <button className="btn-secondary" type="button" disabled={index >= filtered.length - 1} onClick={() => setSelectedId(filtered.at(-1)!.id)}>Last</button> : null}
          </div>
          {filtered.map((record) => <div key={record.id} hidden={record.id !== selected.id}>{renderArtifact(record)}</div>)}
        </div>
      </div> : <div className="artifact-records">{filtered.map((record) => <div key={record.id}>{renderArtifact(record)}</div>)}</div>}
  </section>;
}
