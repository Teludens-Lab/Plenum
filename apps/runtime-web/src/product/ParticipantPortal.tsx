import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { CommandEnvelopeV1, CommandReceiptV1, ParticipantEntryV1, ParticipantSessionEntryV1 } from "@plenum/event-contracts";
import { PlenumLoader } from "../PlenumLoader.js";

const DEVICE_STORAGE_KEY = "plenum.runtime.deviceId";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json() as T | { message?: string; error?: { message?: string } };
  if (!response.ok) {
    const failure = typeof body === "object" && body !== null ? body as { message?: string; error?: { message?: string } } : {};
    throw new Error(failure.error?.message ?? failure.message ?? "The request failed.");
  }
  return body as T;
}

async function device(): Promise<string> {
  const stored = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (stored !== null) return stored;
  const registered = await json<{ deviceId: string }>("/v1/devices", { method: "POST", body: "{}" });
  localStorage.setItem(DEVICE_STORAGE_KEY, registered.deviceId);
  return registered.deviceId;
}

function command(entry: ParticipantSessionEntryV1, deviceId: string, operationType: string,
  aggregateId: string, payload: CommandEnvelopeV1["payload"]): CommandEnvelopeV1 {
  return {
    commandId: crypto.randomUUID(), deviceId, operationType, aggregateId, expectedAggregateVersion: 0,
    governingReleaseId: entry.governingReleaseId, deviceObservedAt: new Date().toISOString(), payload
  };
}

function displayStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/^./u, (character) => character.toUpperCase());
}

export function ParticipantPortal({ displayName }: { displayName: string }) {
  const [entry, setEntry] = useState<ParticipantEntryV1 | null>(null);
  const [message, setMessage] = useState("Loading your authorized Sessions.");
  const [pending, setPending] = useState(false);
  const [sessionCode, setSessionCode] = useState("");

  const load = useCallback(async () => {
    try {
      setEntry(await json<ParticipantEntryV1>("/v1/participant-entry"));
      setMessage("");
    } catch (cause) {
      setEntry(null);
      setMessage(cause instanceof Error ? cause.message : "Your Sessions could not be loaded.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async (session: ParticipantSessionEntryV1, path: string, operationType: string,
    aggregateId: string, payload: CommandEnvelopeV1["payload"]) => {
    if (pending) return;
    setPending(true); setMessage("Submitting to the Session Authority.");
    try {
      const deviceId = await device();
      const receipt = await json<CommandReceiptV1>(path, { method: "POST",
        body: JSON.stringify(command(session, deviceId, operationType, aggregateId, payload)) });
      setMessage(receipt.status === "accepted" ? "Authoritative Session access updated." : receipt.message ?? "The request was not accepted.");
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The Session access request failed.");
    } finally { setPending(false); }
  };

  const joinByCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const code = sessionCode.trim();
    if (code.length < 6) {
      setMessage("Enter the complete Session code. It contains at least 6 characters.");
      return;
    }
    setPending(true);
    setMessage("Finding your Session and confirming access.");
    try {
      const receipt = await json<CommandReceiptV1>("/v1/participant-entry/join-requests", {
        method: "POST",
        body: JSON.stringify({ requestId: crypto.randomUUID(), deviceId: await device(), sessionCode: code })
      });
      if (receipt.status !== "accepted") throw new Error(receipt.message ?? "The Session could not be joined.");
      setSessionCode("");
      setMessage("Session found. Choose an available seat to continue.");
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The Session could not be joined.");
    } finally {
      setPending(false);
    }
  };

  return <section className="participant-portal" aria-labelledby="participant-sessions-title" aria-busy={entry === null && message.startsWith("Loading")}>
    <header className="participant-entry-intro">
      <div><h2 id="participant-sessions-title">Join a simulation</h2>
        <p>Enter the code supplied by your simulation team. Your verified Plenum account remains your identity.</p></div>
      <form className="participant-join-form" onSubmit={(event) => void joinByCode(event)}>
        <label htmlFor="participant-session-code">Session code</label>
        <div><input id="participant-session-code" value={sessionCode} minLength={6} maxLength={100} required
          autoCapitalize="characters" autoComplete="one-time-code" spellCheck={false} disabled={pending}
          onChange={(event) => setSessionCode(event.target.value)} placeholder="Enter your code" />
          <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Checking…" : "Find session"}</button></div>
        <p>Signed in as <strong>{displayName}</strong></p>
      </form>
    </header>
    {entry === null ? <PlenumLoader label="Loading your authorized Sessions" /> : null}
    <p className="live-region participant-entry-notice" role="status" aria-live="polite">{message}</p>
    {entry !== null && entry.sessions.length === 0 ? <div className="empty-state participant-entry-empty">
      <h3>No sessions are linked yet</h3><p>Enter a Session code above, or return when your simulation team sends an invitation.</p>
    </div> : null}
    <div className="participant-session-list">{entry?.sessions.map((session) => {
      const title = session.branding?.title ?? session.title;
      const titleId = `participant-session-${session.sessionId}`;
      return <article className="participant-session" key={session.sessionId} aria-labelledby={titleId}>
        <div className={`participant-session-visual${session.branding?.simulationImage === null || session.branding === undefined ? " participant-session-visual-fallback" : ""}`}>
          {session.branding?.simulationImage === null || session.branding === undefined ? null : <img className="participant-simulation-image"
            src={session.branding.simulationImage.url} alt={session.branding.simulationImage.altText} decoding="async" />}
          <div className="participant-developer-mark">
            {session.branding?.developerLogo === null || session.branding === undefined ? null : <img className="participant-developer-logo"
              src={session.branding.developerLogo.url} alt="" decoding="async" />}
            <span>{session.branding?.developer ?? "Simulation developer"}</span>
          </div>
          <div className="participant-simulation-identity"><h3 id={titleId}>{title}</h3>
            {session.branding?.subtitle === null || session.branding === undefined ? null
              : <p className="participant-simulation-subtitle">{session.branding.subtitle}</p>}
          </div>
        </div>
        <div className="participant-session-entry">
          <span className="badge badge-state">{displayStatus(session.status)}</span>
          <div><h4>{session.roleContexts.length > 0 ? "Enter your workspace" : "Choose your seat"}</h4>
            <p>{session.entryState === "ready" ? "Your role workspace is ready."
              : "Complete the available access step to enter this simulation."}</p></div>
          <dl className="participant-session-facts">
            <div><dt>Signed in as</dt><dd>{displayName}</dd></div>
            <div><dt>Session</dt><dd>{session.title}</dd></div>
            <div><dt>Release</dt><dd>{session.releaseLabel}</dd></div>
            <div><dt>Access</dt><dd>{displayStatus(session.entryState)}</dd></div>
          </dl>
          {session.entryState === "invited" && session.invitationId !== null ? <div className="participant-primary-step">
            <p>This organization invited you to join. Accepting confirms access without revealing role-scoped content.</p>
            <button className="btn-primary" type="button" disabled={pending}
              onClick={() => void submit(session, `/v1/participant-entry/invitations/${session.invitationId}/accept`,
                "join_request.submit", crypto.randomUUID(), {})}>Accept invitation</button>
          </div> : null}
          {session.entryState === "waiting_room" ? <p className="status-notice">Waiting for an Operator to admit you. Refresh after admission.</p> : null}
          {session.entryState === "assignment_pending" && session.eligibleSeats.length === 0
            ? <p className="status-notice">Access is confirmed. An Operator must assign your seat before you can enter.</p> : null}
          {session.eligibleSeats.length === 0 ? null : <fieldset disabled={pending}>
            <legend>Available team and role</legend>
            <div className="seat-choice-list">{session.eligibleSeats.map((seat) => <button className="btn-secondary" type="button"
              key={`${seat.seatId}:${seat.sessionRoleId}`}
              onClick={() => void submit(session, `/v1/sessions/${session.sessionId}/seats/${encodeURIComponent(seat.seatId)}/claim`,
                "seat.claim", crypto.randomUUID(), { seatId: seat.seatId, sessionRoleId: seat.sessionRoleId })}>
              <span>{seat.teamLabel ?? seat.seatLabel}</span><small>{seat.sessionRoleLabel}</small>
            </button>)}</div>
          </fieldset>}
          {session.roleContexts.length === 0 ? null : <div className="role-entry-list">
            <h4>Enter as</h4>
            {session.roleContexts.map((role) => <a className="btn-primary link-button" href={role.runtimeUrl}
              key={`${role.seatLabel}:${role.sessionRoleId}`}>
              {role.teamLabel === null ? role.sessionRoleLabel : `${role.teamLabel} ${role.sessionRoleLabel}`}
            </a>)}
          </div>}
        </div>
      </article>;
    })}</div>
    {entry === null || entry.sessions.length === 0 ? null : <button className="btn-secondary" type="button" disabled={pending} onClick={() => void load()}>Refresh Sessions</button>}
  </section>;
}
