import { formatDate, displayStatus } from "../../../../packages/design-system/src/presentation.mjs";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  PlatformAdministratorChangeTypeV1,
  PlatformAdministratorMutationV1,
  PlatformAdministratorWorkforceV1
} from "@plenum/event-contracts";

import { PlenumLoader } from "../PlenumLoader.js";
import { PlatformControlNavigation } from "./PlatformControlNavigation.js";
import { StatusBadge, humanize, platformRequest } from "./PlatformOrganizationsPortal.js";



function StepUpGate({ workforce }: { workforce: PlatformAdministratorWorkforceV1 }) {
  if (workforce.stepUp.satisfied) {
    return <p className="platform-step-up is-current" role="status">
      Multifactor verification is current until {formatDate(workforce.stepUp.expiresAt)}.
    </p>;
  }
  return <section className="platform-step-up" aria-labelledby="platform-step-up-title">
    <div><h2 id="platform-step-up-title">Verify before changing platform authority</h2>
      <p>Invitation, approval, suspension, recovery, and revocation require a fresh multifactor sign-in.</p></div>
    <a className="btn-primary link-button" href="/auth/login?stepUp=1&amp;returnTo=%2Fplatform%2Fadministrators">Verify with MFA</a>
  </section>;
}

function InviteAdministrator({ disabled, onSubmitted, onError }: {
  disabled: boolean;
  onSubmitted(next: PlatformAdministratorWorkforceV1, message: string): void;
  onError(cause: unknown): void;
}) {
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    try {
      const next = await platformRequest<PlatformAdministratorWorkforceV1>("/v1/platform/administrators/changes", {
        method: "POST",
        body: JSON.stringify({
          changeType: "invite",
          displayName: String(data.get("displayName")),
          email: String(data.get("email")),
          reason: String(data.get("reason"))
        })
      });
      form.reset();
      onSubmitted(next, "Invitation requested. A different Platform Administrator must approve it within 24 hours.");
    } catch (cause) {
      onError(cause);
    } finally {
      setPending(false);
    }
  };
  return <form className="platform-workforce-form" onSubmit={(event) => void submit(event)}>
    <div className="platform-form-grid"><div className="field"><label htmlFor="platform-workforce-name">Display name</label>
      <input id="platform-workforce-name" name="displayName" autoComplete="name" required minLength={2} maxLength={200} disabled={disabled || pending} /></div>
      <div className="field"><label htmlFor="platform-workforce-email">Verified work email</label>
        <input id="platform-workforce-email" name="email" type="email" autoComplete="email" required maxLength={320} disabled={disabled || pending} /></div></div>
    <div className="field"><label htmlFor="platform-workforce-reason">Operational reason</label>
      <textarea id="platform-workforce-reason" name="reason" required minLength={3} maxLength={1000} rows={3} disabled={disabled || pending}
        aria-describedby={disabled ? "platform-workforce-step-up-prerequisite" : "platform-workforce-invite-hint"} />
      <p id="platform-workforce-invite-hint" className="field-hint">Approval sends a seven-day invitation. The invited identity must return the exact verified email address.</p></div>
    {disabled ? <p id="platform-workforce-step-up-prerequisite" className="field-hint">Verify with MFA before requesting an invitation.</p> : null}
    <button className="btn-primary" type="submit" disabled={disabled || pending}>{pending ? "Requesting…" : "Request invitation"}</button>
  </form>;
}

function AdministratorRows({ workforce, onSubmitted, onError }: {
  workforce: PlatformAdministratorWorkforceV1;
  onSubmitted(next: PlatformAdministratorWorkforceV1, message: string): void;
  onError(cause: unknown): void;
}) {
  const activeCount = workforce.administrators.filter(({ status }) => status === "active").length;
  const [pendingPersonId, setPendingPersonId] = useState<string | null>(null);
  const submit = async (administrator: PlatformAdministratorWorkforceV1["administrators"][number], event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const changeType = String(data.get("changeType")) as PlatformAdministratorChangeTypeV1;
    setPendingPersonId(administrator.personId);
    try {
      const next = await platformRequest<PlatformAdministratorWorkforceV1>("/v1/platform/administrators/changes", {
        method: "POST",
        body: JSON.stringify({ changeType, targetPersonId: administrator.personId, reason: String(data.get("reason")) })
      });
      form.reset();
      onSubmitted(next, `${humanize(changeType)} requested for ${administrator.displayName}. A different Platform Administrator must decide it.`);
    } catch (cause) { onError(cause); }
    finally { setPendingPersonId(null); }
  };
  return <ul className="platform-workforce-list">
    {workforce.administrators.map((administrator) => {
      const isFinalActive = administrator.status === "active" && activeCount === 1;
      const unavailable = !workforce.stepUp.satisfied || isFinalActive || administrator.status === "revoked" || pendingPersonId !== null;
      return <li key={administrator.personId} className="platform-workforce-row">
        <div className="platform-workforce-identity"><div><strong>{administrator.displayName}</strong><StatusBadge status={administrator.status} /></div>
          <span>{administrator.homeOrganization.name}</span></div>
        <dl className="platform-workforce-facts"><div><dt>Active sessions</dt><dd>{administrator.activeSessionCount}</dd></div>
          <div><dt>Last authenticated</dt><dd>{formatDate(administrator.lastAuthenticatedAt)}</dd></div>
          <div><dt>Authority assigned</dt><dd>{formatDate(administrator.assignedAt)}</dd></div></dl>
        {administrator.status === "revoked" ? <p className="platform-row-prerequisite">Revoked authority cannot be restored. Issue a new governed invitation.</p> :
          isFinalActive ? <p className="platform-row-prerequisite">Add and activate another Platform Administrator first. The final active administrator cannot be removed.</p> :
          <details className="platform-authority-disclosure"><summary>Change authority</summary>
            <form onSubmit={(event) => void submit(administrator, event)}>
              <div className="field"><label htmlFor={`platform-change-${administrator.personId}`}>Change</label>
                <select id={`platform-change-${administrator.personId}`} name="changeType" disabled={unavailable}>
                  {administrator.status === "suspended" ? <option value="recover">Recover authority</option> : <>
                    <option value="suspend">Suspend authority</option><option value="revoke">Revoke authority</option></>}
                </select></div>
              <div className="field"><label htmlFor={`platform-change-reason-${administrator.personId}`}>Reason</label>
                <input id={`platform-change-reason-${administrator.personId}`} name="reason" required minLength={3} maxLength={1000} disabled={unavailable}
                  aria-describedby={unavailable ? `platform-change-prerequisite-${administrator.personId}` : undefined} /></div>
              <button className="btn-primary" type="submit" disabled={unavailable}>{pendingPersonId === administrator.personId ? "Requesting…" : "Request change"}</button>
              {!workforce.stepUp.satisfied ? <p id={`platform-change-prerequisite-${administrator.personId}`} className="field-hint">Verify with MFA before requesting an authority change.</p> : null}
            </form>
          </details>}
      </li>;
    })}
  </ul>;
}

function ApprovalQueue({ workforce, onSubmitted, onError }: {
  workforce: PlatformAdministratorWorkforceV1;
  onSubmitted(next: PlatformAdministratorWorkforceV1, message: string, invitationUrl?: string): void;
  onError(cause: unknown): void;
}) {
  const pendingRequests = workforce.changeRequests.filter(({ status }) => status === "pending");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const decide = async (requestId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const decision = String(data.get("decision"));
    setPendingRequestId(requestId);
    try {
      const result = await platformRequest<PlatformAdministratorMutationV1>(`/v1/platform/administrators/changes/${requestId}/${decision}`, {
        method: "POST", body: JSON.stringify({ reason: String(data.get("reason")) })
      });
      onSubmitted(result.workforce, decision === "approve" ? "Authority change approved and applied." : "Authority change rejected.", result.invitationUrl);
    } catch (cause) { onError(cause); }
    finally { setPendingRequestId(null); }
  };
  if (pendingRequests.length === 0) return <p className="empty-state">No authority change awaits approval.</p>;
  return <ol className="platform-approval-list">
    {pendingRequests.map((request) => {
      const ownRequest = request.requestedBy.personId === workforce.currentPersonId;
      const disabled = ownRequest || !workforce.stepUp.satisfied || pendingRequestId !== null;
      return <li key={request.id}><div className="platform-approval-summary"><div><strong>{humanize(request.changeType)} {request.target.displayName}</strong>
        <span>Requested by {request.requestedBy.displayName} · expires {formatDate(request.expiresAt)}</span></div><StatusBadge status={request.status} /></div>
        <p>{request.reason}</p>
        {ownRequest ? <p className="platform-row-prerequisite">A different Platform Administrator must decide this request. Requesters cannot approve their own privilege changes.</p> :
          <form className="platform-decision-form" onSubmit={(event) => void decide(request.id, event)}>
            <div className="field"><label htmlFor={`platform-decision-${request.id}`}>Decision</label><select id={`platform-decision-${request.id}`} name="decision" disabled={disabled}>
              <option value="approve">Approve and apply</option><option value="reject">Reject request</option></select></div>
            <div className="field"><label htmlFor={`platform-decision-reason-${request.id}`}>Decision reason</label>
              <input id={`platform-decision-reason-${request.id}`} name="reason" required minLength={3} maxLength={1000} disabled={disabled} /></div>
            <button className="btn-primary" type="submit" disabled={disabled}>{pendingRequestId === request.id ? "Recording…" : "Record decision"}</button>
          </form>}
      </li>;
    })}
  </ol>;
}

function RecentChanges({ workforce }: { workforce: PlatformAdministratorWorkforceV1 }) {
  const completed = workforce.changeRequests.filter(({ status }) => status !== "pending");
  if (completed.length === 0) return <p className="empty-state">No completed workforce change is recorded.</p>;
  return <ol className="platform-change-history">{completed.map((request) => <li key={request.id}>
    <div><strong>{humanize(request.changeType)} {request.target.displayName}</strong>
      <span>{request.decidedBy === null ? humanize(request.status) : `${humanize(request.status)} by ${request.decidedBy.displayName}`}</span>
      {request.invitation === null ? null : <span>Invitation {request.invitation.identityLinkedAt === null ? humanize(request.invitation.deliveryStatus) : "identity linked"}</span>}</div>
    <time dateTime={request.decidedAt ?? request.requestedAt}>{formatDate(request.decidedAt ?? request.requestedAt)}</time>
  </li>)}</ol>;
}

export function PlatformAdministratorsPortal() {
  const [workforce, setWorkforce] = useState<PlatformAdministratorWorkforceV1 | null>(null);
  const [notice, setNotice] = useState<{ message: string; alert: boolean }>({ message: "", alert: false });
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const load = useCallback(async () => setWorkforce(await platformRequest<PlatformAdministratorWorkforceV1>("/v1/platform/administrators")), []);
  useEffect(() => { void load().catch((cause: unknown) => setNotice({ message: cause instanceof Error ? cause.message : "Platform administrators did not load.", alert: true })); }, [load]);
  const update = useCallback((next: PlatformAdministratorWorkforceV1, message: string, nextInvitationUrl?: string) => {
    setWorkforce(next); setNotice({ message, alert: false }); setInvitationUrl(nextInvitationUrl ?? null);
  }, []);
  const captureError = useCallback((cause: unknown) => setNotice({ message: cause instanceof Error ? cause.message : "The platform authority change failed.", alert: true }), []);
  const guardedUpdate = useMemo(() => (next: PlatformAdministratorWorkforceV1, message: string, url?: string) => {
    try { update(next, message, url); } catch (cause) { captureError(cause); }
  }, [captureError, update]);
  if (workforce === null) return <section className="portal-workspace platform-control-plane"><PlatformControlNavigation current="administrators" />
    {notice.message.length === 0 ? null : <p className="live-region portal-notice" role={notice.alert ? "alert" : "status"} aria-live="polite">{notice.message}</p>}<PlenumLoader label="Loading Platform Administrators" /></section>;
  return <section className="portal-workspace platform-control-plane platform-workforce" aria-labelledby="platform-administrators-title">
    <PlatformControlNavigation current="administrators" />
    <div className="workspace-heading"><div><h1 id="platform-administrators-title">Platform administrators</h1>
      <p>Govern the small workforce that can provision and suspend Organizations.</p></div></div>
    {notice.message.length === 0 ? null : <p className="live-region portal-notice" role={notice.alert ? "alert" : "status"} aria-live="polite">{notice.message}</p>}
    <StepUpGate workforce={workforce} />
    {invitationUrl === null ? null : <div className="platform-invitation-result" role="status"><label htmlFor="platform-workforce-invitation-url">Delivered invitation preview</label>
      <div><input id="platform-workforce-invitation-url" readOnly value={invitationUrl} /><button className="btn-secondary" type="button" onClick={() => void navigator.clipboard.writeText(invitationUrl)}>Copy link</button></div></div>}
    <section className="platform-workforce-section" aria-labelledby="platform-invite-title"><div className="section-heading"><h2 id="platform-invite-title">Invite an administrator</h2>
      <p>A distinct administrator must approve before delivery.</p></div>
      <InviteAdministrator disabled={!workforce.stepUp.satisfied} onSubmitted={guardedUpdate} onError={captureError} /></section>
    <section className="platform-workforce-section" aria-labelledby="platform-roster-title"><div className="section-heading"><h2 id="platform-roster-title">Current workforce</h2>
      <p>{workforce.administrators.filter(({ status }) => status === "active").length} active · {workforce.administrators.length} recorded</p></div>
      <AdministratorRows workforce={workforce} onSubmitted={guardedUpdate} onError={captureError} /></section>
    <section className="platform-workforce-section" aria-labelledby="platform-approval-title"><div className="section-heading"><h2 id="platform-approval-title">Approval queue</h2>
      <p>Every privilege change requires a second accountable decision.</p></div>
      <ApprovalQueue workforce={workforce} onSubmitted={guardedUpdate} onError={captureError} /></section>
    <section className="platform-workforce-section" aria-labelledby="platform-change-history-title"><div className="section-heading"><h2 id="platform-change-history-title">Recent decisions</h2>
      <p>Immutable audit evidence is retained separately from this operational summary.</p></div><RecentChanges workforce={workforce} /></section>
  </section>;
}
