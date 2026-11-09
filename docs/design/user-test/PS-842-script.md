# PS-842 role walkthrough

Status: NOT RUN. The user has designated themselves as the developer/tester reviewer and selected Chrome with screen reader capability. Screen reader product/version and observed walkthrough results remain pending. Earlier PS-830/PS-840 human gates remain pending under the owner's implementation exception. This script does not approve release.

Record reviewer name, date, OS/browser/version, assistive technology/version, candidate source manifest, built bundle hashes, Release digest/version and synthetic environment before starting. Use the same candidate as the automated results in `../../acceptance/PS-842-interface-consistency.md`. A later change invalidates affected observations.

Prepared local fixture: open [synthetic sign-in](http://127.0.0.1:4191/__test__/personas) in Chrome. The new **PS-842 interface walkthrough** Project and **PS-842 Fractured Order walkthrough** Session were imported, published and started through existing local APIs. This synthetic publication approval is setup, not human acceptance. Source/package/Session identities and setup receipts are in `output/playwright/ps-842/reviewer-fixture.json`.

- [Studio candidate](http://127.0.0.1:4191/studio/projects/088a24a0-e53e-4fa0-a008-83897d3ac60f)
- [Participant Runtime](http://127.0.0.1:4191/sessions/bf550d66-77ed-447d-b396-d4da59469fff/runtime)
- [Operator console](http://127.0.0.1:4191/admin/sessions/bf550d66-77ed-447d-b396-d4da59469fff)

Switch personas through synthetic sign-in; use Your Sessions to enter the assigned seat. The chooser labels map as follows:

| Chooser label | Walkthrough assignment |
|---|---|
| Blue Scribe / Red Scribe | Corresponding team Scribe |
| Designer / Designer B | Green / Industry Scribe |
| Blue Facilitator / Red Facilitator / Green Facilitator | Corresponding team Facilitator |
| Publisher | Industry Facilitator |
| Blue Notetaker | Blue Notetaker |
| Reviewer | White Cell, Control seat |
| Admin | Organization Administration, Platform control plane and Operator controls |
| Operator only | Operator with no Project authority |

The local Research Analyst identity also has Designer authority; the local Platform Administrator also has Organization authority. Pure-authority landing behavior has automated presentation fixtures, with separate real database authorization checks. Do not mark the two pure-authority human rows PASS from these multi-role identities. The fixture uses synthetic media and does not establish live microphone/provider interoperability.

For each task record PASS/FAIL, hesitation or wrong turn, exact route and screenshot/trace, and the related IC number. Do not coach navigation until the attempt is recorded. Exercise pointer and keyboard, then the named desktop screen reader. Repeat representative dense views at 1440x900, 1024x768 and 200% zoom, explicit light/dark, reduced motion and forced colors. Mobile/touch is N/A.

| Persona | Tasks | Expected observation | Result |
|---|---|---|---|
| Visitor | Sign in; visit an unknown route and each invitation route using valid, invalid and expired synthetic invitations | One page heading; understandable entry/recovery; no false connection failure or token exposure | NOT RUN |
| Designer | Find Projects, Your Sessions and Studio; visit all 27 sections; create/edit a representative Form; open demo | Visible navigation; menu/title equality; readable sync state; bounded work and no nested scroll trap | NOT RUN |
| Reviewer | Open review, inspect evidence and return to Projects | Authority is clear; no author-only mutation; titles and technical disclosures remain coherent | NOT RUN |
| Publisher | Open Releases and Plugin operations | Releases-only wording; a single Administration entry to the first permitted destination | NOT RUN |
| Operator | Open Session detail, console, Staffing, Reports, Replay and Archive; extend timer and reject a stale synthetic command | Stable context; exact minutes conversion; one control owner; actionable stale recovery | NOT RUN |
| Admin | Visit all five Administration destinations; select named Plugin permissions, retention scope and correction target; open technical details | Canonical labels; current-page indication; no free-text UUID requirement; no cross-Organization options | NOT RUN |
| Research Analyst only | Start at `/`; reach Research reports and attempt an unauthorized workspace | Authorized landing/navigation; clear denial without false offline state | NOT RUN |
| Platform Administrator only | List/open an Organization; inspect readiness; visit Platform administrators | Platform authority stays distinct; one H1 and one secondary menu; no duplicate Organization title | NOT RUN |
| Invited Participant | Find Your Sessions, join an eligible seat, enter an assigned role and return | One primary action per seat/context; normal code placeholder; workspaces preserved when otherwise authorized | NOT RUN |
| Scribe — Blue, Red, Green, Industry | Visit every navigation item; create and recover a draft; inspect a submitted record; open dialogs and header menus | Shared labels/icons/order; team-specific forms retained; one record navigation method; focus returns correctly | NOT RUN |
| Facilitator | Visit every item; review, return/forward a record; inspect Proposals, RFIs, Deck and Present | Review commands unchanged; consistent record pattern; keyboard/full-screen presentation works | NOT RUN |
| Notetaker | Visit every item; capture and review notes, dynamics and alliances; inspect Communications and Injects | Read-only submissions stay read-only; canonical names; no internal keys | NOT RUN |
| White Cell | Visit every item and all Simulation Settings tabs; inspect stage controls, action review, Proposals, decks and authorized Operator links | Stable groups; no embedded duplicate console; links require existing Operator authority | NOT RUN |

For every persona: open the account/role menu, verify all projected authority is represented, read the full long Session name, change theme, reload, and verify an unchosen theme follows an OS change. Check loading, empty, offline, denied and stale states without losing drafts. Confirm no visible UUID, enum, internal decision code, digest or MIME type appears outside a labeled technical disclosure. Inspect dialogs for duplicate titles, alignment, close/expand consistency and keyboard escape/focus return.

Publication check: on disposable data, publish and activate the new Fractured Order and validation candidates through the normal pipeline. Record source, package and activated digests; show a previously pinned Session still projects its original Release contract. Compilation alone is insufficient.

Results and sign-off: NOT RUN. Link observations to IC-01–IC-40 in the acceptance ledger. A failed step is a defect, not an inferred owner exception. Production approval remains outside PS-842.
