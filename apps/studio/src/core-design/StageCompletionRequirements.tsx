import type { CoreDesignV1, RuntimeArtifactCoverageRequirementV1, RuntimeStageDefinitionV1 } from "@plenum/simulation-schema";
import type { StudioCollaborationClient } from "../collaboration/client.js";
import { coreArray, identifier } from "./model.js";

export function StageCompletionRequirements({ core, stage, stageIndex, client }: {
  core: CoreDesignV1; stage: RuntimeStageDefinitionV1; stageIndex: number; client: StudioCollaborationClient;
}) {
  const artifacts = coreArray(core, "artifactTypes").filter((type) => type.instanceScope?.kind === "team_cell");
  const groups = coreArray(core, "stageGroups");
  const base = ["coreDesign", "stages", stageIndex, "completionRequirements"] as const;
  function scopeFor(type: typeof artifacts[number]): RuntimeArtifactCoverageRequirementV1["scope"] {
    const scope = type.instanceScope!;
    return { kind: "team_cell", teamId: scope.teamId, cellKind: scope.cellKind, field: scope.field };
  }
  return <fieldset className="nested-editor"><legend>Completion requirements</legend>
    <p className="hint">Require submitted records for every enabled cell in the selected Artifact Type's scope. New enabled cells are included automatically.</p>
    {(stage.completionRequirements ?? []).map((requirement, index) => {
      const type = artifacts.find(({ id }) => id === requirement.artifactTypeId);
      const team = coreArray(core, "teams").find(({ id }) => id === requirement.scope.teamId);
      const fieldId = `stage-coverage-${stage.id}-${requirement.id}`;
      return <fieldset className="nested-editor" key={requirement.id}><legend>Required submission {index + 1}</legend>
        <div className="field"><label htmlFor={`${fieldId}-type`}>Required Artifact Type</label>
          <select id={`${fieldId}-type`} value={requirement.artifactTypeId} onChange={(event) => {
            const next = artifacts.find(({ id }) => id === event.target.value);
            if (next) client.transact(() => {
              client.setAtPath([...base, index, "artifactTypeId"], next.id);
              client.setAtPath([...base, index, "scope"], scopeFor(next));
            });
          }}>
            {!type && <option value={requirement.artifactTypeId}>Unavailable scoped Artifact Type — resolve before publication</option>}
            {artifacts.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select></div>
        <div className="field"><label htmlFor={`${fieldId}-minimum`}>Minimum submitted records per cell</label>
          <input id={`${fieldId}-minimum`} type="number" min={1} step={1} value={requirement.minimumPerScope}
            onChange={(event) => client.setAtPath([...base, index, "minimumPerScope"], Number(event.target.value))} /></div>
        <div className="field"><label htmlFor={`${fieldId}-group`}>Count records from Stage Group</label>
          <select id={`${fieldId}-group`} value={requirement.stageGroupId ?? ""} onChange={(event) => event.target.value === ""
            ? client.deleteAtPath([...base, index, "stageGroupId"]) : client.setAtPath([...base, index, "stageGroupId"], event.target.value)}>
            <option value="">All Stage Groups</option>{groups.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select></div>
        <p className="rule-sentence">Complete after at least {requirement.minimumPerScope} {type?.name ?? "record"} submission(s) to Control for each enabled {team?.name ?? "Team"} {requirement.scope.cellKind.replaceAll("_", " ")} cell.</p>
        <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(base, index)}>Remove completion requirement</button>
      </fieldset>;
    })}
    <button className="btn-secondary compact" type="button" disabled={artifacts.length === 0} onClick={() => {
      const type = artifacts[0];
      if (type) client.appendAtPath(base, { id: identifier(), kind: "artifact_coverage", artifactTypeId: type.id,
        scope: scopeFor(type), minimumPerScope: 1, qualifyingMilestone: "submitted_to_control" });
    }}>Add completion requirement</button>
    {artifacts.length === 0 && <p className="hint">A cell-scoped Artifact Type is required before adding a submission requirement.</p>}
  </fieldset>;
}
