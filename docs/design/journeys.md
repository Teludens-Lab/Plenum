# PS-800 critical journeys

Status: Checkpoint A journey definition complete; walkthrough and implementation evidence are pending.

| ID | Role | Start state | End state / success condition | Frequency | View families |
|---|---|---|---|---|---|
| J-ADM-01 | Admin | Signed in to an Organization roster | Member roles are authoritatively updated; stale and final-Admin protection are intelligible | Occasionally | organization administration |
| J-ADM-02 | Admin | An Organization governance area needs action | Plugin, deployment or data-policy decision is committed through typed controls with visible consequence/audit evidence | Occasionally / rarely | organization administration |
| J-DES-01 | Designer | Signed in with no Draft open | Correct Project/Draft and section are open with collaborator/sync state and next action visible | Every authoring session | platform lifecycle, Studio authoring |
| J-DES-02 | Designer | A Project Draft is open | Complete simulation is visually authored, valid, previewed and rehearsed without mutating authoritative Session state | Every Release | Studio authoring |
| J-REV-01 | Reviewer | Exact frozen revision or live-change request is assigned | Exact digest/scope and issues are reviewed; approval/rejection consequence is recorded | Every publication/change | Studio authoring, platform lifecycle |
| J-PUB-01 | Publisher | An approved exact revision is ready | Immutable Release/Template is published and Package export/import provenance is clear; duplicate/invalid action is prevented | Every Release / occasionally | platform lifecycle, Studio authoring |
| J-PAR-01 | Participant | Addressed invitation is received | Allowed Seat/role is entered and Session, Seat and Active Role Context are explicit | Every Session entry | platform lifecycle, participant Runtime |
| J-PAR-02 | Participant | Participant Runtime is open in an Active Role Context | Configured module work is completed and any allowed role switch is reflected everywhere; unauthorized modules remain absent | Repeatedly per Session | participant Runtime |
| J-PAR-03 | Participant | Runtime loses connectivity with supported local work available | Local pending work reconnects and confirms, rejects or conflicts with an explicit recovery path | As needed | participant Runtime |
| J-OPR-01 | Operator | Published Release is available | Session is configured, staffed, ready and open with all blocking checks visible and no internal-ID entry | Every Session | platform lifecycle, Operator control |
| J-OPR-02 | Operator | Ready Session enters live operation | Stage, timer, Inject, Poll, Voice and adjudication operations complete with consequences, delivery and durable outcomes visible | Every Session | Operator control |
| J-OPR-03 | Operator | Delivery/dependency/concurrency failure is detected | Degraded scope is understood and safe recovery completes or leaves an actionable durable failure | As needed | Operator control, reporting/research |
| J-OPR-04 | Operator | Session reaches completion criteria | Reports, replay/integrity review and archive/hold outcome are completed and traceable | Every Session | Operator control, reporting/research, replay/archive |
| J-RSH-01 | Research Analyst | Authorized Project/Session evidence and purpose are available | Purpose/consent-filtered report/export states question, population, exclusions, uncertainty and provenance | Occasionally | reporting/research |

## Walkthrough method

For each journey, the implementation phase records a cognitive walkthrough under `docs/design/walkthroughs/<journey-id>.md` and answers at every step: Will the role know what to do? Will the control be found? Will feedback explain progress and outcome? Can failure be recovered without losing work or weakening authorization? The files are created when real post-change behavior can be observed; Checkpoint A does not fabricate walkthrough results.

## Shared acceptance rules

- No journey requires typing a UUID, code or raw JSON.
- Terminology comes from the Glossary or the active terminology profile.
- Loading never masquerades as empty; unauthorized never masquerades as missing.
- Destructive or authoritative actions state object, scope, consequence and reversibility.
- Keyboard focus follows the visual/semantic order and returns to the invoker after dismissal.
- Every successful action has a stable resulting state, not only a transient toast.

