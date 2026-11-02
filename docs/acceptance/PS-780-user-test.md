# PS-780 user test — operator control floor and recovery

Status: **PASS** — the product owner completed all ten script points on 2026-11-02. Production approval remains separate.

## Start the isolated harness

From PowerShell in the repository root:

```powershell
Set-Location 'C:\Users\ssnguna\Local Sites\Plenum'
.\scripts\start-ps780-user-test.ps1
```

Leave that terminal open and open `http://127.0.0.1:4173/`. Use only visible controls. Do not use developer tools, authorization headers, or copied identifiers.

## Ten-minute script

1. Sign in as **Operator only** and open **PS-780 Operator Control Exercise** from the Session catalog, then **Runtime**. Confirm the stable `/admin/sessions/...` control floor names the Release and Session state and shows connected Participants, Seat occupancy, active tasks, delivery health, warnings, Injects, Adjudications, recent authoritative events, and readiness/staffing.

2. If the Session is **configured**, complete the visible readiness checks, choose **Mark Session ready**, then **Open Session**. For each action confirm the control disables while pending, the result is announced, and refresh shows exactly one state change.

3. In **Session control**, select **Start Session**, enter a reason, check confirmation, and apply it. Confirm the preview reads `open → active`, Session version increases once, and a `session.started` event appears.

4. In **Stage control**, start the Stage with a reason and confirmation. Confirm Stage status, version, elapsed/remaining time, and server-authoritative timer are visible. Refresh after several seconds and confirm elapsed time increases without a client-only reset.

5. Pause and resume the Stage, then extend it by 300 seconds. Confirm each reasoned intervention changes the Stage version once, pause freezes elapsed time, resume continues it, and extension increases remaining time. If a configured transition is available, exercise **End**, **Reopen**, **Skip/advance**, or **Return** only where the visible Release controls allow it.

6. Under **Injects**, release one pending manual Inject, or cancel one nonterminal Inject. Confirm it changes exactly once, appears in recent events, and no recipient content is exposed on the Operator control floor. Under **Adjudications**, confirm the queue is explicit even when empty.

7. In **Session control**, pause and resume the Session with distinct reasons. Confirm `active → paused → active`, one version per accepted Command, and no duplicate effect after rapidly double-clicking the pending control.

8. If a dead-lettered delivery is present, choose **Retry delivery** once and confirm it returns to pending with a `delivery.retried` event. Otherwise record **NOT RUN — no seeded dead letter** for this sub-check. Confirm warnings remain explicit and no failed item silently disappears.

9. Complete the Session, then lock it, using a reason and confirmation for each. Confirm Stage/queue/evidence history remains readable. Open **Archive**, enter a retention reason, confirm Archive, and verify the immutable Release and evidence history remain available while the Session leaves active operations.

10. Sign out and sign in as **Reviewer**. Confirm the Operator control floor and protected Session data are denied. Sign out, sign back in as **Operator only**, refresh the archived Session link, and confirm history is preserved and no control can restart the locked/archived Session.

## Record the result

For each step record **PASS**, **FAIL**, or **NOT RUN**, the visible state/event, persona, reason used, and screenshot path. Any unauthorized access, client-only timer, duplicate mutation, unreasoned intervention, missing confirmation, erased failure, stale version overwrite, or ability to restart a locked/archived Session blocks PS-780 change-level acceptance.

## Result

The product owner reported **PASS** for all ten script points on 2026-11-02. No PS-780 change-level acceptance blocker was reported.
