# Codex execution standard

## Governing bootstrap

Roadmap section 16 applies first: anyone changing code reads the requirement rows, the smallest governing sections, Glossary terms, relevant contracts, and tests. Do not invent requirements, terms, metrics, transitions, permissions, paths, commands, or evidence. Route contradictions to the Decision Register through `CONFLICT_REGISTER.md`.

## Invocation

1. Select only a task whose prerequisites have PASS evidence and whose `ready_to_execute` state is current.
2. Paste the generated prompt from `prompts/P00`..`P06` into Codex from the implementation repository root.
3. Supply any required human inputs named under `depends_on_unratified`; do not silently promote Assumed/Proposed items.
4. Ask for implementation, verification, and handoff. A commit remains optional and requires explicit workflow authorization.

The first eligible prompts are PS-000 and PS-001. Prefer PS-000 next because it produces the parity inventory required by PS-200. PS-001 may run independently, but its preflight must stop before edits when Node 24+ or PostgreSQL 18 is unavailable.

Every prompt must run all Node/npm commands with Node 24 or newer. At preflight, record `node --version`; if the default runtime is older, select a verified Node 24+ runtime before validation. Results produced on an older Node version are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark the affected commands BLOCKED and do not claim completion.

## Context bootstrap

Before editing:

- Read `PROJECT_STATE.md`, the selected task, cited requirement/contract sections, and prerequisite handoffs.
- Run `git status --short`, identify the repository root, current branch/HEAD, runtime versions, package manager, and real scripts.
- Inspect entry points, callers, tests, migrations, fixtures, exports, configuration, and public contracts on the affected path.
- Confirm source paths and command-registry status. Discovery-gated paths must be resolved from the actual tree.
- Identify conflicting or overlapping user changes and pause before overwriting them.

## Working-tree safety

- Make the smallest complete vertical change and preserve unrelated work.
- Do not use `git add .`, force push, destructive reset, broad rename, unrelated dependency upgrade, or cleanup outside task scope.
- Never modify production data, secrets, auth/tenancy boundaries, paid services, or public contracts beyond the task's explicit approval gate.
- Use versioned, reversible migrations and rehearse expand -> backfill -> switch -> contract where data persists.
- Never expose credentials, personal data, secret-ballot linkage, or unauthorized projections in code, logs, tests, or evidence.

## Validation protocol

1. Run only Verified commands from `COMMAND_REGISTRY.md` or commands created and evidenced by the current task.
2. Record command ID, exact command, cwd, environment names (not secret values), tool versions, duration, exit code, and artifact path.
3. Map every acceptance criterion to objective evidence. Include applicable denial, boundary, disconnect, stale, retry, duplicate, and partial-failure cases.
4. Classify results PASS / FAIL / BLOCKED / NOT RUN. A failed required test prevents completion.
5. Update command status only after a clean-checkout reproduction on the declared supported stack.

## Commit and PR protocol

- Review the focused diff and enumerate exact files before staging.
- Use the prompt's branch and Conventional Commit proposal unless repository conventions supersede it.
- Commit body covers why, what, tests, migration, and risks. PR description covers Summary, Risks, Migration, Evidence, and Rollback.
- Do not commit failed completion gates or unrelated changes. If workflow permits a WIP commit, label it as WIP and do not report the task complete.
- Never push, open a PR, merge, tag, publish, or deploy without explicit authorization.

## Pause and escalation rules

Pause and ask for confirmation before destructive production operations, irreversible migrations, trust-boundary/auth/tenancy changes, sensitive disclosure, paid-service creation, or external API breakage. Mark BLOCKED when a required source, approved decision, secret-free fixture, supported runtime, or prerequisite evidence is unavailable. Complete independent safe checks before stopping.

## Handoff

Use `TASK_HANDOFF_TEMPLATE.md`. Include changed files, demonstrated behavior, acceptance/evidence mapping, exact command results, migration/recovery impact, known limitations, unratified dependencies, dirty-tree state, and next eligible task. Do not describe unverified code as production-ready.
