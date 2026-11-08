# PS-820 desktop operations and accessibility acceptance

Status: **NOT RUN**\
Target duration: 60–90 minutes\
Scope: supported Windows and macOS desktop workstations only; mobile and touch-device acceptance are not applicable.

This is the human change-level gate for PS-820. It does not replace automated evidence and does not authorize production deployment.

## Record

- Candidate commit and image ID:
- Installation profile:
- Tester and role:
- Witness:
- Approving owner:
- Operating system and version:
- Browser and version:
- Assistive technology and version:
- Window size and browser zoom:
- Started/completed at:

Use synthetic identities and data. Do not include secrets, tokens, personal information or provider assertions in the record.

## Required desktop matrix

Complete keyboard-only operation on Windows and macOS. Complete at least one qualified Windows screen-reader session using NVDA or JAWS and one qualified macOS session using VoiceOver. Exercise 200% browser zoom, forced-colors/high-contrast behavior and reduced motion on the corresponding supported desktop browser. Record unsupported combinations as `N/A` with the governing product reason, never as `PASS`.

## Tasks

1. Open the freshly installed product shell and identify the deployment profile, Organization context and current primary action without developer tools.
2. Sign in with a synthetic authorized identity, traverse Platform lifecycle, Studio, Runtime and Administration, then sign out using only the keyboard.
3. In Runtime, create an eligible local draft, disconnect, confirm its local-pending status, reconnect and confirm the authoritative outcome.
4. Repeat the managed-device revocation exercise. Confirm the interface announces that access was revoked and protected offline data was cleared; no protected Session projection may remain available.
5. Complete one form validation recovery in Studio or Administration. Confirm the error is announced, associated with the exact field and focus returns to that field.
6. At 200% browser zoom, complete the same task order without horizontal page scrolling, clipped consequential content or hidden actions.
7. With forced colors/high contrast, identify focus, status, warnings, disabled prerequisites and destructive actions without relying on color alone.
8. With reduced motion enabled, complete navigation and state changes without decorative continuous motion or loss of state feedback.
9. Review the clean-install evidence and identify the prior image, current image, applied forward-fix migrations and profile results.
10. Review the restore evidence and identify the measured RPO/RTO, restored object count and independently verified Evidence chain.

## Pass criteria

Every required task is `PASS`; no keyboard trap, missing accessible name, focus loss, inaccessible error, hidden state change, protected-data residue or task-blocking layout defect remains. Installation, upgrade and recovery evidence must be understandable without database editing. Record defects with severity, owner and retest result.

PS-820 remains change-level acceptance pending until the tester, witness and approving owner are recorded and every required result is `PASS`.
