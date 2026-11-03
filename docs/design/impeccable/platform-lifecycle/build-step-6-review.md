# Platform lifecycle — build step 6 review

Status: **IMPLEMENTED AND ISOLATED REGRESSION PASS**. This is interim adaptation evidence, not the family close-out critique/audit, physical-device certification or human acceptance gate.

## Delivered adaptation

- Preserved one DOM and task order across all contexts: workspace navigation, lifecycle work region, then Access context. No mobile-only information architecture or duplicated control path was introduced.
- At 1280×600 and other short desktop windows, the Access inspector no longer consumes a third column. It becomes an explicit focus-managed sheet while the catalog remains the bounded scroll owner.
- At 1024px, compact navigation remains visible and Access becomes a sheet. At 768px portrait and below, Workspaces and Access use mutually exclusive labeled disclosures so only one secondary region opens at a time.
- Opening Access moves focus to the revealed region. Its internal close action returns focus to the invoking control.
- At narrow widths, filters, action groups, catalog primary actions and lifecycle destinations become one-column full-width controls without changing their source order.
- At 320 CSS pixels with 200% root text, disclosure controls stack, long labels wrap, and no page-level horizontal overflow is introduced.
- Coarse-pointer contexts receive a token-derived minimum 44 CSS-pixel target for controls, navigation links, primary actions, provenance summaries and lifecycle destinations. The flow does not depend on hover.
- Added safe-area-aware shell padding and `viewport-fit=cover` for notched mobile viewports.
- Existing reduced-motion behavior was verified against the imported Teludens motion contract; interaction remains immediate and no task depends on a transition.
- Forced-colors treatment now preserves boundaries for catalogs, rows, forms, cards, sheets, primary paths and disabled destinations using system colors.

## Rendered matrix

- `platform-lifecycle-1280x600.png`: short-height desktop retains navigation and a larger bounded work region while Access is available from the context header.
- `platform-lifecycle-1024x768-access-sheet.png`: compact two-region tablet layout with the Access sheet anchored to the shell.
- `platform-lifecycle-768x1024-access-context.png`: portrait disclosure controls stack and the Access sheet opens at the work boundary.
- `platform-lifecycle-320x720-200-percent.png`: one-column high-zoom flow with wrapped labels, non-overlapping controls and unchanged task order.
- `platform-lifecycle-390x844-touch.png`: synthesized Chromium touch flow with 44px targets.
- `platform-lifecycle-390x844-reduced-motion.png`: reduced-motion preference with the workspace disclosure open.
- `platform-lifecycle-1280x720-forced-colors.png`: Windows forced-colors emulation preserves primary and unavailable destination affordances.

## Evidence

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, including production builds and contract lint. The existing `532.95 kB` browser chunk warning remains.
- Fresh isolated database: `npx playwright test --config tests/e2e/product/playwright.config.mjs --grep 'PS-(800|710-T0|720-T0)'`: PASS, 6/6 in 1.9 minutes.
- Final clean Step 6 viewport rerun after visual corrections: `--grep 'PS-800'`: PASS, 2/2 in 43.9 seconds.
- Automated checks cover bounded short-height scroll ownership, focus placement/return, tablet and portrait disclosure behavior, 320px/200% reflow, task-order preservation, synthesized touch activation and target size, reduced-motion preference, forced-colors semantics and axe analysis.
- Visual review completed across all seven captured contexts.
- Existing PostgreSQL client query deprecation output remains unchanged and is outside this UI step.

## Evidence limits

- Touch evidence uses synthesized Chromium touch input, not a physical iPhone, Android phone or tablet.
- Reduced motion and forced colors are browser emulations. Safari, Firefox, Edge, physical safe areas, NVDA/JAWS/VoiceOver and qualified manual usability testing are **NOT RUN**.
- Generated PS-790 fixture noise was restored. Final disposal of the isolated `plenum_step6_adapt_final` database is **NOT RUN** because Docker Desktop became unavailable after verification; it contains synthetic test data only.

## Scope intentionally deferred

- Platform lifecycle final polish, after-critique, after-audit and family close-out remain next.
- Lifecycle-wide search, recent-object navigation and expanded contextual inspector behavior remain later work unless family close-out identifies them as blockers.
- The complete PS-800 route/state/browser/device matrix and human acceptance gate remain pending.
