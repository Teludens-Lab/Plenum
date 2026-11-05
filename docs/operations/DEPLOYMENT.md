# Deployment operations

PS-530 packages one `plenum-platform` image for the cloud, institutional, and air-gapped profiles. The application process serves Runtime and Studio, completes OIDC login, resolves current Authentication Sessions server-side, uses PostgreSQL and S3-compatible object storage, and connects to the configured Media Provider Adapter. The Extension Host is included in the same image and retains its no-egress execution controls.

## Build and select a profile

Use Node 24 or newer, copy `deploy/compose/.env.example` to an environment-owned secret file, replace every placeholder, and keep that file out of source control. Pass it with `--env-file <path>` to each Compose command. Build once:

```text
docker build --pull=false --tag plenum-platform:0.1.0 --file deploy/compose/Dockerfile .
```

- Cloud: `docker compose -f deploy/compose/compose.yaml -f deploy/compose/compose.cloud.yaml up -d`
- Institutional: `docker compose -f deploy/compose/compose.yaml -f deploy/compose/compose.institutional.yaml up -d`
- Air-gapped: add `-f deploy/compose/compose.air-gapped.yaml` to the institutional command after loading the signed offline bundle.

The cloud profile expects institution-approved external PostgreSQL, S3, OIDC, media, and invitation-delivery endpoints. Institutional and air-gapped profiles include digest-pinned PostgreSQL 18, SeaweedFS, Keycloak, and LiveKit; invitation delivery must resolve to an approved local provider in an air-gapped deployment. An institution-local TLS ingress must expose Plenum and LiveKit; it is not a public-network dependency. The local Keycloak certificate is mounted as the application's trust root. Create the S3 bucket and apply migrations `001` through `038` before starting the application. Set `PLENUM_RETENTION_ACTOR_PERSON_ID` to a dedicated Person with the Admin Organization Role. Set `PLENUM_TRUST_PROXY=1` only when the application accepts traffic exclusively from a trusted ingress that replaces `X-Forwarded-For`.

After the first internal Organization Admin exists, perform the one-time audited Platform Administrator bootstrap described in `docs/platform-control-plane-verification.md`. Configure the runtime HTTP composition with the canonical HTTPS public base URL and an approved `FirstAdminInvitationDelivery`; `WebhookFirstAdminInvitationDelivery` requires an HTTPS endpoint and a bearer token loaded from the deployment secret store. Confirm the OIDC provider honors `prompt=login`, accepts `acr_values=mfa`, and returns an MFA-strength `acr` claim. No raw invitation token is stored after dispatch.

`GET /healthz` reports ready only when PostgreSQL, object storage, and media are reachable. OIDC login starts at `/auth/login`; the callback creates a Secure, HttpOnly, SameSite=Lax Authentication Session cookie. Never expose the Compose ports without TLS termination and network access controls.

## Identity and workforce production acceptance

Use distinct secret-store values for outbound `INVITATION_DELIVERY_BEARER_TOKEN` and inbound `INVITATION_DELIVERY_WEBHOOK_TOKEN`. The delivery provider posts authenticated, idempotent delivered/bounced/failed receipts to `POST /v1/invitation-deliveries/events`; rotate either value independently and never log request authorization.

Before promotion, run `npm run test:migration:workforce`, `npm run test:e2e`, and `npm run test:security`. In an authorized staging tenant, run `npm run test:identity-provider:staging` once with `PLENUM_STAGING_PROVIDER=entra` and once with `PLENUM_STAGING_PROVIDER=okta`, exercising joiner, mover, leaver, group mapping, retry, and reconciliation. Record real invitation delivery/bounce/revoke/reissue evidence and complete the supported-device and assistive-technology matrix. Authored harnesses or webhook receipts do not substitute for provider, inbox, or human acceptance.

If synchronization is partial, do not change access silently. Inspect the Organization's durable provisioning operation and immutable attempts, prepare the failed operation for retry, have the provider resend the original authoritative payload, then run reconciliation. Migration recovery restores the verified pre-migration backup into a separate clean target and keeps traffic on the preceding release; migrations 037 and 038 are never rolled backward in place.

## Air-gap checks

The air-gapped overlay marks the deployment network `internal: true`. Import only the image archive whose `SHA256SUMS` signature and checksums verify against an approved offline-bundle public key. Do not add external DNS, STUN, telemetry, CDN, remote anchor lookup, or package-registry routes. A Plugin marked `external_required` remains blocked unless its Release includes a verified `offline_capable` local replacement.

Run `npm run test:deployment`, `npm run test:airgap`, and `npm run verify:evidence` before an air-gapped update. The tests use synthetic data only.

## Rollback and forward-fix

For code rollback, redeploy the preceding signed image set without rolling schema backward. Database migrations are forward-only: restore the last verified backup into a disposable environment, diagnose incompatibility, and deploy a reviewed forward-fix. Never run the supplied restore command against a populated or production database.

