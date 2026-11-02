import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ErrorEnvelopeV1, JsonObject } from "@plenum/event-contracts";

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

type MemberAdministration = {
  roles: OrganizationRole[];
  members: Array<{ personId: string; displayName: string; roles: OrganizationRole[]; revision: string }>;
};

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
    <p className="eyebrow">Organization control plane</p><h2>Administration</h2>
    <ul>
      {admin ? <li><a href="/admin/members">Members and roles</a></li> : null}
      <li><a href="/admin/plugins">Plugin operations</a></li>
      {admin ? <><li><a href="/admin/deployment">Deployment posture</a></li><li><a href="/admin/data-policy">Data policy</a></li></> : null}
    </ul>
  </nav>;
}

function MembersWorkspace({ setNotice }: { setNotice(message: string): void }) {
  const [model, setModel] = useState<MemberAdministration | null>(null);
  const [pendingPerson, setPendingPerson] = useState<string | null>(null);
  const load = useCallback(async () => setModel(await request<MemberAdministration>("/v1/operations/members")), []);
  useEffect(() => { void load().catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Members did not load.")); }, [load, setNotice]);
  const save = async (event: FormEvent<HTMLFormElement>, personId: string, expectedRevision: string) => {
    event.preventDefault(); setPendingPerson(personId); setNotice("Saving the current Organization Role set.");
    try {
      const roles = new FormData(event.currentTarget).getAll("roles").map(String) as OrganizationRole[];
      await request(`/v1/operations/members/${personId}/roles`, { method: "PUT",
        body: JSON.stringify({ roles, expectedRevision }) });
      await load(); setNotice("Organization Roles updated and recorded in the Audit Log.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Organization Roles were not changed."); }
    finally { setPendingPerson(null); }
  };
  return <section className="administration-workspace" aria-labelledby="members-title">
    <div className="workspace-heading"><p className="eyebrow">Least privilege</p><h1 id="members-title">Members and Organization Roles</h1>
      <p>Role changes take effect at the trusted server boundary. Plenum prevents removal of the final Admin.</p></div>
    {model === null ? <p aria-busy="true">Loading Organization members.</p> : <ul className="administration-list">
      {model.members.map((member) => <li key={member.personId} className="card administration-record">
        <div><h2>{member.displayName}</h2><p className="hint">Current: {member.roles.map((role) => roleLabels[role]).join(", ")}</p></div>
        <form onSubmit={(event) => void save(event, member.personId, member.revision)}>
          <fieldset><legend>Organization Roles</legend><div className="role-checkboxes">
            {model.roles.map((role) => <label className="choice" key={role}><input type="checkbox" name="roles" value={role}
              defaultChecked={member.roles.includes(role)} />{roleLabels[role]}</label>)}
          </div></fieldset><button className="btn-secondary" type="submit" disabled={pendingPerson !== null}>
            {pendingPerson === member.personId ? "Saving…" : "Save role assignment"}</button>
        </form>
      </li>)}
    </ul>}
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
    <div className="workspace-heading"><p className="eyebrow">Extension Framework</p><h1 id="plugins-title">Plugin operations</h1>
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
    {model === null ? <p aria-busy="true">Loading Plugin provenance.</p> : model.artifacts.length === 0 ? <p className="empty-state">No Plugin Artifacts have been submitted.</p> :
      <ul className="administration-list">{model.artifacts.map((artifact) => <li className="card administration-record" key={artifact.artifactId}>
        <div className="card-heading"><div><h2>{artifact.pluginId} {artifact.version}</h2><p>{artifact.publisherName}</p></div>
          <span className="badge badge-state">{artifact.lifecycleStatus.replaceAll("_", " ")}</span></div>
        <dl className="provenance-grid"><div><dt>Artifact digest</dt><dd><code>{artifact.digest}</code></dd></div>
          <div><dt>Bundle digest</dt><dd><code>{artifact.bundleDigest}</code></dd></div>
          <div><dt>Submitted</dt><dd>{new Date(artifact.submittedAt).toLocaleString()}</dd></div>
          <div><dt>Usage</dt><dd>{artifact.installationCount} installations · {artifact.bindingCount} bindings</dd></div></dl>
        <details><summary>Supply-chain provenance</summary><pre className="json-inspector">{JSON.stringify(artifact.supplyChain, null, 2)}</pre></details>
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

function parseJson(value: FormDataEntryValue | null, label: string): JsonObject | string | number | boolean | null {
  try { return JSON.parse(String(value ?? "")) as JsonObject | string | number | boolean | null; }
  catch { throw new Error(`${label} must be valid JSON.`); }
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
    try { void mutate("/v1/reporting/corrections", { targetReference: String(data.get("targetReference")),
      originalValue: parseJson(data.get("originalValue"), "Original value"), correctedValue: parseJson(data.get("correctedValue"), "Corrected value"),
      reason: String(data.get("reason")), reportsMustRegenerate: data.get("reportsMustRegenerate") === "on" },
    "Correction recorded without overwriting the original value."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "The correction is invalid."); }
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
    <div className="workspace-heading"><p className="eyebrow">Governed information lifecycle</p><h1 id="policy-title">Data policy</h1>
      <p>Retention, legal hold, corrections, and portable archives are recorded at the Organization boundary.</p></div>
    <div className="workspace-split">
      <div><section className="card operation-form"><h2>Retention policy</h2><form onSubmit={createPolicy}>
        <div className="field"><label htmlFor="policy-key">Policy key</label><input id="policy-key" name="policyKey" required maxLength={100} /></div>
        <div className="field"><label htmlFor="policy-version">Version</label><input id="policy-version" name="version" type="number" min="1" defaultValue="1" required /></div>
        <div className="field"><label htmlFor="policy-scope">Scope</label><select id="policy-scope" name="scopeType" defaultValue="organization"><option value="organization">Organization</option><option value="session">Session</option><option value="export">Export</option><option value="project">Project</option></select></div>
        <div className="field"><label htmlFor="policy-reference">Scope reference</label><input id="policy-reference" name="scopeReference" defaultValue={organizationId} required /></div>
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
        <div className="field"><label htmlFor="correction-original">Original value (JSON)</label><textarea id="correction-original" name="originalValue" defaultValue='{"value":"original"}' required /></div>
        <div className="field"><label htmlFor="correction-value">Corrected value (JSON)</label><textarea id="correction-value" name="correctedValue" defaultValue='{"value":"corrected"}' required /></div>
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
      {model === null ? <p aria-busy="true">Loading policy history.</p> : <div className="history-columns">
        <div><h3>Retention policies</h3>{model.retentionPolicies.length === 0 ? <p className="empty-state">No retention policies recorded.</p> : <ul className="administration-list compact">{model.retentionPolicies.map((policy) => <li key={policy.id}><strong>{policy.key} v{policy.version}</strong><span>{policy.scopeType} · {policy.periodDays} days · {policy.expiryAction}</span></li>)}</ul>}</div>
        <div><h3>Legal holds</h3>{model.legalHolds.length === 0 ? <p className="empty-state">No legal holds recorded.</p> : <ul className="administration-list compact">{model.legalHolds.map((hold) => <li key={hold.holdId}><strong>{hold.releasedAt === null ? "Active" : "Released"} · {hold.scopeType}</strong><span>{hold.reason}</span>{hold.releasedAt === null ? <button className="btn-secondary" type="button" disabled={pending} onClick={() => void mutate(`/v1/retention/legal-holds/${hold.holdId}/release`, { reason: "Authorized legal hold release" }, "Legal hold released with preserved history.")}>Release hold</button> : null}</li>)}</ul>}</div>
        <div><h3>Corrections</h3>{model.corrections.length === 0 ? <p className="empty-state">No corrections recorded.</p> : <ul className="administration-list compact">{model.corrections.map((item) => <li key={item.id}><strong>{item.targetReference}</strong><span>{item.reason}</span></li>)}</ul>}</div>
      </div>}
    </section>
  </section>;
}

function DeploymentWorkspace() {
  return <section className="administration-workspace" aria-labelledby="deployment-title"><div className="workspace-heading">
    <p className="eyebrow">Operational posture</p><h1 id="deployment-title">Deployment posture</h1>
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
      {!allowed ? <section className="card portal-state teludens-state" data-state="unauthorized"><p className="eyebrow">Least privilege</p>
        <h1>Administration access unavailable</h1><p>Your current Organization Role does not authorize this workspace. Protected administration data was not loaded.</p></section> :
        destination === "members" ? <MembersWorkspace setNotice={setNotice} /> : destination === "plugins" ? <PluginsWorkspace organizationId={organizationId} setNotice={setNotice} /> :
          destination === "data-policy" ? <DataPolicyWorkspace organizationId={organizationId} setNotice={setNotice} /> : <DeploymentWorkspace />}
    </div>
  </div>;
}
