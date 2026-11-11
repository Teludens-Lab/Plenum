# BA-03 — Enforce browser Origin and CSRF boundaries

## Outcome

- High-risk, pre-production remediation of audit finding 10 (S2, conditional exposure). Shared HTTP mutation and Studio WebSocket gates now validate the exact configured public origin before protected work. Strict JSON media types close the analogous text/plain mutation path. No schema, dependency, identity model, cookie-policy or topology change.
- Local BA-03 T01–T03 evidence is recorded below. External deployment proof, real IdP interoperability and new human acceptance are **NOT RUN**; final PS-850 release approval is **not granted**.
- Starting tree: clean `45960d872281dd07de7c91e904a6b0c826562ffa`, including BA-01/02. Candidate implementation and root lockfile hashes: [candidate.json](../../test-results/ba-03/candidate.json). This identifies uncommitted source, not a deployed image. The [original audit](../release-evidence/2026-11-10-build-audit.md) is unchanged.
- Governing sources: BA-03, PS-300/810/815, REQ-043/051/052, INV-001/002; Roadmap §16, PRD requirement rows, Data Security browser/CSRF controls, API/Event Contracts, Decision Register and Glossary. Existing CRDT versions, authorization and save-state semantics are unchanged.

## Acceptance and evidence

| ID | Result | Boundary actually tested |
|---|---|---|
| BA-03-T01 | PASS | Real gateway and database: approved authenticated Origin receives sync; sibling/null/malformed/missing cookie Origins receive 403 before authentication or Draft reads, with no WebSocket messages. Actual Chromium through the production service receives sync at `https://app.plenum.test:<port>`, sends the application cookie from `https://sibling.plenum.test:<port>`, and receives a rejected handshake without a sync. [Browser rerun](../../test-results/ba-03/browser-final.json), [log](../../test-results/ba-03/browser-final.log), integration evidence below. |
| BA-03-T02 | PASS | Exact-match unit cases cover scheme/port/path/suffix/userinfo/multiple-origin spoofing and fail-closed missing configuration. Real gateway tests cover absent/null/malformed Origin, unauthenticated clients, cross-Organization denial, cookie-free Bearer clients, logout/revoked reconnect and a previously connected client's denied update. Two Designers sync, receive updates, deduplicate the same update ID, and reconnect to equal Draft content. |
| BA-03-T03 | PASS | Cookie-authenticated hostile/missing/null Origins cannot create Projects or log out. Same-origin text/plain/form/multipart/SCIM-media Project bodies are denied; valid JSON and cookie-free Bearer mutations succeed. Real SCIM writes accept JSON and SCIM JSON with explicit credential and verified-domain checks. Bodyless logout requires approved Origin and revokes the session; denied requests leave state unchanged. Chromium verifies sibling-cookie delivery with HTTP 403, unchanged Project count and unrevoked Authentication Session; same-origin text/plain returns 422 and JSON returns 201. BA-01 production login/callback and same-origin logout pass in the full product run. |

The browser fixture is a real Chromium cookie-delivery test, not a header-only exploit claim: the HTTPS proxy forwards the browser's original Origin/Cookie, records only a boolean that the expected synthetic cookie arrived, and checks the production service's status. Cookies are seeded into the browser against real synthetic Authentication Sessions; this does not claim a real IdP login in BA-03. BA-01's separate synthetic OIDC browser scenario still covers login. The sibling and application hosts share `plenum.test`, use HTTPS and the same port, and resolve only to loopback. The cookie is host-only, Secure, HttpOnly and SameSite=Lax. Temporary certificates/keys are deleted and credential-bearing traces are disabled.

The initial browser attempt failed because response isolation made a hostile no-cors fetch unreadable. The corrected test tolerates that unreadability but **requires** ingress observations showing cookie delivery and 403 plus unchanged database state; a fetch failure alone cannot pass. This demonstrates conditional same-site exposure, not universal unrelated-site cookie delivery or exploitation of a deployed installation.

## Route inventory and compatibility exceptions

The review enumerated **102 OpenAPI mutation operations** in [mutation-routes.json](../../test-results/ba-03/mutation-routes.json) and reviewed actual handler method branches/body readers in [handler-route-review.txt](../../test-results/ba-03/handler-route-review.txt). The latter includes implemented IdP-management, Template and notification branches beyond the catalog. The [PS-810 runbook](../operations/PS-810-OBSERVABILITY-SECURITY.md#browser-origin-and-csrf-boundary--ba-03) groups every reviewed family and records the lasting policy. The common guard applies before dispatch to all non-GET/HEAD/OPTIONS `/v1/` and `/scim/v2/` requests; it does not rely on the catalog being exhaustive.

| Flow | Policy / compatibility |
|---|---|
| Cookie-authenticated HTTP mutations and Studio WebSockets | Exact configured Origin required, including bodyless actions and Cookie+Authorization combinations. Missing/null/malformed/unapproved values are denied. Host/forwarded headers cannot choose approval. |
| Cookie-free native/API/WebSocket clients | May omit Origin; existing explicit authentication, project/Organization/Session access and per-operation checks still apply. A supplied hostile Origin is rejected even with a Bearer token. |
| SCIM | Cookie-free Bearer credential; JSON or `application/scim+json`; normal provisioning semantics and authorization. |
| Invitation delivery/Postmark | Cookie-free Bearer delivery/event tokens or Postmark Basic credential; JSON; existing notification-host routing and credential checks. No general browser exemption. |
| Capability invitation acceptance | Existing single-use, expiry-checked URL token plus JSON; cookie-free callers may omit Origin. Cookies require approved Origin. |
| Release/Plugin/archive imports | Same Origin policy. Existing vendor JSON or JSON/gzip readers and size/decompression bounds remain; no text/plain fallback. |
| OIDC login/callback | Existing GET protocol exception. BA-01 state, nonce, PKCE, initiating browser transaction cookie, one-time consumption and safe return validation remain. POST/form-post is not enabled. |
| Read-only GET/HEAD and OPTIONS | Existing route/authentication/authorization handling; no new CORS permissions. Production health/metrics and test-only persona/shutdown endpoints are outside the cookie mutation API. |

Exact configuration is `new URL(PLENUM_PUBLIC_BASE_URL).origin`, supplied to both production constructors. AWS/OCI derive it from `https://${application_hostname}`; Compose requires the explicit HTTPS value. Runtime and Studio share it; identity/media/notification hosts are not added. The local E2E server uses exactly `http://127.0.0.1:<PLENUM_E2E_PORT>`. This task did not inspect or change production secrets, so it does not assert the current deployed value. Missing configuration denies browser requests. Cookie automation that formerly omitted Origin must now send it, or use a supported explicit credential without Cookies; BA-01's APIRequestContext logout was updated accordingly.

## Verification

All commands ran from `C:\Users\ssnguna\Local Sites\Plenum`, Windows, Node **v24.22.1**, root lockfile. Linked JSON records command, environment, runtime, duration, exit and status; adjacent logs retain output. Failed attempts remain FAIL.

| Command / scope | Result | Evidence |
|---|---|---|
| CMD-PLATFORM-TYPECHECK — `npm run typecheck` | PASS / 0; 16.40 s | [typecheck.json](../../test-results/ba-03/typecheck.json) |
| CMD-PLATFORM-TEST — `npm test` | PASS / 0; 164/164; 12.67 s | [unit.json](../../test-results/ba-03/unit.json) |
| CMD-PLATFORM-INTEGRATION — `npm run test:integration`, attempt 1 | FAIL / 1; 176.98 s | [integration.json](../../test-results/ba-03/integration.json); SCIM fixture lacked verified domain, Project fixture preceded an exact-count assertion, and disposable S3 failed startup. |
| Same gate, attempt 2 | FAIL / 1; 43/44; 147.10 s | [integration-final.json](../../test-results/ba-03/integration-final.json); all DB/gateway/HTTP tests passed, S3 startup still failed. |
| Same gate, HTTP-ready S3 and fresh database | FAIL / 1; 43/44; 162.63 s | [integration-verified.json](../../test-results/ba-03/integration-verified.json); all DB/gateway/HTTP tests passed, but S3 writes exhausted the fixture's default volume allocation. HTTP readiness alone was insufficient. |
| CMD-PLATFORM-S3 — `npm run test:s3`, corrected bounded fixture | PASS / 0; 1/1; 8.70 s | [s3.json](../../test-results/ba-03/s3.json); immutable put/get/conditional cleanup verified before the final integration run. |
| CMD-PLATFORM-INTEGRATION — `npm run test:integration`, fresh `ba03_complete` | PASS / 0; 44/44; 119.11 s | [integration-complete.json](../../test-results/ba-03/integration-complete.json), [log](../../test-results/ba-03/integration-complete.log); BA-01/02/03, tenant isolation, collaboration, voting, receipts, reporting and S3. |
| CMD-PRODUCT-E2E — `npm run test:e2e:product` | FAIL / 1; 38/39; 766.44 s | [product.json](../../test-results/ba-03/product.json); only the new test's unreadable hostile response handling failed. BA-01 and all 37 existing product tests passed. |
| Same harness, `-- --grep BA-03 --output output/playwright/ba-03-final` | PASS / 0; 1/1; 47.28 s | [browser-final.json](../../test-results/ba-03/browser-final.json). Fresh DB; only the failed test's response-observation logic changed. Application source unchanged, so the other 38 passes remain applicable. |
| CMD-SECURITY — `npm run test:security` | PASS / 0; 8/8, zero dependency advisories; 92.86 s | [security.json](../../test-results/ba-03/security.json), [details](../../test-results/ba-03/security-details.json); strict TLS/system CA and Git Bash. |
| CMD-PLATFORM-LINT — `npm run lint` | PASS / 0; 5.99 s | [lint.json](../../test-results/ba-03/lint.json); 132 sources, 52 versioned contracts. |
| CMD-GAP-AUDIT — `npm run audit:product-completeness` | PASS / 0; 1.14 s | [completeness.json](../../test-results/ba-03/completeness.json); 240 obligations and omission guard, structural only. |
| External/deployed origin validation, real-provider interoperability, new human acceptance | NOT RUN | No deployment authorized. Existing historical acceptance remains scoped to its candidate. |

The final browser rerun changed no application code after the full product run. Later integration edits added a cross-Organization handshake assertion only. No failed complete-suite run is relabeled PASS; local regression closure combines the successful unchanged tests with the successful focused rerun. No UI was changed, so new manual layout/desktop AT acceptance is N/A. The full product run retained existing accessibility checks.

## Changed files, recovery and working tree

Implementation: `apps/server/src/security/browser-origin.ts`, `apps/server/src/studio/collaboration/gateway.ts`, `apps/server/src/http/runtime-http.ts`, `deploy/compose/profile-service.mjs`, `apps/server/contracts/openapi.yaml`.

Tests/callers: `apps/server/test/operational-security.unit.test.mjs`, `apps/server/test/identity.integration.test.mjs`, `apps/server/test/browser-origin.integration.mjs`, `tests/e2e/runtime-server.mjs`, `tests/e2e/product/browser-origin.spec.mjs`, `tests/e2e/product/oidc-login.spec.mjs`, `tests/e2e/product/playwright.config.mjs`.

Continuity: this handoff and `.gitignore` exception, `docs/operations/PS-810-OBSERVABILITY-SECURITY.md`, `docs/promptbook/PROJECT_STATE.md`, `PRODUCT_COMPLETENESS_MATRIX.md`, `product-completeness-ledger.json`. The 36 tracked generated artifacts changed by the product suite were archived under `test-results/ba-03/generated-artifacts/` and restored to their clean baseline; [path list](../../test-results/ba-03/restored-generated-paths.txt). No unrelated edits were present at preflight or intentionally overwritten.

No migration or stored-data rewrite. Drain old application instances on deployment; old instances still lack the gate. Code rollback is schema-compatible but reopens finding 10; prefer forward-fix or restricting browser access at ingress. No commit, branch publication, PR, push or deployment; the proposed branch/subject remain proposals.

Final cleanup: **PASS**. Both task-owned containers were identity-checked and removed, with no persistent mounts or unrelated resources touched; [cleanup.log](../../test-results/ba-03/cleanup.log). Candidate hashes still match all 12 implementation/contract/test files. `git diff --check` passes and tracked generated output is clean.

Disposable resources: C: preflight free space **176,191,877,120 bytes**. PostgreSQL `plenum-ba03-pg`, ID `4b6fc08f084608a753fc3f939e2148857942ff8c03d152b151dc6257ef017e2a`, loopback 55453, tmpfs; task DBs `ba03_integration`, `ba03_integration_final`, `ba03_verified`, `ba03_product`, `ba03_browser_final`, `ba03_complete`. SeaweedFS 4.48 `plenum-ba03-s3`, final ID `5121df28a25f7ec30328907f47b7fc975a744a1ca9f2787f07b46cbfd27be720`, loopback 18336, tmpfs; failed predecessors `07ac007ee91ed07ba0c63016829009f80fde261402de9f45e38c14bd49a02c61`, `efdb064a572cf95c89e20fc83d25ae9a88a4bdd1ff331938f8889e76d91efc8b`, `2bc5c8bd83d5529949206201fc2eec758db170580bc8bf0b193714975949677a`, `9dc813f9c853eb7cddfab3da0c86c72ad194278d4fb43df5230f0e904d6f04a6` were identity-verified before removal and had no mounted volumes. Fixture issues were a PowerShell-parsed IP argument, an unsupported telemetry flag, a loopback-only container bind, then insufficient default volume allocation. The final service uses a bounded 32-volume limit with 64 MiB volumes; the actual S3 write/get/delete check passed before the final integration run. This is disposable fixture configuration, not a deployment change. Cleanup evidence: `test-results/ba-03/cleanup.log`. No broad pruning or unrelated-service changes.

Automatic approval review encountered transient Bad Request/timeouts before test/setup invocations; permitted retries succeeded. An unprivileged Git artifact restore could not acquire its index lock; the scoped escalated restore succeeded. These were tool/setup failures, not evidence of an application security failure, and no approval remains outstanding.

## Risks and continuation

Exact public-origin configuration and the actual deployed proxy must be verified before promotion. Origins do not authenticate non-browser clients, and approved-origin script compromise is outside CSRF protection. The finding's same-site cookie condition is preserved accurately; no blanket CORS allowance or SameSite relaxation was introduced. No new unresolved application defect is claimed fixed outside BA-03.

PS-830 owner-reported product/desktop AT acceptance, PS-840's signed-checkpoint execution exception and PS-842 decisions retain their original scope and grant no PS-850 approval. Next: **BA-04**. Revisit when public origins, cookie policy, supported machine authentication, callback mode or mutation media types change.
