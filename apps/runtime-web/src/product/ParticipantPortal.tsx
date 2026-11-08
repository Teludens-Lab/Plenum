import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import type {
  CommandEnvelopeV1, CommandReceiptV1, ParticipantEntryV1, ParticipantSeatChoiceV1, ParticipantSessionEntryV1
} from "@plenum/event-contracts";
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

const teamOf = (seat: ParticipantSeatChoiceV1): string => seat.teamLabel ?? seat.seatLabel;

/** Team and role segments built only from the Seats the Session Authority offers this person. */
function SeatChoice({ session, pending, claim }: {
  session: ParticipantSessionEntryV1; pending: boolean; claim(seat: ParticipantSeatChoiceV1): void;
}) {
  const id = useId();
  const teams = useMemo(() => [...new Set(session.eligibleSeats.map(teamOf))], [session.eligibleSeats]);
  const [team, setTeam] = useState(teams[0] ?? "");
  const activeTeam = teams.includes(team) ? team : teams[0] ?? "";
  const roles = session.eligibleSeats.filter((seat) => teamOf(seat) === activeTeam);
  const [roleKey, setRoleKey] = useState("");
  const selected = roles.find((seat) => `${seat.seatId}:${seat.sessionRoleId}` === roleKey) ?? roles[0];
  return <fieldset className="participant-seat-choice" disabled={pending}>
    <legend>Available team and role</legend>
    {teams.length > 1 ? <div className="participant-segment-field">
      <span className="participant-segment-label" id={`${id}-team`}>Team</span>
      <div className="participant-segments" role="radiogroup" aria-labelledby={`${id}-team`}>
        {teams.map((label) => <label key={label} className="participant-segment">
          <input type="radio" name={`${id}-team`} value={label} checked={label === activeTeam}
            onChange={() => { setTeam(label); setRoleKey(""); }} />
          <span>{label}</span>
        </label>)}
      </div>
    </div> : <p className="participant-single-choice"><span>Team</span><strong>{activeTeam}</strong></p>}
    {roles.length > 1 ? <div className="participant-segment-field">
      <span className="participant-segment-label" id={`${id}-role`}>Role</span>
      <div className="participant-segments" role="radiogroup" aria-labelledby={`${id}-role`}>
        {roles.map((seat) => {
          const key = `${seat.seatId}:${seat.sessionRoleId}`;
          return <label key={key} className="participant-segment">
            <input type="radio" name={`${id}-role`} value={key} checked={seat === selected} onChange={() => setRoleKey(key)} />
            <span>{seat.sessionRoleLabel}</span>
          </label>;
        })}
      </div>
    </div> : selected === undefined ? null
      : <p className="participant-single-choice"><span>Role</span><strong>{selected.sessionRoleLabel}</strong></p>}
    <button className="btn-primary participant-join-action" type="button" disabled={selected === undefined}
      onClick={() => { if (selected !== undefined) claim(selected); }}>
      {selected === undefined ? "Join session" : `Join as ${selected.sessionRoleLabel}`}
    </button>
  </fieldset>;
}

function SessionVisual({ session }: { session: ParticipantSessionEntryV1 | undefined }) {
  if (session === undefined) return <div className="participant-entry-visual participant-entry-visual-empty">
    <img className="participant-entry-chamber" src="/branding/plenum-chamber.webp" alt="" width="1240" height="740" />
  </div>;
  const title = session.branding?.title ?? session.title;
  const image = session.branding?.simulationImage ?? null;
  return <div className={`participant-entry-visual participant-session-visual${image === null ? " participant-session-visual-fallback" : " has-artwork"}`}>
    {image === null ? null : <img className="participant-simulation-image" src={image.url} alt={image.altText} decoding="async" />}
    <div className="participant-developer-mark">
      {session.branding?.developerLogo === null || session.branding === undefined ? null : <img className="participant-developer-logo"
        src={session.branding.developerLogo.url} alt="" decoding="async" />}
      <span>{session.branding?.developer ?? "Simulation developer"}</span>
    </div>
    <div className="participant-simulation-identity"><h2>{title}</h2>
      {session.branding?.subtitle === null || session.branding === undefined ? null
        : <p className="participant-simulation-subtitle">{session.branding.subtitle}</p>}
    </div>
  </div>;
}

export function ParticipantPortal({ displayName }: { displayName: string }) {
  const [entry, setEntry] = useState<ParticipantEntryV1 | null>(null);
  const [message, setMessage] = useState("Loading your authorized Sessions.");
  const [pending, setPending] = useState(false);
  const [sessionCode, setSessionCode] = useState("");
  const [foundCode, setFoundCode] = useState<string | null>(null);
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);

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

  const sessions = entry?.sessions ?? [];
  const focused = sessions.find((session) => session.sessionId === focusedSessionId) ?? sessions[0];

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
      setFoundCode(null);
      setMessage("Enter the complete Session code. It contains at least 6 characters.");
      return;
    }
    setPending(true);
    setFoundCode(null);
    setMessage("Finding your Session and confirming access.");
    try {
      const receipt = await json<CommandReceiptV1>("/v1/participant-entry/join-requests", {
        method: "POST",
        body: JSON.stringify({ requestId: crypto.randomUUID(), deviceId: await device(), sessionCode: code })
      });
      if (receipt.status !== "accepted") throw new Error(receipt.message ?? "The Session could not be joined.");
      setFoundCode(code);
      setMessage("Session found. Choose your team and role to continue.");
      const before = new Set(sessions.map((session) => session.sessionId));
      const next = await json<ParticipantEntryV1>("/v1/participant-entry");
      setEntry(next);
      const joined = next.sessions.find((session) => !before.has(session.sessionId));
      if (joined !== undefined) setFocusedSessionId(joined.sessionId);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The Session could not be joined.");
    } finally {
      setPending(false);
    }
  };

  return <section className="participant-portal" aria-labelledby="participant-sessions-title" aria-busy={entry === null && message.startsWith("Loading")}>
    <SessionVisual session={focused} />
    <div className="participant-entry-panel">
      <div className="participant-entry-intro">
        <h2 id="participant-sessions-title">Join a session</h2>
        <p>Enter your code and choose your seat.</p>
      </div>
      <form className="participant-join-form" onSubmit={(event) => void joinByCode(event)}>
        <label htmlFor="participant-session-code">Session code</label>
        <div>
          <input id="participant-session-code" value={sessionCode} minLength={6} maxLength={100} required
            autoCapitalize="characters" autoComplete="one-time-code" spellCheck={false} disabled={pending}
            onChange={(event) => { setSessionCode(event.target.value); setFoundCode(null); }} placeholder="Enter your code" />
          {foundCode !== null && foundCode === sessionCode.trim()
            ? <span className="participant-code-found" role="status"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 12.5 4 4 8-9" /></svg>Found</span>
            : <button className="btn-secondary" type="submit" disabled={pending}>{pending ? "Checking…" : "Find session"}</button>}
        </div>
        <p className="participant-identity">Display name <strong>{displayName}</strong><span>Your verified Plenum account is your identity in the Session.</span></p>
      </form>
      <p className="live-region participant-entry-notice" role="status" aria-live="polite">{message}</p>
      {entry === null ? <PlenumLoader label="Loading your authorized Sessions" /> : null}
      {entry !== null && sessions.length === 0 ? <div className="participant-entry-empty">
        <h3>No sessions are linked yet</h3><p>Enter a Session code above, or return when your simulation team sends an invitation.</p>
      </div> : null}
      {sessions.length > 1 ? <nav className="participant-session-switcher" aria-label="Your Sessions">
        <h3>Your sessions</h3>
        <ul>{sessions.map((session) => <li key={session.sessionId}>
          <button type="button" aria-current={session === focused ? "true" : undefined} onClick={() => setFocusedSessionId(session.sessionId)}>
            <span>{session.branding?.title ?? session.title}</span><small>{session.title} · {displayStatus(session.entryState)}</small>
          </button>
        </li>)}</ul>
      </nav> : null}
      {focused === undefined ? null : <article className="participant-session participant-session-entry" aria-label={focused.title}>
        <div className="participant-session-heading">
          <div><h3>{focused.roleContexts.length > 0 ? "Enter your workspace" : "Choose your seat"}</h3>
            <p>{focused.title} · {focused.releaseLabel}</p></div>
          <span className="badge badge-state">{displayStatus(focused.status)}</span>
        </div>
        {focused.entryState === "invited" && focused.invitationId !== null ? <div className="participant-primary-step">
          <p>This organization invited you to join. Accepting confirms access without revealing role-scoped content.</p>
          <button className="btn-primary" type="button" disabled={pending}
            onClick={() => void submit(focused, `/v1/participant-entry/invitations/${focused.invitationId}/accept`,
              "join_request.submit", crypto.randomUUID(), {})}>Accept invitation</button>
        </div> : null}
        {focused.entryState === "waiting_room" ? <p className="status-notice">Waiting for an Operator to admit you. Refresh after admission.</p> : null}
        {focused.entryState === "assignment_pending" && focused.eligibleSeats.length === 0
          ? <p className="status-notice">Access is confirmed. An Operator must assign your seat before you can enter.</p> : null}
        {focused.eligibleSeats.length === 0 ? null : <SeatChoice key={focused.sessionId} session={focused} pending={pending}
          claim={(seat) => void submit(focused, `/v1/sessions/${focused.sessionId}/seats/${encodeURIComponent(seat.seatId)}/claim`,
            "seat.claim", crypto.randomUUID(), { seatId: seat.seatId, sessionRoleId: seat.sessionRoleId })} />}
        {focused.roleContexts.length === 0 ? null : <div className="role-entry-list">
          <h4>Enter as</h4>
          {focused.roleContexts.map((role) => <a className="btn-primary link-button" href={role.runtimeUrl}
            key={`${role.seatLabel}:${role.sessionRoleId}`}>
            {role.teamLabel === null ? role.sessionRoleLabel : `${role.teamLabel} ${role.sessionRoleLabel}`}
          </a>)}
        </div>}
      </article>}
      {entry === null || sessions.length === 0 ? null
        : <button className="participant-refresh" type="button" disabled={pending} onClick={() => void load()}>Refresh Sessions</button>}
    </div>
  </section>;
}
