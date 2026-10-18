# Plenum

Plenum is being developed as a configuration-driven simulation platform. This repository contains the governing product corpus, generated development promptbook, immutable and executable reference material, shared TypeScript contracts, and the standards that apply to application code.

PS-100 established the minimum npm workspace: shared event and simulation contracts, a trusted server boundary, and a contract-only Runtime frontend consumer. It does not yet provide an HTTP server, database integration, or rendered UI.

## Repository authorities

| Area | Path | Role |
|---|---|---|
| Product corpus | `docs/corpus/` | Governing requirements, decisions, terminology, architecture, contracts, and roadmap. The Decision Register controls decision status. |
| Development promptbook | `docs/promptbook/` | Dependency-ordered implementation tasks and generated execution prompts. It schedules work but does not override the corpus or prove implementation. |
| References | `references/` | Read-only comparison material and executable spikes. The Fractured Order manifest identifies the official golden snapshot. Reference code is not production application code. |
| Application code | `apps/`, `packages/`, `definitions/`, `tests/`, `deploy/` | Incremental implementation owned by the applicable promptbook tasks; absent paths remain uncreated until needed. |

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

These commands validate the planning artifact only. The application commands established by PS-100 are listed below.

## Platform checks

With Node 24 or newer:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

All production workspaces install from the root `package-lock.json`. The retained reference slice is intentionally outside the workspace and keeps its historical lockfile.

## Change boundaries

- Treat `references/fractured-order/` as immutable. Replace it only through a newly approved pinned snapshot process.
- Update canonical promptbook sources before regenerating derived prompts.
- Do not use files under `docs/corpus/archive/` as current authority.
- Do not commit secrets, dependencies, generated build output, coverage, caches, or local test artifacts.
