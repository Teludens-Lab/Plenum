import { useId, useRef, useState } from "react";
import type { ReadinessProjectionV1 } from "@plenum/event-contracts";

export function StaffingPersonPicker({ sessionId, staffing, required = false }: {
  sessionId: string; staffing: ReadinessProjectionV1["staffing"]; required?: boolean;
}) {
  const id = useId(), generation = useRef(0);
  const [result, setResult] = useState<typeof staffing | null>(null);
  const [query, setQuery] = useState(""), [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const people = result ?? staffing;
  return <fieldset><legend>{required ? "Participant" : "Invitation recipient"}</legend>
    <div className="field"><label htmlFor={`${id}-search`}>Find by display name</label>
    <input id={`${id}-search`} type="search" value={query} maxLength={200} onChange={(event) => setQuery(event.target.value)} /></div>
    <button type="button" className="btn-secondary" disabled={pending} onClick={async () => {
      const current = ++generation.current; setPending(true); setMessage("");
      try {
        const response = await fetch(`/v1/sessions/${sessionId}/readiness${query.trim() ? `?query=${encodeURIComponent(query.trim())}` : ""}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message ?? "The directory could not be loaded.");
        if (current === generation.current) { setResult(body.staffing); setMessage(`${body.staffing.people?.length ?? 0} matching people.`); }
      } catch (error) { if (current === generation.current) setMessage(error instanceof Error ? error.message : "The directory could not be loaded."); }
      finally { if (current === generation.current) setPending(false); }
    }}>Search people</button>
    <div className="field"><label htmlFor={`${id}-person`}>{required ? "Participant name" : "Recipient name (optional)"}</label>
    <select id={`${id}-person`} name="personId" required={required} defaultValue="" disabled={pending}>
      <option value="">{required ? "Choose a person" : "Unreserved invitation"}</option>
      {(people.people ?? []).map((person) => <option key={person.personId} value={person.personId}>{person.displayName}</option>)}
    </select></div>
    {people.peopleTruncated ? <p>Showing the first 100 matches. Narrow the display name to find another person.</p> : null}
    {message ? <p role="status">{message}</p> : null}
  </fieldset>;
}
