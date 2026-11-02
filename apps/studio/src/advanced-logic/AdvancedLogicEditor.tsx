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
  const roles = core.sessionRoles ?? [];
  const teams = core.teams ?? [];
  const numericVariables = variables.filter(({ type }) => type === "integer" || type === "decimal");
  const capabilityStates = ["available", "ready", "committed", "degraded", "exhausted", "recovering", "unavailable"] as const;
  const effectSources = [
    ...(scenario.injects ?? []).flatMap((inject) => (inject.effects ?? []).map((effect) => ({ source: `Inject: ${inject.title}`, effect }))),
    ...capabilities.flatMap((capability) => (capability.degradationEffects ?? []).map((effect) => ({ source: `Capability degradation: ${capability.name}`, effect }))),
    ...(core.adjudicationModels ?? []).flatMap((model) => (model.output?.stateEffects ?? []).map((effect) => ({ source: `Adjudication outcome: ${model.name}`, effect })))
  ];
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
    <div className="editor-list">{variables.map((variable, index) => {
      const initialIndex = (scenario.initialState ?? []).findIndex(({ stateVariableId }) => stateVariableId === variable.id);
      const initial = scenario.initialState?.[initialIndex];
      const initialValue = initial?.value ?? (variable.type === "boolean" ? false : variable.type === "integer" || variable.type === "decimal" ? 0 : "");
      const setInitialValue = (value: boolean | number | string) => initialIndex < 0
        ? client.appendAtPath(["scenario", "initialState"], {
          stateVariableId: variable.id, value,
          ...(variable.scope === "team" && teams[0] !== undefined ? { scopeReference: teams[0].id } : {})
        })
        : client.setAtPath(["scenario", "initialState", initialIndex, "value"], value);
      return <details className="editor-item" key={variable.id}>
      <summary><span>{variable.name}</span><span className="item-id">{variable.id}</span></summary>
      <div className="item-body grid-fields">
        <Field label="Name"><input value={variable.name} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "name"], event.target.value)} /></Field>
        <Field label="Description"><textarea rows={3} value={variable.description ?? ""} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "description"], event.target.value)} /></Field>
        <Field label="Value type"><select value={variable.type} onChange={(event) => {
          const type = event.target.value as StateVariableDefinitionV1["type"];
          const value = type === "boolean" ? false : type === "integer" || type === "decimal" ? 0 : type === "enum" ? variable.options?.[0]?.value ?? "option_1" : "";
          client.transact(() => {
            client.setAtPath(["coreDesign", "stateVariables", index, "type"], type);
            if (type === "enum" && (variable.options?.length ?? 0) === 0) client.setAtPath(["coreDesign", "stateVariables", index, "options"], [{ value: "option_1", label: "Option 1" }]);
            if (type !== "integer" && type !== "decimal") {
              client.deleteAtPath(["coreDesign", "stateVariables", index, "minimum"]);
              client.deleteAtPath(["coreDesign", "stateVariables", index, "maximum"]);
            }
            if (initialIndex < 0) client.appendAtPath(["scenario", "initialState"], { stateVariableId: variable.id, value });
            else client.setAtPath(["scenario", "initialState", initialIndex, "value"], value);
          });
        }}>
          {(["integer", "decimal", "boolean", "text", "enum"] as const).map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
        <Field label="Scope"><select value={variable.scope} onChange={(event) => client.transact(() => {
          client.setAtPath(["coreDesign", "stateVariables", index, "scope"], event.target.value);
          if (initialIndex >= 0 && event.target.value === "team" && teams[0] !== undefined) client.setAtPath(["scenario", "initialState", initialIndex, "scopeReference"], teams[0].id);
          else if (initialIndex >= 0) client.deleteAtPath(["scenario", "initialState", initialIndex, "scopeReference"]);
        })}>
          {(["global", "team", "relationship", "location", "sector", "asset", "session_role"] as const).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
        {variable.scope === "team" && <Field label="Initial Team scope"><select value={initial?.scopeReference ?? ""} onChange={(event) => initialIndex < 0
          ? client.appendAtPath(["scenario", "initialState"], { stateVariableId: variable.id, value: initialValue, scopeReference: event.target.value })
          : client.setAtPath(["scenario", "initialState", initialIndex, "scopeReference"], event.target.value)}><option value="">Choose a Team</option>{teams.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>}
        {(variable.type === "integer" || variable.type === "decimal") && <><Field label="Minimum"><input type="number" value={variable.minimum ?? 0} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "minimum"], Number(event.target.value))} /></Field>
          <Field label="Maximum"><input type="number" value={variable.maximum ?? 100} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "maximum"], Number(event.target.value))} /></Field></>}
        <Field label="Unit"><input value={variable.unit ?? ""} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "unit"], event.target.value)} /></Field>
        {variable.type === "enum" && <Field label="Enum options (value: label, comma separated)"><textarea rows={3} value={(variable.options ?? []).map(({ value, label }) => `${value}: ${label}`).join(", ")} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "options"], event.target.value.split(",").map((item) => item.trim()).filter(Boolean).map((item) => { const [value, ...label] = item.split(":"); return { value: value?.trim() ?? "", label: label.join(":").trim() || value?.trim() || "" }; }))} /></Field>}
        <Field label="Scenario initial value">{variable.type === "boolean" ? <select value={String(initialValue)} onChange={(event) => setInitialValue(event.target.value === "true")}><option value="false">false</option><option value="true">true</option></select> : variable.type === "enum" ? <select value={String(initialValue)} onChange={(event) => setInitialValue(event.target.value)}>{variable.options?.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select> : <input type={variable.type === "integer" || variable.type === "decimal" ? "number" : "text"} value={String(initialValue)} onChange={(event) => setInitialValue(variable.type === "integer" || variable.type === "decimal" ? Number(event.target.value) : event.target.value)} />}</Field>
        <Field label="Information Policy"><select value={variable.informationPolicyId} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "informationPolicyId"], event.target.value)}>
          <option value="">Choose a policy</option>{policies.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
        <fieldset className="choice-group"><legend>Editable by Session Roles</legend>{roles.map(({ id, name }) => <label className="choice" key={id}><input type="checkbox" checked={variable.editableBySessionRoleIds?.includes(id) === true} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "editableBySessionRoleIds"], event.target.checked ? [...(variable.editableBySessionRoleIds ?? []), id] : (variable.editableBySessionRoleIds ?? []).filter((value) => value !== id))} />{name}</label>)}</fieldset>
        <Field label="History"><select value={variable.historyMode} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "historyMode"], event.target.value)}><option value="full">Full history</option><option value="final_only">Final only</option></select></Field>
        <Field label="Display"><select value={variable.display ?? "number"} onChange={(event) => client.setAtPath(["coreDesign", "stateVariables", index, "display"], event.target.value)}>{["number", "progress_bar", "gauge", "trend", "status_label", "hidden"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
        <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "stateVariables"], index)}>Remove State Value</button>
      </div>
    </details>;
    })}</div>
    <button className="btn-secondary" type="button" disabled={policies.length === 0} onClick={addVariable}>Add State Value</button>
    {policies.length === 0 && <p className="hint">Add an Information Policy before adding world state.</p>}

    <h3>Capabilities</h3>
    <div className="editor-list">{capabilities.map((capability, index) => {
      const initialIndex = (scenario.initialCapabilities ?? []).findIndex(({ capabilityId }) => capabilityId === capability.id);
      const initial = scenario.initialCapabilities?.[initialIndex];
      const activation = capability.activationGate?.conditions[0];
      const simpleActivation = activation !== undefined && !("conditions" in activation) ? activation : undefined;
      return <details className="editor-item" key={capability.id} open><summary><span>{capability.name}</span><span className="badge badge-muted">{capability.mode ?? "boolean"}</span></summary><div className="item-body grid-fields">
      <Field label="Capability name"><input value={capability.name} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "name"], event.target.value)} /></Field>
      <Field label="Owner Team"><select value={capability.ownerTeamId ?? ""} onChange={(event) => event.target.value === "" ? client.deleteAtPath(["coreDesign", "capabilities", index, "ownerTeamId"]) : client.setAtPath(["coreDesign", "capabilities", index, "ownerTeamId"], event.target.value)}><option value="">Global / no owner Team</option>{teams.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
      <fieldset className="choice-group"><legend>Lifecycle states</legend>{capabilityStates.map((state) => <label className="choice" key={state}><input type="checkbox" checked={capability.states.includes(state)} disabled={capability.initialState === state && capability.states.includes(state)} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "states"], event.target.checked ? [...capability.states, state] : capability.states.filter((value) => value !== state))} />{state}</label>)}</fieldset>
      <Field label="Scenario initial status"><select value={initial?.state ?? capability.initialState} onChange={(event) => client.transact(() => {
        client.setAtPath(["coreDesign", "capabilities", index, "initialState"], event.target.value);
        if (initialIndex < 0) client.appendAtPath(["scenario", "initialCapabilities"], { capabilityId: capability.id, state: event.target.value });
        else client.setAtPath(["scenario", "initialCapabilities", initialIndex, "state"], event.target.value);
      })}>{capability.states.map((state) => <option key={state} value={state}>{state}</option>)}</select></Field>
      <Field label="Capability mode"><select value={capability.mode ?? "boolean"} onChange={(event) => client.transact(() => {
        const counted = event.target.value === "counted";
        client.setAtPath(["coreDesign", "capabilities", index, "mode"], event.target.value);
        if (counted) {
          client.setAtPath(["coreDesign", "capabilities", index, "initialQuantity"], 1);
          client.setAtPath(["coreDesign", "capabilities", index, "maximumQuantity"], 1);
          if (initialIndex >= 0) client.setAtPath(["scenario", "initialCapabilities", initialIndex, "quantity"], 1);
        } else {
          client.deleteAtPath(["coreDesign", "capabilities", index, "initialQuantity"]);
          client.deleteAtPath(["coreDesign", "capabilities", index, "maximumQuantity"]);
          client.deleteAtPath(["coreDesign", "capabilities", index, "consumable"]);
          client.deleteAtPath(["coreDesign", "capabilities", index, "renewal"]);
          if (initialIndex >= 0) client.deleteAtPath(["scenario", "initialCapabilities", initialIndex, "quantity"]);
        }
      })}><option value="boolean">Available or unavailable</option><option value="counted">Counted</option></select></Field>
      {capability.mode === "counted" && <>
        <Field label="Scenario initial quantity"><input type="number" min="0" value={initial?.quantity ?? capability.initialQuantity ?? 0} onChange={(event) => client.transact(() => {
          const quantity = Number(event.target.value);
          client.setAtPath(["coreDesign", "capabilities", index, "initialQuantity"], quantity);
          if (initialIndex < 0) client.appendAtPath(["scenario", "initialCapabilities"], { capabilityId: capability.id, state: capability.initialState, quantity });
          else client.setAtPath(["scenario", "initialCapabilities", initialIndex, "quantity"], quantity);
        })} /></Field>
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
      <Field label="Recovery time in seconds"><input type="number" min="0" value={capability.recoverySeconds ?? 0} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "recoverySeconds"], Number(event.target.value))} /></Field>
      <fieldset className="nested-editor"><legend>Activation Gate</legend><label className="choice"><input type="checkbox" checked={capability.activationGate !== undefined} disabled={numericVariables.length === 0} onChange={(event) => event.target.checked ? client.setAtPath(["coreDesign", "capabilities", index, "activationGate"], simpleGate(numericVariables[0]!.id)) : client.deleteAtPath(["coreDesign", "capabilities", index, "activationGate"])} />Require a State Value condition</label>
        {simpleActivation !== undefined && <div className="grid-fields"><Field label="State Value"><select value={simpleActivation.fact.slice("state.".length)} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "activationGate", "conditions", 0, "fact"], `state.${event.target.value}`)}>{numericVariables.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Comparison"><select value={simpleActivation.operator} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "activationGate", "conditions", 0, "operator"], event.target.value)}>{numericOperators.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field><Field label="Value"><input type="number" value={typeof simpleActivation.value === "number" ? simpleActivation.value : 0} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "activationGate", "conditions", 0, "value"], Number(event.target.value))} /></Field></div>}
      </fieldset>
      <fieldset className="nested-editor"><legend>Degradation Effects</legend>{(capability.degradationEffects ?? []).map((effect, effectIndex) => <div className="field-row" key={`${capability.id}-degradation-${effectIndex}`}><Field label="State Value"><select value={effect.stateVariableId} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "degradationEffects", effectIndex, "stateVariableId"], event.target.value)}>{numericVariables.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Operation"><select value={effect.operation} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "degradationEffects", effectIndex, "operation"], event.target.value)}>{["set", "increment", "decrement", "multiply"].map((value) => <option key={value} value={value}>{value}</option>)}</select></Field><Field label="Value"><input type="number" value={typeof effect.value === "number" ? effect.value : 0} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "degradationEffects", effectIndex, "value"], Number(event.target.value))} /></Field><button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "capabilities", index, "degradationEffects"], effectIndex)}>Remove Effect</button></div>)}<button className="btn-secondary compact" type="button" disabled={numericVariables.length === 0} onClick={() => client.appendAtPath(["coreDesign", "capabilities", index, "degradationEffects"], { stateVariableId: numericVariables[0]!.id, operation: "decrement", value: 1, rationale: `${capability.name} degraded` })}>Add degradation Effect</button></fieldset>
      <fieldset className="nested-editor"><legend>Resource costs</legend>{(capability.costs ?? []).map((cost, costIndex) => <div className="field-row" key={`${capability.id}-cost-${costIndex}`}><Field label="Resource"><select value={cost.resourceId} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "costs", costIndex, "resourceId"], event.target.value)}>{resources.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field><Field label="Amount"><input type="number" min="0" value={cost.amount} onChange={(event) => client.setAtPath(["coreDesign", "capabilities", index, "costs", costIndex, "amount"], Number(event.target.value))} /></Field><button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "capabilities", index, "costs"], costIndex)}>Remove cost</button></div>)}<button className="btn-secondary compact" type="button" disabled={resources.length === 0} onClick={() => client.appendAtPath(["coreDesign", "capabilities", index, "costs"], { resourceId: resources[0]!.id, amount: 1 })}>Add Resource cost</button></fieldset>
      <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "capabilities"], index)}>Remove</button>
    </div></details>;
    })}</div>
    <button className="btn-secondary" type="button" disabled={policies.length === 0} onClick={() => {
      const capabilityId = identifier();
      client.transact(() => {
        client.appendAtPath(["coreDesign", "capabilities"], { id: capabilityId, name: "New Capability", states: ["available", "committed", "degraded", "unavailable"], initialState: "available", mode: "boolean", informationPolicyId: policies[0]?.id });
        client.appendAtPath(["scenario", "initialCapabilities"], { capabilityId, state: "available" });
      });
    }}>Add Capability</button>

    <h3>Resources</h3>
    <div className="editor-list compact-list">{resources.map((resource, index) => {
      const initialIndex = (scenario.initialResources ?? []).findIndex(({ resourceId }) => resourceId === resource.id);
      const initial = scenario.initialResources?.[initialIndex];
      return <div className="field-row" key={resource.id}>
      <Field label="Resource name"><input value={resource.name} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "name"], event.target.value)} /></Field>
      <Field label="Unit"><input value={resource.unit} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "unit"], event.target.value)} /></Field>
      <Field label="Ownership"><select value={resource.ownership} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "ownership"], event.target.value)}><option value="global">global</option><option value="team">team</option></select></Field>
      <Field label="Scenario initial balance"><input type="number" min="0" value={initial?.balance ?? 0} onChange={(event) => initialIndex < 0 ? client.appendAtPath(["scenario", "initialResources"], { resourceId: resource.id, balance: Number(event.target.value) }) : client.setAtPath(["scenario", "initialResources", initialIndex, "balance"], Number(event.target.value))} /></Field>
      <Field label="Information Policy"><select value={resource.informationPolicyId} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "informationPolicyId"], event.target.value)}>{policies.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></Field>
      <label className="choice"><input type="checkbox" checked={resource.replenishment !== undefined} onChange={(event) => event.target.checked
        ? client.setAtPath(["coreDesign", "resourceDefinitions", index, "replenishment"], { everyStageType: "stage", amount: 1 })
        : client.deleteAtPath(["coreDesign", "resourceDefinitions", index, "replenishment"])} />Replenish on Stage entry</label>
      {resource.replenishment === undefined ? null : <>
        <Field label="Replenish at Stage type"><input value={resource.replenishment.everyStageType ?? ""} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "replenishment", "everyStageType"], event.target.value)} /></Field>
        <Field label="Replenish amount"><input type="number" min="0" value={resource.replenishment.amount} onChange={(event) => client.setAtPath(["coreDesign", "resourceDefinitions", index, "replenishment", "amount"], Number(event.target.value))} /></Field>
      </>}
      <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "resourceDefinitions"], index)}>Remove</button>
    </div>;
    })}</div>
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
    <h3>Effect source map</h3>
    <div className="table-scroll" tabIndex={0} aria-label="Effect source map"><table className="permission-matrix"><caption>Every configured world-state Effect and the design element that proposes or applies it.</caption><thead><tr><th scope="col">Source</th><th scope="col">Target State Value</th><th scope="col">Operation</th><th scope="col">Timing</th></tr></thead><tbody>{effectSources.length === 0 ? <tr><td colSpan={4}>No Effects are configured.</td></tr> : effectSources.map(({ source, effect }, index) => <tr key={`${source}-${index}`}><th scope="row">{source}</th><td>{variables.find(({ id }) => id === effect.stateVariableId)?.name ?? effect.stateVariableId}</td><td>{effect.operation} {String(effect.value)}</td><td>{effect.delaySeconds === undefined || effect.delaySeconds === 0 ? "Immediate after its governed source" : `${effect.delaySeconds} seconds after its governed source`}</td></tr>)}</tbody></table></div>
  </section>;
}
