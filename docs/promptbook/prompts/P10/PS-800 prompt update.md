# PS-800 - Complete Teludens conformance and every UI state

## ID / title / goal / user outcome / risk

- ID: `PS-800`
- Title: Complete Teludens conformance and every UI state
- Goal: Replace proof-oriented long-scroll screens with a coherent, cohesive, intuitive professional workstation and verify every supported viewport, input and state. Use the Impeccable skill as the design-discipline and review method defined in "Design quality method" below.
- User outcome: Users can easily understand, navigate and complete complex work efficiently on desktop and constrained displays with keyboard, pointer, touch and assistive technology.
- Risk: **HIGH**
- Metadata: `source_evidence` is populated; `prerequisites_verified: false`; `ready_to_execute: false`. Preflight must verify prerequisites and record the result; do not treat these flags as a reason to skip preflight.

## Quality bar (read first)

The product is a professional workstation used for long, high-stakes, complex sessions. It must feel like one deliberately designed instrument, not a collection of generated screens. The measure of success is:

1. **Coherent**: every view is built from the same Teludens primitives, tokens, spatial grammar and motion physics. A user moving between Studio, Runtime, Operator, Admin, report and replay never feels they changed products.
2. **Cohesive**: the same concept always looks, sits and behaves the same way (selection, status, destructive actions, pending state, errors, empty states, inspectors, command bars).
3. **Intuitive**: a first-time user in a supported role can identify where they are, what they are working on, what mode they are in, what they can do next, and what just happened, and can complete their critical journeys correctly on the first attempt, under live-Session time pressure, without training, documentation or internal identifiers. "Intuitiveness contract" and "Forms, dialogs and messages" define this operationally, and the user test measures it.
4. **Restrained**: visual weight is spent only on hierarchy and decisions. Density is appropriate for expert work. Nothing is decorative.

When a choice is uncertain, prefer the quieter, more consistent, more legible option. Novelty is never a goal of this task.

## Requirements and invariants

Product IDs: `REQ-009`, `REQ-063`, `REQ-064`, `REQ-071`, `INV-019`.

Requirement-row authority: `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — rows `REQ-009`, `REQ-063`, `REQ-064`, `REQ-071`, `INV-019`. Canonical terminology authority: `docs/corpus/03_Governance_and_Reconciliation/GLOSSARY_AND_CROSSWALK_v1.0.md` — entries for every domain term used by this task.

Authoritative sources and sections:

- `docs/corpus/02_Updated_Architecture/04_DESIGN_STUDIO_SPECIFICATION_v1.3.md` — 04 Studio sections 2 and 3
- `docs/corpus/02_Updated_Architecture/06_DATA_SECURITY_REPORTING_v1.3.md` — 06 Data section 17
- `docs/corpus/01_Product_and_PRD/01_PRD_v0.7.md` — PRD section 6.9
- `references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md` — Teludens Design Language sections 0 through 13
- `references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md` — Teludens Spatial Grammar sections 1 through 14
- `references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md` — Teludens Experience Physics sections 1 through 15
- `references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md` — Teludens Reference Slice sections 1 through 20

Observed source evidence:

- apps/studio/src/App.tsx
- apps/runtime-web/src/App.tsx
- apps/server/src/http/runtime-http.ts
- references/teludens-design-system-catalog/README.md
- references/teludens-design-system-catalog/docs/TELUDENS_DESIGN_LANGUAGE.md
- references/teludens-design-system-catalog/docs/SPATIAL_GRAMMAR.md
- references/teludens-design-system-catalog/docs/EXPERIENCE_PHYSICS.md
- references/teludens-design-system-catalog/docs/PLENUM_REFERENCE_SLICE.md
- references/teludens-design-system-catalog/docs/TELUDENS_TOKENS.json
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Dark.png
- references/teludens-design-system-catalog/assets/logos/Plenum. Wordmark Light.png

Authority order is Decision Register and Glossary, then PRD, Canon, Platform, Schema, Contracts, capability specifications, Approved Data Model/Sync, and finally the observed slice. Cite IDs; do not restate decision text. Decision-status authority is `docs/corpus/03_Governance_and_Reconciliation/DECISION_REGISTER_v1.0.md`. The following dependencies still require named specialist sign-off or resolution and must remain labeled: none.

**Design authority order** (applies to every visual and interaction decision): Teludens catalog documents and `TELUDENS_TOKENS.json` > Plenum Reference Slice > 04 Studio sections 2 and 3 > this prompt > Impeccable guidance. Impeccable is a method and a critic, never a source of new tokens, colors, fonts, motion curves or components. When an Impeccable recommendation conflicts with Teludens, follow Teludens, do not apply the recommendation, and record the conflict in `docs/design/impeccable/conflicts.md`. If Teludens is silent or self-contradictory on a point that blocks work, add a candidate OPEN item to `CONFLICT_REGISTER.md` and choose the most conservative option consistent with existing tokens.

## Prerequisites

Task prerequisites: `PS-760`, `PS-790`.

Before editing, read Roadmap section 16, `PROJECT_STATE.md`, this prompt, the requirement rows, the smallest governing sections, Glossary terms, contracts, and tests. Check `git status --short`, current versions, and prerequisite evidence. Stop on a dirty overlap or failed prerequisite; preserve unrelated work. Required git state: no unreviewed overlapping changes and no unresolved failed gate. Do not create a commit unless the repository workflow or user explicitly authorizes it.

Run every Node/npm command with Node 24 or newer. Record `node --version` at preflight. If the system default is older, select a verified Node 24+ runtime before validation; older-runtime results are diagnostic only and cannot satisfy a task gate. If Node 24+ is unavailable, mark affected commands BLOCKED and do not claim completion.

**Impeccable preflight:**

- Confirm the `impeccable` skill is available in this Codex environment (it appears in the skills list and can be invoked as `$impeccable`). If it is not available, STOP and report BLOCKED; do not imitate the skill from memory.
- Read the installed skill's `SKILL.md` and record its version and actual command list in `docs/design/impeccable/README.md`. Commands named in this prompt are intent labels. If a named command does not exist in the installed version, use the documented equivalent and record the mapping. Never invent a command.
- Determine whether the skill's deterministic anti-pattern detector is available in this environment. If it is, record how it is invoked. If it is not, record that and continue; all detector-based gates become NOT RUN, never PASS.

## Inspect before editing

- The PS-700 Teludens foundation, catalog-source diff and component adoption report
- All uses of logos, product names, raw visual values and legacy simulation-specific styling
- Universal design standard and existing CSS tokens
- All screen families and screenshots
- Long-scroll Studio and operator views
- Browser bundle warnings and interaction performance

Read callers, tests, fixtures, configuration, exports, migrations, and public contracts that touch the change. Verify real paths before creating any unobserved path.

## Allowed scope and files

Allowed behavior scope:

- Catalog conformance across Platform, Studio, Runtime, Fractured Order, Operator, Admin, reporting and replay surfaces
- Project-specific design brief, layout, components, interaction and motion contracts
- Shared shell, navigation, command bars, inspectors, dialogs and notifications
- Every loading/empty/error/offline/stale/conflict/disabled/success state
- Responsive, zoom, reduced-motion, forced-colors and performance QA

Expected paths are discovery targets, not permission to invent absent structure:

- apps/ui/ or established shared component location
- apps/*/src/styles.css
- docs/design/
- tests/visual/
- tests/e2e/product/

Do not refactor unrelated code, upgrade unrelated dependencies, or replace the reference slice wholesale.

## Design quality method (Impeccable)

Impeccable is used in three roles: to load design context, to shape each view family before code, and to critique, audit and polish each view family after code. Invoke commands as `$impeccable <command> <target>`, where `<target>` is the view family or component being worked on. Save every report the skill produces under `docs/design/impeccable/<view-family>/` with a `before-` or `after-` prefix.

### 1. Context (once)

Run the skill's design-context setup command (`init`, or `teach` in older versions). When it asks for product and design context, answer from the repository, not from invention:

- Product context comes from PRD section 6.9 and the requirement rows above. Audience: trained professionals running and designing complex simulation Sessions under time pressure. Product lane: professional tool, not marketing or consumer.
- Design context (colors, type, spacing, radii, elevation, motion, components, voice) comes only from the Teludens documents and `TELUDENS_TOKENS.json`. Where the skill would write its own design file, make it a summary that cites the Teludens sources and adds nothing they do not contain.
- Anti-references: the project-specific anti-patterns listed in "Prohibited patterns" below.

### 2. Shape (before any code, per view family)

For each view family, run `shape` and produce `docs/design/view-families/<family>.md` containing:

- the roles that use the view and the critical journeys from `docs/design/journeys.md` that pass through it, with the user's primary jobs in priority order
- an orientation statement: how the view answers where am I, what am I working on, what mode am I in, who am I acting as, and what is the system state, without interaction
- every form, dialog, confirmation and message the view needs, each classified under "Forms, dialogs and messages"
- a planned cognitive walkthrough of each critical journey through the view, saved under `docs/design/walkthroughs/`
- the region layout using the Teludens Spatial Grammar (which region owns which content, which region owns scroll, what persists across navigation)
- the components used, each mapped to a PS-700 Teludens primitive; any primitive gap is listed as a gap, not silently created
- the complete state list for the family (see "State inventory")
- keyboard model: focus order, shortcuts, command bar entries, escape and return behavior
- behavior at each tier of the viewport matrix

**CHECKPOINT A:** after the route inventory, roles and critical journeys, state matrix, draft motion inventory and all view-family briefs exist, stop and report a summary with links to the briefs. Do not begin implementation until the user replies to continue, unless the user has already instructed you in this session to proceed without checkpoints.

### 3. Baseline (before changing a family)

Run `critique` and `audit` on the current implementation of the family, run the detector if available, and capture baseline screenshots for the viewport matrix. These are the `before-` evidence.

### 4. Build

Implement the family from its brief, in this order, using the matching Impeccable command where one exists in the installed version:

1. Structure and region layout, bounded scroll ownership (`arrange`)
2. Replace one-off UI with Teludens primitives and semantic tokens (`normalize`; `extract` only to promote a pattern into the shared component location when it appears in two or more families)
3. Typography hierarchy using only Teludens type tokens (`typeset`)
4. Labels, microcopy, forms, dialogs, confirmations, error, success and empty-state wording, removal of internal identifiers from user-facing text (`clarify`; `onboard` only for first-use empty states and in-place term definitions, never for tours or modal walkthroughs)
5. Every state, failure path, long content, disconnection and edge case (`harden`)
6. Viewport, zoom, touch and constrained-height behavior (`adapt`)
7. Motion and loading behavior only as listed in the motion inventory, following "Motion and loading contract" (`animate` may implement inventory rows only; it may not add motion that has no row)
8. Remove anything that does not serve a primary job (`distill`, and `quieter` where a view is visually louder than its peers)

Do not use commands whose purpose is to increase visual intensity or novelty (for example `bolder`, `colorize`, `delight`, `overdrive`) unless the user explicitly approves a named use.

### 5. Close (per family)

Run `critique`, `audit` and the detector again, capture `after-` screenshots, then run `polish`. Then **open and look at every after-screenshot yourself** and write a short observation per screenshot in `docs/design/impeccable/<view-family>/review.md`: what is the first thing the eye lands on, is it the right thing, is anything misaligned, cramped, truncated, inconsistent with sibling families, or ambiguous. Generating screenshots without reviewing them does not count as visual QA. Fix what the review finds and re-capture.

Then complete the intuitiveness checks for the family:

- **Cold read:** for each after-screenshot, write, from the screenshot alone and before looking at the brief, what the view is for, where the user is, what mode they are in, what object they are working on, what its state is, and what the primary next action is. Compare with the brief. Any mismatch is a defect.
- **Cognitive walkthrough:** run each critical journey through the implemented UI step by step, from screenshots of each step. At every step, answer four questions in `docs/design/walkthroughs/<journey>.md`:
  1. Will the user be trying to do the right thing here?
  2. Will they notice that the correct control is available?
  3. Will they connect that control with what they are trying to do?
  4. After acting, will they see that they made progress?

  Any "no" is a defect. Record the step count for each journey; an increase over the brief's plan needs a stated reason.
- **Blind attempt (supplementary):** if the environment allows a separate agent session with no repository access, give it only the role description, the journey goal and the running application. Record where it hesitates, backtracks or fails. This is supplementary evidence, never a substitute for the user test.

### 6. Cross-family consistency pass

After all families are closed, run `critique` across the whole product as one system and compare families side by side at the same viewport. Fix any concept that looks or behaves differently between families.

## Workstation contract

Unless the Spatial Grammar or Reference Slice specifies otherwise (in which case they govern and this list yields):

- One persistent shell across all surfaces, carrying only the catalog Plenum wordmark (dark or light to match theme) as platform identity. Simulation content, including Fractured Order, appears inside the work region and never replaces or restyles the shell.
- A persistent context indicator showing, in human terms, the Organization, Session, Governing Release and Active Role Context the user is acting in.
- Exactly one scroll owner per region. The document body does not scroll in workstation views. Long lists and logs virtualize or paginate inside their region.
- Selection, filters, open inspector and active tab are preserved across navigation and reflected in the URL where the route model allows, so back, forward and reload restore context.
- Every action reachable by pointer is reachable by keyboard and listed in the command bar where the command bar exists.
- Users select things by name, search or picker; no essential workflow requires typing or reading a UUID or other internal identifier.

## Intuitiveness contract

Intuitive means a user in a supported role can complete their critical journeys correctly on the first attempt, without instruction, under the time pressure of a live Session, and can recover from mistakes without help. This section turns that into requirements that can be built and verified. The user test under "Regression and quality gates" provides the human evidence.

### Roles and critical journeys

- Create `docs/design/journeys.md`. For each role the product serves, list its critical journeys: the tasks the role must complete for the product to be usable. Give each journey a start state, end state, success condition and frequency (every Session, occasionally, rarely).
- Derive roles and journeys from PRD section 6.9, the requirement rows, and the Glossary entries for Organization Role and Session Role. Do not invent roles or journeys. If the PRD does not define the journeys for a role, list the gap and add a candidate OPEN item to `CONFLICT_REGISTER.md`.
- Journeys drive the briefs, walkthroughs, tests and user test.

### Orientation

Every view answers these questions without any interaction:

- **Where am I:** the view name, and its place in navigation, with the current location marked in navigation (`aria-current`).
- **What am I working on:** the object's name and type in the view header, never its identifier.
- **What mode am I in:** each mode the Glossary defines (for example draft authoring, live Session, replay or read-only report) is unmistakable at a glance through a persistent mode indicator in a fixed location. Consequential actions name the mode in their label or confirmation. Acting in the wrong mode is the most dangerous error in this product; treat any design that makes it plausible as a top-severity defect.
- **Who am I acting as:** the Active Role Context and Seat where applicable. Switching role is an explicit action, and the change is reflected everywhere immediately.
- **What is the system state:** connection, synchronization status, and the Session phase and clock where applicable, in a fixed location, readable at a glance.

### Wayfinding and information scent

- Navigation labels name user goals or domain objects in Glossary terms, never internal module or application names.
- Navigation shows only destinations the role can use; unauthorized destinations are omitted, following INV-002, not shown disabled.
- Nested objects show their path (breadcrumb or equivalent). Every view has a URL that restores it on reload.
- Wherever one object references another (for example a Session's Governing Release), the reference is a link to that object.
- Search and the command bar find objects by name and actions by verb. Terms the Glossary crosswalk lists as legacy or noncanonical are accepted as search input and resolve to the canonical term, so users who use an old name still find the right thing.

### Recognition over recall

- Never require users to remember a value from another view. Show the context they need beside the task (inspector, summary or pinned reference).
- Objects are chosen with searchable pickers that show recent and relevant items. Free-text entry is only for genuinely free values.
- Fields with a sensible default are prefilled with the safest common choice.
- Controls that change a value show its current value. Consequences are shown before commit, for example a summary of changes before publishing a Release.

### Focus and progressive disclosure

- Each region has at most one primary action. It is visually dominant and sits in the same position within that region type in every view family.
- Controls used in critical journeys are visible. Infrequent or advanced options are one deliberate step away and labelled by what they contain. Never hide something a critical journey needs.
- A view shows what the role needs for its current job. Secondary information belongs in the inspector, not stacked down the page.

### Affordance and consistency

- Interactive elements look interactive and static elements do not. Links, buttons and editable fields each have one visual treatment across the product.
- The same action has the same name, position and shortcut everywhere.
- Keep one keyboard shortcut registry. It has no conflicts with browser or assistive-technology shortcuts. Every shortcut appears in its control's tooltip and in the command bar, and a shortcut reference is reachable from the command bar.
- Icon-only controls are allowed only for a declared allowlist of universally understood actions (for example close, search, more). Each has a tooltip and an accessible name. Every other control has a visible text label.

### Feedback and system status

- Every action shows a visual response within one frame and reports its outcome where the user is looking, inline and near the control, not only in a distant notification.
- Long or background work shows its status in place and in one consistent status location. A user can leave and return to find the outcome.

### Interruption and resumption

- Facilitators and operators are interrupted constantly. Reload, reconnect, or returning from another view restores exact context: view, selection, filters, scroll position within each region, and unsent input.
- After a reconnect, changes made by others while the user was disconnected are summarized in place and marked, so the user can catch up without searching.

### Glanceability under time pressure

- In Runtime and Operator views, everything a role must monitor continuously (for example phase, clock, decisions awaiting the user, and alerts requiring action) is visible without scrolling or opening anything, at every supported viewport tier.
- Status is conveyed by position, shape and text as well as color, never by color alone.
- Items that require the user's action are visually distinct from informational items, and can be counted at a glance.

### Learnability without training

- No product tours, coach marks or modal walkthroughs.
- First-use empty states say in one or two sentences what belongs there and offer the action that creates it.
- Glossary terms a role may not know have their Glossary definition available in place on hover and focus.
- Contextual help links to the relevant user documentation where it exists.

### Language

- All UI text uses Glossary canonical terms. Terms the crosswalk marks as legacy or noncanonical never appear in UI text.
- Use sentence case. Buttons are a verb plus an object. Use one tense consistently. No implementation vocabulary (for example "payload", "entity", "job", "record ID").
- Dates, times and durations go through one shared formatter, show the time zone where it matters, and treat server time as authoritative. Numbers use consistent units and precision.

## Forms, dialogs and messages

These rules apply in every view family. Where the Teludens catalog specifies a form, dialog or message pattern, it governs and this section yields.

### Where a form lives

Choose the container by the task, not by convenience:

- **Edit in place** for a single value on a visible object (rename, change a status, adjust a number).
- **Inspector or side panel** for editing properties of a selected object while keeping it, and its context, in view. This is the default for contextual editing.
- **Page or work-region view** for creating or editing complex objects, long forms, anything that needs reference to other content, and any multi-step flow. Long forms get section navigation and save progress according to REQ-043.
- **Dialog** only for a short, self-contained task that must be completed or cancelled before continuing, with a few fields that need no reference to content behind the dialog.

Never put a multi-step wizard, a long form, or a form that needs content behind it inside a dialog.

### Form design

- One column. Labels are always visible and are never replaced by placeholder text. Help text sits with its field.
- Mark required or optional fields consistently across the product, marking whichever is the minority.
- Group related fields under short headings, ordered the way the user thinks about the task, not the way the data model is stored.
- Field width suggests the expected length of input. Units are shown next to the field.
- Use the correct input types, `autocomplete` values and `inputmode`. Accept reasonable formats (spaces, case, separators) and normalize them rather than rejecting them.
- Tab order follows visual order. Enter submits single-line forms where that is the convention.

### Validation

- Validate format when the user leaves a field, and completeness when they submit. Never show errors on fields the user has not touched yet, and never validate on every keystroke except where live feedback helps (for example a character limit).
- Each field error appears next to its field, says what is wrong and how to fix it, and is linked with `aria-describedby` and `aria-invalid`.
- When a submit fails validation, show an error summary at the top of the form listing each error as a link to its field, and move focus to the summary.
- Server validation errors from the 09 section 8 error envelope are mapped to their fields. Errors that belong to no field appear in the summary.
- Never clear or reset user input because of an error.

### Submission

- The submit button names the outcome (for example "Create Session", "Publish Release"), never "Submit" or "OK".
- Do not disable the submit button to signal invalid input; let the user submit and see what is missing. Disable it only while a submission is in flight, and show that state on the button.
- Every submission is an idempotent Command, so a double click or retry cannot create duplicates.
- On success, show the result itself where possible: open or highlight the created or changed object.
- When the user tries to leave a form with unsaved input, warn only if input would actually be lost, and offer to keep editing. Follow REQ-043 for what counts as saved.

### Dialogs

- Only one dialog at a time. A dialog never opens another dialog.
- Use the Teludens dialog primitive (or native `<dialog>` underneath it) with the background inert, focus contained, and focus returned to the control that opened it.
- Initial focus goes to the first field. In a destructive confirmation it goes to the safe choice, never the destructive button.
- Escape closes the dialog, unless that would discard input; in that case, ask first.
- The title names the task. The body scrolls inside the dialog while the title and actions stay visible.
- Button order and placement follow Teludens and are the same in every dialog. The primary button names the outcome. Destructive actions use the destructive treatment and are never the default.
- At narrow viewport tiers, dialogs become full-screen sheets according to the Spatial Grammar.
- Do not use dialogs to show information (use the inspector), to report success, or to show an error that belongs to a field or region.

### Confirmations

Decide by consequence:

| Action | Treatment |
|---|---|
| Routine and reversible | No confirmation |
| Reversible but disruptive (for example removing an item from a draft) | Act immediately and offer undo, where the domain model supports reversal. Do not invent compensating Commands; where reversal is not supported, treat it as the next row |
| Irreversible or high-consequence (for example publishing an immutable Release, advancing a live Session phase, revoking access) | Review step before commit |
| Irreversible with wide impact (for example ending a live Session for every participant, deleting Organization data) | Review step plus typing the object's name to confirm |

A review step or confirmation:

- names the action and the object in its title
- states the consequence, who is affected, the mode it happens in, and whether it can be undone
- uses a primary button that names the action (for example "Publish Release"), and a secondary button such as "Cancel" or "Keep editing"
- never asks "Are you sure?" and never uses Yes, No or OK as labels

If a confirmation appears every time in a routine journey, users will learn to click through it. Treat that as a design defect and redesign the flow.

### Error messages

Each error appears at the level where it occurred:

- **Field:** inline next to the field
- **Form:** in the form's error summary
- **Region:** in the region's error state, with retry, while the rest of the view keeps working
- **View or connection:** in the fixed system-status location, with what still works and what to do
- **Background operation:** in the status location and in the notification history

Every error message:

- says what happened in plain language and Glossary terms, why if known and safe to disclose, and what to do next
- offers the next action as a control (retry, correct, reload, or who to contact)
- keeps the user's input and context
- may include the error envelope's reference code as secondary, copyable text for support, never as the message itself
- never shows raw HTTP status codes, stack traces, JSON, enum keys or internal identifiers
- uses a neutral tone: no blame, no humor, no "Oops", no exclamation marks, no repeated apologies
- stays until it is resolved or dismissed, and never auto-dismisses

For authorization failures, never reveal whether an unauthorized object exists (INV-002); say that it is not available to the current role.

Use `role="alert"` only for errors that need immediate attention. Field errors are announced through their `aria-describedby` link. Severity is shown by icon, text label and color together.

Where an operation is retried, show the retry state, and retry only safe transient failures as "Concurrency/idempotency/versions" requires.

### Success, warning and information messages

- Prefer showing the result over announcing it. If the result is visible, a separate success message is usually unnecessary.
- When a success message is needed, show it inline near the action. Use a notification only for background work, and include undo where it applies.
- No celebratory language.
- Warnings and information messages use the Teludens semantic severity tokens. Each severity has one icon, one label style and one placement rule across the product.

### Notifications

- Notifications are for events the user did not just cause, or outcomes of background work.
- Every notification is also kept in a notification history reachable from the shell, so nothing important exists only in a transient toast.

## Prohibited patterns (project-specific anti-slop list)

Treat each of these as a defect. Use this list together with Impeccable's own anti-patterns.

- Card mosaics: every section wrapped in a bordered, rounded, shadowed card; cards nested inside cards
- Rows of KPI tiles or statistics that are not tied to a decision the user makes on that view
- Gradients, glows, glassmorphism, decorative blobs, background illustrations, or any color or effect not defined in `TELUDENS_TOKENS.json`
- Fonts, sizes, weights, radii, shadows, spacing or durations not drawn from Teludens tokens
- An icon on every heading or list item; emojis anywhere; icons without accessible names
- Marketing patterns inside the tool: hero sections, centered large headings, welcome banners, celebratory copy, exclamation marks, "Oops"
- Vague action labels ("Submit", "OK", "Continue", "Click here") where a verb plus object is possible
- Uniform visual weight: every block the same size, padding and emphasis so nothing reads as primary
- Low-contrast text, including gray text on tinted backgrounds
- Modals used for content that belongs in the inspector or the page; modal stacks; toasts as the only channel for an error the user must act on
- Bounce, elastic or decorative motion; animation on hover for static content; motion that delays task completion
- Spinners or skeletons with no indication of what is loading; empty states that offer no next action
- Placeholder or lorem content, invented sample data in production views, raw IDs or enum keys shown to users
- Truncated values with no way to see the full value
- Competing scroll containers, scroll traps, horizontal page scroll

## State inventory

For every view family, define, implement and screenshot each applicable state. Mark inapplicable states with a reason in the brief.

- loading (initial and refreshing in place without layout shift)
- empty: first use, and no results for the current filter (different messages and actions)
- error: recoverable (with retry or correction) and non-recoverable (with what to do next)
- offline / disconnected, and reconnecting
- stale (data older than the server's authoritative state) with a refresh path
- conflict (concurrent edit or version mismatch) with resolution options
- disabled (with the reason visible or available on focus)
- unauthorized and revoked access (rendered from server omission, not from client hiding)
- partial failure (some items succeeded, some failed) with per-item outcome
- success / confirmed
- long content: long names, long text, many rows, many participants
- REQ-043 Studio distinctions where Studio mutations occur: saved on this device, synchronized, validation required, published
- Runtime `local_pending` versus the canonical server outcomes in Synchronization Protocol section 3, where Runtime mutations occur

Record the full matrix (view family × state × evidence path) in `docs/design/state-inventory.md`.

## Viewport, zoom and input matrix

If the Teludens documents or 04 Studio declare supported viewports, those govern; record the source. Otherwise use this default and add a candidate OPEN item to `CONFLICT_REGISTER.md` noting the matrix was not declared:

- 1920×1080, 1440×900, 1280×720 (primary desktop)
- 1280×600 (constrained height)
- 1024×768 and 768×1024 (constrained displays and tablet, touch)
- 390×844 (narrow; declare per family whether it is fully supported, read-only, or unsupported with a clear message)
- 200% browser zoom at 1280×720
- 320 CSS px reflow without loss of content or function (WCAG 2.2 reflow)
- light and dark themes, `prefers-reduced-motion: reduce`, `forced-colors: active`
- keyboard only, pointer, touch, and screen reader (at least one desktop screen reader journey per critical workflow)

## Motion and loading contract

Teludens Experience Physics sections 1 through 15 govern all motion. This section defines how the task applies them. Where Experience Physics is more specific than this section, it governs and this section yields. Where Experience Physics is silent on a value this section needs, use the default given here, record its source as `PS-800 default` in the motion inventory, and add a candidate OPEN item to `CONFLICT_REGISTER.md`.

### Principles

- Motion exists only to explain a change of place or state, confirm an action, or direct attention to something the user must act on. Motion that does none of these is a defect.
- The shell, primary navigation and context indicator never animate after first load. Only the work region, inspector, dialogs, notifications and in-place state changes may move.
- Meaning is never carried by motion alone. Every animated change also has a static visual or textual indication that remains after the motion ends.
- Motion never delays a state change. The underlying state is committed and usable before any animation of it finishes.

### Tokens

- Every duration, delay and easing comes from a Teludens motion token. If the catalog lacks a needed token, list it as a gap in the motion inventory; do not add a literal value.
- Default bands where Experience Physics is silent: direct feedback 100–150ms; inspectors, drawers, dialogs and region changes 200–250ms; ceiling 400ms for any motion that is not a signature moment; signature moments up to 800ms.
- Exits are shorter than entrances. Entering motion eases out; exiting motion eases in. No overshoot, spring bounce or elastic easing.
- No literal `ms` or `s` durations, `cubic-bezier()`, `steps()` or JavaScript timing values for animation exist outside token source files. Enforce this through `CMD-TELUDENS-AUDIT` where its registered contract covers motion values; if it does not, extend that contract at its authoritative owner and record the change.

### Motion inventory

Create `docs/design/motion-inventory.md`. Motion that has no inventory row is not permitted. One row per motion, with these columns:

- ID (`MOT-###`)
- view family or shared component
- trigger
- element
- animated properties
- duration, easing and delay tokens
- purpose: `explain`, `confirm` or `attend`
- reduced-motion equivalent
- forced-colors behavior
- governing Experience Physics section, or `PS-800 default`
- evidence path (test, recording)

A draft inventory is part of Checkpoint A. Rows may be added during implementation only with a stated purpose and an Experience Physics citation.

### Spatial continuity

- Inspectors and drawers move along the axis of the edge they are attached to. Detail views open from, or consistently beside, the item that opened them, the same way in every view family.
- Navigation between view families is at most a cross-fade of the work region. No sliding, zooming or full-page transitions.
- Same-document View Transitions may be used as progressive enhancement only: feature-detected, with an identical end state when unsupported.
- Focus moves instantly. Focus indicators never animate position.
- Animate only `transform` and `opacity`. Changes of size or position use FLIP or an equivalent technique; never animate `width`, `height`, `top`, `left`, `margin` or `padding`. Apply `will-change` only for the duration of an active animation.

### Loading

Apply these thresholds by expected wait, using motion tokens for the delay and minimum-visible values:

- Under about 100ms: show no indicator.
- 100ms to 1s: show no indicator for the first 200ms. Once shown, keep it visible at least 400ms. Place it inline at the affected control or region.
- 1s to 10s: show a skeleton matching the final layout geometry, or an inline indicator that names what is loading.
- Over 10s: show determinate progress where the server reports progress, named steps, and cancel where the operation is cancellable. The rest of the workstation remains usable.

And in every case:

- Refreshing keeps existing content visible with a refreshing indicator. A populated region is never blanked to reload.
- Loading is scoped to the smallest region that is waiting. Place React Suspense boundaries and transitions per region, never around the whole view.
- Space for arriving content is reserved. Data arrival causes no layout shift beyond the budget below.
- Skeleton shimmer is subtle, uses motion tokens, and is static under reduced motion.
- A loading region carries `aria-busy`. Completion and failure of any operation longer than 1s is announced through a polite live region; use an assertive announcement only when the user must act.
- No artificial delays exist anywhere.

### Pending, optimistic and rejected mutations

- Each client mutation state has a distinct static visual treatment and a text label, recorded in `docs/design/state-inventory.md`. This applies to the REQ-043 Studio distinctions (saved on this device, synchronized, validation required, published) and to Runtime `local_pending` versus the canonical server outcomes in Synchronization Protocol section 3.
- Pending to confirmed settles in place, with no movement beyond a token fade.
- Rejected or conflicting mutations revert in place, remain visible, and show the reason and the recovery action next to the item. They never disappear silently, and a toast is never the only channel.
- Retry reuses the original Command idempotency key, as required by "Concurrency/idempotency/versions".

### Live updates from other participants

- Never insert, remove, reorder or resize content under the pointer, the focused element, an open menu or an active text selection. While the user is interacting with a list or table, buffer incoming changes behind an announced "N updates" control that applies them on request.
- New or changed items are marked by a highlight that fades over a token duration of about 1s. They do not slide in.
- Numeric values that inform decisions change instantly with a brief highlight. Never count up or tween them.
- Screen reader announcements of remote changes are batched and throttled so they do not interrupt the user's own work.

### Signature moments

Only these events may use choreographed sequences: turn or phase advance, inject arrival, adjudication outcome reveal, and Release publication. Others require user approval recorded as an inventory row. Each signature moment:

- never blocks input and never delays the state change it presents
- can be skipped by any key press or click
- has a reduced-motion version
- states its meaning in text
- plays once per event per user, and does not replay on reload or reconnect. The replay surface may play it at the user's chosen speed, subject to reduced motion.

Timers and countdowns show urgency through token color or weight changes and at most one pulse at each declared threshold. No continuous pulsing.

### Feedback and notifications

- Pressed, toggled and selected states appear within one frame. No delay token applies to direct feedback.
- Drag and drop shows valid targets when the drag starts. An invalid drop returns the item to its origin.
- Hover never moves or scales static content.
- Notifications:
  - enter from one consistent location
  - show at most three at once, then collapse into a count
  - pause auto-dismiss while hovered or focused
  - announce through a live region
  - never auto-dismiss an error that requires action

### Accessibility

- Under `prefers-reduced-motion: reduce`, every movement is replaced by an opacity change within the feedback band or by an instant change, as declared in its inventory row. Feedback is replaced, never removed.
- Under `forced-colors: active`, every animated state change remains perceivable through borders, outlines or system colors.
- Nothing flashes more than three times in any one second (WCAG 2.3.1).
- Any non-essential content that moves or auto-updates for more than five seconds can be paused, stopped or hidden (WCAG 2.2.2).

### Prohibited motion

In addition to the motion items in "Prohibited patterns", treat each of these as a defect:

- fade-up or staggered entrance on mount
- hover scale or lift on cards or rows
- page-level transitions
- parallax
- animated gradients
- shimmer outside loading skeletons
- continuous pulsing
- spinners on otherwise blank regions
- motion used to fill time

### Smoothness

Loading, transitions, scrolling, dragging and live updates must feel continuous and immediate. The user should never see a jump, a stutter, a flash or a snap. These are engineering requirements, not polish.

Rendering path:

- Run inventoried motion on the compositor. Use CSS transitions or the Web Animations API. Never drive animation with `setTimeout`, `setInterval` or per-frame React state updates. Use `requestAnimationFrame` only for pointer-following interactions such as drag and resize, and only to write `transform`.
- Make animations time-based so they stay correct on 60Hz, 120Hz and variable-refresh displays.
- Never animate `box-shadow`, `filter`, `backdrop-filter`, `clip-path` or blur. To change a shadow, fade the opacity of a pre-rendered shadow layer.
- Keep the number of simultaneously promoted layers small, and remove promotion when motion ends.
- In any code path that runs during motion, batch DOM reads before writes, so there is no forced synchronous layout.

Main-thread protection:

- Do no rendering, data parsing or layout work in the same frames as a running transition. Mark non-urgent updates as React transitions, and start heavy work only after the animation's `finished` promise resolves or the browser is idle.
- Split any task over 50ms that can run during interaction into chunks that yield to the browser.
- Subscribe live updates per region, so a remote change re-renders only what changed, never the whole view.
- Virtualize every list or table that can exceed the visible area. Use `content-visibility` for long off-screen sections where layout allows.

Continuity:

- Every transition can be interrupted and reversed from its current visual position. Repeated or rapid input retargets the running motion; it never queues, restarts from the beginning or snaps to the end.
- Every motion starts from the element's current rendered state and ends exactly on its final state, with no jump at either end.
- Exit animations finish before unmount without leaving a gap or causing a layout jump. Re-keying, Strict Mode double mounting and re-renders must not replay entrance motion.
- Skeleton-to-content and old-to-new content changes cross-fade in place, at identical geometry.
- No blank frame, unstyled frame or fallback flash appears between two states.

Loading without waiting:

- Prefetch the code and data for the most likely next view on navigation intent (hover, focus or pointer-down) and when idle. Preload the code chunk before navigation starts.
- On navigation, keep the current view visible and interactive until the next view is ready to paint. Show a region fallback only after the latency threshold, never as a flash.
- Preload fonts from the Teludens type tokens and match fallback metrics, so text never reflows when the web font arrives.
- Give every image and media element explicit dimensions and decode it off the critical path.

Scrolling and direct manipulation:

- Make scroll, wheel and touch listeners passive. Scroll-linked effects use CSS (for example `position: sticky`), never per-scroll JavaScript layout reads.
- Contain each scroll region (`overscroll-behavior: contain`), so nested regions never chain scroll to the page.
- Drag, resize and splitter handles track the pointer every frame with no visible lag.

### Smoothness and performance budgets

Unless Experience Physics or a performance specification declares other values, these budgets apply. Measure them twice: unthrottled on the reference development machine, and at the 1024×768 tier under 4x CPU throttling.

| Measure | Unthrottled | 4x CPU throttle |
|---|---|---|
| Frames delivered within one frame interval during any inventoried motion, scroll fling, drag or resize | 99% | 95% |
| Single frame longer than 33ms during those activities | none | none |
| Long animation frame over 50ms during the critical journeys | none | none |
| Interaction to Next Paint for every interaction in the critical journeys | 100ms or less | 200ms or less |
| Visual response to pointer down or key press | within one frame | within one frame |
| Cumulative Layout Shift across each view family's critical journey | 0.01 or less | 0.01 or less |
| Navigation between view families that shows any region fallback | none for prefetched routes | none for prefetched routes |

A budget miss is a defect at the top severity level. Fix the cause; do not shorten or remove the motion to hide the miss.

## Implementation

- Replace remaining legacy or one-off UI with the PS-700 Teludens primitives without changing domain authority
- Audit the complete rendered route inventory for raw styling, card mosaics, noncanonical motion, ambiguous scroll ownership and noncatalog branding; record it in `docs/design/route-inventory.md` with each route's view family, owner app and current conformance status
- Create and apply the project-specific design artifacts required by the repository standard, following "Design quality method"
- Refactor screens into task-focused view families with preserved context and bounded scrolling, following "Workstation contract"
- Split oversized bundles and components where measured behavior benefits
- Add automated geometry checks plus reviewed visual matrices

Work one view family at a time through steps 3 to 5 of the design method. Do not start the next family while the current one has open defects at the top two severities, unless the defect is blocked and recorded.

Use canonical Glossary terms, lower dot-case imperative Commands, past-tense dot-case events, camelCase JSON, snake_case SQL, UUID identifiers, UTC `timestamptz`, and the error envelope from 09 section 8. Server time is authoritative; device time is observational. Keep state change, Command Receipt, Evidence Event, and transactional outbox atomic where the task mutates Session state.

Before adding a command, event, enum, schema, or error, search its authoritative catalog and existing code; keep one producer/owner and extend OpenAPI, JSON Schema, or SQL at its authoritative source instead of creating a prose contract. Where the task exposes client mutation state, preserve REQ-043's Studio distinctions (saved on this device, synchronized, validation required, published) and Runtime's `local_pending` distinction from the canonical server outcomes in Synchronization Protocol section 3; otherwise record that client-state handling is not applicable. Define recovery from every partial failure the task can create.

## Authorization/privacy

- Reuse the existing trusted OIDC, Organization Role, Session Role, Seat and RLS boundaries
- Return only server-authorized data and test cross-Organization, cross-Session and revoked access
- Use synthetic test identities and never expose secrets or protected content in screenshots or logs

Derive the Principal, Organization, Session, Seat Assignments, Active Role Context, and Authority Epoch from trusted server context. Add at least one negative authorization test. Enforce INV-002 by omitting unauthorized data server-side, not hiding it in the UI.

## Concurrency/idempotency/versions

- Preserve idempotent Commands, immutable Releases and Governing Release pins
- Make persistent mutations transactional and version-aware
- Test duplicate, stale, interrupted and concurrent user actions

Pin Governing Release, schema, contract, Plugin, and Platform Adapter versions where applicable. Retry only safe transient failures; replay must return the original receipt. Use expand -> backfill -> switch -> contract for persistent schema evolution.

## Non-goals and explicitly prohibited side effects

- Do not replace React or the approved architecture
- Do not trade accessibility for visual novelty
- Do not create inert controls or screenshot-only implementations
- Do not introduce tokens, fonts, colors, icons sets or motion curves outside the Teludens catalog, including when an Impeccable command suggests them
- Do not add a UI library, CSS framework or animation library

Also prohibited: destructive production operations, production secret changes, paid service creation, `git add .`, force push, destructive reset, invented commands, and completion claims after a failed gate.

## Acceptance

- Given the documented preconditions, when the task behavior is exercised, then every Platform, Studio, Runtime, Fractured Order, Operator, Admin, report and replay view passes the Teludens catalog conformance audit (`CMD-TELUDENS-AUDIT`)
- Given the documented preconditions, when the task behavior is exercised, then no legacy logo, simulation-branded shell, raw reusable styling value or unapproved component remains
- Given the documented preconditions, when the task behavior is exercised, then every view family passes the viewport, height, zoom and long-content matrix declared under "Viewport, zoom and input matrix"
- Given the documented preconditions, when the task behavior is exercised, then no essential workflow uses one unbounded page or internal identifier entry
- Given the documented preconditions, when the task behavior is exercised, then every interactive control has complete keyboard, focus, status and failure behavior
- Given the documented preconditions, when the task behavior is exercised, then performance budgets and bundle sizes are measured and accepted
- Given the documented preconditions, when each view family is closed, then its after-`audit` report contains no unresolved findings at the top two severity levels the skill uses, and every lower-severity finding is fixed or listed with a rationale
- Given the documented preconditions, when each view family is closed, then no unresolved detector finding remains; any suppression is listed with rationale in `docs/design/impeccable/exceptions.md` (or the detector gate is recorded NOT RUN if the detector is unavailable)
- Given the documented preconditions, when each view family is closed, then its after-`critique` shows no regression against its before-`critique` on any heuristic, and every heuristic the skill rates below acceptable has a defect entry
- Given the documented preconditions, when the product is reviewed, then no item from "Prohibited patterns" is present in any view, and `review.md` exists with observations for every after-screenshot
- Given the documented preconditions, when the cross-family pass runs, then shared concepts (selection, status, pending, destructive action, error, empty, inspector, command bar) render and behave identically across families
- Given the documented preconditions, when any motion in the rendered product is exercised, then it corresponds to a motion inventory row and uses only that row's motion tokens, and the audit finds no literal motion values outside token sources
- Given `prefers-reduced-motion: reduce` or `forced-colors: active`, when any inventoried motion is exercised, then its declared equivalent is used and no meaning or feedback is lost
- Given controlled response latency at each loading threshold, when a region loads or refreshes, then no indicator flashes for waits under 200ms, no populated region blanks, the indicator matches its latency band, and layout shift stays within budget
- Given an optimistic or local mutation, when the server confirms, rejects or reports a conflict, then each state is visually and textually distinct, and every rejection or conflict reverts in place with its reason and a recovery action
- Given a user interacting with a list, table, menu or text selection, when a remote update arrives, then no content moves under the pointer, focus or selection, and the update is offered through the "N updates" control
- Given each signature moment, when it plays, then input is never blocked, the state change is already committed, the moment can be skipped, its meaning is stated in text, and its reduced-motion version is used when requested
- Given the reference machine unthrottled and the 1024×768 tier under 4x CPU throttling, when the critical journeys, inventoried motions, scroll flings, drags and resizes run, then every smoothness and performance budget is met with measured values recorded
- Given any inventoried transition, when it is interrupted or rapidly repeated, then it retargets from its current visual position with no jump, queue, restart or snap
- Given navigation between view families on a prefetched route, when the user navigates, then the current view stays visible until the next view paints, and no fallback flash, blank frame or font reflow occurs
- Given any view in any supported role, when it is first rendered, then it shows without interaction where the user is, what they are working on, the mode, the Active Role Context, and the system state
- Given each critical journey in `docs/design/journeys.md`, when the cognitive walkthrough and cold read are run on the implemented UI, then no step has an unresolved "no" and no view has an unresolved cold-read mismatch
- Given any rendered view, when its visible text is scanned, then it contains no internal identifier, enum key, raw error payload or crosswalk-legacy term, and every domain term is the Glossary canonical form
- Given any form, when it is used with invalid, incomplete, duplicate-submitted and server-rejected input, then it follows "Forms, dialogs and messages": correct container, field errors linked to fields, error summary with focus, preserved input, outcome-named submit, and no duplicate Command
- Given any dialog, when it is opened and closed by pointer, keyboard and Escape, then it is the only dialog open, the background is inert, initial and returning focus are correct, and its actions remain visible
- Given any action, when its consequence is classified, then its confirmation treatment matches the confirmation table, and no confirmation uses "Are you sure?", Yes, No or OK
- Given any error, when it occurs, then it appears at the level where it occurred, states what happened and what to do next with a control to do it, preserves input, does not auto-dismiss, and does not reveal unauthorized objects
- Given a reload or reconnect in the middle of any critical journey, when the user returns, then view, selection, filters, region scroll position and unsent input are restored, and changes by others while disconnected are summarized
- Given the user test, when it is run, then the usability measures in the human gate are met for every role, with zero wrong-mode errors

Exercise unauthorized, disconnected, stale, and partial-failure cases whenever the capability can encounter them. Deliverables:

- Unified component system
- Task-focused responsive layouts
- Complete state inventory
- Visual QA baseline and user test
- Route inventory, view-family briefs and Impeccable before/after reports
- Motion inventory with reviewed recordings and performance traces
- Roles and critical journeys, cognitive walkthroughs and cold reads for every view family

## Tests

Required test/evidence IDs: `PS-800-T01`, `PS-800-T02`.

Use the smallest effective levels from Roadmap section 8: domain tests for invariants, database/integration tests for real boundaries, and a few browser flows for critical journeys. Use synthetic representative fixtures, deterministic clocks/seeds, isolated tenants, and no arbitrary sleeps. Do not mock the boundary the test claims to prove.

Fixtures for visual and geometry tests must include realistic long content (long Organization and participant names, long free text, large lists) so that layout defects appear in tests rather than in use.

Motion and loading test requirements (attach this evidence to the existing required evidence IDs as the test registry defines them; do not invent new evidence IDs):

- Deterministic screenshot tests disable animation through one global test switch owned by the motion token layer, which sets motion durations to zero. Do not inject ad hoc CSS that hides animation defects.
- Motion conformance: for each inventory row, a browser test triggers the motion and asserts that the computed animated properties, duration, easing and delay match the row's tokens.
- Reduced motion and forced colors: run every critical journey and every signature moment with `prefers-reduced-motion: reduce`, and separately with `forced-colors: active`, and assert the declared equivalents.
- Loading thresholds: use deterministic, test-controlled response delays at each band boundary (for example 50ms, 300ms, 2s and 12s) to assert indicator delay, minimum visible time, indicator type and absence of blanking. These tests prove UI loading behavior only; they do not replace integration tests of the real server boundary.
- Layout stability: assert that bounding boxes of populated content and the focused element do not move when data arrives or a refresh completes, beyond the layout shift budget.
- Live updates: inject a remote change while a row is focused, hovered and text-selected; assert the focused element's bounding box is unchanged and the "N updates" control appears and is announced.
- Mutation outcomes: for each client mutation state, drive confirm, reject and conflict outcomes from the real server boundary. Assert the in-place revert, reason, recovery action, and that no pending state is left orphaned.
- Signature moments: assert that input remains available during the sequence, that skip works by key press and by click, and that the sequence does not replay on reload or reconnect.
- Recordings: record video of every critical journey and every signature moment under `tests/visual/motion/`. Review each recording and write observations in the family's `review.md`, as for screenshots. Default browser-automation video runs below display frame rate and cannot show stutter. For smoothness review, capture at the display's full frame rate, using performance-trace frame screenshots or a full-frame-rate screen capture, and say which method you used.
- Interruption: for each inventoried transition, trigger it, interrupt it at about 50% with the opposite action, and trigger it rapidly five times. Sample the element's transform or opacity every frame and assert that values are continuous (no jump between consecutive frames beyond what the easing produces) and that it ends on the correct final state.
- Frame pacing: during each inventoried motion, scroll fling, drag and resize, record frame timing in the browser and long animation frames with `PerformanceObserver`. Assert the frame budgets in "Smoothness and performance budgets", both unthrottled and under 4x CPU throttling at 1024×768.
- Performance: capture traces for the critical journeys in both conditions. Record frame delivery, long animation frames, Interaction to Next Paint and Cumulative Layout Shift, and store the trace artifacts with their paths in the handoff.
- Prefetch and navigation: assert that navigation between view families on prefetched routes shows no region fallback, no blank frame and no font-swap reflow.
- Orientation: for every route, assert the view title, `aria-current` on navigation, the mode indicator, the Active Role Context and the system-status location are present, in each supported role.
- Visible-text scan: on every route and state, scan rendered text for UUID patterns, dot-case Command or event names, enum keys, raw HTTP codes and JSON, crosswalk-legacy terms, and the vague labels listed in "Prohibited patterns". Any match fails.
- Primary actions and icon-only controls: assert each region landmark has at most one primary action, and each icon-only control is on the allowlist and has an accessible name and a tooltip.
- Disabled controls: assert every disabled control exposes its reason to assistive technology and on focus or hover.
- Shortcut registry: assert there are no duplicate or conflicting shortcuts, and every shortcut appears in the command bar and in its control's tooltip.
- Forms: for each form, test blur validation, submit with missing fields (error summary appears, focus moves to it, links reach the fields), server-rejected input mapped from the error envelope, preserved input after every error, double submission producing one Command Receipt, and the unsaved-input guard.
- Dialogs: for each dialog, assert one dialog at most, inert background, initial focus (the safe choice in destructive confirmations), Escape behavior, focus return, and visible actions at the constrained-height tier.
- Confirmations: for each action in the confirmation table, assert its treatment, including undo where listed and type-to-confirm where listed.
- Errors: for each error level, trigger the error and assert placement, content (what happened, what to do, control to do it), persistence, and the INV-002 wording for authorization failures.
- Resumption: in the middle of each critical journey, reload and separately disconnect and reconnect; assert restored view, selection, filters, region scroll position and unsent input, and the summary of others' changes.
- Journey step counts: record actions per critical journey in each run; an increase over the previous accepted baseline fails unless the brief records a reason.
- Human feel check: add a smoothness section to `docs/design/user-test/PS-800-script.md`. It runs the critical journeys and signature moments on the lowest-specification machine the product supports, and records any moment a participant perceives as stuttering, jumping, slow or flashing. This section stays `PENDING HUMAN` with the rest of the user test.

## Validation commands

Resolve these references in `COMMAND_REGISTRY.md`: `CMD-PLATFORM-LINT`, `CMD-PLATFORM-TYPECHECK`, `CMD-PLATFORM-BUILD`, `CMD-PRODUCT-E2E`, `CMD-PLATFORM-A11Y`, `CMD-VISUAL-QA`, `CMD-GAP-AUDIT`, `CMD-TELUDENS-AUDIT`.

Run only commands whose registry status is **Verified** or that this task explicitly creates. For a **Proposed** command created by the current task, implement its registered contract first and then verify it before claiming completion; for any other Proposed command, complete its named prerequisite task. Do not guess a script. Record command, cwd, environment, versions, duration, exit code, and artifact path. Classify each PASS / FAIL / NOT RUN.

Impeccable runs are evidence, not registry commands. Record each run (command, target, skill version, report path) in `docs/design/impeccable/README.md`.

## Regression and quality gates

- Semantic tokens remain the only reusable styling source
- Reduced motion and forced colors retain meaning
- Responsive changes preserve authorization and domain behavior
- Teludens semantic tokens, spatial grammar, experience physics and canonical Plenum reference slice remain conformant
- Only the catalog Plenum dark/light wordmarks are used as platform branding; simulation content cannot replace platform identity

The approval gate is: change-level acceptance requires passing automated evidence and a completed user-test script; production approval remains separate. A task may be implementation-complete without being release-approved.

**Human gate:** you cannot complete the user test yourself. Write the user-test script at `docs/design/user-test/PS-800-script.md` (participants' profile, critical journeys as tasks, success criteria, time and error measures, observation template). Record the user-test gate as `PENDING HUMAN` in the handoff and in `PROJECT_STATE.md`. Do not report change-level acceptance as PASS while it is pending.

The script must measure intuitiveness, not just completion. Unless the PRD declares other targets, use these, and record any shortfall as a defect:

- At least five participants per primary role who have not used the current UI.
- **Task success:** at least four of five participants per role complete each critical journey without help.
- **Ease:** median Single Ease Question rating of 6 or higher out of 7 for each critical journey.
- **Overall usability:** System Usability Scale score of 80 or higher for each role.
- **First click:** the first click is correct on at least 80% of journey starts.
- **Efficiency:** median time on task no more than twice an experienced team member's time for the same journey.
- **Orientation:** in a five-second test of each view family, at least four of five participants can say what the view is for and what mode they are in.
- **Mode safety:** zero wrong-mode actions. Any one is a top-severity defect.
- **Recovery:** in a seeded error for each critical journey, at least four of five participants recover without help.

Record hesitations, backtracking and every point where a participant asks a question, against the journey step where it happened.

## Docs and continuity

- Update PRODUCT_COMPLETENESS_MATRIX.md and PROJECT_STATE.md
- Record exact user-test evidence and unresolved defects
- Update authoritative contracts and compatibility/migration registers when changed

Update contracts at their authoritative owner instead of duplicating them. Add conflicts only to `CONFLICT_REGISTER.md` as candidate OPEN items. Update maturity without turning future acceptance conditions into current evidence.

Add or update a short "UI quality rules" section in `AGENTS.md` that points future tasks to the Teludens catalog, `docs/design/`, the motion inventory, `docs/design/journeys.md`, the forms, dialogs and messages rules and the prohibited-patterns list in this prompt, and the Impeccable close-out sequence, so later tasks inherit the same bar.

## Commit

- Proposed branch: `feat/ps-800-unify-design-system-and-complete-ui-states`
- Proposed subject: `feat(ui): complete cohesive product experience`
- Expected migrations: none
- Expected API/contract IDs: `design-system-v1`, `visual-qa-matrix-v1`

Proposed body:

```text
Why:
- Replace proof-oriented long-scroll screens with a coherent professional workstation and verify every supported viewport, input and state.
What:
- Users can understand, navigate and complete complex work efficiently on desktop and constrained displays with keyboard, pointer, touch and assistive technology.
Verification:
- Run the listed automated gates, Impeccable before/after critique and audit per view family, and the task user-test script.
Compatibility / migrations:
- Preserve existing Releases and Sessions; use the named additive migration when required.
Risks / follow-up:
- Any unverified or inaccessible workflow remains a blocker.
Refs: PS-800, REQ-009, REQ-063, REQ-064
```

Proposed PR description:

Summary: Users can intuitively understand, navigate and complete complex work efficiently on aesthetically pleasing, professional and intuitive desktop and constrained displays with keyboard, pointer, touch and assistive technology. Risks: high workflow and authorization regressions. Migration: none. Evidence: automated checks, before/after screenshots per view family, Impeccable reports, and the task user-test script. Rollback: revert the bounded UI/API slice and forward-fix any additive schema change.

Review the focused diff and list exact files. Never commit failed gates or unrelated changes.

## Handoff

Return PASS / FAIL / BLOCKED / NOT RUN / PENDING HUMAN for every validation reference and gate; exact command-output or artifact references; modified files; demonstrated behavior; per view family, links to the brief, before/after Impeccable reports, screenshots, motion recordings and `review.md`; the motion inventory, its token gaps and any `PS-800 default` values used; performance trace paths with measured values against budget; walkthrough and cold-read results with any open "no" answers, and journey step counts against the briefs; Impeccable–Teludens conflicts recorded; migrations and rollback/forward-fix implications; unresolved defects and unratified dependencies; and the next eligible task. If blocked, complete independent safe work first. Revisit when: The governing product specification changes; User testing finds a missing or unusable workflow; A dependency or release gate changes.

**PS-800 follow-up: reduce cognitive load and improve interaction clarity**

The interface produced by PS-800 is organized and visually consistent, but using it still requires too much reading, interpretation, and memorization. Users must acclimatize to where functions live and how the navigation works before they can operate confidently.

Treat this as an **information architecture and interaction design refinement**, extending through implementation. Visual polish alone will not satisfy the request.

**Desired experience**

Create a modern professional workspace that feels immediately legible, responsive, and coherent while retaining Plenum’s institutional character, operational depth, and Teludens identity.

Use these references for specific qualities:

- **Cursor:** a focused working area, stable orientation, and contextual access to supporting tools.
- **ChatGPT:** a clear starting point, an obvious primary interaction, and low interface overhead.
- **Apple operating systems:** consistent interaction conventions, clear selection and focus, continuous transitions, and immediate feedback.

Adapt these principles to Plenum’s workflows. Do not assume that a chat interface, icon-only sidebar, or desktop-window metaphor is appropriate.

**Diagnose before changing**

Inspect the running application, governing design sources, and representative role-specific workflows. Identify where users must:

- Read instructions to understand an ordinary control.
- Remember a location or previous state that the interface should communicate.
- Choose between competing actions without sufficient hierarchy.
- Navigate away to retrieve information needed for the current task.
- Interpret redundant labels, metadata, panels, or status messages.

Distinguish necessary domain complexity from complexity introduced by the interface. Tie each proposed change to a concrete workflow problem.

**Implement the following improvements**

1. **Clear orientation and action hierarchy.** Make the user’s location, active role and context, current task, and primary action apparent. Keep global navigation, local navigation, and task actions visually and behaviorally distinct.

2. **Task-based information architecture.** Organize screens around actual user goals and canonical domain concepts. You may restructure layouts and navigation where evidence supports it; preserve domain behavior, permissions, and terminology.

3. **Deliberate progressive disclosure.** Keep information required for the current decision visible. Place secondary configuration, supporting evidence, and infrequent controls within predictable reach. Do not hide consequential status, constraints, or recovery actions to achieve visual simplicity.

4. **Lower reading burden.** Remove redundant prose and labels. Improve grouping, hierarchy, defaults, and contextual guidance. Use icons where they improve recognition, with accessible names and visible labels wherever meaning would otherwise be ambiguous.

5. **Coherent workspace behavior.** Maintain a clear primary working area, predictable panel behavior, and explicit scroll ownership. Preserve relevant selection, focus, context, and unsaved work across transitions. Avoid excessive panes and nested scrolling.

6. **Responsive interaction.** Acknowledge actions immediately and accurately distinguish pending, saved, synchronized, successful, and failed states using the established state model. Use restrained motion to explain changes, respecting reduced-motion preferences.

**Implementation approach**

Start with the shared shell and a representative end-to-end workflow. Choose a workflow that exercises navigation, editing or decision-making, supporting detail, and recovery. Verify the interaction model, then extend it across the relevant screen families and roles, including Scribe and SME where supported.

Retain PS-800’s governing requirements, authorization boundaries, accessibility standards, and validation gates. Document any conflict with an existing design prescription and the smallest amendment needed.

**Evidence and completion**

For each representative workflow, document the starting state, intended task, expected next action, completion feedback, and recovery path.

Provide:

- Before-and-after screenshots of equivalent states.
- Evidence that critical workflows remain functional.
- Checks for navigation consistency, keyboard operation, focus continuity, responsive layouts, and long content.
- A first-use task script testing whether users can orient themselves, find the primary action, complete the task, and recover without coaching.
- A clear distinction between verified behavior, observed user-test results, and untested assumptions.

Do not claim improved usability from screenshots or reduced click counts alone.

**Success means users can begin confidently and discover depth as their task demands it, while experienced users retain efficient access to the platform’s full capability.**