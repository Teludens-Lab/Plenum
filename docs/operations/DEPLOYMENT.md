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

The cloud profile expects institution-approved external PostgreSQL, S3, OIDC, and media endpoints. Institutional and air-gapped profiles include digest-pinned PostgreSQL 18, SeaweedFS, Keycloak, and LiveKit. An institution-local TLS ingress must expose Plenum and LiveKit; it is not a public-network dependency. The local Keycloak certificate is mounted as the application's trust root. Create the S3 bucket and apply migrations `001` through `025` before starting the application. Set `PLENUM_RETENTION_ACTOR_PERSON_ID` to a dedicated Person with the Admin Organization Role. Set `PLENUM_TRUST_PROXY=1` only when the application accepts traffic exclusively from a trusted ingress that replaces `X-Forwarded-For`.

`GET /healthz` reports ready only when PostgreSQL, object storage, and media are reachable. OIDC login starts at `/auth/login`; the callback creates a Secure, HttpOnly, SameSite=Lax Authentication Session cookie. Never expose the Compose ports without TLS termination and network access controls.

## Air-gap checks

The air-gapped overlay marks the deployment network `internal: true`. Import only the image archive whose `SHA256SUMS` signature and checksums verify against an approved offline-bundle public key. Do not add external DNS, STUN, telemetry, CDN, remote anchor lookup, or package-registry routes. A Plugin marked `external_required` remains blocked unless its Release includes a verified `offline_capable` local replacement.

Run `npm run test:deployment`, `npm run test:airgap`, and `npm run verify:evidence` before an air-gapped update. The tests use synthetic data only.

## Rollback and forward-fix

For code rollback, redeploy the preceding signed image set without rolling schema backward. Database migrations are forward-only: restore the last verified backup into a disposable environment, diagnose incompatibility, and deploy a reviewed forward-fix. Never run the supplied restore command against a populated or production database.

