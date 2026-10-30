# PS-720 ten-minute Release, Session, and administration user test

## Current status

**PASS.** The product owner completed the ten-step test and focused corrective retest on 2026-10-29 using the disposable loopback harness and synthetic identities. Step 1 initially found missing Package-digest/approval-count metadata, and step 5 found missing numeric readiness progress. The corrected build visibly passed both retests without changing the immutable Release or creating another Session.

## Start the loopback harness

From the repository root in PowerShell:

```powershell
docker run --detach --name plenum-ps720-user-test-db --publish 127.0.0.1:55435:5432 --env POSTGRES_PASSWORD=plenum_test --env POSTGRES_DB=plenum_ps720_user_test postgres:18.6-alpine
$env:DATABASE_URL='postgresql://postgres:plenum_test@127.0.0.1:55435/plenum_ps720_user_test'
npm run user-test:ps720
```

Wait for `PS-710/PS-720 local user-test listening on http://127.0.0.1:4173`, then open that address in Chrome or Edge. Choose **Sign in** and select the requested synthetic persona. The test requires no developer tools, authorization header, pasted UUID, or password.

When finished, press Ctrl+C in the server terminal and remove the disposable database:

```powershell
docker rm --force plenum-ps720-user-test-db
```

## Ten-minute script

1. Sign in as **Publisher**. Under **Simulation Releases**, find `S1 proof 1.0.0`. Confirm it is labeled immutable and shows its Project, publisher, publication time, Package digest, approval count, and Session count. Confirm **Create Session** is absent.
2. Choose **Export Package** and save the JSON file. Use **Import a verified Release Package** to select the same file, then choose **Verify and import**. Confirm Plenum reports that the immutable Package was already present; no duplicate Release appears.
3. Open the Release by its visible label. Confirm the URL is a stable `/releases/...` link, refresh the page, then use the breadcrumb or browser Back. Confirm the same Release remains selected and the catalog state is intact.
4. Sign out, sign in as **Operator only**, and find `S1 proof 1.0.0` without entering an identifier. Choose **Create Session**, enter a unique Session name and an optional scheduled start, then choose **Create configured Session** once.
5. Confirm the new Session detail opens at a stable `/sessions/...` URL with status **configured**, the selected Governing Release, readiness progress, blockers or next valid actions, and links for staffing/readiness, Runtime, reports, replay, and archive.
6. Refresh the Session detail, then use browser Back. Confirm the Session appears exactly once in the Session catalog with the same name, status, Governing Release, and schedule. Rapidly double-clicking a disabled/pending create control must not create a second Session.
7. Open **Staffing and readiness**, then **Session detail**. Open **Reports**, **Replay**, and **Archive** in turn. Confirm every destination remains scoped to the same named Session and no internal identifier must be copied or pasted. Do not confirm Archive during this navigation check.
8. Sign out and sign in as **Reviewer**. Confirm **Release and Session access unavailable** is explicit and no protected Release title, Session title, Package control, create control, member list, or identifier is displayed.
9. Sign out and sign in as **Admin**. Open Members, Plugins, Deployment, and Data policy from the visible administration navigation. Confirm each destination has a stable URL and back navigation returns to the same Organization context.
10. Exercise recovery without developer tools: open `http://127.0.0.1:4173/__test__/offline`, attempt a safe catalog refresh, and confirm a recoverable error appears without implying a Session was created. Open `http://127.0.0.1:4173/__test__/online`, retry, and confirm the existing Release digest and created Session remain unchanged.

Record PASS/FAIL for every step, browser/OS, viewport, environment, persona, date, tester, and defect reference. Authorization leakage, duplicate Session creation, mutable Release bytes/digest, a raw-identifier requirement, broken refresh/back navigation, or an early-open path blocks PS-720 acceptance.

## Execution record

Date: 2026-10-29. Tester: Product owner. Browser/OS: Chrome on Windows (established local test context). Viewport: desktop; exact pixel dimensions not supplied. Environment: disposable loopback harness with synthetic identities.

The focused retest reused the existing disposable database and `node tests/e2e/runtime-server.mjs --local-user-test`, preserving the created Session while loading the corrected build.

| Step | Result | Evidence / defect |
|---|---|---|
| 1 | PASS | Publisher Release cards show immutable state, Project/Release, publisher/time, approval count, Session count, Package digest, and Export Package; Create Session is absent. Focused screenshot confirms the correction. |
| 2 | PASS | Real JSON Package downloaded, reselected, verified as already present, and did not duplicate the Release. |
| 3 | PASS | Stable `/releases/14000000-0000-4000-8000-000000000002` detail survived navigation and exposed the unchanged digest. |
| 4 | PASS | Operator found `S1 proof 1.0.0` and created one configured `Testing` Session without entering an identifier. |
| 5 | PASS | Stable configured Session detail shows Governing Release, `Readiness 0/11; 11 blocking checks incomplete`, next actions, and all five scoped destination links. Focused screenshot confirms the correction. |
| 6 | PASS | Refresh/Back retained one Session with unchanged catalog state; no duplicate was reported. |
| 7 | PASS | Staffing, detail, reports, replay, and archive remained scoped to the named Session without pasted identifiers; Archive was not confirmed. |
| 8 | PASS | Reviewer received explicit denial and protected lifecycle data/actions were omitted. |
| 9 | PASS | Members, Plugins, Deployment, and Data policy used stable `/admin/...` URLs and returned to the same Organization context. |
| 10 | PASS | Offline state omitted protected context and offered retry; online recovery preserved the Release digest and Session. |

Automated supporting evidence is `PS-720-T01`, `PS-720-T02`, and `AC-03`; screenshots are written under `output/playwright/ps-720/`. PS-720 change-level acceptance is **PASS**. Production approval remains separate and is **NOT RUN**.
