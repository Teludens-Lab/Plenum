# PS-150 verification

Date: 2026-10-18. Status: implementation evidence, not release approval.

## Environment

- Node.js 24.22.0 and npm 11.19.1, matching the repository runtime and package-manager pins.
- TypeScript 5.9.3, React 19.3.1, Vite 8.3.4, Playwright 1.64.1, and Chromium 156.0.8078.4.
- PostgreSQL 18.6 Alpine and SeaweedFS 4.48 in disposable local containers with synthetic data only.
- The workstation environment sets `NODE_TLS_REJECT_UNAUTHORIZED=0`; no remote service was exercised by the application tests, but that setting must not be used for production verification.

## Evidence

| Gate | Result | Demonstrated behavior |
|---|---|---|
| `npm run lint` | PASS, exit 0 | 22 application/package sources, ten versioned contracts, canonical naming and acyclic workspaces |
| `npm run typecheck` | PASS, exit 0 | Strict server, contract, React and browser-test types |
| `npm test` | PASS 9/9, exit 0 | Contract, policy, Release, sync and identity regressions |
| `npm run build` | PASS, exit 0 | Seven TypeScript workspaces and the production Runtime web bundle |
| `npm run test:integration` | PASS 8/8, exit 0 | Real PostgreSQL tenant/Command/Release/sync boundaries and real S3-compatible storage |
| `npm run test:e2e` | PASS 4/4, exit 0 | Configured DEC-42 workflow, forbidden paths, operator state, lost acknowledgement, stale version, loading, denial, offline and retry states |
| `npm run test:a11y` | PASS 1/1, exit 0 | Keyboard skip navigation, semantic Runtime form and automated axe scan |
| `node tests/parity/validate-reference-inventory.mjs` | PASS, exit 0 | Reference pin, inventory, evidence anchors and planned parity fixtures remain intact |
| `node scripts/validate-promptbook.mjs` | PASS, exit 0 | Promptbook structure, requirement coverage and dependency graph remain valid |

Required evidence IDs `AC-03`, `AC-04`, `AC-05`, `AC-06`, `AC-08`, `AC-10`, `AC-12`, and `AC-13` are exercised by `tests/e2e/runtime.spec.mjs`. The browser calls the real HTTP boundary and PostgreSQL-backed application code; only authentication is supplied by a test-only bearer-token adapter.

Browser evidence:

- `output/playwright/ps-150/runtime-desktop.png`
- `output/playwright/ps-150/runtime-390px.png`
- `output/playwright/ps-150/runtime-200-percent-text.png`
- `output/playwright/ps-150/operator-accepted.png`

The screenshots were inspected for desktop, 390-pixel responsive layout, 200% text scaling, long content and the authoritative operator view. No horizontal page overflow was observed. Reduced-motion behavior is encoded in the stylesheet; this workflow has no essential motion.

## Demonstrated behavior

- The React shell renders its modules, fields, actions, labels and workflow transitions from the frozen Release snapshot. Components do not branch on the Scribe, Facilitator or White Cell names.
- Server projections are derived from trusted Session Access Context and include only the active role's configured Interface Profile. Direct forbidden mutation and an unauthorized operator request are denied by the server.
- The configured artifact moves through draft, submitted, forwarded and accepted states. Each accepted mutation still uses the existing atomic Command Receipt, Evidence Event and outbox transaction.
- A lost response is recovered by looking up the original Command Receipt before replaying the same Command ID. A stale aggregate version remains visibly rejected until the client reloads authoritative state.
- Loading, empty, denied, offline and retry states are explicit. `local_pending` is never presented as a canonical accepted outcome.
- The operator projection is read-only and reflects authoritative Session, artifact, task and event state.

## Data, deployment and recovery

No migration was added. The HTTP boundary composes existing PostgreSQL and policy services; the web app is a static Vite build served beside the modular-monolith server. Rollback removes the new HTTP/UI composition and preserves existing data, Commands, Receipts, Evidence Events, outbox rows and the retained reference slice.

## Open governance and QA limits

- ADR-007 and ADR-008 remain Proposed in the source Decision Register; the project owner's instruction accepts their React/Node directions for this build. OPEN-001 remains unresolved.
- Automated axe, keyboard navigation, responsive screenshots and text scaling passed. Manual NVDA/JAWS/VoiceOver testing and an independent accessibility review were not run, so this is not release approval.
- Production OIDC composition, TLS/proxy behavior, sustained connections, load, deployment, backup/restore and Node 26 were not tested here. Their owning later tasks remain unchanged.
