# PS-842 - Reconcile role-by-role interface navigation, labels and layout

## ID / title / goal / user outcome / risk

- ID: `PS-842`
- Title: Reconcile role-by-role interface navigation, labels and layout
- Goal: Close every interface inconsistency and gap found by the 2026-11-09 role-by-role audit so each user role meets one navigation model, one vocabulary and one Teludens layout grammar, inclusive of global dark mode.
- User outcome: Every visitor, Organization role, Platform Administrator and Fractured Order participant role can find their work through visible navigation, reads the same name for the same thing everywhere, never sees internal identifiers, and meets consistent layouts at the supported desktop scope.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`.

## Requirements and invariants

Product IDs: `REQ-009`, `REQ-010`, `REQ-063`, `REQ-064`, `REQ-071`, `INV-002`, `INV-019`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-009`, `REQ-010`, `REQ-063`, `REQ-064`, `REQ-071`, `INV-002`, `INV-019`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 6
- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 3 through 27
- `docs/corpus/02_Updated_Architecture/05_RUNTIME_AND_ADJUDICATION_v1.3.md` — 05 Runtime sections 2 through 23
- `references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md` — Teludens Design Language sections 0 through 13
- `references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md` — Teludens Spatial Grammar sections 1 through 14
- `references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md` — Teludens Experience Physics sections 1 through 15
- `references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md` — Teludens Reference Slice sections 1 through 20
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — Decision Register sections 3, 5.7 and 7.1 through 7.5
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-25
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-34
- `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md` — DEC-51

Observed source evidence:

- apps/runtime-web/src/App.tsx
- apps/runtime-web/index.html
- apps/runtime-web/src/product/LifecyclePortal.tsx
- apps/runtime-web/src/product/AdministrationPortal.tsx
- apps/runtime-web/src/product/PlatformOrganizationsPortal.tsx
- apps/runtime-web/src/product/PlatformAdministratorsPortal.tsx
- apps/runtime-web/src/product/ParticipantPortal.tsx
- apps/runtime-web/src/product/ProjectPortal.tsx
- apps/runtime-web/src/product/ProjectDemo.tsx
- apps/runtime-web/src/product/ResearchReportingPortal.tsx
- apps/runtime-web/src/runtime/RuntimeFrame.tsx
- apps/runtime-web/src/runtime/SessionSettings.tsx
- apps/runtime-web/src/runtime/StageControls.tsx
- apps/runtime-web/src/runtime/ArtifactWorkspace.tsx
- apps/runtime-web/src/runtime/RecordInterchange.tsx
- apps/studio/src/App.tsx
- apps/studio/src/core-design/Editor.tsx
- apps/server/src/http/runtime-http.ts
- definitions/fractured-order/fractured-order-release-source.json
- definitions/validation/crisis-response/release-source.json
- definitions/validation/policy-negotiation/release-source.json
- docs/design/route-inventory.md
- docs/design/participant-interfaces.md
- docs/design/prohibited-patterns.md
- docs/design/view-families/
- tests/e2e/participant-interfaces.mjs
- tests/e2e/product/product-shell.spec.mjs
- references/teludens-design-system-catalog/README.md
- references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md
- references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md
- references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md
- references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md
- references/teludens-design-system-catalog/docs/TELUDENS_TOKENS.json
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Primary.png

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

## Prerequisites

Task prerequisites: `PS-840`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

## Inspect before editing

- The 2026-11-09 role-by-role baseline at output/playwright/ps-842/baseline-2026-11-09/ (local, synthetic, pre-implementation; not release evidence) and its README for capture method and known fixture artifacts
- Rendered routes, navigation and headings for every persona: visitor, Designer, Reviewer, Publisher, Operator, Admin, Research Analyst, Platform Administrator and invited Participant
- Every Fractured Order participant navigation item, dialog, header menu and Simulation Settings tab for Scribe (all four teams), Facilitator, Notetaker and White Cell
- Release Interface Profiles, navigation items, module titles and Terminology Profile labels in the Fractured Order and validation Release sources; how Runtime projects them
- docs/design/route-inventory.md, participant-interfaces.md, journeys.md, state-inventory.md, motion-inventory.md, forms-dialogs-messages.md, prohibited-patterns.md, impeccable/conflicts.md and every view-family brief
- Glossary terms for Inject, Message Channel, Communication Route and Active Role Context, and existing Terminology Profile support
- PS-830 golden-journey and PS-840 UAT evidence that depends on labels, routes or layouts this task changes
- Read APPROVAL_IMPLEMENTATION_PROMPTBOOK.md for the remaining-sequence ownership, checkpoint and exact-candidate evidence rules; tasks.json remains the task source of truth
- Use supported Windows/macOS desktop browsers at the declared minimum 1024 x 768 and equivalent 200% zoom, keyboard, pointer, forced colors, reduced motion and named desktop AT; mobile/touch acceptance remains approved N/A
- Inventory existing uncommitted work and prior evidence before changes; preserve unrelated work and distinguish local source, committed candidate and deployed staging digests
- Before provisioning disposable databases/containers, check disk capacity and record exact task-owned resource identifiers; reuse safely where possible, clean up only authorized task-owned resources, and never run broad volume/image pruning

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Product shell, Studio shell and runtime shell navigation, routing, headers, role context and not-found/unauthorized states for every persona
- Canonical labels, ordering, icons, status/date/plural formatting and empty-state text across Studio, product portals, Operator console and all participant roles
- Replacement of user-facing internal identifiers, enum keys and free-text ID entry with plain labels, authorized selections and progressive technical disclosure
- Teludens layout conformance for the audited findings at the supported desktop scope, light and dark theme
- New Release versions for Fractured Order and the two validation simulations where navigation, labels or order change; design documentation and a fail-closed interface-consistency regression command

Expected paths are discovery targets, not permission to invent absent structure:

- apps/runtime-web/src/
- apps/runtime-web/index.html
- apps/studio/src/
- apps/server/src/http/ only where navigation must reflect existing server-projected authority
- definitions/fractured-order/
- definitions/validation/
- scripts/ and package.json for CMD-INTERFACE-CONSISTENCY
- tests/e2e/
- tests/visual/
- docs/design/
- docs/acceptance/
- output/playwright/ps-842/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Implementation

- Checkpoint A - Baseline and ledger: reproduce the 2026-11-09 baseline on the current candidate at 1440x900, 1024x768 and 200% zoom in light and explicit dark theme with keyboard. Create docs/acceptance/PS-842-interface-consistency.md with one row per finding IC-01 to IC-40 (roles affected, rule, owning path, evidence, PASS/FAIL/BLOCKED/NOT RUN/N/A). Reclassify phone-only observations as narrow-width/200%-zoom checks and mark them N/A only when they do not reproduce at the supported desktop scope
- Checkpoint A - Decision intake (record the actual owner answer; never invent one): (a) canonical participant vocabulary for the inbox, Inject/notification and proposal concepts, expressed as Glossary terms or Release Terminology Profile labels; (b) the single Administration navigation model and admin landing destination; (c) multi-role chip content; (d) whether White Cell Simulation Settings embeds Operator controls or links to the Operator console; (e) whether the theme follows the operating-system preference by default; (f) the timer-extension unit; (g) the first-run visual direction for landing and Your Sessions. Unresolved items go to docs/design/impeccable/conflicts.md or candidate OPEN text in CONFLICT_REGISTER.md and their dependent rows stay BLOCKED
- Checkpoint B - Navigation and routing. IC-01: one Administration navigation; remove the Releases and Sessions Administration panel (LifecyclePortal AdministrationNavigation: heading stuck on "Members and Organization Roles", wrong "on this page" copy, input-like link boxes); one Workspaces entry landing on the first authorized destination; one admin side menu with canonical labels (Workforce access, Identity provider, Plugin operations, Deployment posture, Data policy), current-page indication and the same Publisher coverage everywhere. IC-02: one secondary-navigation pattern for Administration and Platform control plane. IC-03: Your Sessions keeps the Workspaces menu for people with other authorized destinations. IC-04: a Research-Analyst-only principal lands on or can navigate to Research reports. IC-05: an explicit not-found state for unknown paths including /admin/*, distinct from unauthorized and offline, with no false "Connection error" badge. IC-06: the legacy /?sessionId= link redirects to the canonical Session route. IC-07: the role chip represents the person's authority (the Admin persona no longer shows only "Operator"; the Publisher persona no longer only "Designer"). IC-08: one page-header pattern with exactly one H1, an object-specific title on Release and Session detail, status/count lines below the title and one breadcrumb. IC-09: the Operator console Staffing item has a stable target and current state. IC-10: a Publisher without Session access sees an authority-appropriate workspace label instead of "Releases and Sessions" plus "Sessions are not available"
- Checkpoint C - One owner per control (INV-019). IC-11: timer extension uses one unit, label and command presentation in the Operator console ("Extension seconds") and White Cell Game Controls ("Additional minutes"), with exact boundary conversion tests. IC-12: the read-only Operator adjudication queue and the participant adjudication review workflow have distinct names. IC-13: one status formatter for Session, Stage, Inject, adjudication and Plugin states (no "paused", "approved", "pending · stage_entry" or raw adjudication status). IC-14: White Cell Sessions, Participants and Export Data follow decision (d) with consistent chrome and unchanged server authorization. IC-15: one date/time formatter (no "11/9/2026, 8:45:29 AM" beside "Jan 15, 2026, 7:00 AM")
- Checkpoint D - Labels and vocabulary (REQ-063, REQ-071). IC-16: Studio menu labels equal page titles (Research / Research & Decisions; Access & readiness / Access; Role walkthrough / Role & Stage preview; Forms & Artifacts / Forms & Artifact Types) with one casing convention across all 27 sections and six groups. IC-17: route-inventory.md and code use the same Studio section names. IC-18: each participant navigation label equals the page or module title it opens (Scribe Actions / Strategic Actions; Responses / Communications; Notetaker Inbox / Communications; White Cell Injects / Notifications; Facilitator Received Proposals / Proposal negotiations). IC-19: a shared concept has one name, icon and relative order across Scribe, Facilitator, Notetaker and White Cell (Communications, Responses and Inbox; Received Proposals and Proposals; Notifications and Injects; Session Timeline, Tribe Street Journal and Verba positions). IC-20: empty states and generated text use authored labels with correct case and plurals ("No rfis yet.", "No verba ai population sentiments yet.", "1 installations · 1 bindings"). IC-21: no stacked duplicate titles (page title and first section, dialog title and inner heading, tab and card heading, the five stacked Take Action titles, the triple record-card title). IC-22: copy consistency ("Join a session" versus "Your Sessions", the all-caps code placeholder, one primary action per seat instead of "Join as" plus "Enter as")
- Checkpoint E - No technical detail as user labels (REQ-009, prohibited-patterns.md). IC-23 Studio: "Add DEC-42 reference Workflow", form identifiers, "OPEN-010" in intro copy, raw Stage kinds, white_cell, offline_capable and propose_effect, digests on the primary surface, MIME types and raw collaborator role keys. IC-24 Administration and Platform: replace free-text Plugin ID, comma-separated permissions, Scope reference and Target reference with server-validated selections of authorized named items; present PEM keys, SCIM and dead-letter states through labelled file selection and plain-language status with technical detail progressively disclosed; humanize plugin titles and the "institutional-archive" default. IC-25 Runtime and Operator: "Record JSON or CSV file", lifecycle and Stage version numbers, "stage_entry", "dead-lettered" and "0 / unlimited occupied · minimum 1"
- Checkpoint F - Layout and Teludens structure at the supported desktop scope. IC-26: one semantic badge colour map (Active, Open, Immutable, approved, Completed, With Team Facilitator). IC-27: remove card mosaics and nested cards (boxed search forms, fields boxed inside record cards, cards inside dialogs, fused search and list cards) in favour of hairline structure. IC-28: Operator console replaces decision-free statistic tiles, normalizes section spacing and uses one disclosure control per assignment row. IC-29: bound long work (Studio Advanced logic about 10,370px, Access about 5,286px, Communications about 4,581px, Operator console about 4,518px, Workforce access) and reduce Studio Forms' 29 nested scroll containers to one scroll owner per region. IC-30: no horizontal overflow or clipped context at 1024x768 and 200% zoom (Plugin operations heading, QA demo actions, runtime header wrapping and the truncated Session title, which must expose its full value). IC-31: runtime header controls have visible or consistently disclosed labels; no essential control is icon-only. IC-32: runtime side-menu group headings are stable and grouped per role, including White Cell's 13 items. IC-33: one icon per concept (calendar, inbox and bell reuse; Facilitator RFIs pencil versus Scribe calendar; Deck and Present). IC-34: one pattern each for empty states, record-detail disclosure, choice tiles with aligned controls, file selection, dialog close and expand controls. IC-35: the same records use the same review pattern and one record-navigation method across Scribe, Facilitator and White Cell. IC-36: local defects (Releases and Sessions policy banner alignment, White Cell Apply control spacing, Workforce role checkbox wrapping, Data policy layout aligned with other admin pages, Studio Overview placeholder title flash and uneven form grid, Platform Organization duplicate title and Active-versus-readiness wording). IC-37: the runtime shell carries the approved primary wordmark under the theme-safe contract; first-run imagery follows decision (g); the theme default follows decision (e)
- Checkpoint G - Release configuration and documentation. IC-38: the Crisis Response (Field Coordinator, Operations Lead) and Policy Negotiation (Delegate, Moderator) validation Releases define usable navigation through Studio or Release source. IC-39: Fractured Order label, order, icon and grouping changes ship as a new compiled Release version through publish and activation; existing pinned Releases keep their contracts. IC-40: update route-inventory.md (remove the Checkpoint A status; add /admin/identity, /platform/organizations, /platform/organizations/:id, /platform/administrators, the three invitation routes, /projects/:id/demo and the /studio/ no-Project state), participant-interfaces.md and the view-family briefs, and add briefs for the Platform control plane, invitation pages and landing page
- Checkpoint H - Regression guard and acceptance: create CMD-INTERFACE-CONSISTENCY (proposed npm run test:interface-consistency) from synthetic personas and the participant fixture approach. It fails on a menu label that differs from its page title, shared-concept name, icon or order drift across roles, more than one H1, visible UUIDs, enum keys or internal codes outside approved technical disclosures, horizontal overflow at 1024x768 or 200% zoom, more than one scroll owner per region, nested cards, a missing not-found state, or an authorized workspace unreachable through visible navigation. Verify CMD-PARTICIPANT-INTERFACES, rerun affected PS-830 and PS-840 gates on the changed candidate and complete the human role-by-role walkthrough

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Reuse the existing trusted OIDC, Organization Role, Session Role, Seat and RLS boundaries
- Return only server-authorized data and test cross-Organization, cross-Session and revoked access
- Use synthetic test identities and never expose secrets or protected content in screenshots or logs
- Navigation, role chips and menus derive from server-projected authority; hiding or showing a link never authorizes (INV-002). Prove that server denial is unchanged when a menu item is removed, that not-found does not reveal unauthorized objects, and that selections replacing ID fields list only authorized items and are revalidated server-side

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Preserve idempotent Commands, immutable Releases and Governing Release pins
- Make persistent mutations transactional and version-aware
- Test duplicate, stale, interrupted and concurrent user actions
- Unified Stage controls keep version-checked Commands and expected aggregate versions; timer unit conversion is exact and tested at boundaries

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- No new authentication, authorization or tenancy model, Organization Role, persistence schema, service or dependency; navigation never grants access
- Do not rewrite published Releases, Governing Release pins or running Sessions; changed interface configuration ships only as new Release versions through publication and activation
- Do not add phone or touch layouts; mobile/touch remains approved N/A
- Do not choose canonical vocabulary, theme default or administration information architecture by implementer preference; record and follow the owner decision
- Do not delete technical provenance needed for audit; move it behind progressive disclosure
- No visual redesign, refactor or dependency upgrade beyond the listed findings

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- PS-842-T01: every synthetic persona (visitor, Designer, Reviewer, Publisher, Operator, Admin, Research Analyst, Platform Administrator and Participant) reaches every authorized workspace through visible navigation; there is one Administration menu with consistent labels and current state; unknown routes show not-found distinct from unauthorized and offline; the legacy Session link redirects; server denial is unchanged
- PS-842-T02: in Studio and every Fractured Order participant role, each menu label equals the title it opens; shared concepts have one name, icon and relative order; status, date, plural and empty-state text come from single formatters with no raw enum keys
- PS-842-T03: no rendered route shows UUIDs, enum keys, internal reference codes, digests or MIME types as primary labels; free-text ID entry is replaced by server-validated authorized selections with negative tests
- PS-842-T04: every view family passes at 1440x900, 1024x768 and 200% zoom, in light and dark theme, with keyboard, reduced motion and forced colors: one H1, no horizontal overflow, one scroll owner per region, no nested cards or decision-free statistic rows, a stable runtime header and side menu, consistent badge semantics and zero automated WCAG 2.2 AA violations
- PS-842-T05: a named reviewer completes the role-by-role walkthrough for every persona and for Scribe, Facilitator, Notetaker and White Cell without hesitation attributable to an IC finding; every IC row is PASS, owner-approved N/A or BLOCKED on a recorded decision; affected PS-830 and PS-840 evidence is rerun on the changed candidate

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Interface consistency ledger docs/acceptance/PS-842-interface-consistency.md with every IC row closed, owner-approved N/A or BLOCKED on a recorded decision
- One navigation model, vocabulary, formatter set and Teludens layout grammar across all roles
- New Fractured Order and validation Release versions carrying corrected interface configuration
- Updated route inventory, participant interface record and view-family briefs, plus new briefs for the Platform control plane, invitations and landing
- CMD-INTERFACE-CONSISTENCY regression command and the human walkthrough script docs/design/user-test/PS-842-script.md with results

## Tests

Required test/evidence IDs: `PS-842-T01`, `PS-842-T02`, `PS-842-T03`, `PS-842-T04`, `PS-842-T05`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-TEST`, `CMD-PLATFORM-BUILD`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-VISUAL-QA`, `CMD-TELUDENS-AUDIT`, `CMD-PARTICIPANT-INTERFACES`, `CMD-INTERFACE-CONSISTENCY`, `CMD-GOLDEN-JOURNEY`, `CMD-GENERALIZATION`, `CMD-GAP-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

## Regression and quality gates

- Navigation and label changes never alter server authorization or Information Policy
- Published Releases and running Sessions keep their pinned interface contracts
- Changes made after PS-840 invalidate affected PS-830 golden-journey and PS-840 UAT evidence; rerun CMD-GOLDEN-JOURNEY, CMD-GENERALIZATION and affected product checks on the changed candidate instead of copying PASS labels
- Mobile/touch remains approved N/A; narrow-width findings are judged at the supported 1024 x 768 and 200% zoom desktop scope
- Synthetic data is clearly labeled
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the approved catalog Plenum primary wordmark with theme-safe presentation is used as platform branding; simulation content cannot replace platform identity

The approval gate is: Change-level acceptance requires every IC row PASS, owner-approved N/A or BLOCKED on a recorded owner decision, passing automated evidence, a completed human walkthrough and reruns of affected PS-830/PS-840 evidence. It does not approve production; PS-850 requires this task's rows to pass. A task may be implementation-complete without being release-approved.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed
- Update APPROVAL_IMPLEMENTATION_PROMPTBOOK.md only for execution/evidence links; preserve the task source and approval boundaries
- Record source/image/lockfile/schema/configuration/Release and environment identity; a changed candidate requires impact assessment and affected gate reruns, not copied PASS labels
- Return a checkpoint handoff with completed behavior, exact evidence, unresolved dependencies, candidate identity and the next safe step; do not collapse partial/internal/automated/human/final acceptance into one PASS
- Update docs/design/route-inventory.md, participant-interfaces.md, the view-family briefs and prohibited-patterns.md where a rule is clarified; record owner decisions in their authoritative place
- Record CMD-INTERFACE-CONSISTENCY and CMD-PARTICIPANT-INTERFACES verification in COMMAND_REGISTRY.md only from observed PASS evidence

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

## Commit

- Proposed branch: `feat/ps-842-reconcile-role-interface-consistency`
- Proposed subject: `feat(ui): reconcile role interface navigation and labels`
- Expected migrations: none
- Expected API/contract IDs: `design-system-v1`, `visual-qa-matrix-v1`

Proposed body:

```text
Why:
- The 2026-11-09 role-by-role audit found duplicate navigation, mismatched labels, exposed internal identifiers and inconsistent layouts across roles.
What:
- One navigation model, vocabulary, formatter set and Teludens layout grammar for every persona and Fractured Order participant role.
Verification:
- PS-842-T01 through T05, CMD-INTERFACE-CONSISTENCY, registered UI gates and the task user-test script.
Compatibility / migrations:
- No schema change expected. Interface configuration changes ship as new Release versions; published Releases and running Sessions keep their pins.
Risks / follow-up:
- Rerun affected PS-830/PS-840 evidence; owner decisions not yet made keep their rows BLOCKED.
Refs: PS-842, REQ-063, REQ-071, INV-019
```

Proposed PR description:

Summary: Every role meets one navigation model, one vocabulary and one Teludens layout grammar, with no internal identifiers shown as labels. Risks: high workflow, labelling and authorization-presentation regressions across all roles. Migration: none expected; corrected interface configuration ships as new Release versions. Evidence: interface consistency ledger, CMD-INTERFACE-CONSISTENCY, registered UI gates, screenshots and the task user-test script. Rollback: revert the bounded UI slice and keep prior Release versions active.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN for every validation reference; exact command-output or artifact references; modified files; demonstrated behavior; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes; An owner decision on vocabulary, administration navigation, theme default or White Cell control placement changes.
