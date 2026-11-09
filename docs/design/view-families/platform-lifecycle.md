# Platform lifecycle view-family brief

## Purpose and journeys

Own Organization, Project, Template, Release and Session discovery/creation/entry. Prioritize `J-DES-01`, `J-PUB-01`, `J-PAR-01` and `J-OPR-01` from `../journeys.md`.

## Orientation contract

The stable shell names the product and Organization. The work header names the selected catalog or object, its lifecycle state and the active role context. Immutable Releases display immutability and provenance before actions; Sessions display readiness/lifecycle before entry. Internal IDs are secondary copyable metadata only.

## Layout and scroll ownership

Use the Teludens application frame: primary navigation, bounded catalog/work region and optional contextual inspector. The work region owns catalog scrolling; dialogs/sheets own their internal scroll; the body remains stable. At narrow widths, navigation becomes a labeled drawer and the inspector becomes a modal sheet without changing DOM meaning.

## Forms, messages and consequences

Create flows use semantic selectors, progressive sections, inline validation and a final summary. Archive, import and publication confirmations state target, effect, reversibility and provenance. Empty, no-results, unauthorized, offline, stale and duplicate-submit messages follow `../state-inventory.md`; toast-only confirmation is prohibited.

The exhaustive family classification is the Platform lifecycle row of `../forms-dialogs-messages.md`.

## Components and gaps

Reuse `AppFrame`, `WorkHeader`, `Breadcrumbs`, `Tabs`, `DataTable/List`, `StatusBadge`, `Field`, `Select`, `Dialog`, `Sheet`, `InlineNotice`, `EmptyState`, `Skeleton` and official wordmark primitives. Replace card-grid-as-navigation with continuous catalog/list patterns. Gaps: standardized lifecycle catalog row, object-context header and semantic provenance disclosure; extract only if two families need the same pattern.

## Keyboard and focus

Landmarks follow header -> primary navigation -> context header -> work region -> inspector. Catalog rows are links, not clickable containers. `/` or the documented command affordance may focus search only when it does not capture typing. Escape closes the top dismissible layer; Enter activates the focused native control; focus returns to the invoker.

## State, viewport and evidence

All canonical states apply as marked for Lifecycle in `../state-inventory.md`. Verify the full viewport/input matrix, long Organization/Project names, empty catalogs, many rows, 200%/320px reflow, themes, reduced motion and forced colors. Evidence key: `platform-lifecycle`. The normal family implementation and targeted viewport/input matrix have automated close-out evidence in `../impeccable/platform-lifecycle/family-closeout.md`; its state ledger identifies the remaining task-level NOT RUN cells.

Tier behavior: 1920/1440 retain navigation, work region and inspector; 1280x720/600 keep catalogs primary and collapse inspector; 1024x768 uses compact navigation plus inspector sheet; 768x1024 and 390x844 use a drawer/sheet sequence with one visible work region and persistent context header. At 200%/320px, content is one column with no two-dimensional page scroll.


## PS-842 candidate contract

The catalog uses one H1, and Release/Session details use the object title with status below it. Publisher-only authority sees Releases. Your Sessions retains Workspaces for multi-role users; the account chip shows all projected Organization roles and platform authority.

Supported acceptance: 1440x900, 1024x768 and equivalent 200% desktop zoom, explicit light/dark, keyboard, reduced motion, forced colors and named desktop AT. Mobile/touch remains N/A. Current evidence and human gates are in ../../acceptance/PS-842-interface-consistency.md; historical closeout does not establish this candidate's acceptance.
