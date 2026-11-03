# Platform lifecycle — build step 4 review

Status: **IMPLEMENTED AND ISOLATED REGRESSION PASS**. This is interim clarification evidence, not the family close-out critique/audit or human acceptance gate.

## Delivered clarification

- Replaced repeated `Apply`, generic lifecycle actions and ambiguous destination labels with outcome-named controls for Project search, Project archive/reopen, Release search/import/export, Session search, Session creation, staffing and Runtime entry.
- Added adjacent purpose and consequence text to Project creation, Release Package import and Session creation without changing their server contracts or persistence behavior.
- Project archive review now names the Project, explains the catalog effect, confirms that published Releases remain unchanged and states that the Project can be reopened. Opening the review focuses the safe action; cancelling returns focus to the invoking Archive button.
- Opening Session creation focuses the Session name. Cancelling returns focus to the invoking Release-row action.
- Empty catalogs distinguish first use from filtered no-results states, preserve the current query/status and provide an explicit reset action.
- Action failures now state the failed scope, preserved input and available recovery. A partial Release/Session catalog failure retains the available catalog and exposes a targeted retry action.
- Success messages describe the durable result after authoritative refresh, including archived/reopened Projects and imported or duplicate Release Packages.
- Raw Package digests and compiler/schema provenance moved from the Release row scan path into a native `Package provenance` disclosure with a copy action. Human-readable Release and Session context remains visible.
- Publisher-only access is described as intentional role scope rather than a Session-catalog failure.

## Rendered review

### `platform-lifecycle-1440x900.png`

The primary scan now carries Release identity, immutable state, publication facts and the next valid action. Package digests no longer compete with Release names. Search actions name their catalog, and the work region retains a compact professional-tool rhythm.

### `publisher-release-catalog.png`

The Publisher view explains that Sessions are outside the active Organization Role, presents the import consequence before the file control and labels the file requirement directly. The Package input and Release search remain separate, understandable tasks.

### Project lifecycle flow

The archive review appears within the affected row, names its target and defaults focus to **Keep Project active**. The confirmed success survives the catalog refresh; stale concurrent updates remain an alert and refresh the authoritative row.

## Evidence

- `npm run build`: PASS with the existing `532.95 kB` browser chunk warning.
- Fresh isolated database: `npx playwright test --config tests/e2e/product/playwright.config.mjs --grep 'PS-(800|710-T0|720-T0)'`: PASS, 5/5 in 1.4 minutes.
- The focused PS-800 scenario exercises Project, Release and Session no-results/reset behavior plus a simulated Session-catalog `503` and successful targeted retry.
- PS-710 verifies archive safe-focus, authoritative stale recovery, create/template labels and durable lifecycle outcomes.
- PS-720 verifies collapsed provenance, Package import outcomes, Session-create focus placement, human-readable readiness and axe analysis.
- Existing PostgreSQL client query deprecation output remains unchanged and is outside this UI step.

## Scope intentionally deferred

- Readiness-gated destination hierarchy and disabled-reason semantics remain the next hardening step.
- Lifecycle-wide search, recent-object navigation and contextual inspector behavior remain later Platform lifecycle work.
- Full viewport/state evidence, qualified assistive-technology review, after-critique, after-audit, polish and human usability acceptance remain pending.

