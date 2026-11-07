# PS-815 internal identity and workforce acceptance audit

Recorded: 2026-11-07  
Revision: `d8e43f54c7732f7e540101d4a195a298f5d6b454`  
Environment: Windows, Node `v24.22.1`, npm `11.19.1`, PostgreSQL `18.6-alpine`, Playwright `1.64.1` Chromium  
Decision: **INTERNAL PHASE PASS / FINAL PRODUCTION DECISION DEFERRED**

This is the first internal phase of PS-815. It covers the Platform Control Plane and Organization workforce implementation, desktop-browser workflows, accessibility proxies, security controls, and the representative workforce migration rehearsal. It does not claim external-provider or human acceptance. Plenum is a desktop platform; mobile, iOS, Android, and touch-device acceptance are not applicable.

Microsoft Entra ID, Okta, supported brokered SAML, real SCIM tenants, real invitation delivery/bounce, supported Windows/macOS desktop devices, named desktop assistive technology, authorized human testing, and named approvals were explicitly deferred for this phase. Every such gate remains `NOT RUN`; none is counted as a failure of the internal phase, and each remains required before the final production decision.

PS-810's environment-dependent Postmark, staging, and operator evidence also remains deferred under the sequencing decision that allowed PS-815 internal work to proceed. It does not invalidate this internal result; PS-810 must still be reconciled before final production approval unless the accountable owner records a different acceptance decision.

## Implementation integrity verdict

**PASS.** The implementation is a product-specific, server-authoritative system rather than generic dashboard scaffolding. Organization provisioning, Platform Administrator authority, Organization workforce, provider revision governance, reconciliation, invitation evidence, final-Administrator protection, and session revocation have clear owning modules and typed contracts. The Teludens detector returned no findings, supported desktop viewport/zoom checks pass, and the focused control-plane browser checks returned zero Axe violations.

Desktop viewport acceptance passes at the 1024 × 768 minimum and at the equivalent 200% browser-zoom CSS viewport of 512 × 384 without horizontal overflow. The lifecycle validation defect found during the audit was fixed and its focused browser regression passes.

## Audit health score

| # | Dimension | Score | Key finding |
|---|---|---:|---|
| 1 | Accessibility | 4/4 | Member-specific field-error association and focus recovery pass |
| 2 | Performance | 3/4 | Production build passes but emits three >500 kB chunk warnings |
| 3 | Theming | 4/4 | Teludens semantic tokens and theme controls pass the registered audit |
| 4 | Desktop layout and zoom | 4/4 | 1024 × 768 and equivalent 200% browser zoom reflow without overflow |
| 5 | Implementation integrity | 4/4 | Detector clean; domain ownership and authorization boundaries are coherent |
| **Total** | | **19/20** | **Internal desktop acceptance passes; final external evidence is deferred** |

Open severity count: **P0 0 / P1 0 / P2 2 / P3 0**.

## Findings

### [RESOLVED P1] Lifecycle validation error is associated with and focused to the invalid reason

- **Location:** `apps/runtime-web/src/product/AdministrationPortal.tsx:95` and `apps/runtime-web/src/product/AdministrationPortal.tsx:166`.
- **Category:** Accessibility / Interaction recovery.
- **Initial evidence:** Selecting **Suspend** with an empty Lifecycle reason sent the request, left `document.activeElement` on `BODY`, set no `aria-invalid`, and exposed the server message only through the page-level polite `role=status` region.
- **Resolution:** Invalid Suspend/Deprovision attempts now remain client-side, focus the member-specific reason field, expose `aria-invalid`, associate visible hint and alert text through `aria-describedby`, and clear the invalid state when the user corrects the value. Server validation remains authoritative.
- **Regression evidence:** Focused `PS-790-T01` Playwright run passed 1/1 and asserts no lifecycle request, correct focus, accessible description, invalid state, and recovery.
- **Standard:** WCAG 2.2 SC 3.3.1 Error Identification and SC 3.3.3 Error Suggestion; Universal Design R16/R17.

### [P2] Administration sub-navigation does not expose the current destination

- **Location:** `apps/runtime-web/src/product/AdministrationPortal.tsx:49`.
- **Category:** Accessibility / Implementation integrity.
- **Evidence:** `/admin/members` and `/admin/identity` expose `aria-current` only on the outer Administration workspace. The inner **Workforce access** and **Identity provider** links do not identify the current page, while the sibling Platform Control Plane navigation does.
- **Impact:** Users cannot confirm their current Administration destination from the local navigation, especially after scrolling through a 3,400+ px workforce view.
- **Standard:** Universal Design R11/R12/R19; project Navigation contract in `DESIGN.md`.
- **Recommendation:** Pass the active Administration destination into the navigation and apply `aria-current="page"` with the existing decision-boundary treatment.
- **Suggested command:** `$impeccable polish`.

### [P2] Production bundles exceed the configured 500 kB warning threshold

- **Location:** Runtime and Studio production build output.
- **Category:** Performance.
- **Evidence:** Runtime emitted `517.30 kB` and `532.95 kB` JavaScript chunks; Studio emitted `554.48 kB`. Vite warned on every build during this audit.
- **Impact:** Identity and workforce users may download application code unrelated to their route, increasing readiness time on constrained networks and devices. No route-specific load measurement was run in this phase.
- **Standard:** Universal Design R18; Impeccable performance audit.
- **Recommendation:** Measure route readiness first, then split only demonstrated route boundaries or heavy dependencies. Do not treat the warning alone as proof of user-visible latency.
- **Suggested command:** `$impeccable optimize`.

## Positive findings

- `npm run audit:teludens-ui` passed the semantic map, density, grammar, motion, and approved primary wordmark checks.
- The Impeccable detector returned `[]` for the three control-plane/workforce components and shared runtime styles.
- Focused Platform Control Plane browser checks passed 2/2 with Axe, authorization denial, Organization activation, step-up, dual approval, final-Administrator messaging, and 390 px assertions.
- The supported 1024 × 768 workforce layout had no horizontal overflow. Its equivalent 200% browser-zoom viewport, 512 × 384 CSS px, also reflowed without horizontal overflow.
- Server integration passed joiner, mover, leaver, reconciliation, access review, provider rollback, retry intent, bounce, duplicate receipt, reissue, step-up, dual approval, last-active protection, tenant isolation, and revocation behavior.
- The representative migration created one workforce row per legacy membership and verified a clean pre-migration recovery copy.
- Security evidence recorded zero dependency vulnerabilities and passed source/history secret scanning plus deployment security controls.

## Validation evidence

| Gate / command | Result | Evidence |
|---|---|---|
| Toolchain preflight | PASS | Node `v24.22.1`; npm `11.19.1`; clean working tree before execution |
| `npm run typecheck` | PASS | Exit 0 |
| `npm test` | PASS | 130/130 |
| `npm run test:db` | PASS | 34/34 on an empty disposable PostgreSQL 18 database |
| Focused `CONTROL-PLANE-E2E` browser run | PASS | 2/2 in 16.7 s; Axe included |
| `npm run test:visual` | PASS | 4/4; 25 registered route/state/family captures verified |
| PS-815 focused desktop viewport/zoom audit | PASS | 1024 × 768 and equivalent 200% browser-zoom viewport (512 × 384 CSS px) had no horizontal overflow |
| Lifecycle invalid-reason recovery | PASS | Focused `PS-790-T01` regression: 1/1; no invalid request, inline association, `aria-invalid`, focus recovery and correction verified |
| `npm run audit:teludens-ui` | PASS | Registered Teludens audit |
| Impeccable detector | PASS | No deterministic findings |
| `npm run test:migration:workforce` | PASS | `test-results/migration/step6-workforce-migration.json` |
| `npm run test:security` | PASS | 7/7 plus dependency audit; `test-results/security/ps-550-security.json` |
| `npm run audit:product-completeness` | PASS | 228 obligations; omission check PASS |
| Entra ID real-provider staging | NOT RUN | Explicitly deferred; required for final production decision |
| Okta real-provider staging | NOT RUN | Explicitly deferred; required for final production decision |
| Supported brokered SAML | NOT RUN | Explicitly deferred; required for final production decision where applicable |
| Real invitation delivery/bounce/reissue | NOT RUN | Explicitly deferred; required for final production decision |
| Windows/macOS desktop device and named AT matrix | NOT RUN | Explicitly deferred; requires authorized human testers before final production decision |
| Mobile, iOS, Android and touch-device matrix | N/A | Product Owner confirmed Plenum is a desktop platform |
| Named engineering/security/accessibility/operations/product approval | NOT RUN | Deferred until the final production decision |

The first security invocation failed because the sandbox could not reach the npm advisory endpoint or write its normal cache log. The approved rerun completed successfully; the failed prerequisite invocation is not acceptance evidence.

## Decision and next actions

The PS-815 internal phase is **PASS**. The final PS-815 production decision is **DEFERRED / NOT RUN**, not failed: real providers, real mail, the supported desktop device/AT matrix, named approvals, and reconciliation of the deferred PS-810 evidence have not yet been executed. Mobile and touch-device evidence is not applicable.

Recommended order:

1. When external acceptance resumes, execute Entra ID, Okta, real mail, supported desktop device/AT, and named approval gates against one frozen staging candidate.
2. Reconcile the deferred PS-810 production evidence in the same release-candidate decision.
3. Address the two nonblocking P2 findings when route-performance evidence or the final interaction review is scheduled.

No production tenant, identity, mailbox, credential, provider, or data was used. The named disposable PostgreSQL container and all synthetic test data were removed after the audit.
