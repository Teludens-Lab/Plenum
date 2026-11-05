# PS-800 cross-family human usability study

Status: **PASS — Product Owner acceptance recorded 2026-11-05.** Automated browser evidence remains separate from the human acceptance attestation below.

## 1. What this study proves

This study checks whether a new user can:

- recognize the current Organization, Project, Release, Session, Team, role, and lifecycle state;
- find the one valid next action without being coached toward a control;
- understand why unavailable actions are blocked;
- complete work without copying raw identifiers or digests;
- distinguish saved, synchronized, submitted, captured, reconstructed, and replayed information;
- recover from a temporary service failure without losing work; and
- complete the same task under constrained or assistive conditions.

This is a usability and change-acceptance study. It is not production approval, a security review, or proof of live identity-provider integration.

## 2. Minimum participant sample

Use at least **20 new participants**, divided into four cohorts. A participant may complete the related workflows listed for their cohort.

| Cohort | Minimum | Workflows |
|---|---:|---|
| Designer / Publisher | 5 | Studio authoring and review readiness |
| Participant | 5 | Invitation, Seat selection, and Runtime |
| Operator / Administrator | 5 | Session control, administration, Replay, and Archive inspection |
| Research Analyst / Reviewer | 5 | Consent-filtered reporting and least-privilege review |

Participants should resemble the intended role but must not have used this Plenum build before. Do not count the facilitator, implementers, or anyone who has rehearsed the fixture.

## 3. Required environment

Before the participant arrives:

1. Start Docker Desktop and confirm its engine is running.
2. Use a supported browser. Start with the participant's normal browser and device.
3. Close unrelated tabs and disable browser extensions that alter page content.
4. Prepare a timer, observer notes, and an approved screenshot or recording location.
5. Use synthetic participant codes such as **D01**, **P03**, or **O05**. Do not record real names in repository evidence.
6. Confirm the participant has consented to observation or recording under the applicable research policy.

Never use production credentials or production data. The local identity chooser uses synthetic personas and no password.

## 4. Start, reset, and stop the platform

### Start

From PowerShell:

~~~powershell
Set-Location 'C:\Users\ssnguna\Local Sites\Plenum'
.\scripts\start-ps760-user-test.ps1
~~~

The filename is historical; this is the current shared PS-800 human-test launcher. It:

- removes only the disposable container named **plenum-ps760-user-test-db** if it exists;
- creates a clean PostgreSQL 18.6 test database;
- applies migrations and seeds the synthetic personas and fixtures;
- builds Runtime and Studio; and
- serves the platform at **http://127.0.0.1:4173/**.

Leave the PowerShell window open. Wait until it reports that the local user-test server is listening before opening the browser.

### Reset between participants

Each participant must start from a clean fixture:

1. Press **Ctrl+C** in the server PowerShell window.
2. Close all Plenum tabs for that participant.
3. Run **.\scripts\start-ps760-user-test.ps1** again.
4. Open a new private browser window or a fresh browser profile.
5. Confirm the home page shows **Sign in** rather than a previous persona.

Do not reuse a mutated fixture across participants. A participant may switch personas within one assigned cohort when the workflow explicitly calls for it.

### Stop and clean up

After the final session, press **Ctrl+C**, then run:

~~~powershell
docker rm --force plenum-ps760-user-test-db
~~~

## 5. Synthetic personas and fixtures

The participant selects a persona after choosing **Sign in**.

| Persona shown | Use in this study | Primary fixture |
|---|---|---|
| Designer | Studio authoring | **PS-150 S1 proof** |
| Publisher | Optional governance follow-up | **PS-150 S1 proof** |
| Invited Participant | Invitation and Runtime | **PS-150 S1 proof Session** |
| Operator only | Session control, reports, Replay, Archive | **PS-780 Operator Control Exercise** or **PS-150 S1 proof Session** as directed |
| Admin | Members, Plugins, policy, and corrections | Synthetic Organization |
| Research Analyst | Research export | **PS-150 S1 proof Session** |
| Reviewer | Least-privilege check only | Assigned review work |

The facilitator may name the persona during setup. Do not tell the participant where a destination or control is located after the timed task begins.

## 6. Standard session procedure

Allow 30-45 minutes for a single-workflow cohort and 45-60 minutes for the Operator / Administrator cohort.

### Introduction to read aloud

> We are testing Plenum, not you. Please work as you normally would and say what you expect to happen before important actions. Some controls may be unavailable because of the current state or your role. Please use only what is visible in the interface. Do not open developer tools or copy technical identifiers. I will not tell you where controls are, but I may restate the goal. You may stop at any time.

Then explain:

- **Think aloud:** say what you are looking for, what you believe the current state is, and why you choose an action.
- **Destructive actions:** stop at any confirmation that would import an archive, archive a Session, revoke governed data, or otherwise says it is destructive, unless the task explicitly authorizes that action.
- **Technical disclosure:** identifiers and digests may be inspected if useful, but should not be required to finish the task.

### Timing and help rules

1. Start the timer after reading the task prompt and answering questions about the goal, not the interface.
2. Record the first action after the participant reaches the starting page.
3. If silent for 30 seconds, ask: **“What are you looking for now?”**
4. After two minutes without progress, restate the task goal once. This is help level 1.
5. If still blocked after another two minutes, ask: **“Where would you expect this kind of work to live?”** This is help level 2.
6. Directly naming a destination or control is help level 3 and makes the task an independent-completion FAIL.
7. Stop a task immediately for a wrong-authority action, protected-data exposure, destructive confirmation, or distress.

Help levels:

| Level | Meaning |
|---|---|
| 0 | Independent; no task help |
| 1 | Goal restated without interface terms |
| 2 | General conceptual prompt, without naming a destination or control |
| 3 | Destination or control identified; task is FAIL for independent completion |

## 7. Workflow A - Studio authoring

### Facilitator setup

- Participant code prefix: **D**.
- Start at **http://127.0.0.1:4173/**.
- Ask the participant to sign in as **Designer**.
- Provide this test value on a data card: **Usability description <participant-code>**.

### Participant prompt

> Resume the Fractured Order Draft. Confirm that you are in the intended Project and understand its current save state. Change one Team description using the supplied test value. Decide whether this Draft is ready to move into review. Preview the Scribe experience during Orientation for the Blue Team, then leave the Draft with all changes synchronized.

### Facilitator-only expected path

Do not read this section aloud.

1. Find **PS-150 S1 proof** and open its Draft.
2. Use the visible Project/Draft context and guidance, not the URL, to confirm location.
3. Open the Team authoring workspace, choose a Team, and replace or append its description with the supplied value.
4. Observe the save indicator until it reports **Synchronized** and all changes received by the server.
5. Inspect validation or review readiness and explain any visible prerequisite. The participant does not need to freeze or publish.
6. Open the role walkthrough, choose **Scribe**, **Orientation**, and the Blue Team, then preview the interface.
7. Navigate away and back once using normal workspace navigation or browser Back/Forward. Confirm context and the edited value remain.
8. Finish only after the Draft again reports synchronized.

### PASS conditions

- The correct existing Project is opened without copying an identifier.
- The participant can state the Project/Draft context and distinguish local save from server synchronization.
- The description persists after navigation.
- Review readiness is explained from visible status or prerequisites.
- The preview is Scribe + Orientation + Blue and is understood as a preview, not a live Session.
- The final state is synchronized with zero pending changes.

### Record as FAIL if

- the participant opens or creates the wrong Project and cannot recover;
- believes **saved on device** means synchronized;
- cannot find readiness or preview without help level 3;
- believes preview changed live Session state; or
- authored work is lost.

## 8. Workflow B - Participant entry and Runtime

### Facilitator setup

- Participant code prefix: **P**.
- Reset the fixture.
- Start at the home page and use **Invited Participant**.
- Provide these draft values on a data card:
  - own orientation: **Stabilization**;
  - forecast: **Pressure**;
  - narrative: **PS-800 participant draft <participant-code>**.

### Participant prompt

> Join the Session to which you were invited. Choose an eligible Blue Seat, enter the matching role workspace, find the current Stage and connection state, save one allowed draft using the supplied values, and return to Your Sessions.

### Facilitator-only expected path

1. In **Your Sessions**, find **PS-150 S1 proof Session**.
2. Accept the invitation once.
3. Choose an eligible Blue Seat and use the resulting human-readable **Enter as** choice.
4. Confirm the Runtime heading identifies the Blue Team and role, and locate Stage, Session status, and connection information.
5. Find the allowed **Blue Strategic Orientation** draft and enter the supplied values.
6. Save the draft. Ask the participant whether it is local pending, server accepted, or submitted.
7. Return using the visible Session exit/navigation path, not by editing the URL.

### PASS conditions

- Invitation and eligible Seat are selected without identifiers.
- The participant enters the correct role-scoped workspace.
- Stage and connection state are correctly reported.
- Draft state is described accurately; local pending is not called submitted.
- The participant returns to **Your Sessions** and the accepted invitation is not offered again.

### Record as FAIL if

- a wrong or ineligible Seat is selected without a useful explanation;
- content from another Team or role is exposed;
- local pending work is mistaken for authoritative submission;
- the task causes a duplicate authoritative effect; or
- there is no understandable route back to the Session list.

## 9. Workflow C - Operator control and readiness

### Facilitator setup

- Participant code prefix: **O**.
- Reset the fixture unless this is the same Operator / Administrator participant continuing an assigned cohort workflow.
- Start with **Operator only**.
- Provide the reason: **PS-800 usability lifecycle check <participant-code>**.

### Participant prompt

> Open the Operator Control Exercise. Explain its current lifecycle state, whether it can advance, and why. Perform only the next valid lifecycle action using the supplied reason. Then inspect staffing without copying an identifier and find any delivery problem or warning that needs action.

### Facilitator-only expected path

1. Find **PS-780 Operator Control Exercise** from the Session catalog and open its control workspace.
2. Read the current lifecycle state, readiness, and visible prerequisites.
3. Identify the single available next action. In the clean fixture the Session begins open, so the next valid action should be to start it.
4. Enter the supplied reason, review the state-change preview, acknowledge the confirmation, and apply once.
5. Confirm a success announcement and one version/state transition.
6. Inspect staffing using human-readable Seat/role labels. Opening reference disclosure is allowed but should not be necessary.
7. Inspect delivery health and warnings; explain whether action is required.

### PASS conditions

- The participant selects the state-valid action rather than a later lifecycle action.
- Prerequisites and disabled destinations are understood from visible copy.
- Confirmation, reason, and state transition are understood before action.
- Only one state change occurs.
- Staffing and delivery status can be understood without copying an identifier.

### Record as FAIL if

- a later lifecycle action appears available or is chosen incorrectly;
- the action lacks a reason or meaningful confirmation;
- duplicate state changes occur;
- a hidden prerequisite blocks progress; or
- staffing/delivery status requires raw identifiers to interpret.

## 10. Workflow D - Organization administration

### Facilitator setup

- Continue with the same Operator / Administrator participant on the current fixture or reset and start as **Admin**.
- Provide this correction data card:

| Field | Test value |
|---|---|
| Target reference | **PS-800 usability observation <participant-code>** |
| Original recorded value | **Retention period described as twelve months** |
| Corrected value | **Retention period is 365 days** |
| Correction reason | **Clarify the plain-language retention period** |

### Participant prompt

> Review the Organization access held by the synthetic final reviewer. Find the pending Plugin's provenance without losing its main lifecycle status. Record the supplied correction in ordinary language. Finally, explain what would happen if an Organization archive were exported or imported, but do not import or archive anything.

### Facilitator-only expected path

1. Open members and inspect **Synthetic final reviewer**. The participant should identify its current Organization Role without changing it.
2. Open Plugin operations and find **org.ssg.fixtures.pending 1.0.0**.
3. State the Plugin's lifecycle status, then inspect its artifact/bundle/supply-chain details through progressive disclosure.
4. Open data policy and record the supplied correction.
5. Confirm the correction appears in history and the interface says the original was not overwritten.
6. Inspect portable archive export/import explanations. Do not submit an import.

### PASS conditions

- Role membership, Plugin lifecycle, and provenance remain distinguishable.
- Technical details are available but do not displace the primary status.
- Correction values accept ordinary language and appear in history.
- The participant explains that export excludes secrets/transient credentials and import is for a verified archive into an empty deployment.
- No destructive import, archive, role mutation, Plugin approval, installation, revocation, or deletion occurs.

### Record as FAIL if

- protected Organization data is exposed to the wrong persona;
- the participant must enter JSON or copy an identifier;
- lifecycle status becomes unclear after opening provenance;
- correction overwrites rather than supplements the original; or
- a destructive action occurs without explicit authorization.

## 11. Workflow E - Research reporting

### Facilitator setup

- Participant code prefix: **R**.
- Reset the fixture.
- Sign in as **Research Analyst**.
- Provide the exact approved purpose: **PS-790 research test**.

### Participant prompt

> Create a consent-filtered research export for the approved purpose supplied to you. Explain what is captured evidence and what is reconstructed narrative, inspect the export's provenance, and download the generated export.

### Facilitator-only expected path

1. Open Research reports.
2. Select **PS-150 S1 proof Session**.
3. Enter the exact approved purpose and choose JSON.
4. Generate the export and wait for the success state.
5. Explain the difference between **Captured History** and **Reconstructed Narrative**; reconstructed narrative is not a transcript.
6. Inspect source/provenance details through disclosure.
7. Download the generated export from its persistent history row.
8. Confirm no person name, email, identity-provider mapping, or direct identity mapping is shown.

### PASS conditions

- The correct authorized Session and approved purpose are used.
- Consent filtering and pseudonymization are understood.
- Captured evidence is not confused with reconstructed narrative.
- Provenance can be inspected without the digest interrupting the main task.
- The download remains available after generation.

### Record as FAIL if

- an unapproved purpose appears accepted as approved;
- reconstructed narrative is described as a transcript or captured fact;
- direct identity data appears;
- the generated export cannot be found again; or
- technical digest/reference content dominates or blocks the primary task.

### Reviewer least-privilege follow-up

After the research task, sign out and use **Reviewer**. Ask the participant to try to reach members, Plugins, and Research reports using visible navigation only. PASS requires those protected destinations to be absent or explicitly denied without disclosing protected content.

## 12. Workflow F - Replay and Archive inspection

### Facilitator setup

- Use an Operator / Administrator participant.
- Sign in as **Operator only**.
- Use **PS-780 Operator Control Exercise** if continuing Workflow C; otherwise use **PS-150 S1 proof Session**.
- Do not authorize Archive confirmation.

### Participant prompt

> Verify this Session's evidence without changing Session state and explain the result. Then review the Archive destination and explain what archiving would preserve, what it would remove from active work, and whether any retention rule or legal hold blocks it. Stop before confirming Archive.

### Facilitator-only expected path

1. Open Replay from the selected Session.
2. Run replay once.
3. Explain **Matched** or any difference, the Captured History manifest, and that Reconstructed Narrative is a deterministic comparison rather than a transcript.
4. Confirm the Session lifecycle state did not change.
5. Open Archive and inspect retention policy, legal-hold status, immutable Governing Release/evidence preservation, and removal from active operations.
6. The participant may enter a reason to inspect form behavior but must not confirm Archive.

### PASS conditions

- Replay is understood as read-only verification.
- Result and any differences are correctly explained.
- No Session state changes.
- Archive consequences and any prerequisite/block are correctly described.
- The participant stops before destructive confirmation.

### Record as FAIL if

- Replay is believed to mutate or re-run the live Session;
- reconstructed narrative is treated as a transcript;
- Archive hides its preservation/removal consequences;
- legal hold or retention prerequisites are not exposed; or
- Archive is confirmed.

## 13. Recoverable-error exercise

Run this once per participant after they have entered some non-destructive data but before the final task completes.

### Facilitator-only injection

1. In a separate facilitator tab, open **http://127.0.0.1:4173/__test__/offline**.
2. Return focus to the participant's existing Plenum tab.
3. Ask: **“Please continue the task and tell me what you believe is still safe or saved.”**
4. Let the participant encounter the error, identify its scope, and try the offered recovery.
5. After the participant has recognized the offline condition, open **http://127.0.0.1:4173/__test__/online** in the facilitator tab.
6. Ask the participant to continue. Do not name the retry/refresh control.

### PASS conditions

- The failed scope is clear; the interface does not imply a successful mutation.
- Protected data is not shown on the offline state.
- Previously entered local/synchronized data is not lost.
- The participant finds the offered retry or refresh without help level 3.
- Work resumes after connectivity returns.

If the participant cannot recover, record FAIL and preserve the route, visible message, and state before/after recovery.

## 14. Constrained and accessibility sampling

Run the normal condition first, then the assigned variant so prior difficulty is not caused by unfamiliar equipment.

Across the 20-participant minimum, include:

- at least one keyboard-only session in every cohort;
- at least one workflow at 200% browser zoom with an effective viewport near 320 CSS pixels;
- at least one form workflow at approximately 1280 x 600;
- at least one physical phone and one physical tablet touch session;
- light and dark themes;
- reduced-motion preference;
- Windows High Contrast or the platform equivalent;
- one qualified NVDA + Firefox session;
- one qualified JAWS + Edge session; and
- one qualified VoiceOver + Safari session.

For keyboard/AT sessions record:

- heading and landmark navigation;
- visible focus order and whether focus is obscured;
- disclosure expanded/collapsed state;
- dynamic status/error announcements;
- label, instruction, and error association;
- dialog/confirmation focus entry and return; and
- whether the primary task can be completed without pointer input.

At 200%/narrow width, record horizontal page scrolling, clipped controls, overlapping content, task-order changes, and whether any target becomes too small to operate.

## 15. Measurement definitions

Use these definitions consistently:

- **Task success:** completed with help level 0-2 and without a blocking error.
- **Independent task success:** completed with help level 0 or 1. This is the value used for the 4/5 threshold.
- **First correct action:** the first meaningful navigation or action advances toward the expected path. Opening account/theme controls, an unrelated workspace, or a later lifecycle action is incorrect.
- **Completion time:** from the end of the task prompt to the final required state. Pause only for facilitator-caused interruption.
- **Wrong-mode action:** attempts work in Preview/Replay/offline/read-only state as though it were authoritative.
- **Wrong-authority action:** attempts or succeeds at an action the selected role should not perform.
- **Recovery success:** returns to the task with prior work intact and no false-success belief.
- **Backtrack:** returns to a previous page/workspace because the chosen path did not advance the task.
- **Critical hesitation:** no progress for at least 30 seconds.

After each workflow ask:

> Overall, how easy or difficult was this task?

Record a Single Ease Question score from 1 (**very difficult**) to 7 (**very easy**), then ask:

> What, if anything, made you uncertain?

Record the participant's wording exactly.

## 16. System Usability Scale

After all assigned workflows, ask the participant to rate each statement from 1 (**strongly disagree**) to 5 (**strongly agree**):

1. I think I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think I would need technical support to use this system.
5. I found the functions in this system well integrated.
6. I thought there was too much inconsistency in this system.
7. I imagine most people would learn to use this system quickly.
8. I found the system cumbersome to use.
9. I felt confident using the system.
10. I needed to learn a lot before I could get going.

Score odd-numbered items as response minus 1. Score even-numbered items as 5 minus response. Add the adjusted values and multiply by 2.5. Record the resulting 0-100 SUS score.

## 17. Observer record template

Create one copy per participant.

~~~md
Participant code:
Cohort:
Date/time:
Facilitator:
Observer:
Browser/version:
Operating system/device:
Viewport/window:
Input method:
Zoom/text size:
Theme:
Reduced motion:
Forced/high-contrast mode:
Assistive technology/version:
Fixture reset confirmed: YES / NO

| Workflow/task | Result (PASS/FAIL/NOT RUN) | Help level | First action correct? | Time | Hesitations | Backtracks | Wrong mode/authority | Recovery | SEQ |
|---|---|---:|---|---:|---:|---:|---|---|---:|
| | | | | | | | | | |

Participant wording:
- Current context:
- Why the next action is valid:
- Saved versus synchronized/submitted:
- Captured versus reconstructed:
- Replay/Archive meaning:
- Main uncertainty:

Evidence:
- Screenshot/recording path:
- Console/server observation, if facilitator-only:
- Defect IDs:

SUS responses:
1:  2:  3:  4:  5:
6:  7:  8:  9:  10:
SUS score:
~~~

## 18. Defect record template

For every failure or material hesitation, create a record with:

~~~md
Defect ID:
Participant code:
Route:
Persona and role:
Viewport/input/AT:
Starting state:
Task goal:
Expected behavior:
Observed behavior:
Exact visible copy:
Exact participant wording:
Reproduction steps:
Evidence path:
Severity: BLOCKER / HIGH / MEDIUM / LOW
Related acceptance threshold:
~~~

Do not put real participant names, emails, recordings, or other personal information in the repository.

## 19. Acceptance thresholds

PS-800 change-level human acceptance requires all of the following:

- independent task success of at least 4/5 for every cohort and workflow;
- first correct action of at least 80% for every workflow;
- median SEQ of at least 6/7 for every workflow family;
- overall SUS of at least 80;
- zero wrong-mode actions that create an authoritative effect;
- zero wrong-authority actions or protected-data disclosures;
- recoverable-error success of at least 4/5 in every cohort; and
- no unresolved blocking observation.

Missing sessions or device/AT conditions are **NOT RUN**, never PASS.

## 20. Blocking observations

Block PS-800 acceptance for any:

- wrong-authority action or protected-data disclosure;
- hidden prerequisite or multiple conflicting primary actions;
- loss of authored or pending work;
- false claim that local pending work was submitted;
- belief or behavior suggesting Replay changed authoritative Session state;
- inability to recover from the seeded service failure;
- inaccessible primary action, confirmation, error, or disclosure;
- horizontal task overflow at the supported reflow condition;
- Archive/import action completed without explicit study authorization;
- direct identity mapping in a research export; or
- technical identifier/digest required to complete an ordinary task.

## 21. Close-out

After the final participant:

1. Calculate cohort and workflow thresholds.
2. List every PASS, FAIL, and NOT RUN condition.
3. Triage blocking and high-severity defects before retesting.
4. Retest changed workflows with new participants when the change affects discoverability or comprehension.
5. Link sanitized evidence from the PS-800 family close-out records.
6. Change this document's status only after the required human, device, browser, and assistive-technology evidence is complete.

Production approval remains a separate decision even if this study passes.

## 22. Product Owner acceptance record

On 2026-11-05, the Product Owner directed that the PS-800 human, physical-device, browser, assistive-technology and performance gates be recorded as complete and stated: **“I did the check, it's fine. Approved.”** This is the accountable acceptance basis for PS-800 change-level closure.

No participant-level records, device/browser versions, assistive-technology versions, SUS/SEQ calculations or raw performance traces were supplied with that attestation, so none are fabricated here. This acceptance closes PS-800 only; it does not waive or pre-complete the independent production gates owned by PS-815, PS-820, PS-840 or PS-850.
