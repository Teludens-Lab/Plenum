import { useCallback, useEffect, useState } from "react";
import type { CommandEnvelopeV1, CommandReceiptV1, ParticipantEntryV1, ParticipantSessionEntryV1 } from "@plenum/event-contracts";

const DEVICE_STORAGE_KEY = "plenum.runtime.deviceId";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json() as T | { error?: { message?: string } };
  if (!response.ok) {
    const failure = typeof body === "object" && body !== null ? body as { error?: { message?: string } } : {};
    throw new Error(failure.error?.message ?? "The request failed.");
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

export function ParticipantPortal() {
  const [entry, setEntry] = useState<ParticipantEntryV1 | null>(null);
  const [message, setMessage] = useState("Loading your authorized Sessions.");
  const [pending, setPending] = useState(false);

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

  return <section className="participant-portal" aria-labelledby="participant-sessions-title" aria-busy={entry === null && message.startsWith("Loading")}>
    <div className="section-heading"><p className="eyebrow">Participant entry</p><h2 id="participant-sessions-title">Your Sessions</h2></div>
    <p className="live-region" role="status" aria-live="polite">{message}</p>
    {entry !== null && entry.sessions.length === 0 ? <div className="card empty-state">
      No Session invitations or active Seat Assignments are available for this account.
    </div> : null}
    <div className="card-grid">{entry?.sessions.map((session) => <article className="card participant-session" key={session.sessionId}>
      <div className="card-heading"><h3>{session.title}</h3><span className="badge badge-state">{session.status}</span></div>
      <p>{session.releaseLabel}</p>
      {session.entryState === "invited" && session.invitationId !== null ? <>
        <p>This Organization invited you to join. Accepting does not select a Seat or reveal role-scoped content.</p>
        <button className="btn-primary" type="button" disabled={pending}
          onClick={() => void submit(session, `/v1/participant-entry/invitations/${session.invitationId}/accept`,
            "join_request.submit", crypto.randomUUID(), {})}>Accept invitation</button>
      </> : null}
      {session.entryState === "waiting_room" ? <p className="status-notice">Waiting for an Operator to admit you. Refresh this page after admission.</p> : null}
      {session.entryState === "assignment_pending" && session.eligibleSeats.length === 0
        ? <p className="status-notice">Your access is confirmed. A policy-authorized Seat Assignment is still required.</p> : null}
      {session.eligibleSeats.length === 0 ? null : <fieldset disabled={pending}>
        <legend>Choose an eligible Seat</legend>
        <div className="seat-choice-list">{session.eligibleSeats.map((seat) => <button className="btn-secondary" type="button"
          key={`${seat.seatId}:${seat.sessionRoleId}`}
          onClick={() => void submit(session, `/v1/sessions/${session.sessionId}/seats/${encodeURIComponent(seat.seatId)}/claim`,
            "seat.claim", crypto.randomUUID(), { seatId: seat.seatId, sessionRoleId: seat.sessionRoleId })}>
          {seat.teamLabel === null ? seat.seatLabel : `${seat.teamLabel} — ${seat.seatLabel}`} ({seat.sessionRoleLabel})
        </button>)}</div>
      </fieldset>}
      {session.roleContexts.length === 0 ? null : <div className="role-entry-list">
        <h4>Enter as</h4>
        {session.roleContexts.map((role) => <a className="btn-primary link-button" href={role.runtimeUrl}
          key={`${role.seatLabel}:${role.sessionRoleId}`}>
          {role.teamLabel === null ? role.sessionRoleLabel : `${role.teamLabel} ${role.sessionRoleLabel}`}
        </a>)}
      </div>}
    </article>)}</div>
    {entry === null || entry.sessions.length === 0 ? null : <button className="btn-secondary" type="button" disabled={pending} onClick={() => void load()}>Refresh Sessions</button>}
  </section>;
}
