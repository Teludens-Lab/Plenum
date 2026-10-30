# PS-710 ten-minute Organization, Project, and Template user test

## Current status

**PASS (2026-10-29):** An independent product owner completed all ten steps in Chrome on Windows against the disposable loopback harness using only visible controls and synthetic identities. The stale second tab displayed **Project state changed in another tab. This view was refreshed.**, and no unresolved acceptance defect remains.

Use a supported browser, a supplied Plenum test URL, and approved synthetic accounts for Designer, Admin, Reviewer, and Operator roles. Do not open developer tools, paste a UUID, or run SQL. Use a clean disposable environment; do not test against production.

## Start the loopback user-test environment

From the repository root in PowerShell, create a disposable PostgreSQL database:

```powershell
docker run --detach --name plenum-ps710-user-test-db --publish 127.0.0.1:55433:5432 --env POSTGRES_PASSWORD=plenum_test --env POSTGRES_DB=plenum_ps710_user_test postgres:18.6-alpine
$env:DATABASE_URL='postgresql://postgres:plenum_test@127.0.0.1:55433/plenum_ps710_user_test'
npm run user-test:ps710
```

Wait for `PS-710 local user-test listening on http://127.0.0.1:4173`, then open that URL in Chrome or Edge. Choose **Sign in** to open the loopback-only synthetic persona chooser. It requires no password, developer tools, UUID, or authorization header.

Use these visible choices:

- **Designer** for steps 1-6.
- **Admin** for step 7.
- **Reviewer** for step 8; this fixture is assigned to the seeded `PS-150 S1 proof` Project.
- **Operator only** for step 9.

Sign out between personas, then choose **Sign in** again. You may also open `http://127.0.0.1:4173/__test__/personas` while signed in. For step 10, open the same active Project in two tabs before archiving it in the first tab.

When finished, press Ctrl+C in the server terminal and remove the disposable database:

```powershell
docker rm --force plenum-ps710-user-test-db
```

The database contains synthetic test data only and is intentionally discarded. Create a fresh container for a repeat run because the seed command expects an empty database.

## Ten-minute script

1. Sign in as the Designer. Confirm the current Organization, Designer role, Project search, blank-Project form, recent Projects, and Simulation Templates are visible.
2. Create a uniquely named blank Project using **Create and open Draft**. Confirm Studio opens without requesting an internal identifier, then use **Return to Plenum home**.
3. Find the new Project by name, open its Draft, return home, choose **Archive**, read the confirmation, confirm it, and verify it disappears from Active Projects.
4. Filter to Archived Projects, reopen the Project, return to Active Projects, and confirm **Open Draft** is available again. Confirm published Release counts did not change.
5. Choose **Use Template** on a Simulation Template. Confirm the Template is selected and **Copy optional Scenario content** is unchecked by default.
6. Create and open the Template-based Project without selecting Scenario content. In Studio, confirm Core Design content is present and the Scenario remains blank/default.
7. Sign in as the Admin. Confirm Organization members and their Organization Roles are visible, while no other Organization name or Project is disclosed.
8. Sign in as the Reviewer. Confirm Project status and review work are readable, while create, archive, and reopen actions are absent.
9. Sign in as the Operator-only account. Confirm Project access is denied explicitly and no Project title, identifier, Template, or member list is shown.
10. Exercise recovery using these visible controls:
    1. In Active Projects, search for a name that does not exist and choose **Apply**. Confirm **No Projects match this view** appears, then clear the search.
    2. Leave **Project name** empty and choose **Create and open Draft**. Confirm the browser keeps you on the form and identifies the required Project name; no Project is created.
    3. In two browser tabs, open Plenum home as the Designer with the same active Project visible in both tabs. In the first tab, archive and confirm that Project. Without refreshing the second tab, archive the same Project there. Confirm the stale tab refreshes and the Project is not duplicated or lost.
    4. Set both tabs to Archived and choose **Apply** so the same Project is visible in both. Reopen it in the first tab. Without refreshing the second tab, reopen it there too. Confirm the stale tab refreshes, the Project is present exactly once under Active, and its published Release count has not changed.

Record PASS/FAIL for every step, browser/OS, viewport, environment, account type, date, tester, and defect reference. A failure in authorization, Template Scenario defaulting, Project recovery, or identifier-free navigation blocks PS-710 acceptance.

## Execution record

Date: 2026-10-29. Environment: loopback user-test harness with disposable PostgreSQL 18.6 and synthetic data. Tester: product owner. Browser/OS: Chrome on Windows. Viewport: desktop; exact dimensions were not recorded. Account types: Designer, Admin, Reviewer, and Operator only.

| Step | Result | Evidence / defect |
|---|---|---|
| 1 | PASS | Designer saw `PS-150 synthetic organization`, Designer role, Project search, blank-Project creation, recent Projects, and Simulation Templates. A missing search returned **No Projects match this view**. |
| 2 | PASS | A blank Project opened directly in Studio without an identifier prompt. Studio showed all 18 workspaces, `0 unsynchronized changes`, and Generation 1; the incomplete Draft correctly reported **Save state: validation required**. |
| 3 | PASS | The Draft reopened through visible controls. Archive confirmation explained immutable published Releases, and confirmation removed the Project from Active. |
| 4 | PASS | The archived Project appeared under the Archived filter, reopened once under Active, retained **Open Draft**, and kept the same published Release count. |
| 5 | PASS | **Fractured Order Core Design** was selected from the Organization Template library; **Copy optional Scenario content** was unchecked by default. |
| 6 | PASS | The Template-based Project opened with Core Design content present and the Scenario blank/default. |
| 7 | PASS | Admin saw the synthetic Organization members and their roles. No other Organization or Project was disclosed. |
| 8 | PASS | Reviewer could read assigned Project status and review work; create, archive, and reopen actions were absent. |
| 9 | PASS | Operator-only access was explicitly denied without disclosing a Project title, identifier, Template, or member list. |
| 10 | PASS | Missing search and empty required-name states were actionable. Across two tabs, stale archive and reopen attempts reconciled without duplication or loss; Tab B visibly announced **Project state changed in another tab. This view was refreshed.** The Project appeared exactly once under Active and its published Release count was unchanged. |

Two harness defects found during the run were fixed and retested: sign-out now reaches the authentication screen without a JSON error or revoking the reusable synthetic fixture session, and stale-tab conflict recovery now focuses its live status so the refresh announcement is visible and announced. Neither remains open.

Automated supporting evidence: `PS-710-T01` and `PS-710-T02` in `tests/e2e/product/product-shell.spec.mjs`, database authorization and lifecycle coverage in `apps/server/test/identity.integration.test.mjs`, and screenshots under `output/playwright/ps-710/`.

This record grants PS-710 change-level human acceptance and makes PS-720 eligible. It does not grant production approval.
