import { useEffect, useMemo, useState } from "react";
import { canonicalizeJson, type JsonValue } from "@plenum/event-contracts";
import {
  PLUGIN_BINDING_CONTRACT_ID,
  type CompositionDataTypeV1,
  type CompositionPortV1,
  type CoreDesignV1,
  type PluginBindingV1
} from "@plenum/simulation-schema";

import { StudioCollaborationClient } from "../collaboration/client.js";
import { AddButton, CheckField, ItemActions, SelectField, TextField, Workspace } from "../core-design/Editor.js";
import { coreArray, identifier } from "../core-design/model.js";

interface CatalogEntry {
  artifactId: string;
  pluginId: string;
  version: string;
  digest: string;
  lifecycleStatus: "approved";
  installationId: string;
  deploymentId: string;
  publisher: { id: string; name: string };
  permittedPermissions: string[];
  manifest: {
    categories?: string[];
    capabilities?: string[];
    connectivity?: PluginBindingV1["connectivity"];
    contracts?: { inputSchema?: string; outputSchema?: string };
    limits?: { timeoutSeconds?: number; memoryMiB?: number; cpuMillis?: number; outputBytes?: number };
    requestedPermissions?: string[];
    dataClassificationMaximum?: CompositionPortV1["classification"];
    dependencies?: Array<{ pluginId: string; version: string; digest: string }>;
  };
}

const emptyConfigurationDigest = "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a";
const dataTypes: CompositionDataTypeV1[] = ["boolean", "integer", "number", "string", "object", "array", "effect_proposal"];
const classifications: CompositionPortV1["classification"][] = ["public", "internal", "confidential", "restricted"];
const profiles: PluginBindingV1["enabledInProfiles"] = ["cloud", "institutional", "air_gapped"];
const prohibitedConfigurationKeys = new Set(["apikey", "authorization", "clientsecret", "credential", "credentials", "password", "privatekey", "secretkey", "secretref", "secretreference", "secrets", "token"]);

function hasSecretReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSecretReference);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(([key, child]) => prohibitedConfigurationKeys.has(key.replaceAll("_", "").replaceAll("-", "").toLowerCase()) || hasSecretReference(child));
}

async function digestConfiguration(configuration: Record<string, unknown>): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalizeJson(configuration as JsonValue)));
  return `sha256:${[...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function defaultPort(label: string, effect = false): CompositionPortV1 {
  return { id: identifier(), label, dataType: effect ? "effect_proposal" : "number", unit: effect ? "" : "unitless",
    classification: "internal", required: false, ...(effect ? { carriesEffectProposals: true } : {}) };
}

function ConfigurationEditor({ binding, index, client }: { binding: PluginBindingV1; index: number; client: StudioCollaborationClient }) {
  const [value, setValue] = useState(JSON.stringify(binding.configuration, null, 2));
  const [message, setMessage] = useState("Configuration is non-secret and stored in the Draft.");
  async function commit(): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Use a JSON object.");
      const configuration = parsed as Record<string, unknown>;
      if (hasSecretReference(configuration)) throw new Error("Secret values and references cannot be stored in a Draft.");
      const digest = await digestConfiguration(configuration);
      client.transact(() => {
        client.setAtPath(["coreDesign", "pluginBindings", index, "configuration"], configuration);
        client.setAtPath(["coreDesign", "pluginBindings", index, "configurationDigest"], digest);
      });
      setMessage("Configuration saved to the collaborative Draft.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Configuration is invalid.");
    }
  }
  return <div className="field"><label htmlFor={`binding-config-${binding.id}`}>Non-secret configuration JSON</label>
    <textarea id={`binding-config-${binding.id}`} rows={5} value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => void commit()} aria-describedby={`binding-config-help-${binding.id}`} />
    <span className="hint" id={`binding-config-help-${binding.id}`} aria-live="polite">{message} Secret references are prohibited from Drafts.</span></div>;
}

function PortEditor({ binding, bindingIndex, direction, client }: {
  binding: PluginBindingV1; bindingIndex: number; direction: "inputPorts" | "outputPorts"; client: StudioCollaborationClient;
}) {
  const ports = binding[direction] ?? [];
  const label = direction === "inputPorts" ? "Input" : "Output";
  return <fieldset className="port-editor"><legend>{label} ports</legend>
    {ports.map((port, portIndex) => <div className="port-row" key={port.id}>
      <TextField id={`${direction}-label-${port.id}`} label="Port label" value={port.label} path={["coreDesign", "pluginBindings", bindingIndex, direction, portIndex, "label"]} client={client} />
      <SelectField id={`${direction}-type-${port.id}`} label="Type" value={port.dataType} options={dataTypes.map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "pluginBindings", bindingIndex, direction, portIndex, "dataType"]} client={client} />
      <TextField id={`${direction}-unit-${port.id}`} label="Unit" value={port.unit} path={["coreDesign", "pluginBindings", bindingIndex, direction, portIndex, "unit"]} client={client} />
      <SelectField id={`${direction}-classification-${port.id}`} label="Classification ceiling" value={port.classification} options={classifications.map((value) => ({ value, label: value }))} path={["coreDesign", "pluginBindings", bindingIndex, direction, portIndex, "classification"]} client={client} />
      <CheckField id={`${direction}-required-${port.id}`} label="Required" checked={port.required} path={["coreDesign", "pluginBindings", bindingIndex, direction, portIndex, "required"]} client={client} />
      {direction === "outputPorts" ? <CheckField id={`${direction}-effect-${port.id}`} label="Carries Effect Proposals" checked={port.carriesEffectProposals === true} path={["coreDesign", "pluginBindings", bindingIndex, direction, portIndex, "carriesEffectProposals"]} client={client} /> : null}
      <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "pluginBindings", bindingIndex, direction], portIndex)}>Remove port</button>
    </div>)}
    <AddButton label={`Add ${label.toLowerCase()} port`} onClick={() => client.appendAtPath(["coreDesign", "pluginBindings", bindingIndex, direction], defaultPort(`${label} ${ports.length + 1}`))} />
  </fieldset>;
}

export function PluginCatalogEditor({ projectId, core, client }: { projectId: string; core: CoreDesignV1; client: StudioCollaborationClient }) {
  const bindings = coreArray(core, "pluginBindings");
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [message, setMessage] = useState("Loading the Organization Plugin catalog.");
  const [category, setCategory] = useState("all");
  const [connectivity, setConnectivity] = useState("all");
  useEffect(() => {
    let active = true;
    void fetch(`/v1/projects/${projectId}/plugin-catalog`).then(async (response) => {
      const body = await response.json() as { plugins?: CatalogEntry[]; error?: { message?: string } };
      if (!response.ok || !Array.isArray(body.plugins)) throw new Error(body.error?.message ?? "Plugin catalog could not be loaded.");
      if (active) { setCatalog(body.plugins); setMessage(`${body.plugins.length} approved installed Plugin${body.plugins.length === 1 ? "" : "s"} available.`); }
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Plugin catalog could not be loaded."); });
    return () => { active = false; };
  }, [projectId]);
  const categories = useMemo(() => [...new Set(catalog.flatMap(({ manifest }) => manifest.categories ?? []))].sort(), [catalog]);
  const visible = catalog.filter(({ manifest }) => (category === "all" || manifest.categories?.includes(category)) &&
    (connectivity === "all" || manifest.connectivity === connectivity));
  function bind(entry: CatalogEntry): void {
    const effect = entry.manifest.capabilities?.includes("propose_effect") === true;
    client.appendAtPath(["coreDesign", "pluginBindings"], {
      contractId: PLUGIN_BINDING_CONTRACT_ID, id: identifier(), pluginId: entry.pluginId, pluginVersion: entry.version,
      pluginDigest: entry.digest, installationId: entry.installationId, categories: entry.manifest.categories ?? [],
      connectivity: entry.manifest.connectivity ?? "offline_capable", configuration: {}, configurationDigest: emptyConfigurationDigest,
      inputMappings: [], timeoutSeconds: entry.manifest.limits?.timeoutSeconds ?? 30,
      enabledInProfiles: entry.manifest.connectivity === "offline_capable" ? ["cloud", "institutional", "air_gapped"] : ["cloud", "institutional"],
      requestedPermissions: entry.manifest.requestedPermissions ?? [], inputSchema: entry.manifest.contracts?.inputSchema ?? "unavailable",
      outputSchema: entry.manifest.contracts?.outputSchema ?? "unavailable", inputPorts: [],
      outputPorts: [defaultPort(effect ? "Effect Proposals" : "Result", effect)], dependencies: entry.manifest.dependencies ?? []
    } satisfies PluginBindingV1);
  }
  return <Workspace id="plugins" title="Plugin catalog & bindings" intro="Discover approved installed Plugins for this Organization. Drafts store only non-secret configuration and immutable digests.">
    <p aria-live="polite">{message}</p>
    <div className="catalog-filters">
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label>Connectivity<select value={connectivity} onChange={(event) => setConnectivity(event.target.value)}><option value="all">All connectivity</option>{["offline_capable", "lan_required", "external_required"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
    </div>
    <div className="plugin-catalog">{visible.length === 0 ? <p>No approved installed Plugins match these filters.</p> : visible.map((entry) => <article className="catalog-card" key={`${entry.installationId}:${entry.digest}`}>
      <h3>{entry.pluginId}</h3><p><strong>{entry.version}</strong> · {entry.publisher.name}</p>
      <dl><div><dt>Digest</dt><dd>{entry.digest}</dd></div><div><dt>Connectivity</dt><dd>{entry.manifest.connectivity ?? "not declared"}</dd></div>
        <div><dt>Classification ceiling</dt><dd>{entry.manifest.dataClassificationMaximum ?? "not declared"}</dd></div>
        <div><dt>Capabilities</dt><dd>{entry.manifest.capabilities?.join(", ") || "None declared"}</dd></div>
        <div><dt>Permissions</dt><dd>{entry.manifest.requestedPermissions?.join(", ") || "None"}</dd></div>
        <div><dt>Input schema</dt><dd>{entry.manifest.contracts?.inputSchema ?? "Unavailable"}</dd></div>
        <div><dt>Output schema</dt><dd>{entry.manifest.contracts?.outputSchema ?? "Unavailable"}</dd></div>
        <div><dt>Resource limits</dt><dd>{entry.manifest.limits === undefined ? "Unavailable" : `${entry.manifest.limits.timeoutSeconds}s, ${entry.manifest.limits.memoryMiB} MiB, ${entry.manifest.limits.cpuMillis} ms CPU, ${entry.manifest.limits.outputBytes} bytes output`}</dd></div></dl>
      <button className="btn-secondary" type="button" onClick={() => bind(entry)}>Bind installed Plugin</button>
    </article>)}</div>
    <h3>Binding inspector</h3>
    <div className="editor-list">{bindings.map((binding, index) => <details className="editor-item" id={`pluginBindings-${binding.id}`} key={binding.id}><summary><span>{binding.pluginId} {binding.pluginVersion}</span><span className="item-id">{binding.id}</span></summary><div className="item-body">
      <p className="digest-line">Pinned {binding.pluginDigest}</p><ConfigurationEditor binding={binding} index={index} client={client} />
      <TextField id={`binding-timeout-${binding.id}`} label="Timeout seconds" value={binding.timeoutSeconds} type="number" path={["coreDesign", "pluginBindings", index, "timeoutSeconds"]} client={client} />
      <fieldset className="choice-group"><legend>Enabled deployment profiles</legend>{profiles.map((profile) => <label className="choice" key={profile}><input type="checkbox" checked={binding.enabledInProfiles.includes(profile)} onChange={(event) => client.setAtPath(["coreDesign", "pluginBindings", index, "enabledInProfiles"], event.target.checked ? [...binding.enabledInProfiles, profile] : binding.enabledInProfiles.filter((value) => value !== profile))} />{profile.replaceAll("_", " ")}</label>)}</fieldset>
      {binding.connectivity === "external_required" ? <SelectField id={`binding-replacement-${binding.id}`} label="Air-gap local replacement" value={binding.localReplacementBindingId ?? ""} options={[{ value: "", label: "Select a verified local replacement" }, ...bindings.filter((candidate) => candidate.id !== binding.id && candidate.connectivity === "offline_capable").map((candidate) => ({ value: candidate.id, label: `${candidate.pluginId} ${candidate.pluginVersion}` }))]} path={["coreDesign", "pluginBindings", index, "localReplacementBindingId"]} client={client} emptyDeletes /> : null}
      <PortEditor binding={binding} bindingIndex={index} direction="inputPorts" client={client} /><PortEditor binding={binding} bindingIndex={index} direction="outputPorts" client={client} />
      <ItemActions path={["coreDesign", "pluginBindings"]} index={index} count={bindings.length} client={client} label={`${binding.pluginId} binding`} />
    </div></details>)}</div>
  </Workspace>;
}
