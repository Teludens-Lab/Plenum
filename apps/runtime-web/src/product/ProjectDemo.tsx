import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { JsonObject, ProjectDemoV1, RuntimeFormV1 } from "@plenum/event-contracts";
import {
  type CoreDesignV1,
  type RuntimeArtifactTypeDefinitionV1,
  type RuntimeFormDefinitionV1,
  type RuntimeInterfaceProfileV1,
  type RuntimeWorkflowDefinitionV1,
  type ScenarioV1
} from "@plenum/simulation-schema";
import { PlenumLoader } from "../PlenumLoader.js";
import { FormValue } from "../runtime/FormTableSummary.js";

export type ProjectDemoFieldEditorProps = {
  form: RuntimeFormV1;
  initial?: JsonObject;
  disabled: boolean;
  onSubmit(payload: JsonObject): void;
  submitLabel: string;
};

type DemoArtifact = {
  id: string;
  artifactTypeId: string;
  title: string;
  formId: string;
  workflowId: string;
  state: string;
  payload: JsonObject;
  createdSessionRoleId: string;
  createdTeamId: string | null;
  version: number;
};

type DraftMaterialization = { coreDesign: CoreDesignV1; scenario: ScenarioV1 };

function arrays(core: CoreDesignV1) {
  return {
    roles: core.sessionRoles ?? [], teams: core.teams ?? [], stages: core.stages ?? [],
    interfaces: core.interfaces ?? [], artifactTypes: core.artifactTypes ?? [], forms: core.forms ?? [],
    workflows: core.workflows ?? [], resources: core.resources ?? []
  };
}

function isDraftMaterialization(value: JsonObject): value is JsonObject & DraftMaterialization {
  return typeof value.coreDesign === "object" && value.coreDesign !== null && !Array.isArray(value.coreDesign) &&
    typeof value.scenario === "object" && value.scenario !== null && !Array.isArray(value.scenario);
}

function asRuntimeForm(form: RuntimeFormDefinitionV1): RuntimeFormV1 {
  const field = (item: RuntimeFormDefinitionV1["sections"][number]["fields"][number]): RuntimeFormV1["fields"][number] => ({
    key: item.key,
    label: item.label,
    type: item.type === "short_text" ? "text" : item.type,
    required: item.required === true,
    ...(form.contractId === undefined || item.defaultValue === undefined ? {} : { defaultValue: item.defaultValue }),
    ...(item.numeric === undefined ? {} : { numeric: item.numeric }),
    ...(item.computation === undefined ? {} : { computation: item.computation, readOnly: true }),
    ...(item.formattedTextContractId === undefined ? {} : { formattedTextContractId: item.formattedTextContractId }),
    ...(item.entityReference === undefined ? {} : { entityReference: item.entityReference }),
    ...(item.requiredWhen === undefined ? {} : { requiredWhen: item.requiredWhen }),
    ...(item.visibleWhen === undefined ? {} : { visibleWhen: item.visibleWhen }),
    ...(item.helpText === undefined ? {} : { helpText: item.helpText }),
    ...(item.options === undefined ? {} : { options: item.options }),
    ...(item.readOnly === undefined ? {} : { readOnly: item.readOnly }),
    ...(item.validation === undefined ? {} : { validation: item.validation })
  });
  const sections = form.sections.map((section) => ({
    id: section.id,
    ...(section.title === undefined ? {} : { title: section.title }),
    ...(section.description === undefined ? {} : { description: section.description }),
    ...(section.repeatable === undefined ? {} : { repeatable: section.repeatable }),
    ...(section.itemLabel === undefined ? {} : { itemLabel: section.itemLabel }),
    ...(section.itemKeyField === undefined ? {} : { itemKeyField: section.itemKeyField }),
    ...(section.minItems === undefined ? {} : { minItems: section.minItems }),
    ...(section.maxItems === undefined ? {} : { maxItems: section.maxItems }),
    fields: section.fields.map(field)
  }));
  return {
    id: form.id, name: form.name, formVersion: form.formVersion,
    ...(form.contractId === undefined ? {} : { contractId: form.contractId }),
    fields: sections.flatMap((section) => section.fields), sections,
    ...(form.rules === undefined ? {} : { rules: form.rules })
  };
}

function interfaceFor(core: CoreDesignV1, sessionRoleId: string, teamId: string, stageId: string): RuntimeInterfaceProfileV1 | undefined {
  return (core.interfaces ?? []).find((profile) => {
    const selectors = profile.selectors;
    return (selectors.sessionRoleIds === undefined || selectors.sessionRoleIds.includes(sessionRoleId)) &&
      (selectors.teamIds === undefined || selectors.teamIds.includes(teamId)) &&
      (selectors.stageIds === undefined || selectors.stageIds.includes(stageId));
  });
}

function availableArtifactTypes(core: CoreDesignV1, sessionRoleId: string, teamId: string, stageId: string): RuntimeArtifactTypeDefinitionV1[] {
  return (core.artifactTypes ?? []).filter((artifactType) =>
    artifactType.allowedCreatorSessionRoleIds.includes(sessionRoleId) &&
    (artifactType.allowedTeamIds === undefined || artifactType.allowedTeamIds.includes(teamId)) &&
    (artifactType.availableStageIds === undefined || artifactType.availableStageIds.includes(stageId)));
}

function stateLabel(workflow: RuntimeWorkflowDefinitionV1 | undefined, state: string): string {
  return workflow?.states.find(({ key }) => key === state)?.label ?? state.replaceAll("_", " ");
}

function ArtifactFields({ form, payload }: { form: RuntimeFormV1; payload: JsonObject }) {
  return <dl className="qa-demo-artifact-fields">{form.fields.map((field) => {
    return <div key={field.key}><dt>{field.label}</dt><dd><FormValue field={field} payload={payload} /></dd></div>;
  })}</dl>;
}

function DemoArtifactCard({ artifact, sessionRoleId, form, workflow, editing, onEdit, onApply, FieldEditorComponent }: {
  artifact: DemoArtifact;
  sessionRoleId: string;
  form: RuntimeFormV1;
  workflow: RuntimeWorkflowDefinitionV1 | undefined;
  editing: boolean;
  onEdit(): void;
  onApply(transitionId: string, payload?: JsonObject): void;
  FieldEditorComponent: ComponentType<ProjectDemoFieldEditorProps>;
}) {
  const actions = workflow?.transitions.filter((transition) => transition.from === artifact.state && transition.allowedSessionRoleIds.includes(sessionRoleId)) ?? [];
  const editAction = actions.find((transition) => transition.contentOnly === true || transition.command.endsWith(".edit") || (transition.editableFieldKeys?.length ?? 0) > 0);
  const directActions = actions.filter((transition) => transition !== editAction);
  return <article className="qa-demo-artifact" aria-labelledby={`qa-artifact-${artifact.id}`}>
    <div className="qa-demo-artifact-heading">
      <div><h3 id={`qa-artifact-${artifact.id}`}>{artifact.title}</h3><p>Demo artifact · Version {artifact.version}</p></div>
      <span className="badge badge-state">{stateLabel(workflow, artifact.state)}</span>
    </div>
    <ArtifactFields form={form} payload={artifact.payload} />
    {actions.length === 0 ? <p className="hint">This role has no action at the artifact’s current state. Switch roles to continue the authored custody path.</p> : null}
    <div className="actions">
      {editAction === undefined ? null : <button className="btn-secondary" type="button" aria-expanded={editing} onClick={onEdit}>{editing ? "Close editor" : editAction.label ?? "Edit artifact"}</button>}
      {directActions.map((transition) => <button className="btn-primary" type="button" key={transition.id}
        onClick={() => onApply(transition.id)}>{transition.label ?? transition.command.replace("artifact.", "")}</button>)}
    </div>
    {editing && editAction !== undefined ? <div className="qa-demo-inline-editor">
      <FieldEditorComponent form={form} initial={artifact.payload} disabled={false} submitLabel={editAction.label ?? "Save changes"}
        onSubmit={(payload) => onApply(editAction.id, payload)} />
    </div> : null}
  </article>;
}

export function ProjectDemo({ projectId, FieldEditorComponent }: {
  projectId: string;
  FieldEditorComponent: ComponentType<ProjectDemoFieldEditorProps>;
}) {
  const [demo, setDemo] = useState<ProjectDemoV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionRoleId, setSessionRoleId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [stageId, setStageId] = useState("");
  const [navigationId, setNavigationId] = useState("");
  const [artifacts, setArtifacts] = useState<DemoArtifact[]>([]);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);
  const [notice, setNotice] = useState("Loading the current Project Draft.");

  useEffect(() => {
    let active = true;
    void fetch(`/v1/projects/${projectId}/demo`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json() as ProjectDemoV1 | { error?: { message?: string } };
        if (!response.ok || !("contractId" in body)) throw new Error("error" in body ? body.error?.message : "The QA demo could not be opened.");
        if (!isDraftMaterialization(body.materialization)) throw new Error("The Project Draft does not contain a usable Core Design and Scenario.");
        if (active) { setDemo(body); setError(null); setNotice("QA demo ready. Local actions are not written to a Session."); }
      })
      .catch((cause) => {
        if (active) { setDemo(null); setError(cause instanceof Error ? cause.message : "The QA demo could not be opened."); setNotice(""); }
      });
    return () => { active = false; };
  }, [projectId]);

  const materialization = demo !== null && isDraftMaterialization(demo.materialization) ? demo.materialization : null;
  const core = materialization?.coreDesign;
  const scenario = materialization?.scenario;
  const data = useMemo(() => core === undefined ? null : arrays(core), [core]);

  useEffect(() => {
    if (data === null) return;
    setSessionRoleId((current) => data.roles.some(({ id }) => id === current) ? current : data.roles[0]?.id ?? "");
    setStageId((current) => data.stages.some(({ id }) => id === current) ? current : data.stages[0]?.id ?? "");
  }, [demo]);

  const role = data?.roles.find(({ id }) => id === sessionRoleId);
  const eligibleTeams = useMemo(() => data === null || role === undefined ? [] :
    role.allowedTeamIds === undefined ? data.teams : data.teams.filter(({ id }) => role.allowedTeamIds?.includes(id)), [data, role]);
  useEffect(() => {
    setTeamId((current) => {
      if (role?.allowedTeamIds === undefined) return current === "" || eligibleTeams.some(({ id }) => id === current) ? current : "";
      return eligibleTeams.some(({ id }) => id === current) ? current : eligibleTeams[0]?.id ?? "";
    });
  }, [sessionRoleId, eligibleTeams]);

  const profile = core === undefined ? undefined : interfaceFor(core, sessionRoleId, teamId, stageId);
  useEffect(() => {
    if (profile === undefined) { setNavigationId(""); return; }
    const ordered = [...profile.navigation.items].sort((left, right) => left.order - right.order);
    setNavigationId((current) => ordered.some(({ id }) => id === current) ? current : profile.navigation.defaultItemId ?? ordered[0]?.id ?? "");
  }, [profile]);

  if (demo === null) return <main id="main-content" className="qa-demo-state" tabIndex={-1}>
    {error === null ? <><h1 className="visually-hidden">Opening QA demo</h1><PlenumLoader label="Opening the Project QA demo" /></> : <section className="card"><h1>QA demo unavailable</h1>
      <p role="alert">{error}</p>
      <div className="actions"><a className="btn-secondary link-button" href="/?workspace=projects">Return to Projects</a>
        <button className="btn-primary" type="button" onClick={() => window.location.reload()}>Retry</button></div>
    </section>}
  </main>;

  if (core === undefined || scenario === undefined || data === null) return null;
  const stage = data.stages.find(({ id }) => id === stageId);
  const team = data.teams.find(({ id }) => id === teamId);
  const artifactTypes = availableArtifactTypes(core, sessionRoleId, teamId, stageId);
  const selectedNavigation = profile?.navigation.items.find(({ id }) => id === navigationId);
  const visibleRegions = profile?.layout.template === "workspace" && selectedNavigation?.target.regionId !== undefined
    ? profile.layout.regions.filter(({ id }) => id === selectedNavigation.target.regionId) : profile?.layout.regions ?? [];
  const reset = () => {
    setArtifacts([]); setEditingArtifactId(null); setNotice("Demo artifacts cleared. The Project Draft was not changed.");
  };
  const createArtifact = (artifactType: RuntimeArtifactTypeDefinitionV1, payload: JsonObject) => {
    const workflow = data.workflows.find(({ id }) => id === artifactType.workflowId);
    const start = workflow?.transitions.find((transition) => transition.from === null && transition.allowedSessionRoleIds.includes(sessionRoleId));
    if (workflow === undefined || start === undefined) {
      setNotice("The authored workflow does not provide this role with a valid create transition.");
      return;
    }
    setArtifacts((current) => [...current, {
      id: crypto.randomUUID(), artifactTypeId: artifactType.id, title: artifactType.name, formId: artifactType.formId,
      workflowId: artifactType.workflowId, state: start.to, payload, createdSessionRoleId: sessionRoleId,
      createdTeamId: teamId || null, version: 1
    }]);
    setNotice(`${artifactType.name} created locally as ${stateLabel(workflow, start.to)}. Switch roles to test its next authored action.`);
  };
  const applyTransition = (artifactId: string, transitionId: string, payload?: JsonObject) => {
    const artifact = artifacts.find(({ id }) => id === artifactId);
    const workflow = artifact === undefined ? undefined : data.workflows.find(({ id }) => id === artifact.workflowId);
    const transition = artifact === undefined ? undefined : workflow?.transitions.find((item) =>
      item.id === transitionId && item.from === artifact.state && item.allowedSessionRoleIds.includes(sessionRoleId));
    if (artifact === undefined || transition === undefined) {
      setNotice("That action is not available to the selected role.");
      return;
    }
    setArtifacts((current) => current.map((item) => item.id === artifactId
      ? { ...item, state: transition.to, payload: payload ?? item.payload, version: item.version + 1 }
      : item));
    setEditingArtifactId(null);
    setNotice(`${transition.label ?? transition.command} completed locally. No Session evidence was created.`);
  };

  const renderModule = (module: RuntimeInterfaceProfileV1["layout"]["regions"][number]["modules"][number]): ReactNode => {
    const title = module.title ?? module.moduleType.replaceAll("_", " ");
    const emptyText = typeof module.configuration.emptyStateText === "string" ? module.configuration.emptyStateText : "Nothing is available in this context.";
    const moduleArtifactTypes = artifactTypes.filter((type) =>
      (!Array.isArray(module.configuration.artifactTypeKeys) || module.configuration.artifactTypeKeys.includes(type.key)) &&
      (typeof module.configuration.artifactTypeId !== "string" || module.configuration.artifactTypeId === type.id));
    if (module.moduleType === "session_status") return <section className="workspace-section curated-runtime-module" aria-labelledby={`qa-module-${module.id}`}>
      <h2 id={`qa-module-${module.id}`}>{title}</h2><dl className="runtime-status-list">
        <div><dt>Demo</dt><dd>Isolated Draft</dd></div><div><dt>Stage</dt><dd>{stage?.name ?? "Not configured"}</dd></div>
        <div><dt>Role</dt><dd>{role?.name ?? "Not configured"}</dd></div><div><dt>Team</dt><dd>{team?.name ?? "No Team"}</dd></div>
      </dl>
    </section>;
    if (module.moduleType === "artifact_form") return <section className="qa-demo-module" aria-labelledby={`qa-module-${module.id}`}>
      <div className="section-heading"><h2 id={`qa-module-${module.id}`}>{title}</h2></div>
      {moduleArtifactTypes.length === 0 ? <p className="empty-state">{emptyText}</p> : <div className="qa-demo-create-grid">{moduleArtifactTypes.map((artifactType) => {
        const form = data.forms.find(({ id }) => id === artifactType.formId);
        return form === undefined ? <p className="empty-state" key={artifactType.id}>{artifactType.name} refers to a missing Form.</p> :
          <section className="qa-demo-create" key={artifactType.id} aria-labelledby={`qa-create-${module.id}-${artifactType.id}`}><h3 id={`qa-create-${module.id}-${artifactType.id}`}>{artifactType.name}</h3>
            <FieldEditorComponent form={asRuntimeForm(form)} disabled={false} submitLabel="Create demo artifact" onSubmit={(payload) => createArtifact(artifactType, payload)} />
          </section>;
      })}</div>}
    </section>;
    if (module.moduleType === "task_list") return <section className="qa-demo-module" aria-labelledby={`qa-module-${module.id}`}>
      <div className="section-heading"><h2 id={`qa-module-${module.id}`}>{title}</h2></div>
      {artifacts.length === 0 ? <p className="empty-state">{emptyText}</p> : <div className="qa-demo-artifact-list">{artifacts.map((artifact) => {
        const form = data.forms.find(({ id }) => id === artifact.formId);
        const workflow = data.workflows.find(({ id }) => id === artifact.workflowId);
        return form === undefined ? null : <DemoArtifactCard key={artifact.id} artifact={artifact} sessionRoleId={sessionRoleId} form={asRuntimeForm(form)} workflow={workflow}
          editing={editingArtifactId === artifact.id} onEdit={() => setEditingArtifactId((current) => current === artifact.id ? null : artifact.id)}
          onApply={(transitionId, payload) => applyTransition(artifact.id, transitionId, payload)} FieldEditorComponent={FieldEditorComponent} />;
      })}</div>}
    </section>;
    if (module.moduleType === "artifact_presentation") return <section className="workspace-section curated-runtime-module" aria-labelledby={`qa-module-${module.id}`}>
      <h2 id={`qa-module-${module.id}`}>{title}</h2>{artifacts.length === 0 ? <p className="empty-state">{emptyText}</p> :
        <ul className="presentation-artifact-list">{artifacts.map((artifact) => <li key={artifact.id}><strong>{artifact.title}</strong>
          <span>{stateLabel(data.workflows.find(({ id }) => id === artifact.workflowId), artifact.state)}</span></li>)}</ul>}
    </section>;
    if (module.moduleType === "slide_deck") {
      const resourceId = typeof module.configuration.releaseResourceId === "string" ? module.configuration.releaseResourceId : "";
      const resource = data.resources.find(({ id }) => id === resourceId);
      return <section className="workspace-section curated-runtime-module runtime-deck-module" aria-labelledby={`qa-module-${module.id}`}><h2 id={`qa-module-${module.id}`}>{title}</h2>
        {resource?.dataUri === undefined ? <p className="empty-state">{emptyText}</p> : <iframe className="runtime-deck-frame" src={resource.dataUri} title={title} loading="lazy" sandbox="allow-scripts" allowFullScreen />}
      </section>;
    }
    if (module.moduleType === "resource_library") {
      const resourceIds = Array.isArray(module.configuration.resourceIds) ? module.configuration.resourceIds.filter((id): id is string => typeof id === "string") : [];
      const resources = data.resources.filter(({ id }) => resourceIds.includes(id));
      return <section className="workspace-section curated-runtime-module runtime-resource-library" aria-labelledby={`qa-module-${module.id}`}><h2 id={`qa-module-${module.id}`}>{title}</h2>
        {resources.length === 0 ? <p className="empty-state">{emptyText}</p> : <ul className="runtime-resource-list">{resources.map((resource) => <li key={resource.id}>
          <div><strong>{resource.name}</strong><span>{resource.type.replaceAll("_", " ")} · {resource.mediaType}</span>{resource.altText === undefined ? null : <p>{resource.altText}</p>}</div>
          {resource.dataUri === undefined ? <span className="hint">Embedded content unavailable</span> : <a className="btn-secondary link-button" href={resource.dataUri} target="_blank" rel="noreferrer">Open resource</a>}
        </li>)}</ul>}
      </section>;
    }
    const scenarioItems = module.moduleType === "inject_inbox" ? scenario.content ?? [] : [];
    return <section className="workspace-section curated-runtime-module" aria-labelledby={`qa-module-${module.id}`}><h2 id={`qa-module-${module.id}`}>{title}</h2>
      {scenarioItems.length === 0 ? <><p className="empty-state">{emptyText}</p><p className="hint">External delivery is not emitted from an isolated QA demo.</p></> :
        <ul className="qa-demo-scenario-list">{scenarioItems.map((item) => <li key={item.id}><strong>{item.title}</strong>{item.body === undefined ? null : <p>{item.body}</p>}</li>)}</ul>}
    </section>;
  };

  return <main id="main-content" className="qa-demo-workspace" tabIndex={-1} aria-labelledby="qa-demo-title">
    <section className="qa-demo-intro">
      <div><h1 id="qa-demo-title">{demo.projectTitle}</h1>
        <p>Walk the current Draft through every participant role, interface, Stage, resource, and artifact workflow before publication.</p></div>
      <div className="qa-demo-intro-actions"><a className="btn-secondary link-button" href={`/studio/projects/${projectId}`}>Open Project Draft</a>
        <button className="btn-secondary" type="button" disabled={artifacts.length === 0} onClick={reset}>Reset local demo</button></div>
    </section>
    <section className="qa-demo-assurance" aria-label="QA demo isolation notice">
      <strong>Isolated review environment</strong><span>Actions and artifacts stay in this browser memory and clear on reload. Sessions, participants, evidence, reports, and the Project Draft are unchanged.</span>
    </section>
    {!demo.validation.valid ? <section className="qa-demo-validation" role="status"><strong>Draft validation has open issues.</strong>
      <span>You can inspect the experience, but publication readiness still depends on resolving {demo.validation.issues.length} validation issue{demo.validation.issues.length === 1 ? "" : "s"}.</span></section> : null}
    <section className="qa-demo-context" aria-labelledby="qa-demo-context-title"><h2 id="qa-demo-context-title">Participant context</h2>
      <div className="qa-demo-context-fields">
        <div className="qa-demo-context-field"><label htmlFor="qa-demo-session-role">Role</label><select id="qa-demo-session-role" value={sessionRoleId} onChange={(event) => { setSessionRoleId(event.target.value); setEditingArtifactId(null); setNotice(`Viewing the Draft as ${data.roles.find(({ id }) => id === event.target.value)?.name ?? "the selected role"}.`); }}>
          {data.roles.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></div>
        <div className="qa-demo-context-field"><label htmlFor="qa-demo-team">Team</label><select id="qa-demo-team" value={teamId} onChange={(event) => { setTeamId(event.target.value); setEditingArtifactId(null); }}><option value="">No Team</option>
          {eligibleTeams.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></div>
        <div className="qa-demo-context-field"><label htmlFor="qa-demo-stage">Stage</label><select id="qa-demo-stage" value={stageId} onChange={(event) => { setStageId(event.target.value); setEditingArtifactId(null); }}>
          {data.stages.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></div>
      </div>
      <p className="qa-demo-notice" role="status" aria-live="polite">{notice}</p>
    </section>
    {data.roles.length === 0 || data.stages.length === 0 ? <section className="empty-state"><h2>The participant experience is not ready to demo</h2><p>Add at least one Session Role and Stage in the Project Draft.</p></section> :
      profile === undefined ? <section className="empty-state"><h2>No interface matches this context</h2><p>Assign an Interface Profile to the selected Role, Team, or Stage in the Project Draft.</p></section> : <>
        <nav className="qa-demo-navigation" aria-label="Participant interface">
          {profile.navigation.items.length === 0 ? <span>{profile.name}</span> : [...profile.navigation.items].sort((left, right) => left.order - right.order).map((item) =>
            <button type="button" key={item.id} aria-current={navigationId === item.id ? "page" : undefined} onClick={() => setNavigationId(item.id)}>{item.label}</button>)}
        </nav>
        <div className={`qa-demo-regions qa-demo-layout-${profile.layout.template}`}>{visibleRegions.map((region) => <section className="qa-demo-region" key={region.id} aria-label={`${region.id.replaceAll("_", " ")} region`}>
          {region.modules.map((module) => <div id={`runtime-module-${module.id}`} key={module.id}>{renderModule(module)}</div>)}
        </section>)}</div>
      </>}
  </main>;
}
