# Entry-shell interaction patterns

1. Load identity context from `GET /v1/product-context`.
2. While pending, expose `aria-busy` and a stable loading heading.
3. On 401, show institutional sign-in and a safe retry; never show protected context.
4. On disconnection, remove account context, state that protected workspace data is unavailable, and retry on demand or reconnection.
5. On another error, preserve navigation safety and state that no Project or Session changed.
6. On success, expose only account, Organization, authorized destination names, and actionable empty-state guidance.
7. Sign out through `POST /v1/auth/logout`, then replace the authenticated shell with the sign-in state.

The skip link is the first focusable control. Focus remains visible. Deep links with a Session query or a Studio Project path bypass the entry shell and preserve their established behavior.

## PS-710 Project and Template interactions

1. Load bounded Projects and Simulation Templates from the authenticated Organization; never accept a client Organization identifier.
2. Apply search and lifecycle status explicitly. Empty results explain whether to create, clear search, or change status.
3. A blank create or Template create enters a pending state, preserves input on failure, and opens the server-returned Studio Draft URL only after confirmation.
4. Selecting or changing a Template always clears optional Scenario inclusion. Core Design is copied by default.
5. Archive requires inline confirmation. Reopen is visible only for archived Projects. Both send the displayed version; stale responses reload current state and announce recovery.
6. Reviewer controls remain read-only. Operator-only access renders an unauthorized state and no Project, Template, or member data.

## PS-720 Release, Session, and administration interactions

1. Load Release and Session catalogs independently so a Publisher can retain authorized Release access when Session access is denied.
2. Export/import only real immutable Package bytes; an identical verified import reports the existing Release without duplication or digest change.
3. Create a configured Session from a visible Release label. Generate internal identifiers in the client, retain the exact Command for safe retry, disable while pending, and navigate only to the server-returned stable URL.
4. Refresh and Back preserve the selected Release or Session through path-based URLs. All downstream Session links retain the same Session scope without copied identifiers.
5. Unauthorized personas receive an explicit denial with no catalog rows, identifiers, metadata, or controls. Administration destinations appear only for Admin.
6. Loading, status, validation, import, creation, and recovery messages use the shared status/alert region and move focus to the result when action is required.
