# Plenum Teludens Runtime migration promptbook

Updated: 2026-10-29.

## Purpose

This historical migration promptbook is superseded for execution by canonical tasks `PS-700` through `PS-840`. It remains useful implementation detail, but the generated PS graph, `PRODUCT_COMPLETENESS_MATRIX.md`, product corpus, Decision Register and release gates control sequencing and acceptance.

The intended result is not a pixel-for-pixel recreation. Teludens owns materials, geometry, density, components, motion, and interaction behavior. Plenum retains the product-specific identity: institutional tone, role and team context, Move/Phase/time visibility, role-specific workspaces, briefing presentation, governed handoffs, and clear Session authority.

## Authority and non-negotiable boundaries

1. Product behavior and authority come from the corpus and Decision Register. Visual references never override authorization, information policy, Session Authority, evidence, consent, privacy, or workflow rules.
2. `references/fractured-order/` is the immutable golden behavioral reference. Its simulation-specific styling and hard-coded team pages are not production UI authority.
3. `references/teludens-design-system-catalog/` is the binding UI, interaction and platform-brand reference for all Plenum surfaces, including Fractured Order. Do not edit the catalog as part of product implementation; consume it through a versioned production design-system layer.
4. PS-700 must explicitly reconcile and record the catalog's rendered Graphite/Mineral Sage decision mapping versus `docs/TELUDENS_DESIGN_LANGUAGE.md` / `docs/TELUDENS_TOKENS.json` Electric Vermilion mapping before broad propagation. Never combine them accidentally or scatter either as raw values.
5. Keep one Runtime renderer and one authoritative projection path. Studio preview may reuse presentation components, but it must remain non-authoritative and incapable of Session mutation.
6. Preserve server-side role, team, Stage, information-policy, Poll, Voice, Plugin, and Effect Proposal filtering. Styling must never reveal data hidden by policy.
7. Use semantic tokens. Product-local team and institutional tokens may extend Teludens, but components must not scatter raw reference colors.
8. Use only `assets/logos/Plenum. Wordmark Dark.png` and `assets/logos/Plenum. Wordmark Light.png` for platform wordmarks, with theme-appropriate contrast and no redraw, recolor, distortion or simulation-specific replacement.
9. Prefer continuous workspaces, aligned lists/tables, state rails, panels, and inspectors over card mosaics.
10. Accessibility, reduced motion, constrained-height behavior, keyboard operation, zoom/reflow, and non-color state distinctions are release requirements, not later polish.
11. Every task reports `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`. Implementation completion is not production approval.

## Observed starting point

- The current Runtime is a functional React/TypeScript vertical slice in `apps/runtime-web/`.
- `apps/runtime-web/src/styles.css` provides a dark-only token set and a centered vertical card/list layout.
- Runtime applies `layout-*` classes, but distinct `single_column`, `main_with_sidebar`, `dashboard_grid`, and `workspace_tabs` visual layouts are not implemented.
- Studio's Role & Stage preview uses the Runtime profile resolver and policy-filtered content, but renders a simplified module-card approximation rather than the real Runtime composition.
- The Fractured Order reference uses persistent role/session chrome, Move/Phase/timer context, role-specific navigation, specialized Scribe/facilitator presentation, team identity, and denser operational surfaces.
- The Teludens catalog already specifies the target shell, state rail, contextual inspector, role-specific Plenum surfaces, density modes, semantic materials, and interaction physics.

## Target experience

A user should be able to identify, without opening a menu:

- the Simulation, Session, active role, and team;
- the current Move/Stage, phase status, authoritative connection state, and relevant time state;
- the work requiring attention now;
- the selected object's owner, state, provenance, and next gate;
- the actions this role may take and the actions it may not take.

The shared desktop composition is:

```text
Global navigation | Context bar: Simulation / Session / Role / Team / Status
                  | State rail: Orient -> Action -> Review -> Resolve
Role navigation   | Primary workspace              | Contextual inspector
                  |                                 | Activity / provenance
```

At narrow widths, navigation and inspector become accessible drawers or sheets. They must not silently disappear, crush the primary task, or introduce whole-page horizontal scrolling.

## Work sequence

| Order | Work package | Depends on | Complete when |
|---:|---|---|---|
| 1 | `TDS-001` Design authority and migration baseline | Current source and references available | Palette authority, keep/translate/retire matrix, layouts, and review baselines are approved |
| 2 | `TDS-010` Semantic tokens and Plenum theme | TDS-001 | Runtime and Studio consume one semantic token source with light/dark and density mappings |
| 3 | `TDS-020` Canonical Runtime shell and layout renderer | TDS-010 | Context bar, state rail, navigation, workspace, inspector, and four configured layouts work responsively |
| 4 | `TDS-030` Scribe and Facilitator workflow | TDS-020 | One artifact retains identity through authoring, handoff, review, return, and submission |
| 5 | `TDS-040` Notetaker, White Cell, and SME workspaces | TDS-030 | Role-specific operational surfaces preserve authority boundaries through ruling |
| 6 | `TDS-050` Poll, Voice, and Plugin/Effect capability surfaces | TDS-040 | Existing capabilities use the shell and truthful authority/pending states without semantic regressions |
| 7 | `TDS-060` Truthful Studio Runtime preview | TDS-020, TDS-050 | Studio preview uses the real presentational renderer with synthetic, non-mutating preview data |
| 8 | `TDS-070` Visual, accessibility, performance, and rollout gate | TDS-030 through TDS-060 | Approved baseline and all required automated/human evidence exist for the exact build |

Run one package at a time unless two packages touch disjoint files and their prerequisites are independently satisfied. Use `docs/promptbook/TASK_HANDOFF_TEMPLATE.md` after each package.

---

## TDS-001 — Establish design authority and the migration baseline

### Goal

Make the intended visual language explicit before changing production UI. This task creates design decisions and comparison evidence only; it does not restyle the application.

### Ready-to-use prompt

You are establishing the Plenum-to-Teludens Runtime migration baseline. Do not change production components or styles.

Inspect the current Runtime and Studio preview, the official Fractured Order snapshot, the Teludens catalog and its design-language, spatial-grammar, interaction-physics, token, and Plenum reference-slice documents. Read `rules/UNIVERSAL_DESIGN_STANDARDS.md`, `rules/QA_STANDARDS.md`, current E2E fixtures, and `PROJECT_STATE.md`. Preserve unrelated changes.

Create the smallest product-local design artifacts needed to govern implementation. Prefer `docs/design/` unless an established equivalent exists:

- A Plenum design brief describing users, role families, first tasks, tone, supported viewport/height/input combinations, information priority, density defaults, accessibility targets, and explicit non-goals.
- A layout specification for the context bar, state rail, navigation, workspace, inspector, overlays, scroll ownership, and narrow/short viewport transformations.
- A decision log containing a keep/translate/retire matrix for the Fractured Order reference.
- A visual comparison matrix naming representative reference and current Runtime states to capture during TDS-070.

Obtain or record as `BLOCKED` the authorized decision between Graphite/Mineral Sage and Electric Vermilion. The decision must name which artifact is authoritative, the semantic purpose of the chosen signal, migration consequences, reviewer, and revisit trigger. Do not silently infer approval from file version numbers.

Preserve as product identity: institutional tone; visible role/team/Move/Phase/time/session context; governed handoffs; team identity; presentation/briefing mode; operational density; and role-specific attention queues. Translate card-heavy styling into Teludens continuous surfaces. Retire hard-coded team HTML routes, duplicated renderers, generic card mosaics, and color used without semantic meaning.

Acceptance:

- Every retained reference trait has a user or workflow reason.
- Every Teludens rule adopted has an implementation and validation destination.
- Palette authority is approved or explicitly `BLOCKED`.
- No production code or immutable reference is modified.
- The next task can implement tokens without inventing visual decisions.

Verification: review Markdown links and paths, run `git diff --check`, and report human approvals as `PASS`, `BLOCKED`, or `NOT RUN` rather than fabricating them.

---

## TDS-010 — Establish semantic tokens and the Plenum product theme

### Goal

Replace scattered visual values with one production token layer that expresses Teludens materials and Plenum identity without introducing a new component framework.

### Ready-to-use prompt

Implement the approved token and theme decisions from TDS-001. Start by locating every consumer of `apps/runtime-web/src/styles.css`, Studio's import of Runtime styles, inline visual values, theme assumptions, and tests that depend on color or geometry.

Create one shared semantic token source using the repository's existing CSS/Vite structure. Do not add a dependency or a generic package unless direct CSS reuse cannot serve both Runtime and Studio. Separate:

- Teludens primitives and semantic roles: canvas, workspace, surface, raised/recessed material, control states, text hierarchy, boundaries, focus, information, success, caution, error, spacing, radius, density, motion, and z-index.
- Plenum product roles: institutional identity, team Blue/Green/Red/Industry, briefing/document treatment, active Session context, and scenario media.
- Component consumption: components reference semantic roles, never primitive numbers or legacy names directly.

Implement light and dark semantic mappings if TDS-001 approves both. Implement Focus, Standard, and Operations density mappings without changing canonical content or authorization. Use Inter/system UI typography, mono only for telemetry/identifiers/time, and an approved local or system serif only for briefing/document content. Do not retain a production dependency on Google Fonts.

Map current tokens through temporary aliases only where needed for an incremental migration. Each compatibility alias must have a removal task or be deleted in this task. Do not maintain two permanent sources of truth.

Acceptance:

- Runtime and Studio build from one semantic token source.
- Plenum team and institutional identity remain available without overriding status/error semantics.
- The selected decision signal is scarce and cannot be confused with destructive/error state.
- Focus remains visible; forced-colors and reduced-motion behavior are preserved.
- No user-visible behavior, API, persistence, authorization, or Release contract changes.
- Raw-value and legacy-token searches have reviewed, bounded results.

Tests and gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, focused Runtime/Studio browser smoke, light/dark screenshots if supported, forced-colors inspection, 200% text, and `git diff --check`. Record aggregate pre-existing failures separately from failures introduced by this task.

---

## TDS-020 — Build the canonical Runtime shell and configured layouts

### Goal

Replace the generic vertical page with a reusable simulation workspace that preserves the reference's persistent operational context and implements Teludens spatial grammar.

### Ready-to-use prompt

Build the smallest reusable Runtime shell from the approved TDS-001 layout specification and TDS-010 tokens. Reuse existing React, projection contracts, routes, and state. Do not alter authorization or invent client-side role rules.

The shell must provide:

- global/product navigation only where required;
- a context bar showing Simulation/Release, Session, active role, team, connection/save state, and authoritative time/status information already available in the projection;
- a text-and-position state rail for configured Stage/Move progression;
- role-local navigation and an attention count/indicator model based only on authorized projection data;
- a primary workspace with explicit scroll ownership;
- a persistent contextual inspector on wide screens and accessible drawer/sheet behavior on narrow screens;
- local status/activity and transient dialog layers;
- keyboard skip paths, focus restoration, and reduced-motion behavior.

Implement real visual behavior for the configured `single_column`, `main_with_sidebar`, `dashboard_grid`, and `workspace_tabs` templates. Preserve one component tree and shared primitives; do not create four copied pages. Layout changes may reposition authorized modules but must not change their data, commands, or server authority.

Use continuous surfaces and separators. Cards remain appropriate only for discrete artifacts, ballots, channels, or independently actionable objects. Keep current loading, offline, pending, error, retry, and stale behavior truthful.

Acceptance:

- Every configured layout is visibly distinct and covered by a fixture.
- Role, team, Stage/Move, connection, and relevant time state remain available without scrolling on the declared desktop target.
- At narrow width or short height, essential controls remain usable and navigation/inspector remain reachable.
- No whole-page horizontal overflow at supported sizes or 200% text.
- Existing Runtime commands and receipts behave exactly as before.
- Unauthorized modules remain absent from the response and DOM.

Tests and gates: component tests for shell state and layout mapping; existing Runtime unit/integration tests; focused E2E for each layout, offline/error state, keyboard traversal, and viewport/height constraints; axe; reduced motion; `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, focused `npm run test:e2e`, focused `npm run test:a11y`, and `git diff --check`.

---

## TDS-030 — Implement the Scribe-to-Facilitator workflow surface

### Goal

Prove the new design with one complete, authority-correct workflow instead of restyling disconnected screens.

### Ready-to-use prompt

Implement the canonical Scribe and Facilitator surfaces inside the TDS-020 shell. Read the authoritative artifact workflow, active Release projection, Fractured Order Scribe/facilitator reference pages, Teludens Plenum reference slice, and existing Runtime tests before editing.

The Scribe surface prioritizes one official team artifact, its form sections, validation/completeness, local/synchronized/authoritative state, revision history where available, and the explicit `Forward to Facilitator` handoff. It must not expose direct White Cell submission or Facilitator-owned RFI actions.

The Facilitator surface prioritizes the same artifact identity, presentation/briefing context, completeness and challenge review, team communication/RFI work, return-for-revision, and final submission to White Cell where the governing workflow allows it. Preserve the reference's deck/presentation character, but implement it with Teludens Focus/Standard materials and stable navigation rather than copied HTML/CSS.

Use a shared artifact renderer and role-specific action projection. Do not fork domain calculations or infer permissions from labels. Pending, accepted, returned, rejected, stale-version, offline, and failed transitions must remain visibly distinct.

Acceptance:

- One artifact retains its ID and history through Scribe authoring, handoff, Facilitator return, correction, and submission.
- Each role sees only its authorized actions and fields.
- Presentation mode does not conceal status, accessibility controls, or a route back to the working surface.
- Current task, owner, next gate, and authoritative state are understandable without instructions.
- Reference identity is recognizable through persistent context, team/role treatment, operational language, and briefing composition—not copied page chrome.

Tests and gates: lowest-layer workflow/authorization regressions plus one real browser journey across both roles; negative direct-submit and cross-team cases; stale/retry/offline states; keyboard and screen-reader semantics; responsive and short-height screenshots; standard repository build/type/lint/test gates and `git diff --check`.

---

## TDS-040 — Implement Notetaker, White Cell, and SME operational workspaces

### Goal

Complete the governed review chain using Teludens Operations density while keeping each role's authority visually and behaviorally distinct.

### Ready-to-use prompt

Build the Notetaker, White Cell, and SME surfaces on the shared shell and object renderers from TDS-020/TDS-030. Do not create parallel stores, workflow rules, or API clients.

The Notetaker surface supports attributable observations, quotes, dynamics, and evidence links without mutating the official team artifact or acting as an alternate Scribe.

The White Cell surface is an Operations-density queue/table with filters, explicit completeness gates, RFI/clarification state, returns, SME routing, assessment integration, and authoritative ruling controls allowed by the governing workflow. Selection opens the same object in the contextual inspector without losing queue position.

The SME surface exposes only the assigned analytic lane, source artifact, evidence, assessment fields, provenance, and `Send to White Cell`. It cannot edit the team artifact or publish a ruling.

Use aligned rows, tables, state rails, gates, and inspectors rather than repeated large cards. Preserve stable selection, filters, scroll position, object identity, and safe workspace preferences. Long queues must be bounded or virtualized only when representative data demonstrates the need.

Acceptance:

- Scribe -> Facilitator -> White Cell -> SME -> White Cell preserves one object identity and an understandable event history.
- Notetaker, SME, and White Cell negative authority tests pass.
- Queue, empty, loading, stale, partial, conflict, error, and retry states are represented.
- Operations density remains keyboard-accessible and usable at approved zoom and target sizes.
- No card mosaic or duplicated workflow decision logic is introduced.

Tests and gates: authorization/integration tests for each handoff and denial; deterministic contention/stale-version cases; E2E for White Cell routing and ruling; large representative queue rendering check; keyboard, focus, axe, zoom/reflow, reduced motion, and standard repository gates.

---

## TDS-050 — Integrate Poll, Voice, and Plugin/Effect capability surfaces

### Goal

Express existing advanced capabilities through the Teludens shell without obscuring their distinct authority and consent models.

### Ready-to-use prompt

Restyle and compose the existing Poll, Voice/Radio, Plugin/Model Run, and Effect Proposal experiences using TDS-010 tokens and TDS-020 shell patterns. Reuse existing contracts, adapters, permission checks, command handlers, receipts, and tests. This is not authorization redesign.

Polls must distinguish configured, open, pending on device, submitted, accepted, rejected, tallied, and certified states. Secret choices and unavailable results remain absent according to policy.

Voice must distinguish provider health, authorized access, connecting, joined, floor queued, floor granted, transmitting, consent state, and unavailable/error conditions. Do not visually imply transmission or recording without authoritative confirmation.

Plugin/Model surfaces must distinguish computation from authority: Model Run output is provisional; Effect Proposals show target, operation, provenance, governing Release, expected version, and mandatory approval gate. Approval, rejection, and return are consequential decisions and use the approved decision signal sparingly.

Prefer contextual inspector detail and focused decision sheets over wide card grids. Essential instructions require a non-audio path. No client-generated fallback result, tally, audio state, or model output may appear authoritative.

Acceptance:

- Each capability preserves its existing trust, consent, secrecy, and authority boundary.
- Pending and authoritative states cannot be confused visually or semantically.
- Provider/adapter health is visibly separate from Plenum authority.
- Capability surfaces work in the applicable Focus, Standard, and Operations contexts.
- Existing VOTE, VOICE, and EXT regression evidence remains valid or is deliberately updated for the exact build.

Tests and gates: existing domain/integration suites; focused browser flows for ballot state, voice consent/floor state, and Effect approval; denied/expired/stale/provider-failure cases; axe, keyboard, non-color/non-audio cues, reduced motion, responsive/height checks, and standard repository gates. Live SFU proof remains `NOT RUN` unless the required environment is actually available.

---

## TDS-060 — Make Studio Role & Stage preview visually truthful

### Goal

Let Designers preview the actual Runtime composition without creating a second renderer or allowing preview actions to mutate Session state.

### Ready-to-use prompt

Replace the simplified Studio module-card approximation with the smallest safe reuse of the production Runtime presentational renderer. Inspect module renderers, projection/view-model boundaries, CSS ownership, Studio collaboration state, role-preview endpoint, tests, and all imports before editing.

Keep the server role-preview resolver as the authority for selected role, team, Stage, Interface Profile, modules, and information-policy-filtered content. Extend its preview contract only when the real renderer requires non-sensitive synthetic state that cannot be derived safely. Do not expose real Session records or add mutation credentials to preview.

Extract presentation components only where both Runtime and Studio genuinely render the same concept. Keep command dispatch, live subscriptions, device registration, media acquisition, and authoritative mutation outside the shared presentational layer. Preview controls must be inert or clearly labeled simulated actions. The preview must display a persistent `Preview — no Session changes` status.

Render the configured layout template, regions, authorized modules, long/empty/error states, light/dark theme, and selected density in a constrained preview viewport. Support desktop and mobile preview dimensions without iframe accessibility traps unless an iframe is demonstrably required and correctly labeled.

Acceptance:

- Studio and Runtime use the same presentational component for every previewed module.
- The four configured layouts match their Runtime composition at equivalent viewport and fixture state.
- Preview performs no device registration, media join, Runtime command, Session write, or evidence event.
- Policy-hidden content remains absent.
- Preview explicitly distinguishes synthetic content and non-authoritative state.
- A component or visual regression test fails when Runtime and preview structure diverge materially.

Tests and gates: shared component tests; server preview authorization and cross-tenant denial; network assertion that preview makes no mutation/media calls; side-by-side screenshots for each layout; keyboard/axe/zoom/reflow; standard repository gates and `git diff --check`.

---

## TDS-070 — Complete visual, accessibility, performance, and rollout evidence

### Goal

Prove that the migrated experience preserves the reference's operational character, follows Teludens, remains usable, and does not regress authority or core workflows.

### Ready-to-use prompt

Validate the exact candidate build produced by TDS-010 through TDS-060. Do not redesign during evidence collection except to fix observed defects, and rerun affected evidence after every fix.

Create one review matrix covering:

- Scribe, Facilitator, Notetaker, White Cell, SME, Participant capability, shared display/plenary where implemented, and operator surfaces affected by shared components;
- all four configured layout templates;
- Focus, Standard, and Operations density;
- supported light/dark themes;
- desktop target, minimum desktop width/height, tablet/narrow state, 390px mobile, 200% text, long-content, empty, loading, offline, stale, error, conflict, and active-overlay states;
- Poll, Voice, Plugin/Effect decision states and the Studio preview.

For each representative view, capture approved before/reference/current/new evidence. Review macro composition, persistent context, axes, typography, team/role identity, surface hierarchy, information density, scroll ownership, state clarity, action priority, inspector behavior, and scenario/briefing character. Pixel identity with the old reference is not required; recognizable operational continuity and approved Teludens conformance are.

Run automated accessibility and focused E2E checks, keyboard-only journeys, reduced motion, forced colors/high contrast, zoom/reflow, and screen-reader review for the critical Scribe -> Facilitator -> White Cell -> SME -> White Cell journey. Measure relevant selection, inspector, command, and large-queue response on declared hardware; do not invent performance claims.

Roll out through the repository's approved deployment mechanism. If a temporary feature flag is necessary, give it one owner, one removal condition, and one removal task. Do not create permanent dual renderers. Preserve a tested rollback to the prior UI bundle without rolling back compatible persistent data.

Acceptance:

- Product/design owner approves or rejects the exact screenshot and interaction baseline.
- Required automated gates are `PASS`; failures are fixed or recorded as blockers.
- Human screen-reader and usability review is complete or explicitly `NOT RUN`/`BLOCKED`.
- No authorization, tenant, policy, consent, secrecy, evidence, or authority regression remains.
- No required role surface depends on the old renderer before the migration flag is removed.
- Design decisions, component registry, layout spec, motion spec, `PROJECT_STATE.md`, and task evidence reflect observed results.

Validation commands: `npm run typecheck`, `npm run lint`, `npm test`, applicable database/integration suites, `npm run build`, focused and aggregate `npm run test:e2e`, focused and aggregate `npm run test:a11y`, and `git diff --check`. Record exact environment, duration, exit code, screenshots/traces, known unrelated failures, and every `NOT RUN` gate.

## Completion definition

The migration is complete only when:

- the product retains recognizable Fractured Order operational context without copied hard-coded pages;
- approved Teludens tokens, spatial grammar, density, components, and interaction physics are the production source of truth;
- configured layouts produce real, tested differences;
- role surfaces preserve distinct authority and one canonical workflow/object identity;
- Studio preview is visually truthful and non-authoritative;
- no permanent legacy renderer or duplicate token system remains;
- visual, workflow, accessibility, responsive, and performance evidence applies to the same immutable build;
- authorized humans approve the design and release gates separately.

## Handoff format

Use `docs/promptbook/TASK_HANDOFF_TEMPLATE.md`. In addition, include:

- Teludens token/theme version and palette decision;
- reference/current/new screenshot paths and viewport/theme/density;
- role surfaces and layout templates exercised;
- shared components promoted or removed;
- legacy aliases/renderers still present and their removal trigger;
- manual design, accessibility, and usability approvals actually obtained;
- remaining differences from the Fractured Order reference and whether each is intentional, defective, or deferred.
