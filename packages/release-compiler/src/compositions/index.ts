import { createHash } from "node:crypto";

import { canonicalizeJson, type JsonValue } from "@plenum/event-contracts";
import {
  assertModelComposition,
  type CompositionFixtureV1,
  type ModelCompositionV1,
  type PluginBindingV1
} from "@plenum/simulation-schema";

export interface CompositionPreviewV1 {
  status: "completed" | "partial" | "failed";
  stateChanges: [];
  nodes: Array<{
    nodeId: string;
    status: "completed" | "partial" | "failed";
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    message: string;
  }>;
}

function sha256(value: JsonValue): string {
  return `sha256:${createHash("sha256").update(canonicalizeJson(value)).digest("hex")}`;
}

export function compileModelComposition(
  composition: ModelCompositionV1,
  bindings: readonly PluginBindingV1[],
  sessionRoleIds: ReadonlySet<string> = new Set()
): ModelCompositionV1 {
  assertModelComposition(composition, bindings, sessionRoleIds);
  const bindingById = new Map(bindings.map((binding) => [binding.id, binding]));
  const used = new Map<string, { pluginId: string; version: string; digest: string }>();
  for (const node of composition.nodes) {
    if (node.bindingId === undefined) continue;
    const binding = bindingById.get(node.bindingId)!;
    used.set(binding.pluginDigest, { pluginId: binding.pluginId, version: binding.pluginVersion, digest: binding.pluginDigest });
    for (const dependency of binding.dependencies ?? []) used.set(dependency.digest, dependency);
  }
  const dependencyClosure = [...used.values()].sort((left, right) => left.digest.localeCompare(right.digest));
  const { graphDigest: _oldDigest, dependencyClosure: _oldClosure, ...graph } = composition;
  return { ...structuredClone(graph), graphDigest: sha256(graph as unknown as JsonValue), dependencyClosure };
}

export function previewCompositionFixture(
  composition: ModelCompositionV1,
  bindings: readonly PluginBindingV1[],
  fixture: CompositionFixtureV1
): CompositionPreviewV1 {
  assertModelComposition(composition, bindings);
  const nodes = new Map(composition.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, typeof composition.edges>();
  for (const edge of composition.edges) incoming.set(edge.toNodeId, [...(incoming.get(edge.toNodeId) ?? []), edge]);
  const remaining = new Set(composition.nodes.map(({ id }) => id));
  const results = new Map<string, CompositionPreviewV1["nodes"][number]>();
  const failing = new Set(fixture.failingNodeIds ?? []);
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => (incoming.get(id) ?? []).every((edge) => results.has(edge.fromNodeId))).sort();
    if (ready.length === 0) throw new Error(`Model Composition ${composition.id} preview could not resolve its graph order`);
    for (const id of ready) {
      remaining.delete(id);
      const node = nodes.get(id)!;
      const sourceResults = (incoming.get(id) ?? []).map((edge) => ({ edge, result: results.get(edge.fromNodeId)! }));
      const inputs = Object.fromEntries(sourceResults
        .filter(({ result }) => result.status !== "failed")
        .map(({ edge, result }) => [edge.toPortId, structuredClone(result.outputs[edge.fromPortId]) ]));
      const failedUpstream = sourceResults.some(({ result }) => result.status === "failed");
      if (failing.has(id) || (failedUpstream && !(node.kind === "join" && node.joinPolicy === "allow_partial"))) {
        results.set(id, { nodeId: id, status: "failed", inputs, outputs: {},
          message: failing.has(id) ? "Fixture requested a visible node failure." : "An upstream node failed." });
        continue;
      }
      const fixtureOutputs = fixture.modelOutputs[id];
      const firstInput = Object.values(inputs)[0];
      const outputs = node.kind === "model"
        ? structuredClone(fixtureOutputs ?? {})
        : Object.fromEntries(node.outputPorts.map((port) => [port.id,
          structuredClone(Object.hasOwn(inputs, port.id) ? inputs[port.id] : firstInput)]));
      const partial = failedUpstream && node.kind === "join" && node.joinPolicy === "allow_partial";
      results.set(id, { nodeId: id, status: partial ? "partial" : "completed", inputs, outputs,
        message: partial ? "Joined the available fixture outputs; missing branches remain explicit." : "Fixture routing completed." });
    }
  }
  const ordered = composition.nodes.map(({ id }) => results.get(id)!);
  const failed = ordered.some(({ status }) => status === "failed");
  const partial = ordered.some(({ status }) => status === "partial");
  return { status: partial || (failed && ordered.some(({ status }) => status === "completed")) ? "partial" : failed ? "failed" : "completed",
    stateChanges: [], nodes: ordered };
}
