# Entry-shell interaction patterns

1. Load identity context from `GET /v1/product-context`.
2. While pending, expose `aria-busy` and a stable loading heading.
3. On 401, show institutional sign-in and a safe retry; never show protected context.
4. On disconnection, remove account context, state that protected workspace data is unavailable, and retry on demand or reconnection.
5. On another error, preserve navigation safety and state that no Project or Session changed.
6. On success, expose only account, Organization, authorized destination names, and actionable empty-state guidance.
7. Sign out through `POST /v1/auth/logout`, then replace the authenticated shell with the sign-in state.

The skip link is the first focusable control. Focus remains visible. Deep links with a Session query or a Studio Project path bypass the entry shell and preserve their established behavior.
