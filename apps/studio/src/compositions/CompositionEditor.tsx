import { displayStatus } from "../../../../packages/design-system/src/presentation.mjs";
import { useState } from "react";
import {
  COMPOSITION_DEFINITION_CONTRACT_ID,
  type CompositionDataTypeV1,
  type CompositionNodeV1,
  type CompositionPortV1,
  type CoreDesignV1,
  type ModelCompositionV1,
  type PluginBindingV1
} from "@plenum/simulation-schema";

import { StudioCollaborationClient } from "../collaboration/client.js";
import { AddButton, CheckField, ItemActions, MultiCheck, SelectField, TextField, Workspace } from "../core-design/Editor.js";
import { coreArray, identifier } from "../core-design/model.js";

const dataTypes: CompositionDataTypeV1[] = ["boolean", "integer", "number", "string", "object", "array", "effect_proposal"];
const classifications: CompositionPortV1["classification"][] = ["public", "internal", "confidential", "restricted"];
const classificationRank = { public: 0, internal: 1, confidential: 2, restricted: 3 } as const;

function port(label: string, dataType: CompositionDataTypeV1 = "number", required = false): CompositionPortV1 {
  return { id: identifier(), label, dataType, unit: dataType === "number" ? "unitless" : "",
    classification: "internal", required, ...(dataType === "effect_proposal" ? { carriesEffectProposals: true } : {}) };
}

function fixtureValue(dataType: CompositionDataTypeV1): unknown {
  if (dataType === "boolean") return true;
  if (dataType === "number" || dataType === "integer") return 1;
  if (dataType === "string") return "fixture";
  if (dataType === "array") return [];
  return {};
}

function modelNode(binding: PluginBindingV1): CompositionNodeV1 {
  return { id: identifier(), name: `${displayStatus(binding.pluginId.replaceAll(".", " "))} ${binding.pluginVersion}`, kind: "model", bindingId: binding.id,
    inputPorts: structuredClone(binding.inputPorts ?? []), outputPorts: structuredClone(binding.outputPorts ?? []) };
}

function utilityNode(kind: CompositionNodeV1["kind"], roles: CoreDesignV1["sessionRoles"]): CompositionNodeV1 {
  if (kind === "approval_gate") {
    const input = port("Effect Proposals", "effect_proposal", true);
    return { id: identifier(), name: "Mandatory approval", kind, approverSessionRoleIds: roles?.slice(0, 1).map(({ id }) => id) ?? [],
      inputPorts: [input], outputPorts: [{ ...input, id: identifier(), required: false }] };
  }
  if (kind === "output") return { id: identifier(), name: "Composition output", kind, inputPorts: [port("Approved Effect Proposals", "effect_proposal", true)], outputPorts: [] };
  if (kind === "join") return { id: identifier(), name: "Parallel join", kind, joinPolicy: "all_required",
    inputPorts: [port("Results", "number", true)], outputPorts: [port("Joined result")] };
  if (kind === "fan_out") return { id: identifier(), name: "Fan-out", kind, inputPorts: [port("Input", "number", true)], outputPorts: [port("Branch A"), port("Branch B")] };
  return { id: identifier(), name: "Allowlisted transform", kind: "transform", transform: "identity",
    inputPorts: [port("Input", "number", true)], outputPorts: [port("Output")] };
}

function initialComposition(): ModelCompositionV1 {
  return { contractId: COMPOSITION_DEFINITION_CONTRACT_ID, id: identifier(), name: "New Model Composition", version: "1",
    nodes: [], edges: [], fixtures: [{ id: identifier(), name: "Synthetic routing fixture", modelOutputs: {} }] };
}

function reaches(composition: ModelCompositionV1, start: string, target: string): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of composition.edges) outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  const seen = new Set<string>();
  const visit = (id: string): boolean => id === target || (!seen.has(id) && (seen.add(id), (outgoing.get(id) ?? []).some(visit)));
  return visit(start);
}

function compatible(source: CompositionPortV1, target: CompositionPortV1): boolean {
  return source.dataType === target.dataType && source.unit === target.unit &&
    classificationRank[source.classification] <= classificationRank[target.classification];
}

function NodePortEditor({ compositionIndex, node, nodeIndex, direction, client }: {
  compositionIndex: number; node: CompositionNodeV1; nodeIndex: number; direction: "inputPorts" | "outputPorts"; client: StudioCollaborationClient;
}) {
  const ports = node[direction];
  return <fieldset className="port-editor"><legend>{direction === "inputPorts" ? "Input" : "Output"} ports</legend>
    {ports.map((item, index) => <div className="port-row compact-grid" key={item.id}>
      <TextField id={`node-port-label-${item.id}`} label="Label" value={item.label} path={["coreDesign", "compositions", compositionIndex, "nodes", nodeIndex, direction, index, "label"]} client={client} />
      <SelectField id={`node-port-type-${item.id}`} label="Type" value={item.dataType} options={dataTypes.map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "compositions", compositionIndex, "nodes", nodeIndex, direction, index, "dataType"]} client={client} />
      <TextField id={`node-port-unit-${item.id}`} label="Unit" value={item.unit} path={["coreDesign", "compositions", compositionIndex, "nodes", nodeIndex, direction, index, "unit"]} client={client} />
      <SelectField id={`node-port-classification-${item.id}`} label="Classification" value={item.classification} options={classifications.map((value) => ({ value, label: displayStatus(value) }))} path={["coreDesign", "compositions", compositionIndex, "nodes", nodeIndex, direction, index, "classification"]} client={client} />
      <CheckField id={`node-port-required-${item.id}`} label="Required" checked={item.required} path={["coreDesign", "compositions", compositionIndex, "nodes", nodeIndex, direction, index, "required"]} client={client} />
    </div>)}
  </fieldset>;
}

function EdgeBuilder({ composition, compositionIndex, client }: { composition: ModelCompositionV1; compositionIndex: number; client: StudioCollaborationClient }) {
  const sources = composition.nodes.flatMap((node) => node.outputPorts.map((item) => ({ node, port: item, key: `${node.id}:${item.id}` })));
  const [sourceKey, setSourceKey] = useState(sources[0]?.key ?? "");
  const source = sources.find(({ key }) => key === sourceKey) ?? sources[0];
  const targets = source === undefined ? [] : composition.nodes.flatMap((node) => node.inputPorts
    .filter((item) => node.id !== source.node.id && compatible(source.port, item) && !reaches(composition, node.id, source.node.id) &&
      !composition.edges.some((edge) => edge.fromNodeId === source.node.id && edge.fromPortId === source.port.id && edge.toNodeId === node.id && edge.toPortId === item.id) &&
      (node.kind === "join" || !composition.edges.some((edge) => edge.toNodeId === node.id && edge.toPortId === item.id)))
    .map((item) => ({ node, port: item, key: `${node.id}:${item.id}` })));
  const [targetKey, setTargetKey] = useState("");
  const target = targets.find(({ key }) => key === targetKey) ?? targets[0];
  return <fieldset className="edge-builder"><legend>Connect typed ports</legend>
    <label>Output port<select value={source?.key ?? ""} onChange={(event) => { setSourceKey(event.target.value); setTargetKey(""); }}>{sources.map(({ node, port: item, key }) => <option value={key} key={key}>{node.name}: {item.label} · {item.dataType.replaceAll("_", " ")} · {item.unit || "unitless"} · {item.classification}</option>)}</select></label>
    <label>Compatible input port<select value={target?.key ?? ""} onChange={(event) => setTargetKey(event.target.value)}>{targets.map(({ node, port: item, key }) => <option value={key} key={key}>{node.name}: {item.label} · ceiling {item.classification}</option>)}</select></label>
    <AddButton label="Connect ports" disabled={source === undefined || target === undefined} onClick={() => {
      if (source === undefined || target === undefined) return;
      client.appendAtPath(["coreDesign", "compositions", compositionIndex, "edges"], { id: identifier(), fromNodeId: source.node.id,
        fromPortId: source.port.id, toNodeId: target.node.id, toPortId: target.port.id });
    }} />
    <p className="hint">Only type-, unit-, classification-, and cycle-safe targets are selectable.</p>
  </fieldset>;
}

function CompositionItem({ projectId, composition, index, count, bindings, roles, client }: {
  projectId: string; composition: ModelCompositionV1; index: number; count: number; bindings: PluginBindingV1[];
  roles: NonNullable<CoreDesignV1["sessionRoles"]>; client: StudioCollaborationClient;
}) {
  const [selectedBinding, setSelectedBinding] = useState(bindings[0]?.id ?? "");
  const [preview, setPreview] = useState<{ status?: string; stateChanges?: unknown[]; nodes?: Array<{ nodeId: string; status: string; message: string }> } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fixture = composition.fixtures[0];
  async function runFixture(): Promise<void> {
    if (fixture === undefined) return;
    setMessage("Running the server-validated fixture preview.");
    try {
      const response = await fetch(`/v1/projects/${projectId}/compositions/validate`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ compositionId: composition.id, fixtureId: fixture.id }) });
      const body = await response.json() as { preview?: typeof preview; error?: { message?: string } };
      if (!response.ok || body.preview === undefined) throw new Error(body.error?.message ?? "Fixture preview failed.");
      setPreview(body.preview); setMessage(`Fixture preview ${body.preview?.status}. No Session state changes were requested.`);
    } catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : "Fixture preview failed."); }
  }
  function addModel(): void {
    const binding = bindings.find(({ id }) => id === selectedBinding);
    if (binding === undefined) return;
    const node = modelNode(binding);
    client.transact(() => {
      client.appendAtPath(["coreDesign", "compositions", index, "nodes"], node);
      composition.fixtures.forEach((item, fixtureIndex) => client.setAtPath(["coreDesign", "compositions", index, "fixtures", fixtureIndex, "modelOutputs", node.id],
        Object.fromEntries(node.outputPorts.map((output) => [output.id, fixtureValue(output.dataType)]))));
    });
  }
  function removeNode(nodeIndex: number): void {
    const nodeId = composition.nodes[nodeIndex]?.id;
    if (nodeId === undefined) return;
    client.transact(() => {
      composition.edges.map((edge, edgeIndex) => ({ edge, edgeIndex }))
        .filter(({ edge }) => edge.fromNodeId === nodeId || edge.toNodeId === nodeId)
        .reverse().forEach(({ edgeIndex }) => client.removeAtPath(["coreDesign", "compositions", index, "edges"], edgeIndex));
      client.removeAtPath(["coreDesign", "compositions", index, "nodes"], nodeIndex);
    });
  }
  return <details className="editor-item" id={`compositions-${composition.id}`} open><summary><span>{composition.name}</span></summary><details className="technical-details"><summary>Technical reference</summary><code>{composition.id}</code></details><div className="item-body">
    <div className="grid-fields"><TextField id={`composition-name-${composition.id}`} label="Composition name" value={composition.name} path={["coreDesign", "compositions", index, "name"]} client={client} />
      <TextField id={`composition-version-${composition.id}`} label="Version" value={composition.version} path={["coreDesign", "compositions", index, "version"]} client={client} /></div>
    <div className="node-toolbar"><label>Approved Plugin Binding<select value={selectedBinding} onChange={(event) => setSelectedBinding(event.target.value)}>{bindings.map((binding) => <option key={binding.id} value={binding.id}>{displayStatus(binding.pluginId.replaceAll(".", " "))} {binding.pluginVersion}</option>)}</select></label>
      <AddButton label="Add model node" disabled={bindings.length === 0} onClick={addModel} />
      {(["transform", "fan_out", "join", "approval_gate", "output"] as const).map((kind) => <AddButton key={kind} label={`Add ${kind.replaceAll("_", " ")}`} onClick={() => client.appendAtPath(["coreDesign", "compositions", index, "nodes"], utilityNode(kind, roles))} />)}</div>
    <div className="composition-nodes">{composition.nodes.map((node, nodeIndex) => <article className="composition-node" key={node.id}><div className="card-heading"><h3>{node.name}</h3><span className="badge badge-info">{node.kind.replaceAll("_", " ")}</span></div>
      <TextField id={`composition-node-name-${node.id}`} label="Node name" value={node.name} path={["coreDesign", "compositions", index, "nodes", nodeIndex, "name"]} client={client} />
      {node.kind === "approval_gate" ? <MultiCheck legend="Authorized approver Session Roles" values={node.approverSessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "compositions", index, "nodes", nodeIndex, "approverSessionRoleIds"]} client={client} /> : null}
      {node.kind === "join" ? <SelectField id={`join-policy-${node.id}`} label="Partial failure policy" value={node.joinPolicy ?? "all_required"} options={[{ value: "all_required", label: "Fail unless all branches complete" }, { value: "allow_partial", label: "Continue with explicit partial result" }]} path={["coreDesign", "compositions", index, "nodes", nodeIndex, "joinPolicy"]} client={client} /> : null}
      <NodePortEditor compositionIndex={index} node={node} nodeIndex={nodeIndex} direction="inputPorts" client={client} /><NodePortEditor compositionIndex={index} node={node} nodeIndex={nodeIndex} direction="outputPorts" client={client} />
      <button className="btn-danger compact" type="button" onClick={() => removeNode(nodeIndex)}>Remove node</button>
    </article>)}</div>
    <EdgeBuilder composition={composition} compositionIndex={index} client={client} />
    <h3>Edges</h3>{composition.edges.length === 0 ? <p>No typed connections yet.</p> : <ul className="edge-list">{composition.edges.map((edge, edgeIndex) => <li key={edge.id}><code>{edge.fromNodeId}.{edge.fromPortId}</code> → <code>{edge.toNodeId}.{edge.toPortId}</code><button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "compositions", index, "edges"], edgeIndex)}>Remove</button></li>)}</ul>}
    <section className="fixture-preview" aria-labelledby={`fixture-${composition.id}`}><h3 id={`fixture-${composition.id}`}>Fixture run</h3><p>Uses synthetic declared model outputs to test routing, joins, failure handling, and approval paths. It cannot mutate Session state.</p>
      <button className="btn-primary" type="button" disabled={fixture === undefined} onClick={() => void runFixture()}>Run fixture without state change</button><p aria-live="polite">{message}</p>
      {preview === null ? null : <div><p><strong>Status: {displayStatus(preview.status)}</strong> · State changes: {preview.stateChanges?.length ?? 0}</p><ol>{preview.nodes?.map((node) => <li key={node.nodeId}>{node.nodeId}: {displayStatus(node.status)}. {node.message}</li>)}</ol></div>}
    </section>
    <ItemActions path={["coreDesign", "compositions"]} index={index} count={count} client={client} label={composition.name} />
  </div></details>;
}

export function CompositionEditor({ projectId, core, client }: { projectId: string; core: CoreDesignV1; client: StudioCollaborationClient }) {
  const compositions = coreArray(core, "compositions");
  const bindings = coreArray(core, "pluginBindings");
  const roles = coreArray(core, "sessionRoles");
  return <Workspace id="compositions" title="Model Compositions" intro="Build typed sequential and parallel graphs. Script nodes and feedback cycles are unavailable; every Effect Proposal path requires an approval gate.">
    {bindings.length < 2 ? <p className="status-panel status-warning">Bind at least two approved model Plugins before building the two-model proof.</p> : null}
    <div className="editor-list">{compositions.map((composition, index) => <CompositionItem key={composition.id} projectId={projectId} composition={composition} index={index} count={compositions.length} bindings={bindings} roles={roles} client={client} />)}</div>
    <AddButton label="Add Model Composition" onClick={() => client.appendAtPath(["coreDesign", "compositions"], initialComposition())} />
  </Workspace>;
}
