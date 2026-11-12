# PS-790 user test — administration, reporting, replay, archive, and Plugin operations

BA-09 clarification (2026-11-12): the historical owner acceptance below is retained for the exercised presentation/workflows. The Replay fixture then echoed captured records; it did not prove independent reconstruction. Current profiles must show Replay unavailable, without a runnable action, and link to captured-history Reports. That containment check does not satisfy required Replay: REQ-042/REQ-060 and BA-09-T01/T02 remain open. See `../ps-520-verification.md` for current evidence; the historical step 6 is not reconstruction acceptance for the current candidate.

Status: **PASS** — the product owner completed all ten script points on 2026-11-02 and supplied visible product screenshots. Production approval remains separate.

## Start the isolated harness

From PowerShell in the repository root:

```powershell
Set-Location 'C:\Users\ssnguna\Local Sites\Plenum'
.\scripts\start-ps790-user-test.ps1
```

Leave that terminal open and open `http://127.0.0.1:4173/`. Use only visible controls. Do not use developer tools, authorization headers, copied identifiers, SQL, or command-line API calls.

The harness creates three synthetic files under `output\user-test\ps-790\`:

- `ps-790-synthetic-plugin.json`
- `ps-790-revocations.json`
- `ps-790-license-terms.txt`

## Ten-minute script

1. Sign in as **Admin** and open **Administration → Members and roles**. Add **Operator** to **Synthetic final reviewer**, save once, and confirm the audit notice. Remove **Operator** again and save. Refresh and confirm the original Reviewer-only assignment is restored. In a second tab, try saving an older copy after the first tab changes the same member; confirm the stale edit is rejected and a refresh recovers it.

2. Sign out and sign in as **Publisher**. Open **Administration → Plugin operations**. Select `output\user-test\ps-790\ps-790-synthetic-plugin.json`, choose **Verify and submit**, and confirm the signed bundle is accepted in **contract validated** state. Submit the same file once more and confirm no duplicate Artifact appears.

3. Sign in as **Admin** and return to **Plugin operations**. Confirm Publisher, trust-root, revocation-list, and license-acceptance counts are visible. Find `org.ssg.fixtures.pending 1.0.0`; inspect its Artifact digest, bundle digest, and supply-chain provenance. Approve it, expand **Install approved Artifact**, install with the visible defaults, and confirm one installation. Revoke it and confirm historical installation/binding provenance remains visible while no new installation control remains.

4. Open **Administration → Data policy**. Record a uniquely named Organization retention policy, place an Organization legal hold with a reason, and record a correction with different original/corrected JSON values. Confirm each appears in history and the original value was not overwritten. Download the portable Organization archive and confirm the JSON file is saved. Do not import it into this non-empty test Organization.

5. Sign in as **Operator only**, open **PS-150 S1 proof Session**, then **Reports**. Generate JSON and confirm **Captured History**, **Reconstructed Narrative**, source references, observation/metric counts, digest, and a reusable download are visible. Generate PDF and confirm it opens as a readable governed report with page numbering; PDF output must paginate when the captured evidence exceeds one page.

6. Open **Replay**, choose **Run replay**, and confirm the result reports **Matched** with a Captured History manifest digest and no differences. Confirm the Reconstructed Narrative is explicitly described as a deterministic comparison, not a transcript. Refresh and confirm Session state did not change.

7. Open **Archive**. Confirm the applicable retention policy, active legal hold, preservation of the immutable Governing Release and Evidence, and removal-from-active-operations consequence are shown before confirmation. Do not confirm Archive unless you intend to finish this disposable Session lifecycle.

8. Sign in as **Research Analyst** and open **Research reports**. Select **PS-150 S1 proof Session**, enter the exact approved purpose `PS-790 research test`, generate JSON, and confirm the export is consent-filtered, source-traceable, pseudonymized, and listed under **Your generated exports**. Confirm no person name, identity-provider mapping, email, or other direct identity mapping appears in the provenance view or download.

9. Sign in as **Reviewer** and open `/admin/members`, `/admin/plugins`, and `/research/reports`. Confirm each unauthorized workspace gives an explicit least-privilege denial and shows no protected member, Plugin, report, Session, or identifier data. Sign in as **Publisher** and confirm Members/Data policy controls are absent; sign in as **Operator only** and confirm Plugin administration is absent.

10. While signed in as Admin or Operator, open `/__test__/offline`, retry a report or administration destination, and confirm protected data is withheld with a recoverable offline message and no mutation is implied. Open `/__test__/online`, retry, and confirm the role assignment, Plugin lifecycle state, report digest, legal hold, and Session state are unchanged.

## Record the result

For every point record **PASS**, **FAIL**, or **NOT RUN**, the persona, visible result, and screenshot path. Any cross-role or cross-Organization disclosure, missing stale-write rejection, duplicate Artifact, unverified Plugin installation, lost provenance, identity mapping in research output, reconstructed narrative presented as transcript, report truncation, replay mutation, legal-hold bypass, or non-recoverable offline state blocks PS-790 change-level acceptance.

## Result

The product owner reported **PASS** for all ten script points on 2026-11-02. Supplied screenshots show the Administration and Plugin operations workspaces, role assignment, Publisher bundle submission, approved and installed Plugin provenance, Research Analyst consent-filtered reporting, provenance inspection and reusable generated export. No PS-790 change-level acceptance blocker was reported.
