import { useMemo, useState } from "react";
import { STUDIO_FOUNDATION_EDITOR_CONTRACT_ID, type RolePreviewV1 } from "@plenum/event-contracts";
import type {
  CoreDesignV1,
  RuntimeStageDefinitionV1,
  ScenarioV1
} from "@plenum/simulation-schema";

import { StudioCollaborationClient } from "../collaboration/client.js";
import { PollEditor } from "../polls/PollEditor.js";
import { VoiceEditor } from "../voice/VoiceEditor.js";
import { PluginCatalogEditor } from "../plugins/PluginCatalogEditor.js";
import { CompositionEditor } from "../compositions/CompositionEditor.js";
import { AdvancedLogicEditor } from "../advanced-logic/AdvancedLogicEditor.js";
import {
  FIELD_TYPES, METHODOLOGY_CONCEPTS, MODULE_TYPES, basicForm, basicInterface, basicStage,
  basicWorkflow, coreArray, defaultGrant, identifier
} from "./model.js";

export type Path = readonly (string | number)[];
export type Option = { value: string; label: string };

const SECTIONS = [
  ["overview", "Overview & Scenario"], ["methodology", "Methodology"], ["teams", "Teams"],
  ["roles", "Session Roles"], ["seats", "Seats"], ["activities", "Activities"], ["stages", "Stages"],
  ["forms", "Forms & Artifacts"], ["workflows", "Workflows"], ["policies", "Information Policy"],
  ["advanced-logic", "Advanced logic & world state"],
  ["polls", "Polls"], ["voice", "Voice Channels"], ["plugins", "Plugin catalog & bindings"],
  ["compositions", "Model Compositions"], ["interfaces", "Interfaces"], ["research", "Research"],
  ["access", "Access"], ["preview", "Role preview"]
] as const;

export function TextField({ id, label, value, path, client, multiline = false, type = "text", transform, emptyDeletes = false }: {
  id: string; label: string; value: string | number; path: Path; client: StudioCollaborationClient;
  multiline?: boolean; type?: "text" | "number"; transform?: (value: string) => unknown; emptyDeletes?: boolean;
}) {
  const props = { id, value, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (emptyDeletes && event.target.value === "") client.deleteAtPath(path);
    else client.setAtPath(path, transform === undefined ? type === "number" ? Number(event.target.value) : event.target.value : transform(event.target.value));
  } };
  return <div className="field"><label htmlFor={id}>{label}</label>
    {multiline ? <textarea {...props} rows={4} /> : <input {...props} type={type} />}</div>;
}

export function SelectField({ id, label, value, options, path, client, emptyDeletes = false }: {
  id: string; label: string; value: string; options: readonly Option[]; path: Path; client: StudioCollaborationClient; emptyDeletes?: boolean;
}) {
  return <div className="field"><label htmlFor={id}>{label}</label><select id={id} value={value}
    onChange={(event) => event.target.value === "" && emptyDeletes ? client.deleteAtPath(path) : client.setAtPath(path, event.target.value)}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></div>;
}

export function CheckField({ id, label, checked, path, client }: {
  id: string; label: string; checked: boolean; path: Path; client: StudioCollaborationClient;
}) {
  return <label className="choice" htmlFor={id}><input id={id} type="checkbox" checked={checked}
    onChange={(event) => client.setAtPath(path, event.target.checked)} />{label}</label>;
}

export function MultiCheck({ legend, values, options, path, client }: {
  legend: string; values: string[]; options: readonly Option[]; path: Path; client: StudioCollaborationClient;
}) {
  return <fieldset className="choice-group"><legend>{legend}</legend>{options.length === 0 ? <p className="hint">Add an option in its editor first.</p> : options.map((option) =>
    <label className="choice" key={option.value}><input type="checkbox" checked={values.includes(option.value)} onChange={(event) => {
      client.setAtPath(path, event.target.checked ? [...values, option.value] : values.filter((value) => value !== option.value));
    }} />{option.label}</label>)}</fieldset>;
}

export function ItemActions({ path, index, count, client, label, duplicate }: {
  path: Path; index: number; count: number; client: StudioCollaborationClient; label: string; duplicate?: () => void;
}) {
  return <div className="item-actions">
    <button className="btn-secondary compact" type="button" disabled={index === 0} aria-label={`Move ${label} earlier`} onClick={() => client.moveAtPath(path, index, -1)}>↑</button>
    <button className="btn-secondary compact" type="button" disabled={index === count - 1} aria-label={`Move ${label} later`} onClick={() => client.moveAtPath(path, index, 1)}>↓</button>
    {duplicate === undefined ? null : <button className="btn-secondary compact" type="button" onClick={duplicate}>Duplicate</button>}
    <button className="btn-danger compact" type="button" onClick={() => { if (confirm(`Remove ${label}? References will remain visible as validation errors.`)) client.removeAtPath(path, index); }}>Remove</button>
  </div>;
}

export function Workspace({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return <section id={id} className="editor-workspace card" aria-labelledby={`${id}-title`}><div className="workspace-heading">
    <div><h2 id={`${id}-title`}>{title}</h2><p>{intro}</p></div></div>{children}</section>;
}

export function AddButton({ label, onClick, disabled = false }: { label: string; onClick(): void; disabled?: boolean }) {
  return <button className="btn-secondary" type="button" disabled={disabled} onClick={onClick}>{label}</button>;
}

function TeamEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const teams = coreArray(core, "teams");
  const objectives = coreArray(core, "objectives");
  const resources = coreArray(core, "resourceDefinitions");
  const duplicateTeam = (team: (typeof teams)[number]) => client.appendAtPath(["coreDesign", "teams"], {
    ...structuredClone(team), id: identifier(), name: `${team.name} copy`,
    relationships: (team.relationships ?? []).map((relationship) => ({ ...relationship, id: identifier() }))
  });
  return <Workspace id="teams" title="Teams" intro="Author Team identity, briefing, objectives, resources, relationships, and availability.">
    <div className="editor-list">{teams.map((team, index) => <details className="editor-item" id={`teams-${team.id}`} key={team.id}>
      <summary><span>{team.name || "Untitled Team"}</span><span className="badge badge-muted">{team.shortCode || `${team.objectiveIds.length} objectives`}</span></summary><div className="item-body grid-fields">
        <TextField id={`team-name-${team.id}`} label="Team name" value={team.name} path={["coreDesign", "teams", index, "name"]} client={client} />
        <TextField id={`team-code-${team.id}`} label="Short code" value={team.shortCode ?? ""} path={["coreDesign", "teams", index, "shortCode"]} client={client} />
        <TextField id={`team-color-${team.id}`} label="Color token or description" value={team.color ?? ""} path={["coreDesign", "teams", index, "color"]} client={client} />
        <TextField id={`team-icon-${team.id}`} label="Icon name" value={team.icon ?? ""} path={["coreDesign", "teams", index, "icon"]} client={client} />
        <TextField id={`team-briefing-${team.id}`} label="Team briefing" value={team.briefing ?? ""} path={["coreDesign", "teams", index, "briefing"]} client={client} multiline />
        <MultiCheck legend="Objectives" values={team.objectiveIds} options={objectives.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "teams", index, "objectiveIds"]} client={client} />
        <MultiCheck legend="Resources" values={team.resourceDefinitionIds ?? []} options={resources.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "teams", index, "resourceDefinitionIds"]} client={client} />
        <fieldset className="nested-editor"><legend>Relationships</legend>{(team.relationships ?? []).map((relationship, relationshipIndex) => <div className="field-row" key={relationship.id}>
          <SelectField id={`team-relationship-target-${relationship.id}`} label="Related Team" value={relationship.targetTeamId}
            options={teams.filter(({ id }) => id !== team.id).map(({ id, name }) => ({ value: id, label: name }))}
            path={["coreDesign", "teams", index, "relationships", relationshipIndex, "targetTeamId"]} client={client} />
          <SelectField id={`team-relationship-kind-${relationship.id}`} label="Relationship" value={relationship.kind}
            options={["allied", "neutral", "opposed", "custom"].map((value) => ({ value, label: value }))}
            path={["coreDesign", "teams", index, "relationships", relationshipIndex, "kind"]} client={client} />
          <TextField id={`team-relationship-description-${relationship.id}`} label="Description" value={relationship.description ?? ""}
            path={["coreDesign", "teams", index, "relationships", relationshipIndex, "description"]} client={client} />
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "teams", index, "relationships"], relationshipIndex)}>Remove relationship</button>
        </div>)}
          <AddButton label="Add relationship" disabled={teams.length < 2} onClick={() => {
            const target = teams.find(({ id }) => id !== team.id);
            if (target !== undefined) client.appendAtPath(["coreDesign", "teams", index, "relationships"], { id: identifier(), targetTeamId: target.id, kind: "neutral" });
          }} />
        </fieldset>
        <CheckField id={`team-enabled-${team.id}`} label="Enabled" checked={team.enabled} path={["coreDesign", "teams", index, "enabled"]} client={client} />
        <ItemActions path={["coreDesign", "teams"]} index={index} count={teams.length} client={client} label={team.name || "Team"} duplicate={() => duplicateTeam(team)} />
      </div></details>)}</div>
    <AddButton label="Add Team" onClick={() => client.appendAtPath(["coreDesign", "teams"], { id: identifier(), name: "New Team", shortCode: "TEAM", objectiveIds: [], relationships: [], enabled: true })} />
  </Workspace>;
}

function RoleEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const roles = coreArray(core, "sessionRoles");
  const teams = coreArray(core, "teams");
  const interfaces = coreArray(core, "interfaces");
  const stages = coreArray(core, "stages");
  return <Workspace id="roles" title="Session Roles" intro="Assign responsibilities, capabilities, clearance, eligible Teams, Stages, and Interface Profiles. Organization Roles are configured elsewhere.">
    <div className="editor-list">{roles.map((role, index) => <details className="editor-item" id={`sessionRoles-${role.id}`} key={role.id}>
      <summary><span>{role.name || "Untitled Session Role"}</span><span className="item-id">{role.id}</span></summary><div className="item-body">
        <TextField id={`role-name-${role.id}`} label="Session Role name" value={role.name} path={["coreDesign", "sessionRoles", index, "name"]} client={client} />
        <TextField id={`role-description-${role.id}`} label="Description" value={role.description ?? ""} path={["coreDesign", "sessionRoles", index, "description"]} client={client} multiline />
        <TextField id={`role-responsibilities-${role.id}`} label="Responsibilities (comma separated)" value={(role.responsibilities ?? []).join(", ")} path={["coreDesign", "sessionRoles", index, "responsibilities"]} client={client} transform={(value) => value.split(",").map((item) => item.trim()).filter(Boolean)} />
        <TextField id={`role-capabilities-${role.id}`} label="Capabilities (comma separated)" value={role.capabilities.map(({ capability }) => capability).join(", ")} path={["coreDesign", "sessionRoles", index, "capabilities"]} client={client} transform={(value) => value.split(",").map((capability) => capability.trim()).filter(Boolean).map((capability) => ({ capability }))} />
        <TextField id={`role-clearance-${role.id}`} label="Information clearance" value={role.informationClearance ?? ""} path={["coreDesign", "sessionRoles", index, "informationClearance"]} client={client} />
        <MultiCheck legend="Eligible Teams" values={role.allowedTeamIds ?? []} options={teams.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "sessionRoles", index, "allowedTeamIds"]} client={client} />
        <MultiCheck legend="Available Stages (none means all)" values={role.allowedStageIds ?? []} options={stages.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "sessionRoles", index, "allowedStageIds"]} client={client} />
        <MultiCheck legend="Interface Profiles" values={role.interfaceProfileIds} options={interfaces.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "sessionRoles", index, "interfaceProfileIds"]} client={client} />
        <CheckField id={`role-control-${role.id}`} label="Control role" checked={role.isControlRole} path={["coreDesign", "sessionRoles", index, "isControlRole"]} client={client} />
        <ItemActions path={["coreDesign", "sessionRoles"]} index={index} count={roles.length} client={client} label={role.name || "Session Role"} duplicate={() => client.appendAtPath(["coreDesign", "sessionRoles"], { ...structuredClone(role), id: identifier(), name: `${role.name} copy` })} />
      </div></details>)}</div>
    <AddButton label="Add Session Role" onClick={() => client.appendAtPath(["coreDesign", "sessionRoles"], { id: identifier(), name: "New Session Role", capabilities: [], interfaceProfileIds: [], isControlRole: false, enabled: true })} />
  </Workspace>;
}

function SeatEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const seats = coreArray(core, "seats");
  const roles = coreArray(core, "sessionRoles");
  const teams = coreArray(core, "teams");
  return <Workspace id="seats" title="Seats" intro="Bind Participants to Session Roles and optional Teams with explicit occupancy bounds.">
    <div className="editor-list">{seats.map((seat, index) => <details className="editor-item" id={`seats-${seat.id}`} key={seat.id}>
      <summary><span>{seat.name || "Untitled Seat"}</span><span className="item-id">{seat.id}</span></summary><div className="item-body grid-fields">
        <TextField id={`seat-name-${seat.id}`} label="Seat name" value={seat.name} path={["coreDesign", "seats", index, "name"]} client={client} />
        <SelectField id={`seat-team-${seat.id}`} label="Team" value={seat.teamId ?? ""} options={[{ value: "", label: "No Team" }, ...teams.map(({ id, name }) => ({ value: id, label: name }))]} path={["coreDesign", "seats", index, "teamId"]} client={client} emptyDeletes />
        <TextField id={`seat-min-${seat.id}`} label="Minimum occupancy" value={seat.minOccupancy} path={["coreDesign", "seats", index, "minOccupancy"]} client={client} type="number" />
        <TextField id={`seat-max-${seat.id}`} label="Maximum occupancy" value={seat.maxOccupancy ?? 0} path={["coreDesign", "seats", index, "maxOccupancy"]} client={client} type="number" />
        <MultiCheck legend="Session Roles" values={seat.sessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "seats", index, "sessionRoleIds"]} client={client} />
        <CheckField id={`seat-required-${seat.id}`} label="Required Seat" checked={seat.required} path={["coreDesign", "seats", index, "required"]} client={client} />
        <ItemActions path={["coreDesign", "seats"]} index={index} count={seats.length} client={client} label={seat.name || "Seat"} duplicate={() => client.appendAtPath(["coreDesign", "seats"], { ...structuredClone(seat), id: identifier(), name: `${seat.name} copy` })} />
      </div></details>)}</div>
    <AddButton label="Add Seat" onClick={() => client.appendAtPath(["coreDesign", "seats"], { id: identifier(), name: "New Seat", sessionRoleIds: [], minOccupancy: 0, maxOccupancy: 1, required: false, joinMode: "operator_assignment" })} />
  </Workspace>;
}

function ActivityEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const activities = coreArray(core, "activities");
  const roles = coreArray(core, "sessionRoles");
  const artifacts = coreArray(core, "artifactTypes");
  return <Workspace id="activities" title="Activities" intro="Define reusable participant work, role requirements, and expected Artifact Types before assigning Activities to Stages.">
    <div className="editor-list">{activities.map((activity, index) => <details className="editor-item" id={`activities-${activity.id}`} key={activity.id}>
      <summary><span>{activity.name || "Untitled Activity"}</span><span className="badge badge-muted">{activity.required ? "required" : "optional"}</span></summary><div className="item-body grid-fields">
        <TextField id={`activity-name-${activity.id}`} label="Activity name" value={activity.name} path={["coreDesign", "activities", index, "name"]} client={client} />
        <TextField id={`activity-description-${activity.id}`} label="Description" value={activity.description ?? ""} path={["coreDesign", "activities", index, "description"]} client={client} multiline />
        <TextField id={`activity-instructions-${activity.id}`} label="Participant instructions" value={activity.instructions ?? ""} path={["coreDesign", "activities", index, "instructions"]} client={client} multiline />
        <MultiCheck legend="Session Role requirements" values={activity.sessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "activities", index, "sessionRoleIds"]} client={client} />
        <MultiCheck legend="Artifact requirements" values={activity.artifactTypeIds} options={artifacts.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "activities", index, "artifactTypeIds"]} client={client} />
        <CheckField id={`activity-required-${activity.id}`} label="Required to complete its Stage" checked={activity.required} path={["coreDesign", "activities", index, "required"]} client={client} />
        <ItemActions path={["coreDesign", "activities"]} index={index} count={activities.length} client={client} label={activity.name || "Activity"} duplicate={() => client.appendAtPath(["coreDesign", "activities"], { ...structuredClone(activity), id: identifier(), name: `${activity.name} copy` })} />
      </div></details>)}</div>
    <AddButton label="Add Activity" onClick={() => client.appendAtPath(["coreDesign", "activities"], { id: identifier(), name: "New Activity", description: "", instructions: "", sessionRoleIds: [], artifactTypeIds: [], required: false })} />
  </Workspace>;
}

function StageEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const groups = coreArray(core, "stageGroups");
  const stages = coreArray(core, "stages");
  const activities = coreArray(core, "activities");
  const canReorder = stages.every((stage) => stage.transitions.length <= 1 && stage.transitionMode !== "parallel" && stage.joinMode === undefined);
  const addStage = () => {
    const stage = basicStage(`Stage ${stages.length + 1}`, stages.length);
    client.transact(() => {
      if (stages.length > 0) client.setAtPath(["coreDesign", "stages", stages.length - 1, "transitions"], [{ id: identifier(), targetStageId: stage.id, label: `Continue to ${stage.name}`, mode: "manual" }]);
      client.appendAtPath(["coreDesign", "stages"], stage);
    });
  };
  const replaceSequentialStages = (next: RuntimeStageDefinitionV1[]) => client.setAtPath(["coreDesign", "stages"], next.map((stage, index) => ({
    ...stage,
    order: index,
    transitions: next[index + 1] === undefined ? [] : [{
      ...(stage.transitions[0] ?? { id: identifier(), mode: "manual" as const }),
      targetStageId: next[index + 1]!.id,
      label: `Continue to ${next[index + 1]!.name}`
    }]
  })));
  const reorderStage = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= stages.length) return;
    const next = structuredClone(stages);
    const [stage] = next.splice(index, 1);
    if (stage !== undefined) next.splice(destination, 0, stage);
    replaceSequentialStages(next);
  };
  return <Workspace id="stages" title="Stages" intro="Build bounded acyclic Stage graphs with sequential, conditional, or parallel fork/join behavior.">
    <h3>Stage Groups</h3><div className="editor-list compact-list">{groups.map((group, index) => <details className="editor-item" id={`stageGroups-${group.id}`} key={group.id}><summary>{group.name}</summary><div className="item-body grid-fields">
      <TextField id={`group-name-${group.id}`} label="Group name" value={group.name} path={["coreDesign", "stageGroups", index, "name"]} client={client} />
      <TextField id={`group-type-${group.id}`} label="Stage Type label" value={group.stageType} path={["coreDesign", "stageGroups", index, "stageType"]} client={client} />
      <SelectField id={`group-parent-${group.id}`} label="Parent Stage Group" value={group.parentGroupId ?? ""}
        options={[{ value: "", label: "Top level" }, ...groups.filter(({ id }) => id !== group.id).map(({ id, name }) => ({ value: id, label: name }))]}
        path={["coreDesign", "stageGroups", index, "parentGroupId"]} client={client} emptyDeletes />
      <ItemActions path={["coreDesign", "stageGroups"]} index={index} count={groups.length} client={client} label={group.name} duplicate={() => client.appendAtPath(["coreDesign", "stageGroups"], { ...structuredClone(group), id: identifier(), name: `${group.name} copy`, parentGroupId: group.parentGroupId })} />
    </div></details>)}</div>
    <AddButton label="Add Stage Group" onClick={() => client.appendAtPath(["coreDesign", "stageGroups"], { id: identifier(), name: "New Stage Group", stageType: "group", order: groups.length })} />
    <h3>Sequential timeline</h3><ol className="timeline">{stages.map((stage, index) => <li key={stage.id}><details className="editor-item" id={`stages-${stage.id}`}>
      <summary><span>{stage.name}</span><span className="badge badge-muted">{stage.stageType}</span></summary><div className="item-body grid-fields">
        <TextField id={`stage-name-${stage.id}`} label="Stage name" value={stage.name} path={["coreDesign", "stages", index, "name"]} client={client} />
        <TextField id={`stage-type-${stage.id}`} label="Stage Type" value={stage.stageType} path={["coreDesign", "stages", index, "stageType"]} client={client} />
        <TextField id={`stage-instructions-${stage.id}`} label="Stage instructions" value={stage.instructions ?? ""} path={["coreDesign", "stages", index, "instructions"]} client={client} multiline />
        <SelectField id={`stage-group-${stage.id}`} label="Parent Stage Group" value={stage.stageGroupId ?? ""} options={[{ value: "", label: "No parent" }, ...groups.map(({ id, name }) => ({ value: id, label: name }))]} path={["coreDesign", "stages", index, "stageGroupId"]} client={client} emptyDeletes />
        <TextField id={`stage-duration-${stage.id}`} label="Duration in seconds (0 for untimed)" value={stage.durationSeconds ?? 0} path={["coreDesign", "stages", index, "durationSeconds"]} client={client} type="number" />
        <SelectField id={`stage-timer-${stage.id}`} label="Timer behavior" value={stage.timerMode ?? "none"}
          options={[{ value: "none", label: "No timer" }, { value: "countdown", label: "Count down" }, { value: "countup", label: "Count up" }]}
          path={["coreDesign", "stages", index, "timerMode"]} client={client} />
        <MultiCheck legend="Available Activities" values={stage.allowedActivityIds} options={activities.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "stages", index, "allowedActivityIds"]} client={client} />
        <SelectField id={`stage-transition-mode-${stage.id}`} label="Outgoing branch behavior" value={stage.transitionMode ?? "exclusive"}
          options={[{ value: "exclusive", label: "Choose one passing branch" }, { value: "parallel", label: "Start all passing branches" }]}
          path={["coreDesign", "stages", index, "transitionMode"]} client={client} />
        {stage.transitionMode === "parallel" && <SelectField id={`stage-parallel-join-${stage.id}`} label="Parallel join Stage" value={stage.parallelJoinStageId ?? ""}
          options={[{ value: "", label: "Choose a join Stage" }, ...stages.filter(({ id, joinMode }) => id !== stage.id && joinMode !== undefined).map(({ id, name }) => ({ value: id, label: name }))]}
          path={["coreDesign", "stages", index, "parallelJoinStageId"]} client={client} emptyDeletes />}
        <SelectField id={`stage-join-mode-${stage.id}`} label="Incoming merge behavior" value={stage.joinMode ?? ""}
          options={[{ value: "", label: "Not a merge" }, { value: "all", label: "Wait for all branches" }, { value: "first", label: "Accept first branch" }]}
          path={["coreDesign", "stages", index, "joinMode"]} client={client} emptyDeletes />
        <fieldset className="choice-group"><legend>Operator controls</legend>
          <CheckField id={`stage-control-start-${stage.id}`} label="Allow start" checked={stage.operatorControls.allowStart} path={["coreDesign", "stages", index, "operatorControls", "allowStart"]} client={client} />
          <CheckField id={`stage-control-end-${stage.id}`} label="Allow end" checked={stage.operatorControls.allowEnd} path={["coreDesign", "stages", index, "operatorControls", "allowEnd"]} client={client} />
          <CheckField id={`stage-control-extend-${stage.id}`} label="Allow timer extension" checked={stage.operatorControls.allowExtend} path={["coreDesign", "stages", index, "operatorControls", "allowExtend"]} client={client} />
          <CheckField id={`stage-control-skip-${stage.id}`} label="Allow skip" checked={stage.operatorControls.allowSkip} path={["coreDesign", "stages", index, "operatorControls", "allowSkip"]} client={client} />
          <CheckField id={`stage-control-return-${stage.id}`} label="Allow return to previous" checked={stage.operatorControls.allowReturnToPrevious} path={["coreDesign", "stages", index, "operatorControls", "allowReturnToPrevious"]} client={client} />
          <CheckField id={`stage-control-reason-${stage.id}`} label="Require reason for control action" checked={stage.operatorControls.requireReason} path={["coreDesign", "stages", index, "operatorControls", "requireReason"]} client={client} />
        </fieldset>
        <fieldset className="nested-editor"><legend>Transitions</legend>{stage.transitions.map((transition, transitionIndex) => <div className="field-row" key={transition.id}>
          <SelectField id={`stage-transition-target-${transition.id}`} label="Target Stage" value={transition.targetStageId}
            options={stages.filter(({ id }) => id !== stage.id).map(({ id, name }) => ({ value: id, label: name }))}
            path={["coreDesign", "stages", index, "transitions", transitionIndex, "targetStageId"]} client={client} />
          <TextField id={`stage-transition-label-${transition.id}`} label="Transition label" value={transition.label ?? ""}
            path={["coreDesign", "stages", index, "transitions", transitionIndex, "label"]} client={client} />
          <SelectField id={`stage-transition-mode-${transition.id}`} label="Transition timing" value={transition.mode}
            options={[{ value: "manual", label: "Operator chooses" }, { value: "automatic", label: "Automatic when eligible" }, { value: "automatic_or_manual", label: "Automatic or operator" }]}
            path={["coreDesign", "stages", index, "transitions", transitionIndex, "mode"]} client={client} />
          <TextField id={`stage-transition-priority-${transition.id}`} label="Priority" value={transition.priority ?? transitionIndex}
            path={["coreDesign", "stages", index, "transitions", transitionIndex, "priority"]} client={client} type="number" />
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "stages", index, "transitions"], transitionIndex)}>Remove transition</button>
        </div>)}
          <button className="btn-secondary compact" type="button" disabled={stages.length < 2} onClick={() => {
            const target = stages.find(({ id }) => id !== stage.id);
            if (target !== undefined) client.appendAtPath(["coreDesign", "stages", index, "transitions"], {
              id: identifier(), targetStageId: target.id, label: `Continue to ${target.name}`, mode: "manual", priority: stage.transitions.length
            });
          }}>Add transition</button>
        </fieldset>
        <div className="item-actions">
          <button className="btn-secondary compact" type="button" disabled={!canReorder || index === 0} onClick={() => reorderStage(index, -1)}>Earlier</button>
          <button className="btn-secondary compact" type="button" disabled={!canReorder || index === stages.length - 1} onClick={() => reorderStage(index, 1)}>Later</button>
          <button className="btn-secondary compact" type="button" disabled={!canReorder} onClick={() => {
            const copy = { ...structuredClone(stage), id: identifier(), name: `${stage.name} copy`, transitions: [] };
            replaceSequentialStages([...stages.slice(0, index + 1), copy, ...stages.slice(index + 1)]);
          }}>Duplicate</button>
          <button className="btn-danger compact" type="button" disabled={!canReorder} onClick={() => { if (confirm(`Remove ${stage.name}? References will remain visible as validation errors.`)) replaceSequentialStages(stages.filter((_, candidate) => candidate !== index)); }}>Remove</button>
        </div>
      </div></details></li>)}</ol>
    {!canReorder && <p className="hint">Reordering is unavailable while an advanced branching transition is present.</p>}
    {canReorder && <AddButton label="Add next Stage" onClick={addStage} />}
  </Workspace>;
}

function FormsEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const forms = coreArray(core, "forms");
  const artifacts = coreArray(core, "artifactTypes");
  const workflows = coreArray(core, "workflows");
  const policies = coreArray(core, "informationPolicies");
  const roles = coreArray(core, "sessionRoles");
  const addFormAndArtifact = () => {
    const form = basicForm("New Form");
    const artifactId = identifier();
    client.transact(() => {
      client.appendAtPath(["coreDesign", "forms"], form);
      client.appendAtPath(["coreDesign", "artifactTypes"], {
        id: artifactId, key: artifactId, name: "New Artifact Type", formId: form.id, workflowId: workflows[0]?.id ?? "",
        informationPolicyId: policies[0]?.id ?? "", allowedCreatorSessionRoleIds: roles[0] === undefined ? [] : [roles[0].id],
        ownership: "team", decisionBearing: false, versioning: "full_history", exportable: true
      });
    });
  };
  return <Workspace id="forms" title="Forms & Artifact Types" intro="One Artifact Type definition owns its Form, workflow, Information Policy, and export behavior. Field support is bounded by OPEN-010.">
    <div className="editor-list">{forms.map((form, formIndex) => {
      const artifact = artifacts.find((item) => item.formId === form.id);
      const artifactIndex = artifacts.findIndex((item) => item.id === artifact?.id);
      return <details className="editor-item" id={`forms-${form.id}`} key={form.id}><summary><span>{artifact?.name ?? form.name}</span><span className="item-id">{form.id}</span></summary><div className="item-body">
        <TextField id={`form-name-${form.id}`} label="Form name" value={form.name} path={["coreDesign", "forms", formIndex, "name"]} client={client} />
        {artifact === undefined ? <p className="status-error">This Form is not linked to an Artifact Type.</p> : <div className="grid-fields">
          <TextField id={`artifact-name-${artifact.id}`} label="Artifact Type name" value={artifact.name} path={["coreDesign", "artifactTypes", artifactIndex, "name"]} client={client} />
          <SelectField id={`artifact-owner-${artifact.id}`} label="Ownership" value={artifact.ownership} options={["individual", "team", "session"].map((value) => ({ value, label: value }))} path={["coreDesign", "artifactTypes", artifactIndex, "ownership"]} client={client} />
          <SelectField id={`artifact-workflow-${artifact.id}`} label="Workflow" value={artifact.workflowId} options={workflows.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "artifactTypes", artifactIndex, "workflowId"]} client={client} />
          <SelectField id={`artifact-policy-${artifact.id}`} label="Information Policy" value={artifact.informationPolicyId} options={policies.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "artifactTypes", artifactIndex, "informationPolicyId"]} client={client} />
          <MultiCheck legend="Creator Session Roles" values={artifact.allowedCreatorSessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "artifactTypes", artifactIndex, "allowedCreatorSessionRoleIds"]} client={client} />
          <CheckField id={`artifact-decision-${artifact.id}`} label="Decision-bearing" checked={artifact.decisionBearing} path={["coreDesign", "artifactTypes", artifactIndex, "decisionBearing"]} client={client} />
          <CheckField id={`artifact-export-${artifact.id}`} label="Exportable" checked={artifact.exportable} path={["coreDesign", "artifactTypes", artifactIndex, "exportable"]} client={client} />
        </div>}
        {form.sections.map((section, sectionIndex) => <fieldset className="nested-editor" key={section.id}><legend>{section.title ?? "Form section"}</legend>
          <TextField id={`section-title-${section.id}`} label="Section title" value={section.title ?? ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "title"]} client={client} />
          {section.fields.map((field, fieldIndex) => <div className="field-row" key={field.id}>
            <TextField id={`field-label-${field.id}`} label="Field label" value={field.label} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "label"]} client={client} />
            <TextField id={`field-key-${field.id}`} label="Field key" value={field.key} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "key"]} client={client} />
            <SelectField id={`field-type-${field.id}`} label="Field type" value={field.type} options={FIELD_TYPES.map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "type"]} client={client} />
            <CheckField id={`field-required-${field.id}`} label="Required" checked={field.required === true} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "required"]} client={client} />
            <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields"], fieldIndex)}>Remove field</button>
          </div>)}
          <AddButton label="Add field" onClick={() => client.appendAtPath(["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields"], { id: identifier(), key: `field_${section.fields.length + 1}`, label: "New field", type: "short_text", required: false })} />
        </fieldset>)}
      </div></details>;
    })}</div>
    <AddButton label="Add Form and Artifact Type" disabled={workflows.length === 0 || policies.length === 0 || roles.length === 0} onClick={addFormAndArtifact} />
    {(workflows.length === 0 || policies.length === 0 || roles.length === 0) && <p className="hint">Add a Workflow, Information Policy, and Session Role first.</p>}
  </Workspace>;
}

function WorkflowEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const workflows = coreArray(core, "workflows");
  const roles = coreArray(core, "sessionRoles");
  return <Workspace id="workflows" title="Workflows" intro="Build bounded conditional review paths. Every state must remain reachable and able to terminate; loops remain unavailable.">
    <div className="editor-list">{workflows.map((workflow, index) => <details className="editor-item" id={`workflows-${workflow.id}`} key={workflow.id}><summary><span>{workflow.name}</span><span className="badge badge-muted">{workflow.states.length} states</span></summary><div className="item-body">
      <TextField id={`workflow-name-${workflow.id}`} label="Workflow name" value={workflow.name} path={["coreDesign", "workflows", index, "name"]} client={client} />
      <SelectField id={`workflow-initial-${workflow.id}`} label="Initial state" value={workflow.initialState} options={workflow.states.map(({ key, label }) => ({ value: key, label }))} path={["coreDesign", "workflows", index, "initialState"]} client={client} />
      <ol className="workflow-list">{workflow.states.map((state, stateIndex) => <li key={state.key}><div className="field-row">
        <TextField id={`workflow-state-${workflow.id}-${stateIndex}`} label="State label" value={state.label} path={["coreDesign", "workflows", index, "states", stateIndex, "label"]} client={client} />
        <SelectField id={`workflow-kind-${workflow.id}-${stateIndex}`} label="State kind" value={state.kind} options={["draft", "task", "review", "approval", "wait", "terminal", "cancelled"].map((value) => ({ value, label: value }))} path={["coreDesign", "workflows", index, "states", stateIndex, "kind"]} client={client} />
        {state.kind === "task" || state.kind === "review" || state.kind === "approval" ? <MultiCheck legend="Holder Session Roles" values={state.holderSessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "workflows", index, "states", stateIndex, "holderSessionRoleIds"]} client={client} /> : null}
        {state.kind === "approval" && <div className="field"><label htmlFor={`workflow-quorum-${workflow.id}-${stateIndex}`}>Approval rule</label>
          <select id={`workflow-quorum-${workflow.id}-${stateIndex}`} value={state.quorum?.rule ?? ""} onChange={(event) => event.target.value === ""
            ? client.deleteAtPath(["coreDesign", "workflows", index, "states", stateIndex, "quorum"])
            : client.setAtPath(["coreDesign", "workflows", index, "states", stateIndex, "quorum"], {
              rule: event.target.value, ...(event.target.value === "quorum" ? { minimumApprovals: 1 } : {})
            })}>
            <option value="">Role permission only</option><option value="any_one">Any one</option><option value="majority">Majority</option>
            <option value="quorum">Fixed quorum</option><option value="unanimous">Unanimous</option>
          </select></div>}
        {state.quorum?.rule === "quorum" && <TextField id={`workflow-quorum-min-${workflow.id}-${stateIndex}`} label="Minimum approvals" value={state.quorum.minimumApprovals ?? 1} type="number" path={["coreDesign", "workflows", index, "states", stateIndex, "quorum", "minimumApprovals"]} client={client} />}
      </div></li>)}</ol>
      <AddButton label="Add Workflow state" onClick={() => client.appendAtPath(["coreDesign", "workflows", index, "states"], {
        key: identifier(), label: "New state", kind: "task", holderSessionRoleIds: roles[0] === undefined ? [] : [roles[0].id]
      })} />
      <div className="rule-list">{workflow.transitions.map((transition, transitionIndex) => <fieldset className="nested-editor" key={transition.id}><legend>{transition.label ?? transition.command}</legend>
        <div className="field"><label htmlFor={`workflow-from-${transition.id}`}>From state</label><select id={`workflow-from-${transition.id}`}
          value={transition.from ?? ""} onChange={(event) => client.setAtPath(["coreDesign", "workflows", index, "transitions", transitionIndex, "from"], event.target.value === "" ? null : event.target.value)}>
          <option value="">Artifact creation</option>{workflow.states.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select></div>
        <TextField id={`workflow-command-${transition.id}`} label="Command" value={transition.command} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "command"]} client={client} />
        <SelectField id={`workflow-to-${transition.id}`} label="Target state" value={transition.to} options={workflow.states.map(({ key, label }) => ({ value: key, label }))} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "to"]} client={client} />
        <MultiCheck legend="Allowed Session Roles" values={transition.allowedSessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "allowedSessionRoleIds"]} client={client} />
        <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "workflows", index, "transitions"], transitionIndex)}>Remove transition</button>
      </fieldset>)}</div>
      <AddButton label="Add Workflow transition" onClick={() => client.appendAtPath(["coreDesign", "workflows", index, "transitions"], {
        id: identifier(), from: workflow.initialState, command: "artifact.advance", label: "Advance",
        to: workflow.states.find(({ kind }) => kind === "terminal")?.key ?? workflow.initialState,
        allowedSessionRoleIds: roles[0] === undefined ? [] : [roles[0].id], priority: 0
      })} />
      <ItemActions path={["coreDesign", "workflows"]} index={index} count={workflows.length} client={client} label={workflow.name} />
    </div></details>)}</div>
    <AddButton label="Add review Workflow template" disabled={roles.length === 0} onClick={() => client.appendAtPath(["coreDesign", "workflows"], basicWorkflow("New review Workflow", roles[0]?.id))} />
  </Workspace>;
}

function PolicyEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const policies = coreArray(core, "informationPolicies");
  const roles = coreArray(core, "sessionRoles");
  const teams = coreArray(core, "teams");
  return <Workspace id="policies" title="Information Policy" intro="New policies start denied. Add only the audiences that should receive the record; leakage blocks Publication.">
    <div className="editor-list">{policies.map((policy, index) => <details className="editor-item" id={`informationPolicies-${policy.id}`} key={policy.id}><summary><span>{policy.name}</span><span className={`badge ${policy.grants.length === 0 ? "badge-error" : "badge-online"}`}>{policy.grants.length === 0 ? "Deny all" : `${policy.grants.length} grant${policy.grants.length === 1 ? "" : "s"}`}</span></summary><div className="item-body">
      <TextField id={`policy-name-${policy.id}`} label="Policy name" value={policy.name} path={["coreDesign", "informationPolicies", index, "name"]} client={client} />
      <SelectField id={`policy-class-${policy.id}`} label="Classification" value={policy.classification ?? "internal"} options={["public", "internal", "confidential", "restricted"].map((value) => ({ value, label: value }))} path={["coreDesign", "informationPolicies", index, "classification"]} client={client} />
      {policy.grants.map((grant, grantIndex) => <fieldset className="nested-editor" key={`${policy.id}-${grantIndex}`}><legend>Allowed audience {grantIndex + 1}</legend>
        <MultiCheck legend="Session Roles" values={grant.audience.sessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "informationPolicies", index, "grants", grantIndex, "audience", "sessionRoleIds"]} client={client} />
        <MultiCheck legend="Teams" values={grant.audience.teamIds ?? []} options={teams.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "informationPolicies", index, "grants", grantIndex, "audience", "teamIds"]} client={client} />
        <CheckField id={`policy-public-${policy.id}-${grantIndex}`} label="Public audience" checked={grant.audience.public === true} path={["coreDesign", "informationPolicies", index, "grants", grantIndex, "audience", "public"]} client={client} />
        <SelectField id={`policy-release-${policy.id}-${grantIndex}`} label="Release timing" value={grant.release?.mode ?? "immediate"} options={["immediate", "at_stage", "after_seconds", "on_gate", "manual"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "informationPolicies", index, "grants", grantIndex, "release", "mode"]} client={client} />
        <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "informationPolicies", index, "grants"], grantIndex)}>Remove grant</button>
      </fieldset>)}
      <AddButton label="Allow an audience" onClick={() => client.appendAtPath(["coreDesign", "informationPolicies", index, "grants"], defaultGrant(roles[0]?.id))} />
      <ItemActions path={["coreDesign", "informationPolicies"]} index={index} count={policies.length} client={client} label={policy.name} />
    </div></details>)}</div>
    <AddButton label="Add deny-by-default policy" onClick={() => client.appendAtPath(["coreDesign", "informationPolicies"], { id: identifier(), name: "New Information Policy", classification: "internal", grants: [] })} />
  </Workspace>;
}

function InterfaceEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const profiles = coreArray(core, "interfaces");
  const roles = coreArray(core, "sessionRoles");
  const stages = coreArray(core, "stages");
  return <Workspace id="interfaces" title="Interfaces" intro="Choose curated modules and a responsive layout template. Arbitrary pixel positioning is not available.">
    <div className="editor-list">{profiles.map((profile, index) => <details className="editor-item" id={`interfaces-${profile.id}`} key={profile.id}><summary><span>{profile.name}</span><span className="badge badge-muted">{profile.layout.template.replaceAll("_", " ")}</span></summary><div className="item-body">
      <TextField id={`interface-name-${profile.id}`} label="Interface Profile name" value={profile.name} path={["coreDesign", "interfaces", index, "name"]} client={client} />
      <SelectField id={`interface-layout-${profile.id}`} label="Layout template" value={profile.layout.template} options={["single_column", "main_sidebar", "dashboard", "workspace"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "interfaces", index, "layout", "template"]} client={client} />
      <MultiCheck legend="Session Roles" values={profile.selectors.sessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "interfaces", index, "selectors", "sessionRoleIds"]} client={client} />
      <MultiCheck legend="Visible Stages (none means all)" values={profile.selectors.stageIds ?? []} options={stages.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "interfaces", index, "selectors", "stageIds"]} client={client} />
      {profile.layout.regions.map((region, regionIndex) => <fieldset className="nested-editor" key={region.id}><legend>Region {regionIndex + 1}</legend>
        {region.modules.map((module, moduleIndex) => <div className="field-row" key={module.id}>
          <TextField id={`module-title-${module.id}`} label="Module title" value={module.title ?? ""} path={["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules", moduleIndex, "title"]} client={client} />
          <SelectField id={`module-type-${module.id}`} label="Module" value={module.moduleType} options={MODULE_TYPES.map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules", moduleIndex, "moduleType"]} client={client} />
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules"], moduleIndex)}>Remove module</button>
        </div>)}
        <AddButton label="Add module" onClick={() => client.appendAtPath(["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules"], { id: identifier(), moduleType: "session_status", title: "Session status", configuration: { mode: "read", emptyStateText: "Nothing is available." } })} />
      </fieldset>)}
      <ItemActions path={["coreDesign", "interfaces"]} index={index} count={profiles.length} client={client} label={profile.name} />
    </div></details>)}</div>
    <AddButton label="Add Interface Profile" onClick={() => client.appendAtPath(["coreDesign", "interfaces"], basicInterface("New Interface Profile", roles[0]?.id))} />
  </Workspace>;
}

function MethodologyEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const concepts = coreArray(core, "methodologyConcepts");
  const authoredCounts: Record<string, number> = {
    team: coreArray(core, "teams").length, stage: coreArray(core, "stages").length,
    session_role: coreArray(core, "sessionRoles").length, seat: coreArray(core, "seats").length,
    artifact_type: coreArray(core, "artifactTypes").length, workflow_definition: coreArray(core, "workflows").length,
    information_policy: coreArray(core, "informationPolicies").length, decision_record: coreArray(core, "decisionTraceability").length,
    research_question: coreArray(core, "researchQuestions").length
  };
  const changeConcept = (index: number, enabled: boolean) => {
    const concept = concepts[index];
    if (concept === undefined || enabled) return client.setAtPath(["coreDesign", "methodologyConcepts", index, "enabled"], enabled);
    const dependents = concepts.filter((candidate) => candidate.enabled && candidate.dependsOn.includes(concept.key)).map(({ label }) => label);
    const authored = authoredCounts[concept.key] ?? 0;
    const impact = [...dependents.map((label) => `${label} depends on it`), ...(authored === 0 ? [] : [`${authored} authored item${authored === 1 ? "" : "s"} remain`])];
    if (impact.length === 0 || confirm(`Disable ${concept.label}? ${impact.join("; ")}. Publication will remain blocked until dependencies are resolved.`)) {
      client.setAtPath(["coreDesign", "methodologyConcepts", index, "enabled"], false);
    }
  };
  return <Workspace id="methodology" title="Methodology" intro="These optional controls are a visible proposal pending OPEN-004. Disabled concepts retain authored content, and unresolved dependencies block Publication.">
    {concepts.length === 0 ? <AddButton label="Add methodology controls" onClick={() => client.setAtPath(["coreDesign", "methodologyConcepts"], METHODOLOGY_CONCEPTS)} /> :
      <div className="concept-grid">{concepts.map((concept, index) => <div className="concept-row" key={concept.key}>
        <label className="choice" htmlFor={`concept-${concept.key}`}><input id={`concept-${concept.key}`} type="checkbox" checked={concept.enabled} onChange={(event) => changeConcept(index, event.target.checked)} />{concept.label}</label>
        <span>{concept.dependsOn.length === 0 ? "No dependencies" : `Depends on ${concept.dependsOn.join(", ")}`}</span>
      </div>)}</div>}
  </Workspace>;
}

function ResearchEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const questions = coreArray(core, "researchQuestions");
  const traces = coreArray(core, "decisionTraceability");
  const artifacts = coreArray(core, "artifactTypes").filter((item) => item.decisionBearing);
  const roles = coreArray(core, "sessionRoles");
  const initialize = () => client.transact(() => {
    client.setAtPath(["coreDesign", "researchQuestions"], []);
    client.setAtPath(["coreDesign", "decisionTraceability"], []);
  });
  return <Workspace id="research" title="Research & Decisions" intro="Link every decision-bearing Artifact Type to its question, owner, trigger, evidence needs, available actions, adjudication, effects, and measurements.">
    {!Array.isArray(core.researchQuestions) || !Array.isArray(core.decisionTraceability) ? <AddButton label="Enable research traceability" onClick={initialize} /> : <>
      <h3>Research Questions</h3>{questions.map((question, index) => <div className="field-row" key={question.id}><TextField id={`question-${question.id}`} label={`Question ${index + 1}`} value={question.question} path={["coreDesign", "researchQuestions", index, "question"]} client={client} /><button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "researchQuestions"], index)}>Remove</button></div>)}
      <AddButton label="Add Research Question" onClick={() => client.appendAtPath(["coreDesign", "researchQuestions"], { id: identifier(), question: "What decision behavior should this simulation reveal?" })} />
      <h3>Decision traceability matrix</h3>{artifacts.map((artifact) => {
        const traceIndex = traces.findIndex((trace) => trace.artifactTypeId === artifact.id);
        const trace = traces[traceIndex];
        if (trace === undefined) return <div className="trace-row" key={artifact.id}><strong>{artifact.name}</strong><AddButton label="Add trace" onClick={() => client.appendAtPath(["coreDesign", "decisionTraceability"], { id: identifier(), artifactTypeId: artifact.id, researchQuestionIds: [], ownerSessionRoleId: roles[0]?.id ?? "", trigger: "During an active Stage", informationRequirements: "", availableActions: "", adjudicationMethod: "Human review", affectedStateVariableIds: [], measurementDefinitionIds: [] })} /></div>;
        return <details className="editor-item" id={`artifactTypes-${artifact.id}`} key={artifact.id}><summary>{artifact.name}</summary><div className="item-body grid-fields">
          <MultiCheck legend="Research Questions" values={trace.researchQuestionIds} options={questions.map(({ id, question }) => ({ value: id, label: question }))} path={["coreDesign", "decisionTraceability", traceIndex, "researchQuestionIds"]} client={client} />
          <SelectField id={`trace-owner-${trace.id}`} label="Decision owner" value={trace.ownerSessionRoleId} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "decisionTraceability", traceIndex, "ownerSessionRoleId"]} client={client} />
          <TextField id={`trace-trigger-${trace.id}`} label="Trigger" value={trace.trigger} path={["coreDesign", "decisionTraceability", traceIndex, "trigger"]} client={client} />
          <TextField id={`trace-info-${trace.id}`} label="Information requirements" value={trace.informationRequirements} path={["coreDesign", "decisionTraceability", traceIndex, "informationRequirements"]} client={client} multiline />
          <TextField id={`trace-actions-${trace.id}`} label="Available actions" value={trace.availableActions} path={["coreDesign", "decisionTraceability", traceIndex, "availableActions"]} client={client} multiline />
          <TextField id={`trace-adjudication-${trace.id}`} label="Adjudication method" value={trace.adjudicationMethod} path={["coreDesign", "decisionTraceability", traceIndex, "adjudicationMethod"]} client={client} />
        </div></details>;
      })}
    </>}
  </Workspace>;
}

function ScenarioEditor({ core, scenario, client }: { core: CoreDesignV1; scenario: ScenarioV1; client: StudioCollaborationClient }) {
  const content = scenario.content ?? [];
  const objectives = coreArray(core, "objectives");
  const identity = core.identity;
  return <Workspace id="overview" title="Overview & Scenario" intro="Define exercise identity and content with ordinary controls. Scenario content is excluded from template copies unless explicitly chosen.">
    <h3>Core Design identity</h3><div className="grid-fields">
      <TextField id="identity-title" label="Core Design title" value={identity?.title ?? ""} path={["coreDesign", "identity", "title"]} client={client} />
      <TextField id="identity-subtitle" label="Subtitle" value={identity?.subtitle ?? ""} path={["coreDesign", "identity", "subtitle"]} client={client} />
      <TextField id="identity-developer" label="Developer or owner" value={identity?.developer ?? ""} path={["coreDesign", "identity", "developer"]} client={client} />
      <TextField id="identity-summary" label="Summary" value={identity?.summary ?? ""} path={["coreDesign", "identity", "summary"]} client={client} multiline />
      <TextField id="identity-purpose" label="Purpose" value={identity?.purpose ?? ""} path={["coreDesign", "identity", "purpose"]} client={client} multiline />
      <TextField id="identity-audience" label="Intended audience" value={identity?.audience ?? ""} path={["coreDesign", "identity", "audience"]} client={client} />
      <TextField id="identity-duration" label="Estimated duration (minutes)" value={identity?.estimatedDurationMinutes ?? 0} path={["coreDesign", "identity", "estimatedDurationMinutes"]} client={client} type="number" />
    </div>
    <h3>Learning objectives</h3><div className="editor-list compact-list">{objectives.map((objective, index) => <details className="editor-item" id={`objectives-${objective.id}`} key={objective.id}>
      <summary>{objective.name || "Untitled objective"}</summary><div className="item-body grid-fields">
        <TextField id={`objective-name-${objective.id}`} label="Objective name" value={objective.name} path={["coreDesign", "objectives", index, "name"]} client={client} />
        <TextField id={`objective-description-${objective.id}`} label="Description" value={objective.description} path={["coreDesign", "objectives", index, "description"]} client={client} multiline />
        <TextField id={`objective-measures-${objective.id}`} label="Success measures (comma separated)" value={(objective.successMeasures ?? []).join(", ")} path={["coreDesign", "objectives", index, "successMeasures"]} client={client} transform={(value) => value.split(",").map((item) => item.trim()).filter(Boolean)} />
        <ItemActions path={["coreDesign", "objectives"]} index={index} count={objectives.length} client={client} label={objective.name || "objective"} duplicate={() => client.appendAtPath(["coreDesign", "objectives"], { ...structuredClone(objective), id: identifier(), name: `${objective.name} copy` })} />
      </div></details>)}</div>
    <AddButton label="Add learning objective" onClick={() => client.appendAtPath(["coreDesign", "objectives"], { id: identifier(), name: "New objective", description: "", successMeasures: [] })} />
    <h3>Terminology</h3><p className="hint">Blank fields use the canonical labels. Custom labels do not change stable identifiers.</p><div className="grid-fields">
      <TextField id="terminology-team" label="Custom label for Team" value={core.terminology?.customLabels.Team ?? ""} path={["coreDesign", "terminology", "customLabels", "Team"]} client={client} emptyDeletes />
      <TextField id="terminology-role" label="Custom label for Session Role" value={core.terminology?.customLabels["Session Role"] ?? ""} path={["coreDesign", "terminology", "customLabels", "Session Role"]} client={client} emptyDeletes />
      <TextField id="terminology-stage" label="Custom label for Stage" value={core.terminology?.customLabels.Stage ?? ""} path={["coreDesign", "terminology", "customLabels", "Stage"]} client={client} emptyDeletes />
    </div>
    <h3>Scenario</h3><div className="grid-fields"><TextField id="scenario-name" label="Scenario name" value={scenario.name} path={["scenario", "name"]} client={client} />
      <TextField id="scenario-description" label="Scenario description" value={scenario.description} path={["scenario", "description"]} client={client} multiline />
      <TextField id="scenario-tags" label="Tags (comma separated)" value={scenario.tags.join(", ")} path={["scenario", "tags"]} client={client} transform={(value) => value.split(",").map((item) => item.trim()).filter(Boolean)} />
      <MultiCheck legend="Delivery modes" values={scenario.deliveryModes} options={["in_person", "virtual", "hybrid", "asynchronous"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["scenario", "deliveryModes"]} client={client} /></div>
    <h3>Scenario content</h3><div className="editor-list compact-list">{content.map((item, index) => <details className="editor-item" id={`scenario-content-${item.id}`} key={item.id}><summary>{item.title}</summary><div className="item-body">
      <TextField id={`content-title-${item.id}`} label="Title" value={item.title} path={["scenario", "content", index, "title"]} client={client} />
      <TextField id={`content-body-${item.id}`} label="Content" value={item.body ?? ""} path={["scenario", "content", index, "body"]} client={client} multiline />
      <TextField id={`content-policy-${item.id}`} label="Information Policy ID" value={item.informationPolicyId} path={["scenario", "content", index, "informationPolicyId"]} client={client} />
      <ItemActions path={["scenario", "content"]} index={index} count={content.length} client={client} label={item.title} />
    </div></details>)}</div>
    <AddButton label="Add Scenario content" onClick={() => client.appendAtPath(["scenario", "content"], { id: identifier(), title: "New content", type: "rich_text", body: "", informationPolicyId: "", version: "1" })} />
  </Workspace>;
}

function AccessEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const policy = core.accessPolicy;
  if (policy === undefined) return <Workspace id="access" title="Access" intro="A session code identifies a Session but never grants access by itself."><AddButton label="Add access policy" onClick={() => client.setAtPath(["coreDesign", "accessPolicy"], { joinMethods: ["operator_assignment"], guests: { allowed: false, requiredFields: [], expiryHours: 0, includeInResearchExports: false, operatorApproval: true }, displays: [], reassignment: { allowedBy: "operator", crossTeamAllowed: false, exposureAcknowledgementRequired: true }, readiness: [] })} /></Workspace>;
  const methods = ["invitation", "code_and_verified_email", "sso", "code_and_guest_pin", "waiting_room", "open_seat_selection", "operator_assignment"] as const;
  return <Workspace id="access" title="Access" intro="Configure trusted join methods, guests, shared displays, and reassignment. Ambiguous roster rows must be reviewed in the later roster workflow.">
    <MultiCheck legend="Join methods" values={policy.joinMethods} options={methods.map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "accessPolicy", "joinMethods"]} client={client} />
    <CheckField id="guest-access" label="Allow Guests" checked={policy.guests.allowed} path={["coreDesign", "accessPolicy", "guests", "allowed"]} client={client} />
    <CheckField id="cross-team-reassignment" label="Allow cross-Team reassignment" checked={policy.reassignment.crossTeamAllowed} path={["coreDesign", "accessPolicy", "reassignment", "crossTeamAllowed"]} client={client} />
    <CheckField id="exposure-warning" label="Require exposure acknowledgement when reassigning" checked={policy.reassignment.exposureAcknowledgementRequired} path={["coreDesign", "accessPolicy", "reassignment", "exposureAcknowledgementRequired"]} client={client} />
  </Workspace>;
}

function RolePreview({ projectId, core }: { projectId: string; core: CoreDesignV1 }) {
  const roles = coreArray(core, "sessionRoles");
  const stages = coreArray(core, "stages");
  const teams = coreArray(core, "teams");
  const [sessionRoleId, setSessionRoleId] = useState(roles[0]?.id ?? "");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [teamId, setTeamId] = useState("");
  const [preview, setPreview] = useState<RolePreviewV1 | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const eligibleTeams = useMemo(() => {
    const role = roles.find(({ id }) => id === sessionRoleId);
    return role?.allowedTeamIds === undefined ? teams : teams.filter(({ id }) => role.allowedTeamIds?.includes(id));
  }, [roles, teams, sessionRoleId]);
  async function load(): Promise<void> {
    setMessage("Loading server-filtered preview.");
    try {
      const response = await fetch(`/v1/projects/${projectId}/role-preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionRoleId, stageId, ...(teamId === "" ? {} : { teamId }) }) });
      const body = await response.json() as RolePreviewV1 | { error?: { message?: string } };
      if (!response.ok || !("contractId" in body)) throw new Error("error" in body ? body.error?.message : "Preview failed.");
      setPreview(body); setMessage("Preview updated.");
    } catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : "Preview failed."); }
  }
  return <Workspace id="preview" title="Role & Stage preview" intro="This calls the same server projection resolver used by Runtime and returns only policy-authorized content.">
    <div className="preview-controls">
      <label>Session Role<select value={sessionRoleId} onChange={(event) => setSessionRoleId(event.target.value)}>{roles.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Stage<select value={stageId} onChange={(event) => setStageId(event.target.value)}>{stages.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Team<select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">No Team</option>{eligibleTeams.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
      <button className="btn-primary" type="button" disabled={sessionRoleId === "" || stageId === ""} onClick={() => void load()}>Preview interface</button>
    </div><p aria-live="polite">{message}</p>
    {preview === null ? null : <div className={`role-preview layout-${preview.layout}`} aria-label={`${preview.sessionRoleLabel} interface preview`}>
      <div className="preview-heading"><span className="badge badge-info">{preview.sessionRoleLabel}</span><strong>{preview.stageLabel}</strong></div>
      <div className="preview-modules">{preview.modules.map((module) => <section className="preview-module" key={module.id}><h3>{module.title}</h3><p>{module.emptyStateText}</p></section>)}</div>
      <section className="preview-content"><h3>Available Scenario content</h3>{preview.content.length === 0 ? <p>No content is available in this context.</p> : preview.content.map((item) => <article key={item.id}><h4>{item.title}</h4><p>{item.body}</p></article>)}</section>
    </div>}
  </Workspace>;
}

export function VisualCoreDesignEditor({ projectId, client, core, scenario }: {
  projectId: string; client: StudioCollaborationClient; core: CoreDesignV1; scenario: ScenarioV1;
}) {
  return <div className="visual-editor" data-contract-id={STUDIO_FOUNDATION_EDITOR_CONTRACT_ID}>
    <nav className="editor-nav" aria-label="Core Design editor sections"><h2>Design workspaces</h2><button className="btn-secondary compact" type="button" onClick={() => client.undo()}>Undo last change</button><ul>{SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul></nav>
    <div className="editor-canvas">
      <ScenarioEditor core={core} scenario={scenario} client={client} />
      <MethodologyEditor core={core} client={client} />
      <TeamEditor core={core} client={client} />
      <RoleEditor core={core} client={client} />
      <SeatEditor core={core} client={client} />
      <ActivityEditor core={core} client={client} />
      <StageEditor core={core} client={client} />
      <FormsEditor core={core} client={client} />
      <WorkflowEditor core={core} client={client} />
      <PolicyEditor core={core} client={client} />
      <AdvancedLogicEditor core={core} scenario={scenario} client={client} />
      <PollEditor core={core} client={client} />
      <VoiceEditor core={core} client={client} />
      <PluginCatalogEditor projectId={projectId} core={core} client={client} />
      <CompositionEditor projectId={projectId} core={core} client={client} />
      <InterfaceEditor core={core} client={client} />
      <ResearchEditor core={core} client={client} />
      <AccessEditor core={core} client={client} />
      <RolePreview projectId={projectId} core={core} />
    </div>
  </div>;
}
