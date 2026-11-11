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

The cloud profile expects institution-approved external PostgreSQL, S3, OIDC, media, and invitation-delivery endpoints. Institutional and air-gapped profiles include digest-pinned PostgreSQL 18, SeaweedFS, Keycloak, and LiveKit; invitation delivery must resolve to an approved local provider in an air-gapped deployment. An institution-local TLS ingress must expose Plenum and LiveKit; it is not a public-network dependency. The local Keycloak certificate is mounted as the application's trust root. Create the S3 bucket and apply migrations `001` through `045` before starting the application. Set `PLENUM_RETENTION_ACTOR_PERSON_ID` to a dedicated Person with the Admin Organization Role. Set `PLENUM_TRUST_PROXY=1` only when the application accepts traffic exclusively from a trusted ingress that replaces `X-Forwarded-For`.

After the first internal Organization Admin exists, perform the one-time audited Platform Administrator bootstrap described in `docs/platform-control-plane-verification.md`. Configure the runtime HTTP composition with the canonical HTTPS public base URL and an approved `FirstAdminInvitationDelivery`; `WebhookFirstAdminInvitationDelivery` requires an HTTPS endpoint and a bearer token loaded from the deployment secret store. Confirm the OIDC provider honors `prompt=login`, accepts `acr_values=mfa`, and returns an MFA-strength `acr` claim. No raw invitation token is stored after dispatch.

`GET /healthz` reports ready only when PostgreSQL, object storage, and media are reachable. OIDC login starts at `/auth/login`; the callback creates a Secure, HttpOnly, SameSite=Lax Authentication Session cookie. Never expose the Compose ports without TLS termination and network access controls.

### Browser-bound OIDC transactions (BA-01)

Apply additive migration `043_oidc_browser_binding.sql` after the existing migrations and before deploying the updated service. It adds only a nullable SHA-256 browser-credential digest to login attempts; Authentication Sessions, memberships, Releases and evidence are unchanged. Pre-upgrade pending attempts have no binding and must restart sign-in. Drain old application instances during the switch: old callbacks do not enforce this binding. Retain the column on rollback; rolling back the code reopens audit findings 1/9, so prefer a reviewed forward-fix or temporarily disable login at ingress.

All three profiles share `profile-service.mjs`. `PLENUM_PUBLIC_BASE_URL` must use HTTPS and `OIDC_REDIRECT_URI` must equal its `/auth/callback` URL, including origin. TLS can terminate at the approved proxy; forwarded headers never determine the cookie domain or return origin. `PLENUM_TRUST_PROXY=1` retains its existing trusted-ingress-only meaning. Start login on the canonical host; alternate-host entries need an ingress redirect to that host before login starts.

Normal, recovery/invitation, step-up and provider-test flows set `__Host-plenum_login_<state>` with a separate random 256-bit value, `Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=300` and no Domain. The host prefix protects against sibling-domain cookie injection; Path=/ is required by that prefix. Only a digest is persisted. The existing authorization-code callback is a top-level GET, so Lax permits the provider return; `form_post` is not supported. Each tab has its own transaction cookie. Never expose these credentials, codes, verifiers or Cookie/Set-Cookie headers in application or ingress logs.

The matching credential is required before state consumption and provider exchange. Consumption commits once and clears the nonce, verifier and binding digest before the provider request. A matching expired callback erases its transaction secrets but cannot issue a session. Missing/mismatched callbacks leave valid state untouched. The HTTP callback deletes only its transaction cookie on success or failure; abandoned cookies expire after five minutes, and expired stored attempts cannot authenticate. A provider failure consumes that attempt; restart login. Existing Authentication Session cookies are not replaced on denial. Provider-test JSON exposes only the authorization URL and preserves the initiating Authentication Session on success.

Return destinations must be local paths, at most 2,000 characters, without backslashes or control characters (including encoded forms). Normalize against the configured callback/public origin, compare origins, and retain only path, query and fragment; reject normalized protocol-relative paths. The production callback validates again before emitting Location. Invalid destinations retain the established error behavior; an omitted destination returns to `/`.

BA-03 must preserve this GET-callback exception and host-only cookie contract while adding Origin/CSRF checks to other browser mutation boundaries. PS-815 reruns must cover real Entra/Okta and brokered SAML login, provider test, recovery, step-up, logout and callback failures on the exact new candidate; synthetic-provider tests do not establish interoperability.

## Identity and workforce production acceptance

Use distinct secret-store values for outbound `INVITATION_DELIVERY_BEARER_TOKEN` and inbound `INVITATION_DELIVERY_WEBHOOK_TOKEN`. The delivery provider posts authenticated, idempotent delivered/bounced/failed receipts to `POST /v1/invitation-deliveries/events`; rotate either value independently and never log request authorization.

Before promotion, run `npm run test:migration:workforce`, `npm run test:e2e`, and `npm run test:security`. In an authorized staging tenant, run `npm run test:identity-provider:staging` once with `PLENUM_STAGING_PROVIDER=entra` and once with `PLENUM_STAGING_PROVIDER=okta`, exercising joiner, mover, leaver, group mapping, retry, and reconciliation. Record real invitation delivery/bounce/revoke/reissue evidence and complete the supported-device and assistive-technology matrix. Authored harnesses or webhook receipts do not substitute for provider, inbox, or human acceptance.

If synchronization is partial, do not change access silently. Inspect the Organization's durable provisioning operation and immutable attempts, prepare the failed operation for retry, have the provider resend the original authoritative payload, then run reconciliation. Migration recovery restores the verified pre-migration backup into a separate clean target and keeps traffic on the preceding release; migrations 037 and 038 are never rolled backward in place.

## Air-gap checks

The air-gapped overlay marks the deployment network `internal: true`. Import only the image archive whose `SHA256SUMS` signature and checksums verify against an approved offline-bundle public key. Do not add external DNS, STUN, telemetry, CDN, remote anchor lookup, or package-registry routes. A Plugin marked `external_required` remains blocked unless its Release includes a verified `offline_capable` local replacement.

Run `npm run test:deployment`, `npm run test:airgap`, and `npm run verify:evidence` before an air-gapped update. The tests use synthetic data only.

## Rollback and forward-fix

For code rollback, redeploy the preceding signed image set without rolling schema backward. Database migrations are forward-only: restore the last verified backup into a disposable environment, diagnose incompatibility, and deploy a reviewed forward-fix. Never run the supplied restore command against a populated or production database.


## Organization scheduled work (BA-05)

Apply additive migration 045 before starting this candidate. It adds a tenant job binding, revision and retention deadline; it does not backfill any arbitrary administrator. The existing explicit OIDC Organization / `PLENUM_RETENTION_ACTOR_PERSON_ID` assignment is enrolled once if absent. Existing disabled or reassigned bindings are never overwritten at restart. Do not use OIDC configuration as deployment-wide tenant ownership.

Each additional Organization's active Admin explicitly selects its dedicated, active Admin Person using `PUT /v1/operations/organization-jobs` with JSON `{ "actorPersonId": "<Person UUID>", "enabled": true, "expectedRevision": 0 }`. Read the current binding with GET; updates and revocation use its current revision. Organization comes from authentication, Deployment from trusted configuration. Cookie clients retain the exact approved Origin and JSON boundary; authenticated machine clients retain the existing Bearer policy. Platform Administrator authority alone is insufficient. A new Organization becomes eligible after its own authorization, without restart. Retention audit/purge records name that Organization's selected actor.

Stop old instances before enabling additional bindings: old code retains bootstrap-only timers and does not honor binding revocation. Keep migration 045 and Audit Records on rollback; rollback reopens finding 5 and may bypass revocation. Prefer a forward-fix. Re-enroll restored/moved Organizations through the local Admin API; portable archives intentionally do not carry deployment authority bindings. Changing a binding's Deployment cannot transfer Session Authority; use the existing controlled transfer procedure.

The [scheduled-work runbook](PS-810-OBSERVABILITY-SECURITY.md#organization-scheduled-work) defines bounds, readiness, shutdown and recovery. BA-06 attachments, BA-07 outbox publication and BA-10 checkpoints are not wired by this change. BA-11 must rehearse actual deployed multi-Organization coverage.
