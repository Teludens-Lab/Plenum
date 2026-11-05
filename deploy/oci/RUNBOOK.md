# OCI deployment and rollback runbook

## Plan review gate

1. Publish one private GHCR manifest list containing `linux/amd64` and `linux/arm64`; record its `sha256` manifest digest.
2. Create a GitHub PAT (classic) with only `read:packages`, preferably owned by a dedicated deployment identity with access to the private package. Authorize organization SSO if required.
3. In OCI Vault, create or rotate a secret whose decoded value is exactly `{"username":"GITHUB_USER","password":"READ_PACKAGES_PAT"}`. Enter the value in the OCI Console or another approved secret channel, never Terraform, `.tfvars`, shell history, or chat. Record only its secret OCID.
4. Create the profile-specific dynamic group and single-secret policy from `IAM.md`. The functional-free VM and production container group must not receive access to unrelated secrets.
5. Complete the selected local `.tfvars` from `profiles/`, including only `image_pull_secret_ocid`. Keep it under ignored `deploy/oci/local/` or another environment-owned location.
6. Authenticate local Docker to `ghcr.io` with an operator credential that has `read:packages`; this is required only for manifest verification during planning.
7. Run `init.ps1`, `validate.ps1`, and `plan.ps1`. Never substitute a mutable image tag.
8. Review `terraform show deploy/oci/.plans/<profile>.tfplan`. Confirm the selected profile, digest, Vault secret OCID, CIDRs, hostnames, resource count, deletion/replacement actions, and `cost_guard` output. No username or token may appear.
9. Confirm OCI limits and the Cost Estimator. “Always Free-targeted” is a safeguard, not a billing guarantee: tenancy age, regional availability, boot-volume use elsewhere, outbound transfer, DNS, and future Oracle pricing can still produce cost or prevent capacity allocation.
10. Stop if a production-parity plan shows `allow_billable_resources=false`, an unapproved managed-service shape, a public application/database address, plaintext HTTP ingress, or any secret value.

This package intentionally stops at a saved plan. A separately authorized operator owns the apply approval, maintenance window, DNS change, and evidence capture.

## Functional-free deployment sequence

1. Approve only a plan whose VM is `VM.Standard.A1.Flex`, at most 2 OCPU/12 GB, and whose boot volume is at most 200 GB. Confirm SSH is restricted to the administrator `/32` or approved VPN CIDR.
2. If OCI returns `Out of host capacity`, set `free_availability_domain_index` to another value from `0`, `1`, or `2`, then re-run validation and planning. Approve only a plan that adds the missing VM without changing or destroying the existing network and storage. If all three domains are unavailable, preserve state and retry later; do not silently select a paid shape.
3. After an authorized apply outside this package, point the application, identity, and media DNS records to `functional_free_public_ip`.
4. SSH to the VM and create these root-owned files with mode `0600` under `/etc/plenum/secrets`: `application.json`, `postgres-password`, `keycloak-admin-password`, `test-user-password`, and `livekit-keys.yaml`. Transfer them through an approved secret channel; do not paste them into shell history or Terraform.
5. Ensure the OCI S3 customer secret in `application.json` is restricted to the staging object bucket. The JSON database URL must use the local `database` service and the same PostgreSQL password. Use independent random values for the outbound `INVITATION_DELIVERY_BEARER_TOKEN` and inbound `INVITATION_DELIVERY_WEBHOOK_TOKEN`; disclose the webhook value only to the approved delivery provider.
6. Start with `sudo systemctl start plenum`. The unit retrieves the current registry credential with its instance principal, pulls the pinned GHCR digest, deletes the temporary Docker credential directory, and only then starts the stack. The one-shot migration service records each successful SQL filename, then creates the single staging-only Keycloak user and its linked Plenum admin identity before the application starts.
7. Verify `sudo docker compose -f /etc/plenum/compose.yaml ps`, then `curl --fail https://<application-host>/healthz`. Complete OIDC login, Runtime entry, Studio entry, media join, object upload, and Fractured Order smoke tests.

## Production-parity deployment sequence

1. Obtain the explicit cost and production-topology approval, then set `allow_billable_resources=true` and re-plan. Apply the additional staging-only IAM statements in `IAM.md`; never widen the deployer to tenancy administration.
2. Create the PostgreSQL password and application JSON as separate OCI Vault secrets. The application `DATABASE_URL` uses the reserved `production_database_private_ip` from the reviewed plan, so the secret can be complete before provisioning. Terraform receives only secret OCIDs and a pinned password-secret version.
3. Create the container dynamic group and its single-secret read policy. Confirm the container has no public IP and PostgreSQL accepts port 5432 only from the application NSG.
4. Before starting the application, run migrations 001-025 once from the **same approved image digest** in a private, audited operator job. Record each applied filename. Do not run migrations from a developer checkout.
5. After an authorized apply, point DNS to `production_load_balancer_ip`. Verify the OCI Certificate covers the hostname and the listener accepts TLS 1.2 or newer only.
6. Verify the load-balancer backend, `/healthz`, OIDC login, Runtime, Studio, media, object upload, audit evidence, backup creation, and restoration rehearsal before promotion.

## Rollback

### Application-only rollback

1. Identify the preceding approved manifest digest; never roll back to a tag.
2. Put that digest in the same profile’s local `.tfvars`, run all three plan commands, and review that only the container/VM release configuration changes.
3. Deploy the approved plan outside this package. Re-run `/healthz` and the critical smoke journeys.
4. Do **not** reverse database migrations. If the previous image is incompatible with the current schema, stop and deploy a reviewed forward-fix.

### Functional-free infrastructure recovery

Restore the PostgreSQL volume from the last verified backup to a replacement VM, not over a running database. Keep the object bucket versioned. DNS rollback is the final traffic switch after health verification.

### Production data recovery

`prevent_destroy` protects the managed PostgreSQL resource. Database deletion or replacement requires a reviewed code change, explicit owner approval, a verified backup, and a restore rehearsal. Use point-in-time recovery into a separate DB system, validate it privately, then switch the runtime secret and backend through a new reviewed plan.

### Emergency containment

Remove the public DNS record or disable the HTTPS listener, preserve Terraform state and audit logs, rotate affected Vault secret versions, and record the incident. Do not destroy evidence-bearing resources as a first response.

### Private registry credential rotation

1. Issue a replacement PAT (classic) with only `read:packages` and verify its package access before revoking the old token.
2. Add a new OCI Vault secret version with the same two-field JSON contract and mark it `CURRENT`.
3. For functional-free, run `sudo systemctl restart plenum`; for production-parity, replace or restart the container instance through a reviewed plan so OCI performs a new authenticated pull.
4. Confirm the exact digest starts and `/healthz` passes, then revoke the old GitHub token.
