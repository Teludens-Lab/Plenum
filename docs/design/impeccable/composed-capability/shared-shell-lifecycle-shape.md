# Composed capability — shared shell and lifecycle shape

Mode: **Operate**. Scope: shared Plenum shell plus the Project → Release → Session lifecycle as the representative end-to-end workflow.

## User goal and active context

The user needs to resume or advance governed work while always seeing the Organization, workspace, active Organization Role, connection state, object state, and authoritative next action. The URL, navigation selection, scroll owner, and focus return preserve continuity.

## Primary action by state

- Project: open the Draft or reopen the archived Project; creation is the primary action only inside the create region.
- Release: create a Session when authorized; otherwise export the verified Package or review the Release.
- Session: complete readiness, start/open Runtime, inspect results, or archive according to lifecycle state.
- Error/empty/offline: recover or take the one authorized setup action; never show a false success path.

## Editorial hierarchy and dominant work area

1. Shell: Plenum identity, theme, connection.
2. Context header: Organization, workspace subject, signed-in identity and Organization Role.
3. Navigation: concise goal/object labels; current destination receives the only visible annotation.
4. Work region: subject summary, compact tools, continuous catalog, selected detail.
5. Inspector/sheet: trusted access context or selected-object evidence; secondary and dismissible at constrained sizes.

The work region owns attention and scrolling. Persistent supporting regions are flat; temporary sheets are elevated.

## Visible essentials and progressive detail

Visible: object name, state, Project/Release relationship, readiness/progress, count, and valid next action. Disclosed: Package digest/compiler/schema, secondary destinations, confirmation detail, and infrequent policy explanation. Raw identifiers remain out of the scan path.

## Integrated value in the task

- Release immutability and provenance appear where a Session or export decision is made.
- Session readiness and participant counts show progress before entry.
- Disabled destinations explain the exact prerequisite.
- Consequential forms explain the resulting state and next governed step.

## Awareness-based copy

- First-use/empty: problem- and solution-aware; explain what can be accomplished and the one setup action.
- Creation/confirmation: product-aware; name prerequisites, result, consequence, and recovery.
- Recurring catalogs: most-aware; use stable direct labels, compact facts, and optional detail.
- Errors: state what failed, what remained safe, and the recovery control.

## Operational states and recovery

Loading, refresh, empty, no results, recoverable/terminal error, offline/reconnect, pending, stale/conflict, disabled, unauthorized/revoked, partial failure, success, and long/localized content follow `docs/design/state-inventory.md`. Dialogs are native modal layers with safe initial focus, Escape, inert background, visible actions, and focus return.

## Motion contract

- Navigation selection: token selection duration; color/boundary only.
- Mobile navigation and Access sheet: token panel duration; originate from their invoking context and remain interruptible.
- Inline Session creation: short panel reveal from its Release row; no page-load entrance.
- Press: token press acknowledgement; state text remains the authoritative feedback.
- Reduced motion: immediate equivalent, no lost relationship or status.

## Boundaries

No copied Apple/Cursor/ChatGPT chrome, no new token values, no new dependency, no alternate state store, and no change to authorization or lifecycle rules. The named Taste/emil/obs capabilities are unavailable; their responsibilities are fulfilled only through installed documented skills and repository tooling.
