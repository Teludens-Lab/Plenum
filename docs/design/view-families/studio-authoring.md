# Studio authoring view-family brief

## Purpose and journeys

Own visual configuration of all 27 Studio sections, collaboration, validation, preview, rehearsal, review, publication and governed live changes. Prioritize `J-DES-01`, `J-DES-02`, `J-REV-01` and `J-PUB-01`.

## Orientation contract

Always show Organization, Project, Draft/frozen revision, current section, active role, collaboration/sync state and validation summary. Preview/rehearsal/review modes are visually and semantically distinct from edit mode. Server-filtered preview identifies its selected Session Role and Stage.

## Layout and scroll ownership

Replace the giant document scroll with a persistent section navigator, section work canvas and contextual inspector. Each region owns its scroll. Validation and preview open as bounded regions/sheets, not appended pages. Preserve deep links to Project and section. On narrow screens the same semantic order becomes navigator drawer -> work canvas -> inspector sheet.

## Forms, dialogs and messages

Editors are guided, constrained controls; code and raw JSON are forbidden. Multi-step configuration exposes dependency and consequence before publication. Collaboration messages distinguish local, synchronizing, saved, offline, stale, conflict and revoked states. Confirmations are reserved for publication, destructive removal, governance and live-change effects.

The exhaustive family classification is the Studio authoring row of `../forms-dialogs-messages.md`.

## Components and gaps

Reuse Teludens Node/Branch/Path/Gate/State primitives, section navigation, work header, form fields, ordered lists, graph canvas, inspector, issue list, preview frame, dialog, sheet, status and provenance primitives. Gaps: unified section workspace, issue-to-control focus contract, sync-state cluster and responsive graph/editor affordances. Raw schema viewers may exist only as non-editable diagnostic disclosures for authorized technical evidence.

## Keyboard and focus

Section navigation is a list of links/buttons with visible current state. Canvas objects are reachable in semantic order and have non-drag operations. Arrow-key models are used only for composite widgets that implement the matching ARIA pattern. Undo/redo is scoped and announced. Escape exits the top mode/layer; no global shortcut overrides a text field. Validation links focus the exact invalid control.

## State, viewport and evidence

The normal family implementation and focused cross-family evidence are closed in `../impeccable/studio-authoring/family-closeout.md`; its ledger preserves the remaining human, device and task-level NOT RUN gates.

All canonical states apply. Additional mandatory states: collaborator joined/left, local changes, synchronizing, saved, exact freeze pending/failed/success, validation blocked, preview unavailable and live-change approval conflict. Verify all sections, long terminology, dense graphs, 200%/320px reflow and touch alternatives. Planned evidence key: `studio-authoring`; no PS-800 PASS evidence exists yet.

Tier behavior: 1920/1440 show navigator, canvas and inspector; 1280x720/600 retain navigator/canvas and overlay the inspector; 1024x768 collapses navigator and inspector to labeled sheets; 768x1024 and 390x844 show one region at a time with persistent Project/section/sync context. At 200%/320px, every graph operation has a non-spatial list/form equivalent.


## PS-842 candidate contract

The 27 section labels and headings share the SECTIONS catalog; the exact list and six groups are in ../route-inventory.md. Use sentence case while preserving domain names. Technical keys and provenance use labeled disclosures. Compact lists do not create additional nested scroll owners.

Supported acceptance: 1440x900, 1024x768 and equivalent 200% desktop zoom, explicit light/dark, keyboard, reduced motion, forced colors and named desktop AT. Mobile/touch remains N/A. Current evidence and human gates are in ../../acceptance/PS-842-interface-consistency.md; historical closeout does not establish this candidate's acceptance.
