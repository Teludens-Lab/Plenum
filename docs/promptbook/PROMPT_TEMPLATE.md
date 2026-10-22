# Codex task prompt template

`scripts/render-promptbook.mjs` is the canonical renderer. Every task prompt is generated from one object in `tasks.json`; edit task metadata and regenerate instead of hand-editing generated prompts.

## Required section order

1. `ID / title / goal / user outcome / risk`
2. `Requirements and invariants`
3. `Prerequisites`
4. `Inspect before editing`
5. `Allowed scope and files`
6. `Implementation`
7. `Authorization/privacy`
8. `Concurrency/idempotency/versions`
9. `Non-goals and explicitly prohibited side effects`
10. `Acceptance`
11. `Tests`
12. `Validation commands`
13. `Regression and quality gates`
14. `Docs and continuity`
15. `Commit`
16. `Handoff`

## Metadata contract

Populate every field required by `task.schema.json`. In particular:

- Cite existing `REQ-*`, `INV-*`, `AC-*`, `DEC-*`, `ADR-*`, `OPEN-*`, and corpus section anchors. Never mint replacement requirement IDs.
- Separate programmatic `prerequisites` from `depends_on_unratified`. An open decision or proposed ADR is a label and approval gate, not a dependency edge.
- Set `prerequisites_verified` and `ready_to_execute` from observed evidence. A future command or acceptance condition is not current evidence.
- Use exact observed paths only. For a future path, instruct Codex to discover the established location first.
- Reference commands by IDs in `COMMAND_REGISTRY.md`. A Proposed command becomes executable only after its creating task passes and the registry is updated from evidence.
- Give each task a unique slug and each persistent change a unique migration identifier.

## Mandatory engineering clauses

Each generated prompt must preserve these rules:

- Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight; select a verified Node 24+ runtime when the system default is older, and treat older-runtime results as diagnostic only.
- Start from Roadmap section 16: read requirement rows, the smallest governing sections, Glossary terms, relevant contracts, and tests.
- Inspect the working tree before edits and preserve unrelated user changes.
- Use trusted server context for Principal, Organization, Session, Seat Assignment, Active Role Context, and Authority Epoch.
- Enforce tenant isolation and Session authorization separately. Omit unauthorized data server-side.
- Use server-authoritative UTC time; device time is observational.
- Use UUID identifiers, camelCase JSON, snake_case SQL, DEC-38 command/event naming, canonical enums, and the 09 error envelope.
- Make state mutation, Command Receipt, Evidence Event, and transactional-outbox write atomic.
- Pin Governing Release and applicable schema, contract, adapter, and Plugin versions.
- Preserve idempotent replay and use expand -> backfill -> switch -> contract for schema evolution.
- Cover valid, unauthorized, disconnected, stale, retry, and partial-failure behavior when applicable.
- Ban unrelated refactors, broad upgrades, destructive production actions, `git add .`, force push, destructive reset, invented commands, and completion claims after failed gates.

## Commit and PR contract

Provide a proposed branch, Conventional Commit subject no longer than 72 characters where feasible, detailed body, expected files/migrations/contracts, and a PR description containing Summary, Risks, Migration, Evidence, and Rollback. Do not actually commit unless the user or repository workflow authorizes it.

## Handoff contract

Report each command as PASS / FAIL / BLOCKED / NOT RUN, with command-output or artifact references, changed files, demonstrated behavior, migration and rollback implications, unratified dependencies, remaining defects, and the next eligible task.
