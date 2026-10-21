# PS-330 Plugin catalog and Model Composition editor verification

Date: 2026-10-20.

## Outcome

PS-330 is implementation-complete for its bounded first-proof scope. Studio now lists only approved, enabled Plugin installations from the current Organization; captures digest-pinned, non-secret bindings; and builds typed acyclic Model Compositions with model, allowlisted transform, fan-out, join, approval-gate, and output nodes.

The Release compiler validates port type, unit and classification compatibility; rejects cycles, illegal fan-in, missing inputs, and Effect Proposal paths without approval; computes a canonical graph digest; and freezes the transitive Plugin dependency closure. Synthetic fixture previews route sequential and parallel graphs without executing Plugin code or changing Session state.

Script nodes, feedback cycles, arbitrary code authoring, and public marketplace behavior remain unavailable.

## Contracts and controls

- `plugin-binding-v1` identifies new catalog-backed bindings; Publication rechecks the exact Organization installation, Artifact digest, Artifact approval, Publisher approval, and enabled status in the publication transaction.
- `composition-definition-v1` identifies typed graphs and their stable node/edge IDs, fixtures, compiled graph digest, and pinned dependency closure.
- Catalog reads are Organization-scoped and require Admin, Designer, or Publisher authority. Operator and cross-Organization access fail closed.
- Draft configuration rejects secret-like keys and Release compilation independently rejects secrets, secret references, participant data, and credentials.
- `external_required` bindings cannot target `air_gapped` without an enabled offline-capable local replacement.
- Fixture preview uses declared synthetic outputs only and always returns `stateChanges: []`.

## Acceptance evidence

| Reference | Result | Evidence |
|---|---|---|
| `EXT-12` | PASS | Unit and Chromium journeys build a sequential two-model graph, compute a graph digest and dependency closure, and preview with zero state changes. |
| `EXT-13` | PASS | Unit fixture covers deterministic parallel fan-out and an explicit partial join when one branch fails. |
| `EXT-14` | PASS | Unit cases reject a cycle, unit mismatch, classification leak, and Effect Proposal path without approval; Studio filters incompatible/cyclic edges and links validation to the composition. |
| `EXT-15` | PASS | Unit proof shows compiled graph/dependency pins remain unchanged after later Draft and binding mutations. |

## Verification

Commands ran from the repository root using Node 24.22.0 where required, PostgreSQL 18 in an isolated disposable database, and local Playwright Chromium.

| Registry ID / command | Result | Evidence |
|---|---|---|
| `CMD-PLATFORM-TYPECHECK` / `npm run typecheck` | PASS | No TypeScript diagnostics in the pinned Node 24 container. |
| `CMD-PLATFORM-BUILD` / `npm run build` | PASS | Server/packages and both web bundles built. The existing 532.95 kB Runtime chunk warning remains. |
| `CMD-PLATFORM-LINT` / `npm run lint` | PASS | 47 sources, 26 versioned contracts, canonical naming, acyclic workspaces. |
| `CMD-PLATFORM-TEST` / `npm test` | PASS | 72/72, including `EXT-12` through `EXT-15`. |
| `CMD-PLATFORM-DB` / `npm run test:db` | PASS | 14/14 on PostgreSQL 18, including approved catalog visibility plus Operator and cross-Organization denial. |
| Targeted Chromium / `npx playwright test ... --grep=EXT-12` | PASS | 1/1 in 28.5 s: catalog, two bindings, typed approval path, completed fixture, zero state changes, and zero axe violations. |
| `CMD-PLATFORM-E2E` / `npm run test:e2e` | FAIL | Pre-final aggregate run: 9 passed, one live-SFU test skipped, two existing offline/reconnect tests timed out, and the serial tail did not run. The PS-330 journey was rerun separately and passed after the final fixes. |
| `CMD-PLATFORM-A11Y` / `npm run test:a11y` | FAIL | Aggregate run: 5 passed, one live-SFU skip, one existing Voice consent locator failure, and one serial test did not run. The focused PS-330 axe journey passed with zero violations. |

Browser traces and failure artifacts are under `output/playwright/ps-150/results/`. Aggregate failures are not release-approved away; they remain visible even though the PS-330-specific browser evidence passes.

## Migration and recovery

No database migration was added. The catalog reads the existing extension registry, and bindings/compositions remain part of the collaborative Draft and immutable Release package.

Rollback is code-only: remove the Studio sections and new endpoints while retaining authored Draft JSON and already published immutable Releases. If a catalog Artifact, Publisher, or Installation loses approval, new Publication fails closed; existing Release provenance stays intact and recovery is a forward fix or an explicitly governed Plugin replacement.

## Release limits

This is not production approval. ADR-018 remains Confirmed but still needs named specialist/security sign-off. OPEN-022 and OPEN-029 are resolved for the implementation baseline, while production trust-key, revocation, recovery, catalog-sharing, and operating evidence remains for the release gates. Manual screen-reader and human usability review were not performed.
