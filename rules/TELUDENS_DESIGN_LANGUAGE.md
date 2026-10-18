# TELUDENS DESIGN LANGUAGE

**Version 1.0 · Product design language · Teludens Lab**

> **Design objective:** Teludens interfaces should feel like precision computational instruments for strategic thought: calm, immediate, spatially coherent, information-dense when necessary, and unmistakably Teludens even when the logo is absent.

This document is the opinionated Teludens layer above `UNIVERSAL_DESIGN_STANDARDS.md`. The universal standard defines quality invariants; this document defines identity, product feel, semantic visual language, and reusable system behavior for Teludens products including Plenum.

---

## 0. Design thesis

Teludens combines three design responsibilities:

- **Apple-like interaction quality:** immediacy, continuity, direct manipulation, perceptual stability, progressive disclosure, restrained motion.
- **Adobe-like professional-tool architecture:** scalable component systems, panels, inspectors, command surfaces, density, complex-workflow support.
- **Teludens cognitive identity:** actors, decisions, branches, paths, gates, states, consequences, evidence, and time are first-class visual and interaction concepts.

The result must never look like a literal imitation of macOS, Spectrum, a generic SaaS dashboard, a military terminal, or a sci-fi HUD.

### 0.1 Core experience principles

1. **Calm computational power** — capability is deep; presentation is restrained.
2. **Structure before decoration** — hierarchy comes from geometry, alignment, typography, tone, and state.
3. **Direct manipulation** — state changes should preserve object continuity where possible.
4. **Progressive density** — Focus, Standard, and Operations modes share one architecture at different compression levels.
5. **Consequence-aware UI** — information, interpretation, intention, action, and consequence are visually distinguishable.
6. **Motion communicates causality** — animation explains what changed, where it came from, and what it now affects.
7. **Signal scarcity** — strong color and motion are reserved for meaningful attention.
8. **Operational legibility** — live simulation state, ownership, time, dependencies, unresolved items, and system status remain immediately interpretable.

---

## 1. Relationship to universal standards

Teludens MUST follow `UNIVERSAL_DESIGN_STANDARDS.md`. Where this document is more specific and does not conflict with accessibility, architecture, semantics, or product requirements, this document takes precedence for Teludens products.

Required companion artifacts:

- `EXPERIENCE_PHYSICS.md`
- `SPATIAL_GRAMMAR.md`
- `TELUDENS_TOKENS.json`
- product-local `DESIGN_BRIEF.md`
- product-local `LAYOUT_SPEC.md`
- product-local `COMPONENTS.md`
- product-local `INTERACTION_PATTERNS.md`
- product-local `MOTION_SPEC.md`
- `PLENUM_REFERENCE_SLICE.md` for Plenum until superseded by an approved v2 reference slice

---

## 2. Identity language

### 2.1 Personality

Teludens is:

- precise
- cerebral
- restrained
- consequential
- modern
- technically confident
- institutional without bureaucracy
- premium without luxury theatrics

Teludens is not:

- bubbly
- playful by default
- glossy for its own sake
- aggressively futuristic
- militaristic by aesthetic shortcut
- card-heavy
- terminal-themed
- neon cyberpunk
- over-animated
- visually noisy

### 2.2 Recognizable identity without the logo

A Teludens interface should remain recognizable through the combined use of:

- continuous working surfaces instead of card mosaics
- strong shared axes and precise hairline boundaries
- decision topology motifs: Node / Branch / Path / Gate / State
- Electric Vermilion as a scarce decision signal
- warm neutral material palette
- compact technical metadata paired with calm editorial body typography
- explicit state rails, actor ownership, and consequence relationships
- quiet motion that preserves spatial continuity

No single device above is sufficient by itself. Identity emerges from the system.

---

## 3. Semantic material system

### 3.1 Material roles

| Token | Meaning | Typical use |
|---|---|---|
| `material/canvas` | outer product environment | page/app background |
| `material/workspace` | principal working field | map, canvas, editor, operational view |
| `material/surface` | persistent local grouping | sidebars, persistent panels |
| `material/surface-raised` | context brought above the base plane | inspector, contextual panel |
| `material/surface-recessed` | region visually behind the working plane | wells, timelines, logs |
| `material/overlay` | transient context | popover, menu, command palette |
| `material/control` | neutral control substrate | buttons, segmented controls, fields |
| `material/control-hover` | hover feedback | pointer affordance |
| `material/control-pressed` | press feedback | tactile state |
| `material/selection` | selected but not necessarily active | selected row/node |
| `material/focus` | keyboard or explicit focus | focus ring/background support |
| `material/scrim` | modal interruption | backdrop only when needed |

Surfaces should normally be distinguished by tone, separator, and spacing before shadow.

### 3.2 Boundary hierarchy

Use three boundary strengths:

- `boundary/subtle` — internal grouping and low-attention separation
- `boundary/standard` — panel and structural boundaries
- `boundary/strong` — active split, resize affordance, selected structural boundary

Avoid outlining every container.

### 3.3 Elevation

Elevation is semantic, not decorative.

- **E0:** canvas/workspace — no shadow
- **E1:** persistent raised surface — usually no shadow; tonal separation preferred
- **E2:** floating transient surface — restrained soft shadow + boundary
- **E3:** modal/critical interruption — stronger separation only when required

Never apply shadow to routine cards merely to imply polish.

---

## 4. Signal and semantic color system

### 4.1 Electric Vermilion

Electric Vermilion is Teludens' signature **decision signal**.

Primary signal primitive:

- `signal/vermilion/500`: `#F24B35`

Use it for:

- active decision path
- current state indicator
- active node
- execution marker
- selected consequence path where brand emphasis is appropriate
- primary brand moments
- current/now marker on a state rail

Do not use it automatically for:

- every primary button
- all links
- all selected rows
- generic notifications
- destructive actions
- validation errors
- decorative borders

### 4.2 Semantic colors

Brand, operational status, and validation semantics are separate.

- **Brand / Decision signal:** Electric Vermilion
- **Information:** Cobalt
- **Success / resolved:** Field Green
- **Caution / attention:** Amber
- **Error / destructive:** Crimson
- **Neutral state:** warm graphite scale

A destructive action must use `semantic/error`, not Vermilion, unless a product-specific brief explicitly documents a dual-role exception.

### 4.3 Attention hierarchy

Teludens uses six attention levels:

| Level | Meaning | Expression |
|---|---|---|
| A0 Ambient | environmental context | low contrast, no motion |
| A1 Context | useful persistent context | secondary typography |
| A2 Relevant | relevant to current task | standard contrast |
| A3 Actionable | available next action | clear control affordance |
| A4 Immediate | requires near-term attention | selective signal color / stronger placement |
| A5 Critical | safety, irreversible consequence, blocking failure | explicit semantic color, persistent interruption if justified |

A component's attention level may influence contrast, persistence, placement, motion, and interruption. Do not use motion to promote A0-A2 content.

---

## 5. Typography

### 5.1 Typographic split

Teludens uses two typographic personalities.

**Brand / institutional typography** may use:

- uppercase
- wide tracking
- sparse composition
- large display scale

**Product interface typography** must prioritize scanning:

- sentence case by default
- tighter tracking
- stronger weight differentiation
- tabular numerals for aligned time/data
- restrained mono usage

The current broad use of extremely wide uppercase tracking is reserved for brand moments, section markers, and occasional operational labels—not general interface copy.

### 5.2 Semantic roles

Required roles:

- Display
- Heading
- Title
- Body
- Label
- Detail
- Control
- Code
- Numeric
- Operational
- State
- Telemetry

### 5.3 Typeface policy

Version 1 defaults to **Inter** for the core product UI because it is robust, neutral, and widely available. Teludens may later license a more distinctive primary grotesk if rendering, licensing, internationalization, and implementation tests justify the change.

Recommended monospaced companion: a high-quality neutral mono selected per implementation environment. Mono should generally occupy no more than 5–10% of a typical interface and is reserved for telemetry, identifiers, timestamps, coordinates, code, and aligned operational data.

---

## 6. Density system

Teludens supports three density modes. Density changes information compression, not conceptual hierarchy.

### 6.1 Focus

Use for:

- briefing
- onboarding
- decision review
- consequential confirmation
- reading-heavy views

Targets:

- toolbar/control height: ~48 px
- list row: ~44 px
- base body: 15–16 px
- panel padding: 20–24 px
- section gap: 24–32 px
- low simultaneous control count

### 6.2 Standard

Default product mode.

Targets:

- toolbar/control height: ~40–44 px
- list row: ~36 px
- base body: 14–15 px
- panel padding: 16 px
- section gap: 20–24 px

### 6.3 Operations

Use for:

- facilitators
- White Cell
- analysts
- monitoring
- high-frequency simulation operations

Targets:

- toolbar/control visual height: ~36–40 px
- list row visual height: ~28–32 px
- base body: 13–14 px
- panel padding: 10–12 px
- section gap: 12–16 px
- persistent metadata and status summaries

**Important:** visual compression must not create unusably small hit targets. Keyboard access, target envelopes, focus visibility, and touch adaptation remain compliant with the universal accessibility contract.

### 6.4 Density transitions

Density changes MUST NOT:

- reorder core information unexpectedly
- hide required action state
- change canonical labels
- alter semantic color meaning
- change object identity

Density MAY:

- tighten paddings and gaps
- reduce secondary metadata spacing
- move tertiary content behind disclosure
- reduce illustration/empty-state footprint
- collapse nonessential labels into tooltips where accessibility remains intact

---

## 7. Component philosophy

### 7.1 Continuous surfaces over card mosaics

Default to:

- panels
- split views
- master-detail
- lists
- tables
- canvases
- inspectors
- timelines
- command surfaces

Use cards only when an object is truly discrete, portable, comparable, or independently actionable.

### 7.2 Core component families

Foundational components:

- Button
- Icon Button
- Split Button
- Segmented Control
- Text Field
- Search Field
- Select / Combo Box
- Checkbox
- Radio
- Switch
- Menu
- Popover
- Tooltip
- Dialog / Sheet
- Toast / Status Message
- Tabs
- Tree / Outline
- Table / Data Grid primitives
- Badge / State Chip
- Divider / Resize Handle
- Toolbar / Command Bar
- Navigation Item
- Inspector Section

Operational components:

- Actor
- Decision
- Proposal
- Action
- Event
- RFI
- Observation
- Timeline Marker
- State Rail
- Gate
- Dependency
- Adjudication Record
- Evidence Link
- Outcome / Consequence

### 7.3 Interaction states

Where applicable:

- default
- hover
- focus
- pressed
- selected
- expanded
- disabled
- loading
- pending
- error
- success
- read-only
- conflict/stale

Hover should normally change tone, boundary, icon/text emphasis, or cursor. Generic lift, translation, and scale-on-hover are prohibited unless a documented interaction metaphor requires movement.

---

## 8. Node / Branch / Path / Gate / State grammar

This grammar is the primary proprietary visual language of Teludens products.

### 8.1 Node

**Meaning:** an actor, decision point, event, object, or state-bearing entity.

Visual rules:

- compact point or bounded object
- explicit selected/active state
- may expose ports only when relationships are editable
- must not be styled as a generic glowing orb

### 8.2 Branch

**Meaning:** a divergence into alternatives, competing decisions, scenarios, or consequences.

Visual rules:

- divergence must have a legible source
- alternatives use consistent geometry
- branch labels sit close to the divergence, not arbitrarily on lines
- visual weight may encode probability/importance only when explicitly defined

### 8.3 Path

**Meaning:** continuity, influence, sequence, dependency, ownership transfer, or causal trace.

Visual rules:

- path direction must be interpretable
- active path may use Electric Vermilion
- historical paths become neutral/quiet
- unresolved/future paths may use dashed or reduced-emphasis treatment
- path animation is allowed only for meaningful live transition

### 8.4 Gate

**Meaning:** prerequisite, approval, adjudication, threshold, dependency, or controlled transition.

Visual rules:

- gate must state the condition or status
- open / waiting / blocked / failed are distinct beyond color
- gates interrupt or mediate paths rather than float decoratively

### 8.5 State

**Meaning:** the current condition of an entity or simulation process.

Visual rules:

- state is explicit text plus optional symbolic treatment
- current state is stronger than historical/future states
- state change preserves object identity
- timestamps and actor ownership accompany consequential changes where relevant

### 8.6 Canonical state rail

Example:

`ORIENT  ━━━━━  ACTION  ─────  ADJUDICATE  ─────  RESOLVE`

Current phase is indicated by position, typography, and selective signal—not color alone.

---

## 9. Navigation and command architecture

### 9.1 Persistent shell

Desktop Plenum-class products may use:

- global app/navigation rail
- scenario/session context bar
- primary workspace
- contextual inspector
- simulation state rail
- status/activity region
- transient command/overlay layer

Not every product requires all regions.

### 9.2 Command layer

Teludens products with expert/high-frequency workflows SHOULD expose a global command palette.

Default shortcut:

- macOS: `⌘K`
- Windows/Linux: `Ctrl+K`

Command categories may include:

- navigation
- search
- object creation
- simulation actions
- state changes
- view changes
- role/session operations

Commands must use the same canonical language as visible UI.

---

## 10. Motion language

The product interaction language uses sub-300 ms choreography for routine UI.

Default calibration:

| Event | Duration |
|---|---:|
| Press acknowledgment | 70–90 ms |
| Hover/focus | 90–120 ms |
| Selection/state emphasis | 110–150 ms |
| Tooltip | 130–170 ms |
| Menu/popover | 150–190 ms |
| Modal/sheet | 180–230 ms |
| Inspector/docked panel | 180–240 ms |
| Related-view transition | 220–280 ms |
| Major causal/spatial transformation | 260–400 ms only when necessary |

Generic 1+ second fades, staggered page reveals, continuous floating, bounce, and hover scaling are not part of the Teludens product grammar.

See `EXPERIENCE_PHYSICS.md` for interruption, reversal, continuity, and async behavior.

---

## 11. Spatial language

Teludens uses:

- 4 px atomic geometry
- strong shared axes
- optical alignment corrections
- low-radius geometry
- sparse elevation
- bounded panel resizing
- explicit scroll ownership
- controlled asymmetry
- responsive transformation based on content priority

See `SPATIAL_GRAMMAR.md`.

---

## 12. Plenum canonical reference slice

Before broad Plenum redesign, the following slice MUST be implemented and approved:

1. application shell
2. global + local navigation
3. simulation state rail
4. primary workspace
5. contextual inspector
6. modal/dialog
7. command palette
8. proposal flow from creation through facilitator/White Cell handoff

This slice is the canonical regression fixture and design baseline for subsequent screens.

Do not extrapolate unapproved patterns across Plenum before this slice passes visual, interaction, accessibility, and performance review.

See `PLENUM_REFERENCE_SLICE.md`.

---

## 13. Product-level acceptance criteria

A Teludens interface is conformant only when:

- the logo can be removed without the product becoming visually generic
- Electric Vermilion remains scarce and meaningful
- components use semantic tokens instead of raw styling values
- all density modes preserve hierarchy and usability
- routine motion remains responsive and interruptible
- generic hover lift/scale and persistent decorative motion are absent
- object/state transitions preserve context
- Node / Branch / Path / Gate / State semantics remain consistent
- workstation views use continuous surfaces and inspectors rather than card mosaics
- keyboard and command workflows exist where high-frequency use warrants them
- the Plenum reference slice remains a passing regression fixture for shared patterns

---

## 14. Design review question

Every major Teludens UI review should end with one question:

> **Does this interface make the structure of the decision clearer, or has the design merely made the interface prettier?**

If the answer is only the latter, the design is incomplete.
