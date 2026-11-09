import { useId, useState } from "react";

function localDateTime(instant: string): string {
  const date = new Date(instant);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

export function OperatorInjectSchedule({ title, scheduledAt, disabled, reschedule }: {
  title: string; scheduledAt: string; disabled: boolean;
  reschedule(scheduledAt: string, reason: string): void;
}) {
  const id = useId();
  const [value, setValue] = useState(() => localDateTime(scheduledAt));
  const date = new Date(value);
  const valid = Number.isFinite(date.getTime());
  return <details className="operator-inject-schedule"><summary>Change delivery time</summary>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!valid) return;
      const data = new FormData(event.currentTarget);
      reschedule(date.toISOString(), String(data.get("reason") ?? ""));
    }}><fieldset disabled={disabled}><legend>Reschedule {title}</legend>
      <div className="field"><label htmlFor={`${id}-time`}>New delivery date and time (your local time)</label>
        <input id={`${id}-time`} type="datetime-local" step={1} required value={value}
          aria-describedby={`${id}-guidance`} onChange={(event) => setValue(event.target.value)} /></div>
      <p id={`${id}-guidance`} className="hint">{valid ? `UTC: ${date.toISOString()}. ` : "Choose a valid date and time. "}
        Past times become due on the next server check. Delivery waits while the Session is paused.</p>
      <div className="field"><label htmlFor={`${id}-reason`}>Reason for rescheduling</label>
        <input id={`${id}-reason`} name="reason" required minLength={3} maxLength={500} /></div>
      <label className="choice"><input type="checkbox" required />Confirm the new Inject delivery time.</label>
      <button className="btn-secondary" type="submit" disabled={disabled || !valid}>Reschedule Inject</button>
    </fieldset></form>
  </details>;
}
