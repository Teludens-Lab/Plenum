# Identity deployment profiles

Plenum remains an OIDC relying party in every deployment profile. Configure the server with the variables consumed by `loadIdentityDeploymentConfiguration`:

| Profile | Provider | Network rule |
|---|---|---|
| `cloud` | `customer_oidc` or `keycloak` | Every issuer, authorization, token and JWKS origin must be explicitly allowlisted. |
| `self_hosted` | `keycloak` | Run the bundled Keycloak service; configure any institutional OIDC, SAML or LDAP federation in Keycloak. |
| `air_gapped` | `keycloak` | Use the air-gapped Compose override; every identity endpoint must use the same local Keycloak host. |

Required application variables are `PLENUM_DEPLOYMENT_PROFILE`, `PLENUM_IDENTITY_PROVIDER`, `PLENUM_IDENTITY_PROVIDER_KEY`, `PLENUM_ORGANIZATION_ID`, `PLENUM_OIDC_ISSUER`, `PLENUM_OIDC_AUDIENCE`, `PLENUM_OIDC_CLIENT_ID`, `PLENUM_OIDC_REDIRECT_URI`, `PLENUM_OIDC_AUTHORIZATION_ENDPOINT`, `PLENUM_OIDC_TOKEN_ENDPOINT`, `PLENUM_OIDC_JWKS_URI`, and `PLENUM_IDENTITY_ALLOWED_ORIGINS` (comma-separated exact HTTPS origins).

Before starting Keycloak, copy `realm-plenum.json` to an institution-controlled deployment overlay and replace the example redirect origin. Supply the database connection, bootstrap-admin credentials, hostname, and TLS file paths through the Compose environment; do not commit their values.

Self-hosted start:

```sh
docker compose -f deploy/identity/keycloak/compose.yaml up -d
```

Air-gapped start (after loading the pinned image into the local registry/cache):

```sh
docker compose -f deploy/identity/keycloak/compose.yaml -f deploy/identity/keycloak/compose.air-gapped.yaml up -d
```

Rotate realm signing keys in Keycloak with an overlap window: add and activate the new key, allow Plenum's remote JWKS cache to refresh, then retire the old key only after all issued tokens using it have expired. The application accepts only RS256 and continues to map Persons and Organization Memberships from its own database; identity-provider role claims are not authoritative.
