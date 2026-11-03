# Platform lifecycle baseline audit

Target: `apps/runtime-web/src/App.tsx`, `apps/runtime-web/src/product/` lifecycle components and `apps/runtime-web/src/styles.css`.

## Audit health score

| # | Dimension | Score | Key finding |
|---|---|---:|---|
| 1 | Accessibility | 3 | Strong semantics/focus/state labels; 200% layout loses usable orientation and some dynamic focus contracts are absent. |
| 2 | Performance | 2 | Root renders several complete portals and large catalogs; production build reports a 532.95kB browser chunk warning. |
| 3 | Theming | 4 | Production semantic tokens and official light/dark wordmarks are used coherently. |
| 4 | Responsive design | 2 | No obvious horizontal overflow and controls meet target size, but narrow/zoom layouts only stack rather than transform. |
| 5 | Implementation integrity | 2 | Detector is clean, while the rendered marketing hero/card stream conflicts with the approved Operate/Teludens contract. |
| **Total** |  | **13/20** | **Acceptable; significant work required.** |

## Implementation integrity verdict

**FAIL for PS-800 lifecycle conformance.** The code has good local semantics and token use, but its root composition expresses a generic long-scroll portal rather than the approved Plenum lifecycle workstation. A clean deterministic detector does not override the visual and structural evidence.

## Findings

1. **P1 · Responsive / Accessibility:** browser-body scroll grows to thousands of pixels at desktop and 200% zoom, separating context from active controls. Replace with bounded regions and drawer/sheet transformations.
2. **P1 · Integrity:** marketing hero and repeated card containers violate project-specific prohibited patterns. Remove the hero hierarchy and normalize catalogs/headers to Teludens work surfaces.
3. **P1 · Accessibility / Integrity:** readiness-gated destinations are presented with equal emphasis. Make the valid next action primary and expose unavailable reasons programmatically.
4. **P2 · Performance:** all root portals render together and the browser bundle exceeds the build warning threshold. Measure after structural change; code-split only where the measured route boundary justifies it.
5. **P2 · Accessibility:** opening contextual creation/confirmation UI needs deliberate focus placement and return; filter reset and long-value full access need consistent controls.

## Positive findings

- Skip link, landmarks, headings, native inputs/buttons and visible focus are established.
- State is never conveyed by color alone.
- Dark/light themes, semantic status tokens and exact official brand assets are already centralized.
- Unauthorized/offline paths omit protected data and provide specific recovery.

## Recommended sequence

1. `layout`: stable shell, bounded catalog/work region and inspector.
2. Teludens normalization: replace card mosaic without creating a new parallel component system.
3. `clarify`: action labels, readiness language and secondary provenance.
4. `harden`: state/focus/gating behavior.
5. `adapt`: constrained height, 200%/320px and touch transformations.
6. `polish`: rendered cross-viewport close-out after automated checks.

