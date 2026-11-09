# Participant session interfaces

## PS-842 candidate reconciliation — 2026-11-09

The owner delegated the seven interface choices and authorized implementation while previous human evidence remains pending. This section supersedes the earlier embedding and vocabulary descriptions below for the new 1.0.1 candidate only. It does not transfer historical PASS results.

Navigation labels and first module titles agree. Shared concepts use Communications, Proposals, Injects and RFIs with consistent icons and relative order. Work, Communications and Session resources are stable groups authored in each Interface Profile. Scribe retains team-specific forms for Blue, Red, Green and Industry. Record workspaces use one paged review surface; Present adds keyboard/full-screen presentation. A label or grouping is never an authorization grant.

White Cell Simulation Settings links to the existing Operator console, Staffing and Reports only when the server projects Operator access. Those endpoints retain their Session assignment and role checks. Both timer surfaces use Additional minutes and the same exact conversion to authoritative seconds. The Runtime header carries the approved theme-safe Plenum wordmark, visible Refresh/Injects labels and a menu exposing the full Session title.

The theme follows the operating system until the user explicitly chooses a theme. The existing chamber landing, Canvas and authored Session imagery remain the first-run direction. Desktop acceptance covers 1440x900, 1024x768 and equivalent 200% zoom, explicit light/dark, keyboard, reduced motion, forced colors and named desktop AT. Mobile/touch remains approved N/A.

New source/compiled pairs are `definitions/fractured-order/fractured-order-interface-release{-source,}.json` and `definitions/validation/{crisis-response,policy-negotiation}/interface-release{-source,}.json`. Earlier Release files remain unchanged. Compilation is not publication or activation evidence. Current results, limitations and human gates are authoritative in [PS-842's ledger](../acceptance/PS-842-interface-consistency.md).

The saved boards in `references/participant interfaces/Plenum Header Options (3).html` are the visual reference for participant workspaces. The adjacent Fractured-Order implementation supplies form and workflow context. References remain unchanged.

Plenum uses the reference header, stage clock, role menu, navigation rail, page band and focused work area. Control Broadcast and Voice channels open from labeled header icons. Voice stays mounted when its panel closes; leaving a channel remains an explicit action. Forms and messages remain mounted during local navigation. Broadcast text is cleared only after an accepted receipt.

## Implemented surfaces

| Role | Workspace |
| --- | --- |
| Scribe | Strategic Actions, on-demand team forms, RFIs, responses, read-only proposal threads, notifications and Quick Capture |
| Facilitator | One-record review, existing return/forward commands, RFI creation, communications, proposal negotiation, deck and keyboard/full-screen artifact presentation |
| Notetaker | Quick Capture with Note/Key Moment/Quote, Team Dynamics, Alliance Tracking, read-only submitted team actions, inbox and notifications |
| White Cell | Simulation Settings tabs, permitted move/timer commands, authored time allocations, action review, proposal custody, RFIs, communications, Injects, decks and authorized inline Operator controls |

All four roles have a Session Timeline and the Tribe Street Journal and Verba publication feeds. White Cell publishes through configured message routes; participants receive the updates read-only. The journal panel also offers an explicit external website link. These are the publication surfaces used by the reference application, not an automatic third-party content or AI integration.

The timeline pages through 50 events at a time, newest first. It includes activity on currently visible artifacts and delivered messages, released Injects, and Session stage changes. Every page rechecks the active role's visibility. Raw event bodies, private participant details, rejected commands and inaccessible team records are excluded. It is not the privileged full audit export.

Notetakers receive their own team's submitted action records through the existing workflow notification and owning-team policy. Unsubmitted drafts and other teams remain unavailable; no action-editing capability is granted.

Simulation Settings exposes Game Controls, Sessions, Participants, Scribe Decks, Plugins and Export Data. As confirmed by the user on 2026-11-08, an active Operator organization role and Session assignment remain required for participant/session administration and full reports. The server projects that availability; the tabs embed existing management workflows, whose APIs recheck authority. Base time allocations remain governed by the Release; the active timer can be extended using the existing version-checked command. This change does not add arbitrary edits to future-stage durations.

Navigation and form filters belong to Release Interface Profiles. They do not grant access. The server still determines visible records, form availability, workflow actions and command authorization. Stage controls are projected from the active role's existing capabilities, current stage and aggregate version; the command handler rechecks authorization, gates and concurrency.

Industry creation forms resolve enabled cells on the server and provide initial read-only cell values. Each cell has a separate form entry and independent client draft. The observation form adds optional capture type metadata; legacy `{note: ...}` payloads still validate. Dynamics and alliance snapshots use the existing team/control information policy and note workflow. No database migration is required.

New-entry forms now restore encrypted local drafts across reloads. Draft keys include Session/device, participant, role, assigned seats, access revision, Release, stage, form version and Industry scope. Writes reuse the existing protected IndexedDB store. Accepted submissions clear their draft; failed submissions retain it. Clearing revoked Session access also clears its local drafts. A save/restore failure is visible in the form. Existing-artifact edits still use their explicit save commands; their unsubmitted edits are not autosaved by this feature.

## Verification

Observed on 2026-11-08: **PASS** for the build, type check, contract lint, all 130 existing tests, 4 additional boundary tests, and 7 browser scenarios. Automated accessibility scans reported zero violations in those scenarios. Draft reload recovery, stage isolation, encrypted storage, clearing after accepted submission, full-screen entry/exit and keyboard presentation navigation passed. The build retains its existing large-chunk warnings.

- `npm run test:participant-interfaces`: builds both clients, checks capability/role/form boundaries, then exercises the built client using real Release definitions and explicit in-memory API fixtures.
- `node --test tests/platform/fractured-order-release.test.mjs`: compilation, form contracts, role resources and existing scenario parity checks.
- `npm run typecheck` and `node scripts/contract-lint.mjs`: static and contract checks.
- Browser evidence: `output/playwright/participant-interfaces/`. Includes all four participant roles, Scribe forms for all four teams, desktop/mobile captures, 320px with 200% text size, reduced motion, keyboard dialog dismissal/focus return, and automated WCAG checks.
- `npm run test:e2e:participant`: uses the existing database-backed E2E harness. Requires `DATABASE_URL` pointing to a **disposable test database**; setup applies migrations and seeds synthetic users. Four workflow checks cover unsubmitted/cross-team denial, read-only Notetaker actions, 53-event timeline pagination, invalid cursors, publication permissions, Operator assignment, stale stage versions, and authorized revision history excluding unsent edits. They passed using an isolated PostgreSQL 18.6 container. The configured default port is 4179 to leave an existing local server on 4173 untouched.

Browser command fixtures prove UI payloads, validation, draft recovery and handling of accepted/rejected responses. The separate database-backed checks prove the listed authorization and persistence paths. They do not constitute load, broad concurrency or production deployment testing.

**FAIL / unresolved media evidence:** the opt-in `Voice icon keeps real audio connected while its dialog is closed` check was run against a disposable LiveKit 1.13.10 instance. Signaling authenticated, but the Windows/Docker loopback environment did not complete ICE negotiation, including a TCP-only attempt. No successful remote audio delivery or continuity claim is made. Run with `MEDIA_TEST_URL` against a working media environment to close this gate. The dialog now displays connection progress and failure locally, allows retry, and prevents competing joins; its rejected-join recovery is covered by browser fixtures. Existing media services and firewall rules were not changed, and the disposable containers were removed.

## Activation and parity limits

These are source and locally compiled Release changes. Already-published Releases and running Sessions were not rewritten or activated. Use the normal publish/activation workflow to make the new configuration available to a Session; deploy the accompanying server and client together.

This is not full Fractured Order feature-parity or release approval. Remaining boundaries are actual media delivery, automatic third-party plugin integrations, and arbitrary live editing of future-stage base durations. Operator administration now reuses the existing authorized controls inside the Session Settings tabs. Published Releases and existing Sessions retain their pinned configuration until the normal publication and activation workflow is performed.


## Form and section corrections — 2026-11-08

The sibling Fractured-Order implementation was inspected directly. PLI is excluded from this change at the user's request.

- Separate Strategic Orientation and Take Action dialogs replace the combined form selector. Orientation choices include the reference card descriptions. Multi-choice fields use checkboxes. The Blue builder has three pages, conditional Other details, country checkboxes and legislative-route choices; the Industry plan has five pages plus review, grouped risk/priority inputs and the five-point stance control. Industry proposals have three pages plus review, grouped environment/supply-chain inputs and the expected-effects table. Back/Next retains values, page validation focuses the first error, and local drafts retain the existing encrypted storage behavior.
- Form layout metadata is authored in the Release and passed through the runtime projection. Blue Action and Industry Strategic Plan move to form version 2. Blue country/legislative selections are arrays; legacy goal, coordination, business and partner context remains available as optional context. Existing pinned Releases retain their original form contracts.
- White Cell has distinct Strategic Orientation, Actions, Proposals, Red Actions/Responses and Returned/Revision History workspaces. History reads immutable revisions through a paginated, authorized endpoint, using each revision's governing form. The endpoint excludes unsent edits and denies non-control roles.
- Communications includes recipient, type and message controls. Explicit routes target all teams, one team or one team/role; server sender and delivery checks remain authoritative. Journal and Verba updates have the same recipient choices. Journal also includes captured notes/dynamics/alliance records and an editable forwarding draft.
- Sessions, Participants and Export Data reuse existing Operator controls inside settings. An active Operator assignment remains required. No new authentication model, persistence schema, service or dependency was introduced.

Verification: **PASS** for 130 existing tests, four participant boundary tests, seven browser scenarios, build, type check and contract lint. Browser scenarios verify action-builder validation and typed payloads, Industry page/review navigation, targeted Communications and Journal forwarding payloads, responsive layouts and zero automated accessibility violations. Four database-backed workflow checks passed earlier, including revision-history visibility and inline Operator controls.

**NOT VERIFIED:** the new targeted-recipient delivery and Journal-forwarding database case could not complete: the first rerun exhausted disk space, then the Docker daemon became unresponsive after space was recovered. Its UI payload checks pass, but delivery/persistence assertions require a database rerun. The broad runtime E2E suite was not rerun. Cleanup of the task-owned disposable container `plenum-participant-forms-test` could not be confirmed because Docker cleanup also timed out; existing application services were not restarted. Evidence remains in the participant-interface and participant-workflow output folders.

The changes remain local source and compiled Release artifacts. No published Release was replaced and no running Session was activated. Actual audio delivery and live editing of future-stage base durations remain the previously documented boundaries; PLI integration is outside this task.
