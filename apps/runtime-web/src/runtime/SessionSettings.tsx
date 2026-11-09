import { useId, useState, type ReactNode } from "react";
import type { RuntimeModuleV1, RuntimeProjectionV1 } from "@plenum/event-contracts";
import { displayStatus } from "../../../../packages/design-system/src/presentation.mjs";

const tabs = ["Game Controls", "Sessions", "Participants", "Decks", "Plugins", "Export Data"] as const;
export function SessionSettings({ module, projection, controls, openModule }: {
  module: RuntimeModuleV1; projection: RuntimeProjectionV1; controls: ReactNode; openModule(id: string): void;
}) {
  const [selected, setSelected] = useState<string>(tabs[0]);
  const id = useId();
  const operator = module.configuration.operatorAccess === true;
  const schedule = Array.isArray(module.configuration.stageSchedule) ? module.configuration.stageSchedule : [];
  const decks = projection.modules.filter((item) => item.type === "slide_deck");
  const deckLabel = typeof module.configuration.deckLabel === "string" ? module.configuration.deckLabel : "Decks";
  const feeds = projection.modules.filter((item) => item.configuration.settingsGroup === "plugins");
  const unavailable = <p>Session management requires an active Operator assignment. Your session controls remain available under Game Controls.</p>;
  const operatorLink = (suffix: string, label: string) => operator
    ? <a className="btn-secondary link-button" href={`/admin/sessions/${projection.sessionId}${suffix}`}>{label}</a> : unavailable;
  return <section className="session-settings" aria-label="Simulation Settings">
    <div className="artifact-type-tabs" role="tablist" aria-label="Simulation settings sections">{tabs.map((tab, index) => <button key={tab} type="button"
      id={`${id}-tab-${index}`} role="tab" aria-selected={selected === tab} aria-controls={`${id}-panel-${index}`} tabIndex={selected === tab ? 0 : -1}
      onClick={() => setSelected(tab)} onKeyDown={(event) => {
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
        if (next !== null) { event.preventDefault(); setSelected(tabs[next]!); document.getElementById(`${id}-tab-${next}`)?.focus(); }
      }}>{tab === "Decks" ? deckLabel : tab}</button>)}</div>
    {tabs.map((tab, index) => <div key={tab} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={selected !== tab} tabIndex={0}>
      {tab === "Game Controls" ? <>
        <h2 className="visually-hidden">Game Controls</h2>
        <p>{projection.currentStageLabel ?? "Not started"} · {displayStatus(projection.currentStageStatus)}</p>{controls}
        <h3>Time allocations</h3><p className="hint">The Release defines each stage’s base time. Extend the active timer above when needed.</p>
        <dl className="runtime-status-list">{schedule.map((item) => typeof item !== "object" || item === null || Array.isArray(item) ? null : <div key={String(item.id)}>
          <dt>{String(item.label)}{item.id === projection.currentStageId ? " · current" : ""}</dt><dd>{typeof item.durationSeconds === "number" ? `${item.durationSeconds / 60} minutes` : "Untimed"}</dd>
        </div>)}</dl>
      </> : tab === "Sessions" ? <><h2>Current Session</h2><dl className="runtime-status-list">
        <div><dt>Session</dt><dd>{projection.sessionTitle ?? projection.releaseLabel}</dd></div><div><dt>Status</dt><dd>{displayStatus(projection.sessionStatus)}</dd></div>
        <div><dt>Release</dt><dd>{projection.releaseLabel}</dd></div></dl>
        {operatorLink("", "Open Session control")}
      </> : tab === "Participants" ? operatorLink("#staffing", "Open Staffing")
        : tab === "Decks" ? <><h2>{deckLabel}</h2>{decks.length === 0 ? <p>No decks are configured in this Release.</p> : decks.map((deck) => <button key={deck.id}
          className="btn-secondary" type="button" onClick={() => openModule(deck.id)}>Open {deck.title}</button>)}</>
        : tab === "Plugins" ? <><h2>Published updates</h2><p>Open a configured feed to review or publish Session updates.</p>
          <div className="actions">{feeds.map((feed) => <button key={feed.id} className="btn-secondary" type="button" onClick={() => openModule(feed.id)}>{feed.title}</button>)}</div></>
          : operatorLink("/reports", "Open Reports")}
    </div>)}
  </section>;
}
