# Platform lifecycle — build step 1 review

Status: **IMPLEMENTED AND FOCUSED AUTOMATION PASS**. This is interim structure evidence, not the family close-out critique/audit.

## Delivered structure

- Removed the authenticated marketing hero and the root page's simultaneous Participant, Project and Lifecycle portal stack.
- Added one stable Plenum application frame with a persistent Organization/workspace header, role context, lifecycle navigation, bounded work region and context inspector.
- Added restorable workspace URLs: `/?workspace=projects`, `/?workspace=lifecycle` and `/?workspace=participant`.
- Preserved Release and Session detail URLs and legacy root hashes while resolving them into the owning workspace.
- Omitted unauthorized workspace destinations. Project access is derived from both the product destination contract and an authorized Organization Role; Release/Session access is derived from Publisher, Operator or Admin authority.
- Added a labeled mobile workspace disclosure and responsive spacing that remains readable at 200% text without horizontal page scrolling.
- Kept the existing portals, API contracts, authentication, domain behavior and Teludens production tokens intact.

## Screenshot review

### `platform-lifecycle-1440x900.png`

The eye lands first on **Releases and Sessions**, then the selected lifecycle navigation item and Release catalog. That is the intended hierarchy. Organization, acting role and connection remain visible without competing with the work. The body is stable and the catalog is the only long-scroll owner. No clipping or ambiguous destination was observed.

### `platform-lifecycle-390x844-200-percent.png`

The eye lands first on **Projects**, followed by the identity context and explicit **Close workspaces** control. The drawer is understandable and content reflows to one column with no horizontal page scrolling. The page is necessarily long at 200% because step 1 retains the existing expanded Project cards; catalog-row normalization and the inspector-sheet conversion remain for subsequent build steps.

## Focused evidence

- `npm run build`: PASS with the pre-existing browser chunk warning (`532.95 kB`).
- `PLENUM_E2E_USE_EXISTING_FIXTURE=true npx playwright test --config tests/e2e/product/playwright.config.mjs --grep 'PS-800'`: PASS, 1/1. Covers bounded desktop scroll ownership, URL restoration, lifecycle navigation, mobile disclosure, axe analysis and 200% horizontal reflow.
- `--grep 'PS-(800|710-T02|770)'`: PASS, 3/3 after authorization gating and duplicate-heading test corrections.
- `--grep 'PS-(700|720)-T'`: PS-700 2/2 PASS. The two PS-720 reruns reached fixture-dependent assertions and failed because the intentionally reused database already contained Sessions created by earlier runs (count changed and duplicate test name); no new UI failure was identified. A clean isolated-fixture rerun remains due at family close.

## Open findings carried forward

1. Normalize Project, Release and Session catalogs from nested cards to continuous Teludens list rows.
2. Convert the narrow context inspector into its specified sheet behavior.
3. Replace vague filter labels such as `Apply` and demote raw digests to secondary copyable provenance.
4. Add role/resumable-work landing behavior, readiness-gated destination reasons and lifecycle-wide search in the approved order.
5. Re-run the complete viewport/state matrix, clean isolated PS-720 fixture, after-critique, after-audit, detector and human gate before closing the family.

