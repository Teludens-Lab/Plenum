import { useState, type FormEvent } from "react";
import type { JsonObject, RuntimeModuleV1 } from "@plenum/event-contracts";

export function StageControls({ module, disabled, send }: {
  module: RuntimeModuleV1; disabled: boolean;
  send(operation: string, version: number, payload: JsonObject): void;
}) {
  const control = module.configuration.stageControl;
  const [choice, setChoice] = useState("");
  if (control === null || typeof control !== "object" || Array.isArray(control) || !Array.isArray(control.actions)) return null;
  const actions = control.actions.filter((action): action is JsonObject => action !== null && typeof action === "object" && !Array.isArray(action));
  const selected = actions.find((action) => action.id === choice);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selected === undefined || typeof selected.operation !== "string" || typeof control.version !== "number") return;
    const data = new FormData(event.currentTarget);
    send(selected.operation, control.version, { reason: String(data.get("reason")),
      ...(typeof selected.targetStageId === "string" ? { targetStageId: selected.targetStageId } : {}),
      ...(selected.operation === "stage.extend" ? { seconds: Number(data.get("minutes")) * 60 } : {}) });
  };
  return <form className="runtime-stage-controls" onSubmit={submit}>
    <h3>Move and timer control</h3>
    <p className="hint">Changes are checked against the current stage and its completion requirements.</p>
    <div className="field"><label htmlFor="participant-stage-action">Action</label>
      <select id="participant-stage-action" value={selected === undefined ? "" : choice} required disabled={disabled} onChange={(event) => setChoice(event.target.value)}>
        <option value="">Choose a control</option>{actions.map((action) => <option key={String(action.id)} value={String(action.id)}>{String(action.label)}</option>)}
      </select></div>
    {selected?.operation === "stage.extend" ? <div className="field"><label htmlFor="participant-stage-minutes">Additional minutes</label>
      <input id="participant-stage-minutes" name="minutes" type="number" min="1" step="1" defaultValue="5" required disabled={disabled} /></div> : null}
    <div className="field"><label htmlFor="participant-stage-reason">Reason for this change</label>
      <textarea id="participant-stage-reason" name="reason" required minLength={3} maxLength={500} disabled={disabled} /></div>
    <button className="btn-primary" type="submit" disabled={disabled || selected === undefined}>Apply control</button>
  </form>;
}
