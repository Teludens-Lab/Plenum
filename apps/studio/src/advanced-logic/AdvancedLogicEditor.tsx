import type { CoreDesignV1, GateV1, ScenarioV1, StateVariableDefinitionV1 } from "@plenum/simulation-schema";

import type { StudioCollaborationClient } from "../collaboration/client.js";
import { identifier } from "../core-design/model.js";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

const numericOperators = ["greater_than", "greater_or_equal", "less_than", "less_or_equal", "equals"] as const;

function simpleGate(variableId: string, operator = "greater_or_equal", value = 0): GateV1 {
  return { operator: "all", conditions: [{ fact: `state.${variableId}`, operator: operator as typeof numericOperators[number], value }] };
}

export function AdvancedLogicEditor({ core, scenario, client }: {
  core: CoreDesignV1; scenario: ScenarioV1; client: StudioCollaborationClient;
}) {
  const variables = core.stateVariables ?? [];
  const capabilities = core.capabilities ?? [];
  const resources = core.resourceDefinitions ?? [];
  const policies = core.informationPolicies ?? [];
  const numericVariables = variables.filter(({ type }) => type === "integer" || type === "decimal");
  const addVariable = () => {
    const variable: StateVariableDefinitionV1 = {
      id: identifier(), name: "New State Value", scope: "global", type: "integer", minimum: 0, maximum: 100,
      informationPolicyId: policies[0]?.id ?? "", historyMode: "full", display: "number"
    };
    client.transact(() => {
      client.appendAtPath(["coreDesign", "stateVariables"], variable);
      client.appendAtPath(["scenario", "initialState"], { stateVariableId: variable.id, value: 0 });
    });
  };
  return <section id="advanced-logic" className="editor-workspace card" aria-labelledby="advanced-logic-title">
    <div className="workspace-heading"><div><h2 id="advanced-logic-title">Advanced logic &amp; world state</h2>
      <p>Author typed State Values and bounded Gates for acyclic conditional and parallel workflows. Loops and continuous timing are unavailable.</p></div></div>
    <h3>State Values</h3>
    <div className="editor-list">{variables.map((variable, index) => <details className="editor-item" key={variable.id}>
      <summary><span>{variable.name}</span><span className="item-id">{variable.id}</span></summary>
      <div className="item-body grid-fields">
        <Field label="Name"><input value={variable.name} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "name"], event.target.value)} /></Field>
        <Field label="Value type"><select value={variable.type} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "type"], event.target.value)}>
          {(["integer", "decimal", "boolean", "text", "enum"] as const).map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
        <Field label="Scope"><select value={variable.scope} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "scope"], event.target.value)}>
          {(["global", "team", "relationship", "location", "sector", "asset", "session_role"] as const).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
        <Field label="Information Policy"><select value={variable.informationPolicyId} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "informationPolicyId"], event.target.value)}>
          <option value="">Choose a policy</option>{policies.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
        <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "stateVariables"], index)}>Remove State Value</button>
      </div>
    </details>)}</div>
    <button className="btn-secondary" type="button" disabled={policies.length === 0} onClick={addVariable}>Add State Value</button>
    {policies.length === 0 && <p className="hint">Add an Information Policy before adding world state.</p>}

    <h3>Capabilities</h3>
    <div className="editor-list compact-list">{capabilities.map((capability, index) => <div className="field-row" key={capability.id}>
      <Field label="Capability name"><input value={capability.name} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "name"], event.target.value)} /></Field>
      <Field label="Initial status"><select value={capability.initialState} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "initialState"], event.target.value)}>
        {capability.states.map((state) => <option key={state} value={state}>{state}</option>)}</select></Field>
      <Field label="Capability mode"><select value={capability.mode ?? "boolean"} onChange={(event) => client.transact(() => {
        const counted = event.target.value === "counted";
        client.setAtPath(["coreDesign", "capabilities", index, "mode"], event.target.value);
        if (counted) {
          client.setAtPath(["coreDesign", "capabilities", index, "initialQuantity"], 1);
          client.setAtPath(["coreDesign", "capabilities", index, "maximumQuantity"], 1);
        } else {
          client.deleteAtPath(["coreDesign", "capabilities", index, "initialQuantity"]);
          client.deleteAtPath(["coreDesign", "capabilities", index, "maximumQuantity"]);
          client.deleteAtPath(["coreDesign", "capabilities", index, "consumable"]);
          client.deleteAtPath(["coreDesign", "capabilities", index, "renewal"]);
        }
      })}><option value="boolean">Available or unavailable</option><option value="counted">Counted</option></select></Field>
      {capability.mode === "counted" && <>
        <Field label="Initial quantity"><input type="number" min="0" value={capability.initialQuantity ?? 0} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "initialQuantity"], Number(event.target.value))} /></Field>
        <Field label="Maximum quantity"><input type="number" min="0" value={capability.maximumQuantity ?? 0} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "maximumQuantity"], Number(event.target.value))} /></Field>
        <label className="choice"><input type="checkbox" checked={capability.consumable === true} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "consumable"], event.target.checked)} />Consume quantity when used</label>
        <label className="choice"><input type="checkbox" checked={capability.renewal !== undefined} onChange={(event) => event.target.checked
          ? client.setAtPath(["coreDesign", "capabilities", index, "renewal"], { everyStageType: "stage", amount: 1 })
          : client.deleteAtPath(["coreDesign", "capabilities", index, "renewal"])} />Renew on Stage type</label>
        {capability.renewal === undefined ? null : <>
          <Field label="Renew at Stage type"><input value={capability.renewal.everyStageType} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "renewal", "everyStageType"], event.target.value)} /></Field>
          <Field label="Renew quantity"><input type="number" min="1" value={capability.renewal.amount} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "renewal", "amount"], Number(event.target.value))} /></Field>
        </>}
      </>}
      <Field label="Information Policy"><select value={capability.informationPolicyId} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "informationPolicyId"], event.target.value)}>
        {policies.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
      <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "capabilities"], index)}>Remove</button>
    </div>)}</div>
    <button className="btn-secondary" type="button" disabled={policies.length === 0} onClick={() => client.appendAtPath(["coreDesign", "capabilities"], {
      id: identifier(), name: "New Capability", states: ["available", "committed", "degraded", "unavailable"],
      initialState: "available", mode: "boolean", informationPolicyId: policies[0]?.id
    })}>Add Capability</button>

    <h3>Resources</h3>
    <div className="editor-list compact-list">{resources.map((resource, index) => <div className="field-row" key={resource.id}>
      <Field label="Resource name"><input value={resource.name} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "name"], event.target.value)} /></Field>
      <Field label="Unit"><input value={resource.unit} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "unit"], event.target.value)} /></Field>
      <Field label="Ownership"><select value={resource.ownership} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "ownership"], event.target.value)}><option value="global">global</option><option value="team">team</option></select></Field>
      <label className="choice"><input type="checkbox" checked={resource.replenishment !== undefined} onChange={(event) => event.target.checked
        ? client.setAtPath(["coreDesign", "resourceDefinitions", index, "replenishment"], { everyStageType: "stage", amount: 1 })
        : client.deleteAtPath(["coreDesign", "resourceDefinitions", index, "replenishment"])} />Replenish on Stage entry</label>
      {resource.replenishment === undefined ? null : <>
        <Field label="Replenish at Stage type"><input value={resource.replenishment.everyStageType ?? ""} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "replenishment", "everyStageType"], event.target.value)} /></Field>
        <Field label="Replenish amount"><input type="number" min="0" value={resource.replenishment.amount} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "replenishment", "amount"], Number(event.target.value))} /></Field>
      </>}
      <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "resourceDefinitions"], index)}>Remove</button>
    </div>)}</div>
    <button className="btn-secondary" type="button" disabled={policies.length === 0} onClick={() => {
      const resourceId = identifier();
      client.transact(() => {
        client.appendAtPath(["coreDesign", "resourceDefinitions"], { id: resourceId, name: "New Resource", unit: "units", ownership: "global", informationPolicyId: policies[0]?.id });
        client.appendAtPath(["scenario", "initialResources"], { resourceId, balance: 0 });
      });
    }}>Add Resource</button>

    <h3>Stage completion Gates</h3>
    {core.stages?.map((stage, stageIndex) => {
      const condition = stage.completionGate?.conditions[0];
      const simple = condition !== undefined && !("conditions" in condition) ? condition : undefined;
      return <fieldset className="nested-editor" key={stage.id}><legend>{stage.name}</legend>
        <label className="choice"><input type="checkbox" checked={stage.completionGate !== undefined}
          disabled={numericVariables.length === 0} onChange={(event) => event.target.checked
            ? client.setAtPath(["coreDesign", "stages", stageIndex, "completionGate"], simpleGate(numericVariables[0]!.id))
            : client.deleteAtPath(["coreDesign", "stages", stageIndex, "completionGate"])} />Require a State Value condition to complete</label>
        {simple === undefined ? null : <div className="grid-fields">
          <Field label="State Value"><select value={simple.fact.slice("state.".length)} onChange={(event) => client.setAtPath(["coreDesign", "stages", stageIndex, "completionGate", "conditions", 0, "fact"], `state.${event.target.value}`)}>
            {numericVariables.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
          <Field label="Comparison"><select value={simple.operator} onChange={(event) => client.setAtPath(["coreDesign", "stages", stageIndex, "completionGate", "conditions", 0, "operator"], event.target.value)}>
            {numericOperators.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
          <Field label="Value"><input type="number" value={typeof simple.value === "number" ? simple.value : 0} onChange={(event) => client.setAtPath(["coreDesign", "stages", stageIndex, "completionGate", "conditions", 0, "value"], Number(event.target.value))} /></Field>
        </div>}
      </fieldset>;
    })}

    <h3>Conditional Stage transitions</h3>
    {core.stages?.flatMap((stage, stageIndex) => stage.transitions.map((transition, transitionIndex) => {
      const condition = transition.gate?.conditions[0];
      const simple = condition !== undefined && !("conditions" in condition) ? condition : undefined;
      return <fieldset className="nested-editor" key={transition.id}><legend>{stage.name} to {core.stages?.find(({ id }) => id === transition.targetStageId)?.name ?? transition.targetStageId}</legend>
        <label className="choice"><input type="checkbox" checked={transition.gate !== undefined} disabled={numericVariables.length === 0}
          onChange={(event) => event.target.checked
            ? client.setAtPath(["coreDesign", "stages", stageIndex, "transitions", transitionIndex, "gate"], simpleGate(numericVariables[0]!.id))
            : client.deleteAtPath(["coreDesign", "stages", stageIndex, "transitions", transitionIndex, "gate"])} />Use a State Value condition</label>
        {simple === undefined ? null : <div className="grid-fields">
          <Field label="State Value"><select value={simple.fact.slice("state.".length)} onChange={(event) => client.setAtPath(["coreDesign", "stages", stageIndex, "transitions", transitionIndex, "gate", "conditions", 0, "fact"], `state.${event.target.value}`)}>
            {numericVariables.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
          <Field label="Comparison"><select value={simple.operator} onChange={(event) => client.setAtPath(["coreDesign", "stages", stageIndex, "transitions", transitionIndex, "gate", "conditions", 0, "operator"], event.target.value)}>
            {numericOperators.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
          <Field label="Value"><input type="number" value={typeof simple.value === "number" ? simple.value : 0} onChange={(event) => client.setAtPath(["coreDesign", "stages", stageIndex, "transitions", transitionIndex, "gate", "conditions", 0, "value"], Number(event.target.value))} /></Field>
        </div>}
      </fieldset>;
    }))}

    <h3>Conditional Workflow transitions</h3>
    {(core.workflows ?? []).flatMap((workflow, workflowIndex) => workflow.transitions.map((transition, transitionIndex) => {
      const condition = transition.gate?.conditions[0];
      const simple = condition !== undefined && !("conditions" in condition) ? condition : undefined;
      return <fieldset className="nested-editor" key={transition.id}><legend>{workflow.name}: {transition.label ?? transition.command}</legend>
        <Field label="Branch priority"><input type="number" value={transition.priority ?? 0} onChange={(event) => client.setAtPath(["coreDesign", "workflows", workflowIndex, "transitions", transitionIndex, "priority"], Number(event.target.value))} /></Field>
        <label className="choice"><input type="checkbox" checked={transition.gate !== undefined} disabled={numericVariables.length === 0}
          onChange={(event) => event.target.checked
            ? client.setAtPath(["coreDesign", "workflows", workflowIndex, "transitions", transitionIndex, "gate"], simpleGate(numericVariables[0]!.id))
            : client.deleteAtPath(["coreDesign", "workflows", workflowIndex, "transitions", transitionIndex, "gate"])} />Use a State Value condition</label>
        {simple === undefined ? null : <div className="grid-fields">
          <Field label="State Value"><select value={simple.fact.slice("state.".length)} onChange={(event) => client.setAtPath(["coreDesign", "workflows", workflowIndex, "transitions", transitionIndex, "gate", "conditions", 0, "fact"], `state.${event.target.value}`)}>
            {numericVariables.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
          <Field label="Comparison"><select value={simple.operator} onChange={(event) => client.setAtPath(["coreDesign", "workflows", workflowIndex, "transitions", transitionIndex, "gate", "conditions", 0, "operator"], event.target.value)}>
            {numericOperators.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
          <Field label="Value"><input type="number" value={typeof simple.value === "number" ? simple.value : 0} onChange={(event) => client.setAtPath(["coreDesign", "workflows", workflowIndex, "transitions", transitionIndex, "gate", "conditions", 0, "value"], Number(event.target.value))} /></Field>
        </div>}
      </fieldset>;
    }))}

    <h3>Conditional Injects and effects</h3>
    {(scenario.injects ?? []).map((inject, injectIndex) => <details className="editor-item" key={inject.id}><summary>{inject.title}</summary>
      <div className="item-body">
        <label className="choice"><input type="checkbox" checked={inject.releaseMode === "gate"} disabled={numericVariables.length === 0}
          onChange={(event) => client.transact(() => {
            client.setAtPath(["scenario", "injects", injectIndex, "releaseMode"], event.target.checked ? "gate" : "manual");
            if (event.target.checked) client.setAtPath(["scenario", "injects", injectIndex, "releaseGate"], simpleGate(numericVariables[0]!.id));
            else client.deleteAtPath(["scenario", "injects", injectIndex, "releaseGate"]);
          })} />Release when a State Value Gate passes</label>
        <button className="btn-secondary compact" type="button" disabled={numericVariables.length === 0}
          onClick={() => client.appendAtPath(["scenario", "injects", injectIndex, "effects"], {
            stateVariableId: numericVariables[0]?.id, operation: "increment", value: 1, rationale: `Inject ${inject.title} released`
          })}>Add State Effect</button>
        {(inject.effects ?? []).map((effect, effectIndex) => <div className="field-row" key={`${inject.id}-${effectIndex}`}>
          <span>{effect.operation} {String(effect.value)} on {variables.find(({ id }) => id === effect.stateVariableId)?.name ?? effect.stateVariableId}</span>
          <Field label="Delay in seconds"><input type="number" min="0" max="604800" value={effect.delaySeconds ?? 0}
            onChange={(event) => client.setAtPath(["scenario", "injects", injectIndex, "effects", effectIndex, "delaySeconds"], Number(event.target.value))} /></Field>
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["scenario", "injects", injectIndex, "effects"], effectIndex)}>Remove effect</button>
        </div>)}
      </div></details>)}
  </section>;
}
