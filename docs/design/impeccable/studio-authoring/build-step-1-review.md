# Studio authoring — Build Step 1 review

Status: implemented and automation-verified. Human first-use and physical-device gates remain open.

## Slice

The J-DES-01/J-DES-02 reference path now behaves as a bounded authoring workstation instead of one document containing every Studio capability.

- The human-readable Core Design title, Scenario, Organization, signed-in person, Organization roles, connection, save state and validation state remain visible before workspace navigation.
- Twenty-five authoring workspaces are grouped by task. One workspace is visible at a time; the mounted editors and their local state are preserved.
- The selected workspace is encoded in the URL fragment and survives reload, browser Back and browser Forward.
- Wide layouts use a Draft map, active canvas and validation inspector. At tablet/mobile widths the map becomes one labeled workspace picker and the inspector follows the canvas in DOM order.
- Validation recovery uses `Open <workspace>` as the primary action. The raw validation path remains available only under `Technical location`.
- Review/Publication and Live Changes remain separate governed regions below authoring; no domain, authorization, collaboration or Publication contract changed.

## Before and after evidence

- Before: `output/playwright/ps-730/foundational-studio.png` — 1440 × 38,450 capture with all workspaces in one scan path.
- After desktop: `output/playwright/ps-800/after/studio-authoring/studio-workstation-1440x1000.png`.
- After mobile: `output/playwright/ps-800/after/studio-authoring/studio-workstation-390x844.png`.
- After 320px with 200% text: `output/playwright/ps-800/after/studio-authoring/studio-workstation-320px-200pct.png`.
- After forced colors: `output/playwright/ps-800/after/studio-authoring/studio-workstation-forced-colors.png`.

The captures demonstrate implementation state and reflow only. They do not establish faster task completion, lower cognitive load or user preference.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Build | PASS | `npm run build` |
| TypeScript | PASS | `npm run typecheck` |
| Teludens audit | PASS | `npm run audit:teludens-ui` |
| Impeccable detector | PASS | Final detector returned `[]` for the three changed Studio source targets |
| PS-730 collaboration and linked recovery | PASS | One focused Playwright test; 9.6 minutes |
| PS-740 governed authoring | PASS | Focused Playwright rerun |
| PS-750 advanced authoring | PASS | Focused Playwright rerun with bounded 600-second budget |
| PS-760 rehearsal/publication | PASS | Focused Playwright run plus URL restoration, Axe, viewport and media checks |
| 320px / 200% horizontal reflow | PASS | Whole-document bounding-box assertion returned no overflow after corrections |
| Reduced motion | PASS | Playwright emulation during reference capture and flow |
| Forced colors | PASS | Playwright forced-colors emulation; active workspace remained available |
| Diff hygiene | PASS | `git diff --check` |

## Explicit remaining gates

- Human first-use observation: NOT RUN. Use `docs/acceptance/PS-800-studio-authoring-first-use.md` without coaching beyond its task prompt.
- Screen-reader review with NVDA/JAWS/VoiceOver: NOT RUN.
- Physical touch devices, mobile Safari and Android Chrome: NOT RUN.
- Windows High Contrast on physical Windows display hardware: NOT RUN; browser forced-colors emulation passed.
- Localization expansion with a translated Terminology Profile: NOT RUN.
- PS-800 Studio family close-out, after-critique and after-audit: NOT RUN; this record closes only the first representative workflow slice.

