# PS-700 five-minute user smoke

## Current status

**PASS:** The product owner completed all nine steps on 2026-10-29 in Google Chrome on Windows using the persistent loopback-only user-test environment at `http://127.0.0.1:4173/` and the approved synthetic Publisher identity.

The local harness simulates identity-provider return without requesting a password in Plenum. It is not evidence of a live institutional identity-provider integration or a deployed environment.

Preconditions after the environment is provisioned: a supported clean browser, the exact Plenum base URL, and one synthetic or approved institutional account. Do not use developer tools or paste a UUID.

1. Open the supplied Plenum base URL in the browser—for example, `https://staging.example/`. Confirm the official Plenum wordmark and “Design with intent. Run with authority.” appear. `/` means the homepage of that supplied URL; it is not something to enter by itself.
2. If signed out, choose **Sign in**. Confirm Plenum delegates to the Organization identity provider and does not request a password in the product page.
3. After authentication, confirm the account name, Organization, Organization Roles, and only authorized destinations appear.
4. Use Tab from the top. Confirm **Skip to main content** appears, focus remains visible, and every action is reachable.
5. Switch theme. Confirm the wordmark stays legible and is not distorted.
6. Open **Studio**. With no Project selected, confirm the page explains how to recover and offers **Return to Plenum home**.
7. Return home, disconnect the network, and refresh. Confirm no account or simulation data appears and **Retry connection** is available. Reconnect and retry.
8. At narrow width and at 200-percent text, confirm all content remains readable without horizontal page scrolling.
9. Choose **Sign out**. Confirm the authenticated account context disappears and the sign-in state returns.

Record PASS/FAIL per step, browser/OS, viewport, account type, date, tester, and any defect. Automated execution is evidence of behavior, not a substitute for independent human usability or assistive-technology acceptance.

## Execution record

Date: 2026-10-29. Environment: Windows, loopback local user-test server. Account: Synthetic Publisher. Tester: product owner. Browser: Google Chrome. Screenshots were supplied in the product-owner conversation; automated supporting evidence is under `output/playwright/ps-700/`.

| Step | Result | Evidence / defect |
|---|---|---|
| 1 | PASS | Official Plenum wordmark and “Design with intent. Run with authority.” visible at `/`. |
| 2 | PASS (local harness) | Sign-in returned the approved synthetic identity without a Plenum password form; live institutional IdP behavior remains outside this local proof. |
| 3 | PASS | Synthetic Publisher, PS-150 synthetic organization and authorized Organization Roles were visible. |
| 4 | PASS | Product owner confirmed the first Tab exposes “Skip to main content” at the top left and focus remains visible through continued keyboard traversal. |
| 5 | PASS | Dark theme screenshot shows the correct legible Plenum wordmark. |
| 6 | PASS | Studio displayed “No Project selected” and “Return to Plenum home.” |
| 7 | PASS | Offline screenshot shows the Offline status, omitted account data and Retry connection; the subsequent Connected screenshot shows the Synthetic Publisher context restored. |
| 8 | PASS | Product-owner narrow and 200-percent screenshots show readable reflow, intact actions and no page-wide horizontal overflow. |
| 9 | PASS | Signed-out screenshot shows no account context and the corrected “Sign-in required” status. The prior false “Connection error” defect was fixed and regression-tested. |
