import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tasks = JSON.parse(await readFile(join(root, 'tasks.json'), 'utf8'));

const list = (items) => items.map((item) => `- ${item}`).join('\n');
const yesNo = (value) => value ? 'true' : 'false';
const corpus = 'docs/corpus';
const referenceSlice = 'references/plenum-runtime-slice';
const sourcePaths = [
  [/^(PRD\b|PRD )/, `${corpus}/01_Product_and_PRD/01_PRD_v0.7.md`],
  [/^08 Canon\b/, `${corpus}/01_Product_and_PRD/08_SIMULATION_DESIGN_AND_RESEARCH_CANON_v1.0.md`],
  [/^02 Platform\b/, `${corpus}/02_Updated_Architecture/02_PLATFORM_ARCHITECTURE_v1.3.md`],
  [/^03 Schema\b/, `${corpus}/02_Updated_Architecture/03_CANONICAL_SIMULATION_SCHEMA_v1.3.md`],
  [/^04 Studio\b/, `${corpus}/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md`],
  [/^05 Runtime\b/, `${corpus}/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md`],
  [/^06 Data\b/, `${corpus}/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md`],
  [/^07 Roadmap\b/, `${corpus}/02_Updated_Architecture/07_IMPLEMENTATION_ROADMAP_v1.3.md`],
  [/^09 Contracts\b/, `${corpus}/02_Updated_Architecture/09_API_EVENT_WORKFLOW_CONTRACTS_v1.3.md`],
  [/^10 Extension\b/, `${corpus}/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md`],
  [/^11 Voting\b/, `${corpus}/02_Updated_Architecture/11_LIVE_POLLING_AND_VOTING_v1.1.md`],
  [/^12 Voice\b/, `${corpus}/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md`],
  [/^Data Model\b/, `${corpus}/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/POSTGRESQL_LOGICAL_DATA_MODEL_v1.1.md`],
  [/^Sync\b/, `${corpus}/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md`],
  [/^Reference slice\b/, `${referenceSlice}/README.md`],
  [/^(Decision Register|DEC-|ADR-|OPEN-)/, `${corpus}/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`],
  [/^VOTE-/, `${corpus}/02_Updated_Architecture/11_LIVE_POLLING_AND_VOTING_v1.1.md`],
  [/^VOICE-/, `${corpus}/02_Updated_Architecture/12_VOICE_AND_RADIO_v1.1.md`],
  [/^EXT-/, `${corpus}/02_Updated_Architecture/10_EXTENSION_FRAMEWORK_v1.1.md`],
  [/^SYNC-/, `${corpus}/Plenum_PostgreSQL_Data_Model_and_Synchronization_Protocol_v1.1/SYNCHRONIZATION_PROTOCOL_v1.1.md`]
];

function renderSourceRef(ref) {
  const match = sourcePaths.find(([pattern]) => pattern.test(ref));
  if (!match) return `${ref} — unresolved source alias; stop and resolve through SOURCE_REGISTER.md before editing`;
  const hasAnchor = /section|Phase|Slice|REQ-|DEC-|ADR-|OPEN-|VOTE-|VOICE-|EXT-|SYNC-|README/i.test(ref);
  return `\`${match[1]}\` — ${ref}${hasAnchor ? '' : ' (entire current document)'}`;
}

function renderPrompt(task) {
  const branchType = task.category.includes('verification') || task.category.includes('validation') || task.category.includes('assurance') ? 'fix' : 'feat';
  return `# ${task.id} - ${task.title}

## ID / title / goal / user outcome / risk

- ID: \`${task.id}\`
- Title: ${task.title}
- Goal: ${task.goal}
- User outcome: ${task.user_outcome}
- Risk: **${task.risk.toUpperCase()}**
- Metadata: \`source_evidence\` is populated; \`prerequisites_verified: ${yesNo(task.prerequisites_verified)}\`; \`ready_to_execute: ${yesNo(task.ready_to_execute)}\`.

## Requirements and invariants

Product IDs: ${task.product_requirements.map((id) => `\`${id}\``).join(', ')}.

Requirement-row authority: \`${corpus}/01_Product_and_PRD/01_PRD_v0.7.md\` — rows ${task.product_requirements.map((id) => `\`${id}\``).join(', ')}. Canonical terminology authority: \`${corpus}/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md\` — entries for every domain term used by this task.

Authoritative sources and sections:

${list(task.source_refs.map(renderSourceRef))}

Observed source evidence:

${list(task.source_evidence)}

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is \`${corpus}/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md\`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: ${task.depends_on_unratified.length ? task.depends_on_unratified.map((id) => `\`${id}\``).join(', ') : 'none'}.

## Prerequisites

Task prerequisites: ${task.prerequisites.length ? task.prerequisites.map((id) => `\`${id}\``).join(', ') : 'none'}.

Before editing, read Roadmap section 16, \`PROJECT_STATE.md\`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check \`git status --short\`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record \`node --version\` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

${list(task.inspect)}

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

${list(task.scope)}

Expected paths are discovery targets, not permission to invent absent structure:

${list(task.expected_paths)}

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

${list(task.implementation)}

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC \`timestamptz\`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's \`local_pending\` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

${list(task.authorization_privacy)}

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

${list(task.concurrency_idempotency_versions)}

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

${list(task.non_goals)}

Also prohibited: destructive production operations, production secret changes, paid service creation, \`git add .\`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

${list(task.acceptance_criteria.map((criterion) => `Given the documented preconditions, when the task behavior is exercised, then ${criterion.charAt(0).toLowerCase()}${criterion.slice(1)}`))}

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

${list(task.deliverables)}

## Tests

Required test/evidence IDs: ${task.test_ids.map((id) => `\`${id}\``).join(', ')}.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in \`COMMAND_REGISTRY.md\`: ${task.validation_command_refs.map((id) => `\`${id}\``).join(', ')}.

Run only commands whose registry status is **Verified**. For a **Proposed** command, first complete the named creating task; do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

${list(task.regression_quality_gates)}

The approval gate is: ${task.approval_gate}. A task may be implementation-complete without being release-approved.

## Docs and continuity

${list(task.docs_continuity)}

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to \`CONFLICT_REGISTER.md\` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: \`${branchType}/ps-${task.id.slice(3)}-${task.slug}\`
- Proposed subject: \`${task.commit_subject}\`
- Expected migrations: ${task.migration_ids.length ? task.migration_ids.map((id) => `\`${id}\``).join(', ') : 'none'}
- Expected API/contract IDs: ${task.api_contract_ids.length ? task.api_contract_ids.map((id) => `\`${id}\``).join(', ') : 'none'}

Proposed body:

\`\`\`text
${task.commit_body}
\`\`\`

Proposed PR description:

${task.pr_description}

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: ${task.revisit_triggers.join('; ')}.
`;
}

for (const task of tasks) {
  const dir = join(root, 'prompts', task.phase);
  await mkdir(dir, {recursive: true});
  await writeFile(join(dir, `${task.id}-${task.slug}.md`), renderPrompt(task), 'utf8');
}

const reqIds = Array.from({length: 94}, (_, index) => `REQ-${String(index + 1).padStart(3, '0')}`);
const invIds = Array.from({length: 28}, (_, index) => `INV-${String(index + 1).padStart(3, '0')}`);
const mappings = [...reqIds, ...invIds].map((id) => {
  const owners = tasks.filter((task) => task.product_requirements.includes(id));
  const tests = [...new Set(owners.flatMap((task) => task.test_ids))];
  const commands = [...new Set(owners.flatMap((task) => task.validation_command_refs))];
  return `| ${id} | ${owners.map((task) => `[${task.id}](prompts/${task.phase}/${task.id}-${task.slug}.md)`).join(', ')} | ${tests.map((test) => `\`${test}\``).join(', ')} | ${commands.map((command) => `\`${command}\``).join(', ')} |`;
});

await writeFile(join(root, 'REQUIREMENTS_TRACEABILITY.md'), `# Requirements traceability

Generated from \`tasks.json\`. Requirement text remains authoritative in PRD v0.7.3; this file maps IDs only.

| ID | Implementation prompts | Executable evidence IDs | Command references |
|---|---|---|---|
${mappings.join('\n')}

Coverage target: REQ-001 through REQ-094 and INV-001 through INV-028. The validator fails on any orphan.
`, 'utf8');

const edges = tasks.flatMap((task) => task.prerequisites.map((prerequisite) => `  ${prerequisite.replace('-', '_')} --> ${task.id.replace('-', '_')}`));
const rows = tasks.map((task) => `| ${task.id} | ${task.phase} | ${task.prerequisites.join(', ') || '-'} | ${task.depends_on_unratified.join(', ') || '-'} | ${task.ready_to_execute ? 'Yes' : 'No'} |`);
await writeFile(join(root, 'DEPENDENCY_GRAPH.md'), `# Dependency graph

Programmatic prerequisites are acyclic. Human approvals are labels and milestone gates, not graph edges.

\`\`\`mermaid
graph TD
${edges.join('\n')}
\`\`\`

| Task | Phase | Programmatic prerequisites | Unratified / open dependencies | Ready now |
|---|---|---|---|---|
${rows.join('\n')}
`, 'utf8');

console.log(`Rendered ${tasks.length} prompts, traceability, and dependency graph.`);
