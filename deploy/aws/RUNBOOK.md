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

## Authorized deployment sequence

1. Apply only the exact reviewed plan after explicit approval. The plan must add the S3 resources and must not replace `aws_instance.plenum`.
2. Point all four DuckDNS records at the `public_ipv4` output.
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
- If the host is compromised, remove DuckDNS records, stop the instance, preserve evidence, rotate all seven parameter values, and revoke the GHCR credential.
- Before credits expire, export database/object evidence, destroy the reviewed AWS resources, release the Elastic IP, delete the seven parameters, deactivate the deployer access key, and verify the Billing dashboard shows no retained resources.
