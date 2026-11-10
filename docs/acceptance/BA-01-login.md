# BA-01 — Browser-bound login and constrained redirects

## Outcome

- Code completion: **PASS**. Local BA-01 automated acceptance: **PASS**. Real-provider proof and new candidate human approval: **NOT RUN**. Final release decision: **BLOCKED / not granted**.
- Audit findings 1 (S1) and 9 (S2) reproduced, then addressed within the existing OIDC/Authentication Session model. The [original audit](../release-evidence/2026-11-10-build-audit.md) remains unchanged.
- Mode: pre-production candidate; high-risk identity boundary. Sources: BA-01, PS-110/815/810, REQ-045/051/052, INV-001/002, Roadmap §16, Data Security §§5–9/19, ADR-012/015 and DEC-38. No new permissions, tenancy model or infrastructure dependency.
- Candidate: HEAD `4eff8d513aaa87be6d7748149093ab7362c33a4e` plus the uncommitted implementation manifest `0858f3fdd03896702f4550fc4a43dd062afd3143f0a096eaa422f544ca48a24a`. Per-file and lockfile hashes: [candidate.json](../../test-results/ba-01/candidate.json). This is source identity, not a deployed image digest.

## Acceptance and evidence

| ID | Result | Observed boundary and evidence |
|---|---|---|
| Findings 1/9 reproduction | PASS | Unchanged compiled code accepted code/state without browser binding and returned a backslash path resolving externally. Synthetic provider, populated disposable PostgreSQL. [Reproduction log](../../test-results/ba-01/reproduction.log); `node output/ba01-baseline-reproduction.mjs`, exit 0, approximately 1.43 s including command wrapper. |
| BA-01-T01 | PASS | Two isolated Chromium contexts through the actual `profile-service.mjs` and TLS proxy: B lacks A's credential, gets 401 before exchange, cannot mint a session; A then completes. Mismatched B cookie preserves B's existing Session cookie and A's pending state. Integration asserts unchanged pending row and zero exchanges on missing/malformed/mismatched bindings. [Final browser](../../test-results/ba-01/browser-final.log), [integration](../../test-results/ba-01/integration-final.log). |
| BA-01-T02 | PASS | Normal completion, independent concurrent tabs, exact expiry, duplicate and concurrent callbacks; only one exchange/session per transaction. Consumed/expired matching attempts erase nonce/verifier/binding digest. Provider failure consumes state, clears the transaction cookie, and permits a new login. Existing Session cookies survive denials; logout revokes access. Provider-test HTTP response sets the cookie and exposes only authorizationUrl; domain completion preserves the initiating Session. Same evidence plus CONTROL-PLANE-T02. |
| BA-01-T03 | PASS | Table-driven local paths/query/fragments, normalization and length boundaries; backslash, protocol-relative, control-character and normalized double-slash destinations rejected. Actual production callback preserves the allowed deep link; unsafe HTTP inputs emit no external Location. [Unit log](../../test-results/ba-01/unit.log), final browser log. |

The production browser scenario enters through the recovery login path, using the same begin/callback implementation as Organization sign-in. Organization provider discovery and governed provider testing remain covered by real-database integration; this is not Entra, Okta, Keycloak or brokered SAML interoperability proof. The synthetic issuer signs real RS256 ID tokens, checks PKCE, and serves JWKS over HTTPS. No authentication bypass is installed in production code. The test ingress uses distinct synthetic IPs per scenario so unrelated scenarios do not exhaust the production 10/min authentication limit.

## Verification

All commands ran from `C:\Users\ssnguna\Local Sites\Plenum` on Windows with Node **v24.22.1** and the root lockfile. Every linked JSON records cwd, command, runtime, duration and exit code; adjacent logs retain output. No failed run is relabeled PASS.

| Command ID / command | Result / exit | Duration | Evidence |
|---|---|---|---|
| CMD-PLATFORM-TYPECHECK — `npm run typecheck` | PASS / 0 | 12.87 s | [typecheck.json](../../test-results/ba-01/typecheck.json) |
| CMD-PLATFORM-TEST — `npm test` | PASS / 0; 161/161 | 15.07 s | [unit.json](../../test-results/ba-01/unit.json) |
| CMD-PLATFORM-LINT — `npm run lint` | PASS / 0; build + 131-source/52-contract lint | 6.28 s | [lint.json](../../test-results/ba-01/lint.json) |
| CMD-PLATFORM-INTEGRATION — `npm run test:integration` | PASS / 0; 41/41 | 229.58 s | [integration-final.json](../../test-results/ba-01/integration-final.json); Pg18.6 and SeaweedFS4.48 |
| CMD-PRODUCT-E2E — `npm run test:e2e:product` | FAIL / 1; 36/38 | 917.38 s | [product.json](../../test-results/ba-01/product.json); BA-01 hit the fixture's shared IP rate limit; PS-720 received a transient static 404 during concurrent rebuilds |
| CMD-PRODUCT-E2E targeted rerun — `npm run test:e2e:product -- --grep 'BA-01\|PS-720-T01' --output output/playwright/ba-01-final` | PASS / 0; 2/2 | 49.63 s | [browser-final.json](../../test-results/ba-01/browser-final.json); fresh database, corrected synthetic ingress, no concurrent builds, service TLS verification enabled |
| CMD-SECURITY — `npm run test:security` | PASS / 0; 8/8; zero dependency findings | 65.71 s | [security-strict.json](../../test-results/ba-01/security-strict.json); Git Bash, TLS verification and system CAs enabled |
| CMD-GAP-AUDIT — `npm run audit:product-completeness` | PASS / 0; 240 obligations and negative omission check | See JSON | [completeness.json](../../test-results/ba-01/completeness.json); structural, not release mode |
| Migration rehearsal — `node output/ba01-migration-check.mjs` | PASS / 0 | See JSON | [migration.json](../../test-results/ba-01/migration.json); populated pre-043 database, existing sessions preserved, legacy binding NULL, no unbound exchange |
| CMD-IDENTITY-PROVIDER-STAGING | NOT RUN | — | Registry remains Proposed; no authorized Entra/Okta tenant or required human evidence supplied |

Browser regression reconciliation: 36 unaffected cases passed in the full run and both failed cases passed on the fresh targeted rerun, giving passing coverage for all 38 cases. A second single-process full 38-case run was **NOT RUN**. Only test ingress isolation, explicit child-process TLS verification, additional cookie assertions and harmless test formatting changed between browser runs; application behavior did not change. This is bounded rerun evidence, not a false exit-0 claim for the original full command.

Earlier integration attempts failed only in the S3 fixture (bad listen address/unsupported startup flag/loopback binding); 39 baseline and 40 changed database tests passed respectively. Logs and metadata remain in `baseline-integration.*` and `integration.*`. Earlier security attempts recorded the sandbox advisory-access failure and Windows WSL-bash guard failure; Git Bash and verified TLS resolve them without application changes. The final scan validates source/history, configuration and dependencies; real staging DAST, CodeQL workflow execution and provider acceptance remain separate.

## Data, compatibility and recovery

- Migration **043** is additive and was applied only to task databases. It stores a nullable SHA-256 credential digest under existing Organization RLS. Old pending transactions fail closed and require a new login; existing sessions and immutable records are unchanged. No production migration, restore or data rewrite occurred.
- Each attempt gets an independent random 256-bit credential in `__Host-plenum_login_<state>`: Secure, HttpOnly, SameSite=Lax, Path=/, no Domain, five-minute TTL. Host prefix prevents sibling-domain cookie injection. GET authorization-code callback only; form_post is unsupported. Concurrent tabs retain separate pending attempts; the last successful ordinary login sets the browser's shared Session cookie.
- Cookie matching and locked single-use consumption precede provider exchange. No provider call runs inside the consumption transaction. A provider failure requires restart; no failed callback replaces the Session cookie. Abandoned cookies expire automatically; expired rows cannot authenticate.
- Cloud, institutional and air-gapped profiles share the same service. Canonical HTTPS `PLENUM_PUBLIC_BASE_URL` and exact `/auth/callback` `OIDC_REDIRECT_URI` must match. Alternate-host ingress must canonicalize before login. See [deployment contract](../operations/DEPLOYMENT.md#browser-bound-oidc-transactions-ba-01).
- Apply 043 before starting the new service and drain old instances. Keep the additive column if code is rolled back; rollback reopens the original vulnerabilities, so prefer a reviewed forward-fix or disable login at ingress. Production rollback/backup restoration was NOT RUN.
- BA-03 must retain the valid GET-callback exception and host-only cookie contract while implementing other browser Origin/CSRF checks.

## Security, working tree and changed paths

No transaction credential, code, verifier or Cookie/Set-Cookie value is written to application telemetry or evidence logs. Browser traces are disabled for the credential-bearing test; generated TLS key material lives in a unique temporary directory and is removed in finally. Existing RLS, nonce, state, PKCE, identity mapping, audit records and Authentication Session permissions remain in force. The provider-test HTTP fixture supplies a synthetic authorized Principal only for testing that existing management route; the production browser login uses real code exchange and server identity mapping.

Implementation paths: `apps/server/src/identity/login.ts`, `apps/server/src/identity/organization-providers.ts`, `apps/server/src/http/runtime-http.ts`, `apps/server/migrations/043_oidc_browser_binding.sql`, `apps/server/contracts/openapi.yaml`, `deploy/compose/profile-service.mjs`.

Regression paths: `apps/server/test/identity.unit.test.mjs`, `apps/server/test/identity.integration.test.mjs`, `tests/e2e/global-setup.mjs`, `tests/e2e/product/playwright.config.mjs`, `tests/e2e/product/oidc-login.spec.mjs`.

Continuity paths: this handoff, its narrow `.gitignore` exception, `docs/operations/DEPLOYMENT.md`, `docs/release-evidence/PS-815-internal-acceptance-audit.md`, `docs/promptbook/COMMAND_REGISTRY.md`, `PROJECT_STATE.md`, `PRODUCT_COMPLETENESS_MATRIX.md`, and `product-completeness-ledger.json`. The user's existing `.gitignore` addition remains intact.

Pre-existing user changes preserved: `.gitignore`, `docs/promptbook/PROMPTBOOK_VALIDATION_REPORT.md`, untracked `apps/studio/public/branding/Plenum_Composed_Capability.mp4`, and untracked `docs/promptbook/BUILD_AUDIT_REMEDIATION_PROMPTBOOK.md`. No initial overlap with implementation paths. The 35 tracked artifacts rewritten by the product suite were archived under `test-results/ba-01/product-artifacts/output/` and restored to their previously clean versions. No commit, PR, push or deployment.

Task infrastructure was removed after verification. Before creation, C: had 179,199,205,376 bytes free. PostgreSQL `plenum-ba01-pg` (`01ea1da1e1f2aa7518b038eb1e9d0c515dd5fefd5381aa15e7cbdd5235340620`, loopback 55451) held only `ba01_baseline`, `ba01_integration`, `ba01_product`, `ba01_final_integration`, `ba01_final_product` and harness-owned restore fixtures. S3 `plenum-ba01-s3` (final container `92c919430113bc4eea117cd85be2ba988a52af6cb1fd0401d55bddac2048c1cf`, loopback 18335) used volume `5278bc1fa3770611e79d5e51bba1b0c3268b6f1af8ae25b7b692505a3c801b9f`. Failed-attempt volumes `79097c5f2b21890ef0be588401091203bd798a7bfc7fd50e6a300bdfe85f9da9`, `5bf94c5aeb6275893f077e0107e93c91caca37b294067f45664798155e0e9989`, and `ff5a79d92a2e7d9db949576f6555709665207dd7c1d843811722b70b29584120` were matched to their recorded task container IDs through Docker mount events before removal. No broad prune, unrelated volume removal or demo deletion occurred.

## Risks and continuation

Local change evidence is complete. Real Entra/Okta/brokered SAML, configured-profile TLS/ingress interoperability, named human/security approval and exact deployed-candidate acceptance remain **NOT RUN**. No controls or visual UI were changed, so new layout/desktop AT acceptance is N/A for this patch; this does not expand the existing PS-830 owner-reported acceptance. PS-840's checkpoint exception and PS-842 decisions remain intact and grant no PS-850 approval.

The next remediation is **BA-02**; coordinate **BA-03** against this cookie contract. Revisit BA-01 on callback-mode, public-origin, cookie-policy or provider changes. Other original audit findings remain outside this patch.
