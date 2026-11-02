# PS-750 advanced-authoring user test

Status: **PASS — completed by the product owner on 2026-11-01**  
Change-level acceptance: **GRANTED**  
Production approval: **NOT RUN**

This ten-minute test proves the browser-only Designer workflow for world state, adjudication, Plugins, model composition, Polls, and Voice. It uses synthetic local data and requires no developer tools, copied identifiers, or authorization headers.

## Start the local harness

From `C:\Users\ssnguna\Local Sites\Plenum` in PowerShell:

```powershell
docker run --detach --name plenum-ps750-user-test-db --publish 127.0.0.1:55442:5432 --env POSTGRES_PASSWORD=plenum_test --env POSTGRES_DB=plenum_ps750_user_test postgres:18.6-alpine
$env:DATABASE_URL='postgresql://postgres:plenum_test@127.0.0.1:55442/plenum_ps750_user_test'
npm run user-test:ps750
```

If Docker reports that the named container already exists, start it instead:

```powershell
docker start plenum-ps750-user-test-db
```

Wait for `http://127.0.0.1:4173/`, then leave that PowerShell window running. Complete the test in the browser.

## Ten-minute script

1. Open `http://127.0.0.1:4173/`, sign in as **Designer Create**, open the visible synthetic Project, and choose **Open draft**. Confirm Studio shows **Advanced logic & world state**, **Adjudication Models**, **Plugin catalog & bindings**, **Model Compositions**, **Polls**, and **Voice Channels**. No identifier must be copied or pasted.

2. Under **Advanced logic & world state**, add a State Value. Confirm visual controls exist for name, description, type, scope, minimum/maximum, unit, Scenario initial value, Information Policy, editable roles, history, and display. Add a Resource and confirm ownership, unit, initial balance, policy, and replenishment are editable. Add a Capability and confirm lifecycle, owner, initial status, counted/boolean behavior, recovery, activation Gate, degradation Effects, and Resource costs are visible.

3. Confirm the **Effect source map** distinguishes Inject Effects, Capability degradation Effects, and Adjudication output Effects. Enable one Stage completion Gate or conditional transition and confirm it uses a constrained State Value selector, comparison, and value—not authored code.

4. Add an **Adjudication Model**. Confirm doctrine, mechanism, decision-bearing Artifact Types, reviewers, lead reviewers, perspectives, rubric/rules, Plugin or composition support, timeout, approvers, outputs, follow-on Injects, proposed state Effects, publication scope, and precedent are visually authorable. Add a constrained rule and confirm its plain-language explanation. Choose **Run synthetic preview** and confirm the trace separately labels **Suggestion**, **Review**, **Approval**, and **Committed effect**, and reports `Authoritative state changes: 0`.

5. In **Plugin catalog & bindings**, bind an installed Plugin. Open its binding and confirm pinned version/digest, non-secret configuration, time limit, enabled profiles, policy-filtered input mappings, typed ports, and a deployment compatibility table. For an unavailable profile, confirm the table gives a fail-closed reason rather than silently enabling the Plugin.

6. Add a **Model Composition**. Confirm only typed nodes and compatible connections are offered, script nodes and cycles are unavailable, and consequential Effect Proposal paths require an approval gate. Run the synthetic fixture when the graph is complete and confirm it reports `State changes: 0`.

7. Add a **Poll**. Confirm question/options, type, scope, electorate and result policies, ballot visibility, revote behavior, tally/version, threshold, denominator, abstention treatment, quorum, weights, vetoes, tie rule, triggers, schedule offsets, grace, certifier, workflow, and retention are visible. Confirm **Publication readiness** says the counting and certification rules are explicit. Select **secret ballot** temporarily and confirm publication is blocked by the resolved `OPEN-028` version-1 restriction; return it to **open**.

8. In **Voice Channels**, switch the target deployment profile between cloud, institutional, and air-gapped. Open a channel and confirm mode, capacity, listen/transmit/moderate permissions, radio controls where applicable, recording/transcription policy, adapter capability, and the non-audio path are visible. Temporarily enable recording or transcription and confirm publication is blocked by the resolved `OPEN-027` version-1 restriction; return both to **off**.

9. Wait for **0 unsynchronized changes**, refresh the page, and confirm the new authoring items remain. Sign out and sign in as **Reviewer**. Confirm protected edit actions are absent or access is explicitly unavailable and no protected Project data leaks.

10. Sign back in as **Designer Create**. Open `http://127.0.0.1:4173/__test__/offline`, confirm the recoverable offline screen shows no protected workspace data, then open `http://127.0.0.1:4173/__test__/online`. Reopen the draft and confirm the existing authoring data is unchanged and no preview created authoritative Session state.

## Record the result

For each step, record **PASS** or the exact visible failure. A failed or skipped step keeps PS-750 change-level acceptance blocked. Automated supporting evidence is `PS-750-T01`, `PS-750-T02`, `EXT-12`, `VOTE-15`, and `VOICE-09`; browser evidence is written under `output/playwright/ps-750/`.

## Product-owner result — 2026-11-01

| Step | Result | Observed evidence |
|---|---|---|
| 1 | PASS | All six advanced workspaces were visible through ordinary Studio navigation without copied identifiers. |
| 2 | PASS | State Value, Resource and Capability controls were visible and editable, including initial values, policies, lifecycle, Gates, degradation Effects and Resource costs. |
| 3 | PASS | The Effect source map distinguished Inject, Capability and Adjudication sources; conditional logic used constrained selectors rather than authored code. |
| 4 | PASS | The complete Adjudication Model surface was visually authorable; the synthetic trace separated Suggestion, Review, Approval and Committed effect and reported zero authoritative state changes. |
| 5 | PASS | The binding inspector showed pinned provenance, non-secret configuration, limits, profiles, policy-filtered mappings, typed ports and explicit fail-closed compatibility reasons. |
| 6 | PASS | Model Composition offered typed/cycle-safe connections and approval gates; the completed fixture reported `State changes: 0`. |
| 7 | PASS | Poll rules and certification were explicit; secret-ballot publication was visibly blocked under resolved `OPEN-028`. The product owner confirmed the Poll was restored to **open** and synchronized. |
| 8 | PASS | Voice mode, permissions, adapter capability, radio controls and non-audio access were visible; recording/transcription publication was visibly blocked under resolved `OPEN-027`. The product owner confirmed recording and transcription were restored to **off** and synchronized. |
| 9 | PASS | Authored data survived synchronization and refresh; Reviewer edit controls were absent or access was explicitly unavailable without protected-data leakage. |
| 10 | PASS | Offline mode withheld protected workspace data, online recovery preserved the Draft, and previews created no authoritative Session state. |

The product owner supplied written results and screenshots for the authoring, preview, zero-state-change, fail-closed Poll/Voice and persistence checks, then explicitly confirmed restoration of the Poll and Voice production-safe settings. This grants PS-750 change-level acceptance only. Production approval remains **NOT RUN**.
