# Platform lifecycle after-audit

Target: `apps/runtime-web/src/App.tsx`, lifecycle portal components, Teludens tokens and `apps/runtime-web/src/styles.css`.

## Audit health score

| # | Dimension | Before | After | Evidence |
|---|---|---:|---:|---|
| 1 | Accessibility | 3 | 4 | Native controls/dialog, focus placement and return, Escape, programmatic prerequisites, axe and reflow checks pass. |
| 2 | Performance | 2 | 2 | Bounded region ownership prevents page-scale work; the existing 532.95 kB browser chunk warning and trace budgets remain open. |
| 3 | Theming | 4 | 4 | Teludens semantic tokens, official wordmarks, light/dark inheritance and system colors remain authoritative. |
| 4 | Responsive design | 2 | 4 | Short height, tablet, portrait, touch, safe areas, 320px/200%, reduced motion and forced colors pass targeted automation. |
| 5 | Implementation integrity | 2 | 4 | Source detector is clean; rendered structure matches the approved Operate/Teludens brief. |
| **Total** |  | **13/20** | **18/20 — Excellent** | No audit dimension regressed. |

## Closed findings

1. The unbounded root stream is replaced by a stable application frame with one bounded work-region scroll owner.
2. Project, Release and Session collections share one continuous Teludens catalog-row grammar.
3. Typography, action labels, forms, consequences, errors, empty states and Package provenance use the approved hierarchy and vocabulary.
4. Readiness gates expose one valid primary next action and programmatically described prerequisites.
5. Responsive Access is a native modal dialog with inert background behavior, focus containment, Escape dismissal and focus return; desktop retains the complementary inspector.
6. Forced colors visibly distinguishes the current workspace from available destinations.
7. The Projects root anchor is correct and the authenticated Organization selector is no longer an enabled inert control.
8. Release and Session catalog item headings now follow their section headings without a skipped level, and coarse-pointer press feedback no longer shrinks a 44px target.

## Remaining audit limits

- **P2 · performance:** production build still reports the pre-existing 532.95 kB browser chunk warning. Unthrottled/4× traces, INP, CLS and full-frame-rate review are NOT RUN.
- **P2 · efficiency:** the narrow lifecycle page remains a long serial workload. This is preferable to changing task order, but future shared recent/search affordances may shorten it.
- State-specific latency thresholds, terminal/revoked variants and the full PS-800 family × state artifact set remain explicit project-level evidence gates in `family-closeout.md`.

## Detector review

| Target | Command result | Findings | Suppressions |
|---|---|---:|---:|
| Four changed UI targets (`App.tsx`, both lifecycle portal components and `styles.css`) | exit 0, `[]` | 0 | 0 |

The detector hook is enabled with defaults. The consolidated manual after-scan is the close-out evidence. The global reduced-motion duration kill was reviewed against `docs/design/MOTION_SPEC.md:5` and is project-authorized.
