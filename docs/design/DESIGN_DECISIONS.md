# PS-700 design decisions

## DD-700-01 — production decision-signal map

The rendered Teludens v1.3 Graphite / Mineral Sage catalog is the production UI authority. The earlier Electric Vermilion values in `docs/TELUDENS_TOKENS.json` remain historical specification evidence only and are not exported as application tokens. This prevents two meanings for the same decision signal. The resolution is versioned in `packages/design-system/conformance.json`.

## DD-700-02 — root entry in Runtime web

The existing Runtime web deployable owns `/`, so the entry shell is an additive route in that application. A root URL with `sessionId` remains a Runtime deep link; `/admin/` remains Operations; `/studio/projects/:id` remains Studio. This avoids a fourth deployable and preserves current deployment topology.

## DD-700-03 — minimal trusted context

`product-shell-v1` returns the authenticated Principal display name, Organization name and roles, and authorized destination kinds. It never returns Projects, Sessions, Seats, or protected simulation content. The server derives tenant context from the authenticated Principal and RLS-scoped transaction.

## DD-710-01 — portal remains in the Runtime web shell

The Project and Template portal extends the PS-700 root workspace in Runtime web and calls server-owned `project-portal-v1` and `template-library-v1` boundaries. Studio remains the editor reached through server-returned Project URLs. This adds no deployable or parallel navigation model and preserves DD-700-02.

## DD-710-02 — trusted Organization switching

The Organization control exposes only the current authenticated Organization. Switching requires sign-out and a new trusted identity-provider context; it is not implemented as a client-supplied tenant parameter. This satisfies the switcher outcome without disclosing cross-Organization metadata or weakening RLS.
