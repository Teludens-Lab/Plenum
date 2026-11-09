# PS-842 interface consistency

Later owner-directed change (2026-11-09): the public landing now follows `references/plenum-landing-v12.html`. This changes the candidate recorded below. The affected landing, theme and sign-in checks were rerun under `output/playwright/landing-v12/`; the original source hashes and screenshots below remain historical PS-842 evidence. See the updated [landing brief](../design/view-families/landing.md). Human walkthrough remains pending on the current candidate.

2026-11-09 — Implementation and automated verification complete. Change-level acceptance BLOCKED on human walkthrough and retained prerequisite evidence. No release approval.

## Entry and owner delegation

The Product Owner answered **“Proceed; keep those evidence gates pending”** to proceeding with PS-842 while PS-840 human reviews and PS-830 signed-checkpoint evidence remain pending. This explicitly permits implementation; it does not mark those gates PASS. The owner answered **“I'm delegating to you”** for Checkpoint A decisions (a)–(g).

Starting commit: `c407ce5a1fc8e62f4b85cea82b3a5d70200ade10`. Initial `git status --short` was empty (Git warned that the user-level ignore file was inaccessible). Node `v24.22.1`. No staging identity or release equivalence is claimed. Prior evidence remains attached to its original candidate. No commit or deployment is authorized.

Delegated decisions, constrained by REQ-063, REQ-071, DEC-25, DEC-34 and DEC-51:

| Input | Decision | Basis / reach |
|---|---|---|
| a: vocabulary | Communications for Message Channel inboxes; Injects for Inject inboxes; Proposals for proposal threads. Preserve authored specialized form names. | Canonical concepts and Release Terminology Profile labels; new Releases only. |
| b: Administration | One Workspaces entry; Admin lands on Workforce access, Publisher on Plugin operations. One secondary sidebar: Workforce access, Identity provider, Plugin operations, Deployment posture, Data policy, filtered by existing authority. | Existing server authority; no permission changes. |
| c: role chip | Show all current Organization Roles in a stable order, with Platform Administrator when applicable; participant Runtime retains Active Role Context. | Server-projected roles; no inference from workspace or first array element. |
| d: White Cell | Link to the Operator console for Session management, staffing and reports when server-projected Operator access permits it. | One owner per control, INV-019; no embedded second shell. |
| e: theme | Follow OS preference until the user explicitly chooses light or dark; persist and synchronize that override. | Both themes remain supported; storage failure must not prevent use. |
| f: timer | Additional minutes in both surfaces, with exact conversion to integral seconds and the existing server bounds. | No Command or timing contract changes. |
| g: first run | Retain the approved chamber landing and flat Canvas; Your Sessions uses the existing restrained layout and authored Release imagery only. | Preserve 2026-11-07 owner direction; no new artwork or redesign. |

## Findings ledger

All 40 findings have bounded implementation/source evidence below. **Implementation PASS is not human acceptance or final IC closure.** Every row retains human walkthrough NOT RUN; no owner-approved N/A is invented. The owner delegated design decisions and authorized implementation with earlier evidence gates pending. Original observations remain in the attached audit and [baseline record](../../output/playwright/ps-842/baseline-2026-11-09/README.md).

Machine references: interface command r9, participant r8 (also repeated by r9), accessibility r6, product r3, visual r2, integration r6 and final static r16, as indexed below. Source-only documentation claims are identified in their row.

| Finding | Roles | Rule / acceptance | Owning path | Bounded evidence / disposition |
|---|---|---|---|---|
| IC-01 | Admin, Publisher | One Administration menu | `apps/runtime-web/src/App.tsx`, `product/LifecyclePortal.tsx`, `product/AdministrationPortal.tsx` | Implementation PASS: One Administration entry, with authority-filtered landing and destinations. Visible-workspace and Publisher fixtures. Human walkthrough NOT RUN. |
| IC-02 | Admin, Platform Administrator | One secondary-navigation pattern | `apps/runtime-web/src/product/` | Implementation PASS: Administration and Platform control plane share SecondaryNavigation; route/current-page captures. Human walkthrough NOT RUN. |
| IC-03 | Multi-role users | Workspaces on Your Sessions | `apps/runtime-web/src/App.tsx` | Implementation PASS: Workspaces remain reachable from Your Sessions; multi-role navigation checks. Human walkthrough NOT RUN. |
| IC-04 | Research Analyst | Visible reports destination | `apps/runtime-web/src/App.tsx` | Implementation PASS: Research reports destination and Research-only shell fixture; real denial in database tests. Human walkthrough NOT RUN. |
| IC-05 | All | Explicit unknown-route state | `apps/runtime-web/src/App.tsx` | Implementation PASS: Unknown root/admin routes render Page not found; denied and disconnected states remain distinct. Human walkthrough NOT RUN. |
| IC-06 | Participant | Canonical legacy-link redirect | `apps/runtime-web/src/App.tsx` | Implementation PASS: Legacy Session URLs redirect to canonical Runtime, preserving role query and hash; browser regression. Human walkthrough NOT RUN. |
| IC-07 | Multi-role users | Authority-complete role chip | `apps/runtime-web/src/App.tsx` | Implementation PASS: Shared authorityLabel includes all Organization roles and Platform authority; Runtime preserves Active Role Context. Human walkthrough NOT RUN. |
| IC-08 | All | One object-specific H1 and breadcrumb | `apps/runtime-web/src/product/`, `runtime/RuntimeFrame.tsx` | Implementation PASS: Object titles, breadcrumbs and status placement reconciled; one-H1 checks on 68 route cases. Human walkthrough NOT RUN. |
| IC-09 | Operator | Stable Staffing target/current state | `apps/runtime-web/src/App.tsx` | Implementation PASS: Staffing uses a stable console destination and current-state indication; Operator route checks. Human walkthrough NOT RUN. |
| IC-10 | Publisher | Authority-appropriate workspace title | `apps/runtime-web/src/App.tsx`, `product/LifecyclePortal.tsx` | Implementation PASS: Publisher landing says Releases; single-authority fixture and real Publisher route. Human walkthrough NOT RUN. |
| IC-11 | Operator, White Cell | Exact shared timer unit | `apps/runtime-web/src/App.tsx`, `runtime/StageControls.tsx` | Implementation PASS: Both timer controls use the shared exact minutes-to-seconds converter; valid, fractional and invalid boundary tests. Human walkthrough NOT RUN. |
| IC-12 | Operator, adjudicator | Distinct queue/review names | `apps/runtime-web/src/App.tsx`, `adjudication/AdjudicationReview.tsx` | Implementation PASS: Adjudication queue/review labels distinguish work from status; Operator and participant captures. Human walkthrough NOT RUN. |
| IC-13 | All | One status formatter | `apps/runtime-web/src/` | Implementation PASS: Shared displayStatus/statusClass used across changed surfaces; formatter and rendered enum scans. Human walkthrough NOT RUN. |
| IC-14 | White Cell | One Operator surface | `apps/runtime-web/src/runtime/SessionSettings.tsx` | Implementation PASS: White Cell links to existing authorized Operator controls; no duplicated embedded console. Participant and authorization tests. Human walkthrough NOT RUN. |
| IC-15 | All | One date/time formatter | `apps/runtime-web/src/`, `apps/studio/src/` | Implementation PASS: Shared Intl date/time formatter handles valid, missing and invalid inputs; formatting tests. Human walkthrough NOT RUN. |
| IC-16 | Studio roles | Menu/title equality | `apps/studio/src/App.tsx`, `core-design/Editor.tsx` | Implementation PASS: 27 Studio section labels equal their opened section titles; all sections in route matrix. Human walkthrough NOT RUN. |
| IC-17 | Studio roles | Documentation/name parity | `docs/design/route-inventory.md` | Implementation PASS: Route inventory uses the same 27 canonical names and six groups as Studio. Human walkthrough NOT RUN. |
| IC-18 | All participant roles | Navigation/module-title parity | `definitions/fractured-order/` | Implementation PASS: All navigation titles match across seven participant role/team scenarios. Human walkthrough NOT RUN. |
| IC-19 | All participant roles | Shared names/icons/order | `definitions/fractured-order/`, `apps/runtime-web/src/App.tsx` | Implementation PASS: Release-authored shared label/icon/order/group parity; static and participant browser checks. Human walkthrough NOT RUN. |
| IC-20 | All | Authored empty text and plurals | `apps/runtime-web/src/`, `definitions/` | Implementation PASS: Authored empty text and plural counts reconciled; formatter boundaries and rendered views. Human walkthrough NOT RUN. |
| IC-21 | All | No duplicate stacked headings | `apps/runtime-web/src/`, `apps/studio/src/` | Implementation PASS: Duplicate stacked headings removed; one-H1 and heading-order/axe checks. Human walkthrough NOT RUN. |
| IC-22 | Participant | Consistent entry wording/actions | `apps/runtime-web/src/product/ParticipantPortal.tsx` | Implementation PASS: Your Sessions seat entry uses one primary action and consistent wording; product and route checks. Human walkthrough NOT RUN. |
| IC-23 | Studio roles | Technical details disclosed on demand | `apps/studio/src/` | Implementation PASS: UUIDs, keys, digests, policy codes and MIME types moved behind explicit technical disclosures; negative-fixture-backed scanner. Human walkthrough NOT RUN. |
| IC-24 | Admin, Publisher, Platform Administrator | Authorized named selections | `apps/runtime-web/src/product/`, `apps/server/src/http/` | Implementation PASS: Named authorized selections for permissions, Plugin artifacts, policy and correction targets. Platform capabilities use named choices; custom keys remain in advanced disclosure. Real cross-Organization rejection plus serializer tests. Human walkthrough NOT RUN. |
| IC-25 | Participant, Operator | Plain labels and capacity text | `apps/runtime-web/src/` | Implementation PASS: Readable people/seat/capacity and state-change labels; participant captures and UUID-target regression. Human walkthrough NOT RUN. |
| IC-26 | All | Semantic badge map | `apps/runtime-web/src/styles.css` | Implementation PASS: Shared semantic badge map replaces raw enum styling; formatter tests and both-theme captures. Human walkthrough NOT RUN. |
| IC-27 | All | Hairline structure; no nested cards | `apps/runtime-web/src/`, `apps/studio/src/` | Implementation PASS: Flat hairline structure and shared record review; nested-card checks across rendered route matrix. Human walkthrough NOT RUN. |
| IC-28 | Operator | Decision-based structure/disclosure | `apps/runtime-web/src/App.tsx` | Implementation PASS: Operator work grouped by decisions with provenance disclosures and contextual counts; console family captures. Human walkthrough NOT RUN. |
| IC-29 | Studio roles, Operator, Admin | Bounded work; one scroll owner | `apps/studio/src/`, `apps/runtime-web/src/` | Implementation PASS: Studio mounts visited workspaces on demand and preserves unsaved visited state; one-scroll-owner scanner and focused regression. Human walkthrough NOT RUN. |
| IC-30 | All | Desktop and 200% reflow | `apps/runtime-web/src/styles.css`, `apps/studio/src/` | Implementation PASS: Desktop 1440x900, 1024x768 and 512x384 CSS viewport (200% desktop reflow equivalent), both themes; overflow checks and forced-color captures. Human walkthrough NOT RUN. |
| IC-31 | Participant, Operator | Labeled header controls | `apps/runtime-web/src/runtime/RuntimeFrame.tsx` | Implementation PASS: Visible Refresh/Injects labels, full Session title and stable wordmark; badge counts 1/100 have accessible names/descriptions and axe checks. Human walkthrough NOT RUN. |
| IC-32 | All participant roles | Stable side-menu groups | `apps/runtime-web/src/App.tsx`, `definitions/fractured-order/` | Implementation PASS: Stable Work, Communications and Session resources groups from the new Release; seven participant scenarios. Human walkthrough NOT RUN. |
| IC-33 | All participant roles | One icon per concept | `apps/runtime-web/src/App.tsx` | Implementation PASS: Shared action, RFI, timeline, message, Inject, deck and presentation icons; static parity and browser captures. Human walkthrough NOT RUN. |
| IC-34 | All | Shared interaction patterns | `apps/runtime-web/src/`, `apps/studio/src/` | Implementation PASS: Shared disclosure/navigation and record controls; keyboard route checks, dialog/product flows and accessibility suite. Human walkthrough NOT RUN. |
| IC-35 | Scribe, Facilitator, White Cell | One record review/navigation pattern | `apps/runtime-web/src/runtime/ArtifactWorkspace.tsx` | Implementation PASS: ArtifactCard remains the single record review surface with one previous/next pager; role/capability and participant tests. Human walkthrough NOT RUN. |
| IC-36 | All | Audited local layout defects | `apps/runtime-web/src/`, `apps/studio/src/` | Implementation PASS: Audited local alignment, clipping, heading and overflow defects corrected; route/visual captures inspected. Human visual judgment remains pending. Human walkthrough NOT RUN. |
| IC-37 | All | Wordmark, first-run and theme contract | `apps/runtime-web/src/runtime/RuntimeFrame.tsx`, application entry points | Implementation PASS: Approved wordmark/chamber landing retained; live OS theme until explicit persisted override tested in Runtime and Studio. Human walkthrough NOT RUN. |
| IC-38 | Validation participants | Usable Release navigation | `definitions/validation/` | Implementation PASS: Both validation interface Releases compile, publish and activate through real services; old Session pins preserved. Human walkthrough NOT RUN. |
| IC-39 | Fractured Order roles | New immutable Release publication | `definitions/fractured-order/` | Implementation PASS: New Fractured Order interface Release publishes/activates without rewriting old published Package bytes or Session pins; database proof. Human walkthrough NOT RUN. |
| IC-40 | All | Complete route/brief documentation | `docs/design/` | Implementation PASS: Route inventory, participant record, prohibited patterns and seven existing family briefs updated; Platform, invitations and landing briefs added. Human walkthrough NOT RUN. |

## Acceptance boundaries

| Test | Result and scope |
|---|---|
| PS-842-T01 | Automated PASS: authorized visible navigation, denied/unknown/offline distinctions, legacy redirect. Pure Research/Platform authority cases are presentation fixtures; database tests separately prove real authorization. |
| PS-842-T02 | Automated PASS: 27 Studio labels/titles, seven participant role/team scenarios, shared formatter and Release parity tests. |
| PS-842-T03 | Automated PASS within exercised views: primary text/displayed control values scanned with negative fixtures; named selection and real tenant-denial tests. Provenance remains available. |
| PS-842-T04 | Automated PASS within the matrix: 68 route cases, both themes, desktop/minimum/reflow viewports, keyboard Tab, reduced motion and forced colors; axe WCAG 2.2 tags at desktop in both themes. This is not an exhaustive screen reader or keyboard usability certification. |
| PS-842-T05 | NOT RUN / acceptance BLOCKED: user designated themselves developer/tester reviewer, using Chrome with screen reader capability. Exact reviewer name, browser/AT versions, observed results and hesitation record remain pending. |

Human script: [PS-842 role walkthrough](../design/user-test/PS-842-script.md). PS-840 human reviews and PS-830 signed live-checkpoint evidence remain pending under the explicit implementation exception. Automated archive/checkpoint records do not replace those signed/human gates. PS-850 remains ineligible for final approval.

## Observed validation

All commands ran from repository root on Node v24.22.1 / npm 11.19.1, Windows, using local synthetic data. Metadata records exact cwd, start, duration, exit code, database/port where applicable. Logs preserve actual output.

| Reference | Result / scope | Duration | Exact evidence |
|---|---|---|---|
| CMD-PLATFORM-LINT | PASS; Contract lint | 5.14 s | [metadata](../../test-results/interface-consistency/lint-r16.json), [output](../../test-results/interface-consistency/lint-r16.log) |
| CMD-PLATFORM-TYPECHECK | PASS; TypeScript | 15.82 s | [metadata](../../test-results/interface-consistency/typecheck-r16.json), [output](../../test-results/interface-consistency/typecheck-r16.log) |
| CMD-PLATFORM-TEST | PASS; 155 unit/contract tests | 15.52 s | [metadata](../../test-results/interface-consistency/test-r16.json), [output](../../test-results/interface-consistency/test-r16.log) |
| CMD-PLATFORM-BUILD | PASS; Application/packages build; existing large-bundle warnings | 5.40 s | [metadata](../../test-results/interface-consistency/build-r16.json), [output](../../test-results/interface-consistency/build-r16.log) |
| CMD-PRODUCT-E2E | PASS; 37 browser tests; impact assessment below | 588.13 s | [metadata](../../test-results/interface-consistency/product-r3.json), [output](../../test-results/interface-consistency/product-r3.log) |
| CMD-PLATFORM-A11Y | PASS; 11 browser tests | 332.05 s | [metadata](../../test-results/interface-consistency/a11y-r6.json), [output](../../test-results/interface-consistency/a11y-r6.log) |
| CMD-VISUAL-QA | PASS; 4 browser tests and 25 fresh captures; impact assessment below | 90.41 s | [metadata](../../test-results/interface-consistency/visual-r2.json), [output](../../test-results/interface-consistency/visual-r2.log) |
| CMD-TELUDENS-AUDIT | PASS; Static Teludens audit | 0.91 s | [metadata](../../test-results/interface-consistency/audit-teludens-ui-r16.json), [output](../../test-results/interface-consistency/audit-teludens-ui-r16.log) |
| CMD-PARTICIPANT-INTERFACES | PASS; 4 boundary tests and 7 role/team scenarios, zero axe violations; repeated within interface command | 69.77 s | [metadata](../../test-results/interface-consistency/participant-r8.json), [output](../../test-results/interface-consistency/participant-r8.log) |
| CMD-INTERFACE-CONSISTENCY | PASS; 5 static tests, 7 participant scenarios and 92 browser tests | 688.53 s | [metadata](../../test-results/interface-consistency/command-r9.json), [output](../../test-results/interface-consistency/command-r9.log) |
| CMD-GOLDEN-JOURNEY | PASS; 2 complete golden journeys and archive verification; impact assessment below | 1394.86 s | [metadata](../../test-results/interface-consistency/golden-r4.json), [output](../../test-results/interface-consistency/golden-r4.log) |
| CMD-GENERALIZATION | PASS; 1 domain test and 2 blank-authored cross-simulation journeys | 122.69 s | [metadata](../../test-results/interface-consistency/generalization-r5.json), [output](../../test-results/interface-consistency/generalization-r5.log) |
| CMD-GAP-AUDIT | PASS; 240 structural obligations; not product acceptance | 0.71 s | [metadata](../../test-results/interface-consistency/audit-product-completeness-r16.json), [output](../../test-results/interface-consistency/audit-product-completeness-r16.log) |
| Database boundary supplement | PASS; 39 tests, including all three immutable Release publications/activations and cross-Organization denial | 130.29 s | [metadata](../../test-results/interface-consistency/integration-r6.json), [output](../../test-results/interface-consistency/integration-r6.log) |

## Candidate continuity and impact assessment

The interface run produced [68 fresh route reports and 476 fresh screenshots](../../test-results/interface-consistency/interface-r9-artifacts.json), with timestamps checked against the run start and each file hashed. [Representative image inspection](../../test-results/interface-consistency/visual-inspection-final.json) records the captures inspected by Codex; this is separate from human review. Current accessibility traces and cross-simulation reports are retained under `output/playwright/ps-842/a11y-r6-traces/`, `output/playwright/ps-842/generalization-r5/` and `test-results/interface-consistency/generalization-r5-*.json`.

Starting commit remains `c407ce5a1fc8e62f4b85cea82b3a5d70200ade10`; changes are uncommitted. No deployed staging identity is claimed. Final source manifest: [363 file hashes](../../test-results/interface-consistency/candidate-source-final.json), aggregate SHA-256 `9d5c93e8217104c8e5b0b82c300b9939a83b282dcfeac13a75182a603e2e2d37`; application/Package subset `4b22ddb974f41e568660802353c3f0e239974207b8ea9035118dadf52e70b2d2`. [Built artifact manifest](../../test-results/interface-consistency/candidate-build-final.json) records the final build. [Changed file manifest](../../test-results/interface-consistency/modified-files-final.json) identifies exact delivered paths. Lockfile, schemas, configuration and new Release files are included in the source identity.

The product r3 and golden r4 journeys were rerun after the main PS-842 changes. Later changes were confined to readable generated Composition labels, hiding Resource MIME provenance, local test-persona preparation, and Platform capability-form presentation, plus tests/scanner corrections. Product r3 predates the Composition labels and Platform capability choices; golden r4 predates those same two application edits. Neither golden journey exercises those controls. Accessibility r6 exercises Composition creation/execution; current interface r9 exercises all changed Studio views and both Platform create/reconcile serializers. Visual r2 includes the Composition change and predates only the Platform form, which is outside its 25 captured family views and is covered by current interface captures. Integration r6 server paths and participant behavior are unchanged. These earlier results retain this bounded relevance; they are not represented as identical-source full acceptance.

Generalization r4 failed the source-continuity check because a Platform source edit occurred during it. R5 was rerun after source freeze and verifies unchanged Runtime source across both journeys. Earlier failed/interrupted attempts remain diagnostic in the logs and [implementation history](../../output/playwright/ps-842/implementation-history-final.md). Product/visual output collisions were eliminated by sequential execution; browser builds also ran sequentially. Scanner false positives for hidden checkbox/radio submission values were corrected without excluding displayed inputs, selected option labels or textareas. Genuine raw capability CSV and MIME labels were fixed in the UI.

## Releases, compatibility and recovery

New immutable 1.0.1 interface Releases are in `definitions/fractured-order/fractured-order-interface-release{,-source}.json` and `definitions/validation/{policy-negotiation,crisis-response}/interface-release{,-source}.json`. Integration r6 publishes and activates all three and verifies old Package bytes and other Session pins remain unchanged. The prepared human fixture has separately published Package/manifest digests and API receipts in [reviewer fixture](../../output/playwright/ps-842/reviewer-fixture.json). Golden archive outputs are retained under [golden r4](../../output/playwright/ps-842/golden-r4/), with [checkpoint metadata](../../test-results/interface-consistency/golden-r4-checkpoint.json).

No new dependency, schema migration, service, authentication/tenancy model, commit or deployment. Existing permission checks remain authoritative. API additions are optional Plugin artifact selection and authorized target/permission projections; server revalidation rejects cross-Organization selections. Custom contracted capability keys remain supported behind advanced disclosure. Rollback is a bounded code revert and continued use of prior immutable Releases; no running Session pin needs rewriting.

## Environment and retained evidence

Task-owned container `plenum-ps842-db-20261109`, ID `74211ff0558ea74c5b6a30de233ca67226bcd999877d390aaabd489a72826162`, uses `postgres:18.6-alpine`, image `sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`, loopback database port 55432. Existing stopped PS-840 container/data were preserved. Fresh isolated databases were recorded before creation; old failed-run databases were not reset. [Final environment inventory](../../test-results/interface-consistency/environment-final.json) records retained databases/processes and disk space. The visual harness created and removed its own previously absent fixed container; no broad pruning was used.

The baseline review server and synthetic database remain available at [local sign-in](http://127.0.0.1:4191/__test__/personas). Ten participant identities passed ordinary cookie sign-in checks ([fixture check](../../test-results/interface-consistency/reviewer-fixture-check.json)); that is preparation, not human acceptance. The local Research and Platform accounts also hold other Organization roles; pure-authority human rows remain unprepared and must not be marked PASS from these accounts. Synthetic media does not prove live microphone/provider interoperability.

Current generated evidence is preserved under `output/playwright/ps-842/`. Historical tracked output paths changed by legacy harnesses were copied into the PS-842 evidence area and restored byte-for-byte from the starting commit; [preservation manifest](../../test-results/interface-consistency/historical-output-preservation.json) records both identities. No unknown ignored historical artifact is claimed restored.

## Review and remaining obligations

Scope, architecture, topology and changeability: PASS for this bounded UI slice; existing deployables and ownership retained. Backend/data/security: PASS for exercised boundaries, negative tenant tests and immutable publication; no migration. Frontend/tests: automated PASS within the declared matrix. Quality assurance: NEEDS WORK until the human Chrome/screen reader walkthrough and retained prerequisite gates are complete. Operations: local build/recovery documented; production deployment/recovery approval NOT RUN. Performance: lazy workspace mounting addresses the observed cost; no new load/SLO claim. Simplicity: no new dependencies or infrastructure.

Known limit: named policy/correction selectors list at most 200 items per kind; add paginated search before larger catalogs require targeting. Automated axe and CSS reflow checks do not establish actual desktop AT usability. Mobile/touch remains approved N/A.

Next safe step: perform the prepared role walkthrough in Chrome with the selected screen reader, record exact environment and IC observations, resolve any failures, and complete the retained PS-830/PS-840 evidence gates. No additional implementation permission is required for this already-authorized slice.
