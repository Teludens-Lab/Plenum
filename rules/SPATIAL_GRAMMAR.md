# TELUDENS SPATIAL GRAMMAR

**Version 1.0 · Layout, geometry, surfaces, and composition**

> Teludens spatial design should make complex systems feel ordered without making them simplistic. Geometry is the primary carrier of identity.

---

## 1. Atomic geometry

Base unit: **4 px**.

Most spacing, padding, control sizing, and alignment should resolve to multiples of 4 px unless optical correction requires otherwise.

### Spacing scale

- 2 — optical micro-adjustment only
- 4 — xxs
- 8 — xs
- 12 — sm
- 16 — md
- 20 — lg
- 24 — xl
- 32 — 2xl
- 40 — 3xl
- 48 — 4xl
- 64 — 5xl
- 80 — 6xl

Do not create arbitrary spacing values in reusable components.

---

## 2. Composition principles

### 2.1 Shared axes

Prefer strong shared horizontal and vertical axes across:

- panel headers
- lists
- tables
- inspector fields
- state rails
- timeline events
- form labels
- toolbars

Related content should visibly belong to the same geometry.

### 2.2 Continuous working surfaces

Primary workspaces should be continuous planes.

Avoid:

- dashboard bento grids
- cards nested inside cards
- every dataset becoming a rounded container
- equal three-column layouts by default

Use:

- split regions
- restrained tonal bands
- separators
- alignment
- whitespace
- persistent inspectors

### 2.3 Controlled asymmetry

Symmetry is not required. Teludens may use asymmetrical composition when it reflects information priority.

Example:

A dominant simulation workspace may occupy 70–80% of the width while the inspector occupies the remainder.

Avoid arbitrary asymmetry used only for visual novelty.

---

## 3. Application shell

Canonical desktop shell regions:

1. **Global navigation rail / sidebar**
2. **Context bar** — scenario, session, role, status
3. **Simulation state rail**
4. **Primary workspace**
5. **Contextual inspector**
6. **Activity/status region** where required
7. **Transient layer** — menus, command palette, dialogs

Products may omit irrelevant regions.

### 3.1 Shell rules

- recurring controls remain spatially stable
- navigation does not resize unpredictably based on page content
- workspace owns the largest continuous visual field
- inspector appears adjacent to the content it explains
- status and live state remain visible without dominating the workspace

---

## 4. Panel geometry

### 4.1 Side navigation

Desktop guidance:

- collapsed rail: ~52–64 px
- standard navigation: ~220–280 px
- width may be user-resizable if workflow warrants

### 4.2 Inspector

Desktop guidance:

- minimum: ~280 px
- preferred: ~340–420 px
- maximum: ~520 px unless content requires more

Inspector content should reflow before the workspace is crushed below its minimum useful width.

### 4.3 Docking states

Supported patterns when relevant:

- docked right
- docked left
- collapsed
- resized
- floating transiently
- detached only if product architecture supports it

Persist safe user preferences such as width where useful.

---

## 5. Surface geometry

### Radius scale

Teludens uses restrained corner geometry.

- `radius/none`: 0
- `radius/xs`: 3 px
- `radius/sm`: 5 px
- `radius/md`: 8 px
- `radius/lg`: 12 px — transient surfaces only
- `radius/full`: pills, toggles, circular controls only

Do not apply large radii to every panel.

### Boundaries

Default structural dividers are 1 px.

Resize boundaries may use a larger invisible hit zone than the visible line.

---

## 6. Density geometry

### Focus

- row: 44 px
- control: 44–48 px
- panel padding: 20–24 px
- section gap: 24–32 px
- toolbar: 48 px

### Standard

- row: 36 px
- control: 40–44 px
- panel padding: 16 px
- section gap: 20–24 px
- toolbar: 44 px

### Operations

- visual row: 28–32 px
- control: 36–40 px
- panel padding: 10–12 px
- section gap: 12–16 px
- toolbar: 40 px

Touch-first layouts should adapt interaction target size independently of visual density.

---

## 7. Typography geometry

Text alignment is part of the grid.

- headings align with content edges, not container decoration
- tabular numeric columns align consistently
- labels use stable measures where forms require rapid scanning
- technical metadata may use mono/tabular numerals without disturbing body rhythm
- baseline alignment is preferred over geometric centering when icon + text optical weights differ

---

## 8. Node / Branch / Path / Gate / State geometry

### Node

Recommended visual footprints:

- micro node: 8–12 px when purely relational
- standard node marker: 16–24 px
- object node: content-sized bounded element

### Branch

Branches should diverge on a clean angular or curved geometry defined by the visualization context.

Rules:

- avoid random spaghetti lines
- minimize edge crossings
- preserve readable source-to-outcome direction
- align sibling branch labels where possible

### Path

Path weights:

- ambient/history: 1 px
- normal relationship: 1–1.5 px
- active path: 2 px or equivalent emphasis
- critical/selected path: up to 2.5 px where needed

Do not encode every distinction with thickness.

### Gate

A gate sits on or directly adjacent to the path it controls.

Gate states:

- open
- waiting
- blocked
- failed

Shape and label must distinguish these states beyond color.

### State

State markers should align to a common track/rail.

Historical state is visually subordinate; current state is strongest; future state is structurally visible but subdued.

---

## 9. State rail

A canonical state rail includes:

- ordered phases
- current-position marker
- completed/previous phases
- future phases
- time if relevant
- blocked/waiting gate markers when relevant

The state rail may be horizontal or vertical based on available geometry, but its semantic order must remain stable.

Do not turn the rail into a decorative progress bar if phases are non-linear or reversible.

---

## 10. Workspace types

### 10.1 Operational workspace

Priorities:

- live state
- actor ownership
- queues
- unresolved items
- time
- actions

Density: Standard or Operations.

### 10.2 Decision workspace

Priorities:

- decision context
- evidence
- alternatives
- consequence preview
- confirmation

Density: Focus or Standard.

### 10.3 Exploration workspace

Priorities:

- map/network/canvas
- selection
- filtering
- contextual inspector

Canvas dominates.

### 10.4 Review workspace

Priorities:

- timeline
- causality
- comparison
- reconstruction
- provenance

May use horizontally synchronized panes.

### 10.5 Briefing workspace

Priorities:

- comprehension
- narrative sequence
- large visualization
- restrained controls

Density: Focus.

---

## 11. Responsive transformation

Teludens uses adaptive transformations, not simple shrinking.

### Wide desktop

- navigation + workspace + inspector may coexist
- state rail persistent

### Medium desktop / laptop

- inspector may narrow or overlay
- secondary navigation may collapse
- state rail may compress labels

### Small window / tablet

- inspector becomes sheet or full pane
- navigation becomes temporary or compact
- workspace retains task priority
- tertiary telemetry moves on demand

### Mobile

Mobile is not a compressed workstation. Define the actual mobile task set and design for it explicitly.

---

## 12. Scroll ownership

Every major region declares its scroll owner.

Default workstation model:

- app shell: fixed
- navigation: independent if content exceeds height
- workspace: owns primary scroll/pan
- inspector: independent vertical scroll
- modal: internal scroll if needed

Avoid whole-page scroll when an application workspace is intended to remain fixed.

Avoid nested scrolling within the same axis unless unavoidable.

---

## 13. Empty space

Whitespace is used to signal:

- hierarchy
- transition between modes
- consequence and pause
- grouping

Whitespace is not proof of premium design.

Operations views may be dense while remaining highly ordered.

---

## 14. Visual QA

At minimum test:

- 1440×900
- 1280×800
- minimum supported laptop width/height
- 200% zoom or required accessibility reflow condition
- long labels
- long actor names
- large/negative numeric values
- empty workspace
- active inspector
- open command palette
- open modal
- Operations density

Reject designs with:

- crushed controls
- clipped labels
- accidental whole-page horizontal scroll
- ambiguous scroll ownership
- arbitrary card wrapping
- inspector covering consequential controls without adaptive alternative
- misaligned state rail / workspace semantics
