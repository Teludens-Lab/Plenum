# PS-110 threat decisions

Status: implementation evidence only; production identity remains blocked on Security Owner approval and ratification of ADR-012/ADR-015.

| Threat | Decision and control | Evidence |
|---|---|---|
| Client selects an Organization or role | Organization, issuer and audience come from trusted provider configuration; membership and roles are loaded from PostgreSQL. Token tenant/role claims are ignored. | `PS-110-T01` |
| Login interception or replay | Authorization Code flow uses cryptographic state, nonce and PKCE S256. State is stored as SHA-256, expires after five minutes and is consumed once before token exchange. | `PS-110-T01` |
| Forged or stale token | ID tokens require RS256, configured issuer/audience, subject, issued-at, expiry and nonce. | `PS-110-T01` |
| Pooled connection leaks tenant context | Every request transaction uses `SET LOCAL ROLE plenum_app` and transaction-local `app.organization_id`; forced RLS is exercised on a reused pool connection. | `DB-01` |
| Resource probing | Cross-Organization/session resource mismatches return `TARGET_NOT_FOUND`. Protected fields are omitted server-side and default to deny. | `PS-110-T02` |
| Stale permissions after reassignment/revocation | Reassignment increments the access revision and revokes projection grants in the same transaction. Authentication revocation invalidates all active projection grants for the Person's Participants. | `PS-110-T03`, integration revocation test |
| Partial privileged mutation | Seat closure/new assignment, receipt, evidence, outbox, access revision, projection revocation and Audit Record are one transaction. A forced Audit Record failure proves rollback. | `PS-110-T03` |
| Participant reads administrative audit | The application role has insert-only access to append-only Audit Records; reads fail even with valid tenant context. | `DB-01` |

The original PS-110 slice intentionally did not implement direct SAML, passwordless login, MFA enrollment, remote discovery/key refresh, an HTTP cookie adapter, or Keycloak deployment. The subsequent ADR-012 follow-up adds strict cloud/self-hosted/air-gapped OIDC configuration, remote JWKS refresh, and bundled Keycloak deployment assets. Keycloak still terminates SAML/LDAP and owns local enrollment; a real-issuer deployment and recovery exercise remains required.
