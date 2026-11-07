import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ErrorEnvelopeV1, JsonObject, OrganizationIdentityProviderV1, OrganizationWorkforceV1 } from "@plenum/event-contracts";
import { PlenumLoader } from "../PlenumLoader.js";

type OrganizationRole = "admin" | "designer" | "publisher" | "operator" | "reviewer" | "research_analyst";

class AdministrationError extends Error {
  constructor(readonly status: number, readonly envelope: ErrorEnvelopeV1) { super(envelope.error.message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json() as T | ErrorEnvelopeV1;
  if (!response.ok) {
    if (typeof body === "object" && body !== null && "error" in body) throw new AdministrationError(response.status, body as ErrorEnvelopeV1);
    throw new Error(`Request failed with status ${response.status}`);
  }
  return body as T;
}

type PluginOperations = {
  permissions: { canSubmit: boolean; canApprove: boolean; canInstall: boolean; canRevoke: boolean };
  artifacts: Array<{ artifactId: string; pluginId: string; version: string; digest: string; bundleDigest: string;
    lifecycleStatus: string; publisherName: string; submittedAt: string; approvedAt: string | null;
    revokedAt: string | null; installationCount: number; bindingCount: number; supplyChain: JsonObject }>;
  governance: {
    publisherMembers: Array<{ personId: string; displayName: string }>;
    publishers: Array<{ publisherId: string; principalId: string; displayName: string; signatureKeyId: string; status: string; approvedAt: string }>;
    trustRoots: Array<{ trustRootId: string; publisherId: string; publisherKeyId: string; revocationKeyId: string; provisionedAt: string }>;
    revocationLists: Array<{ revocationListId: string; publisherId: string; documentSha256: string; generatedAt: string; importedAt: string }>;
    licenseAcceptances: Array<{ acceptanceId: string; pluginId: string; license: string; termsDigest: string; acceptedAt: string }>;
  };
};

type DataPolicyOperations = {
  retentionPolicies: Array<{ id: string; key: string; version: number; scopeType: string; scopeReference: string;
    periodDays: number; legalHoldBehavior: string; expiryAction: string; archiveDestination: string;
    approvalRequired: boolean; createdAt: string }>;
  legalHolds: Array<{ holdId: string; scopeType: string; scopeReference: string; reason: string;
    placedAt: string; releasedAt: string | null }>;
  corrections: Array<{ id: string; targetReference: string; reason: string; reportsMustRegenerate: boolean; correctedAt: string }>;
  imports: Array<{ id: string; sourcePackageSha256: string; importedAt: string }>;
};

const roleLabels: Record<OrganizationRole, string> = {
  admin: "Admin", designer: "Designer", publisher: "Publisher", operator: "Operator",
  reviewer: "Reviewer", research_analyst: "Research Analyst"
};

function AdministrationNavigation({ admin }: { admin: boolean }) {
  return <nav className="card administration-rail" aria-label="Administration destinations">
    <h2>Administration</h2>
    <ul>
      {admin ? <><li><a href="/admin/members">Workforce access</a></li><li><a href="/admin/identity">Identity provider</a></li></> : null}
      <li><a href="/admin/plugins">Plugin operations</a></li>
      {admin ? <><li><a href="/admin/deployment">Deployment posture</a></li><li><a href="/admin/data-policy">Data policy</a></li></> : null}
    </ul>
  </nav>;
}

function WorkforceWorkspace({ setNotice }: { setNotice(message: string): void }) {
  const [model, setModel] = useState<OrganizationWorkforceV1 | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [scimCredential, setScimCredential] = useState<string | null>(null);
  const [lifecycleErrors, setLifecycleErrors] = useState<Record<string, string>>({});
  const load = useCallback(async () => setModel(await request<OrganizationWorkforceV1>("/v1/operations/workforce")), []);
  useEffect(() => { void load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Workforce access did not load.")); }, [load, setNotice]);
  const run = async (key: string, operation: () => Promise<OrganizationWorkforceV1>, success: string) => {
    setPending(key); setNotice("Applying the governed workforce change.");
    try { setModel(await operation()); setNotice(success); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "The workforce change was not applied."); }
    finally { setPending(null); }
  };
  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setPending("invite");
    try {
      const result = await request<{ workforce: OrganizationWorkforceV1 }>("/v1/operations/workforce/invitations", {
        method: "POST", body: JSON.stringify({ email: data.get("email"), displayName: data.get("displayName"), roles: data.getAll("roles") })
      }); setModel(result.workforce); form.reset(); setNotice("Invitation sent. Access begins only after the exact work identity is verified.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The invitation was not sent."); }
    finally { setPending(null); }
  };
  const saveRoles = async (event: FormEvent<HTMLFormElement>, personId: string, expectedRevision: string) => {
    event.preventDefault(); const roles = new FormData(event.currentTarget).getAll("roles").map(String);
    await run(`roles:${personId}`, async () => { await request(`/v1/operations/members/${personId}/roles`, { method: "PUT",
      body: JSON.stringify({ roles, expectedRevision }) }); return request<OrganizationWorkforceV1>("/v1/operations/workforce"); },
    "Organization Roles updated and recorded in the Audit Log.");
  };
  const clearLifecycleError = (personId: string) => setLifecycleErrors((current) => {
    if (current[personId] === undefined) return current;
    const next = { ...current };
    delete next[personId];
    return next;
  });
  const lifecycle = async (personId: string, transition: "activate" | "suspend" | "deprovision", expectedVersion: number,
    reason: string, reasonInput: HTMLInputElement) => {
    const normalizedReason = reason.trim();
    if (transition !== "activate" && (normalizedReason.length < 3 || normalizedReason.length > 1000)) {
      const message = "Enter a lifecycle reason between 3 and 1,000 characters before suspending or deprovisioning this member.";
      setLifecycleErrors((current) => ({ ...current, [personId]: message }));
      setNotice("The workforce change needs a valid lifecycle reason.");
      reasonInput.focus();
      return;
    }
    clearLifecycleError(personId);
    if (transition === "deprovision" && !window.confirm("Deprovision this member? Active sessions and projections will end immediately. Governed records will be preserved.")) return;
    await run(`${transition}:${personId}`, () => request<OrganizationWorkforceV1>(`/v1/operations/workforce/members/${personId}/${transition}`,
      { method: "POST", body: JSON.stringify({ expectedVersion, reason: normalizedReason }) }), transition === "activate" ? "Workforce access reactivated." :
      transition === "suspend" ? "Workforce access suspended; active sessions and projections were revoked." :
        "Workforce access deprovisioned; governed records were preserved.");
  };
  const runLifecycleFromForm = (form: HTMLFormElement | null, personId: string,
    transition: "activate" | "suspend" | "deprovision", expectedVersion: number) => {
    const reasonInput = form?.elements.namedItem("reason");
    if (!(reasonInput instanceof HTMLInputElement)) return;
    const reason = transition === "activate" && reasonInput.value.trim() === "" ? "Access restored by Admin" : reasonInput.value;
    void lifecycle(personId, transition, expectedVersion, reason, reasonInput);
  };
  const createCredential = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; setPending("credential");
    try { const result = await request<{ credential: string; workforce: OrganizationWorkforceV1 }>("/v1/operations/workforce/scim-credentials",
      { method: "POST", body: JSON.stringify({ label: new FormData(form).get("label") }) }); setModel(result.workforce);
      setScimCredential(result.credential); form.reset(); setNotice("SCIM credential created. Copy it now; Plenum stores only its digest.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The SCIM credential was not created."); }
    finally { setPending(null); }
  };
  const createMapping = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    await run("mapping", () => request<OrganizationWorkforceV1>("/v1/operations/workforce/group-mappings", { method: "POST",
      body: JSON.stringify({ groupExternalId: data.get("groupExternalId"), groupDisplayName: data.get("groupDisplayName"), organizationRole: data.get("organizationRole") }) }),
    "The IdP group now maps to the selected Organization Role."); form.reset();
  };
  const reconcile = () => run("reconcile", () => request<OrganizationWorkforceV1>("/v1/operations/workforce/reconcile",
    { method: "POST", body: "{}" }), "Reconciliation completed. No access was removed; review the recorded findings.");
  const reissue = (invitationId: string) => run(`reissue:${invitationId}`, async () => {
    const result = await request<{ workforce: OrganizationWorkforceV1 }>(`/v1/operations/workforce/invitations/${invitationId}/reissue`,
      { method: "POST", body: "{}" }); return result.workforce;
  }, "Invitation reissued with a new single-use link. The previous link can no longer be used.");
  if (model === null) return <section className="administration-workspace" aria-labelledby="workforce-title">
    <div className="workspace-heading"><h1 id="workforce-title">Workforce access</h1></div><PlenumLoader label="Loading Organization workforce" /></section>;
  return <section className="administration-workspace workforce-workspace" aria-labelledby="workforce-title">
    <div className="workspace-heading"><h1 id="workforce-title">Workforce access</h1><p>Provision people, govern Organization Roles, and remove every access path from one record. Authentication alone never grants access.</p></div>
    <section className="workforce-section" aria-labelledby="invite-workforce-title"><div className="workforce-section-heading"><div><h2 id="invite-workforce-title">Invite a member</h2><p>Use a verified Organization domain. Roles activate after exact-email identity linking.</p></div></div>
      <form className="operation-form workforce-invite-form" onSubmit={(event) => void invite(event)}>
        <div className="field"><label htmlFor="workforce-name">Display name</label><input id="workforce-name" name="displayName" required minLength={2} maxLength={200} /></div>
        <div className="field"><label htmlFor="workforce-email">Work email</label><input id="workforce-email" name="email" type="email" autoComplete="email" required /></div>
        <fieldset><legend>Organization Roles</legend><div className="role-checkboxes">{model.roles.map((role) => <label className="choice" key={role}><input type="checkbox" name="roles" value={role} />{roleLabels[role as OrganizationRole]}</label>)}</div></fieldset>
        <button className="btn-primary" type="submit" disabled={pending !== null}>{pending === "invite" ? "Sending…" : "Send invitation"}</button>
      </form>
      {model.invitations.length === 0 ? <p className="portal-empty">No workforce invitations are pending.</p> : <ul className="administration-list compact">{model.invitations.map((invitation) => <li key={invitation.id}>
        <div><strong>{invitation.displayName}</strong><span>{invitation.email} · {invitation.roles.map((role) => roleLabels[role as OrganizationRole]).join(", ")}</span>
          <span>Delivery: {invitation.deliveryStatus}{invitation.deliveryFailure === null ? "" : ` — ${invitation.deliveryFailure}`}</span></div><div className="record-actions">
          <span className={`badge ${invitation.status === "linked" ? "badge-success" : invitation.status === "pending" ? "badge-info" : "badge-muted"}`}>{invitation.status}</span>
          {(invitation.deliveryStatus === "bounced" || invitation.deliveryStatus === "failed" || invitation.status === "expired") ?
            <button className="btn-primary" type="button" disabled={pending !== null} onClick={() => void reissue(invitation.id)}>Reissue</button> : null}
          {invitation.status === "pending" ? <button className="btn-secondary" type="button" disabled={pending !== null}
            onClick={() => void run(`revoke:${invitation.id}`, () => request<OrganizationWorkforceV1>(`/v1/operations/workforce/invitations/${invitation.id}/revoke`, { method: "POST", body: "{}" }), "Invitation revoked.")}>Revoke</button> : null}</div></li>)}</ul>}
    </section>
    <section className="workforce-section" aria-labelledby="workforce-roster-title"><div className="workforce-section-heading"><div><h2 id="workforce-roster-title">Access roster</h2><p>{model.members.length} governed workforce record{model.members.length === 1 ? "" : "s"}</p></div>
      <div className="workforce-signals" aria-label="Reconciliation signals"><span>Stale SCIM {model.reconciliation.staleScimMembers}</span><span>Entitlement conflicts {model.reconciliation.entitlementConflicts}</span><span>Group removals to confirm {model.reconciliation.groupRemovalCandidates}</span><span>Failed operations {model.reconciliation.failedOperations}</span>
        <button className="btn-secondary" type="button" disabled={pending !== null} onClick={() => void reconcile()}>{pending === "reconcile" ? "Reconciling…" : "Run reconciliation"}</button></div></div>
      {model.members.length === 0 ? <p className="portal-empty">No workforce members yet. Send an invitation or connect SCIM to begin.</p> : <ul className="administration-list workforce-roster">{model.members.map((member) => <li key={member.personId} className="administration-record workforce-record">
        <div className="workforce-member-summary"><div><h3>{member.displayName}</h3><p>{member.email ?? "Email will appear after identity linking"}</p></div><span className={`badge ${member.status === "active" ? "badge-success" : member.status === "suspended" ? "badge-warning" : "badge-muted"}`}>{member.status}</span></div>
        <form key={member.roleRevision} onSubmit={(event) => void saveRoles(event, member.personId, member.roleRevision)}><fieldset disabled={member.status !== "active"}><legend>Organization Roles</legend><div className="role-checkboxes">{model.roles.map((role) => <label className="choice" key={role}>
          <input type="checkbox" name="roles" value={role} defaultChecked={member.roles.includes(role)} />{roleLabels[role as OrganizationRole]}</label>)}</div></fieldset><button className="btn-secondary" type="submit" disabled={pending !== null || member.status !== "active"}>{pending === `roles:${member.personId}` ? "Saving…" : "Save roles"}</button></form>
        <form className="workforce-lifecycle" onSubmit={(event) => event.preventDefault()}><div className="field"><label htmlFor={`reason-${member.personId}`}>Lifecycle reason</label><input id={`reason-${member.personId}`} name="reason" minLength={3} maxLength={1000} required={member.status === "active"}
          aria-invalid={lifecycleErrors[member.personId] !== undefined} aria-describedby={`reason-hint-${member.personId}${lifecycleErrors[member.personId] === undefined ? "" : ` reason-error-${member.personId}`}`}
          onChange={() => clearLifecycleError(member.personId)} />
          <p id={`reason-hint-${member.personId}`} className="field-hint">Required for suspension or deprovisioning.</p>
          {lifecycleErrors[member.personId] === undefined ? null : <p id={`reason-error-${member.personId}`} className="field-error" role="alert">{lifecycleErrors[member.personId]}</p>}</div><div className="record-actions">
          {member.status === "suspended" ? <button className="btn-secondary" type="button" disabled={pending !== null} onClick={(event) => runLifecycleFromForm(event.currentTarget.form, member.personId, "activate", member.lifecycleVersion)}>Reactivate</button> : member.status === "active" ? <><button className="btn-secondary" type="button" disabled={pending !== null} onClick={(event) => runLifecycleFromForm(event.currentTarget.form, member.personId, "suspend", member.lifecycleVersion)}>Suspend</button>
            <button className="btn-danger" type="button" disabled={pending !== null} onClick={(event) => runLifecycleFromForm(event.currentTarget.form, member.personId, "deprovision", member.lifecycleVersion)}>Deprovision</button></> : null}</div></form>
      </li>)}</ul>}
    </section>
    <details className="workforce-section workforce-disclosure"><summary>SCIM provisioning and IdP group mapping</summary><div className="workforce-disclosure-body"><p>Endpoint: <code>/scim/v2</code>. Group additions grant mapped Organization Roles; omissions become reconciliation candidates and never silently remove access.</p>
      <form className="operation-form" onSubmit={(event) => void createCredential(event)}><div className="field"><label htmlFor="scim-label">Credential label</label><input id="scim-label" name="label" required minLength={2} maxLength={120} placeholder="Production identity sync" /></div><button className="btn-primary" type="submit" disabled={pending !== null}>{pending === "credential" ? "Creating…" : "Create SCIM credential"}</button></form>
      {scimCredential !== null ? <div className="credential-reveal" role="status"><label htmlFor="scim-secret">Copy this credential now</label><input id="scim-secret" readOnly value={scimCredential} onFocus={(event) => event.currentTarget.select()} /><p>Plenum will not show it again.</p></div> : null}
      <ul className="administration-list compact">{model.scimCredentials.map((credential) => <li key={credential.id}><div><strong>{credential.label}</strong><span>{credential.tokenPrefix}… · {credential.lastUsedAt === null ? "not used" : `last used ${new Date(credential.lastUsedAt).toLocaleString()}`}</span></div>{credential.revokedAt === null ? <button className="btn-secondary" type="button" disabled={pending !== null} onClick={() => void run(`credential:${credential.id}`, () => request<OrganizationWorkforceV1>(`/v1/operations/workforce/scim-credentials/${credential.id}/revoke`, { method: "POST", body: "{}" }), "SCIM credential revoked.")}>Revoke</button> : <span className="badge badge-muted">revoked</span>}</li>)}</ul>
      <form className="operation-form workforce-mapping-form" onSubmit={(event) => void createMapping(event)}><div className="field"><label htmlFor="group-external-id">IdP group ID</label><input id="group-external-id" name="groupExternalId" required /></div><div className="field"><label htmlFor="group-display-name">Group name</label><input id="group-display-name" name="groupDisplayName" required /></div><div className="field"><label htmlFor="group-role">Organization Role</label><select id="group-role" name="organizationRole">{model.roles.map((role) => <option value={role} key={role}>{roleLabels[role as OrganizationRole]}</option>)}</select></div><button className="btn-secondary" type="submit" disabled={pending !== null}>Add mapping</button></form>
      {model.groupMappings.length === 0 ? <p className="portal-empty">No IdP group mapping exists. SCIM groups cannot grant roles until an Admin creates one.</p> : <ul className="administration-list compact">{model.groupMappings.map((mapping) => <li key={mapping.id}><strong>{mapping.groupDisplayName}</strong><span>{roleLabels[mapping.organizationRole as OrganizationRole]} · {mapping.activeMemberCount} members</span></li>)}</ul>}
      <section aria-labelledby="provisioning-operation-title"><h3 id="provisioning-operation-title">Provisioning operations</h3>
        <p className="field-hint">Provider requests and reconciliation attempts are durable. Preparing a retry does not replay a payload; Entra ID or Okta must resend the failed request.</p>
        {model.provisioningOperations.length === 0 ? <p className="portal-empty">No provider operation has been recorded.</p> :
          <ul className="administration-list compact">{model.provisioningOperations.slice(0, 10).map((operation) => <li key={operation.id}>
            <div><strong>{operation.operationType.replaceAll("_", " ")}</strong><span>{operation.source} · {new Date(operation.startedAt).toLocaleString()} · attempt {operation.attemptCount}</span>
              {operation.errorReason === null ? null : <span>{operation.errorReason}</span>}</div><div className="record-actions">
              <span className={`badge ${operation.status === "succeeded" ? "badge-success" : operation.status === "failed" ? "badge-warning" : "badge-info"}`}>{operation.status.replaceAll("_", " ")}</span>
              {operation.status === "failed" && operation.attemptCount < 10 ? <button className="btn-secondary" type="button" disabled={pending !== null}
                onClick={() => void run(`retry:${operation.id}`, () => request<OrganizationWorkforceV1>(`/v1/operations/workforce/provisioning-operations/${operation.id}/retry`, { method: "POST", body: "{}" }), "Retry prepared. Ask the identity provider to resend the failed request.")}>Prepare retry</button> : null}</div>
          </li>)}</ul>}
      </section>
    </div></details>
    <AccessReview model={model} pending={pending} run={run} />
  </section>;
}

function AccessReview({ model, pending, run }: { model: OrganizationWorkforceV1; pending: string | null;
  run(key: string, operation: () => Promise<OrganizationWorkforceV1>, success: string): Promise<void> }) {
  return <section className="workforce-section" aria-labelledby="access-review-title"><div className="workforce-section-heading"><div><h2 id="access-review-title">Periodic access review</h2><p>Record an accountable decision for every current member.</p></div>
    {model.accessReview === null || model.accessReview.status === "completed" ? <button className="btn-primary" type="button" disabled={pending !== null} onClick={() => void run("review:start", () => request<OrganizationWorkforceV1>("/v1/operations/workforce/access-reviews", { method: "POST", body: "{}" }), "Access review started.")}>Start access review</button> : null}</div>
    {model.accessReview?.status === "open" ? <><ul className="administration-list compact">{model.accessReview.items.map((item) => <li key={item.id}><div><strong>{item.displayName}</strong><span>{item.rolesSnapshot.map((role) => roleLabels[role as OrganizationRole]).join(", ") || "No active roles"}</span></div>{item.decision === null ? <form className="review-decision-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void run(`review:${item.id}`, () => request<OrganizationWorkforceV1>(`/v1/operations/workforce/access-reviews/items/${item.id}/decide`, { method: "POST", body: JSON.stringify({ decision: data.get("decision"), reason: data.get("reason") }) }), "Access review decision recorded."); }}>
      <label className="sr-only" htmlFor={`review-decision-${item.id}`}>Decision for {item.displayName}</label><select id={`review-decision-${item.id}`} name="decision"><option value="retain">Retain</option><option value="suspend">Suspend</option><option value="deprovision">Deprovision</option></select><label className="sr-only" htmlFor={`review-reason-${item.id}`}>Decision reason</label><input id={`review-reason-${item.id}`} name="reason" required minLength={3} maxLength={1000} placeholder="Decision reason" /><button className="btn-secondary" type="submit" disabled={pending !== null}>Record</button></form> : <span className="badge badge-success">{item.decision}</span>}</li>)}</ul>
      <button className="btn-primary" type="button" disabled={pending !== null || model.accessReview.pendingCount > 0} aria-describedby={model.accessReview.pendingCount > 0 ? "review-prerequisite" : undefined} onClick={() => void run("review:complete", () => request<OrganizationWorkforceV1>(`/v1/operations/workforce/access-reviews/${model.accessReview?.id}/complete`, { method: "POST", body: "{}" }), "Access review completed and preserved in the Audit Log.")}>Complete review</button>{model.accessReview.pendingCount > 0 ? <p id="review-prerequisite" className="field-hint">Decide all {model.accessReview.pendingCount} remaining items before completion.</p> : null}</> : <p className="portal-empty">No access review is open. Plenum marks a review due after 90 days.</p>}
  </section>;
}

function PluginsWorkspace({ organizationId, setNotice }: { organizationId: string; setNotice(message: string): void }) {
  const [model, setModel] = useState<PluginOperations | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => setModel(await request<PluginOperations>("/v1/operations/plugins")), []);
  useEffect(() => { void load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Plugin operations did not load.")); }, [load, setNotice]);
  const transition = async (artifactId: string, action: "approve" | "revoke") => {
    setPending(true); setNotice(`${action === "approve" ? "Approving" : "Revoking"} the digest-pinned Plugin Artifact.`);
    try { await request(`/v1/plugins/${artifactId}/${action}`, { method: "POST", body: "{}" }); await load();
      setNotice(`Plugin Artifact ${action === "approve" ? "approved" : "revoked"}; historical provenance is preserved.`); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "The Plugin lifecycle change failed."); }
    finally { setPending(false); }
  };
  const submitBundle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const input = event.currentTarget.elements.namedItem("pluginBundle") as HTMLInputElement;
    const file = input.files?.[0]; if (file === undefined) return;
    setPending(true); setNotice("Verifying the signed Plugin bundle.");
    try {
      const response = await fetch("/v1/plugins/submissions", { method: "POST",
        headers: { "content-type": "application/vnd.plenum.plugin+json" }, body: file });
      const body = await response.json() as ErrorEnvelopeV1 | { pluginId: string };
      if (!response.ok) throw new Error("error" in body ? body.error.message : "Plugin submission failed.");
      input.value = ""; await load(); setNotice("Plugin bundle submitted. Admin approval remains a separate action.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The Plugin bundle was not submitted."); }
    finally { setPending(false); }
  };
  const install = async (event: FormEvent<HTMLFormElement>, artifactId: string) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setNotice("Verifying and installing the Plugin Artifact.");
    try {
      await request(`/v1/organizations/${organizationId}/plugin-installations`, { method: "POST", body: JSON.stringify({
        installationId: crypto.randomUUID(), artifactId,
        permittedPermissions: String(data.get("permissions") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
        compatibility: { hostApiVersion: String(data.get("hostApiVersion")), releaseSchemaVersion: String(data.get("releaseSchemaVersion")),
          deploymentProfile: String(data.get("deploymentProfile")) }
      }) }); await load(); setNotice("Plugin installed with its verified digest and granted permissions.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The Plugin was not installed."); }
    finally { setPending(false); }
  };
  const govern = async (path: string, body: JsonObject, success: string) => {
    setPending(true);
    try { await request(path, { method: "POST", body: JSON.stringify(body) }); await load(); setNotice(success); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "The Plugin governance action failed."); }
    finally { setPending(false); }
  };
  const registerPublisher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void govern("/v1/plugin-publishers", { publisherPrincipalId: String(data.get("publisherPrincipalId")),
      displayName: String(data.get("displayName")), signatureKeyId: String(data.get("signatureKeyId")),
      publicKeyPem: String(data.get("publicKeyPem")) }, "Plugin Publisher registered with a pinned signing key.");
  };
  const provisionTrust = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void govern("/v1/plugin-trust-roots", { publisherId: String(data.get("publisherId")),
      publisherKeyId: String(data.get("publisherKeyId")), publisherPublicKeyPem: String(data.get("publisherPublicKeyPem")),
      revocationKeyId: String(data.get("revocationKeyId")), revocationPublicKeyPem: String(data.get("revocationPublicKeyPem")) },
    "Institution-provisioned Plugin trust root recorded.");
  };
  const importRevocations = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const file = data.get("revocationDocument");
    if (!(file instanceof File)) return;
    try { await govern("/v1/plugin-revocations", { publisherId: String(data.get("publisherId")),
      document: JSON.parse(await file.text()) as JsonObject }, "Signed Plugin revocation list verified and imported."); }
    catch { setNotice("The signed Plugin revocation list is not valid JSON."); }
  };
  const acceptLicense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const file = data.get("licenseTerms");
    if (!(file instanceof File)) return;
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const termsDigest = `sha256:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
    await govern("/v1/plugins/licenses", { pluginId: String(data.get("pluginId")), license: String(data.get("license")), termsDigest },
      "Plugin license terms accepted with their calculated digest.");
  };
  return <section className="administration-workspace" aria-labelledby="plugins-title">
    <div className="workspace-heading"><h1 id="plugins-title">Plugin operations</h1>
      <p>Submission, approval, installation, binding, and Runtime execution remain separate authorities. Plugin output cannot directly change Session state.</p></div>
    {model?.permissions.canApprove ? <section className="card operation-form" aria-labelledby="plugin-governance-title">
      <h2 id="plugin-governance-title">Publisher trust and license governance</h2>
      <p>Publisher registration, institution-provisioned trust, signed revocation data, and license acceptance remain separate recorded controls.</p>
      <div className="governance-summary" aria-label="Plugin governance status"><span>{model.governance.publishers.length} Publishers</span>
        <span>{model.governance.trustRoots.length} trust roots</span><span>{model.governance.revocationLists.length} revocation lists</span>
        <span>{model.governance.licenseAcceptances.length} license acceptances</span></div>
      <details><summary>Register a Plugin Publisher</summary><form onSubmit={registerPublisher}>
        <div className="field"><label htmlFor="publisher-person">Organization Publisher</label><select id="publisher-person" name="publisherPrincipalId" required>
          {model.governance.publisherMembers.map((member) => <option key={member.personId} value={member.personId}>{member.displayName}</option>)}</select></div>
        <div className="field"><label htmlFor="publisher-name">Publisher display name</label><input id="publisher-name" name="displayName" required /></div>
        <div className="field"><label htmlFor="publisher-key-id">Signing key label</label><input id="publisher-key-id" name="signatureKeyId" required /></div>
        <div className="field"><label htmlFor="publisher-public-key">Signing public key (PEM)</label><textarea id="publisher-public-key" name="publicKeyPem" required /></div>
        <button className="btn-primary" type="submit" disabled={pending}>Register Publisher</button></form></details>
      <details><summary>Provision a Publisher trust root</summary><form onSubmit={provisionTrust}>
        <div className="field"><label htmlFor="trust-publisher">Registered Publisher</label><select id="trust-publisher" name="publisherId" required>
          {model.governance.publishers.map((publisher) => <option key={publisher.publisherId} value={publisher.publisherId}>{publisher.displayName}</option>)}</select></div>
        <div className="field"><label htmlFor="trust-publisher-key-id">Publisher key label</label><input id="trust-publisher-key-id" name="publisherKeyId" required /></div>
        <div className="field"><label htmlFor="trust-publisher-key">Publisher public key (PEM)</label><textarea id="trust-publisher-key" name="publisherPublicKeyPem" required /></div>
        <div className="field"><label htmlFor="trust-revocation-key-id">Revocation key label</label><input id="trust-revocation-key-id" name="revocationKeyId" required /></div>
        <div className="field"><label htmlFor="trust-revocation-key">Revocation public key (PEM)</label><textarea id="trust-revocation-key" name="revocationPublicKeyPem" required /></div>
        <button className="btn-primary" type="submit" disabled={pending}>Provision trust root</button></form></details>
      <details><summary>Import signed revocation data</summary><form onSubmit={(event) => void importRevocations(event)}>
        <div className="field"><label htmlFor="revocation-publisher">Registered Publisher</label><select id="revocation-publisher" name="publisherId" required>
          {model.governance.publishers.map((publisher) => <option key={publisher.publisherId} value={publisher.publisherId}>{publisher.displayName}</option>)}</select></div>
        <div className="field"><label htmlFor="revocation-document">Signed revocation list</label><input id="revocation-document" name="revocationDocument" type="file" accept="application/json,.json" required /></div>
        <button className="btn-primary" type="submit" disabled={pending}>Verify and import revocations</button></form></details>
      <details><summary>Accept Plugin license terms</summary><form onSubmit={(event) => void acceptLicense(event)}>
        <div className="field"><label htmlFor="license-plugin">Plugin ID</label><input id="license-plugin" name="pluginId" required /></div>
        <div className="field"><label htmlFor="license-name">License identifier</label><input id="license-name" name="license" required /></div>
        <div className="field"><label htmlFor="license-terms">License terms file</label><input id="license-terms" name="licenseTerms" type="file" required /></div>
        <button className="btn-primary" type="submit" disabled={pending}>Accept calculated terms digest</button></form></details>
    </section> : null}
    {model?.permissions.canSubmit ? <form className="card operation-form" onSubmit={(event) => void submitBundle(event)}>
      <h2>Submit a signed Plugin bundle</h2><div className="field"><label htmlFor="plugin-bundle">Signed Plugin bundle</label>
        <input id="plugin-bundle" name="pluginBundle" type="file" accept="application/json,.json" required /></div>
      <button className="btn-primary" type="submit" disabled={pending}>Verify and submit</button></form> : null}
    {model === null ? <PlenumLoader label="Loading Plugin provenance" /> : model.artifacts.length === 0 ? <p className="empty-state">No Plugin Artifacts have been submitted.</p> :
      <ul className="administration-list">{model.artifacts.map((artifact) => <li className="card administration-record" key={artifact.artifactId}>
        <div className="card-heading"><div><h2>{artifact.pluginId} {artifact.version}</h2><p>{artifact.publisherName}</p></div>
          <span className="badge badge-state">{artifact.lifecycleStatus.replaceAll("_", " ")}</span></div>
        <dl className="provenance-grid"><div><dt>Submitted</dt><dd>{new Date(artifact.submittedAt).toLocaleString()}</dd></div>
          <div><dt>Usage</dt><dd>{artifact.installationCount} installations · {artifact.bindingCount} bindings</dd></div></dl>
        <details className="provenance-disclosure"><summary>Technical and supply-chain provenance</summary>
          <dl className="provenance-grid"><div><dt>Artifact digest</dt><dd><code>{artifact.digest}</code></dd></div>
            <div><dt>Bundle digest</dt><dd><code>{artifact.bundleDigest}</code></dd></div></dl>
          <pre className="json-inspector">{JSON.stringify(artifact.supplyChain, null, 2)}</pre></details>
        <div className="actions">
          {model.permissions.canApprove && artifact.lifecycleStatus === "contract_validated" ? <button className="btn-primary" type="button" disabled={pending}
            onClick={() => void transition(artifact.artifactId, "approve")}>Approve Artifact</button> : null}
          {model.permissions.canRevoke && artifact.lifecycleStatus === "approved" ? <button className="btn-danger" type="button" disabled={pending}
            onClick={() => void transition(artifact.artifactId, "revoke")}>Revoke Artifact</button> : null}
        </div>
        {model.permissions.canInstall && artifact.lifecycleStatus === "approved" && artifact.installationCount === 0 ? <details>
          <summary>Install approved Artifact</summary><form onSubmit={(event) => void install(event, artifact.artifactId)}>
            <div className="field"><label htmlFor={`plugin-permissions-${artifact.artifactId}`}>Granted permissions (comma separated)</label>
              <input id={`plugin-permissions-${artifact.artifactId}`} name="permissions" /></div>
            <div className="field"><label htmlFor={`plugin-host-${artifact.artifactId}`}>Host API version</label>
              <input id={`plugin-host-${artifact.artifactId}`} name="hostApiVersion" defaultValue="1.0.0" required /></div>
            <div className="field"><label htmlFor={`plugin-schema-${artifact.artifactId}`}>Release schema version</label>
              <input id={`plugin-schema-${artifact.artifactId}`} name="releaseSchemaVersion" defaultValue="1.0.0" required /></div>
            <div className="field"><label htmlFor={`plugin-profile-${artifact.artifactId}`}>Deployment profile</label>
              <select id={`plugin-profile-${artifact.artifactId}`} name="deploymentProfile" defaultValue="connected"><option value="connected">Connected</option>
                <option value="self_hosted">Self-hosted</option><option value="air_gapped">Air-gapped</option></select></div>
            <button className="btn-primary" type="submit" disabled={pending}>Verify and install</button>
          </form></details> : null}
      </li>)}</ul>}
  </section>;
}

function DataPolicyWorkspace({ organizationId, setNotice }: { organizationId: string; setNotice(message: string): void }) {
  const [model, setModel] = useState<DataPolicyOperations | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => setModel(await request<DataPolicyOperations>("/v1/operations/data-policy")), []);
  useEffect(() => { void load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Data policy did not load.")); }, [load, setNotice]);
  const mutate = async (path: string, body: JsonObject, success: string) => {
    setPending(true);
    try { await request(path, { method: "POST", body: JSON.stringify(body) }); await load(); setNotice(success); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "The policy action failed."); }
    finally { setPending(false); }
  };
  const createPolicy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void mutate("/v1/retention/policies", { policyKey: String(data.get("policyKey")), version: Number(data.get("version")),
      scopeType: String(data.get("scopeType")), scopeReference: String(data.get("scopeReference")),
      periodDays: Number(data.get("periodDays")), legalHoldBehavior: String(data.get("legalHoldBehavior")),
      expiryAction: String(data.get("expiryAction")), archiveDestination: String(data.get("archiveDestination")),
      approvalRequired: data.get("approvalRequired") === "on" }, "Retention policy recorded as an immutable version.");
  };
  const createCorrection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void mutate("/v1/reporting/corrections", { targetReference: String(data.get("targetReference")),
      originalValue: String(data.get("originalValue")), correctedValue: String(data.get("correctedValue")),
      reason: String(data.get("reason")), reportsMustRegenerate: data.get("reportsMustRegenerate") === "on" },
    "Correction recorded without overwriting the original value.");
  };
  const importArchive = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const input = event.currentTarget.elements.namedItem("organizationArchive") as HTMLInputElement;
    const file = input.files?.[0]; if (file === undefined) return; setPending(true);
    try { const response = await fetch(`/v1/organizations/${organizationId}/archive/import`, { method: "POST", headers: { "content-type": "application/json" }, body: file });
      const body = await response.json() as ErrorEnvelopeV1 | { restoredRows: number };
      if (!response.ok) throw new Error("error" in body ? body.error.message : "Archive import failed.");
      setNotice(`Portable Organization archive verified and imported; ${"restoredRows" in body ? body.restoredRows : 0} rows restored.`); await load(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "The Organization archive was not imported."); }
    finally { setPending(false); }
  };
  return <section className="administration-workspace" aria-labelledby="policy-title">
    <div className="workspace-heading"><h1 id="policy-title">Data policy</h1>
      <p>Retention, legal hold, corrections, and portable archives are recorded at the Organization boundary.</p></div>
    <div className="workspace-split">
      <div><section className="card operation-form"><h2>Retention policy</h2><form onSubmit={createPolicy}>
        <div className="field"><label htmlFor="policy-key">Policy key</label><input id="policy-key" name="policyKey" required maxLength={100} /></div>
        <div className="field"><label htmlFor="policy-version">Version</label><input id="policy-version" name="version" type="number" min="1" defaultValue="1" required /></div>
        <div className="field"><label htmlFor="policy-scope">Scope</label><select id="policy-scope" name="scopeType" defaultValue="organization"><option value="organization">Organization</option><option value="session">Session</option><option value="export">Export</option><option value="project">Project</option></select></div>
        <details className="provenance-disclosure"><summary>Technical scope reference</summary>
          <div className="field"><label htmlFor="policy-reference">Scope reference</label><input id="policy-reference" name="scopeReference" defaultValue={organizationId} required /></div></details>
        <div className="field"><label htmlFor="policy-days">Retention period in days</label><input id="policy-days" name="periodDays" type="number" min="1" defaultValue="365" required /></div>
        <div className="field"><label htmlFor="hold-behavior">Legal hold behavior</label><select id="hold-behavior" name="legalHoldBehavior"><option value="retain">Retain</option><option value="block_action">Block action</option></select></div>
        <div className="field"><label htmlFor="expiry-action">Expiry action</label><select id="expiry-action" name="expiryAction"><option value="archive">Archive</option><option value="anonymize">Anonymize</option><option value="delete">Delete</option></select></div>
        <div className="field"><label htmlFor="archive-destination">Archive destination</label><input id="archive-destination" name="archiveDestination" defaultValue="institutional-archive" required /></div>
        <label className="choice"><input type="checkbox" name="approvalRequired" /> Approval is required before enforcement.</label>
        <button className="btn-primary" type="submit" disabled={pending}>Record policy version</button></form></section>
        <section className="card operation-form"><h2>Legal hold</h2><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget);
          void mutate("/v1/retention/legal-holds", { scopeType: String(data.get("scopeType")), scopeReference: String(data.get("scopeReference")), reason: String(data.get("reason")) }, "Legal hold placed; matching purge is blocked."); }}>
          <div className="field"><label htmlFor="hold-scope">Scope</label><select id="hold-scope" name="scopeType"><option value="organization">Organization</option><option value="export">Export</option></select></div>
          <div className="field"><label htmlFor="hold-reference">Scope reference</label><input id="hold-reference" name="scopeReference" defaultValue={organizationId} required /></div>
          <div className="field"><label htmlFor="hold-reason">Reason</label><textarea id="hold-reason" name="reason" required maxLength={4000} /></div>
          <button className="btn-primary" type="submit" disabled={pending}>Place legal hold</button></form></section>
      </div>
      <div><section className="card operation-form"><h2>Correction record</h2><p>The original observation remains intact and traceable.</p><form onSubmit={createCorrection}>
        <div className="field"><label htmlFor="correction-target">Target reference</label><input id="correction-target" name="targetReference" required /></div>
        <div className="field"><label htmlFor="correction-original">Original recorded value</label><textarea id="correction-original" name="originalValue" required /></div>
        <div className="field"><label htmlFor="correction-value">Corrected value</label><textarea id="correction-value" name="correctedValue" required /></div>
        <div className="field"><label htmlFor="correction-reason">Correction reason</label><textarea id="correction-reason" name="reason" required maxLength={4000} /></div>
        <label className="choice"><input type="checkbox" name="reportsMustRegenerate" /> Existing reports must be regenerated.</label>
        <button className="btn-primary" type="submit" disabled={pending}>Record correction</button></form></section>
        <section className="card operation-form"><h2>Portable Organization archive</h2><p>The export includes governed Organization data and excludes secrets, protected identity-provider material, and transient credentials.</p>
          <a className="btn-secondary link-button" href={`/v1/organizations/${organizationId}/archive`}>Export portable archive</a>
          <details><summary>Import into an empty Organization deployment</summary><form onSubmit={(event) => void importArchive(event)}>
            <div className="field"><label htmlFor="organization-archive">Verified Organization archive</label><input id="organization-archive" name="organizationArchive" type="file" accept="application/json,.json" required /></div>
            <button className="btn-danger" type="submit" disabled={pending}>Verify and import archive</button></form></details></section>
      </div>
    </div>
    <section aria-labelledby="policy-history"><h2 id="policy-history">Policy and correction history</h2>
      {model === null ? <PlenumLoader label="Loading policy history" /> : <div className="history-columns">
        <div><h3>Retention policies</h3>{model.retentionPolicies.length === 0 ? <p className="empty-state">No retention policies recorded.</p> : <ul className="administration-list compact">{model.retentionPolicies.map((policy) => <li key={policy.id}><strong>{policy.key} v{policy.version}</strong><span>{policy.scopeType} · {policy.periodDays} days · {policy.expiryAction}</span></li>)}</ul>}</div>
        <div><h3>Legal holds</h3>{model.legalHolds.length === 0 ? <p className="empty-state">No legal holds recorded.</p> : <ul className="administration-list compact">{model.legalHolds.map((hold) => <li key={hold.holdId}><strong>{hold.releasedAt === null ? "Active" : "Released"} · {hold.scopeType}</strong><span>{hold.reason}</span>{hold.releasedAt === null ? <button className="btn-secondary" type="button" disabled={pending} onClick={() => void mutate(`/v1/retention/legal-holds/${hold.holdId}/release`, { reason: "Authorized legal hold release" }, "Legal hold released with preserved history.")}>Release hold</button> : null}</li>)}</ul>}</div>
        <div><h3>Corrections</h3>{model.corrections.length === 0 ? <p className="empty-state">No corrections recorded.</p> : <ul className="administration-list compact">{model.corrections.map((item) => <li key={item.id}><strong>{item.targetReference}</strong><span>{item.reason}</span></li>)}</ul>}</div>
      </div>}
    </section>
  </section>;
}

function IdentityProviderWorkspace({ setNotice }: { setNotice(message: string): void }) {
  const [model, setModel] = useState<{ identityProviders: OrganizationIdentityProviderV1[] } | null>(null);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => setModel(await request<{ identityProviders: OrganizationIdentityProviderV1[] }>("/v1/admin/identity-providers")), []);
  useEffect(() => { void load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Identity providers did not load.")); }, [load, setNotice]);
  const testProvider = async (providerId: string) => {
    setPending(true); setNotice("Opening the staged provider for a real test sign-in.");
    try {
      const result = await request<{ authorizationUrl: string }>(`/v1/admin/identity-providers/${providerId}/test`, { method: "POST", body: "{}" });
      window.location.assign(result.authorizationUrl);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Test sign-in could not start."); setPending(false); }
  };
  const approve = async (event: FormEvent<HTMLFormElement>, providerId: string) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true);
    try {
      setModel(await request<{ identityProviders: OrganizationIdentityProviderV1[] }>(`/v1/admin/identity-providers/${providerId}/approve`,
        { method: "POST", body: JSON.stringify({ reason: String(data.get("reason")) }) }));
      setNotice("Provider revision approved. A Platform Administrator can now activate it.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Provider approval failed."); }
    finally { setPending(false); }
  };
  return <section className="administration-workspace identity-provider-workspace" aria-labelledby="identity-provider-title">
    <div className="workspace-heading"><h1 id="identity-provider-title">Organization identity provider</h1>
      <p>Test the exact staged sign-in path, then approve only the revision that returns your verified Organization email.</p></div>
    {model === null ? <PlenumLoader label="Loading identity providers" /> : model.identityProviders.length === 0 ?
      <p className="empty-state">No provider revision is awaiting Organization review. Ask a Platform Administrator to stage one against a verified domain.</p> :
      <ol className="platform-provider-list">{model.identityProviders.map((provider) => <li className="platform-provider-row" key={provider.id}>
        <div className="platform-provider-summary"><div><strong>{provider.displayName}</strong><span className={`badge platform-status platform-status-${provider.status}`}>{provider.status.replaceAll("_", " ")}</span></div>
          <span>{provider.protocol === "saml" ? "SAML through the approved OIDC broker" : "OpenID Connect"} · revision {provider.version}</span><span>{provider.domains.join(", ")}</span></div>
        <dl className="platform-provider-facts"><div><dt>Preflight</dt><dd>{provider.preflightedAt === null ? "Not passed" : "Passed"}</dd></div>
          <div><dt>Test sign-in</dt><dd>{provider.testedAt === null ? "Required" : "Passed"}</dd></div><div><dt>Approval</dt><dd>{provider.approvedAt === null ? "Required" : "Recorded"}</dd></div></dl>
        {provider.status === "preflight_passed" ? <button className="btn-primary" type="button" disabled={pending} onClick={() => void testProvider(provider.id)}>Test sign-in</button> :
          provider.status === "tested" ? <form className="platform-provider-action" onSubmit={(event) => void approve(event, provider.id)}>
            <div className="field"><label htmlFor={`identity-approval-${provider.id}`}>Approval reason</label><input id={`identity-approval-${provider.id}`} name="reason" required minLength={3} maxLength={1000} /></div>
            <button className="btn-primary" type="submit" disabled={pending}>Approve revision</button></form> :
            <p className="platform-row-prerequisite">{provider.status === "draft" ? "Platform preflight must pass before test sign-in." :
              provider.status === "approved" ? "Awaiting Platform Administrator activation." : provider.status === "active" ? "This is the current Organization sign-in provider." : "This historical revision remains available for governed rollback."}</p>}
      </li>)}</ol>}
    <p className="field-hint">Approval requires recent multifactor authentication. Platform recovery access is managed separately and cannot be replaced here.</p>
  </section>;
}

function DeploymentWorkspace() {
  return <section className="administration-workspace" aria-labelledby="deployment-title"><div className="workspace-heading">
    <h1 id="deployment-title">Deployment posture</h1>
    <p>Organization authority is reachable. Backup, restore, offline-bundle, and adapter health remain separately verified operational controls.</p></div>
    <dl className="card provenance-grid"><div><dt>Authority boundary</dt><dd>Server-authoritative and Organization-scoped</dd></div>
      <div><dt>Plugin execution</dt><dd>Digest-pinned with staged Effect Proposals</dd></div><div><dt>Recovery posture</dt><dd>Compensating records preserve evidence history</dd></div>
      <div><dt>Current client state</dt><dd>Connected to the authenticated deployment</dd></div></dl></section>;
}

export function AdministrationPortal({ organizationId, roles }: { organizationId: string; roles: string[] }) {
  const [notice, setNotice] = useState("Administration state is current.");
  const destination = window.location.pathname.split("/").filter(Boolean).at(1) ?? "members";
  const admin = roles.includes("admin");
  const publisher = roles.includes("publisher");
  const allowed = destination === "plugins" ? admin || publisher : admin;
  return <div className="administration-shell">
    <AdministrationNavigation admin={admin} />
    <div className="administration-main"><p className="live-region administration-notice" role="status" aria-live="polite" aria-atomic="true">{notice}</p>
      {!allowed ? <section className="card portal-state teludens-state" data-state="unauthorized">
        <h1>Administration access unavailable</h1><p>Your current Organization Role does not authorize this workspace. Protected administration data was not loaded.</p></section> :
        destination === "members" ? <WorkforceWorkspace setNotice={setNotice} /> : destination === "plugins" ? <PluginsWorkspace organizationId={organizationId} setNotice={setNotice} /> :
          destination === "data-policy" ? <DataPolicyWorkspace organizationId={organizationId} setNotice={setNotice} /> :
            destination === "identity" ? <IdentityProviderWorkspace setNotice={setNotice} /> : <DeploymentWorkspace />}
    </div>
  </div>;
}
