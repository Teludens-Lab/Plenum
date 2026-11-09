# Reporting and research view-family brief

## Purpose and journeys

Own governed report generation/delivery and purpose/consent-filtered research analysis/export. Prioritize `J-RSH-01`, reporting in `J-OPR-03` and evidence production in `J-OPR-04`.

## Orientation contract

Persist report/research purpose, Session/Project scope, governing Release/evidence checkpoint, population/filter state, consent exclusions, generated-at state and user role. Human-readable questions and measures lead; event keys, UUIDs, digests and filenames are secondary provenance.

## Layout and scroll ownership

Use a report workspace: definition/filter rail, primary results/document region and provenance inspector. Large tables and paged documents own their scroll with sticky semantic headers. On narrow screens, filters and provenance become labeled sheets while result reading order remains intact.

## Forms, dialogs and messages

Generation forms expose purpose, scope, consent effect and output format. Export confirmations disclose excluded data and expiry/custody. Empty means no eligible data, not loading. Partial delivery identifies completed/failed recipients or pages. Reconciliation failure is distinct from ordinary generation error.

The exhaustive family classification is the Reporting/research row of `../forms-dialogs-messages.md`.

## Components and gaps

Reuse filter fields, semantic measure selector, result summary, table/chart with text alternative, paged report viewer, uncertainty/provenance disclosure, status, dialog and download record. Gaps: common evidence/provenance inspector and consent-exclusion summary. Charts may supplement, never replace, tabular/text evidence.

## Keyboard and focus

Filters precede results; generation moves focus to a results heading only after an explicit submit. Tables retain DOM order and accessible names. Downloads have descriptive names independent of opaque filenames. Long jobs announce milestones without focus theft.

## State, viewport and evidence

The normal family implementation and focused cross-family evidence are closed in `../impeccable/reporting-research/family-closeout.md`; remaining human, device and task-level state gates are explicitly NOT RUN.

All Reports states apply: no eligible data, purpose/consent exclusion, generation pending, stale source, partial page/delivery, reconciliation mismatch, export expired and revoked research grant. Verify dense tables, multipage documents and long questions at every risk viewport. Planned evidence key: `reporting-research`; no PS-800 PASS evidence exists yet.

Tier behavior: 1920/1440 show filters, results and provenance; 1280x720/600 keep results primary and collapse provenance; 1024x768 makes filters/provenance sheets; 768x1024 and 390x844 serialize summary, results and disclosures while retaining table alternatives. At 200%/320px, report pages reflow or provide an accessible zoomed document mode without two-dimensional page scrolling.


## PS-842 candidate contract

Research-Analyst-only principals land on or can visibly reach Research reports. The page has one H1 and shared date/status formatting. Consent, grants and server-filtered evidence remain authoritative; no role is granted by navigation.

Supported acceptance: 1440x900, 1024x768 and equivalent 200% desktop zoom, explicit light/dark, keyboard, reduced motion, forced colors and named desktop AT. Mobile/touch remains N/A. Current evidence and human gates are in ../../acceptance/PS-842-interface-consistency.md; historical closeout does not establish this candidate's acceptance.
