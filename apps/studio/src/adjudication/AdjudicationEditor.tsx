import { useState } from "react";
import { ADJUDICATION_MODEL_EDITOR_CONTRACT_ID } from "@plenum/event-contracts";
import type { AdjudicationModelDefinitionV1, CoreDesignV1, GateConditionV1, RuntimeScalarV1, ScenarioV1 } from "@plenum/simulation-schema";

import type { StudioCollaborationClient } from "../collaboration/client.js";
import { AddButton, CheckField, ItemActions, MultiCheck, SelectField, TextField, Workspace } from "../core-design/Editor.js";
import { coreArray, identifier } from "../core-design/model.js";

const words = (value: string) => value.replaceAll("_", " ");
const doctrines = ["structured_argument", "expert_judgment", "rules_based", "model_supported", "probability_based", "hybrid"] as const;
const mechanisms = ["manual", "rubric", "rules", "plugin", "hybrid"] as const;
const comparisons: GateConditionV1["operator"][] = ["equals", "not_equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal"];

function initialModel(core: CoreDesignV1): AdjudicationModelDefinitionV1 {
  const decisionType = coreArray(core, "artifactTypes").find(({ decisionBearing }) => decisionBearing);
  const role = coreArray(core, "sessionRoles").find(({ isControlRole }) => isControlRole) ?? coreArray(core, "sessionRoles")[0];
  return {
    id: identifier(), name: "New Adjudication Model", doctrine: "expert_judgment", mechanism: "manual",
    appliesToArtifactTypeIds: decisionType === undefined ? [] : [decisionType.id],
    reviewerSessionRoleIds: role === undefined ? [] : [role.id], leadReviewerSessionRoleIds: role === undefined ? [] : [role.id],
    perspectives: [], publicationScope: { public: true }, precedent: "none",
    output: { outcomeCategories: ["accepted", "returned"], rationaleRequired: true, confidenceRequired: true, stateEffects: [], followOnInjectIds: [] }
  };
}

function simpleRule(variableId: string) {
  return {
    id: identifier(), label: "State Value meets threshold", explanation: "The selected State Value is compared with the configured threshold.",
    when: { operator: "all" as const, conditions: [{ fact: `state.${variableId}`, operator: "greater_or_equal" as const, value: 0 }] },
    outcome: "accepted" as RuntimeScalarV1
  };
}

function AdjudicationPreview({ model }: { model: AdjudicationModelDefinitionV1 }) {
  const [ran, setRan] = useState(false);
  const steps = [
    { label: "Suggestion", text: model.mechanism === "manual" ? "No computed suggestion; an authorized human starts the record." : `${words(model.mechanism)} guidance is provisional and includes an explanation trace.` },
    { label: "Review", text: `${model.reviewerSessionRoleIds.length} reviewer role selection${model.reviewerSessionRoleIds.length === 1 ? "" : "s"}; ${model.perspectives.length} perspective${model.perspectives.length === 1 ? "" : "s"}.` },
    { label: "Approval", text: `${model.leadReviewerSessionRoleIds.length} lead synthesizer role selection${model.leadReviewerSessionRoleIds.length === 1 ? "" : "s"}; overrides require rationale.` },
    { label: "Committed effect", text: `${model.output?.stateEffects.length ?? 0} configured Effect${model.output?.stateEffects.length === 1 ? "" : "s"}; none are applied by this preview.` }
  ];
  return <section className="fixture-preview adjudication-preview" aria-label={`Synthetic adjudication preview for ${model.name}`}>
    <h3 id={`adjudication-preview-${model.id}`}>Synthetic adjudication preview</h3>
    <p>Runs a deterministic explanation-only fixture. It creates no Adjudication Request and cannot change Session state.</p>
    <button className="btn-primary" type="button" onClick={() => setRan(true)}>Run synthetic preview</button>
    <p aria-live="polite">{ran ? "Preview complete. Authoritative state changes: 0." : "Preview not run."}</p>
    {ran && <ol className="adjudication-trace">{steps.map(({ label, text }) => <li key={label}><strong>{label}</strong><span>{text}</span></li>)}</ol>}
  </section>;
}

function AdjudicationItem({ model, index, count, core, scenario, client }: {
  model: AdjudicationModelDefinitionV1; index: number; count: number; core: CoreDesignV1; scenario: ScenarioV1; client: StudioCollaborationClient;
}) {
  const base = ["coreDesign", "adjudicationModels", index] as const;
  const roles = coreArray(core, "sessionRoles");
  const teams = coreArray(core, "teams");
  const artifacts = coreArray(core, "artifactTypes");
  const decisionArtifacts = artifacts.filter(({ decisionBearing }) => decisionBearing);
  const variables = coreArray(core, "stateVariables");
  const numericVariables = variables.filter(({ type }) => type === "integer" || type === "decimal");
  const policies = coreArray(core, "informationPolicies");
  const bindings = coreArray(core, "pluginBindings");
  const compositions = coreArray(core, "compositions");
  const injects = scenario.injects ?? [];
  const output = model.output ?? { outcomeCategories: [], rationaleRequired: true, confidenceRequired: true, stateEffects: [], followOnInjectIds: [] };
  const computed = model.mechanism === "rubric" || model.mechanism === "rules" || model.mechanism === "plugin" || model.mechanism === "hybrid";

  return <details className="editor-item" id={`adjudicationModels-${model.id}`} open>
    <summary><span>{model.name || "Untitled Adjudication Model"}</span><span className="badge badge-info">{words(model.mechanism)}</span></summary>
    <div className="item-body grid-fields">
      <TextField id={`adjudication-name-${model.id}`} label="Model name" value={model.name} path={[...base, "name"]} client={client} />
      <SelectField id={`adjudication-doctrine-${model.id}`} label="Doctrine" value={model.doctrine ?? "expert_judgment"} options={doctrines.map((value) => ({ value, label: words(value) }))} path={[...base, "doctrine"]} client={client} />
      <SelectField id={`adjudication-mechanism-${model.id}`} label="Mechanism" value={model.mechanism} options={mechanisms.map((value) => ({ value, label: words(value) }))} path={[...base, "mechanism"]} client={client} />
      <SelectField id={`adjudication-precedent-${model.id}`} label="Precedent" value={model.precedent ?? "none"} options={["none", "advisory", "binding"].map((value) => ({ value, label: words(value) }))} path={[...base, "precedent"]} client={client} />
      <MultiCheck legend="Decision-bearing Artifact Types" values={model.appliesToArtifactTypeIds} options={decisionArtifacts.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "appliesToArtifactTypeIds"]} client={client} />
      <MultiCheck legend="Eligible reviewer Session Roles" values={model.reviewerSessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "reviewerSessionRoleIds"]} client={client} />
      <MultiCheck legend="Lead synthesizer Session Roles" values={model.leadReviewerSessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "leadReviewerSessionRoleIds"]} client={client} />

      <fieldset className="nested-editor"><legend>Perspectives</legend>
        {model.perspectives.map((perspective, perspectiveIndex) => <div className="nested-editor" key={perspective.id}>
          <TextField id={`perspective-label-${perspective.id}`} label="Perspective label" value={perspective.label} path={[...base, "perspectives", perspectiveIndex, "label"]} client={client} />
          <MultiCheck legend="Perspective reviewers" values={perspective.reviewerSessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "perspectives", perspectiveIndex, "reviewerSessionRoleIds"]} client={client} />
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath([...base, "perspectives"], perspectiveIndex)}>Remove perspective</button>
        </div>)}
        <AddButton label="Add perspective" onClick={() => client.appendAtPath([...base, "perspectives"], { id: identifier(), label: "New perspective", reviewerSessionRoleIds: model.reviewerSessionRoleIds.slice(0, 1) })} />
      </fieldset>

      {(model.mechanism === "rubric" || model.mechanism === "hybrid") && <fieldset className="nested-editor"><legend>Rubric criteria</legend>
        {(model.rubric ?? []).map((criterion, criterionIndex) => <div className="nested-editor" key={criterion.id}>
          <div className="grid-fields"><TextField id={`criterion-label-${criterion.id}`} label="Criterion" value={criterion.label} path={[...base, "rubric", criterionIndex, "label"]} client={client} />
            <TextField id={`criterion-weight-${criterion.id}`} label="Weight" type="number" value={criterion.weight} path={[...base, "rubric", criterionIndex, "weight"]} client={client} />
            <TextField id={`criterion-min-${criterion.id}`} label="Minimum" type="number" value={criterion.minimum} path={[...base, "rubric", criterionIndex, "minimum"]} client={client} />
            <TextField id={`criterion-max-${criterion.id}`} label="Maximum" type="number" value={criterion.maximum} path={[...base, "rubric", criterionIndex, "maximum"]} client={client} /></div>
          <MultiCheck legend="Required evidence Artifact Types" values={criterion.requiredEvidenceArtifactTypeIds ?? []} options={artifacts.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "rubric", criterionIndex, "requiredEvidenceArtifactTypeIds"]} client={client} />
          <MultiCheck legend="Eligible criterion reviewers" values={criterion.eligibleReviewerSessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "rubric", criterionIndex, "eligibleReviewerSessionRoleIds"]} client={client} />
          <fieldset className="nested-editor"><legend>Scale anchors</legend>{(criterion.anchors ?? []).map((anchor, anchorIndex) => <div className="field-row" key={`${criterion.id}-${anchorIndex}`}>
            <TextField id={`anchor-score-${criterion.id}-${anchorIndex}`} label="Score" type="number" value={anchor.score} path={[...base, "rubric", criterionIndex, "anchors", anchorIndex, "score"]} client={client} />
            <TextField id={`anchor-label-${criterion.id}-${anchorIndex}`} label="Anchor explanation" value={anchor.label} path={[...base, "rubric", criterionIndex, "anchors", anchorIndex, "label"]} client={client} />
            <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath([...base, "rubric", criterionIndex, "anchors"], anchorIndex)}>Remove anchor</button>
          </div>)}<AddButton label="Add scale anchor" onClick={() => client.appendAtPath([...base, "rubric", criterionIndex, "anchors"], { score: criterion.minimum, label: "Describe this score" })} /></fieldset>
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath([...base, "rubric"], criterionIndex)}>Remove criterion</button>
        </div>)}
        <AddButton label="Add rubric criterion" onClick={() => client.appendAtPath([...base, "rubric"], { id: identifier(), label: "New criterion", weight: 1, minimum: 0, maximum: 5, anchors: [], requiredEvidenceArtifactTypeIds: [], eligibleReviewerSessionRoleIds: model.reviewerSessionRoleIds.slice(0, 1) })} />
      </fieldset>}

      {(model.mechanism === "rules" || model.mechanism === "hybrid") && <fieldset className="nested-editor"><legend>Constrained rules</legend>
        {(model.rules ?? []).map((rule, ruleIndex) => {
          const condition = rule.when.conditions[0] as GateConditionV1 | undefined;
          return <div className="nested-editor" key={rule.id}>
            <TextField id={`rule-label-${rule.id}`} label="Rule label" value={rule.label} path={[...base, "rules", ruleIndex, "label"]} client={client} />
            <div className="grid-fields"><SelectField id={`rule-fact-${rule.id}`} label="State Value" value={condition?.fact ?? ""} options={numericVariables.map(({ id, name }) => ({ value: `state.${id}`, label: name }))} path={[...base, "rules", ruleIndex, "when", "conditions", 0, "fact"]} client={client} />
              <SelectField id={`rule-comparison-${rule.id}`} label="Comparison" value={condition?.operator ?? "equals"} options={comparisons.map((value) => ({ value, label: words(value) }))} path={[...base, "rules", ruleIndex, "when", "conditions", 0, "operator"]} client={client} />
              <TextField id={`rule-value-${rule.id}`} label="Threshold" type="number" value={typeof condition?.value === "number" ? condition.value : 0} path={[...base, "rules", ruleIndex, "when", "conditions", 0, "value"]} client={client} />
              <TextField id={`rule-outcome-${rule.id}`} label="Suggested outcome" value={String(rule.outcome)} path={[...base, "rules", ruleIndex, "outcome"]} client={client} /></div>
            <TextField id={`rule-explanation-${rule.id}`} label="Explanation shown in trace" value={rule.explanation ?? ""} path={[...base, "rules", ruleIndex, "explanation"]} client={client} multiline />
            <p className="rule-sentence"><strong>Rule explanation:</strong> When {variables.find(({ id }) => id === condition?.fact.slice("state.".length))?.name ?? "the selected State Value"} {words(condition?.operator ?? "equals")} {String(condition?.value ?? 0)}, suggest {String(rule.outcome)} because {rule.explanation || "no explanation has been supplied"}.</p>
            <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath([...base, "rules"], ruleIndex)}>Remove rule</button>
          </div>;
        })}
        <AddButton label="Add constrained rule" disabled={numericVariables.length === 0} onClick={() => client.appendAtPath([...base, "rules"], simpleRule(numericVariables[0]!.id))} />
        {numericVariables.length === 0 && <p className="hint">Add a numeric State Variable before adding a rule.</p>}
      </fieldset>}

      {(model.mechanism === "plugin" || model.mechanism === "hybrid") && <fieldset className="nested-editor"><legend>Model support</legend>
        <MultiCheck legend="Approved Plugin Bindings" values={model.pluginBindingIds ?? []} options={bindings.map(({ id, pluginId, pluginVersion }) => ({ value: id, label: `${pluginId} ${pluginVersion}` }))} path={[...base, "pluginBindingIds"]} client={client} />
        <MultiCheck legend="Model Compositions" values={model.compositionIds ?? []} options={compositions.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "compositionIds"]} client={client} />
        <TextField id={`adjudication-timeout-${model.id}`} label="Timeout seconds" type="number" value={model.timeoutSeconds ?? 30} path={[...base, "timeoutSeconds"]} client={client} />
        <MultiCheck legend="Effect approving Session Roles" values={model.approvingSessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "approvingSessionRoleIds"]} client={client} />
        <p className="rule-sentence"><strong>Consequential Effect approval:</strong> Always required and cannot be disabled. Failed, timed-out, or invalid model output remains a visible failure and never becomes an outcome.</p>
        <fieldset className="nested-editor"><legend>Policy-filtered input mappings</legend>{(model.inputMappings ?? []).map((mapping, mappingIndex) => <div className="field-row" key={`${model.id}-mapping-${mappingIndex}`}>
          <TextField id={`mapping-source-${model.id}-${mappingIndex}`} label="Authorized source" value={mapping.source} path={[...base, "inputMappings", mappingIndex, "source"]} client={client} />
          <TextField id={`mapping-target-${model.id}-${mappingIndex}`} label="Plugin input" value={mapping.target} path={[...base, "inputMappings", mappingIndex, "target"]} client={client} />
          <SelectField id={`mapping-class-${model.id}-${mappingIndex}`} label="Classification ceiling" value={mapping.maxClassification} options={["public", "internal", "confidential", "restricted"].map((value) => ({ value, label: value }))} path={[...base, "inputMappings", mappingIndex, "maxClassification"]} client={client} />
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath([...base, "inputMappings"], mappingIndex)}>Remove mapping</button>
        </div>)}<AddButton label="Add input mapping" onClick={() => client.appendAtPath([...base, "inputMappings"], { source: "state.authorized", target: "input", maxClassification: "internal" })} /></fieldset>
      </fieldset>}

      {model.output === undefined ? <fieldset className="nested-editor"><legend>Output</legend><p className="hint">This legacy model needs an explicit output contract before publication.</p>
        <AddButton label="Add complete output contract" onClick={() => client.setAtPath([...base, "output"], output)} />
      </fieldset> : <fieldset className="nested-editor"><legend>Output</legend>
        <TextField id={`outcome-categories-${model.id}`} label="Outcome categories (comma separated)" value={output.outcomeCategories.join(", ")} path={[...base, "output", "outcomeCategories"]} client={client} transform={(value) => value.split(",").map((item) => item.trim()).filter(Boolean)} />
        <CheckField id={`rationale-required-${model.id}`} label="Narrative rationale required" checked={output.rationaleRequired} path={[...base, "output", "rationaleRequired"]} client={client} />
        <CheckField id={`confidence-required-${model.id}`} label="Confidence required" checked={output.confidenceRequired} path={[...base, "output", "confidenceRequired"]} client={client} />
        <SelectField id={`revealed-policy-${model.id}`} label="Revealed information policy" value={output.revealedInformationPolicyId ?? ""} options={[{ value: "", label: "No additional revealed information" }, ...policies.map(({ id, name }) => ({ value: id, label: name }))]} path={[...base, "output", "revealedInformationPolicyId"]} client={client} emptyDeletes />
        <MultiCheck legend="Follow-on Injects" values={output.followOnInjectIds} options={injects.map(({ id, title }) => ({ value: id, label: title }))} path={[...base, "output", "followOnInjectIds"]} client={client} />
        <fieldset className="nested-editor"><legend>State Effects</legend>{output.stateEffects.map((effect, effectIndex) => <div className="field-row" key={`${model.id}-effect-${effectIndex}`}>
          <SelectField id={`output-effect-target-${model.id}-${effectIndex}`} label="State Value" value={effect.stateVariableId} options={numericVariables.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "output", "stateEffects", effectIndex, "stateVariableId"]} client={client} />
          <SelectField id={`output-effect-operation-${model.id}-${effectIndex}`} label="Operation" value={effect.operation} options={["set", "increment", "decrement", "multiply"].map((value) => ({ value, label: value }))} path={[...base, "output", "stateEffects", effectIndex, "operation"]} client={client} />
          <TextField id={`output-effect-value-${model.id}-${effectIndex}`} label="Value" type="number" value={typeof effect.value === "number" ? effect.value : 0} path={[...base, "output", "stateEffects", effectIndex, "value"]} client={client} />
          <TextField id={`output-effect-rationale-${model.id}-${effectIndex}`} label="Effect rationale" value={effect.rationale ?? ""} path={[...base, "output", "stateEffects", effectIndex, "rationale"]} client={client} />
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath([...base, "output", "stateEffects"], effectIndex)}>Remove Effect</button>
        </div>)}<AddButton label="Add proposed State Effect" disabled={numericVariables.length === 0} onClick={() => client.appendAtPath([...base, "output", "stateEffects"], { stateVariableId: numericVariables[0]!.id, operation: "increment", value: 1, rationale: "Adjudication outcome" })} /></fieldset>
      </fieldset>}

      <fieldset className="nested-editor"><legend>Publication recipients</legend>
        <CheckField id={`publication-public-${model.id}`} label="Public to authorized Session participants" checked={model.publicationScope.public === true} path={[...base, "publicationScope", "public"]} client={client} />
        <MultiCheck legend="Recipient Session Roles" values={model.publicationScope.sessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "publicationScope", "sessionRoleIds"]} client={client} />
        <MultiCheck legend="Recipient Teams" values={model.publicationScope.teamIds ?? []} options={teams.map(({ id, name }) => ({ value: id, label: name }))} path={[...base, "publicationScope", "teamIds"]} client={client} />
      </fieldset>

      {computed && <p className="rule-sentence"><strong>Explanation contract:</strong> Suggestions, perspective reviews, lead approval, override rationale, and committed Effects remain distinct in the Adjudication Record.</p>}
      <AdjudicationPreview model={{ ...model, output }} />
      <ItemActions path={["coreDesign", "adjudicationModels"]} index={index} count={count} client={client} label={model.name || "Adjudication Model"} />
    </div>
  </details>;
}

export function AdjudicationEditor({ core, scenario, client }: { core: CoreDesignV1; scenario: ScenarioV1; client: StudioCollaborationClient }) {
  const models = coreArray(core, "adjudicationModels");
  return <Workspace id="adjudication" title="Adjudication Models" intro="Build governed doctrine, rubric, constrained rules, perspectives, model support, outputs, and publication scope without authored code." >
    <div className="editor-list" data-contract-id={ADJUDICATION_MODEL_EDITOR_CONTRACT_ID}>{models.map((model, index) => <AdjudicationItem key={model.id} model={model} index={index} count={models.length} core={core} scenario={scenario} client={client} />)}</div>
    <AddButton label="Add Adjudication Model" disabled={coreArray(core, "artifactTypes").every(({ decisionBearing }) => !decisionBearing) || coreArray(core, "sessionRoles").length === 0} onClick={() => client.appendAtPath(["coreDesign", "adjudicationModels"], initialModel(core))} />
    {models.length === 0 && <p className="hint">Add a model to configure manual, rubric-assisted, rules-based, Plugin-supported, or hybrid adjudication.</p>}
  </Workspace>;
}
