# PS-700 five-minute user smoke

## Current status

**BLOCKED:** Plenum does not yet have a persistent local, staging, or deployed URL. The automated test server used for PS-700 starts only during Playwright execution and shuts down afterward; it is not a user-accessible environment. Do not begin this smoke test until a stable URL and approved test identity are provided.

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
