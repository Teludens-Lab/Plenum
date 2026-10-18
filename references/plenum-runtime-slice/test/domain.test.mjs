import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {
  canonicalize, sha, validateDefinition, validateCommand, resolveTransition, visibilityAfter,
  missingRequiredFields, eventTypeFor, sessionTransition, httpStatusFor, workflowFor, findArtifactType, formFor
} from '../src/domain.mjs';

const reference = JSON.parse(await readFile(new URL('../definitions/fractured-order-reference.json', import.meta.url), 'utf8'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const workflow = workflowFor(reference, findArtifactType(reference, 'request'));

test('reference definition is valid', () => {
  assert.deepEqual(validateDefinition(reference), {valid: true, errors: []});
});

test('digest ignores key order', () => {
  assert.equal(canonicalize({b: 1, a: {d: 2, c: [3, {f: 4, e: 5}]}}), '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}');
  assert.equal(sha({x: 1, y: 2}), sha({y: 2, x: 1}));
  assert.notEqual(sha({x: 1}), sha({x: 2}));
});

test('validation reports undefined roles, unreachable states, missing exits and missing terminal state', () => {
  const broken = clone(reference);
  broken.workflows[0].transitions.push({id: 'tx', from: 'draft', command: 'artifact.archive', to: 'draft', allowedSessionRoleIds: ['observer']});
  broken.workflows[0].states.push({key: 'orphan', label: 'Orphan', kind: 'review'});
  const result = validateDefinition(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('"observer", which is not defined')));
  assert.ok(result.errors.some((e) => e.includes('"orphan" can never be reached')));
  assert.ok(result.errors.some((e) => e.includes('"orphan" has no way out')));

  const noTerminal = clone(reference);
  noTerminal.workflows[0].states = noTerminal.workflows[0].states.filter((s) => s.kind !== 'terminal');
  assert.ok(validateDefinition(noTerminal).errors.some((e) => e.includes('no terminal state')));
});

test('validation reports missing forms, workflows and roles', () => {
  assert.equal(validateDefinition({}).valid, false);
  const broken = clone(reference);
  broken.artifactTypes[0].formId = 'missing-form';
  assert.ok(validateDefinition(broken).errors.some((e) => e.includes('form "missing-form"')));
});

test('DEC-42 happy path and return paths come from configuration', () => {
  assert.equal(resolveTransition(workflow, null, 'artifact.create', 'scribe').to, 'draft');
  assert.equal(resolveTransition(workflow, 'draft', 'artifact.submit', 'scribe').to, 'submitted');
  assert.equal(resolveTransition(workflow, 'submitted', 'artifact.forward', 'facilitator').to, 'in_review');
  assert.equal(resolveTransition(workflow, 'submitted', 'artifact.return', 'facilitator').to, 'returned');
  assert.equal(resolveTransition(workflow, 'in_review', 'artifact.accept', 'white_cell').to, 'accepted');
  const whiteCellReturn = resolveTransition(workflow, 'in_review', 'artifact.return', 'white_cell');
  assert.equal(whiteCellReturn.to, 'returned');
  assert.equal(whiteCellReturn.notifyCreator, true);
  assert.deepEqual(whiteCellReturn.notifySessionRoleIds, ['facilitator']);
  assert.equal(resolveTransition(workflow, 'returned', 'artifact.submit', 'scribe').to, 'submitted');
});

test('DEC-42 forbidden paths', () => {
  assert.throws(() => resolveTransition(workflow, 'submitted', 'artifact.edit', 'scribe'), {code: 'INVALID_TRANSITION'}); // no withdrawal
  assert.throws(() => resolveTransition(workflow, 'in_review', 'artifact.return', 'facilitator'), {code: 'PERMISSION_DENIED'});
  assert.throws(() => resolveTransition(workflow, 'submitted', 'artifact.accept', 'white_cell'), {code: 'INVALID_TRANSITION'}); // cannot skip facilitator
  assert.throws(() => resolveTransition(workflow, 'accepted', 'artifact.accept', 'white_cell'), {code: 'INVALID_TRANSITION'});
  assert.throws(() => resolveTransition(workflow, null, 'artifact.create', 'facilitator'), {code: 'PERMISSION_DENIED'});
});

test('a different release changes behaviour without code changes', () => {
  const variant = clone(reference);
  variant.sessionRoles.push({id: 'analyst', name: 'Analyst'});
  variant.workflows[0].transitions.find((t) => t.id === 't6').allowedSessionRoleIds = ['analyst'];
  assert.equal(validateDefinition(variant).valid, true);
  const wf = workflowFor(variant, findArtifactType(variant, 'request'));
  assert.equal(resolveTransition(wf, 'in_review', 'artifact.accept', 'analyst').to, 'accepted');
  assert.throws(() => resolveTransition(wf, 'in_review', 'artifact.accept', 'white_cell'), {code: 'PERMISSION_DENIED'});
});

test('visibility grows with holders and notified roles only', () => {
  const create = resolveTransition(workflow, null, 'artifact.create', 'scribe');
  const afterCreate = visibilityAfter([], workflow, create);
  assert.deepEqual(afterCreate, []);
  const afterSubmit = visibilityAfter(afterCreate, workflow, resolveTransition(workflow, 'draft', 'artifact.submit', 'scribe'));
  assert.deepEqual(afterSubmit, ['facilitator']);
  const afterForward = visibilityAfter(afterSubmit, workflow, resolveTransition(workflow, 'submitted', 'artifact.forward', 'facilitator'));
  assert.deepEqual(afterForward, ['facilitator', 'white_cell']);
});

test('required form fields are enforced', () => {
  const form = formFor(reference, findArtifactType(reference, 'request'));
  assert.deepEqual(missingRequiredFields(form, {}), ['summary']);
  assert.deepEqual(missingRequiredFields(form, {summary: '   '}), ['summary']);
  assert.deepEqual(missingRequiredFields(form, {summary: 'Ready'}), []);
});

test('event names are past tense', () => {
  assert.equal(eventTypeFor('artifact.submit'), 'artifact.submitted');
  assert.equal(eventTypeFor('artifact.forward'), 'artifact.forwarded');
  assert.equal(eventTypeFor('artifact.return'), 'artifact.returned');
  assert.equal(eventTypeFor('artifact.create'), 'artifact.created');
});

test('command envelope validation', () => {
  const ok = {commandId: '1b4e28ba-2fa1-41d2-883f-0016d3cca427', deviceId: '1b4e28ba-2fa1-41d2-883f-0016d3cca428', operationType: 'artifact.submit', aggregateId: '1b4e28ba-2fa1-41d2-883f-0016d3cca429', governingReleaseId: '1b4e28ba-2fa1-41d2-883f-0016d3cca42a', expectedAggregateVersion: 1};
  assert.equal(validateCommand(ok), ok);
  assert.throws(() => validateCommand({...ok, expectedAggregateVersion: undefined}), {code: 'INVALID_COMMAND'});
  assert.throws(() => validateCommand({...ok, commandId: 'x'}), {code: 'INVALID_COMMAND'});
  assert.throws(() => validateCommand({...ok, operationType: 'submit'}), {code: 'INVALID_COMMAND'});
  assert.throws(() => validateCommand({...ok, payload: []}), {code: 'INVALID_COMMAND'});
});

test('session lifecycle and HTTP mapping', () => {
  assert.equal(sessionTransition('created', 'active'), 'session.started');
  assert.equal(sessionTransition('active', 'paused'), 'session.paused');
  assert.throws(() => sessionTransition('completed', 'active'), {code: 'INVALID_TRANSITION'});
  assert.equal(httpStatusFor('accepted', null), 200);
  assert.equal(httpStatusFor('rejected', 'PERMISSION_DENIED'), 403);
  assert.equal(httpStatusFor('rejected', 'VALIDATION_FAILED'), 422);
  assert.equal(httpStatusFor('needs_reconciliation', 'STALE_AGGREGATE_VERSION'), 409);
});
