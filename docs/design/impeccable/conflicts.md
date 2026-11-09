# Impeccable conflict log

Status: no recommendation conflict identified at Checkpoint A. Owner-directed refinements are recorded below.

Generic Impeccable guidance that favors expressive or decorative treatment is excluded where it conflicts with Plenum's Operate mode, restrained Teludens material language, scarce decision signals, production Graphite/Mineral Sage authority, or reduced-motion contract. Teludens and approved product behavior win.

The current open design-authority gaps are not Impeccable conflicts. They are recorded as candidate OPEN text in `docs/promptbook/CONFLICT_REGISTER.md` and as production-token gaps in `docs/design/motion-inventory.md`.

## Owner-directed refinement, 2026-11-07

The product owner directed a lighter Studio and a landing page aligned with it. These decisions override earlier project-level records; Teludens palette, Mineral Sage decision authority, and the approved wordmark are unchanged.

| Earlier record | Owner direction | Resolution |
|---|---|---|
| Serif reserved for the entry surface | Tried on Studio titles, then rejected as out of place | Unchanged: serif stays on the public landing only |
| Entry surface: "What happens next?", no illustration, paper texture | Screenshots of the chamber landing; paper and the How it works section explicitly rejected | Single-viewport chamber landing on flat Canvas; `plenum-entry-paper.png` removed |
| Inputs use recessed material | Interfaces are too bulky | Surface material with hairline boundary; lower edge keeps 3:1 contrast |
| Studio status in `studio-state-strip`; `Draft map` heading | Both removed by name | Save and validation state move to the header; Undo moves to the header; Draft generation moves to Draft checks |
| Default density for portal and Studio | Interfaces are too bulky | Operations density outside participant workspaces |
| Flat, unboxed Studio trial | Too bland; make it more like the Cloudflare style | Structure only: Canvas ground, Surface cards, icon navigation, info-blue links. No Cloudflare branding or orange; Mineral Sage stays the decision signal |
| Two-colour heavy petal loader | Make it more elegant | Thin single-ink petals, slower 1600ms sweep, soft arrival |
| Loader overlay on every Studio section | Transitions are janky; petals are a full-page animation | Sections crossfade; the overlay is full-page white and reserved for a change of surface |
| Object title `--text-md` semibold; header title `--text-md` (PS-800 type roles) | Interfaces are too bulky | Object title `--text-base` medium; header title `--text-sm` medium; section title stays `--text-lg` |

## Participant interface reference deviations, 2026-11-08

The saved boards in `references/participant interfaces/` define the Session frame, join screen and toasts. These parts of the boards were not adopted, because Plenum authority or available data differs. Each one needs an owner decision before it changes.

| Reference element | Plenum behavior | Reason |
|---|---|---|
| Operator access by operator key, SME access by SME code (join board) | Not implemented; no staff links on the join screen | Shared-key entry would change the authentication model. Operators use their verified account, Organization role and Session assignment. SME access needs a defined Session role first. |
| Editable display name on the join form | Read-only verified account name | The Session identity is the authenticated Plenum principal. |
| Team-coloured dot on the role chip | One decision-signal dot for every role | The projection carries no team colour. Colouring by team name would hard-code one simulation's semantics. |
| Session name with no Plenum wordmark in the header | Adopted for the Session frame only | The Session frame remains the single Runtime shell. The wordmark stays on the portal, Studio and landing. |
| Title and developer mark drawn on the login artwork | Shown over the fallback panel; kept for assistive technology only when artwork exists | Release login artwork already carries its own title and mark. |
| Undo, View, Review and Retry toast actions | Toasts support an action, but none is wired yet | Each action needs an existing command or destination. Undo has no command. Errors stay until dismissed, and the Offline Outbox keeps the retry path. |
