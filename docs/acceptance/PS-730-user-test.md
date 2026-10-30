# PS-730 ten-minute foundational Studio user test

## Current status

**PASS (2026-10-30).** The product owner completed the ten-step foundational authoring test and confirmed the four focused retests using the disposable loopback harness and synthetic identities. Visual authoring, bounded parallel Stages, exact validation navigation, server Runtime role preview, undo, and two-Designer convergence passed. Production approval remains separate and is **NOT RUN**.

Use Chrome or Edge on Windows with the disposable loopback harness and synthetic identities only. Do not open developer tools, paste an internal identifier, edit JSON, or test against production.

## Open the currently running harness

Open `http://127.0.0.1:4173/`, choose **Sign in**, and select **Designer**. The current harness is already seeded for this test.

For the two-Designer check in step 10, open a different browser or a private browser window and select **Designer B**. Separate browser profiles are required because each profile keeps one synthetic identity cookie.

## Start a fresh harness later

From the repository root in PowerShell:

```powershell
docker run --detach --name plenum-ps730-user-test-db --publish 127.0.0.1:55437:5432 --env POSTGRES_PASSWORD=plenum_test --env POSTGRES_DB=plenum_ps730_user_test postgres:18.6-alpine
$env:DATABASE_URL='postgresql://postgres:plenum_test@127.0.0.1:55437/plenum_ps730_user_test'
npm run user-test:ps730
```

Wait for `PS-710/PS-720/PS-730 local user-test listening on http://127.0.0.1:4173`. The seed command requires an empty database.

When finished, press Ctrl+C in the server terminal and remove the disposable container:

```powershell
docker rm --force plenum-ps730-user-test-db
```

## Ten-minute script

1. **Open the foundational editor.** Sign in as **Designer**. Find `PS-150 S1 proof` and choose **Open Draft**. Confirm Studio opens without requesting an identifier. Confirm the navigation includes Overview & Scenario, Methodology, Teams, Session Roles, Seats, Activities, Stages, Advanced logic & world state, and Role preview. Confirm the workspaces use ordinary labeled controls and do not expose raw JSON.

2. **Author Overview, objectives, and terminology.** In **Overview & Scenario**, confirm controls are present for Core Design title, subtitle, developer or owner, summary, purpose, intended audience, estimated duration, Scenario identity, tags, and delivery modes. Add a learning objective named `PS-730 objective`, enter a description and at least one success measure, duplicate it, move one copy, then remove the copy. Enter a temporary Purpose value, choose **Undo last change**, and confirm the previous Purpose returns. Enter a custom Team label, clear it again, and confirm the canonical Team label remains usable without a validation error.

3. **Check Methodology dependency safety.** In **Methodology**, choose **Add methodology controls** if the controls are not already present. Attempt to disable **Team**. Confirm the warning names the authored impact or dependent concepts before the change is accepted. Choose **Cancel** so Team remains enabled. Confirm the workspace states that these controls remain a proposal pending `OPEN-004`; it must not describe any unresolved concept as mandatory.

4. **Author a Team without JSON.** Open the first Team. Confirm Team name, short code, color, icon, briefing, Objectives, Resources, Relationships, and Enabled controls are visible. Select `PS-730 objective`. Add a relationship to a different Team, choose a relationship type, and enter a short description. Duplicate the Team, confirm the copy receives a distinct visible entry, then remove the copy. Confirm the original Team and relationship remain.

5. **Author Session Roles and Seats.** Open a Session Role and confirm controls for name, description, responsibilities, capabilities, information clearance, eligible Teams, available Stages, Interface Profiles, and Control role. Add a short responsibility and capability and select an eligible Stage. Open a Seat and confirm Team, minimum and maximum occupancy, Session Roles, and Required Seat are authorable. Confirm these are Session Role and Seat controls, not Organization Role controls.

6. **Create an Activity.** In **Activities**, choose **Add Activity** and name it `PS-730 activity`. Enter a description and participant instructions, select at least one Session Role and one Artifact Type, and select **Required to complete its Stage**. Duplicate the Activity, move the copy, then remove the copy. Confirm the original Activity remains exactly once.

7. **Create flat, nested, timed, and bounded-parallel Stages.** In **Stages**, confirm a Stage Group can have another Stage Group as its parent and set one non-circular parent relationship. Open a Stage and confirm instructions, parent Stage Group, duration, timer behavior, Activities, outgoing branch behavior, incoming merge behavior, operator controls, and transitions are visible. Assign `PS-730 activity` to a normal Stage and set a countdown duration. Then create a bounded parallel example using only visible controls:
   1. At the end of the timeline, choose **Add next Stage** three times. Rename the three new Stages `Branch A`, `Branch B`, and `Join`.
   2. In `Join`, set **Incoming merge behavior** to **Wait for all branches** so it becomes available as a parallel join target.
   3. Open the Stage immediately before `Branch A`. Set **Outgoing branch behavior** to **Start all passing branches**, add a second transition, and target `Branch A` and `Branch B`. Set both **Transition timing** controls to **Automatic when eligible** and select `Join` as **Parallel join Stage**.
   4. In `Branch A`, target `Join` and use **Automatic when eligible**. Confirm `Branch B` also targets `Join` automatically. Leave both branches untimed and without Activities.
   5. Confirm the validation panel does not report an unbounded branch, loop, missing join, or manual parallel transition after synchronization completes.

8. **Author conditional behavior and verify validation language.** In **Advanced logic & world state**, use an existing numeric State Value or choose **Add State Value**. Under **Conditional Stage transitions**, select **Use a State Value condition** on a non-parallel transition and choose the State Value, comparison, and value. Confirm the condition is expressed with labeled controls and no code or JSON. Attempt to create a circular Stage Group relationship by making two groups parents of each other. Confirm Validation reports the exact `stageGroups...` source. Choose that validation link and confirm the affected group opens and focus moves to its **Group name** control. Choose **Undo last change** and confirm the cycle error clears.

9. **Verify the server Runtime role projection.** In **Role & Stage preview**, choose a Session Role, Stage, and eligible Team, then choose **Preview interface**. Confirm the preview names the selected Role and Stage and shows its authorized modules and Scenario content. Change the Role or Stage and preview again. Confirm the result changes to that context and the page states that it uses the same server projection resolver as Runtime. No identifier should need to be copied or pasted.

10. **Verify two-Designer convergence.** Leave the Draft open as **Designer**. In a different browser or private profile, sign in as **Designer B** and open the same `PS-150 S1 proof` Draft through visible Project controls. In Designer A, change the Scenario description to a unique phrase. Confirm Designer B sees the same phrase without refreshing. In Designer B, change the `PS-730 objective` description. Confirm Designer A sees the change without refreshing. Confirm both show `0 unsynchronized changes` after settling, the same Generation, and the same validation state. Refresh one browser and confirm the converged values remain.

## Result record

Record PASS or FAIL for every step. A failure in visual authoring, bounded Stage validation, exact-control navigation, server role preview, undo, or two-Designer convergence blocks PS-730 acceptance.

Date: 2026-10-30  
Tester: Product owner  
Browser/OS: Windows; browser was not recorded  
Viewport: Desktop; exact dimensions were not recorded  
Environment: disposable loopback harness with synthetic identities  

| Step | Result | Evidence / defect |
|---|---|---|
| 1 | PASS | Studio opened without an identifier; all named workspaces were visible through labeled controls and no raw JSON was exposed. |
| 2 | PASS | Identity fields were present. Objective add/duplicate/reorder/remove, Purpose undo, and temporary terminology customization worked without removing the original objective or leaving a label error. |
| 3 | PASS | Methodology controls behaved as described and remained explicitly labeled as an `OPEN-004` proposal with unresolved dependencies blocking Publication. |
| 4 | PASS | Team identity, briefing, objectives, resources, relationships, and Enabled controls were visible; objective selection and relationship authoring worked. The product owner reported the Team workflow functioning without JSON. |
| 5 | PASS | Session Role and Seat controls were visible and functional and remained distinct from Organization Roles. |
| 6 | PASS | Activity add/duplicate/reorder/remove worked and retained the original `PS-730 activity`. |
| 7 | PASS | Nested grouping, timer controls, Activity assignment, and branch/join fields were demonstrated. Focused retest confirmed two automatic fork transitions to `Branch A` and `Branch B`, both bounded branches reached `Join`, `Join` waited for all branches, and no parallel-bound validation error remained. |
| 8 | PASS | A labeled conditional Stage transition used State Value `Testing this`, comparison `equals`, and value `2`. Focused retest confirmed the temporary Stage Group cycle produced the exact `stageGroups...` validation link, opened and focused **Group name**, and cleared after **Undo last change**. |
| 9 | PASS | Role preview changed with the selected Role and Stage, showed the authorized modules and Scenario content from the server Runtime projection, and required no pasted identifier. |
| 10 | PASS | Designer A's Scenario edit converged to Designer B and Designer B's objective edit converged to Designer A without refresh. Both reached `0 unsynchronized changes` with matching Generation and validation state, and the converged values remained after refresh. |

### Focused retest result

The product owner confirmed all four previously missing checks worked as specified: the complete two-branch bounded fork/join, exact validation focus and undo recovery, server-projected Role/Stage preview, and reverse Designer B-to-Designer A convergence with matching state and refresh persistence.

Automated supporting evidence is `PS-730-T01`, `PS-730-T02`, and `AC-01`; browser evidence is written under `output/playwright/ps-730/`. This record grants PS-730 change-level human acceptance and makes PS-740 eligible while `OPEN-010` remains explicitly unratified. It does not grant production approval.
