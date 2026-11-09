# Organization administration view-family brief

## Purpose and journeys

Own members/roles, Plugin governance, deployment posture and data policy. Prioritize `J-ADM-01` and `J-ADM-02`.

Plenum Platform Administrator is a separate platform authority, not an Organization Role. Its adjacent control-plane workspace provisions the Organization boundary, verified domains, deployment profile, entitlements and first Admin before activation. Once active, the first Admin owns Organization role administration; Platform Administrator authority does not grant access to that Organization's Projects, Releases, Sessions or evidence.

## Orientation contract

Persist Organization, Admin role context, selected administrative area and current policy/posture state. Changes distinguish proposed input, validated consequence and committed authoritative state. Sensitive technical provenance is available on demand, not used as the primary label.

## Layout and scroll ownership

Use stable administration navigation, work table/form and contextual detail or consequence panel. Data tables own horizontal overflow only as a last resort; narrow layouts transform rows to labeled records without hiding actions. Policy forms use sections, not a single wall of controls.

## Forms, dialogs and messages

Role replacement, trust changes, holds, correction and retention operations use typed selectors and clear before/after summaries. Raw JSON and UUID entry are prohibited. Final-Admin protection, stale writes, policy conflicts and partial operations produce specific recovery. Irreversible/destructive actions require explicit confirmation and preserved audit context.

The exhaustive family classification is the Organization administration row of `../forms-dialogs-messages.md`.

## Components and gaps

Reuse admin navigation, roster/data table, filters, fields, semantic selectors, status badges, diff/summary, dialog, sheet, audit trail and inline notices. Gaps: reusable before/after consequence summary, semantic scope picker and final-privilege warning pattern.

## Keyboard and focus

Tables support ordinary link/button navigation before advanced grid behavior. Bulk actions remain reachable and announce selection count. Validation focuses the first invalid field; successful commits return focus to the changed record/status. Escape dismisses non-destructive overlays only.

## State, viewport and evidence

The normal family implementation and focused cross-family evidence are closed in `../impeccable/organization-administration/family-closeout.md`; remaining human, device and task-level state gates are explicitly NOT RUN.

All Admin states apply, especially no-results, stale membership, final-Admin denial, Plugin incompatibility, unavailable deployment dependency, legal hold conflict, partial export and revoked Admin role. Verify dense rosters and long policy labels across the full matrix. Planned evidence key: `organization-administration`; no PS-800 PASS evidence exists yet.

Control-plane lifecycle states are `pending`, `active`, `suspended` and terminal `offboarded`. Activation requires a deployment profile, at least one entitlement, a verified Organization domain and an accepted first-Admin invitation. Suspension and offboarding revoke active Organization authentication/projection access while retaining governed records; every platform transition produces an immutable platform audit record.

Tier behavior: 1920/1440 show admin navigation, table/form and details; 1280x720/600 collapse detail while preserving selected record/actions; 1024x768 transforms dense tables to bounded labeled rows where needed; 768x1024 and 390x844 use navigation/detail sheets and full-width forms. At 200%/320px, policy summaries precede commit actions and tables never force page-level horizontal scroll.


## PS-842 candidate contract

One Workspaces entry lands Admins on Workforce access and Publisher-only principals on Plugin operations. The shared secondary menu contains Workforce access, Identity provider, Plugin operations, Deployment posture and Data policy, filtered by authority. Signed requested permissions and named tenant-scoped targets replace free-text technical entry; PEM material is a labeled file selection.

Supported acceptance: 1440x900, 1024x768 and equivalent 200% desktop zoom, explicit light/dark, keyboard, reduced motion, forced colors and named desktop AT. Mobile/touch remains N/A. Current evidence and human gates are in ../../acceptance/PS-842-interface-consistency.md; historical closeout does not establish this candidate's acceptance.
