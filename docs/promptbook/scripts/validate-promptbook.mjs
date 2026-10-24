import {readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isInteger(nodeMajor) || nodeMajor < 24) {
  console.error(`BLOCKED: promptbook validation requires Node 24 or newer; found ${process.versions.node}.`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tasks = JSON.parse(await readFile(join(root, 'tasks.json'), 'utf8'));
const schema = JSON.parse(await readFile(join(root, 'task.schema.json'), 'utf8'));
const failures = [];
const warnings = [];
const taskSchema = schema.$defs.task;
const requiredFields = taskSchema.required;
const taskIds = new Set();
const slugs = new Set();
const migrationIds = new Set();
const phaseNumber = (phase) => Number(phase.slice(1));

function resolveRef(ref) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported schema reference: ${ref}`);
  return ref.slice(2).split('/').reduce((value, key) => value[key], schema);
}

function validateAgainstSchema(value, rule, path) {
  if (rule.$ref) return validateAgainstSchema(value, resolveRef(rule.$ref), path);
  if (rule.enum && !rule.enum.includes(value)) failures.push(`${path} is not one of: ${rule.enum.join(', ')}`);
  if (rule.type === 'array') {
    if (!Array.isArray(value)) { failures.push(`${path} must be an array`); return; }
    if (rule.minItems && value.length < rule.minItems) failures.push(`${path} must contain at least ${rule.minItems} item(s)`);
    if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) failures.push(`${path} contains duplicate items`);
    if (rule.items) value.forEach((item, index) => validateAgainstSchema(item, rule.items, `${path}[${index}]`));
    return;
  }
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { failures.push(`${path} must be an object`); return; }
    for (const field of rule.required ?? []) if (!(field in value)) failures.push(`${path} missing ${field}`);
    if (rule.additionalProperties === false) {
      for (const field of Object.keys(value)) if (!(field in rule.properties)) failures.push(`${path} has unknown field ${field}`);
    }
    for (const [field, fieldRule] of Object.entries(rule.properties ?? {})) {
      if (field in value) validateAgainstSchema(value[field], fieldRule, `${path}.${field}`);
    }
    return;
  }
  if (rule.type === 'string') {
    if (typeof value !== 'string') { failures.push(`${path} must be a string`); return; }
    if (rule.minLength && value.length < rule.minLength) failures.push(`${path} is shorter than ${rule.minLength}`);
    if (rule.maxLength && value.length > rule.maxLength) failures.push(`${path} is longer than ${rule.maxLength}`);
    if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) failures.push(`${path} does not match ${rule.pattern}`);
    return;
  }
  if (rule.type === 'boolean' && typeof value !== 'boolean') failures.push(`${path} must be a boolean`);
}

validateAgainstSchema(tasks, schema, 'tasks');

for (const task of tasks) {
  for (const field of requiredFields) if (!(field in task)) failures.push(`${task.id ?? '?'} missing ${field}`);
  if (!/^PS-\d{3}$/.test(task.id)) failures.push(`Invalid task id ${task.id}`);
  if (taskIds.has(task.id)) failures.push(`Duplicate task id ${task.id}`);
  taskIds.add(task.id);
  if (slugs.has(task.slug)) failures.push(`Duplicate slug ${task.slug}`);
  slugs.add(task.slug);
  if (task.commit_subject.length > 72) failures.push(`${task.id} commit subject exceeds 72 characters`);
  if (!task.test_ids.length) failures.push(`${task.id} has no test IDs`);
  if (!task.validation_command_refs.length) failures.push(`${task.id} has no command references`);
  if (!task.authorization_privacy.length) failures.push(`${task.id} has no authorization/privacy guidance`);
  if (!task.acceptance_criteria.length) failures.push(`${task.id} has no acceptance criteria`);
  for (const migration of task.migration_ids) {
    if (migrationIds.has(migration)) failures.push(`Duplicate migration id ${migration}`);
    migrationIds.add(migration);
  }
}

for (const task of tasks) {
  for (const prerequisite of task.prerequisites) {
    if (!taskIds.has(prerequisite)) failures.push(`${task.id} references missing prerequisite ${prerequisite}`);
    const owner = tasks.find((candidate) => candidate.id === prerequisite);
    if (owner && phaseNumber(owner.phase) > phaseNumber(task.phase)) failures.push(`${task.id} depends on later-phase ${prerequisite}`);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(id, trail = []) {
  if (visiting.has(id)) { failures.push(`Dependency cycle: ${[...trail, id].join(' -> ')}`); return; }
  if (visited.has(id)) return;
  visiting.add(id);
  const task = tasks.find((candidate) => candidate.id === id);
  for (const dependency of task?.prerequisites ?? []) visit(dependency, [...trail, id]);
  visiting.delete(id);
  visited.add(id);
}
for (const task of tasks) visit(task.id);

const expectedReqs = Array.from({length: 94}, (_, index) => `REQ-${String(index + 1).padStart(3, '0')}`);
const expectedInvs = Array.from({length: 28}, (_, index) => `INV-${String(index + 1).padStart(3, '0')}`);
const covered = new Set(tasks.flatMap((task) => task.product_requirements));
for (const id of [...expectedReqs, ...expectedInvs]) if (!covered.has(id)) failures.push(`Orphaned requirement ${id}`);

const commandRegistry = await readFile(join(root, 'COMMAND_REGISTRY.md'), 'utf8');
for (const ref of new Set(tasks.flatMap((task) => task.validation_command_refs))) {
  if (!commandRegistry.includes(`\`${ref}\``)) failures.push(`Command reference ${ref} missing from COMMAND_REGISTRY.md`);
}

const headings = [
  '## ID / title / goal / user outcome / risk', '## Requirements and invariants', '## Prerequisites',
  '## Inspect before editing', '## Allowed scope and files', '## Implementation', '## Authorization/privacy',
  '## Concurrency/idempotency/versions', '## Non-goals and explicitly prohibited side effects', '## Acceptance',
  '## Tests', '## Validation commands', '## Regression and quality gates', '## Docs and continuity', '## Commit', '## Handoff'
];
for (const task of tasks) {
  const path = join(root, 'prompts', task.phase, `${task.id}-${task.slug}.md`);
  try {
    const prompt = await readFile(path, 'utf8');
    let last = -1;
    for (const heading of headings) {
      const index = prompt.indexOf(heading);
      if (index < 0) failures.push(`${task.id} prompt missing ${heading}`);
      if (index >= 0 && index < last) failures.push(`${task.id} prompt headings out of order at ${heading}`);
      last = Math.max(last, index);
    }
    if (!prompt.includes('docs/corpus/')) failures.push(`${task.id} prompt has no exact corpus source path`);
    if (!prompt.includes('Run every Node/npm command with Node 24 or newer.')) failures.push(`${task.id} prompt is missing the Node 24 runtime rule`);
    if (prompt.includes('unresolved source alias')) failures.push(`${task.id} prompt contains an unresolved source alias`);
  } catch {
    failures.push(`${task.id} prompt file missing`);
  }
}

const samples = ['PS-100', 'PS-001', 'PS-310', 'PS-410', 'PS-500', 'PS-230', 'PS-240', 'PS-250', 'PS-530'];
const sampleRows = [];
for (const id of samples) {
  const task = tasks.find((candidate) => candidate.id === id);
  const checks = {
    dependencies: task && task.prerequisites.every((dependency) => taskIds.has(dependency)),
    commands: task && task.validation_command_refs.length > 0,
    negative: task && task.authorization_privacy.length > 0,
    evidence: task && task.test_ids.length > 0 && task.acceptance_criteria.length > 0,
    commit: task && task.commit_body.includes('Verification:'),
    handoff: task && task.docs_continuity.some((item) => item.includes('PROJECT_STATE'))
  };
  const pass = Object.values(checks).every(Boolean);
  if (!pass) failures.push(`${id} representative sample failed: ${JSON.stringify(checks)}`);
  sampleRows.push(`| ${id} | ${pass ? 'PASS' : 'FAIL'} | ${Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name).join(', ') || 'Dependencies, command gate, negative test, evidence, commit, and handoff present'} |`);
}

const ready = tasks.filter((task) => task.ready_to_execute).map((task) => task.id);
const expectedReady = ['PS-545'];
if (ready.length !== expectedReady.length || ready.some((id, index) => id !== expectedReady[index])) {
  warnings.push(`Expected the recorded runnable tasks ${expectedReady.join(', ')}; found ${ready.join(', ') || 'none'}`);
}

const status = failures.length ? 'FAIL' : 'PASS';
const report = `# Promptbook validation report

Generated by \`node scripts/validate-promptbook.mjs\` at ${new Date().toISOString()} using Node ${process.versions.node}.

## Result

- Overall: **${status}**
- Tasks: ${tasks.length}
- Prompt files checked: ${tasks.length}
- JSON Schema validation: ${failures.some((item) => item.startsWith('tasks')) ? 'FAIL' : 'PASS'}
- REQ coverage: ${expectedReqs.filter((id) => covered.has(id)).length}/94
- INV coverage: ${expectedInvs.filter((id) => covered.has(id)).length}/28
- Dependency cycles: ${failures.some((item) => item.startsWith('Dependency cycle')) ? 'found' : 'none'}
- Unique migration IDs: ${migrationIds.size}
- First eligible tasks: ${ready.length ? ready.map((id) => `\`${id}\``).join(', ') : 'none'}

## Representative sample QA

| Sample task | Result | Evidence contract check |
|---|---|---|
${sampleRows.join('\n')}

## Failures

${failures.length ? failures.map((failure) => `- ${failure}`).join('\n') : '- None.'}

## Warnings

${warnings.length ? warnings.map((warning) => `- ${warning}`).join('\n') : '- None.'}

This validates promptbook structure and traceability. It does not validate future application implementations or close human approval gates.
`;
await writeFile(join(root, 'PROMPTBOOK_VALIDATION_REPORT.md'), report, 'utf8');

if (failures.length) {
  console.error(`FAIL ${failures.length} validation issue(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`PASS ${tasks.length} tasks; REQ 94/94; INV 28/28; no dependency cycles.`);
