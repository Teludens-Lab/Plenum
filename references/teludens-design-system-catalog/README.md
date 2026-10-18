# Teludens Interface System — Catalog Website

Static, dependency-free design-system catalog for the Teludens Interface System v1.

## Run locally

Any static server works:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Included

- Interactive Light/Dark semantic themes
- Focus / Standard / Operations density modes
- Primitive and semantic token catalog
- Typography specimens
- Motion token catalog, transition choreography, loading/latency grammar, and interaction-physics demos
- Node / Branch / Path / Gate / State interactive grammar
- Controls, shell, navigation, panels, overlays, and operational components
- Interactive canonical Plenum reference slice
- Search / command palette (`Cmd/Ctrl + K`)
- Source markdown documents and token JSON in `/docs`

## Sources

The website implements the supplied Teludens v1 documents without silently adding new system rules. Runtime accessibility, keyboard, reduced-motion and performance still require implementation-level validation in product code.

## Figma library

https://www.figma.com/design/aKoNDxJc9KUo9WQhmHtA9m

## Plenum capability variants

The interactive Plenum reference slice now includes nine options: Landing, Login, Workspace, Dialog Open, Command Palette, Admin, Extensions, Poll / Vote, and Voice / Radio. The three capability variants are grounded in the Plenum v1.1 specifications included under `docs/`:

- `10_EXTENSION_FRAMEWORK_v1.1.md`
- `11_LIVE_POLLING_AND_VOTING_v1.1.md`
- `12_VOICE_AND_RADIO_v1.1.md`

The catalog preserves the product-boundary rule: model Plugins propose effects through the Extension Framework; Polling/Voting and Voice/Radio are core Runtime capabilities with Platform Adapters, not adjudication Plugins.


## Plenum slice surfaces

The canonical slice includes Landing, Login, Workspace, Dialog, Command Palette, Admin, Extensions, Poll / Vote, and Voice / Radio states.


## Plenum role surfaces

The canonical Plenum workspace now includes explicit role surfaces for Scribe, Facilitator, Notetaker, White Cell, and SME. The governed chain is Scribe authoring → Facilitator review/submission → White Cell completeness → SME assessment → White Cell ruling. SME includes Macro, National Interests & Escalation, and Diplomacy & Information lanes.
