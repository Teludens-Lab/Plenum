# Platform lifecycle — build step 5 review

Status: **IMPLEMENTED AND ISOLATED REGRESSION PASS**. This is interim lifecycle-hardening evidence, not the family close-out critique/audit or human acceptance gate.

## Delivered lifecycle gates

- Every visible Project, Release and Session catalog row now has exactly one explicit primary next action.
- Active Projects open their Draft or review surface. Archived Projects present Reopen as the primary action when the current role can manage them; read-only roles retain one review action.
- Releases prioritize Session creation for Operators, verified Package export for Publishers and Release review when neither mutation nor export is available.
- Sessions derive their primary action label from the authoritative `nextActions` response and route it to the lifecycle surface that can complete that action: staffing/readiness before activation, Runtime while active, Reports after completion and Archive after lock.
- Session detail keeps all governed destinations visible. Destinations whose lifecycle prerequisites are unmet are focusable, expose `aria-disabled="true"`, reference adjacent prerequisite text with `aria-describedby` and have no navigation target.
- Blocked Runtime, Reports, Replay and Archive affordances explain the exact lifecycle transition required. Their direct URLs and trusted server authorization remain unchanged; this step hardens presentation gates rather than creating a second authorization model.

## Rendered review

### `platform-lifecycle-1440x900.png`

Release rows now resolve to one dominant action, with export retained as a secondary operation when Session creation is permitted. The next-action sentence and control agree, and the continuous row rhythm remains intact.

### `operator-session-detail.png`

The configured Session presents **Complete readiness** as the single dominant action. Runtime, Reports, Replay and Archive remain discoverable without implying availability, and each blocked destination carries a visible prerequisite. The disabled treatment uses the existing recessed material, border, type and spacing tokens.

## Evidence

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, including production builds and contract lint. The existing `532.95 kB` browser chunk warning remains.
- Fresh isolated database: `npx playwright test --config tests/e2e/product/playwright.config.mjs --grep 'PS-(800|710-T0|720-T0)'`: PASS, 5/5 in 57.3 seconds.
- Final isolated configured-Session render refresh after the alignment-only CSS correction: `--grep 'PS-720-T02'`: PASS, 1/1 in 18.2 seconds.
- PS-800 asserts exactly one `.catalog-primary-action` per visible Project, Release and Session row and verifies the open and active Session action/destination mappings.
- PS-720 verifies Publisher export priority, configured-Session readiness priority, disabled destination semantics, accessible prerequisite descriptions, direct-route compatibility and axe analysis.
- Visual review completed for the desktop lifecycle catalog and configured Session detail.
- Existing PostgreSQL client query deprecation output remains unchanged and is outside this UI step.

## Scope intentionally deferred

- Constrained-height, tablet, mobile, 200%/320px, touch, reduced-motion and forced-colors adaptation remains the next Platform lifecycle build step.
- Lifecycle-wide search, recent-object navigation and contextual inspector behavior remain later Platform lifecycle work.
- Full route/state evidence, qualified assistive-technology review, after-critique, after-audit, polish and human usability acceptance remain pending.
