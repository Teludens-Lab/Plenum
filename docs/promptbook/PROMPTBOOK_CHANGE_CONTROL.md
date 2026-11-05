# Promptbook change control

## Single-source rule

`tasks.json` is the task source of truth; `task.schema.json` defines its shape; `scripts/render-promptbook.mjs` owns generated prompt files, traceability, and dependency graph. Do not hand-edit generated files. Corpus documents remain authoritative for product, terminology, contracts, decisions, and roadmap gates. `PRODUCT_COMPLETENESS_MATRIX.md` is the acceptance ledger for P07-P11, and `references/teludens-design-system-catalog/` is the binding visual/interaction/branding source for all Plenum UI, including Fractured Order.

## Regeneration workflow

1. Inventory corpus versions against its README and update `SOURCE_REGISTER.md`.
2. Record contradictions in `CONFLICT_REGISTER.md`; never resolve them by silently choosing text.
3. Update decision pointers, project state, command registry, matrices, and affected task metadata.
4. Preserve existing task IDs when intent is continuous. Add a new task only for a distinct vertical outcome.
5. Run `node scripts/render-promptbook.mjs`.
6. Run `node scripts/validate-promptbook.mjs` and resolve all failures.
7. Review generated diffs for scope, requirement coverage, dependencies, commands, commit contracts, and status honesty.
8. Record the regeneration date and source-version delta in the validation report or change log.
9. For any user-facing task, verify that Teludens source references, the approved primary Plenum wordmark and theme-safe presentation contract, route/state/viewport evidence and the task's human user-test script remain present.

## Supersession policy

- A changed task keeps its ID when the user outcome and ownership remain recognizable.
- Split an overlarge task by retaining the original as the first coherent slice and assigning new monotonic IDs to added slices.
- Retire rather than delete an executed task; keep its evidence link and point to its superseding task.
- Never recycle an ID, slug, migration ID, event name, or command ID for a different meaning.
- Generated prompt filenames follow task ID and slug. Rename only through metadata plus regeneration.

## Decision Register updates

- When a DEC changes from Assumed to Confirmed, update `DECISION_INDEX.md`, remove only the corresponding `depends_on_unratified` labels, and reassess acceptance/tests.
- When an OPEN item resolves, cite the resolution and affected contract; update gates and tasks without copying decision text into the promptbook.
- When an ADR is approved or rejected, update `TECHNOLOGY_DECISION_MATRIX.md`, topology/commands/tasks, and delete superseded candidate instructions.
- New contradictions become candidate OPEN entries in `CONFLICT_REGISTER.md`; only the Decision Register owner can assign authoritative decision status.

## Compatibility and migration impact

Any requirement, contract, schema, package, Plugin, client, deployment-profile, or persisted-Session change must update `REQUIREMENT_CHANGE_IMPACT.md`, `CONTRACT_COMPATIBILITY_MATRIX.md`, and `DATA_MIGRATION_REGISTER.md` as applicable. Preserve old/new compatibility during expand/backfill/switch/contract and name the rollback or forward-fix path.

## Review gate

A regenerated promptbook is acceptable only when validation reports zero orphan requirements, missing links, duplicate IDs/slugs/migrations, dependency cycles, invalid states, unknown command references, or sample-task rubric failures. This validates the promptbook structure; it does not validate application behavior.
