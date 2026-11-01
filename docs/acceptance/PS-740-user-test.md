# PS-740 ten-minute authoring user test

## Current status

**PASS (2026-11-01).** The product owner completed the ten-step authoring test and confirmed the focused content/version/quarantine, route recovery, Inject timeline, and persistence checks using the disposable loopback harness and synthetic identities. Production approval remains separate and is **NOT RUN**. `OPEN-010` remains unratified.

Use Chrome or Edge on Windows with the disposable loopback harness and synthetic identities only. Do not open developer tools, add authorization headers, paste identifiers, edit JSON, or use production data.

## Start the disposable harness

Open PowerShell in the repository root, not `C:\Users\ssnguna`, then run:

```powershell
cd 'C:\Users\ssnguna\Local Sites\Plenum'
docker run --detach --name plenum-ps740-user-test-db --publish 127.0.0.1:55439:5432 --env POSTGRES_PASSWORD=plenum_test --env POSTGRES_DB=plenum_ps740_user_test postgres:18.6-alpine
$env:DATABASE_URL='postgresql://postgres:plenum_test@127.0.0.1:55439/plenum_ps740_user_test'
npm run user-test:ps740
```

Wait for `PS-710/PS-720/PS-730/PS-740 local user-test listening on http://127.0.0.1:4173`. Startup also creates four synthetic upload files under `output\user-test\ps-740\` so the entire test can be completed through visible controls.

Open `http://127.0.0.1:4173/`, choose **Sign in**, select **Designer**, find `PS-150 S1 proof`, and choose **Open Draft**.

When finished, press Ctrl+C in the server terminal and remove the disposable database:

```powershell
docker rm --force plenum-ps740-user-test-db
```

## Ten-minute script

1. **Confirm the authoring workspaces.** Confirm Studio opens without requesting an identifier and includes **Forms & Artifact Types**, **Workflows**, **Information Policy**, **Communications**, **Injects**, and **Content Library**. Confirm each uses labeled controls and does not expose raw JSON, scripts, or unrestricted HTML.

2. **Build and preview an Artifact Type.** In **Forms & Artifact Types**, choose **Add Form and Artifact Type**. Open it and name both the Form and Artifact Type `PS-740 field report`. Confirm controls exist for stable key, ownership, Workflow, Information Policy, creator and recipient Session Roles, available Stages, version history, retention reference, decision-bearing, and export. Add a section and two fields. Set field labels and keys, choose different field types, add help/reporting text and validation bounds, mark one required, and make the second conditionally visible from the first. Confirm the rule appears as a readable sentence. Field types, nesting, calculated fields, attachments, and import/export remain bounded by unratified `OPEN-010`; the UI must not imply that unresolved options are approved.

3. **Check responsive and historical-style previews.** In the new Form's **Form preview**, switch among Desktop, Tablet, and Mobile, then among Data entry, Read-only review, and Completed Artifact. Confirm the canvas changes size, read-only/completed inputs cannot be edited, the labels and help text remain readable, and no horizontal page overflow appears. Return to Data entry before continuing.

4. **Build the complete DEC-42 reference Workflow.** In **Workflows**, choose **Add DEC-42 reference Workflow** and open `DEC-42 reference review`. Confirm its guarded preview contains a forward path from draft through intermediate review and control review to completion, plus **Return to author**, **Return for revision**, and **Resubmit for intermediate review** paths. Confirm states expose kind, holder roles, approval rule/due period where applicable, and transitions expose command, label, source, target, allowed roles, notifications, priority, content-only, and creator notification. Do not create a loop.

5. **Verify deny-by-default communications.** In **Communications**, inspect Message Channel settings and the **Route matrix by Session Role**. Add a Communication Route. Confirm sender, recipient, channel, Information Policy, optional approval Workflow, active Stages, and a readable route sentence are available. Select **Public recipient** while the route uses a non-public policy. Confirm a visible `leakage blocked` warning says Publication remains blocked. Clear **Public recipient** and confirm the warning clears and the route is shown as governed.

6. **Author an Inject and preview its timing.** In **Injects**, choose **Add Inject** and name it `PS-740 decision prompt`. Confirm content, sender identity, recipients, public/control recipients, required response Artifact Type, response deadline, follow-on Injects, and control notes are authorable. Change Release mode to Stage entry, choose a Stage, and confirm the Inject appears under that Stage in **Timeline preview**. Change Release mode to Conditional Gate and confirm a State Value selector appears.

7. **Upload, search, reuse, and version safe content.** In **Content Library**, set title to `PS-740 governed brief`, choose `output\user-test\ps-740\ps-740-safe.txt`, and choose **Upload and scan**. Confirm the UI reports that the malware scan passed, the item is `clean`, a digest and Version 1 are visible, and **Use current version in Scenario** is enabled. Use it, search for `governed brief`, then choose **New version of PS-740 governed brief**, select the same safe file, and upload again. Confirm Version 2 is current and Version history retains both v2 and immutable v1.

8. **Verify unsafe and failed uploads never become usable.** Upload each remaining synthetic file as a new content item:
   - `ps-740-eicar.txt` must be `infected` and its reuse button disabled.
   - `ps-740-scanner-failure.txt` must be `failed` or otherwise explicitly unavailable and its reuse button disabled.
   - `ps-740-oversized.txt` must be rejected with the 512 KiB size boundary and must not appear as reusable content.

9. **Verify type mismatch and recovery.** Select `ps-740-safe.txt`, manually choose declared content type **PDF**, and upload. Confirm the file-content/type mismatch is rejected and no usable version is created. Restore **Plain text**, upload with a new title, and confirm the clean upload succeeds without reloading Studio. Confirm the earlier infected, failed, and rejected items did not become clean after the retry.

10. **Verify persistence and least privilege.** Wait for `0 unsynchronized changes`, refresh, and confirm the Form, DEC-42 Workflow, governed Communication Route, Inject, safe content version history, and reused Scenario content remain. Sign out and sign in as **Reviewer**. Open assigned review work and confirm Artifact, Workflow, Communication, Inject, and Content Library mutation controls are absent or access is explicitly denied; protected upload records and identifiers must not be disclosed. Sign back in as **Designer** and confirm the safe content remains available exactly once per version.

## Result record

Record PASS or FAIL for every step. A failure in Form/Artifact preview, DEC-42 return paths, leakage blocking, Inject authoring, clean-content reuse, quarantine, version history, persistence, or least privilege blocks PS-740 acceptance.

Date: 2026-11-01  
Tester: Product owner  
Browser/OS: Windows; browser was not recorded  
Viewport: Desktop; exact dimensions were not recorded  
Environment: disposable loopback harness with synthetic identities

| Step | Result | Evidence / defect |
|---|---|---|
| 1 | PASS | Studio opened without an identifier; all six named workspaces used labeled controls and exposed no raw JSON, scripts, or unrestricted HTML. |
| 2 | PASS | Artifact Type and Form controls, two fields, validation metadata, and readable conditional-visibility sentence were confirmed; the `OPEN-010` boundary remained explicit. |
| 3 | PASS | Desktop, Tablet, Mobile, data-entry, read-only, and completed previews behaved as specified without reported overflow. |
| 4 | PASS | The DEC-42 reference preview included the forward path, both return paths, resubmission, state controls, transition authority, notifications, and priorities. |
| 5 | PASS | Public delivery under a non-public policy displayed the publication-blocking leakage warning; clearing Public recipient removed the warning and restored governed status. |
| 6 | PASS | Inject content, sender, recipients, response/dependency controls, Stage-entry timeline placement, and Conditional Gate State Value selection worked. |
| 7 | PASS | Safe content passed scanning, displayed its digest, was reused in Scenario authoring, was searchable, and retained immutable clean v1 beneath current v2. |
| 8 | PASS | The EICAR fixture remained infected, the scanner-failure fixture remained failed/unavailable, and the oversized fixture was rejected; none became reusable. |
| 9 | PASS | Declaring the text fixture as PDF produced the expected type-mismatch rejection; restoring Plain text allowed recovery without reload and did not change unsafe statuses. |
| 10 | PASS | Authored state and exact content versions persisted after refresh and role changes; Reviewer lacked design mutation access and protected upload data was not disclosed. |

Automated supporting evidence is `PS-740-T01`, `PS-740-T02`, `AC-04`, and `AC-05`; browser evidence is written under `output/playwright/ps-740/`. The product owner also supplied screenshots of clean v1/digest/reuse state and the declared-type rejection, then explicitly confirmed the remaining focused checks. This record grants PS-740 change-level human acceptance and makes PS-750 eligible. It does not grant production approval.
