# Plenum

Plenum is being developed as a configuration-driven simulation platform. This repository currently contains the governing product corpus, the generated development promptbook, immutable and executable reference material, and the standards that apply to future application code.

Application scaffolding has not started. `apps/`, `packages/`, `definitions/`, `tests/`, and `deploy/` will be introduced by the implementation tasks that need them, beginning with PS-100.

## Repository authorities

| Area | Path | Role |
|---|---|---|
| Product corpus | `docs/corpus/` | Governing requirements, decisions, terminology, architecture, contracts, and roadmap. The Decision Register controls decision status. |
| Development promptbook | `docs/promptbook/` | Dependency-ordered implementation tasks and generated execution prompts. It schedules work but does not override the corpus or prove implementation. |
| References | `references/` | Read-only comparison material and executable spikes. The Fractured Order manifest identifies the official golden snapshot. Reference code is not production application code. |
| Application code | `apps/`, `packages/`, `definitions/`, `tests/`, `deploy/` | Future implementation owned by the applicable promptbook tasks. These paths are intentionally absent until needed. |

Engineering and QA instructions are in `AGENTS.md` and `rules/`.

## Current reference material

- `references/fractured-order/`: immutable official Fractured Order golden reference pinned by `references/fractured-order.snapshot.json`.
- `references/plenum-runtime-slice/`: executable Plenum v0.2.0 spike used as an observed implementation baseline.
- `references/teludens-design-system-catalog/`: supporting design-system catalog. It does not override the product corpus.

## Promptbook checks

From `docs/promptbook/`:

```powershell
node scripts/render-promptbook.mjs
node scripts/validate-promptbook.mjs
```

These commands validate the planning artifact only. Application build and test commands will be established by PS-100.

## Change boundaries

- Treat `references/fractured-order/` as immutable. Replace it only through a newly approved pinned snapshot process.
- Update canonical promptbook sources before regenerating derived prompts.
- Do not use files under `docs/corpus/archive/` as current authority.
- Do not commit secrets, dependencies, generated build output, coverage, caches, or local test artifacts.
