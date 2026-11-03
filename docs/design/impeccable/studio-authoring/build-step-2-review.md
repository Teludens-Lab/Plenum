# Studio authoring — Build Step 2 review

Status: implemented and focused-browser verified. The full publication and live-activation serial proof remains open after an environment approval timeout prevented its corrected rerun.

## Slice

Review & publish and Live Changes now use the same selected-workspace contract as the twenty-five authoring workspaces.

- Both destinations are entries in the desktop Draft map and the responsive Design workspace picker.
- Only the selected destination is visible. Its URL fragment survives reload, Back and Forward navigation, while mounted workspace state remains available.
- On wide layouts, both destinations inherit the bounded canvas scroll owner. Tablet and mobile retain the established linear DOM and focus order.
- Review & publish keeps the human decision path visible: freeze state, who froze it, approval count, reviewer rationale, release details and the one eligible next action.
- Freeze references, artifact and validation digests, and policy version are grouped under `Technical provenance`.
- Classification and retention references are grouped under `Governance references`; native invalid handling opens the disclosure before focusing a missing required field.
- Live Changes keeps impact counts, classified change type, blocked reasons, approval state and activation action visible. Session, Release and approval identifiers, technical change paths and the impact digest are disclosed on request.
- Success messages name the Draft or human-readable Release label instead of exposing freeze or Release identifiers.

No domain model, authorization rule, API contract, persistence path or publication/activation invariant changed.

## Layout assessment

- **Reading order:** persistent Draft context and state lead; Draft map/picker chooses one bounded task; Draft checks remain the supporting inspector.
- **Grouping:** review facts, reviewer approval, Release publication, Template publication and Template lifecycle remain within one governed workspace. Live impact evidence and activation remain together in the other.
- **Rhythm and density:** human decision facts remain in the normal scan path; provenance uses one flat disclosure treatment rather than nested cards.
- **Adaptation:** desktop retains independent canvas scrolling. At the existing tablet breakpoint the picker replaces the map and the page becomes linear, preserving DOM, focus and task order.
- **Extremes:** long identifiers and digests wrap inside a two-column definition list that collapses to one column on narrow screens. The existing 320px/200% whole-document overflow assertion passed.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Build | PASS | `npm run build` |
| TypeScript | PASS | `npm run typecheck` after the final source edits |
| Teludens audit | PASS | `npm run audit:teludens-ui`: semantic map, density, grammar, motion and exact brand assets verified |
| Impeccable layout pre-scan | PASS | `--scope layout` returned `[]` before editing |
| Impeccable final detector | PASS | Final scan of the four changed Studio source targets returned `[]` |
| Diff hygiene | PASS | Scoped `git diff --check` returned no findings |
| PS-760 selected-workspace flow | PASS | Focused Playwright: 1 passed in 3.7 minutes |
| Browser history | PASS | Review & publish → Live Changes → Test & validate; Back restored Live Changes and Forward restored Test & validate |
| Accessibility and constrained states | PASS | Focused PS-760 axe, reduced-motion, forced-colors and 320px/200% reflow assertions |
| Publication serial proof | NOT RUN after assertion correction | The first broad run reached the new freeze success message, then failed on its stale old-copy regex. The regex was corrected, but the disposable database could not be recreated because the local approval service timed out. |
| Live activation serial proof | NOT RUN | It was the second test in the serial run and did not execute after the stale publication assertion. |

The disposable `plenum-ps800-studio-db` container held synthetic fixture data only. It was removed before the blocked recreation attempt; no production data or environment was changed.

## Explicit remaining gates

- Rerun the corrected publication and live-activation serial tests when local Docker approval is available.
- Human review of the Review & publish and Live Changes task path: NOT RUN.
- Screen-reader review with NVDA, JAWS or VoiceOver: NOT RUN.
- Physical touch devices, mobile Safari and Android Chrome: NOT RUN.
- Windows High Contrast on physical hardware: NOT RUN; browser forced-colors emulation passed.
- Localization expansion for long Release labels and governance terminology: NOT RUN.

