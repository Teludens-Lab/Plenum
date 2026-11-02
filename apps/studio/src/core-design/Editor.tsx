import { useEffect, useMemo, useState } from "react";
import { STUDIO_FOUNDATION_EDITOR_CONTRACT_ID, type ContentLibraryItemV1, type ContentLibraryV1,
  type RolePreviewV1, type StudioRehearsalV1, type UploadQuarantineV1 } from "@plenum/event-contracts";
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
import { AdjudicationEditor } from "../adjudication/AdjudicationEditor.js";
import {
  FIELD_TYPES, METHODOLOGY_CONCEPTS, MODULE_TYPES, basicForm, basicInterface, basicStage,
  basicWorkflow, coreArray, dec42Workflow, defaultGrant, identifier
} from "./model.js";

export type Path = readonly (string | number)[];
export type Option = { value: string; label: string };

const SECTIONS = [
  ["overview", "Overview & Scenario"], ["methodology", "Methodology"], ["teams", "Teams"],
  ["roles", "Session Roles"], ["seats", "Seats"], ["activities", "Activities"], ["stages", "Stages"],
  ["forms", "Forms & Artifacts"], ["workflows", "Workflows"], ["policies", "Information Policy"],
  ["communications", "Communications"], ["injects", "Injects"], ["content-library", "Content Library"],
  ["advanced-logic", "Advanced logic & world state"],
  ["adjudication", "Adjudication Models"],
  ["polls", "Polls"], ["voice", "Voice Channels"], ["plugins", "Plugin catalog & bindings"],
  ["compositions", "Model Compositions"], ["interfaces", "Interfaces"], ["research", "Research"],
  ["measurements-reports", "Measurements & reports"], ["access", "Access & readiness"],
  ["preview", "Role walkthrough"], ["test-validate", "Test & validate"],
  ["review-publish", "Review & publish"], ["live-changes", "Live Changes"]
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
  const stages = coreArray(core, "stages");
  const [previewSize, setPreviewSize] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState<"entry" | "read_only" | "completed">("entry");
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
          <TextField id={`artifact-key-${artifact.id}`} label="Stable key" value={artifact.key} path={["coreDesign", "artifactTypes", artifactIndex, "key"]} client={client} />
          <SelectField id={`artifact-owner-${artifact.id}`} label="Ownership" value={artifact.ownership} options={["individual", "team", "session"].map((value) => ({ value, label: value }))} path={["coreDesign", "artifactTypes", artifactIndex, "ownership"]} client={client} />
          <SelectField id={`artifact-workflow-${artifact.id}`} label="Workflow" value={artifact.workflowId} options={workflows.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "artifactTypes", artifactIndex, "workflowId"]} client={client} />
          <SelectField id={`artifact-policy-${artifact.id}`} label="Information Policy" value={artifact.informationPolicyId} options={policies.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "artifactTypes", artifactIndex, "informationPolicyId"]} client={client} />
          <MultiCheck legend="Creator Session Roles" values={artifact.allowedCreatorSessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "artifactTypes", artifactIndex, "allowedCreatorSessionRoleIds"]} client={client} />
          <MultiCheck legend="Recipient Session Roles" values={artifact.recipientSessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "artifactTypes", artifactIndex, "recipientSessionRoleIds"]} client={client} />
          <MultiCheck legend="Available Stages (none means all)" values={artifact.availableStageIds ?? []} options={stages.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "artifactTypes", artifactIndex, "availableStageIds"]} client={client} />
          <SelectField id={`artifact-versioning-${artifact.id}`} label="Version history" value={artifact.versioning} options={["none", "draft_versions", "full_history"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "artifactTypes", artifactIndex, "versioning"]} client={client} />
          <TextField id={`artifact-retention-${artifact.id}`} label="Retention policy reference" value={artifact.retentionPolicyId ?? ""} path={["coreDesign", "artifactTypes", artifactIndex, "retentionPolicyId"]} client={client} emptyDeletes />
          <CheckField id={`artifact-decision-${artifact.id}`} label="Decision-bearing" checked={artifact.decisionBearing} path={["coreDesign", "artifactTypes", artifactIndex, "decisionBearing"]} client={client} />
          <CheckField id={`artifact-export-${artifact.id}`} label="Exportable" checked={artifact.exportable} path={["coreDesign", "artifactTypes", artifactIndex, "exportable"]} client={client} />
        </div>}
        {form.sections.map((section, sectionIndex) => <fieldset className="nested-editor" key={section.id}><legend>{section.title ?? "Form section"}</legend>
          <TextField id={`section-title-${section.id}`} label="Section title" value={section.title ?? ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "title"]} client={client} />
          <TextField id={`section-description-${section.id}`} label="Section description" value={section.description ?? ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "description"]} client={client} emptyDeletes />
          <CheckField id={`section-repeatable-${section.id}`} label="Repeatable section" checked={section.repeatable === true} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "repeatable"]} client={client} />
          {section.fields.map((field, fieldIndex) => <fieldset className="nested-editor" key={field.id}><legend>{field.label || `Field ${fieldIndex + 1}`}</legend><div className="grid-fields">
            <TextField id={`field-label-${field.id}`} label="Field label" value={field.label} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "label"]} client={client} />
            <TextField id={`field-key-${field.id}`} label="Field key" value={field.key} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "key"]} client={client} />
            <SelectField id={`field-type-${field.id}`} label="Field type" value={field.type} options={FIELD_TYPES.map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "type"]} client={client} />
            <TextField id={`field-help-${field.id}`} label="Help text" value={field.helpText ?? ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "helpText"]} client={client} emptyDeletes />
            <TextField id={`field-reporting-${field.id}`} label="Reporting label" value={field.reportingLabel ?? ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "reportingLabel"]} client={client} emptyDeletes />
            <SelectField id={`field-classification-${field.id}`} label="Data classification" value={field.dataClassification ?? "internal"} options={["public", "internal", "confidential", "restricted"].map((value) => ({ value, label: value }))} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "dataClassification"]} client={client} />
            <TextField id={`field-default-${field.id}`} label="Default value" value={typeof field.defaultValue === "string" || typeof field.defaultValue === "number" ? field.defaultValue : ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "defaultValue"]} client={client} emptyDeletes />
            {(field.type === "single_select" || field.type === "multi_select") && <TextField id={`field-options-${field.id}`} label="Choices (value: label, comma separated)" value={(field.options ?? []).map(({ value, label }) => `${value}: ${label}`).join(", ")} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "options"]} client={client} transform={(value) => value.split(",").map((choice) => choice.trim()).filter(Boolean).map((choice) => { const [optionValue, ...label] = choice.split(":"); return { value: optionValue?.trim() ?? "", label: label.join(":").trim() || optionValue?.trim() || "" }; })} />}
            <TextField id={`field-min-${field.id}`} label={field.type === "number" ? "Minimum value" : "Minimum length"} value={field.type === "number" ? field.validation?.min ?? "" : field.validation?.minLength ?? ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "validation", field.type === "number" ? "min" : "minLength"]} client={client} type="number" emptyDeletes />
            <TextField id={`field-max-${field.id}`} label={field.type === "number" ? "Maximum value" : "Maximum length"} value={field.type === "number" ? field.validation?.max ?? "" : field.validation?.maxLength ?? ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "validation", field.type === "number" ? "max" : "maxLength"]} client={client} type="number" emptyDeletes />
            <CheckField id={`field-required-${field.id}`} label="Required" checked={field.required === true} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "required"]} client={client} />
            <CheckField id={`field-readonly-${field.id}`} label="Read-only" checked={field.readOnly === true} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "readOnly"]} client={client} />
            <MultiCheck legend="Editable by Session Roles (none means normal workflow rules)" values={field.editableBySessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "editableBySessionRoleIds"]} client={client} />
            {field.visibleWhen === undefined ? <AddButton label="Add conditional visibility" disabled={section.fields.length < 2} onClick={() => { const source = section.fields.find(({ id }) => id !== field.id); if (source !== undefined) client.setAtPath(["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "visibleWhen"], { field: source.key, operator: "equals", value: "" }); }} /> : <fieldset className="nested-editor"><legend>Conditional visibility</legend><div className="field-row">
              <SelectField id={`field-condition-source-${field.id}`} label="Source field" value={field.visibleWhen.field} options={section.fields.filter(({ id }) => id !== field.id).map(({ key, label }) => ({ value: key, label }))} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "visibleWhen", "field"]} client={client} />
              <SelectField id={`field-condition-operator-${field.id}`} label="Comparison" value={field.visibleWhen.operator} options={["equals", "not_equals", "includes", "present"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "visibleWhen", "operator"]} client={client} />
              {field.visibleWhen.operator !== "present" && <TextField id={`field-condition-value-${field.id}`} label="Value" value={typeof field.visibleWhen.value === "string" || typeof field.visibleWhen.value === "number" ? field.visibleWhen.value : ""} path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "visibleWhen", "value"]} client={client} />}
              <button className="btn-danger compact" type="button" onClick={() => client.deleteAtPath(["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields", fieldIndex, "visibleWhen"])}>Remove condition</button>
            </div><p className="rule-sentence">Show “{field.label}” when “{section.fields.find(({ key }) => key === field.visibleWhen?.field)?.label ?? field.visibleWhen.field}” {field.visibleWhen.operator.replaceAll("_", " ")}{field.visibleWhen.operator === "present" ? "." : ` “${String(field.visibleWhen.value ?? "")}”.`}</p></fieldset>}
            <ItemActions path={["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields"]} index={fieldIndex} count={section.fields.length} client={client} label={field.label || "field"} duplicate={() => client.appendAtPath(["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields"], { ...structuredClone(field), id: identifier(), key: `${field.key}_copy`, label: `${field.label} copy` })} />
          </div></fieldset>)}
          <AddButton label="Add field" onClick={() => client.appendAtPath(["coreDesign", "forms", formIndex, "sections", sectionIndex, "fields"], { id: identifier(), key: `field_${section.fields.length + 1}`, label: "New field", type: "short_text", required: false })} />
        </fieldset>)}
        <AddButton label="Add Form section" onClick={() => client.appendAtPath(["coreDesign", "forms", formIndex, "sections"], { id: identifier(), title: "New section", fields: [] })} />
        <fieldset className="form-preview"><legend>Form preview</legend><div className="preview-controls">
          <label htmlFor={`preview-size-${form.id}`}>Viewport<select id={`preview-size-${form.id}`} value={previewSize} onChange={(event) => setPreviewSize(event.target.value as typeof previewSize)}><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option></select></label>
          <label htmlFor={`preview-mode-${form.id}`}>Mode<select id={`preview-mode-${form.id}`} value={previewMode} onChange={(event) => setPreviewMode(event.target.value as typeof previewMode)}><option value="entry">Data entry</option><option value="read_only">Read-only review</option><option value="completed">Completed Artifact</option></select></label>
        </div><div className={`form-preview-canvas preview-${previewSize}`} aria-label={`${form.name} ${previewSize} ${previewMode.replaceAll("_", " ")} preview`}><h3>{form.name}</h3>{form.sections.map((section) => <section key={section.id}><h4>{section.title}</h4>{section.description === undefined ? null : <p>{section.description}</p>}{section.fields.map((field) => <label className="field" key={field.id}>{field.label}{field.required === true ? " (required)" : ""}{field.type === "long_text" ? <textarea rows={3} disabled={previewMode !== "entry" || field.readOnly === true} defaultValue={previewMode === "completed" ? String(field.defaultValue ?? "Example response") : String(field.defaultValue ?? "")} /> : field.type === "single_select" || field.type === "multi_select" ? <select disabled={previewMode !== "entry" || field.readOnly === true} multiple={field.type === "multi_select"}>{(field.options ?? []).map((option) => <option key={option.value}>{option.label}</option>)}</select> : <input type={field.type === "number" ? "number" : "text"} disabled={previewMode !== "entry" || field.readOnly === true} defaultValue={previewMode === "completed" ? String(field.defaultValue ?? "Example response") : String(field.defaultValue ?? "")} />}{field.helpText === undefined ? null : <span className="hint">{field.helpText}</span>}</label>)}</section>)}</div></fieldset>
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
      <TextField id={`workflow-description-${workflow.id}`} label="Workflow description" value={workflow.description ?? ""} path={["coreDesign", "workflows", index, "description"]} client={client} multiline emptyDeletes />
      <SelectField id={`workflow-initial-${workflow.id}`} label="Initial state" value={workflow.initialState} options={workflow.states.map(({ key, label }) => ({ value: key, label }))} path={["coreDesign", "workflows", index, "initialState"]} client={client} />
      <ol className="workflow-list">{workflow.states.map((state, stateIndex) => <li key={state.key}><div className="field-row">
        <TextField id={`workflow-state-key-${workflow.id}-${stateIndex}`} label="State key" value={state.key} path={["coreDesign", "workflows", index, "states", stateIndex, "key"]} client={client} />
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
        {!(["terminal", "cancelled"] as string[]).includes(state.kind) && <TextField id={`workflow-due-${workflow.id}-${stateIndex}`} label="Due period in seconds (blank for none)" value={state.dueAfterSeconds ?? ""} type="number" emptyDeletes path={["coreDesign", "workflows", index, "states", stateIndex, "dueAfterSeconds"]} client={client} />}
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
        <TextField id={`workflow-transition-label-${transition.id}`} label="Transition label" value={transition.label ?? ""} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "label"]} client={client} emptyDeletes />
        <SelectField id={`workflow-to-${transition.id}`} label="Target state" value={transition.to} options={workflow.states.map(({ key, label }) => ({ value: key, label }))} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "to"]} client={client} />
        <MultiCheck legend="Allowed Session Roles" values={transition.allowedSessionRoleIds} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "allowedSessionRoleIds"]} client={client} />
        <MultiCheck legend="Notify Session Roles" values={transition.notifySessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "notifySessionRoleIds"]} client={client} />
        <TextField id={`workflow-priority-${transition.id}`} label="Priority" value={transition.priority ?? 0} type="number" path={["coreDesign", "workflows", index, "transitions", transitionIndex, "priority"]} client={client} />
        <CheckField id={`workflow-content-only-${transition.id}`} label="Content-only change" checked={transition.contentOnly === true} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "contentOnly"]} client={client} />
        <CheckField id={`workflow-notify-creator-${transition.id}`} label="Notify creator" checked={transition.notifyCreator === true} path={["coreDesign", "workflows", index, "transitions", transitionIndex, "notifyCreator"]} client={client} />
        <p className="rule-sentence">From {transition.from === null ? "Artifact creation" : workflow.states.find(({ key }) => key === transition.from)?.label ?? transition.from}, “{transition.label ?? transition.command}” moves to {workflow.states.find(({ key }) => key === transition.to)?.label ?? transition.to} for {transition.allowedSessionRoleIds.map((id) => roles.find((role) => role.id === id)?.name ?? id).join(", ") || "no eligible role"}.</p>
        <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "workflows", index, "transitions"], transitionIndex)}>Remove transition</button>
      </fieldset>)}</div>
      <AddButton label="Add Workflow transition" onClick={() => client.appendAtPath(["coreDesign", "workflows", index, "transitions"], {
        id: identifier(), from: workflow.initialState, command: "artifact.advance", label: "Advance",
        to: workflow.states.find(({ kind }) => kind === "terminal")?.key ?? workflow.initialState,
        allowedSessionRoleIds: roles[0] === undefined ? [] : [roles[0].id], priority: 0
      })} />
      <ItemActions path={["coreDesign", "workflows"]} index={index} count={workflows.length} client={client} label={workflow.name} />
      <section className="workflow-preview" aria-label={`${workflow.name} workflow preview`}><h3>Guarded workflow preview</h3><ol>{workflow.transitions.map((transition) => <li key={transition.id}><strong>{transition.from === null ? "Start" : workflow.states.find(({ key }) => key === transition.from)?.label ?? transition.from}</strong> → {transition.label ?? transition.command} → <strong>{workflow.states.find(({ key }) => key === transition.to)?.label ?? transition.to}</strong></li>)}</ol></section>
    </div></details>)}</div>
    <div className="item-actions"><AddButton label="Add simple review Workflow" disabled={roles.length === 0} onClick={() => client.appendAtPath(["coreDesign", "workflows"], basicWorkflow("New review Workflow", roles[0]?.id))} />
      <AddButton label="Add DEC-42 reference Workflow" disabled={roles.length < 3} onClick={() => client.appendAtPath(["coreDesign", "workflows"], dec42Workflow(roles.slice(0, 3).map(({ id }) => id)))} /></div>
    {roles.length < 3 && <p className="hint">Add at least three Session Roles before using the DEC-42 reference template.</p>}
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

function CommunicationsEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const channels = core.communications?.messageChannels ?? [];
  const routes = core.communications?.routes ?? [];
  const roles = coreArray(core, "sessionRoles");
  const teams = coreArray(core, "teams");
  const stages = coreArray(core, "stages");
  const policies = coreArray(core, "informationPolicies");
  const artifacts = coreArray(core, "artifactTypes");
  const workflows = coreArray(core, "workflows");
  const routeLabel = (route: (typeof routes)[number]) => {
    const labels = (ids: string[] | undefined, candidates: Array<{ id: string; name: string }>) => ids?.map((id) => candidates.find((item) => item.id === id)?.name ?? id).join(", ") ?? "";
    const sender = route.sender.public === true ? "Public" : labels(route.sender.sessionRoleIds, roles) || labels(route.sender.teamIds, teams) || "No sender";
    const recipient = route.recipient.public === true ? "Public" : labels(route.recipient.sessionRoleIds, roles) || labels(route.recipient.teamIds, teams) || "No recipient";
    return `${sender} may send through ${channels.find(({ id }) => id === route.channelId)?.name ?? "missing Channel"} to ${recipient}`;
  };
  return <Workspace id="communications" title="Communications" intro="Define governed Message Channels and plain-language Routes. Every Route is checked against its Information Policy before Publication and at Runtime.">
    <h3>Message Channels</h3><div className="editor-list">{channels.map((channel, index) => <details className="editor-item" id={`messageChannels-${channel.id}`} key={channel.id}><summary><span>{channel.name}</span><span className="badge badge-muted">{channel.type.replaceAll("_", " ")}</span></summary><div className="item-body grid-fields">
      <TextField id={`channel-name-${channel.id}`} label="Channel name" value={channel.name} path={["coreDesign", "communications", "messageChannels", index, "name"]} client={client} />
      <SelectField id={`channel-type-${channel.id}`} label="Channel type" value={channel.type} options={["direct", "team_message", "broadcast", "request_for_information", "proposal_thread"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "communications", "messageChannels", index, "type"]} client={client} />
      <SelectField id={`channel-policy-${channel.id}`} label="Information Policy" value={channel.informationPolicyId ?? ""} options={policies.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "messageChannels", index, "informationPolicyId"]} client={client} />
      <SelectField id={`channel-artifact-${channel.id}`} label="Structured Artifact Type (optional)" value={channel.structuredArtifactTypeId ?? ""} options={[{ value: "", label: "Free text" }, ...artifacts.map(({ id, name }) => ({ value: id, label: name }))]} path={["coreDesign", "communications", "messageChannels", index, "structuredArtifactTypeId"]} client={client} emptyDeletes />
      <TextField id={`channel-retention-${channel.id}`} label="Retention policy reference" value={channel.retentionPolicyId ?? ""} path={["coreDesign", "communications", "messageChannels", index, "retentionPolicyId"]} client={client} emptyDeletes />
      <MultiCheck legend="Active Stages (none means all)" values={channel.activeStageIds ?? []} options={stages.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "messageChannels", index, "activeStageIds"]} client={client} />
      <CheckField id={`channel-attachments-${channel.id}`} label="Allow governed attachments" checked={channel.supportsAttachments} path={["coreDesign", "communications", "messageChannels", index, "supportsAttachments"]} client={client} />
      <CheckField id={`channel-threading-${channel.id}`} label="Thread messages" checked={channel.supportsThreading} path={["coreDesign", "communications", "messageChannels", index, "supportsThreading"]} client={client} />
      <CheckField id={`channel-approval-${channel.id}`} label="Approval required" checked={channel.approvalRequired === true} path={["coreDesign", "communications", "messageChannels", index, "approvalRequired"]} client={client} />
      <CheckField id={`channel-export-${channel.id}`} label="Include in governed exports" checked={channel.exportable !== false} path={["coreDesign", "communications", "messageChannels", index, "exportable"]} client={client} />
      <ItemActions path={["coreDesign", "communications", "messageChannels"]} index={index} count={channels.length} client={client} label={channel.name} />
    </div></details>)}</div>
    <AddButton label="Add Message Channel" disabled={policies.length === 0} onClick={() => client.appendAtPath(["coreDesign", "communications", "messageChannels"], { id: identifier(), name: "New Message Channel", type: "direct", supportsAttachments: false, supportsThreading: true, informationPolicyId: policies[0]?.id, approvalRequired: false, exportable: true, activeStageIds: [] })} />
    <h3>Communication Routes</h3><div className="editor-list">{routes.map((route, index) => {
      const policy = policies.find(({ id }) => id === route.informationPolicyId);
      const leakage = route.recipient.public === true && policy?.classification !== "public";
      return <details className="editor-item" id={`communications-${route.id}`} key={route.id}><summary><span>{routeLabel(route)}</span><span className={`badge ${leakage ? "badge-error" : "badge-online"}`}>{leakage ? "leakage blocked" : "governed"}</span></summary><div className="item-body grid-fields">
        <SelectField id={`route-channel-${route.id}`} label="Message Channel" value={route.channelId} options={channels.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "routes", index, "channelId"]} client={client} />
        <SelectField id={`route-policy-${route.id}`} label="Information Policy" value={route.informationPolicyId ?? ""} options={policies.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "routes", index, "informationPolicyId"]} client={client} />
        <SelectField id={`route-approval-${route.id}`} label="Approval Workflow (optional)" value={route.approvalWorkflowId ?? ""} options={[{ value: "", label: "No approval Workflow" }, ...workflows.map(({ id, name }) => ({ value: id, label: name }))]} path={["coreDesign", "communications", "routes", index, "approvalWorkflowId"]} client={client} emptyDeletes />
        <MultiCheck legend="Sender Session Roles" values={route.sender.sessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "routes", index, "sender", "sessionRoleIds"]} client={client} />
        <MultiCheck legend="Sender Teams" values={route.sender.teamIds ?? []} options={teams.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "routes", index, "sender", "teamIds"]} client={client} />
        <CheckField id={`route-sender-control-${route.id}`} label="Allow control roles to send" checked={route.sender.includeControlRoles === true} path={["coreDesign", "communications", "routes", index, "sender", "includeControlRoles"]} client={client} />
        <MultiCheck legend="Recipient Session Roles" values={route.recipient.sessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "routes", index, "recipient", "sessionRoleIds"]} client={client} />
        <MultiCheck legend="Recipient Teams" values={route.recipient.teamIds ?? []} options={teams.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "routes", index, "recipient", "teamIds"]} client={client} />
        <CheckField id={`route-recipient-public-${route.id}`} label="Public recipient" checked={route.recipient.public === true} path={["coreDesign", "communications", "routes", index, "recipient", "public"]} client={client} />
        <MultiCheck legend="Active Stages (none means all)" values={route.activeStageIds ?? []} options={stages.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "communications", "routes", index, "activeStageIds"]} client={client} />
        <p className="rule-sentence">{routeLabel(route)}{policy === undefined ? ". Information Policy is missing." : ` under ${policy.name} (${policy.classification ?? "internal"}).`}</p>
        {leakage && <p className="status-error" role="alert">A non-public Information Policy cannot use a public recipient. Publication remains blocked.</p>}
        <ItemActions path={["coreDesign", "communications", "routes"]} index={index} count={routes.length} client={client} label="Communication Route" />
      </div></details>;
    })}</div>
    <AddButton label="Add Communication Route" disabled={channels.length === 0 || policies.length === 0 || roles.length < 2} onClick={() => client.appendAtPath(["coreDesign", "communications", "routes"], { id: identifier(), channelId: channels[0]?.id ?? "", informationPolicyId: policies[0]?.id, sender: { sessionRoleIds: roles[0] === undefined ? [] : [roles[0].id] }, recipient: { sessionRoleIds: roles[1] === undefined ? [] : [roles[1].id] }, activeStageIds: [] })} />
    <div className="table-scroll"><table className="permission-matrix"><caption>Route matrix by Session Role</caption><thead><tr><th scope="col">Sender</th>{roles.map((role) => <th scope="col" key={role.id}>{role.name}</th>)}</tr></thead><tbody>{roles.map((sender) => <tr key={sender.id}><th scope="row">{sender.name}</th>{roles.map((recipient) => { const matching = routes.filter((route) => route.sender.sessionRoleIds?.includes(sender.id) && route.recipient.sessionRoleIds?.includes(recipient.id)); return <td key={recipient.id}>{matching.length === 0 ? "Denied" : matching.map((route) => channels.find(({ id }) => id === route.channelId)?.name ?? "Missing Channel").join(", ")}</td>; })}</tr>)}</tbody></table></div>
  </Workspace>;
}

function InjectEditor({ core, scenario, client }: { core: CoreDesignV1; scenario: ScenarioV1; client: StudioCollaborationClient }) {
  const injects = scenario.injects ?? [];
  const content = scenario.content ?? [];
  const roles = coreArray(core, "sessionRoles");
  const teams = coreArray(core, "teams");
  const stages = coreArray(core, "stages");
  const artifacts = coreArray(core, "artifactTypes");
  const variables = coreArray(core, "stateVariables");
  return <Workspace id="injects" title="Injects" intro="Author release logic, recipients, required responses, dependencies, and operator notes; the timeline previews pacing without changing Runtime state.">
    <div className="inject-timeline" aria-label="Inject timeline"><h3>Timeline preview</h3>{stages.map((stage) => <section key={stage.id}><h4>{stage.name}</h4><ul>{injects.filter((inject) => inject.stageId === stage.id).map((inject) => <li key={inject.id}>{inject.title} — {inject.releaseMode.replaceAll("_", " ")}</li>)}</ul></section>)}<section><h4>Manual or unassigned</h4><ul>{injects.filter((inject) => inject.stageId === undefined).map((inject) => <li key={inject.id}>{inject.title} — {inject.releaseMode.replaceAll("_", " ")}</li>)}</ul></section></div>
    <div className="editor-list">{injects.map((inject, index) => <details className="editor-item" id={`injects-${inject.id}`} key={inject.id}><summary><span>{inject.title}</span><span className="badge badge-muted">{inject.releaseMode.replaceAll("_", " ")}</span></summary><div className="item-body grid-fields">
      <TextField id={`inject-title-${inject.id}`} label="Inject title" value={inject.title} path={["scenario", "injects", index, "title"]} client={client} />
      <TextField id={`inject-sender-${inject.id}`} label="Sender identity" value={inject.senderIdentity ?? ""} path={["scenario", "injects", index, "senderIdentity"]} client={client} emptyDeletes />
      <SelectField id={`inject-content-${inject.id}`} label="Content" value={inject.contentId} options={content.map(({ id, title }) => ({ value: id, label: title }))} path={["scenario", "injects", index, "contentId"]} client={client} />
      <div className="field"><label htmlFor={`inject-release-${inject.id}`}>Release mode</label><select id={`inject-release-${inject.id}`} value={inject.releaseMode} onChange={(event) => {
        const mode = event.target.value;
        client.transact(() => {
          client.setAtPath(["scenario", "injects", index, "releaseMode"], mode);
          if (!["stage_entry", "stage_exit"].includes(mode)) client.deleteAtPath(["scenario", "injects", index, "stageId"]);
          if (mode !== "scheduled") client.deleteAtPath(["scenario", "injects", index, "scheduledOffsetSeconds"]);
          if (mode !== "gate") client.deleteAtPath(["scenario", "injects", index, "releaseGate"]);
          if (["stage_entry", "stage_exit"].includes(mode) && stages[0] !== undefined) client.setAtPath(["scenario", "injects", index, "stageId"], stages[0].id);
          if (mode === "scheduled") client.setAtPath(["scenario", "injects", index, "scheduledOffsetSeconds"], 0);
          if (mode === "gate" && variables[0] !== undefined) client.setAtPath(["scenario", "injects", index, "releaseGate"], { operator: "all", conditions: [{ fact: `state.${variables[0].id}`, operator: "equals", value: "" }] });
        });
      }}><option value="manual">Manual</option><option value="scheduled">Scheduled</option><option value="stage_entry">Stage entry</option><option value="stage_exit">Stage exit</option><option value="gate">Conditional Gate</option></select></div>
      {(inject.releaseMode === "stage_entry" || inject.releaseMode === "stage_exit") && <SelectField id={`inject-stage-${inject.id}`} label="Stage" value={inject.stageId ?? ""} options={stages.map(({ id, name }) => ({ value: id, label: name }))} path={["scenario", "injects", index, "stageId"]} client={client} />}
      {inject.releaseMode === "scheduled" && <TextField id={`inject-offset-${inject.id}`} label="Scheduled offset in seconds" value={inject.scheduledOffsetSeconds ?? 0} type="number" path={["scenario", "injects", index, "scheduledOffsetSeconds"]} client={client} />}
      {inject.releaseMode === "gate" && variables.length === 0 && <p className="status-error">Add a State Variable before configuring this conditional Inject.</p>}
      {inject.releaseMode === "gate" && variables[0] !== undefined && <><div className="field"><label htmlFor={`inject-gate-variable-${inject.id}`}>State Value</label><select id={`inject-gate-variable-${inject.id}`} value={(inject.releaseGate?.conditions[0] as { fact?: string } | undefined)?.fact?.replace(/^state\./u, "") ?? variables[0].id} onChange={(event) => client.setAtPath(["scenario", "injects", index, "releaseGate", "conditions", 0, "fact"], `state.${event.target.value}`)}>{variables.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></div>
        <p className="hint">State Value references are stored as <code>state.&lt;id&gt;</code>; validation will focus any incomplete Gate.</p></>}
      <MultiCheck legend="Recipient Session Roles" values={inject.recipients.sessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["scenario", "injects", index, "recipients", "sessionRoleIds"]} client={client} />
      <MultiCheck legend="Recipient Teams" values={inject.recipients.teamIds ?? []} options={teams.map(({ id, name }) => ({ value: id, label: name }))} path={["scenario", "injects", index, "recipients", "teamIds"]} client={client} />
      <CheckField id={`inject-public-${inject.id}`} label="Public recipients" checked={inject.recipients.public === true} path={["scenario", "injects", index, "recipients", "public"]} client={client} />
      <CheckField id={`inject-control-${inject.id}`} label="Include control roles" checked={inject.recipients.includeControlRoles === true} path={["scenario", "injects", index, "recipients", "includeControlRoles"]} client={client} />
      <SelectField id={`inject-response-${inject.id}`} label="Required response Artifact Type" value={inject.requiredResponseArtifactTypeId ?? ""} options={[{ value: "", label: "No required response" }, ...artifacts.map(({ id, name }) => ({ value: id, label: name }))]} path={["scenario", "injects", index, "requiredResponseArtifactTypeId"]} client={client} emptyDeletes />
      {inject.requiredResponseArtifactTypeId !== undefined && <TextField id={`inject-deadline-${inject.id}`} label="Response deadline in seconds" value={inject.responseDeadlineSeconds ?? 0} type="number" path={["scenario", "injects", index, "responseDeadlineSeconds"]} client={client} />}
      <MultiCheck legend="Follow-on Injects" values={inject.followOnInjectIds ?? []} options={injects.filter(({ id }) => id !== inject.id).map(({ id, title }) => ({ value: id, label: title }))} path={["scenario", "injects", index, "followOnInjectIds"]} client={client} />
      <SelectField id={`inject-control-notes-${inject.id}`} label="Control notes content" value={inject.controlNotesContentId ?? ""} options={[{ value: "", label: "No control notes" }, ...content.map(({ id, title }) => ({ value: id, label: title }))]} path={["scenario", "injects", index, "controlNotesContentId"]} client={client} emptyDeletes />
      <p className="rule-sentence">Release “{inject.title}” {inject.releaseMode.replaceAll("_", " ")}{inject.stageId === undefined ? "" : ` at ${stages.find(({ id }) => id === inject.stageId)?.name ?? "a missing Stage"}`} to {inject.recipients.public === true ? "the public audience" : `${(inject.recipients.sessionRoleIds?.length ?? 0) + (inject.recipients.teamIds?.length ?? 0)} selected recipient groups`}.</p>
      <ItemActions path={["scenario", "injects"]} index={index} count={injects.length} client={client} label={inject.title} />
    </div></details>)}</div>
    <AddButton label="Add Inject" disabled={content.length === 0 || roles.length === 0} onClick={() => client.appendAtPath(["scenario", "injects"], { id: identifier(), title: "New Inject", contentId: content[0]?.id ?? "", senderIdentity: "Control", recipients: { sessionRoleIds: roles[0] === undefined ? [] : [roles[0].id] }, releaseMode: "manual", effects: [], followOnInjectIds: [] })} />
    {(content.length === 0 || roles.length === 0) && <p className="hint">Add Scenario content and a Session Role before creating an Inject.</p>}
  </Workspace>;
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function ContentLibraryEditor({ projectId, core, client }: { projectId: string; core: CoreDesignV1; client: StudioCollaborationClient }) {
  const policies = coreArray(core, "informationPolicies");
  const [library, setLibrary] = useState<ContentLibraryV1 | null>(null);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [contentItemId, setContentItemId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState("text/plain");
  const [message, setMessage] = useState("Loading Content Library.");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      const response = await fetch(`/v1/projects/${projectId}/content-library`);
      const body = await response.json() as ContentLibraryV1 | { error?: { message?: string } };
      if (!response.ok || !("contractId" in body)) throw new Error((body as { error?: { message?: string } }).error?.message ?? "Content Library failed to load.");
      setLibrary(body); setMessage(body.items.length === 0 ? "No governed content has been uploaded." : `${body.items.length} governed content item${body.items.length === 1 ? "" : "s"}.`);
    } catch (error) { setLibrary(null); setMessage(error instanceof Error ? error.message : "Content Library failed to load."); }
  };
  useEffect(() => { void load(); }, [projectId]);
  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (file === null || title.trim() === "") return;
    setBusy(true); setMessage("Uploading to quarantine and scanning.");
    try {
      const response = await fetch(`/v1/projects/${projectId}/content-library/uploads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), ...(contentItemId === "" ? {} : { contentItemId }), title: title.trim(), fileName: file.name, mediaType, contentBase64: await fileAsBase64(file) }) });
      const body = await response.json() as UploadQuarantineV1 | { error?: { message?: string } };
      if (!response.ok || !("contractId" in body)) throw new Error((body as { error?: { message?: string } }).error?.message ?? "Upload failed.");
      const status = body.contentItem.versions[0]?.scanStatus ?? "failed";
      setMessage(status === "clean" ? "Malware scan passed. This version is available for reuse." : `This version remains unavailable: ${body.contentItem.versions[0]?.scanDetail ?? status}`);
      setTitle(""); setContentItemId(""); setFile(null); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed safely."); } finally { setBusy(false); }
  };
  const visible = library?.items.filter((item) => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];
  const reuse = (item: ContentLibraryItemV1) => {
    const version = item.versions.find((candidate) => candidate.version === item.currentVersion && candidate.scanStatus === "clean");
    if (version === undefined || policies[0] === undefined) return;
    client.appendAtPath(["scenario", "content"], { id: identifier(), title: item.title, type: version.mediaType, informationPolicyId: policies[0].id, version: String(version.version), contentLibraryItemId: item.id, contentLibraryVersion: version.version });
  };
  return <Workspace id="content-library" title="Content Library" intro="Upload reusable content into quarantine. Only versions that pass type, size, digest, and malware checks become available to Scenario authoring.">
    <p aria-live="polite">{message}</p>
    <form className="content-upload" onSubmit={(event) => void upload(event)}><div className="grid-fields">
      <div className="field"><label htmlFor="content-version-target">Upload target</label><select id="content-version-target" value={contentItemId} onChange={(event) => { setContentItemId(event.target.value); const item = library?.items.find(({ id }) => id === event.target.value); if (item !== undefined) setTitle(item.title); }}><option value="">New content item</option>{library?.items.map((item) => <option key={item.id} value={item.id}>New version of {item.title}</option>)}</select></div>
      <div className="field"><label htmlFor="content-title">Content title</label><input id="content-title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
      <div className="field"><label htmlFor="content-file">File (maximum 512 KiB)</label><input id="content-file" required type="file" accept=".txt,.md,.pdf,.png,.jpg,.jpeg,text/plain,text/markdown,application/pdf,image/png,image/jpeg" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); if (next?.type !== undefined && ["text/plain", "text/markdown", "application/pdf", "image/png", "image/jpeg"].includes(next.type)) setMediaType(next.type); }} /></div>
      <div className="field"><label htmlFor="content-media-type">Declared content type</label><select id="content-media-type" value={mediaType} onChange={(event) => setMediaType(event.target.value)}><option value="text/plain">Plain text</option><option value="text/markdown">Markdown</option><option value="application/pdf">PDF</option><option value="image/png">PNG image</option><option value="image/jpeg">JPEG image</option></select></div>
    </div><button className="btn-primary" type="submit" disabled={busy || file === null || title.trim() === ""}>{busy ? "Scanning…" : "Upload and scan"}</button></form>
    <div className="catalog-filters"><label htmlFor="content-search">Search governed content<input id="content-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="btn-secondary" type="button" onClick={() => void load()}>Refresh library</button></div>
    <div className="plugin-catalog">{visible.map((item) => { const current = item.versions.find((version) => version.version === item.currentVersion); return <article className="catalog-card" key={item.id}><h3>{item.title}</h3><p><span className={`badge ${current?.scanStatus === "clean" ? "badge-online" : "badge-error"}`}>{current?.scanStatus ?? "unavailable"}</span> Version {item.currentVersion}</p><p>{current?.fileName} · {current?.mediaType} · {current?.sizeBytes ?? 0} bytes</p><p className="digest-line">Digest {current?.sha256}</p><details><summary>Version history</summary><ol>{item.versions.map((version) => <li key={version.id}>v{version.version}: {version.scanStatus} — {version.fileName}</li>)}</ol></details><button className="btn-secondary" type="button" disabled={current?.scanStatus !== "clean" || policies.length === 0} onClick={() => reuse(item)}>Use current version in Scenario</button></article>; })}</div>
  </Workspace>;
}

function InterfaceEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const profiles = coreArray(core, "interfaces");
  const roles = coreArray(core, "sessionRoles");
  const stages = coreArray(core, "stages");
  const teams = coreArray(core, "teams");
  const policies = coreArray(core, "informationPolicies");
  return <Workspace id="interfaces" title="Interfaces" intro="Choose curated modules and a responsive layout template. Arbitrary pixel positioning is not available.">
    <div className="editor-list">{profiles.map((profile, index) => <details className="editor-item" id={`interfaces-${profile.id}`} key={profile.id}><summary><span>{profile.name}</span><span className="badge badge-muted">{profile.layout.template.replaceAll("_", " ")}</span></summary><div className="item-body">
      <TextField id={`interface-name-${profile.id}`} label="Interface Profile name" value={profile.name} path={["coreDesign", "interfaces", index, "name"]} client={client} />
      <SelectField id={`interface-layout-${profile.id}`} label="Layout template" value={profile.layout.template} options={["single_column", "main_sidebar", "dashboard", "workspace"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "interfaces", index, "layout", "template"]} client={client} />
      <MultiCheck legend="Session Roles" values={profile.selectors.sessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "interfaces", index, "selectors", "sessionRoleIds"]} client={client} />
      <MultiCheck legend="Teams (none means all)" values={profile.selectors.teamIds ?? []} options={teams.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "interfaces", index, "selectors", "teamIds"]} client={client} />
      <MultiCheck legend="Visible Stages (none means all)" values={profile.selectors.stageIds ?? []} options={stages.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "interfaces", index, "selectors", "stageIds"]} client={client} />
      {profile.layout.regions.map((region, regionIndex) => <fieldset className="nested-editor" key={region.id}><legend>Region {regionIndex + 1}</legend>
        {region.modules.map((module, moduleIndex) => <div className="field-row" key={module.id}>
          <TextField id={`module-title-${module.id}`} label="Module title" value={module.title ?? ""} path={["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules", moduleIndex, "title"]} client={client} />
          <SelectField id={`module-type-${module.id}`} label="Module" value={module.moduleType} options={MODULE_TYPES.map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules", moduleIndex, "moduleType"]} client={client} />
          <SelectField id={`module-policy-${module.id}`} label="Information Policy" value={typeof module.configuration.informationPolicyId === "string" ? module.configuration.informationPolicyId : ""} options={[{ value: "", label: "No additional policy" }, ...policies.map(({ id, name }) => ({ value: id, label: name }))]} path={["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules", moduleIndex, "configuration", "informationPolicyId"]} client={client} emptyDeletes />
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules"], moduleIndex)}>Remove module</button>
        </div>)}
        <AddButton label="Add module" onClick={() => client.appendAtPath(["coreDesign", "interfaces", index, "layout", "regions", regionIndex, "modules"], { id: identifier(), moduleType: "session_status", title: "Session status", configuration: { mode: "read", emptyStateText: "Nothing is available." } })} />
      </fieldset>)}
      <AddButton label="Add layout region" onClick={() => client.appendAtPath(["coreDesign", "interfaces", index, "layout", "regions"], { id: identifier(), modules: [] })} />
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
  const stateVariables = coreArray(core, "stateVariables");
  const measurements = coreArray(core, "measurementDefinitions");
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
          <MultiCheck legend="Affected State Values" values={trace.affectedStateVariableIds} options={stateVariables.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "decisionTraceability", traceIndex, "affectedStateVariableIds"]} client={client} />
          <MultiCheck legend="Measurement Definitions" values={trace.measurementDefinitionIds} options={measurements.map(({ id, label }) => ({ value: id, label }))} path={["coreDesign", "decisionTraceability", traceIndex, "measurementDefinitionIds"]} client={client} />
        </div></details>;
      })}
    </>}
  </Workspace>;
}

function MeasurementReportEditor({ core, client }: { core: CoreDesignV1; client: StudioCollaborationClient }) {
  const measurements = coreArray(core, "measurementDefinitions");
  const reports = coreArray(core, "reports");
  const questions = coreArray(core, "researchQuestions");
  const roles = coreArray(core, "sessionRoles");
  const sources = ["evidence", "artifacts", "state", "polls", "messages", "voice", "plugins"] as const;
  return <Workspace id="measurements-reports" title="Measurements & reports" intro="Define versioned measurements and report outputs. Every report section uses an available governed source and retains its definition version.">
    <h3>Measurement Definitions</h3>
    <div className="editor-list">{measurements.map((measurement, index) => <details className="editor-item" key={measurement.id}><summary><span>{measurement.label}</span><span className="badge badge-muted">v{measurement.version}</span></summary><div className="item-body grid-fields">
      <TextField id={`measurement-label-${measurement.id}`} label="Measurement label" value={measurement.label} path={["coreDesign", "measurementDefinitions", index, "label"]} client={client} />
      <TextField id={`measurement-key-${measurement.id}`} label="Stable key" value={measurement.key} path={["coreDesign", "measurementDefinitions", index, "key"]} client={client} />
      <TextField id={`measurement-version-${measurement.id}`} label="Definition version" value={measurement.version} type="number" path={["coreDesign", "measurementDefinitions", index, "version"]} client={client} />
      <TextField id={`measurement-description-${measurement.id}`} label="Definition" value={measurement.description} path={["coreDesign", "measurementDefinitions", index, "description"]} client={client} multiline />
      <SelectField id={`measurement-source-${measurement.id}`} label="Governed source" value={measurement.source} options={sources.map((value) => ({ value, label: value }))} path={["coreDesign", "measurementDefinitions", index, "source"]} client={client} />
      <SelectField id={`measurement-aggregation-${measurement.id}`} label="Aggregation" value={measurement.aggregation} options={["count", "sum", "average", "minimum", "maximum", "latest"].map((value) => ({ value, label: value }))} path={["coreDesign", "measurementDefinitions", index, "aggregation"]} client={client} />
      <TextField id={`measurement-unit-${measurement.id}`} label="Unit" value={measurement.unit} path={["coreDesign", "measurementDefinitions", index, "unit"]} client={client} />
      <MultiCheck legend="Research Questions" values={measurement.researchQuestionIds} options={questions.map(({ id, question }) => ({ value: id, label: question }))} path={["coreDesign", "measurementDefinitions", index, "researchQuestionIds"]} client={client} />
      <ItemActions path={["coreDesign", "measurementDefinitions"]} index={index} count={measurements.length} client={client} label={measurement.label} />
    </div></details>)}</div>
    <AddButton label="Add Measurement Definition" onClick={() => client.appendAtPath(["coreDesign", "measurementDefinitions"], { id: identifier(), key: `measurement_${measurements.length + 1}`, version: 1, researchQuestionIds: [], label: "New measurement", description: "", source: "evidence", aggregation: "count", unit: "events" })} />
    <h3>Report Definitions</h3>
    <div className="editor-list">{reports.map((report, index) => {
      const sections = report.sections as Array<{ id?: string; title?: string; source?: string; measurementDefinitionIds?: string[] }>;
      return <details className="editor-item" key={report.id}><summary><span>{report.name}</span><span className="badge badge-muted">{report.formats.join(", ")}</span></summary><div className="item-body grid-fields">
        <TextField id={`report-name-${report.id}`} label="Report name" value={report.name} path={["coreDesign", "reports", index, "name"]} client={client} />
        <TextField id={`report-audience-${report.id}`} label="Audience" value={report.audience} path={["coreDesign", "reports", index, "audience"]} client={client} />
        <TextField id={`report-formats-${report.id}`} label="Formats (comma separated)" value={report.formats.join(", ")} path={["coreDesign", "reports", index, "formats"]} client={client} transform={(value) => value.split(",").map((item) => item.trim()).filter(Boolean)} />
        <MultiCheck legend="Available to Session Roles" values={report.availableToSessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "reports", index, "availableToSessionRoleIds"]} client={client} />
        <fieldset className="nested-editor"><legend>Report sections</legend>{sections.map((section, sectionIndex) => <div className="grid-fields" key={section.id ?? sectionIndex}>
          <TextField id={`report-section-title-${report.id}-${sectionIndex}`} label="Section title" value={section.title ?? ""} path={["coreDesign", "reports", index, "sections", sectionIndex, "title"]} client={client} />
          <SelectField id={`report-section-source-${report.id}-${sectionIndex}`} label="Data source" value={section.source ?? "evidence"} options={sources.map((value) => ({ value, label: value }))} path={["coreDesign", "reports", index, "sections", sectionIndex, "source"]} client={client} />
          <MultiCheck legend="Measurements" values={section.measurementDefinitionIds ?? []} options={measurements.map(({ id, label }) => ({ value: id, label }))} path={["coreDesign", "reports", index, "sections", sectionIndex, "measurementDefinitionIds"]} client={client} />
          <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "reports", index, "sections"], sectionIndex)}>Remove section</button>
        </div>)}<AddButton label="Add report section" onClick={() => client.appendAtPath(["coreDesign", "reports", index, "sections"], { id: identifier(), title: "Summary", source: "evidence", measurementDefinitionIds: [] })} /></fieldset>
        <ItemActions path={["coreDesign", "reports"]} index={index} count={reports.length} client={client} label={report.name} />
      </div></details>;
    })}</div>
    <AddButton label="Add Report Definition" onClick={() => client.appendAtPath(["coreDesign", "reports"], { id: identifier(), name: "New report", audience: "Control", formats: ["json"], sections: [], availableToSessionRoleIds: [] })} />
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
  const profiles = coreArray(core, "interfaces");
  const roles = coreArray(core, "sessionRoles");
  const [rosterText, setRosterText] = useState("");
  const rosterRows = rosterText.split(/\r?\n/u).map((row) => row.trim()).filter(Boolean).map((row) => row.split(",").map((cell) => cell.trim()));
  if (policy === undefined) return <Workspace id="access" title="Access" intro="A session code identifies a Session but never grants access by itself."><AddButton label="Add access policy" onClick={() => client.setAtPath(["coreDesign", "accessPolicy"], { joinMethods: ["operator_assignment"], guests: { allowed: false, requiredFields: [], expiryHours: 0, includeInResearchExports: false, operatorApproval: true }, displays: [], reassignment: { allowedBy: "operator", crossTeamAllowed: false, exposureAcknowledgementRequired: true }, readiness: [] })} /></Workspace>;
  const methods = ["invitation", "code_and_verified_email", "sso", "code_and_guest_pin", "waiting_room", "open_seat_selection", "operator_assignment"] as const;
  return <Workspace id="access" title="Access" intro="Configure trusted join methods, guests, shared displays, and reassignment. Ambiguous roster rows must be reviewed in the later roster workflow.">
    <MultiCheck legend="Join methods" values={policy.joinMethods} options={methods.map((value) => ({ value, label: value.replaceAll("_", " ") }))} path={["coreDesign", "accessPolicy", "joinMethods"]} client={client} />
    <CheckField id="guest-access" label="Allow Guests" checked={policy.guests.allowed} path={["coreDesign", "accessPolicy", "guests", "allowed"]} client={client} />
    <div className="grid-fields">
      <TextField id="guest-required-fields" label="Required Guest fields (comma separated)" value={policy.guests.requiredFields.join(", ")} path={["coreDesign", "accessPolicy", "guests", "requiredFields"]} client={client} transform={(value) => value.split(",").map((item) => item.trim()).filter(Boolean)} />
      <TextField id="guest-expiry" label="Guest expiry (hours)" value={policy.guests.expiryHours} type="number" path={["coreDesign", "accessPolicy", "guests", "expiryHours"]} client={client} />
      <CheckField id="guest-approval" label="Require Operator approval" checked={policy.guests.operatorApproval} path={["coreDesign", "accessPolicy", "guests", "operatorApproval"]} client={client} />
      <CheckField id="guest-research" label="Include consented Guests in research exports" checked={policy.guests.includeInResearchExports} path={["coreDesign", "accessPolicy", "guests", "includeInResearchExports"]} client={client} />
      <SelectField id="reassignment-authority" label="Reassignment authority" value={policy.reassignment.allowedBy} options={[{ value: "operator", label: "Operator" }, { value: "operator_with_approval", label: "Operator with approval" }]} path={["coreDesign", "accessPolicy", "reassignment", "allowedBy"]} client={client} />
    </div>
    <CheckField id="cross-team-reassignment" label="Allow cross-Team reassignment" checked={policy.reassignment.crossTeamAllowed} path={["coreDesign", "accessPolicy", "reassignment", "crossTeamAllowed"]} client={client} />
    <CheckField id="exposure-warning" label="Require exposure acknowledgement when reassigning" checked={policy.reassignment.exposureAcknowledgementRequired} path={["coreDesign", "accessPolicy", "reassignment", "exposureAcknowledgementRequired"]} client={client} />
    <h3>Shared displays</h3>{policy.displays.map((display, index) => <div className="field-row" key={`${display.interfaceProfileId}-${index}`}>
      <SelectField id={`display-profile-${index}`} label="Interface Profile" value={display.interfaceProfileId} options={profiles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "accessPolicy", "displays", index, "interfaceProfileId"]} client={client} />
      <SelectField id={`display-classification-${index}`} label="Classification ceiling" value={display.classificationCeiling} options={["public", "internal", "confidential", "restricted"].map((value) => ({ value, label: value }))} path={["coreDesign", "accessPolicy", "displays", index, "classificationCeiling"]} client={client} />
      <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "accessPolicy", "displays"], index)}>Remove display</button>
    </div>)}<AddButton label="Add shared display" disabled={profiles.length === 0} onClick={() => client.appendAtPath(["coreDesign", "accessPolicy", "displays"], { interfaceProfileId: profiles[0]?.id ?? "", classificationCeiling: "public" })} />
    <h3>Readiness design</h3>{policy.readiness.map((check, index) => <div className="nested-editor grid-fields" key={`${check.key}-${index}`}>
      <TextField id={`readiness-key-${index}`} label="Stable key" value={check.key} path={["coreDesign", "accessPolicy", "readiness", index, "key"]} client={client} />
      <TextField id={`readiness-label-${index}`} label="Readiness check" value={check.label} path={["coreDesign", "accessPolicy", "readiness", index, "label"]} client={client} />
      <MultiCheck legend="Applicable Session Roles" values={check.sessionRoleIds ?? []} options={roles.map(({ id, name }) => ({ value: id, label: name }))} path={["coreDesign", "accessPolicy", "readiness", index, "sessionRoleIds"]} client={client} />
      <CheckField id={`readiness-blocking-${index}`} label="Blocks Session readiness" checked={check.blocking} path={["coreDesign", "accessPolicy", "readiness", index, "blocking"]} client={client} />
      <button className="btn-danger compact" type="button" onClick={() => client.removeAtPath(["coreDesign", "accessPolicy", "readiness"], index)}>Remove check</button>
    </div>)}<AddButton label="Add readiness check" onClick={() => client.appendAtPath(["coreDesign", "accessPolicy", "readiness"], { key: `check_${policy.readiness.length + 1}`, label: "New readiness check", sessionRoleIds: [], blocking: true })} />
    <h3>Roster import review</h3><p className="hint">Preview synthetic comma-separated rows before any Runtime import. Nothing is submitted from this design review.</p>
    <div className="field"><label htmlFor="roster-review">Name, email, Seat</label><textarea id="roster-review" rows={4} value={rosterText} onChange={(event) => setRosterText(event.target.value)} /></div>
    {rosterRows.length === 0 ? <p>No roster rows to review.</p> : <table><caption>Roster review preview</caption><thead><tr><th>Name</th><th>Email</th><th>Seat</th><th>Review</th></tr></thead><tbody>{rosterRows.map((row, index) => <tr key={`${row.join(":")}-${index}`}><td>{row[0] || "Missing"}</td><td>{row[1] || "Missing"}</td><td>{row[2] || "Unassigned"}</td><td>{row.length === 3 && row.every(Boolean) ? "Ready" : "Needs review"}</td></tr>)}</tbody></table>}
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

function Rehearsal({ projectId }: { projectId: string }) {
  const [seed, setSeed] = useState(760);
  const [startedAt, setStartedAt] = useState("2026-01-15T12:00:00.000Z");
  const [result, setResult] = useState<StudioRehearsalV1 | null>(null);
  const [message, setMessage] = useState("No rehearsal has run. Rehearsal is explanation-only and cannot change a Session.");
  const [busy, setBusy] = useState(false);
  async function run(): Promise<void> {
    setBusy(true); setResult(null); setMessage("Running the bounded deterministic rehearsal.");
    try {
      const response = await fetch(`/v1/projects/${projectId}/rehearsals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seed, startedAt }) });
      const body = await response.json() as StudioRehearsalV1 | { error?: { message?: string } };
      if (!response.ok || !("trace" in body)) throw new Error((body as { error?: { message?: string } }).error?.message ?? "Rehearsal failed.");
      setResult(body); setMessage(`Rehearsal completed with ${body.trace.length} evaluated trigger${body.trace.length === 1 ? "" : "s"}. No Session state changed.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Rehearsal failed."); }
    finally { setBusy(false); }
  }
  return <Workspace id="test-validate" title="Test & validate" intro="Run a deterministic, bounded Stage rehearsal. The result explains why each evaluated trigger fired or did not fire and never mutates Runtime state.">
    <div className="grid-fields">
      <div className="field"><label htmlFor="rehearsal-seed">Deterministic seed</label><input id="rehearsal-seed" type="number" min={0} step={1} value={seed} onChange={(event) => setSeed(Number(event.target.value))} /></div>
      <div className="field"><label htmlFor="rehearsal-start">Fixed ISO start time</label><input id="rehearsal-start" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} /></div>
    </div><button className="btn-primary" type="button" disabled={busy || !Number.isSafeInteger(seed) || seed < 0 || Number.isNaN(Date.parse(startedAt))} onClick={() => void run()}>{busy ? "Rehearsing…" : "Run deterministic rehearsal"}</button>
    <p role="status" aria-live="polite">{message}</p>
    {result === null ? null : <div className="rehearsal-result"><p className="digest-line">Exact Draft digest {result.artifactDigest}</p><p>Final Stages: {result.finalStageIds.join(", ") || "none"}</p>
      {result.trace.length === 0 ? <p>No triggers were evaluated. Add at least one Stage to rehearse.</p> : <ol>{result.trace.map((trace) => <li key={trace.triggerId}><strong>{trace.triggerId}</strong> — {trace.fired ? "fired" : "did not fire"}<ul>{trace.explanations.length === 0 ? <li>No condition was required.</li> : trace.explanations.map((explanation) => <li key={`${trace.triggerId}-${explanation.path}`}>{explanation.fact ?? explanation.path}: {explanation.passed ? "passed" : "failed"} ({explanation.reason.replaceAll("_", " ")})</li>)}</ul>{trace.stateChanges.map((change) => <p key={`${trace.triggerId}-${change.stateVariableId}`}>{change.stateVariableId}: {String(change.previousValue)} → {String(change.newValue)}</p>)}</li>)}</ol>}
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
      <CommunicationsEditor core={core} client={client} />
      <InjectEditor core={core} scenario={scenario} client={client} />
      <ContentLibraryEditor projectId={projectId} core={core} client={client} />
      <AdvancedLogicEditor core={core} scenario={scenario} client={client} />
      <AdjudicationEditor core={core} scenario={scenario} client={client} />
      <PollEditor core={core} client={client} />
      <VoiceEditor core={core} client={client} />
      <PluginCatalogEditor projectId={projectId} core={core} client={client} />
      <CompositionEditor projectId={projectId} core={core} client={client} />
      <InterfaceEditor core={core} client={client} />
      <ResearchEditor core={core} client={client} />
      <MeasurementReportEditor core={core} client={client} />
      <AccessEditor core={core} client={client} />
      <RolePreview projectId={projectId} core={core} />
      <Rehearsal projectId={projectId} />
    </div>
  </div>;
}
