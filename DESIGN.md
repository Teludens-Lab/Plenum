---
name: Plenum
description: A composed professional workspace for governed simulation design and delivery
colors:
  mineral-sage: "#455f4b"
  mineral-sage-strong: "#344d3b"
  canvas: "#f5f7f4"
  workspace: "#fafbf9"
  surface: "#ffffff"
  surface-recessed: "#ecefeb"
  graphite: "#1c241f"
  graphite-secondary: "#3b4740"
  boundary: "#c1cac0"
typography:
  entryDisplay:
    fontFamily: "Iowan Old Style, Palatino Linotype, Book Antiqua, Palatino, Georgia, serif"
    fontSize: "clamp(2.75rem, 4.4vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.04
  headline:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.5
  title:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.5
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.5
rounded:
  sm: "0.1875rem"
  md: "0.3125rem"
  lg: "0.5rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.mineral-sage}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.25rem"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.25rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.md}"
    padding: "0.75rem"
---

# Design System: Plenum

## Overview

**Creative North Star: “Composed Capability”**

Plenum is a contained professional instrument. The interface should feel continuous and meticulous before it feels expressive: a stable shell, a dominant work region, and supporting context that originates from the selected work and returns users to it predictably. The editorial metaphor is structural, not decorative—clear subject, deliberate reading order, concise annotation, and evidence subordinated to action.

The world remains Teludens Graphite/Mineral Sage. Apple operating systems contribute continuity and conscientious state behavior; Cursor contributes workspace focus; ChatGPT contributes approachable interaction. None contributes copied navigation or ornamental chrome.

**Key Characteristics:**

- Calm, contained, and role-aware.
- Flat by default, with elevation reserved for temporary layers.
- One deliberate decision accent.
- Compact recurring controls; more space around subject changes.
- Motion explains origin, state, or continuity and never delays input.

## Colors

Mineral Sage carries selection and decision; Graphite carries subject and reading order; quiet neutral surfaces separate regions without decorative contrast.

### Primary

- **Mineral Sage** (`--signal-decision`, `#455f4b`): primary actions and current-path emphasis.
- **Deep Mineral Sage** (`--signal-decision-strong`, `#344d3b`): active/focus reinforcement and primary hover.

### Neutral

- **Canvas** (`--material-canvas`, `#f5f7f4`): application surround.
- **Workspace Paper** (`--material-workspace`, `#fafbf9`): dominant work ground.
- **Surface** (`--material-surface`, `#ffffff`): controls and bounded regions.
- **Recessed Surface** (`--material-surface-recessed`, `#ecefeb`): inputs, selection, and subordinate detail.
- **Graphite** (`--text-primary`, `#1c241f`): subjects, actions, and primary copy.
- **Secondary Graphite** (`--text-secondary`, `#3b4740`): metadata and annotation.

**The Decision Accent Rule.** Mineral Sage marks selection, focus, and the single primary action. It is not decoration. Text links use the Teludens info signal so they stay distinct from decisions.

## Typography

**Display Font:** Inter with system UI fallbacks  
**Body Font:** Inter with system UI fallbacks  
**Label/Mono Font:** Inter for labels; JetBrains Mono/SFMono/Consolas only for genuine identifiers and code

The public landing page is the deliberate exception: its headline uses the serif display stack (`--font-display`). Every signed-in surface, including Studio and portal titles, stays in Inter.

**Character:** neutral, precise, and editorial through proportion rather than a second display typeface. Weight and spacing establish hierarchy; uppercase tracked labels are short annotations, never substitute headlines.

### Hierarchy

- **Workspace headline** (`--text-xl`, `--weight-semibold`): one per work view.
- **Portal title** (`--text-xl`, `--weight-semibold`): the subject inside the work region only when it adds information beyond the workspace title.
- **Section title** (`--text-lg`, `--weight-semibold`): registry, operations, evidence, or task section.
- **Object title** (`--text-base`, `--weight-medium`): Project, Release, Session, or record identity.
- **Header title** (`--text-sm`, `--weight-medium`): the current workspace in the product header, read as location rather than headline.
- **Body** (`--text-base`, `--weight-regular`, `--leading-base`): actions, consequences, and guidance; prose stays concise and uses a readable measure.
- **Annotation** (`--text-sm`/`--text-xs`): metadata, counts, and optional explanation.

**The Subject Before Annotation Rule.** The user should understand the object and current action before reading supporting prose.

## Layout

The Teludens application frame owns the experience: persistent shell, context header, role-filtered navigation, one dominant work region, and a contextual inspector or modal sheet. Desktop regions own their own scroll; narrow layouts preserve DOM/task order and progressively disclose navigation and context.

Default composition dials for this brief are interpreted as variance 3, motion 4, and density 3. Because the named Taste Skill configuration is unavailable, these are recorded as direction, not written into an unsupported configuration format.

Operational surfaces use the standard or operations Teludens density. Whitespace separates changes in subject or consequence; repeated rows and controls stay compact enough for comparison.

### Public entry surface

The public root is a flat Canvas field, never a paper or grain texture. It carries the approved wordmark and descriptor, one headline (“Design, deliver and audit governed simulations.”), one primary action, and the chamber line art (`/branding/plenum-chamber.webp`), which is pure ink on transparency and inverts in dark theme. It is a single viewport with no further sections. The primary action is the same Mineral Sage control as the workspace.

## Elevation & Depth

The system is flat by default. Signed-in work sits on a Canvas ground: Surface navigation with line icons, a Surface header, and one level of bordered Surface cards with a titled header row. A card never holds another card; repeated items inside one are divided rows. `--shadow-sm` is reserved for temporary modal sheets or genuinely raised layers, never combined with a structural border merely to decorate a card.

**The Temporary Elevation Rule.** Persistent regions use boundaries; temporary regions use elevation.

## Shapes

Corners are quiet and compact: `--radius-sm` for small details, `--radius-md` for controls, and `--radius-lg` for major bounded regions. Pills are reserved for compact states. Continuous catalogs share one outer boundary; individual rows use dividers rather than floating rounded cards.

## Components

### Buttons

- **Shape:** compact rectangular control using `--radius-md`.
- **Primary:** Mineral Sage with inverse text; one per decision region.
- **Secondary:** transparent/surface control with standard boundary.
- **Hover / focus / press:** token-timed color/border response, visible focus ring, and subtle interruptible press response when motion is permitted.

### Cards / Containers

- **Persistent regions:** flat surface plus structural boundary.
- **Continuous lists:** one catalog boundary with row dividers.
- **Temporary layers:** raised surface and shadow, with a backdrop for modality.

### Inputs / Fields

- Visible label, surface material, hairline boundary with a stronger lower edge for 3:1 control contrast, and token focus ring.
- Error text is linked programmatically and preserved with the user’s input.
- Disabled controls expose the prerequisite in text and to assistive technology.

### Navigation

- Goal/object labels lead; short annotations appear only where they improve current-location recognition.
- Current location uses `aria-current` and soft decision material with decision text. Each item carries a 1.6-stroke line icon. Editor groups use short uppercase labels; navigation carries no title above its first group.
- Narrow navigation is a labeled disclosure; opening it preserves the work beneath it.

### Catalog Row

- Identity and state lead.
- Scan-friendly facts replace prose-heavy metadata.
- Optional provenance stays disclosed.
- The single valid next action is aligned consistently at the edge.

## Do's and Don'ts

### Do:

- **Do** make the dominant work area and valid next action evident before explanatory copy.
- **Do** keep evidence, prerequisites, consequences, and progress beside the decision they affect.
- **Do** preserve focus, selection, scroll ownership, and URL-restorable context.
- **Do** use only Teludens tokens and official Plenum assets.
- **Do** keep motion interruptible, causally meaningful, and reduced-motion safe.
- **Do** change Studio sections and same-page workspaces immediately with a `--motion-view` crossfade, and reserve the full-page white petal loader for a change of surface (sign-in, entering Studio, leaving Studio, Administration).

### Don't:

- **Don't** copy Apple, Cursor, or ChatGPT chrome; adapt their conscientiousness and continuity.
- **Don't** create card mosaics, nested cards, decorative gradients, glass, or one-off visual values.
- **Don't** repeat the same title or explanation at multiple hierarchy levels.
- **Don't** expose raw identifiers, digests, enum keys, or JSON in the primary scan path.
- **Don't** animate routine reading, delay input, or imply completion before authoritative state confirms it.
