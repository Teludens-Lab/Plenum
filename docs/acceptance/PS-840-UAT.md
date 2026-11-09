# PS-840 cross-simulation UAT

Execution authorized 2026-11-09. Both new blank-authored UI journeys and the final product/visual regressions pass automated verification. Human product acceptance and final release approval remain pending.

The Product Owner authorized deferring **both live golden Session signed-checkpoint checks** as a **PS-830 prerequisite exception for PS-840 execution only**. Each remains **NOT RUN / pending**, and each blocks **PS-850 final release approval**. Neither is PASS. Existing PS-815/820 external and human obligations, PS-842 interface consistency, PS-845 authority transfer, and PS-850 final candidate approval retain their actual status.

The owner's prior product review ("I reviewed it and it works fine") and desktop AT confirmation are recorded in PS-830 human acceptance. They are not silently extended to subsequently changed controls, new cross-simulation task observations, or the required second target-user review.

## Acceptance scope

The two designs are authored from blank Projects through public UI controls. Bootstrap creates only disposable database schema and synthetic identities; it asserts zero Projects, Drafts, Templates, Releases, Sessions and participants. No fixture Package supplies either design. Publication uses separate synthetic Publisher and Reviewer personas, not human review.

| Design | Functional assumptions | Limits |
|---|---|---|
| Transit policy negotiation | Two individually staffed Delegates exchange a proposal and counterproposal through a governed Message Channel, then submit and review textual proposals. Numeric state, resources, adjudication and Injects are disabled. | A workflow exercise; no transport-policy validity or negotiated-outcome quality claim. |
| Flood response | Two Responders, two Stages, a Rescue vehicles resource, numeric Flood severity, a conditional Inject, and a structured response Form with text, number and yes/no fields. | The fixed synthetic threshold and initial resource balance are test data, not a validated flood model. |

Both exercises must demonstrate persisted authoring, concept dependency denial and recovery, separate Reviewer publication, named staffing, authorized Runtime actions, duplicate-receipt recovery, outsider projection denial, constrained desktop reflow, keyboard interaction, axe checks, and lifecycle completion. Crisis response must show each recipient completing their own acknowledgement and response before global closure. Runtime source hashes are attached before and after each design to detect simulation-specific changes between runs.

## Defects discovered by blank authoring

| ID | Severity | Reproduction and correction | Verification state |
|---|---|---|---|
| PS-840-D01 | S2 | A newly authored blank design failed publication because its initializer omitted required `reports`. Initialize the empty collection. | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |
| PS-840-D02 | S2 | Scenario content required typing an Information Policy ID. Use the existing named selector and preserve the stored reference. | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |
| PS-840-D03 | S2 | New modules defaulted to read-only with no authoring control to allow actions. Expose the existing interaction setting. Server permissions still decide authorization. | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |
| PS-840-D04 | S2 | Conditional Injects exposed a variable but no comparison/value control. Add typed comparison controls using existing Gate semantics, preserving other conditions. | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |
| PS-840-D05 | S2 | Authored UUID-based roles appeared as "Role 1" in Operator staffing. Include eligible role names from the governing Release in authorized readiness and use them in assignment/reassignment/summary. | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |
| PS-840-D06 | S2 | Studio prevented Communication Routes with one role and exposed no message-module channel/send-route controls. Allow participants sharing a role to communicate under the existing policy; expose named channel and single-route selection. Existing multi-recipient configurations are preserved. | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |
| PS-840-D07 | S2 | New Communication Routes stored an empty Stage allowlist, disabling delivery despite no selected restriction. New unrestricted routes omit the optional allowlist; deselecting the last Stage removes it. Existing explicit empty lists remain denied until the Designer chooses “Allow all Stages.” | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |
| PS-840-D08 | S2 | Conditional Inject evaluation silently skipped authorized Operator Stage commands because it required a Participant Seat. Accept the existing Principal context and use the same world-state authority distinction as Stage Gate evaluation. Participant visibility and recipient authorization remain enforced; no participant role is invented. | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |
| PS-840-D09 | S2 | With Teams disabled, a creator could save a record but could not submit it: Team ownership checks treated an absent Team differently from a null owner. Reuse one ownership predicate for action projection, commands and file edits; allow only the teamless creator or existing Control authority. | AUTOMATED_PASS; final 2/2 UI journeys and targeted checks below. |

Diagnostics are retained in `test-results/uat/generalization-*.log`. Early failures also include missing browser installation, test omissions (required approval notes and access policy), and an asset 404 caused by concurrent build commands. The first full product run passed 36 tests and failed Plugin verification because another suite regenerated the shared signed fixture after this database stored its key. These are harness/setup failures, not passing product evidence. Builds must not replace shared web output while browsers run, and fixture-producing suites must run sequentially.

Final defect verification: **D01–D09 AUTOMATED_PASS** in `generalization-final.json`: PS-430 fixture 1/1 and PS-840 UI 2/2, exit 0, 150459 ms. The final journeys cover both saved records completing their configured workflow, peer Command denial, original-receipt replay, bidirectional policy messages, true conditional delivery, independent acknowledgement/response, final recipient closure, and pause/resume/complete/lock. The last diagnostic failure was a test synchronization error: selecting a lifecycle action before the accepted Command's projection refresh completed. The test now waits for the controls to become available. These fixes have no simulation-name-specific branches. No known S0–S2 defect discovered in these journeys remains open; human usability acceptance is still pending.

## Human task script (15–20 minutes)

Use the local synthetic environment only. Record reviewer name, role, date, candidate hash, OS/browser/AT versions, observed hesitation, failure, recovery and result for each task. Do not infer execution from an empty checklist.

1. Designer: create a blank policy negotiation Project. Add named Delegate role and two required Seats, one Stage, an Information Policy, review Workflow, proposal Form, writable Interface and access policy.
2. Disable the unused numerical/adjudication concepts. Disable Form while it is referenced; confirm the dependency explanation and blocked publication. Re-enable it using the keyboard; reload and verify retained content.
3. Publisher and a different Reviewer: freeze, review and publish. Operator: create a Session and staff both Seats by participant and authored role names. Confirm readiness and start.
4. Participants: each save, submit and review a proposal. Refresh and verify the accepted state persists. Operator: pause, resume and complete the exercise.
5. Designer: create a blank crisis response Project with a numeric State Value, Resource, conditional Inject, and text/number/yes-no response Form. Configure the policy and comparison by names and values.
6. Repeat publication and staffing. First recipient acknowledges and submits a completed response; verify the other recipient still has work to do. Finish the second recipient; verify global closure.
7. Use the changed controls at 1024 × 768 and equivalent 200% zoom, keyboard only, reduced motion and forced colors. Record any clipped controls, obscured focus or confusing labels. Qualified desktop AT review must identify the actual tools/platforms used.
8. A second target-user Reviewer examines the PS-830 golden evidence and reports any capability defect back to its owning checkpoint. Signed live-golden checks remain explicitly deferred, not implicitly accepted.

**Current human results:** new PS-840 observed task-based UAT **NOT RUN**; second target-user review of PS-830 evidence **NOT RUN**. Automated synthetic personas do not close these requirements.

On 2026-11-09 the owner explicitly answered **“Keep new human reviews pending.”** Continue automated implementation/validation; this records no waiver or PASS for either new human requirement. Earlier PS-830 owner-reported product and desktop AT acceptance remains unchanged.

## Evidence and candidate

Base commit: `682c43bfbf984405775003c1f48bd55b4372899b`, with local task changes. Node `v24.22.1`, npm `11.19.1`, Playwright `1.64.1`, Chromium build `1248`, disposable PostgreSQL `18.6-alpine`. No commit, deployment, or production migration is authorized or claimed.

Command records under `test-results/uat/` contain command, cwd, versions, UTC start, duration, exit code and log path. The command index, source manifest, Release/Session identity, obligation review and recommendation are recorded below and in evidence-index.json. Historical PASS labels are not automatically evidence for this local candidate.

### Published cross-simulation identities

| Design | Project | Release | Session |
|---|---|---|---|
| Policy negotiation | `8ba21926-ac06-4c10-be76-9a4ddbff93b3` | `292b9e42-0708-48ab-96c9-a4f2ecd4eed5` | `bf0e06c5-4a51-4614-b083-076ec3494d93` |
| Crisis response | `4c6ff0d5-a0fd-499e-8aeb-74690c13345c` | `0d9d29d9-4b58-4758-aafc-51f1ad69e229` | `7e1fa53f-0715-4cd1-b3f5-27977075f1a8` |

`test-results/uat/policy-negotiation.json` and `crisis-response.json` validate against `uat-evidence-v1`, include publication content/manifest/Package digests, and explicitly say human UAT NOT RUN and domain fidelity NOT CLAIMED. Runtime continuity hash is `b4cae1b23bdb828d476ea1bd065b2d994bc2d739b648813482b82fb3b18d8551` across 109 files before/after both journeys. `blank-install.json` records zero domain objects before UI authoring and the migration checksums. Data is retained in task database `plenum_ps840_browser10` on `plenum-ps840-db-20261109`; object files are under `output/playwright/ps-840/objects/plenum_ps840_browser10`.

### Candidate impact assessment

The final local source/configuration/test manifest is `aa3cc5a1e51a417e5b8712805a34f5969c90a677cd16ee08c8d211b4a84c1b58`; the lockfile hash is `8ba8b731574d3c3a298adaf12de771f43c0fc09de312f038ae55a6732a3e2b50`. `candidate-manifest.json` lists all 339 files and 18 built browser files. After the cross-simulation run, cleanup removed an unused test-script alias and trailing blank lines from a test and `artifact-workflow.ts`; no executable statement changed. The resulting Runtime source hash is `806dc13b8c3251052e3114ceb6882601682993cf5b7f54bae10a045b93d0e870`. The browser build hash remains `bd92d4937e3bec96b674ff2cdc624a9be562efa3573ea312cf32fdb46d07d3f6`. These nonfunctional changes do not transfer or fabricate a new journey run.

The retained golden Release snapshots were read back from the disposable database: each has four Teams and zero Gate Injects (`test-results/uat/golden-impact-assessment.json`).

The successful original/Energy golden run (2/2, 1954100 ms) and platform accessibility run (11/11, 922685 ms) preceded D05–D09. Their results remain PASS for the recorded earlier source, not an assertion that the final candidate reran those entire suites. Both golden definitions use Teams and have no conditional Gate Injects; D08/D09 do not change those exercised paths. The added role-name field is optional and bounded by the existing Operator authorization; the new Studio controls preserve stored Release semantics. Final changed behavior is covered by the new 2/2 journeys (axe and constrained layout included), 155/155 unit tests and 38/38 integration tests. Full product and visual regression results are recorded separately below. PS-850 still requires exact-candidate revalidation. Neither a passing synthetic checkpoint integration test nor these archived golden Sessions satisfies either deferred live-golden signed check.

Screenshots and full traces are under `output/playwright/ps-840/`. The changed conditional controls and Runtime response Form were visually inspected at the constrained viewport; labels, focus outline and controls are present without horizontal overflow. The Runtime capture records the first recipient's completed work before its next refresh; the test separately asserts global closure in the second recipient's view. Impeccable's source scan has no reported findings but is regex-only; it does not replace rendered axe, visual inspection or desktop AT. The task does not add mobile acceptance.

### Completeness disposition and recommendation

`test-results/uat/obligation-review.json` expands all 240 machine-ledger obligations with their owner, recorded status, evidence target, exception and available requirement/test references. This is a row inventory and evidence trace review, not a fabricated blanket PASS. Many inherited rows still have PLANNED or partial evidence states; source-code mentions alone do not close them. Current automated command results and cross-simulation proof update only their specific ledger obligations. The unscoped all-obligations release audit remains NOT RUN and belongs to PS-850.

Recommend retaining these fixes and automated evidence for the next review checkpoint. **PS-840 human acceptance is pending; no final release recommendation is issued.** Remaining gates are the owner-deferred new target-user UAT and second PS-830 reviewer; both live-golden signed checkpoint checks; separately owned PS-815/820 external/institutional evidence; PS-842 interface consistency; PS-845 controlled authority transfer; and PS-850 exact-candidate revalidation and release decision. No external, operational or human requirement becomes PASS through this report. The earlier owner-reported PS-830 product/desktop AT acceptance is retained without extending it to changed controls.

No schema migration was added; existing migrations ran only in disposable test databases. No deployment, dependency upgrade or commit was performed. The task reuses the existing UI controls, Command kernel, authorization and persistence. Existing immutable Releases and historical evidence are retained. The unrelated PS-842 dark-mode wording edit observed during execution is preserved.

### Changed implementation boundaries

| Files/modules | Change |
|---|---|
| `apps/studio/src/core-design/Editor.tsx` | Named policy selection; module interaction/channel/route controls; single-role routes; explicit Stage restriction recovery; typed Inject comparison controls. |
| `apps/server/src/studio/portal.ts` | Valid empty Reports collection in blank designs. |
| `apps/server/src/runtime/access/onboarding.ts`, `apps/runtime-web/src/App.tsx`, `packages/event-contracts/src/index.ts`, `apps/server/contracts/openapi.yaml` | Optional authorized staffing role names and compatible UI fallback. |
| `apps/server/src/runtime/information-flow.ts`, `artifact-workflow.ts` | Operator conditional evaluation and one teamless-creator ownership predicate across display, Command and attachment-edit checks. |
| `apps/server/test/identity.integration.test.mjs`, `operator-control.unit.test.mjs` | Named-role authorization, conditional Gate, replay and ownership boundary regressions. |
| `tests/e2e/generalization/`, `tests/e2e/golden-journey/bootstrap.mjs`, `tests/e2e/runtime-server.mjs`, `package.json` | Reused identity-only bootstrap, two blank UI journeys, schema-validated evidence, stable Runtime hash and registered aggregate command. |
| `docs/promptbook/`, `docs/acceptance/PS-840-*`, `.gitignore` | Explicit exception, acceptance boundaries, defect/evidence handoff and compatible contract documentation. |

## Final command index

| Reference | Result / scope | Duration | Evidence |
|---|---|---|---|
| CMD-GAP-AUDIT | PASS — Structural coverage only; all 240 rows inventoried | 1.2 s | `test-results/uat/gap-audit-final.json` |
| CMD-GENERALIZATION | PASS — PS-430 1/1 and blank-authored UI 2/2 | 150.5 s | `test-results/uat/generalization-final.json` |
| CMD-GOLDEN-JOURNEY | PASS — 2/2; earlier source, see impact assessment | 1954.1 s | `test-results/uat/golden-journey.json` |
| CMD-PRODUCT-E2E | PASS — Full final product suite | 1043.8 s | `test-results/uat/product-e2e-final.json` |
| CMD-VISUAL-QA | PASS — Registered capture inventory | 110.7 s | `test-results/uat/visual-final.json` |
| CMD-PLATFORM-A11Y | PASS — 11/11; earlier source; new controls covered in generalization | 922.7 s | `test-results/uat/platform-a11y.json` |
| CMD-SECURITY | PASS — Security tests and dependency audit | 48.1 s | `test-results/uat/security-final.json` |
| CMD-TELUDENS-AUDIT | PASS — Static semantic/branding audit | 1.0 s | `test-results/uat/teludens-final.json` |
| CMD-PLATFORM-LINT | PASS — 126 sources and 52 contracts | 5.9 s | `test-results/uat/lint-final.json` |
| CMD-PLATFORM-TYPECHECK | PASS — Type checking | 18.7 s | `test-results/uat/typecheck-final-r3.json` |
| CMD-PLATFORM-TEST | PASS — 155/155 | 12.5 s | `test-results/uat/platform-unit-final.json` |
| Targeted server integration | PASS — 38/38; local database, no S3 claim | 109.1 s | `test-results/uat/integration-final-r2.json` |

All records use repository root and Node v24.22.1. Golden/accessibility source scope is explicit above. Full product: 37/37 PASS. Visual: 4/4 PASS with 25 captures. The first product fixture-race failure is retained as diagnostic evidence and superseded by the isolated passing run.

Current product captures are preserved in test-results/uat/product-final-captures; visual captures in test-results/uat/visual-final-captures; other generated tracked files in test-results/uat/final-generated-output. The exact tracked output paths listed in restored-output-paths.json were restored to their baseline after preservation. Source changes and the unrelated PS-842 edit remain untouched. Cross-simulation PNGs and traces remain under output/playwright/ps-840.

Cleanup is recorded in `test-results/uat/resource-cleanup.json`: the diagnostic server was stopped; the visual test removed its own container; the verified PS-840 PostgreSQL container is stopped with all database data retained for later review. No database, volume or unrelated resource was deleted. To resume local review, restart only `plenum-ps840-db-20261109` and use the recorded `plenum_ps840_browser10` database with the existing local journey server. `git diff --check` passes.
