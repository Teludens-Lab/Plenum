Method: dual-agent (A: step7_assessment_a · B: step7_assessment_b)

# Platform lifecycle after-critique

Target: `apps/runtime-web/src/App.tsx` and the Project, Release and Session lifecycle routes.

## Design health score

| # | Heuristic | Before | After | Observation |
|---|---|---:|---:|---|
| 1 | Visibility of system status | 3 | 3 | Connection, Organization, role, lifecycle state, counts and readiness remain visible. |
| 2 | Match system / real world | 3 | 4 | Project, immutable Release and Session language now lead; identifiers and Package digests are secondary. |
| 3 | User control and freedom | 2 | 3 | Search reset, explicit cancellation, native dialog Escape and focus return are present. |
| 4 | Consistency and standards | 2 | 3 | One shell, hierarchy, catalog row, filter and primary-action treatment spans the family. |
| 5 | Error prevention | 2 | 3 | Consequences are named and readiness gates expose one valid primary next action. |
| 6 | Recognition rather than recall | 2 | 3 | Persistent context, catalog labels and adjacent prerequisites reduce cross-view memory. |
| 7 | Flexibility and efficiency | 1 | 2 | Bounded catalogs and search improve scan speed; lifecycle-wide search and recent-object shortcuts remain deferred. |
| 8 | Aesthetic and minimalist design | 1 | 3 | The marketing hero/card stream is replaced by a restrained Teludens workstation. |
| 9 | Error recognition and recovery | 3 | 3 | Scoped errors, retries, preserved input and stale-state recovery remain clear. |
| 10 | Help and documentation | 1 | 2 | Prerequisites and consequences are contextual; expert help/shortcut discovery remains limited. |
| **Total** |  | **20/40** | **29/40 — Good** | No heuristic regressed. |

The first independent post-build assessment scored 28/40 and identified two P1 defects. Both were fixed before the final 29/40 reassessment: constrained Access now uses a native modal dialog, and forced-colors current navigation has a distinct system Highlight boundary plus weight. The final automated critique then exposed two additional conformance defects: lifecycle item headings skipped a semantic level, and the pressed-state scale reduced one coarse-pointer target below 44px. Both were corrected before close-out.

## Final verdict

The family now reads as a Plenum operating surface rather than a generic portal. The first scan establishes Organization, workspace, role and connection; the work region then establishes the Project or lifecycle catalog and one valid next action per row. The same task order survives short-height, tablet, portrait, touch and 320px/200% contexts.

## Remaining priority issues

- **P2 — expert efficiency:** lifecycle-wide search, recent-object navigation and shortcut discovery remain deferred until a shared cross-family pattern is justified.
- **P2 — constrained-length workload:** mobile and 200% layouts are correct access modes but remain long serial workflows; no task order is changed to hide that cost.

No P0 or P1 implementation defect remains. The formal evidence limits are listed separately in `family-closeout.md` and are not silently converted into design PASS results.

## Persona close-out

- **Alex, power user:** row scanning and direct primary actions are materially faster; global lifecycle search remains a later efficiency improvement.
- **Sam, keyboard/low-vision user:** native modal containment, Escape, focus return, 320px/200% reflow, visible focus and forced-colors current state are automated.
- **Morgan, operator/designer:** workspace, role, immutable status, readiness and the valid next action are visible without reading raw identifiers.

## Run notes

- Target slug: `apps-runtime-web-src-app-tsx`.
- Independence: Assessment A and B ran separately before their results were synthesized.
- Detector after fixes: one consolidated scan of `App.tsx`, `LifecyclePortal.tsx`, `ProjectPortal.tsx` and `styles.css` returned `[]`; no ignores or suppressions.
- Live overlay: NOT RUN because no live browser fixture was available to Assessment B; the repository Playwright harness supplied the rendered evidence instead.
- Reduced-motion `0.01ms` treatment is an approved project contract in `docs/design/MOTION_SPEC.md`, not a detector suppression.
- Questions skipped: 2 remaining Priority Issues, both documented non-blocking follow-ups.
