# PS-150 manual screen-reader review

Status: **PARTIAL — DEFERRED TO RELEASE ACCESSIBILITY REVIEW** (3 PASS, 1 FAIL, 4 NOT RUN).

Automated axe, keyboard, responsive-layout and Node 24 browser checks pass, but they do not establish what a screen-reader user actually hears. This environment has no Computer Use session or speech-output observer, so it cannot honestly record the manual result.

## Required environment

- Windows 11, Chrome, and NVDA or Narrator with speech audible to the reviewer.
- `npm run test:e2e` fixture running against a disposable PostgreSQL database.
- Record reviewer, date, browser version, screen-reader/version, and any defect IDs.

## Listening script

Mark each row PASS or FAIL and note the words actually announced.

| Check | Expected result | Result |
|---|---|---|
| Open the Blue Scribe workspace and press Tab | Skip link is first, has a clear name, and moves focus to main content | PASS — Narrator announced “Skip to main content, link. Plenum runtime. Google Chrome for Testing window.” Activating it moved focus to the main workspace. |
| Navigate by landmarks and headings | Workspace, configured modules, forms, Messages and Injects have useful names and a logical order | PASS — Narrator announced Banner and Main landmarks, followed by named Blue Scribe workspace, Create an Artifact, Blue Strategic Orientation, Team Note, Your Workflow, Messages, and Injects regions. Heading order was Blue Scribe workspace (level 1), then the same named sections at level 2. |
| Complete the Blue Strategic Orientation form without a mouse | Labels, required state, select choices, validation and submit action are announced | PASS — Narrator identified all three controls as required, announced “Error: What will Red do first? is required” for invalid submission, and announced “The server accepted the Command” after a valid keyboard-only save. |
| Submit a valid Artifact | Pending and accepted status are announced once; focus returns to the refreshed main workspace | FAIL — Focus returned to the Blue Scribe main workspace, but Narrator did not announce either “Saved on this device. Waiting for a server receipt.” or “The server accepted the Command.” Deferred for later accessibility diagnosis and retest. |
| Trigger stale-version and lost-acknowledgement states | Reconciliation and retry guidance are announced without presenting local pending as accepted | NOT RUN |
| Open Control Messages, proposal custody and Injects | Message content, thread state, approval actions, Inject state and acknowledgement controls have unambiguous names | NOT RUN |
| Reload a page containing prior Messages | Historical Messages remain readable but are not re-announced as new notifications | NOT RUN |
| Toggle offline then reconnect | Offline and restored connection status are announced once; content is not duplicated | NOT RUN |

PS-150 manual screen-reader acceptance passes only when every row passes or every defect is fixed and retested. Attach this completed table, plus defect evidence if applicable, to `docs/ps-150-verification.md`; do not replace it with an accessibility-tree or axe result.
