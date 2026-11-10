# AWS Free-plan staging runbook

## Plan review gate

1. Confirm AWS Settings still reports the Free plan, the remaining credit balance, the end date, and project Region `us-east-2`.
2. Confirm `plenum-deployer` can pass only `plenum-staging-runtime` and the runtime role can read only `/plenum/staging/*` parameters.
3. Verify the private GHCR manifest contains both `linux/amd64` and `linux/arm64` and remains pinned by digest.
4. Complete an ignored local variable file with only non-secret values. Never place Postmark, database, LiveKit, or registry credentials in Terraform. S3 uses the EC2 instance role and has no static runtime credential.
5. Run init, validation, tests, and plan. Review the resource count, instance type, 50 GB encrypted volume, Elastic IP, ingress rules, metadata options, tags, and user data.
6. Render the plan to ignored JSON, run IAM Policy Autopilot, review the result, then delete the JSON.
7. Review the current AWS Pricing Calculator estimate and projected credit exhaustion date. A continuously running fixed-performance host may consume the initial credit balance well before the six-month account end date.
8. Stop if the plan contains an instance other than `m7i-flex.large`, storage above 50 GB, detailed monitoring, a load balancer, NAT gateway, managed database, public SSH, mutable image tag, plaintext secret, or resources outside `us-east-2`.

The package intentionally stops at a saved plan. An explicit human approval is required before `terraform apply`.

## Secret preparation

Create these as Standard-tier SSM `SecureString` parameters using the default AWS-managed SSM key. Enter values through an approved local secret file or AWS console; never paste them into chat, `.tfvars`, Terraform, or shell history:

- `/plenum/staging/application`
- `/plenum/staging/postgres-password`
- `/plenum/staging/keycloak-admin-password`
- `/plenum/staging/test-user-password`
- `/plenum/staging/livekit-keys`
- `/plenum/staging/operations`
- `/plenum/staging/registry`

The application JSON retains the established Plenum secret contract plus the all-or-none Postmark group. It must not contain `S3_ACCESS_KEY_ID` or `S3_SECRET_ACCESS_KEY`; AWS S3 authentication is provided only by the EC2 instance role. The registry value is exactly `{"username":"GITHUB_USER","password":"READ_PACKAGES_PAT"}`.

The operations JSON contains only `ALERT_RECIPIENT`, `DATABASE_PASSWORD`, `POSTMARK_FROM` and `POSTMARK_SERVER_TOKEN`. The database password belongs only to the read-only `plenum_operations` login. Do not reuse the PostgreSQL owner or application password.

For the first staging installation, run the prompt-driven installer from a trusted local PowerShell session:

```powershell
./deploy/aws/scripts/install-secrets.ps1
```

The installer verifies that no `/plenum/staging/*` parameters exist, generates independent internal credentials, prompts without echo for the external Postmark and GHCR credentials, and submits each value through a short-lived local AWS CLI input file that is deleted immediately. It deliberately refuses to rotate or overwrite an existing staging secret set.

For the existing host that predates the operations parameter, create only that parameter with:

```powershell
./deploy/aws/scripts/configure-operations.ps1
```

The command prompts for the verified Postmark sender, server token and alert receiver, generates an independent database password, and refuses to overwrite an existing value.

For the existing staging environment, preserve the current SSM parameter version, then remove only `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` from `/plenum/staging/application` after the corrected image is present. Rollback restores the previous parameter version and previous image/configuration while the OCI bucket remains intact.

## Postmark invitation setup and sender changes

The invitation sender belongs to `/plenum/staging/application` in `us-east-2`: set `POSTMARK_FROM` to `Plenum <notifications@plenum-sim.app>` only after verifying the domain in Postmark. Preserve every other field and record the preceding parameter version for rollback. The deployment user may operate the host through Systems Manager but does not necessarily have permission to read or edit this SecureString; use an authorized Parameter Store session rather than copying credentials into command output or chat. The operations alert sender is configured separately in `/plenum/staging/operations`.

In Postmark, verify DKIM and the custom return-path for `plenum-sim.app`. Public DNS must contain the exact DKIM selector/value supplied by Postmark and the return-path CNAME `pm-bounces.plenum-sim.app` pointing to `pm.mtasv.net` (DNS only in Cloudflare). Check `_dmarc.plenum-sim.app` as well; a monitoring policy can begin with `v=DMARC1; p=none;`, then be tightened after legitimate senders are verified. Account approval alone does not prove DNS authentication. See [Postmark domain verification](https://postmarkapp.com/support/article/how-do-i-verify-a-domain).

The `outbound` message stream needs these template aliases, each with HTML and plain-text content using `organizationName`, `invitationUrl`, and `expiresAt`:

- `platform-first-admin-v1`
- `platform-administrator-v1`
- `organization-workforce-v1`

Configure delivery and bounce events to `https://plenum-notifications-01.duckdns.org/v1/events/postmark`, with HTTP Basic username `plenum-postmark` and the existing `POSTMARK_WEBHOOK_PASSWORD`. Keep bounce content, open tracking, and link tracking disabled. Inspect existing webhooks before creating another. Validate templates with Postmark's template validation endpoint and verify the saved callback settings without logging authentication values.

After changing the saved sender, refresh the mounted secrets and restart only the application during a suitable test window; active application connections may reconnect:

```sh
sudo /usr/local/sbin/plenum-fetch-secrets
sudo docker compose --file /etc/plenum/compose.yaml restart application
sudo docker compose --file /etc/plenum/compose.yaml ps application
curl --fail https://plenum-stage-01.duckdns.org/healthz
```

Require a healthy application, one explicitly authorized test recipient, confirmed delivery with SPF/DKIM results, and a recorded delivery callback before declaring invitations ready. Verify a controlled bounce separately. Use an actual governed invitation to test acceptance; a template preview does not prove onboarding. Roll back a sender change by restoring its previous value in Parameter Store and repeating the refresh/restart. The canonical platform URL is `https://plenum-stage-01.duckdns.org`; the Postmark sender remains `notifications@plenum-sim.app`.

## Application domains and DuckDNS fallback

Both `plenum-sim.app` and `plenum-stage-01.duckdns.org` serve the same application directly over HTTPS on the existing Elastic IP, `18.227.27.151`. The custom domain uses a DNS-only Cloudflare A record. Caddy manages both certificates. Identity, media, and notification services retain their existing DuckDNS hostnames and credentials.

DuckDNS is currently the canonical hostname for `PLENUM_PUBLIC_BASE_URL` and `OIDC_REDIRECT_URI`, so generated invitations and sign-in flows work without redirecting users to the custom domain. The custom domain remains available, but its sign-in completes on DuckDNS. This fallback was requested after an organization-managed Microsoft Defender block was observed for `plenum-sim.app`; it does not change or override endpoint security policy.

The live Keycloak `plenum` client and realm import file allow the exact `/auth/callback` URI and web origin for both application domains. The live Caddy application block and ingress network aliases include both hostnames, with no cross-domain redirect. Local/example Terraform variables use DuckDNS as `application_hostname`; preserve the additional custom-domain Caddy hostname and network alias when regenerating the runtime configuration. Editing the realm import file alone does not update the live Keycloak client. Cloud-init is bootstrap-only and ignored by Terraform on the existing host, so editing Terraform variables alone does not update the running configuration.

Root-only rollback copies on the host are in `/etc/plenum/duckdns-fallback/` (state before enabling fallback) and `/etc/plenum/domain-migration-plenum-sim-app/` (state before the initial custom-domain migration). To undo fallback, restore `compose.yaml`, `Caddyfile`, and `realm-plenum.json` from the fallback backup and recreate only `application` and `ingress` with `docker compose --file /etc/plenum/compose.yaml up --detach --no-deps --force-recreate --pull never --no-build application ingress`. Also restore the local Terraform hostname to `plenum-sim.app`. That rollback reintroduces the DuckDNS-to-custom-domain redirect, so use it only after the custom-domain access issue is resolved. Both callbacks are already allowed; no Keycloak restart, database restore, bootstrap jobs, or database migrations are required.

Verification covers direct HTTPS responses without cross-domain redirects, `/healthz`, `/`, `/studio/`, and their script/style assets; OIDC sign-in with the existing staging test account; a secure session cookie on DuckDNS; authenticated `/v1/product-context`, `/v1/projects`, and `/v1/sessions`; unauthenticated projects access rejected; and successful logout. These are HTTP integration checks, not a visual audit or a new invitation-acceptance test. A user's managed-device access still requires confirmation on that device.

## Authorized deployment sequence

1. Apply only the exact reviewed plan after explicit approval. The plan must add the S3 resources and must not replace `aws_instance.plenum`.
2. Point both application DNS records and the three supporting DuckDNS records at the `public_ipv4` output.
3. Wait for the EC2 instance to appear as an online Systems Manager managed node; do not open SSH.
4. Populate the seven SecureString parameters.
5. Start `plenum.service` through an authorized Session Manager session. The service fetches secrets, pulls the pinned image, removes temporary registry credentials, and starts Compose.
6. Run `node deploy/compose/verify-object-storage.mjs` inside the application container and require `object storage upload/read/delete: PASS`; then verify Compose health, the ClamAV service is healthy, `operations-reader-bootstrap` exited `0`, `operations-agent` is healthy, DNS, TLS, `/healthz`, OIDC login, Runtime, Studio, media, invitation delivery, delivery callback, controlled bounce and one controlled operations alert.
7. Record credit consumption and stop the instance when the test window ends. The Elastic IP and EBS volume continue consuming credits while retained.

## Storage retention contract

- PostgreSQL remains authoritative for authored text, structured responses, workflow state, analysis data, and audit records. Database retention is governed separately and is never inferred from an S3 lifecycle rule.
- S3 current versions for release JSON, images, exports, and other governed file objects do not expire automatically.
- Replaced or deleted S3 object versions expire after 30 days.
- Transient audio must use the `transient-audio/` key prefix. Its current and noncurrent versions use a one-day lifecycle rule, making them eligible for expiration after approximately 24-48 hours due to S3 midnight-UTC rounding. Lifecycle deletion is asynchronous and is not a hard-deadline privacy erasure mechanism.

## Recovery and offboarding

- Application rollback changes only the pinned digest through a new reviewed plan. Do not reverse database migrations.
- Before instance replacement, export and verify a PostgreSQL backup; root-volume deletion is enabled because the volume is Terraform-owned.
- If the host is compromised, remove the application and supporting-service DNS records, stop the instance, preserve evidence, rotate all seven parameter values, and revoke the GHCR credential.
- Before credits expire, export database/object evidence, destroy the reviewed AWS resources, release the Elastic IP, delete the seven parameters, deactivate the deployer access key, and verify the Billing dashboard shows no retained resources.
