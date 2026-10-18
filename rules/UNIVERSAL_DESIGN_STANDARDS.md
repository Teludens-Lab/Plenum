# Universal Interface Design Standards

**Version 3.0 · Project-agnostic · Agent-executable**

> **Design objective:** Produce interfaces with the precision, spatial coherence, responsiveness, and restraint of excellent native desktop software, while remaining appropriate to each product, platform, audience, and brand. **macOS-level craftsmanship is a quality reference—not a mandate to imitate macOS.**

This standard applies to web applications, desktop software, mobile applications, dashboards, platforms, games, research tools, administrative systems, public services, and commercial products. It is technology-neutral. It does not impose React, CSS, Apple-specific APIs, a map renderer, a particular icon library, or an aesthetic palette. A project-specific brief determines the platform, implementation architecture, user context, branding, and exceptions.

This document defines the *invariants* of good interface craftsmanship; a project's `DESIGN_BRIEF.md` defines its *identity and context*. Both must be followed. Do not produce a generic template in the name of consistency, or sacrifice usability to novelty.

---

## 0. Governance and interpretation

### 0.1 Requirement tiers

| Tier | Meaning | Handling |
|---|---|---|
| **H — Hard constraints** | Mandatory safety, semantic integrity, accessibility, and architecture boundaries | Must pass; conflicting requirements are escalated and resolved before release |
| **R — Required qualities** | Must be designed, implemented, and verified where applicable | A documented, approved exception needs a specific reason and alternative |
| **J — Justification-required defaults** | Common stylistic shortcuts that may be right, but never by habit | Use only with a decision-log entry that identifies their functional or identity purpose |

**MUST** is mandatory; **SHOULD** indicates a strong default with documented reasons for deviation; **MAY** is optional. **Not applicable** is legitimate if accompanied by a reason. An agent must not fabricate completion evidence.

### 0.2 Precedence

1. Applicable law, privacy/security requirements, and essential accessibility.
2. Project requirements, domain semantics, platform conventions, and approved technical architecture.
3. This standard's hard constraints.
4. User comprehension and task completion.
5. System consistency and performance.
6. Visual identity and expressive novelty.

If two rules conflict, record the conflict, use the higher-priority obligation, and resolve it in the project brief or decision log. Platform-native conventions take precedence over the aesthetic reference to macOS (e.g., Android, iOS, touch-first, gamepad-first, kiosk, and assistive interfaces retain their appropriate interaction models).

### 0.3 Universal versus project-specific values

Values provided in this document—including dimensions and motion timing—are **starting hypotheses**, never immutable global tokens. Resolve actual values in each project's token system and test them on the declared devices. **No single color palette, typeface, radius, animation, navigation pattern, or layout is mandatory across projects.**

### 0.4 Scope

The principles apply to product interfaces and, where relevant, marketing websites. Use surface-specific patterns rather than forcing application-shell layouts onto marketing pages, or mobile navigation onto desktop tools. Text and voice design should follow `VOICE.md` or an equivalent project copy standard.

---

## 1. Required project setup

Start with the following project-local artifacts. Small projects may combine them into one file, provided every relevant field remains explicit. Creation should be proportionate to project scale: do not let documentation block an exploratory prototype, but do not represent a prototype as production-ready.

| Artifact | Purpose | Minimum content |
|---|---|---|
| `DESIGN_BRIEF.md` | Resolve product-specific decisions | Users, jobs, tasks, platforms, context, tone, references, constraints, viewports, density, accessibility, novelty budget |
| `DESIGN_TOKENS` (`tokens.css`, JSON, native theme, etc.) | One semantic styling source | Color, type, spacing, size, radius, border, material, motion, focus, elevation, layering |
| `LAYOUT_SPEC.md` | Define the spatial system | Shell/view types, regions, minimum/preferred/maximum sizes, reflow, scrolling, resizing, alignment |
| `COMPONENTS.md` | Shared component anatomy and registry | Purpose, anatomy, variants, states, accessibility, responsive behavior, tokens, examples |
| `INTERACTION_PATTERNS.md` | Behavior contract | Navigation, menus, dialogs, tooltips, keyboard/touch/pointer patterns, undo, error recovery |
| `MOTION_SPEC.md` | Unified motion grammar | Semantic events, durations/easing, choreography, interruption, performance, reduced motion |
| `DESIGN_DECISIONS.md` | Traceability | Append-only justified choices, exceptions, reason, test, consequences |
| `VISUAL_QA.md` | Quality gate and evidence | Viewport/state matrix, screenshots, automated checks, known defects, acceptance results |

**Conditional artifacts:** `VOICE.md` for substantive copy, `GLOSSARY.md` for complex terminology, `AUDIO.md` for sound, `SYMBOLS.md` for domain-specific iconography, and `DATA_VISUALIZATION.md` for analytical visualizations. Do not require audio, complex symbology, or a full desktop shell for projects that do not use them.

### 1.1 `DESIGN_BRIEF.md` checklist

Define (1) product and core user outcomes; (2) user expertise and accessibility needs; (3) primary workflows and frequency; (4) platforms, input modes, display sizes, and minimum window heights; (5) established conventions users bring; (6) information classified as persistent / one interaction away / on demand; (7) content types including edge cases and realistic long values; (8) tone and identity with specific visual implications; (9) at least two substantive references and *what* is borrowed, not just their names; (10) navigation and density modes; (11) up to three justified points of interaction novelty; (12) responsiveness/performance budgets; (13) exclusions, ownership, and acceptance tests.

References **may** include operating systems, exceptional applications, physical instruments, editorial design, architecture, typography, maps, or domain materials. Never impose an artificial ban on software references; explain the particular behavior, composition, or quality borrowed and what should *not* be copied.

### 1.2 Initial workflow

1. Inspect existing architecture, design system, user flows, and UI before introducing new patterns.
2. Write/resolve the brief and constraints; make assumptions explicit.
3. Establish tokens, spatial primitives, and common interaction patterns.
4. Build one representative **reference slice**: application shell or page layout, dense/content-heavy view, contextual detail, consequential interaction, empty/error/loading state, and a meaningful transition.
5. Test this slice in realistic conditions; revise tokens and patterns before multiplying screens.
6. Implement remaining views by composing approved patterns rather than inventing one-off components.
7. Run the verification protocol and log deviations.

For an existing product, prefer incremental migration over a full redesign unless authorized.

---

## 2. Hard constraints

### H1 — Preserve the approved architecture

Honor the project's framework, rendering rules, design-system tooling, routing, state boundaries, data access, caching, offline strategy, deployment rules, and security model. Visual preferences do not authorize replacement of foundational technology. Use the platform's accessible semantic components. Custom rendering (Canvas, WebGL, SVG, native drawing) is permitted when suited to its purpose, but interactive functionality requires accessible alternatives where necessary. Do not invent parallel business logic in presentation code.

### H2 — Accessibility and input parity

Target **WCAG 2.2 AA** for web where applicable, with suitable platform-specific accessibility standards elsewhere. At minimum:

- Normal text contrast ≥ 4.5:1; large text ≥ 3:1; meaningful non-text UI indicators ≥ 3:1 (subject to the standard's scope and exceptions).
- Every important state is expressed beyond color alone. Focus is perceivable and not obscured.
- Interactive operations are accessible by keyboard or the platform-equivalent input; focus order follows the visual/task order. Touch, pointer, stylus, gamepad, screen reader, and keyboard alternatives are included as applicable.
- Pointer targets meet WCAG minimums where applicable; **24 × 24 CSS px** is the web AA target with specified exceptions, while **44 × 44 pt on iOS** and **48 × 48 dp on Android** are useful platform guidelines, not interchangeable units.
- Text resizing, zoom, orientation, and reflow preserve task completion at the project's required supported conditions. Avoid trapping focus or scroll.
- Alerts, form errors, status changes, and progress have suitable accessible announcements. Decorative animations never become essential to understanding.
- Honor reduced-motion, increased-contrast, forced-colors, and other user/system preferences where relevant.
- Controls use accurate semantics and accessible names. Never rely on hover exclusively.

### H3 — Correctness, provenance, and privacy

Use truthful labels and states. Do not present invented content, synthetic data, simulated events, fabricated reviews, or unverified calculations as actual facts. Clearly distinguish estimates, placeholders, forecasts, and examples. Do not expose unauthorized data through UI state, previews, tooltips, loading states, or hidden DOM attributes. Provide real privacy/legal controls when the project requires them.

### H4 — No broken or deceptive interface states

No interactive control may appear functional but be inert. Disabling an action must communicate the reason when useful. No content may become inaccessible through clipping, overlay collision, hidden overflow, unsupported zoom, or silent errors. Loading must not masquerade as success. Implement a recoverable fallback when network/media/data fails.

### H5 — Design-system integrity

No arbitrary isolated colors, font sizes, radii, shadows, durations, or spacing values in reusable components. Exceptions are allowed for calculated geometry, data-driven graphics, native APIs, and explicitly documented adaptive positioning. Use a semantic token or a registered component variant. Never force a one-off style solely to reproduce a screenshot at one resolution.

---

## 3. Required qualities: visual language

### R1 — Identity without generic-template dependence

Derive visuals from user needs, domain, product tone, and references. Each notable design choice must serve task hierarchy, state communication, context, or recognizable identity. Distinctiveness should emerge from composition, content, typography, graphic language, interaction, or important moments—not indiscriminate ornament. Minimalism must not erase affordances.

### R2 — Semantic color and theme system

Define tokens for canvas, base surface, raised surface, overlay, text primary/secondary/tertiary, borders, separator, action primary/secondary, selected, hover, pressed, focused, disabled, information, success, caution, error, and any domain-specific categories. Distinguish semantic state colors from data-series or brand colors. Support light/dark or system themes only where the brief requires them; **design each theme** rather than naively inverting hex codes. Test contrast in all states.

### R3 — Typography as information architecture

Specify families/fallbacks, sizes, line heights, weights, letter spacing, numeric styles, and truncation rules by semantic role: heading, section title, label, body, caption, metadata, code, and dense data as relevant. Use tabular numerals for aligned numerical values. Test actual font rendering and loading; avoid layout shift from fallback fonts. Define multiline and localization expansion behavior. Never solve hierarchy by arbitrarily adding more font sizes or bold weights.

### R4 — Materials, surfaces, depth, and separators

Create a restrained material hierarchy, selected according to product type:

| Role | Meaning | Preferred treatment |
|---|---|---|
| **Canvas** | Primary working context | Stable, quiet background |
| **Base surface** | Main content or persistent navigation | Tonal difference, boundary, or grouping |
| **Raised surface** | Inspector, floating panel, card used for meaningful containment | Restrained elevation or border |
| **Transient overlay** | Popover, menu, sheet, modal | Explicit anchoring and focus hierarchy |
| **Critical overlay** | Blocks consequential or unsafe continuation | Highest necessary attention, unambiguous dismissal and focus |

Blur, translucency, shadows, and glass are permitted **only** when they communicate layering, orientation, or identity. Avoid uniform shadows on every container, frosted-glass saturation, and stacking too many elevated surfaces. Optical grouping should rely first on spacing, typography, dividers, and alignment.

### R5 — Icons and visual symbols

Choose a coherent icon construction system (grid, stroke, fill, optical weight, corners, baseline). Icons must have stable meanings, readable silhouettes, and textual affordances where ambiguity or consequence requires them. Do not use emoji as a default icon library; permit emoji only where they are actual user content or a deliberate, accessible product feature. Create a legend for unfamiliar domain symbols. Icons with different source styles must be normalized or replaced.

### R6 — Information hierarchy and density

Use three disclosure levels: **visible now**, **one interaction away**, and **on demand**. Primary tasks and decision-relevant information must appear together when practical. Prefer carefully aligned lists, tables, master-detail views, and responsive data compositions to indiscriminate cards. Define density modes only when the product benefits; a compact data workstation should not force compactness onto onboarding or creative experiences. Avoid duplicate headings, labels, helper text, and redundant containers.

---

## 4. Required qualities: spatial composition and layout

### R7 — Coherent application shell and view families

For application-style products, define the persistent shell: global navigation, local navigation, toolbar/command area, primary canvas/content, contextual inspector, status/notification region, and transient layers **as applicable**. Name the page/view families: overview, list, detail, editor, map, canvas, workspace, form, dashboard, onboarding, marketing, or immersive view. Each family must declare information hierarchy and navigation rules.

The shell must feel like one system, not unrelated pages. Navigation and recurring control positions remain predictable. **Do not require a three-pane desktop shell on every product**: a simple consumer mobile flow may need only one primary view, while an expert workstation may use multiple panes.

### R8 — Precision geometry and optical alignment

Use a documented spacing rhythm and alignment grid. Define section margins, toolbar height, panel header anatomy, baseline alignment, inter-control spacing, icon-label offsets, divider placement, and content measure. Align numbers by decimal or tabular grid where beneficial. Test **optical alignment** as well as geometric centering: strokes, glyphs, icons, and text may need tokenized corrections. Geometry must be coherent across sibling views, not merely internally valid within each component.

### R9 — Explicit containment and resizing contracts

Each substantial region must declare:

- **Minimum, preferred, and maximum extent** (or an equivalent intrinsic sizing rule), including height behavior.
- Growth priority, wrapping, truncation, clipping, scrolling, and responsive substitution.
- Whether it can collapse, resize, overlay, dock, or detach; how resizing works by pointer/keyboard/touch where supported.
- Scroll ownership, focus behavior, sticky elements, and persistence of user-adjusted sizes.
- Behavior for long text, large numbers, high zoom, small heights, empty data, and loading content.

**Critical rule:** When available space shrinks, reorganize or disclose secondary content before crushing essential controls. A layout may never preserve a nominal column count by making its content unusable. Avoid unnecessary nested scrolling and unintended whole-page horizontal overflow. In application shells, background areas must not scroll unexpectedly when an inner panel scrolls.

### R10 — Adaptive behavior, not just responsive breakpoints

Specify supported device classes, minimum usable viewport/window dimensions, and both width **and height** states. Define changes in navigation, inspector placement, command priority, column count, chart/table representation, input affordances, and gestures. Use intrinsic layout/container queries or equivalent mechanisms where appropriate. Design mobile, touch, and small-window views for their actual tasks—not as compressed desktop screenshots. If a viewport is intentionally unsupported, show an actionable explanation rather than a broken interface.

### R11 — Spatial persistence and predictable context

Selection should preserve relevant context; reopening tools should feel consistent. Avoid unexpected position changes when panels open, content loads, or errors appear. Support restoration of safe workspace preferences when the project benefits (panel widths, selected view, density, filters, zoom), without persisting sensitive or misleading state. Navigation from a list to detail and back should preserve position and filters where expected.

---

## 5. Required qualities: interaction and motion

### R12 — Recognizable interactions and progressive disclosure

Users should infer what a view is for, what is actionable, and what happened. Keep routine controls conventional for the target platform. Provide keyboard shortcuts for expert/high-frequency tasks where useful, but never require memorization. Use commands, previews, validation, undo, and confirmation appropriate to risk. Display why a feature is unavailable, including prerequisites where known. Onboarding guides the first successful task and can be dismissed/revisited.

### R13 — Component anatomy and states

Every reused component must be specified by **anatomy**, not just name: internal regions; control placement; typography; paddings; icon alignment; interactions; keyboard behavior; visual states; accessibility; adaptive behavior; and empty/overflow handling. Register variants by use case, not page name. Required states as applicable: default, hover, focus, pressed, selected, expanded, disabled, loading, error, success, and read-only.

Dialog actions occupy predictable places. Use one clear primary action per decision group. Reserve destructive styling for genuine destruction. Tooltips explain, menus select, popovers offer brief contextual operations, and dialogs/sheets handle focused interruption; do not substitute one merely because it is visually convenient.

### R14 — Semantic motion grammar

Animation must express **causality, continuity, orientation, feedback, or hierarchy**. Define named tokens and use one motion treatment for each semantic category. Do not animate everything, use `transition: all`, or add continuous decoration without a clear product reason.

**Initial calibration ranges—adjust and validate per project:**

| Event | Suggested range | Intended behavior |
|---|---:|---|
| Press/active feedback | 70–110 ms | Immediate tactile acknowledgment |
| Hover/focus background | 100–150 ms | Subtle affordance signal |
| Tooltip | 120–180 ms | Light appearance; no displacement of surrounding content |
| Expand/collapse | 160–260 ms | Reveal structure while preserving orientation |
| Sidebar/inspector change | 180–300 ms | Coordinated resizing and content adaptation |
| Popover/modal/sheet | 180–300 ms | Anchored, coherent entrance and exit |
| Related-view navigation | 180–320 ms | Clear spatial relationship or restrained crossfade |
| Multi-step process | Event-dependent | Skippable and reviewable when appropriate |

Timing must remain subordinate to responsiveness. Reduced-motion mode removes nonessential travel, zoom, parallax, and large transforms, preserving content and status meaning through immediate or restrained nonspatial transitions.

### R15 — Motion choreography, interruption, and continuity

Define transitions as **systems of related elements**, not independent per-component effects. An inspector update might synchronize selection emphasis, layout adjustment, data replacement, and focus. Opening and closing should be directionally consistent. Animations must be interruptible and reversible where the interaction is reversible; fast repeated input must settle in the correct final state. Prevent stale animations from overriding newer selections. Avoid making low-priority movement compete with urgent alerts. Verify the final layout and screen-reader announcements after transitions.

### R16 — Feedback, undo, and recovery

A user action receives immediate acknowledgment independent of network completion. Distinguish **started**, **pending**, **completed**, and **failed**. Avoid optimistic UI when it would imply irreversible success. Confirm irreversible or high-risk actions; offer undo for reversible changes where feasible. Async operations should provide progress when duration warrants it, and cancellation when supported. Error messages explain what happened, what is preserved, and the next useful action.

### R17 — Complete component and product states

Implement and test applicable loading, skeleton, empty, no-results, offline, stale, partial, unauthorized, locked, disabled, saving, saved, validation, conflict, failed, success, and interrupted states. Do not use skeletons that visibly reshuffle the layout when data arrives. Avoid dead-end empty states. Preserve edits where safe when a submission fails.

### R18 — Performance and perceptual stability

Responsiveness is part of visual quality. Set device-specific performance budgets for interaction latency, animation smoothness, layout shift, content readiness, and heavy-data operation. Prefer compositor-friendly motion for suitable properties, but do not trade correctness for superficial GPU animation. Avoid forced synchronous layout reads, unnecessary re-rendering, oversized blurs, unbounded lists, and synchronous processing that stalls input. **Aim for display-rate-consistent motion on reference hardware**, and measure rather than asserting “60 fps” without evidence. Include slower devices and reduced-power conditions where relevant.

---

## 6. Consistency, writing, sound, and specialized interfaces

### R19 — System-wide semantic consistency

One concept should have one canonical name, one stable symbol, and a predictable interaction pattern. Colors, error treatment, placement, spacing, visual states, motion, and feedback must map to semantic roles, not be improvised view by view. A new token or component variant needs a use case and registry update. Shared changes must be checked across affected screens.

### R20 — Writing and comprehension

Use clear, precise, task-specific wording. Provide a `VOICE.md` when the project has substantial UI text, instructional messaging, domain vocabulary, or narrative. Define terminology, date/number/unit conventions, truncation, error phrasing, helper text, and accessible labeling. Avoid excessive microcopy, redundant explanation, ambiguous buttons, and unexplained acronyms. Where uncertainty exists, state it rather than falsely implying certainty.

### R21 — Audio when applicable

If sound exists, define purpose, semantic roles, palette, volume hierarchy, repetition tolerance, mute/preferences, and visual equivalents in `AUDIO.md`. Playback must respect browser/platform policies and user preferences. Do not add generic hover clicks or whooshes just to simulate polish. If the product is intentionally silent, this requirement is not applicable.

### R22 — Specialized visualization

Maps, graphs, network diagrams, timelines, canvases, rich editors, 3D scenes, and games may require specialized rendering. Define selection, pan/zoom, gestures, legend, accessibility alternative, resolution scaling, performance, loading, and persistence appropriate to the medium. Do not force conventional card layouts or DOM-only rendering onto interfaces for which they are technically or cognitively unsuitable.

---

## 7. Defaults requiring justification (J)

These are **not universal bans**. A decision log must explain why they fit this particular product and what alternatives were considered.

| ID | Default to challenge | Failure mode to guard against |
|---|---|---|
| J1 | Trend-driven gradients, neon, generic pastel sets, predictable blue/violet palettes | Unowned identity and decorative state colors |
| J2 | A fashionable typeface chosen by habit | Poor information fit or bland visual sameness |
| J3 | Glass, blur, glow, oversized shadows, excessive translucency | Depth without hierarchy; expensive rendering |
| J4 | Repeated large rounded cards, bento grids, three equal columns | Template-driven composition, wasteful density |
| J5 | Floating navigation everywhere, persistent bottom bars, overbuilt dashboards | Wrong navigation for the workflow |
| J6 | Scale-on-hover, hovering/lifting cards, bounce, idle loops, generic whooshes | Motion divorced from causality |
| J7 | Fake OS chrome, gimmicky traffic-light buttons, literal imitation of Apple controls | Platform confusion or borrowed identity |
| J8 | Excessive icon-only buttons, low-contrast minimalist controls | Weak discoverability and accessibility |
| J9 | Hard-coded widths, manual truncation, absolute positioning for normal layout | Viewport breakage and clipped information |
| J10 | Replacing a flagged trend with another trend | Aesthetic substitution without rationale |

**Exception record:** `ID / where / choice / user or product benefit / alternative rejected / known trade-off / reviewer / validation evidence`.

---

## 8. Verification and release gates

### 8.1 Automated checks

Apply scope-aware linting and testing for:

- Raw styling values bypassing the approved token/theme system; unregistered component variants; inconsistent semantic roles.
- Invalid or missing labels, focus styles, ARIA semantics, keyboard support, and contrast; test with appropriate accessibility automation and manual checks.
- Unapproved external assets/dependencies, unsupported data presentation, inert controls, and placeholder or fabricated production content.
- Unjustified `transition: all`, infinite motion, unrelated animation durations, and missing reduced-motion handling.
- Viewport/document horizontal overflow, geometry collisions, content outside scroll regions, offscreen dialogs, clipped actions, and overlapping sticky layers.
- Runtime errors, failed interactions, regressions, and layout shift from loading states.

Automated lint patterns are heuristics; favor AST-aware or platform-native rules over crude regexes. Scope exceptions for legitimate data visualization and calculated geometry. Do not fail valid code merely for containing a permitted symbol or framework internal.

### 8.2 Visual audit matrix

Capture **each representative view family and significant state** at every supported minimum and target viewport, including minimum supported height, high zoom/text enlargement, a long-content fixture, empty state, and active overlay. For adaptive layouts, also capture each meaningful reflow threshold. Compare light/dark themes where provided.

Inspect: (1) macro composition; (2) grid and baseline alignment; (3) typography and label lengths; (4) surface/elevation coherence; (5) icon optical weight; (6) panel constraint behavior; (7) scrolling/overflow; (8) interaction affordance; (9) motion entrance/exit/end state; (10) data and semantic correctness.

### 8.3 Interaction audit

Perform primary workflows using keyboard and applicable alternative input. Open/close every transient layer; resize/dock relevant panels; navigate away and back; trigger error, stale, empty, and loading conditions; undo where supported; switch preferences; change text size; repeat actions rapidly; and attempt interruption during an active transition. Confirm predictable focus and correct final state.

### 8.4 Performance audit

Measure on declared reference hardware: interaction latency, frame consistency during transitions, long tasks, loading/layout shifts, and rendering under realistic data density. Report measurements and test conditions; do not claim optimized performance based only on a smooth developer workstation.

### 8.5 Human usability test

Use task-based observation with at least 3–5 target users for an early directional test where feasible, expanding sample sizes for important accessibility and population differences. Ask users to accomplish goals, not follow click instructions. Record hesitations, misread labels, recovery attempts, and wrong turns. Prioritize recurrent failures; do not treat the absence of 3-person complaints as validation that everyone succeeds.

### 8.6 Release conformance report

At the end of each meaningful implementation session or release, record: scope changed; checks executed; supported viewports/states reviewed; accessibility findings; usability evidence versus proxy assumptions; performance measurements; modified design artifacts; approved exceptions; open blockers; screenshots and test links. A missing test must be marked **not run**, never silently passed.

---

## 9. Reference implementation requirement

Before major UI expansion, implement and validate a reusable reference slice appropriate to the product. Examples:

- **Workstation/dashboard:** navigation shell + list/table + contextual inspector + dialog + state transitions.
- **Consumer/mobile:** core task flow + navigation + form + loading/error + transition.
- **Map/data tool:** renderer + selection + details + legend + data-empty/error behavior.
- **Creator/editor:** canvas + toolbar + properties + undo + save/conflict behavior.
- **Marketing/content:** typography + responsive editorial composition + navigation + forms + media states.
- **Game/immersive:** primary HUD/view + menus + contextual action + input parity + state transition.

Treat the reference slice as the team's shared implementation baseline and regression fixture. Do not blindly copy its layout into unrelated view families.

---

## Appendix A — Project configuration template (`DESIGN_BRIEF.md`)

```md
# Project Design Brief

## Product and users
- Product:
- Core user outcomes and primary tasks:
- User types, expertise, accessibility needs:
- Session context, device classes, input methods:

## Platform and architecture
- Stack and authoritative architecture documents:
- Existing component/design system:
- Platform conventions to honor:
- Supported window/viewport sizes (min / target / max, width AND height):
- Known technical constraints:

## Experience direction
- Tone words and concrete visible consequences:
- Brand identity and domain materials:
- References (specific feature to adopt / avoid):
- Information priority (persistent / one action away / on demand):
- Navigation and view families:
- Density modes and default:
- Novelty budget (up to three justified deviations):

## Quality budgets
- Accessibility standard and testing requirements:
- Motion preference and performance targets / reference devices:
- Responsive/reflow expectations:
- Acceptance tests for first successful task:
- Out of scope and deliberate exceptions:
```

## Appendix B — Layout specification template (`LAYOUT_SPEC.md`)

```md
# Layout Specification

| View family | Region | Purpose | Min / ideal / max extent | Priority | Reflow/collapse | Scroll owner | Persistence |
|---|---|---|---|---|---|---|---|
| <view> | <region> | <task> | <responsive rule> | <primary/secondary> | <behavior> | <region> | <yes/no> |

## Breakpoint and height transitions
- Transition threshold or content-based condition:
- Navigation changes:
- Inspector/sidebar changes:
- Table/content changes:
- Focus and keyboard behavior:

## Stress fixtures
- Longest anticipated label:
- Large/negative/unknown numeric value:
- Empty/loading/partial data:
- High-zoom minimum usable view:
```

## Appendix C — Component registry template (`COMPONENTS.md`)

```md
# Component Registry

## <Component>
- Purpose and owning interaction pattern:
- Anatomy (named regions and hierarchy):
- Variants and reasons:
- States and transitions:
- Semantic tokens and typography roles:
- Size/spacing/optical alignment:
- Keyboard, touch, focus and screen reader contract:
- Long-content and adaptive behavior:
- Error/empty/loading handling:
- Usage examples / anti-patterns:
- Screens where used:
```

## Appendix D — Motion specification template (`MOTION_SPEC.md`)

```md
# Motion Specification

| Semantic event | Trigger | Affected elements | Motion token | Duration/easing | Interruption rule | Reduced-motion behavior |
|---|---|---|---|---|---|---|
| <event> | <action> | <elements> | <token> | <values> | <cancel/reverse/finish> | <replacement> |

## Global choreography
- Navigation directionality:
- Selection/context changes:
- Modal and overlay layering:
- Concurrent animations and priority:
- Async data and stale selection guards:
- Performance/test targets:
```

## Appendix E — Agent instructions (paste into `AGENTS.md`, `CLAUDE.md`, etc.)

```md
## Universal UI Design Contract

Follow `UNIVERSAL_DESIGN_STANDARDS.md` for all UI and interaction work.
This document is project-agnostic: resolve product-specific design choices in
`DESIGN_BRIEF.md` and the project's approved architecture. Do not assume a
framework, style, palette, or application shell unless the project calls for it.

Before major UI changes, inspect existing patterns; review DESIGN_BRIEF,
DESIGN_TOKENS, LAYOUT_SPEC, COMPONENTS, INTERACTION_PATTERNS, MOTION_SPEC,
and DESIGN_DECISIONS. Create or update missing relevant artifacts proportionally.

Use semantic tokens and shared components. Build cohesive layouts with explicit
min/preferred/max constraints, correct scroll ownership, resilient content
containment, and width/height-responsive behavior. Preserve conventional
platform interactions, keyboard/accessibility semantics, and user context.

Use motion to express causality and continuity. Coordinate related transitions;
make them interruptible and reduced-motion safe. Avoid generic template styling,
decorative animation, crushed columns, clipped text, and inert controls.

Before declaring completion, capture representative screens and edge states at
specified viewports, test primary workflows, audit geometry and accessibility,
measure performance where applicable, and record exceptions plus untested areas.
Do not claim tests or human usability research that were not actually performed.
```

## Appendix F — Design decisions log template

```md
## [Rule / component / view] Decision title
- Location:
- Decision and semantic purpose:
- User need / evidence:
- Alternative considered:
- Trade-off and risks:
- Approved by / date:
- Validation and screenshot/test reference:
```

---

**End of standard.** Every project must supply its own identity, architecture, constraints, and measured acceptance criteria. Quality is measured by usable, consistent behavior in realistic states—not by resemblance to any single operating system.
