import { useId, useState, type FormEvent } from "react";
import type { JsonObject, RuntimeModuleV1 } from "@plenum/event-contracts";
import { displayStatus } from "../../../../packages/design-system/src/presentation.mjs";
import { extensionSeconds } from "./timer-extension.js";

export interface StageReadout { label: string | null; status: string | null; clock: string | null }

const TIMER_OPERATIONS = new Set(["stage.start", "stage.pause", "stage.resume", "stage.extend", "stage.end", "stage.reopen"]);

/**
 * Stage and timer commands projected by the server for the active role. Choosing a command opens one confirmation
 * row that collects the required reason (and additional minutes for an extension). The projection only lists
 * permitted commands; the command handler still rechecks authorization, Stage rules and the aggregate version.
 */
export function StageControls({ module, stage, disabled, send }: {
  module: RuntimeModuleV1; stage: StageReadout; disabled: boolean;
  send(operation: string, version: number, payload: JsonObject): void;
}) {
  const control = module.configuration.stageControl;
  const [choice, setChoice] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  if (control === null || typeof control !== "object" || Array.isArray(control) || !Array.isArray(control.actions)) return null;
  const actions = control.actions.filter((action): action is JsonObject => action !== null && typeof action === "object" && !Array.isArray(action));
  const selected = actions.find((action) => action.id === choice);
  const stageActions = actions.filter((action) => !TIMER_OPERATIONS.has(String(action.operation)));
  const timerActions = actions.filter((action) => TIMER_OPERATIONS.has(String(action.operation)));
  const status = stage.status === null ? "Not started" : displayStatus(stage.status);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected === undefined || typeof selected.operation !== "string" || typeof control.version !== "number") return;
    const data = new FormData(event.currentTarget);
    setError("");
    let seconds: number | undefined;
    try { if (selected.operation === "stage.extend") seconds = extensionSeconds(String(data.get("minutes"))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Check the additional minutes."); return; }
    send(selected.operation, control.version, { reason: String(data.get("reason")),
      ...(typeof selected.targetStageId === "string" ? { targetStageId: selected.targetStageId } : {}),
      ...(seconds === undefined ? {} : { seconds }) });
  };
  const commandButtons = (group: JsonObject[], empty: string) => group.length === 0 ? <p className="stage-control-empty">{empty}</p>
    : <div className="stage-control-actions">{group.map((action) => <button key={String(action.id)} className="btn-secondary" type="button"
      aria-pressed={choice === action.id} aria-controls={`${id}-confirm`} disabled={disabled}
      onClick={() => { setChoice(choice === action.id ? "" : String(action.id)); setError(""); }}>{String(action.label)}</button>)}</div>;
  const selectedLabel = selected === undefined ? "" : String(selected.label);
  return <section className="stage-control-panel" aria-labelledby={`${id}-title`}>
    <div className="stage-control-heading">
      <h3 id={`${id}-title`}>Stage and timer</h3>
      <p>Each change records your reason and is checked against the current Stage and its completion requirements.</p>
    </div>
    <div className="stage-control-columns">
      <div className="stage-control-column" role="group" aria-labelledby={`${id}-stage`}>
        <p className="stage-control-label" id={`${id}-stage`}>Current Stage</p>
        <p className="stage-control-readout">{stage.label ?? "Not started"}</p>
        {commandButtons(stageActions, "No Stage moves are available right now.")}
      </div>
      <div className="stage-control-column" role="group" aria-labelledby={`${id}-timer`}>
        <p className="stage-control-label" id={`${id}-timer`}>Timer</p>
        <p className="stage-control-readout stage-control-clock">{stage.clock ?? "Untimed"}</p>
        <p className="stage-control-meta">{status}</p>
        {commandButtons(timerActions, "No timer controls are available right now.")}
      </div>
    </div>
    <div id={`${id}-confirm`}>
      {selected === undefined ? null : <form className="stage-control-confirm" onSubmit={submit} aria-labelledby={`${id}-confirm-title`}>
        <h4 id={`${id}-confirm-title`}>{selectedLabel}</h4>
        {selected.operation === "stage.extend" ? <div className="field"><label htmlFor={`${id}-minutes`}>Additional minutes</label>
          <input id={`${id}-minutes`} name="minutes" type="number" min="1" step="1" defaultValue="5" required disabled={disabled} autoFocus /></div> : null}
        <div className="field"><label htmlFor={`${id}-reason`}>Reason for this change</label>
          <textarea id={`${id}-reason`} name="reason" required minLength={3} maxLength={500} disabled={disabled}
            autoFocus={selected.operation !== "stage.extend"} /></div>
        {error ? <p role="alert">{error}</p> : null}
        <div className="form-actions">
          <button className="btn-secondary" type="button" onClick={() => { setChoice(""); setError(""); }}>Cancel</button>
          <button className="btn-primary" type="submit" disabled={disabled}>Confirm {selectedLabel.charAt(0).toLowerCase()}{selectedLabel.slice(1)}</button>
        </div>
      </form>}
    </div>
  </section>;
}
