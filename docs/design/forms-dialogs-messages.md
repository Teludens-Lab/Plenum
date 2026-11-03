# PS-800 forms, dialogs and messages inventory

This is the shared classification referenced by every view-family brief. Teludens patterns govern; the PS-800 prompt's form/dialog/message rules fill only catalog silence.

## Classification key

- **Inline**: one visible value, routine and reversible.
- **Inspector**: contextual properties of a selected object while its context stays visible.
- **Work region**: complex creation/editing, long form, reference-heavy or multi-step task.
- **Dialog**: short self-contained task that must complete or cancel before continuing.
- **Review**: irreversible/high-consequence review step; wide-impact irreversible operations additionally require typing the object name.
- **Undo**: reversible but disruptive operation, only when the domain already supports reversal.
- **Message level**: field, form summary, region, fixed view/connection status or persistent toast/status. Success is never a dialog.

| Family | Forms / editors | Dialogs and confirmations | Messages |
|---|---|---|---|
| Platform lifecycle | Search/filter inline; create Organization/Project/Session and Package import in work region; single metadata edits inline/inspector | Short picker in dialog; publish/import conflict in review; archive uses undo only if supported, otherwise review | Catalog loading/empty/no-results region; stale/offline fixed status; create/import outcome persistent status |
| Studio authoring | Object properties in inspector; graphs/forms/long section editors in work region; simple rename inline | Remove draft item uses supported undo or review; freeze, publish and live change use review; no multi-step editor in dialog | Field + linked form summary; validation issue region; collaboration/sync fixed status; publication outcome persistent status |
| Participant Runtime | Artifact/module forms in work region; short response inline; selected item context in inspector | Role switch and unsent-input discard use short dialog when consequence requires; authoritative submit follows configured consequence | Field/form errors; module delivery region; connection/reconnect fixed status; local/server outcome attached to item |
| Operator control | Staffing/configuration in work region; selected queue item in inspector; rationale fields attached to commands | Stage advance/lock/revoke use review; end live Session uses review + typed name; routine idempotent retry has no confirmation | Command/queue region error; dependency fixed status; partial fan-out persistent; durable command outcome in context |
| Organization administration | Roster/policy work region; member/policy properties in inspector; single safe value inline | Role/trust/hold/retention high consequence uses review; destructive wide-impact data operation uses review + typed name | Field/form errors; stale/final-Admin denial region; deployment fixed status; commit outcome persistent |
| Reporting/research | Purpose/scope/filter in work region or inspector; export options in short form | Export custody/expiry review when consequential; regeneration is routine; no success dialog | Generation/delivery region; exclusions and uncertainty persistent in results; reconciliation failure view/region |
| Replay/archive | Replay controls inline; evidence in inspector; archive/policy work in work region | Hold/correction/archive review; purge or wide-impact deletion review + typed name | Integrity/divergence region; missing evidence view; export/import partial failure persistent |

## Universal behavior

Forms are one column with persistent labels, adjacent help, logical grouping and outcome-named submit. Format validates on blur; completeness validates on submit. Failed submit focuses a linked summary and preserves all input. Duplicate submission produces one Command Receipt. Dialogs are single-layer, inert the background, contain focus, keep title/actions visible, use safe initial focus for destructive actions and return focus to the invoker. Error text says what happened and what to do next without leaking unauthorized objects or raw payloads.

