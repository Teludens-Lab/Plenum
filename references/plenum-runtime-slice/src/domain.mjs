// Plenum reference slice — domain rules.
// Everything simulation-specific (roles, states, transitions, forms) comes from the published
// definition (DEC-45). Nothing in this file names a particular Session Role or workflow state.
import {createHash, randomUUID} from 'node:crypto';

export const id = () => randomUUID();

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMAND_NAME = /^[a-z_]+\.[a-z_]+$/;
const STATE_KINDS = ['draft', 'task', 'review', 'approval', 'wait', 'terminal', 'cancelled'];
const TERMINAL_KINDS = ['terminal', 'cancelled'];
const SLICE_FIELD_TYPES = ['short_text', 'long_text'];

export function domainError(code, message, details) {
  return Object.assign(new Error(message), {code, details: details ?? null});
}

// Canonical serialization: sorted object keys, no insignificant whitespace (09 §3).
export function canonicalize(value) {
  if (value === undefined || value === null) return 'null';
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (typeof value === 'object') {
    return '{' + Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + canonicalize(value[key]))
      .join(',') + '}';
  }
  return JSON.stringify(value);
}

export const sha = (value) => createHash('sha256').update(canonicalize(value)).digest('hex');

export const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Plain-language validation of a slice definition (a subset of the 03 Schema Core Design).
export function validateDefinition(d) {
  const errors = [];
  if (!isPlainObject(d)) return {valid: false, errors: ['The definition must be a JSON object.']};

  const roles = Array.isArray(d.sessionRoles) ? d.sessionRoles : [];
  const roleIds = new Set();
  if (!roles.length) errors.push('Add at least one session role.');
  for (const role of roles) {
    if (!isPlainObject(role) || typeof role.id !== 'string' || !role.id) { errors.push('Every session role needs an id.'); continue; }
    if (roleIds.has(role.id)) errors.push(`Session role "${role.id}" is defined more than once.`);
    roleIds.add(role.id);
  }
  const checkRoles = (list, where) => {
    for (const roleId of Array.isArray(list) ? list : []) {
      if (!roleIds.has(roleId)) errors.push(`${where} refers to session role "${roleId}", which is not defined.`);
    }
  };

  const forms = new Map();
  for (const form of Array.isArray(d.forms) ? d.forms : []) {
    if (!isPlainObject(form) || typeof form.id !== 'string' || !form.id) { errors.push('Every form needs an id.'); continue; }
    if (forms.has(form.id)) errors.push(`Form "${form.id}" is defined more than once.`);
    if (typeof form.formVersion !== 'string' || !form.formVersion) errors.push(`Form "${form.id}" needs a formVersion.`);
    const keys = new Set();
    for (const field of Array.isArray(form.fields) ? form.fields : []) {
      if (!isPlainObject(field) || typeof field.key !== 'string' || !field.key) { errors.push(`A field in form "${form.id}" has no key.`); continue; }
      if (keys.has(field.key)) errors.push(`Field "${field.key}" appears twice in form "${form.id}".`);
      keys.add(field.key);
      if (!SLICE_FIELD_TYPES.includes(field.type)) errors.push(`Field "${field.key}" in form "${form.id}" has unsupported type "${field.type}".`);
    }
    forms.set(form.id, form);
  }

  const workflows = new Map();
  for (const wf of Array.isArray(d.workflows) ? d.workflows : []) {
    if (!isPlainObject(wf) || typeof wf.id !== 'string' || !wf.id) { errors.push('Every workflow needs an id.'); continue; }
    if (workflows.has(wf.id)) errors.push(`Workflow "${wf.id}" is defined more than once.`);
    workflows.set(wf.id, wf);
    const name = `Workflow "${wf.id}"`;
    const states = new Map();
    for (const state of Array.isArray(wf.states) ? wf.states : []) {
      if (!isPlainObject(state) || typeof state.key !== 'string' || !state.key) { errors.push(`${name} has a state without a key.`); continue; }
      if (states.has(state.key)) errors.push(`${name} defines state "${state.key}" more than once.`);
      if (!STATE_KINDS.includes(state.kind)) errors.push(`${name} state "${state.key}" has unknown kind "${state.kind}".`);
      checkRoles(state.holderSessionRoleIds, `${name} state "${state.key}"`);
      states.set(state.key, state);
    }
    if (!states.has(wf.initialState)) errors.push(`${name} has no valid initial state.`);
    if (![...states.values()].some((s) => TERMINAL_KINDS.includes(s.kind))) errors.push(`${name} has no terminal state.`);

    const transitions = Array.isArray(wf.transitions) ? wf.transitions : [];
    const seen = new Set();
    let creations = 0;
    for (const t of transitions) {
      if (!isPlainObject(t)) { errors.push(`${name} has an invalid transition.`); continue; }
      const label = `${name} transition "${t.id ?? '?'}"`;
      const from = t.from ?? null;
      if (from !== null && !states.has(from)) errors.push(`${label} starts from unknown state "${from}".`);
      if (!states.has(t.to)) errors.push(`${label} goes to unknown state "${t.to}".`);
      if (typeof t.command !== 'string' || !COMMAND_NAME.test(t.command)) errors.push(`${label} needs a command such as "artifact.submit".`);
      if (!Array.isArray(t.allowedSessionRoleIds) || !t.allowedSessionRoleIds.length) errors.push(`${label} must allow at least one session role.`);
      checkRoles(t.allowedSessionRoleIds, label);
      checkRoles(t.notifySessionRoleIds, label);
      if (t.contentOnly && from !== t.to) errors.push(`${label} is content-only, so it must start and end in the same state.`);
      if (from === null) {
        creations += 1;
        if (t.to !== wf.initialState) errors.push(`${label} creates the artifact but does not enter the initial state "${wf.initialState}".`);
      }
      for (const roleId of Array.isArray(t.allowedSessionRoleIds) ? t.allowedSessionRoleIds : []) {
        const key = `${from}|${t.command}|${roleId}`;
        if (seen.has(key)) errors.push(`${name} has two transitions for "${t.command}" by "${roleId}" from the same state.`);
        seen.add(key);
      }
    }
    if (!creations) errors.push(`${name} has no creation transition (a transition with "from": null).`);

    // Reachability from the initial state.
    const reached = new Set(states.has(wf.initialState) ? [wf.initialState] : []);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of transitions) {
        if (isPlainObject(t) && reached.has(t.from) && states.has(t.to) && !reached.has(t.to)) { reached.add(t.to); grew = true; }
      }
    }
    for (const key of states.keys()) {
      if (!reached.has(key)) errors.push(`${name} state "${key}" can never be reached.`);
    }
    for (const [key, state] of states) {
      if (TERMINAL_KINDS.includes(state.kind)) continue;
      const exits = transitions.some((t) => isPlainObject(t) && t.from === key && !t.contentOnly && t.to !== key);
      if (!exits) errors.push(`${name} state "${key}" has no way out.`);
    }
  }

  const types = Array.isArray(d.artifactTypes) ? d.artifactTypes : [];
  if (!types.length) errors.push('Add at least one artifact type.');
  const typeKeys = new Set();
  for (const type of types) {
    if (!isPlainObject(type) || typeof type.key !== 'string' || !type.key) { errors.push('Every artifact type needs a key.'); continue; }
    if (typeKeys.has(type.key)) errors.push(`Artifact type "${type.key}" is defined more than once.`);
    typeKeys.add(type.key);
    if (!forms.has(type.formId)) errors.push(`Artifact type "${type.key}" uses form "${type.formId}", which is not defined.`);
    if (!workflows.has(type.workflowId)) errors.push(`Artifact type "${type.key}" uses workflow "${type.workflowId}", which is not defined.`);
  }

  return {valid: errors.length === 0, errors};
}

export const findArtifactType = (definition, key) =>
  (definition.artifactTypes || []).find((t) => t.key === key) || null;

export const workflowFor = (definition, artifactType) =>
  (definition.workflows || []).find((w) => w.id === artifactType.workflowId) || null;

export const formFor = (definition, artifactType) =>
  (definition.forms || []).find((f) => f.id === artifactType.formId) || null;

export const stateOf = (workflow, key) =>
  (workflow.states || []).find((s) => s.key === key) || null;

export const sessionRoleIds = (definition) => (definition.sessionRoles || []).map((r) => r.id);

// Find the transition for (state, command) and check the actor's Active Role Context.
// No transition at all → INVALID_TRANSITION; a transition exists but not for this role → PERMISSION_DENIED.
export function resolveTransition(workflow, fromState, command, sessionRoleId) {
  const candidates = (workflow.transitions || []).filter((t) => (t.from ?? null) === fromState && t.command === command);
  if (!candidates.length) {
    const where = fromState === null ? 'before the artifact exists' : `while the artifact is "${fromState}"`;
    throw domainError('INVALID_TRANSITION', `"${command}" is not available ${where}.`);
  }
  const transition = candidates.find((t) => (t.allowedSessionRoleIds || []).includes(sessionRoleId));
  if (!transition) throw domainError('PERMISSION_DENIED', `Session role "${sessionRoleId}" may not perform "${command}" here.`);
  return transition;
}

// Roles that may see the artifact after this transition: what they could already see, plus
// holders of the target state and roles notified by the transition. The creator always sees it.
export function visibilityAfter(currentRoleIds, workflow, transition) {
  const target = stateOf(workflow, transition.to);
  const next = new Set(currentRoleIds || []);
  for (const roleId of target?.holderSessionRoleIds || []) next.add(roleId);
  for (const roleId of transition.notifySessionRoleIds || []) next.add(roleId);
  return [...next].sort();
}

export const notificationsFor = (transition) => ({
  sessionRoleIds: transition.notifySessionRoleIds || [],
  creator: Boolean(transition.notifyCreator)
});

export function missingRequiredFields(form, content) {
  return (form?.fields || [])
    .filter((field) => field.required)
    .filter((field) => {
      const value = content?.[field.key];
      return value === undefined || value === null || (typeof value === 'string' && !value.trim());
    })
    .map((field) => field.key);
}

// Command name → past-tense event type (DEC-38).
const PAST = {create: 'created', edit: 'edited', submit: 'submitted', forward: 'forwarded', return: 'returned', accept: 'accepted'};
export function eventTypeFor(command) {
  const [aggregate, verb] = command.split('.');
  const past = PAST[verb] ?? (verb.endsWith('e') ? verb + 'd' : verb + 'ed');
  return `${aggregate}.${past}`;
}

export function validateCommand(c) {
  if (!isPlainObject(c)) throw domainError('INVALID_COMMAND', 'The command must be a JSON object.');
  for (const field of ['commandId', 'deviceId', 'aggregateId', 'governingReleaseId']) {
    if (typeof c[field] !== 'string' || !UUID.test(c[field])) throw domainError('INVALID_COMMAND', `${field} must be a UUID.`);
  }
  if (typeof c.operationType !== 'string' || !COMMAND_NAME.test(c.operationType)) throw domainError('INVALID_COMMAND', 'operationType must look like "artifact.submit".');
  if (!Number.isInteger(c.expectedAggregateVersion) || c.expectedAggregateVersion < 0) throw domainError('INVALID_COMMAND', 'expectedAggregateVersion must be a non-negative integer.');
  if (c.activeSessionRoleId !== undefined && (typeof c.activeSessionRoleId !== 'string' || !c.activeSessionRoleId)) throw domainError('INVALID_COMMAND', 'activeSessionRoleId must be a non-empty string when present.');
  if (c.payload !== undefined && !isPlainObject(c.payload)) throw domainError('INVALID_COMMAND', 'payload must be a JSON object when present.');
  return c;
}

// Session lifecycle subset used by the slice (05 §2).
const SESSION_TRANSITIONS = {
  created: {active: 'session.started'},
  active: {paused: 'session.paused', completed: 'session.completed'},
  paused: {active: 'session.resumed', completed: 'session.completed'}
};
export function sessionTransition(from, to) {
  const eventType = SESSION_TRANSITIONS[from]?.[to];
  if (!eventType) throw domainError('INVALID_TRANSITION', `A session cannot move from "${from}" to "${to}".`);
  return eventType;
}

// HTTP status for a recorded Command outcome (09 §4 and §8.1).
const REJECTION_HTTP = {
  PERMISSION_DENIED: 403,
  TARGET_NOT_FOUND: 404,
  TARGET_EXISTS: 409,
  INVALID_TRANSITION: 409,
  SESSION_NOT_ACTIVE: 409,
  STALE_AGGREGATE_VERSION: 409,
  INCOMPATIBLE_RELEASE: 409,
  VALIDATION_FAILED: 422
};
export function httpStatusFor(status, code) {
  if (status === 'accepted') return 200;
  if (status === 'received') return 202;
  if (status === 'needs_reconciliation') return 409;
  return REJECTION_HTTP[code] ?? 409;
}
