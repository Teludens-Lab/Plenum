import { useCallback, useEffect, useState, type FormEvent } from "react";

import type {
  ErrorEnvelopeV1,
  PlatformOrganizationDetailV1,
  PlatformOrganizationsV1
} from "@plenum/event-contracts";

import { PlenumLoader } from "../PlenumLoader.js";
import { PlatformControlNavigation } from "./PlatformControlNavigation.js";

class PlatformRequestError extends Error {}

export async function platformRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json() as T | ErrorEnvelopeV1;
  if (!response.ok) throw new PlatformRequestError("error" in (body as ErrorEnvelopeV1)
    ? (body as ErrorEnvelopeV1).error.message : "The platform request failed.");
  return body as T;
}

export function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge platform-status platform-status-${status}`}>{humanize(status)}</span>;
}

function ProvisionOrganizationForm({ onCreated, setNotice }: {
  onCreated(detail: PlatformOrganizationDetailV1): void;
  setNotice(message: string, alert?: boolean): void;
}) {
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    try {
      const detail = await platformRequest<PlatformOrganizationDetailV1>("/v1/platform/organizations", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name")), slug: String(data.get("slug")), legalName: String(data.get("legalName")),
          countryCode: String(data.get("countryCode")), timeZone: String(data.get("timeZone")),
          deploymentProfile: String(data.get("deploymentProfile")), dataResidencyRegion: String(data.get("dataResidencyRegion")),
          entitlements: String(data.get("entitlements")).split(",").map((value) => value.trim()).filter(Boolean),
          supportContact: String(data.get("supportContact")), securityContact: String(data.get("securityContact"))
        })
      });
      form.reset();
      onCreated(detail);
      setNotice(`${detail.organization.name} is pending. Verify its domain and invite the first Admin next.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The Organization was not provisioned.", true);
    } finally {
      setPending(false);
    }
  };
  return <details className="platform-create-disclosure">
    <summary className="btn-primary">Provision Organization</summary>
    <form className="platform-provision-form" onSubmit={(event) => void submit(event)}>
      <div className="field"><label htmlFor="platform-organization-name">Organization name</label>
        <input id="platform-organization-name" name="name" required minLength={2} maxLength={200} autoComplete="organization" /></div>
      <div className="field"><label htmlFor="platform-legal-name">Legal name</label>
        <input id="platform-legal-name" name="legalName" required minLength={2} maxLength={300} /></div>
      <div className="field"><label htmlFor="platform-slug">Workspace address</label>
        <div className="field-prefix"><span aria-hidden="true">plenum/</span><input id="platform-slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} /></div>
        <p className="field-hint">Lowercase letters, numbers, and hyphens.</p></div>
      <div className="platform-form-grid">
        <div className="field"><label htmlFor="platform-country">Country code</label>
          <input id="platform-country" name="countryCode" required pattern="[A-Za-z]{2}" maxLength={2} defaultValue="ZA" /></div>
        <div className="field"><label htmlFor="platform-time-zone">Time zone</label>
          <input id="platform-time-zone" name="timeZone" required defaultValue="Africa/Johannesburg" /></div>
        <div className="field"><label htmlFor="platform-profile">Deployment profile</label>
          <select id="platform-profile" name="deploymentProfile" defaultValue="cloud">
            <option value="cloud">Plenum cloud</option><option value="self_hosted">Self-hosted</option><option value="air_gapped">Air-gapped</option>
          </select></div>
        <div className="field"><label htmlFor="platform-region">Data residency region</label>
          <input id="platform-region" name="dataResidencyRegion" required defaultValue="af-south" /></div>
      </div>
      <div className="field"><label htmlFor="platform-entitlements">Enabled capabilities</label>
        <input id="platform-entitlements" name="entitlements" required defaultValue="studio_authoring, session_delivery" />
        <p className="field-hint">Comma-separated contracted capability keys.</p></div>
      <div className="platform-form-grid">
        <div className="field"><label htmlFor="platform-support-contact">Support contact</label>
          <input id="platform-support-contact" name="supportContact" type="email" required autoComplete="email" /></div>
        <div className="field"><label htmlFor="platform-security-contact">Security contact <span className="optional">Optional</span></label>
          <input id="platform-security-contact" name="securityContact" type="email" autoComplete="email" /></div>
      </div>
      <div className="actions"><button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Provisioning…" : "Create pending Organization"}</button>
        <button className="btn-secondary" type="button" onClick={(event) => (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open")}>Cancel</button></div>
    </form>
  </details>;
}

function OrganizationCatalog({ model }: { model: PlatformOrganizationsV1 }) {
  if (model.organizations.length === 0) {
    return <p className="empty-state">No Organizations are provisioned yet. Create the first pending Organization to begin.</p>;
  }
  return <ul className="catalog-list platform-organization-list">
    {model.organizations.map((organization) => {
      const complete = organization.gates.filter((gate) => gate.complete).length;
      return <li className="catalog-row" key={organization.id}>
        <div><div className="card-heading"><h2><a href={`/platform/organizations/${organization.id}`}>{organization.name}</a></h2>
          <StatusBadge status={organization.lifecycleStatus} /></div>
          <dl className="catalog-facts"><div><dt>Deployment</dt><dd>{humanize(organization.deploymentProfile)}</dd></div>
            <div><dt>Residency</dt><dd>{organization.dataResidencyRegion}</dd></div>
            <div><dt>Activation readiness</dt><dd>{complete} of {organization.gates.length} complete</dd></div>
            <div><dt>First Admin</dt><dd>{humanize(organization.firstAdminStatus)}</dd></div></dl></div>
        <div className="catalog-row-actions"><a className="btn-secondary link-button" href={`/platform/organizations/${organization.id}`}>Open provisioning</a></div>
      </li>;
    })}
  </ul>;
}

function OrganizationDetail({ detail, onChange, setNotice }: {
  detail: PlatformOrganizationDetailV1;
  onChange(next: PlatformOrganizationDetailV1): void;
  setNotice(message: string, alert?: boolean): void;
}) {
  const [pending, setPending] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [providerProtocol, setProviderProtocol] = useState<"oidc" | "saml">("oidc");
  const organization = detail.organization;
  const mutate = async (path: string, body: object, success: string) => {
    setPending(true);
    try {
      const next = await platformRequest<PlatformOrganizationDetailV1>(path, { method: "POST", body: JSON.stringify(body) });
      onChange(next); setNotice(success);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The platform action failed.", true);
    } finally { setPending(false); }
  };
  const addDomain = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void mutate(`/v1/platform/organizations/${organization.id}/domains`,
      { domain: String(data.get("domain")), verificationMethod: "dns_txt" },
      "DNS challenge created. Publish the exact TXT record, then check it from Plenum.");
  };
  const inviteAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true);
    try {
      const response = await platformRequest<{ organization: PlatformOrganizationDetailV1; invitationUrl?: string }>(
        `/v1/platform/organizations/${organization.id}/first-admin-invitations`,
        { method: "POST", body: JSON.stringify({ email: String(data.get("email")) }) });
      onChange(response.organization); setInvitationUrl(response.invitationUrl ?? null);
      setNotice(response.organization.firstAdminInvitation?.delivery?.status === "sent"
        ? "First Admin invitation delivered."
        : "The invitation is valid, but delivery failed. Check the provider and reissue it.",
      response.organization.firstAdminInvitation?.delivery?.status === "failed");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The invitation was not created.", true); }
    finally { setPending(false); }
  };
  const transition = (action: "activate" | "suspend" | "offboard", event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void mutate(`/v1/platform/organizations/${organization.id}/${action}`,
      { expectedVersion: organization.lifecycleVersion, reason: String(data.get("reason")) },
      action === "activate" ? "Organization activated. Its Admin can now govern Organization access."
        : action === "suspend" ? "Organization suspended. Active authentication and projection access were revoked."
          : "Organization offboarded. Records remain preserved and access is revoked.");
  };
  const incomplete = organization.gates.filter((gate) => !gate.complete);
  const updateProvisioning = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true);
    try {
      const next = await platformRequest<PlatformOrganizationDetailV1>(`/v1/platform/organizations/${organization.id}/provisioning`, {
        method: "PUT",
        body: JSON.stringify({
          legalName: String(data.get("legalName")), countryCode: String(data.get("countryCode")),
          timeZone: String(data.get("timeZone")), deploymentProfile: String(data.get("deploymentProfile")),
          dataResidencyRegion: String(data.get("dataResidencyRegion")),
          entitlements: String(data.get("entitlements")).split(",").map((value) => value.trim()).filter(Boolean),
          supportContact: String(data.get("supportContact")), securityContact: String(data.get("securityContact"))
        })
      });
      onChange(next); setNotice("Provisioning profile reconciled. Continue with domain verification.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The provisioning profile was not updated.", true); }
    finally { setPending(false); }
  };
  const updateProviders = async (path: string, body: object, success: string) => {
    setPending(true);
    try {
      const response = await platformRequest<{ identityProviders: PlatformOrganizationDetailV1["identityProviders"] }>(path,
        { method: "POST", body: JSON.stringify(body) });
      onChange({ ...detail, identityProviders: response.identityProviders }); setNotice(success);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The identity-provider action failed.", true); }
    finally { setPending(false); }
  };
  const stageProvider = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void updateProviders(`/v1/platform/organizations/${organization.id}/identity-providers`, {
      protocol: providerProtocol, displayName: String(data.get("displayName")), discoveryUrl: String(data.get("discoveryUrl")),
      ...(providerProtocol === "saml" ? { metadataUrl: String(data.get("metadataUrl")) } : {}),
      clientId: String(data.get("clientId")), audience: String(data.get("audience")),
      domainIds: data.getAll("domainIds").map(String),
      ...(String(data.get("replacesProviderId") ?? "").length > 0 ? { replacesProviderId: String(data.get("replacesProviderId")) } : {})
    }, "Provider revision staged. Run preflight next; the active sign-in path is unchanged.");
  };
  return <section className="platform-organization-detail" aria-labelledby="platform-organization-title">
    <div className="workspace-heading platform-detail-heading"><div><a className="back-link" href="/platform/organizations">Organizations</a>
      <h1 id="platform-organization-title">{organization.name}</h1><p>{organization.legalName}</p></div>
      <StatusBadge status={organization.lifecycleStatus} /></div>
    <section className="platform-readiness" aria-labelledby="platform-readiness-title">
      <div className="section-heading"><h2 id="platform-readiness-title">Activation readiness</h2>
        <p>{organization.gates.filter((gate) => gate.complete).length} of {organization.gates.length} prerequisites complete</p></div>
      <ul className="platform-gate-list">{organization.gates.map((gate) => <li key={gate.key} data-complete={gate.complete}>
        <span className="platform-gate-marker" aria-hidden="true">{gate.complete ? <svg viewBox="0 0 16 16" focusable="false"><path d="m3 8 3 3 7-7" /></svg> : null}</span><span><strong>{gate.label}</strong>
          <span>{gate.complete ? "Complete" : gate.prerequisite}</span></span></li>)}</ul>
    </section>
    {organization.configurationStatus === "needs_reconciliation" ? <section className="platform-reconciliation" aria-labelledby="platform-reconciliation-title">
      <div className="section-heading"><h2 id="platform-reconciliation-title">Complete the inherited Organization profile</h2>
        <p>This Organization predates the control plane. Confirm its deployment facts before its next lifecycle change.</p></div>
      <form className="platform-provision-form" onSubmit={(event) => void updateProvisioning(event)}>
        <div className="field"><label htmlFor="reconcile-legal-name">Legal name</label><input id="reconcile-legal-name" name="legalName" required defaultValue={organization.legalName} /></div>
        <div className="platform-form-grid">
          <div className="field"><label htmlFor="reconcile-country">Country code</label><input id="reconcile-country" name="countryCode" required pattern="[A-Za-z]{2}" maxLength={2} /></div>
          <div className="field"><label htmlFor="reconcile-time-zone">Time zone</label><input id="reconcile-time-zone" name="timeZone" required /></div>
          <div className="field"><label htmlFor="reconcile-profile">Deployment profile</label><select id="reconcile-profile" name="deploymentProfile" defaultValue="cloud"><option value="cloud">Plenum cloud</option><option value="self_hosted">Self-hosted</option><option value="air_gapped">Air-gapped</option></select></div>
          <div className="field"><label htmlFor="reconcile-region">Data residency region</label><input id="reconcile-region" name="dataResidencyRegion" required /></div>
        </div>
        <div className="field"><label htmlFor="reconcile-entitlements">Enabled capabilities</label><input id="reconcile-entitlements" name="entitlements" required defaultValue="studio_authoring, session_delivery" /><p className="field-hint">Comma-separated contracted capability keys.</p></div>
        <div className="platform-form-grid"><div className="field"><label htmlFor="reconcile-support">Support contact</label><input id="reconcile-support" name="supportContact" type="email" required /></div>
          <div className="field"><label htmlFor="reconcile-security">Security contact <span className="optional">Optional</span></label><input id="reconcile-security" name="securityContact" type="email" /></div></div>
        <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Savingâ€¦" : "Confirm provisioning profile"}</button>
      </form>
    </section> : null}
    <div className="platform-detail-grid">
      <section aria-labelledby="platform-domain-title"><div className="section-heading"><h2 id="platform-domain-title">Organization domains</h2>
        <p>Only verified domains can receive the first Admin invitation.</p></div>
        {detail.domains.length === 0 ? <p className="empty-state">No domain has been added.</p> : <ul className="platform-record-list">
          {detail.domains.map((domain) => <li className="platform-domain-record" key={domain.id}><div><strong>{domain.domain}</strong>
            <span>{domain.verifiedAt === null ? domain.challenge?.failure ?? "Verification pending" : `Verified ${new Date(domain.verifiedAt).toLocaleDateString()}`}</span></div>
            {domain.verifiedAt === null && domain.challenge !== null ? <div className="platform-domain-challenge">
              <dl><div><dt>Record</dt><dd>TXT</dd></div><div><dt>Name</dt><dd><code>{domain.challenge.name}</code></dd></div>
                <div><dt>Value</dt><dd><code>{domain.challenge.value}</code></dd></div><div><dt>Expires</dt><dd>{new Date(domain.challenge.expiresAt).toLocaleString()}</dd></div></dl>
              <div className="actions"><button className="btn-primary" type="button" disabled={pending}
                onClick={() => void mutate(`/v1/platform/organizations/${organization.id}/domains/${domain.id}/verify`, {}, `${domain.domain} is verified.`)}>Check DNS</button>
                <button className="btn-secondary" type="button" disabled={pending}
                  onClick={() => void navigator.clipboard.writeText(`${domain.challenge?.name} TXT ${domain.challenge?.value}`)}>Copy record</button>
                <button className="btn-secondary" type="button" disabled={pending}
                  onClick={() => void mutate(`/v1/platform/organizations/${organization.id}/domains/${domain.id}/reissue`, {}, "DNS challenge reissued. Replace the previous TXT value.")}>Reissue challenge</button></div>
            </div> : domain.verifiedAt === null ? <span>Historical verification cannot satisfy the DNS gate.</span> : <StatusBadge status="verified" />}
          </li>)}</ul>}
        {organization.lifecycleStatus === "pending" ? <form className="platform-inline-form" onSubmit={addDomain}>
          <div className="field"><label htmlFor="platform-domain">Add domain</label><input id="platform-domain" name="domain" required placeholder="organization.example" /></div>
          <button className="btn-secondary" type="submit" disabled={pending}>Add domain</button></form> : null}
      </section>
      <section aria-labelledby="platform-admin-title"><div className="section-heading"><h2 id="platform-admin-title">First Organization Admin</h2>
        <p>This invitation grants Organization authority only.</p></div>
        {detail.firstAdminInvitation === null ? <p className="empty-state">No first Admin invitation has been issued.</p> :
          <div className="platform-admin-status"><strong>{detail.firstAdminInvitation.email}</strong>
            <StatusBadge status={detail.firstAdminInvitation.status} /><span>Expires {new Date(detail.firstAdminInvitation.expiresAt).toLocaleString()}</span>
            {detail.firstAdminInvitation.delivery === null ? null : <span>Delivery: {humanize(detail.firstAdminInvitation.delivery.status)}{detail.firstAdminInvitation.delivery.failureReason === null ? "" : ` â€” ${detail.firstAdminInvitation.delivery.failureReason}`}</span>}
            {detail.firstAdminInvitation.status === "accepted" ? <span>{detail.firstAdminInvitation.identityLinkedAt === null ? "Identity link completes on the first verified-email sign-in after activation." : "Identity provider linked."}</span> : null}</div>}
        {invitationUrl === null ? null : <div className="platform-invitation-result" role="status"><label htmlFor="platform-invitation-url">One-time invitation link</label>
          <div><input id="platform-invitation-url" readOnly value={invitationUrl} />
            <button className="btn-secondary" type="button" onClick={() => void navigator.clipboard.writeText(invitationUrl)}>Copy link</button></div></div>}
        {organization.lifecycleStatus === "pending" && detail.firstAdminInvitation === null ? <form className="platform-inline-form" onSubmit={(event) => void inviteAdmin(event)}>
          <div className="field"><label htmlFor="platform-admin-email">Admin email</label><input id="platform-admin-email" name="email" type="email" required /></div>
          <button className="btn-secondary" type="submit" disabled={pending || organization.verifiedDomainCount === 0}
            aria-describedby={organization.verifiedDomainCount === 0 ? "platform-admin-prerequisite" : undefined}>Create invitation</button>
          {organization.verifiedDomainCount === 0 ? <p id="platform-admin-prerequisite" className="field-hint">Verify the email domain first.</p> : null}</form> : null}
        {organization.lifecycleStatus === "pending" && detail.firstAdminInvitation !== null && detail.firstAdminInvitation.status !== "accepted" ? <div className="actions">
          {detail.firstAdminInvitation.status === "pending" ? <button className="btn-secondary" type="button" disabled={pending} onClick={() => void mutate(
            `/v1/platform/organizations/${organization.id}/first-admin-invitations/revoke`, {}, "First Admin invitation revoked.")}>Revoke invitation</button> : null}
          <button className="btn-secondary" type="button" disabled={pending} onClick={async () => {
            setPending(true); try {
              const response = await platformRequest<{ organization: PlatformOrganizationDetailV1; invitationUrl?: string }>(
                `/v1/platform/organizations/${organization.id}/first-admin-invitations/reissue`, { method: "POST", body: JSON.stringify({ email: detail.firstAdminInvitation?.email }) });
              onChange(response.organization); setInvitationUrl(response.invitationUrl ?? null); setNotice("First Admin invitation reissued and the previous link invalidated.");
            } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The invitation was not reissued.", true); } finally { setPending(false); }
          }}>Reissue invitation</button></div> : null}
      </section>
    </div>
    <section className="platform-identity-providers" aria-labelledby="platform-identity-title">
      <div className="section-heading"><h2 id="platform-identity-title">Organization identity provider</h2>
        <p>Stage changes beside the live provider. Activation remains unavailable until preflight, test sign-in, and Organization Admin approval all succeed.</p></div>
      {detail.identityProviders.length === 0 ? <p className="empty-state">No Organization provider is configured. Platform recovery access remains separate.</p> :
        <ol className="platform-provider-list">{detail.identityProviders.map((provider) => {
          const nextAction = provider.status === "draft" ? "preflight" : provider.status === "approved" ? "activate" :
            provider.status === "active" ? "suspend" : ["superseded", "suspended"].includes(provider.status) ? "rollback" : null;
          return <li key={provider.id} className="platform-provider-row"><div className="platform-provider-summary">
            <div><strong>{provider.displayName}</strong><StatusBadge status={provider.status} /></div>
            <span>{provider.protocol === "saml" ? "SAML through the approved OIDC broker" : "OpenID Connect"} · revision {provider.version}</span>
            <span>{provider.domains.join(", ")}</span></div>
            <dl className="platform-provider-facts"><div><dt>Preflight</dt><dd>{provider.preflightedAt === null ? provider.preflightFailure ?? "Required" : new Date(provider.preflightedAt).toLocaleString()}</dd></div>
              <div><dt>Test sign-in</dt><dd>{provider.testedAt === null ? "Required" : "Passed"}</dd></div>
              <div><dt>Admin approval</dt><dd>{provider.approvedAt === null ? "Required" : "Approved"}</dd></div></dl>
            {nextAction === null ? <p className="platform-row-prerequisite">{provider.status === "preflight_passed" ? "An Organization Admin must complete test sign-in." :
              provider.status === "tested" ? "An Organization Admin must approve this tested revision." : "No Platform action is currently available."}</p> :
              nextAction === "preflight" ? <button className="btn-primary" type="button" disabled={pending}
                onClick={() => void updateProviders(`/v1/platform/organizations/${organization.id}/identity-providers/${provider.id}/preflight`, {},
                  "Metadata and signing keys passed preflight. The Organization Admin can now test sign-in.")}>Run preflight</button> :
                <form className="platform-provider-action" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
                  void updateProviders(`/v1/platform/organizations/${organization.id}/identity-providers/${provider.id}/${nextAction}`,
                    { reason: String(data.get("reason")) }, nextAction === "activate" ? "Provider activated. New Organization sign-ins now use this revision." :
                      nextAction === "suspend" ? "Provider suspended and its active sessions revoked. Platform recovery remains available." :
                        "Previous provider restored and sessions from the replaced provider revoked."); }}>
                  <div className="field"><label htmlFor={`provider-reason-${provider.id}`}>{humanize(nextAction)} reason</label>
                    <input id={`provider-reason-${provider.id}`} name="reason" minLength={3} maxLength={1000} required /></div>
                  <button className={nextAction === "suspend" ? "btn-danger" : "btn-primary"} type="submit" disabled={pending}>{humanize(nextAction)} provider</button>
                </form>}
            <details className="provenance-disclosure"><summary>Technical configuration</summary><dl className="provenance-grid">
              <div><dt>Discovery</dt><dd><code>{provider.discoveryUrl}</code></dd></div>
              {provider.metadataUrl === null ? null : <div><dt>SAML metadata</dt><dd><code>{provider.metadataUrl}</code></dd></div>}
              <div><dt>Revision ID</dt><dd><code>{provider.id}</code></dd></div></dl></details>
          </li>;
        })}</ol>}
      <details className="platform-provider-stage"><summary>Stage a provider revision</summary>
        <form className="platform-provision-form" onSubmit={stageProvider}>
          <div className="platform-form-grid"><div className="field"><label htmlFor="provider-name">Display name</label><input id="provider-name" name="displayName" required minLength={2} maxLength={160} /></div>
            <div className="field"><label htmlFor="provider-protocol">Protocol</label><select id="provider-protocol" name="protocol" value={providerProtocol}
              onChange={(event) => setProviderProtocol(event.currentTarget.value as "oidc" | "saml")}><option value="oidc">OpenID Connect</option><option value="saml">SAML through OIDC broker</option></select></div></div>
          <div className="field"><label htmlFor="provider-discovery">{providerProtocol === "saml" ? "Broker OIDC discovery URL" : "OIDC discovery URL"}</label>
            <input id="provider-discovery" name="discoveryUrl" type="url" inputMode="url" required placeholder="https://identity.example/.well-known/openid-configuration" /></div>
          {providerProtocol === "saml" ? <div className="field"><label htmlFor="provider-metadata">SAML metadata URL</label><input id="provider-metadata" name="metadataUrl" type="url" inputMode="url" required /></div> : null}
          <div className="platform-form-grid"><div className="field"><label htmlFor="provider-client">Public client ID</label><input id="provider-client" name="clientId" required /></div>
            <div className="field"><label htmlFor="provider-audience">Token audience</label><input id="provider-audience" name="audience" required /></div></div>
          <fieldset><legend>Verified sign-in domains</legend><div className="provider-domain-choices">{detail.domains.filter((domain) => domain.verifiedAt !== null).map((domain) =>
            <label className="choice" key={domain.id}><input type="checkbox" name="domainIds" value={domain.id} />{domain.domain}</label>)}</div></fieldset>
          {detail.identityProviders.length === 0 ? null : <div className="field"><label htmlFor="provider-replaces">Revision being replaced <span className="optional">Optional</span></label>
            <select id="provider-replaces" name="replacesProviderId" defaultValue=""><option value="">New provider</option>{detail.identityProviders.map((provider) =>
              <option key={provider.id} value={provider.id}>{provider.displayName} · revision {provider.version}</option>)}</select></div>}
          <p className="field-hint">Plenum uses Authorization Code with PKCE. Client secrets are not accepted or stored.</p>
          <button className="btn-primary" type="submit" disabled={pending || detail.domains.every((domain) => domain.verifiedAt === null)}>Stage revision</button>
        </form></details>
    </section>
    <section className="platform-lifecycle" aria-labelledby="platform-lifecycle-title"><div className="section-heading"><h2 id="platform-lifecycle-title">Lifecycle authority</h2>
      <p>Each transition is immediate, audited, and preserves Organization records.</p></div>
      {organization.lifecycleStatus === "offboarded" ? <p className="empty-state">This Organization is offboarded. No further lifecycle action is available.</p> :
        <form onSubmit={(event) => transition(organization.lifecycleStatus === "active" ? "suspend" : "activate", event)}>
          <div className="field"><label htmlFor="platform-lifecycle-reason">Reason</label><input id="platform-lifecycle-reason" name="reason" required minLength={3} maxLength={1000} /></div>
          <button className="btn-primary" type="submit" disabled={pending || (organization.lifecycleStatus !== "active" && incomplete.length > 0)}
            aria-describedby={incomplete.length > 0 ? "platform-lifecycle-prerequisites" : undefined}>
            {organization.lifecycleStatus === "active" ? "Suspend Organization" : "Activate Organization"}</button>
          {organization.lifecycleStatus !== "active" && incomplete.length > 0 ? <p id="platform-lifecycle-prerequisites" className="field-hint">
            Complete {incomplete.map((gate) => gate.label).join(", ")} before activation.</p> : null}
        </form>}
      {organization.lifecycleStatus !== "offboarded" ? <details className="platform-offboard-disclosure"><summary>Offboard Organization</summary>
        <form onSubmit={(event) => transition("offboard", event)}><p>Offboarding is terminal. Access is revoked; governed records remain preserved.</p>
          <div className="field"><label htmlFor="platform-offboard-reason">Offboarding reason</label><input id="platform-offboard-reason" name="reason" required minLength={3} maxLength={1000} /></div>
          <button className="btn-danger" type="submit" disabled={pending}>Confirm offboarding</button></form></details> : null}
    </section>
    <section aria-labelledby="platform-profile-title"><div className="section-heading"><h2 id="platform-profile-title">Provisioning profile</h2></div>
      <dl className="provenance-grid"><div><dt>Deployment</dt><dd>{humanize(organization.deploymentProfile)}</dd></div>
        <div><dt>Data residency</dt><dd>{organization.dataResidencyRegion ?? "Not configured"}</dd></div><div><dt>Country</dt><dd>{organization.countryCode ?? "Not configured"}</dd></div>
        <div><dt>Time zone</dt><dd>{organization.timeZone ?? "Not configured"}</dd></div><div><dt>Support contact</dt><dd>{organization.supportContact ?? "Not configured"}</dd></div>
        <div><dt>Entitlements</dt><dd>{organization.entitlements.map(humanize).join(", ")}</dd></div></dl>
      <details className="provenance-disclosure"><summary>Technical identifiers</summary><dl className="provenance-grid">
        <div><dt>Organization ID</dt><dd><code>{organization.id}</code></dd></div><div><dt>Workspace slug</dt><dd><code>{organization.slug}</code></dd></div>
        <div><dt>Lifecycle version</dt><dd>{organization.lifecycleVersion}</dd></div></dl></details>
    </section>
    <section aria-labelledby="platform-audit-title"><div className="section-heading"><h2 id="platform-audit-title">Platform audit history</h2>
      <p>Immutable records of provisioning and lifecycle authority.</p></div>
      {detail.auditRecords.length === 0 ? <p className="empty-state">No platform audit record is available.</p> : <ol className="platform-audit-list">
        {detail.auditRecords.map((record) => <li key={record.id}><div><strong>{humanize(record.action.replace("platform.", ""))}</strong>
          <span>{record.actorDisplayName}</span></div><time dateTime={record.recordedAt}>{new Date(record.recordedAt).toLocaleString()}</time></li>)}</ol>}
    </section>
  </section>;
}

export function PlatformOrganizationsPortal() {
  const selectedId = window.location.pathname.match(/^\/platform\/organizations\/([0-9a-f-]{36})\/?$/iu)?.[1] ?? null;
  const [model, setModel] = useState<PlatformOrganizationsV1 | null>(null);
  const [detail, setDetail] = useState<PlatformOrganizationDetailV1 | null>(null);
  const [notice, setNoticeState] = useState<{ message: string; alert: boolean }>({ message: "Platform authority is current.", alert: false });
  const setNotice = useCallback((message: string, alert = false) => setNoticeState({ message, alert }), []);
  const load = useCallback(async () => {
    if (selectedId === null) setModel(await platformRequest<PlatformOrganizationsV1>("/v1/platform/organizations"));
    else setDetail(await platformRequest<PlatformOrganizationDetailV1>(`/v1/platform/organizations/${selectedId}`));
  }, [selectedId]);
  useEffect(() => { void load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Platform Organizations did not load.", true)); }, [load, setNotice]);
  if (selectedId !== null) return <div className="portal-workspace platform-control-plane"><PlatformControlNavigation current="organizations" /><p className="live-region portal-notice" role={notice.alert ? "alert" : "status"} aria-live="polite">{notice.message}</p>
    {detail === null ? <PlenumLoader label="Loading Organization provisioning" /> : <OrganizationDetail detail={detail} onChange={setDetail} setNotice={setNotice} />}</div>;
  return <section className="portal-workspace platform-control-plane" aria-labelledby="platform-organizations-title">
    <PlatformControlNavigation current="organizations" />
    <div className="workspace-heading platform-catalog-heading"><div><h1 id="platform-organizations-title">Organization provisioning</h1>
      <p>Create and govern Organization access without entering customer workspaces.</p></div>
      <ProvisionOrganizationForm onCreated={(created) => { setDetail(created); window.location.assign(`/platform/organizations/${created.organization.id}`); }} setNotice={setNotice} /></div>
    <p className="live-region portal-notice" role={notice.alert ? "alert" : "status"} aria-live="polite">{notice.message}</p>
    {model === null ? <PlenumLoader label="Loading Organizations" /> : <OrganizationCatalog model={model} />}
  </section>;
}
