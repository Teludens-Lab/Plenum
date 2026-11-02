# PS-760 user test — access, research, rehearsal, publication, and live change

Status: **PASS** — product-owner testing completed all ten steps on 2026-11-02 using only visible controls at `http://127.0.0.1:4173/`.

## Recorded result

| Step | Result | Evidence |
|---|---|---|
| 1 | **PASS** | Product-owner confirmation |
| 2 | **PASS** | Product-owner confirmation |
| 3 | **PASS** | Product-owner confirmation |
| 4 | **PASS** | Product-owner confirmation |
| 5 | **PASS** | Product-owner confirmation |
| 6 | **PASS** | Product-owner confirmation |
| 7 | **PASS** | Product-owner confirmation |
| 8 | **PASS** | Product-owner confirmation |
| 9 | **PASS** | Product-owner confirmation |
| 10 | **PASS** | Product-owner confirmation |

No failure or skipped sub-check was reported. Production approval remains separate and was not granted by this user test.

## Start the isolated harness

From PowerShell in the repository root:

```powershell
Set-Location 'C:\Users\ssnguna\Local Sites\Plenum'
.\scripts\start-ps760-user-test.ps1
```

Leave that terminal open. When it reports the URL, open `http://127.0.0.1:4173/`. The script safely reuses its named PostgreSQL container if it already exists.

## Ten-minute script

1. Sign in as **Designer Create** and open **PS-150 S1 proof** in Studio. In **Design workspaces**, confirm all links from **Interfaces** through **Live Changes** are visible. Open **Interfaces**, **Research & Decisions**, **Measurements & reports**, and **Access & readiness**. Confirm each uses labeled visual controls and contains no raw JSON editor.

2. In **Interfaces**, open an Interface Profile. Confirm role, Team, Stage, layout, module, and Information Policy controls are present. Open **Role walkthrough**, choose a visible Session Role, Stage, and Team, then select **Preview interface**. Confirm the preview names the same context and reveals only its available modules and Scenario content.

3. In **Research & Decisions**, confirm decision-bearing Artifact Types can be linked to Research Questions, a decision owner, trigger, information requirements, actions, adjudication method, affected State Values, and Measurement Definitions. In **Measurements & reports**, add a Measurement Definition and a Report Definition, then confirm report sections offer only the governed data-source choices. Wait for **0 unsynchronized changes**.

4. In **Access & readiness**, confirm join methods, Guest requirements and expiry, Operator approval, research-export inclusion, reassignment rules, shared displays, and blocking readiness checks are configurable. Paste this synthetic roster preview into **Name, email, Seat**: `Alex Example,alex@example.test,Blue Lead`. Confirm the row is marked **Ready** and that the page says this preview submits nothing to Runtime.

5. Open **Test & validate**. Keep seed `760` and the fixed start time, then select **Run deterministic rehearsal** twice. Confirm both runs show the same exact Draft digest and final Stages. Confirm every evaluated trigger says **fired** or **did not fire** and includes its why/why-not condition result. Confirm the message states that no Session state changed.

6. Review **Validation**. If an issue is listed, select its path and confirm focus moves to the linked control; correct only the issue introduced during this test. Confirm the Draft becomes **Valid**, synchronized, and has zero unsynchronized changes. Sign out.

7. Sign in as **Publisher** and reopen **PS-150 S1 proof**. In **Review & publish**, select **Freeze for review**. Confirm an exact artifact digest, validation digest context, actor, time, and policy are shown without asking you to paste a Freeze ID. Enter methodology review notes and select **Approve freeze**. This persona is allowed because it is a Reviewer and Publisher that did not author this revision.

8. Complete the visible Release fields with synthetic values (`PS-760 proof`, `1.2.0`, `PS-760 user test`, `classification-reviewed`, `standard-retention`, and an approval rationale), acknowledge warnings, then select **Publish approved freeze**. Confirm a Release is created without raw JSON, SQL, or identifier entry. Next publish an immutable Template version from the same approved freeze. Confirm its version and attributable lifecycle history appear; optionally record a deprecation with a rationale and confirm the published version itself is unchanged.

9. Sign out and sign in as **Admin**. Attempt to reopen the Project and confirm Studio access is explicitly denied or **Approve freeze** is unavailable: Admin authority alone is not methodology approval. Sign out, sign in as **Designer Create**, make one material text edit, wait for synchronization, then sign back in as **Publisher** and freeze again. Confirm the new digest has **0 current approvals** and requires a new review; the earlier approval remains attached only to the earlier digest.

10. In **Live Changes**, confirm Session and candidate Release are chosen by visible labels rather than pasted identifiers. Preview a compatible impact. Confirm existing Workflows, open Polls, in-flight Model Compositions, and queued Commands are counted; blocked or disruptive changes explicitly require a new Session. For a consequential change, sign in as **Reviewer** to record the fresh approval, then sign in as **Operator only** to activate it. Confirm existing work remains pinned to its Governing Release and only new work uses the candidate. Do not force an activation when the fixture has no eligible Session or when the impact is blocked; record that sub-check as **NOT RUN** with the visible reason.

## Record the result

For each step record **PASS**, **FAIL**, or **NOT RUN**, plus the visible message and any screenshot path. A failure in author separation, exact-digest review, immutable history, or Governing Release preservation blocks PS-760 acceptance. Production approval remains separate from this user test.
