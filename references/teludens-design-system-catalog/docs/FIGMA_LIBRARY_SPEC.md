# TELUDENS FIGMA LIBRARY SPECIFICATION

**File:** Teludens Interface System — v1

---

## 1. Page architecture

1. `00 — Cover`
2. `01 — Foundations`
3. `02 — Visual Grammar`
4. `03 — Controls`
5. `04 — Navigation & Shell`
6. `05 — Panels & Overlays`
7. `06 — Operational Components`
8. `07 — Plenum Reference Slice`
9. `99 — QA & Deprecations`

---

## 2. Variable collections

### Primitives

- neutral warm ramp
- vermilion ramp
- info/cobalt ramp
- success/green ramp
- caution/amber ramp
- error/crimson ramp

### Semantic Color

Modes:

- Light
- Dark

Groups:

- material/*
- text/*
- boundary/*
- control/*
- signal/*
- semantic/info/*
- semantic/success/*
- semantic/caution/*
- semantic/error/*
- focus/*

### Spacing

4 px base scale.

### Radius

0 / 3 / 5 / 8 / 12 / full.

### Density

Modes:

- Focus
- Standard
- Operations

Tokens include:

- control-height
- row-height
- toolbar-height
- panel-padding
- section-gap
- inline-gap

### Motion

Variables/documented tokens for durations; implementation code remains the authoritative source for easing where Figma variables are insufficient.

---

## 3. Text styles

- Display
- Heading/Large
- Heading/Medium
- Title
- Body
- Body/Strong
- Label
- Detail
- Control
- Operational
- State
- Telemetry
- Mono/Numeric
- Mono/Code

---

## 4. Core component inventory v1

### Controls

- Button
  - Style: Primary / Secondary / Quiet / Destructive
  - Size: S / M / L
  - State: Default / Hover / Pressed / Disabled
- Icon Button
- Segmented Control
- Text Field
- Search Field
- Checkbox
- Radio
- Switch
- Select trigger

### Navigation & shell

- Navigation Item
- App Rail Item
- Context Bar
- Simulation State Rail
- State Rail Phase
- Toolbar
- Command Bar

### Panels & overlays

- Inspector
- Inspector Section
- Popover
- Menu Item
- Tooltip
- Dialog
- Toast / Status message
- Command Palette
- Command Result Row

### Operational

- Actor Chip
- Proposal Row
- Proposal State
- Decision Node
- Branch Label
- Path
- Gate
- State Marker
- RFI Row
- Observation Row
- Timeline Event
- Dependency Indicator

---

## 5. Component API principles

- keep variant matrices under 30 combinations where possible
- use instance swap for icons
- expose user-facing text as text properties
- use boolean properties for optional leading/trailing regions
- bind fills, strokes, radii, padding, and gaps to Teludens variables
- keep destructive semantics separate from brand Vermilion
- density should prefer variable modes over component duplication where Figma support permits

---

## 6. Reference slice assembly

`07 — Plenum Reference Slice` must use instances from the library pages wherever a reusable component exists.

The reference slice is not allowed to become a disconnected mockup made of one-off frames.

---

## 7. Documentation standard

Each component family includes:

- purpose
- anatomy
- when to use
- when not to use
- states
- density behavior
- accessibility notes
- motion behavior
- example
- anti-pattern

---

## 8. QA

Validate:

- variable binding
- light/dark semantic values
- density modes
- component naming
- no duplicate local components with same semantic role
- no raw hex values in reusable components where variables exist
- no arbitrary radii/spacing values
- visual consistency across component families
- Plenum reference slice uses component instances
