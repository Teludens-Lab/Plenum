# PS-770 user test — participant entry and Runtime experience

Status: **PASS** — the product owner confirmed all ten steps on 2026-11-02. Production approval remains separate.

## Start the isolated harness

From PowerShell in the repository root:

```powershell
Set-Location 'C:\Users\ssnguna\Local Sites\Plenum'
.\scripts\start-ps770-user-test.ps1
```

Leave that terminal open, then open `http://127.0.0.1:4173/`. Use only the visible controls below; do not open developer tools, add authorization headers, or copy any identifier.

## Ten-minute role-by-role script

1. At the authentication screen, choose **Invited Participant**. Confirm **Your Sessions** shows **PS-150 S1 proof Session**, while Studio, administration, Person IDs, Session IDs, Seat IDs, and Role IDs are absent.

2. Choose **Accept invitation** once. Confirm Plenum reports that authoritative Session access was updated and shows **Choose an eligible Seat**. Refresh the page and confirm the invitation is not offered again.

3. Choose one labeled eligible Seat. Confirm an **Enter as** link appears with a human-readable Team and Session Role. Choose a second eligible Seat if offered and confirm two distinct **Enter as** choices appear without asking for an identifier.

4. Choose the first **Enter as** link. Confirm the stable `/sessions/.../runtime?role=...` URL opens a role-scoped workspace with Release, Stage, Session status, configured module navigation, and **Exit Session**.

5. If **Active Role Context** is visible, choose its other labeled option. Confirm the workspace reloads under the selected Team and Session Role, and only that role's authorized tasks, messages, Injects, Polls, Voice channels, and content are visible.

6. Follow each link in **Runtime modules**. Confirm every configured module has a visible heading and either authorized content or an explicit empty state. Confirm Session status, artifact forms/tasks, presentations or slide decks, message/proposal areas, and Inject areas never disappear silently when configured.

7. Create or edit one available Draft, then confirm the visible state distinguishes **saved on this device as local pending** from server acceptance. Do not treat local pending as submitted. Rapidly repeat the action and confirm the original receipt is recovered or only one authoritative effect appears.

8. Open `http://127.0.0.1:4173/__test__/offline`, then use browser Back to the Runtime URL. Confirm **Offline** and the protected offline-view message are explicit. Edit only an allowed offline Draft; confirm it remains **local pending**. Confirm live-only control, adjudication, approval, Poll management, and Voice/Floor actions say they were not queued.

9. Open `http://127.0.0.1:4173/__test__/online`, return to the same Runtime URL, and choose **Refresh authoritative state**. Confirm queued work resolves to accepted, rejected, or needs-reconciliation without a duplicate effect or a false submitted claim. Confirm a rejected or conflicted Draft remains recoverable.

10. Choose **Exit Session**, sign out, and sign in as **Reviewer**. Confirm protected participant Session content is absent unless that identity has an active Seat Assignment. Sign out, return as **Invited Participant**, and confirm the accepted invitation and existing Seat Assignments remain intact.

## Record the result

For each step record **PASS**, **FAIL**, or **NOT RUN**, the visible message, selected persona and role, and any screenshot path. A missing visible entry path, UUID field, cross-role disclosure, silent configured module, duplicate effect, or false submission claim blocks PS-770 change-level acceptance.

## Current product-owner evidence

| Steps | Result | Evidence |
|---|---|---|
| 1-4 | **PASS** | Reported by the product owner on 2026-11-02. |
| 5 | **PASS** | The product owner confirmed the role-scoped Runtime heading and authorized content after switching **Active Role Context** on 2026-11-02. The separately observed Studio rehearsal trace completed all 47 unconditional events, and its malformed dash was corrected in `apps/studio/src/core-design/Editor.tsx`. |
| 6-10 | **PASS** | Reported by the product owner on 2026-11-02. |
