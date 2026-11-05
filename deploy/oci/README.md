# Plenum OCI deployment package

This is a **plan-only** Terraform package. It can describe either a zero-cost-targeted staging topology or the managed production topology, but it contains no `apply` automation and creates nothing during `init`, `validate`, or `plan`.

## Profiles

| Contract | `functional-free` | `production-parity` |
|---|---|---|
| Plenum release | Same digest-pinned OCI manifest | Same digest-pinned OCI manifest |
| CPU architecture | Ampere ARM64 | Managed shape; manifest also contains AMD64 |
| Application runtime | One Always Free-targeted A1 VM | OCI Container Instances |
| PostgreSQL | Pinned PostgreSQL container on the VM | OCI Database with PostgreSQL 18 |
| Object storage | Private, versioned OCI bucket | Same private, versioned OCI bucket contract |
| Identity/media | Pinned Keycloak and LiveKit containers | Institution-managed endpoints |
| HTTPS | Caddy automatic TLS | OCI flexible load balancer + OCI Certificate |
| Secret source | Root-owned JSON file, outside Terraform | OCI Vault via resource principal |
| Private image authentication | OCI Vault via VM instance principal; credential file erased after pull | Native OCI Vault image-pull secret |
| Cost posture | Fails above 2 OCPU, 12 GB RAM, or 200 GB boot volume | Fails unless `allow_billable_resources=true` |

Functional-free preserves application behavior and release artifacts, not service capacity or availability. It is not a production topology.

## Commands

Prerequisites are PowerShell 7+, Terraform 1.17.x, OCI CLI profile authentication, Node 24+, Docker Buildx authenticated to `ghcr.io`, three DNS names, the private multi-platform image, and the OCI Vault image-pull secret described below. Copy an example to an ignored local path such as `deploy/oci/local/functional-free.tfvars`, replace every `REPLACE` value, then run:

```powershell
./deploy/oci/scripts/init.ps1
./deploy/oci/scripts/validate.ps1
./deploy/oci/scripts/plan.ps1 -Profile functional-free -VarFile ./deploy/oci/local/functional-free.tfvars
```

Production parity uses the same commands with its example and `-Profile production-parity`. The plan command verifies that the registry manifest contains both `linux/amd64` and `linux/arm64` before Terraform runs. `-SkipImageManifestCheck` is diagnostic only; a skipped plan must not be approved.

Terraform state, plans, local variable files, private keys, and `.env` files are ignored. OCI API credentials are read from the named local CLI profile, never from Terraform variables.

`validate.ps1` also runs two provider-mocked plans. They prove the resource graph and fail-closed profile gates without contacting OCI or substituting for the final credentialed plan.

## Shared secret contract

Both profiles supply exactly these eight non-empty JSON string fields to the image at process start:

```json
{
  "DATABASE_URL": "<secret>",
  "FLOOR_TOKEN_SECRET": "<secret>",
  "INVITATION_DELIVERY_BEARER_TOKEN": "<secret>",
  "INVITATION_DELIVERY_WEBHOOK_TOKEN": "<secret>",
  "MEDIA_API_KEY": "<secret>",
  "MEDIA_API_SECRET": "<secret>",
  "S3_ACCESS_KEY_ID": "<secret>",
  "S3_SECRET_ACCESS_KEY": "<secret>"
}
```

Unknown or missing keys fail startup. Functional-free reads `/etc/plenum/secrets/application.json`; production parity reads the current OCI Vault secret version named by `PLENUM_SECRET_BUNDLE_OCID`. Secret content must never appear in `.tfvars`, Terraform state, the OCI Container Instance environment map, logs, or source control.

## Private GHCR image-pull contract

Create one OCI Vault secret outside Terraform whose decoded value is exactly:

```json
{"username":"GITHUB_USER","password":"READ_PACKAGES_PAT"}
```

Use a GitHub personal access token (classic) restricted to `read:packages`, authorize it for the organization if SSO requires that, and give the GitHub identity access to the private package. Put only the resulting OCI secret OCID in `image_pull_secret_ocid`. Do not put the username or token in `.tfvars`, Terraform, shell history, cloud-init, or chat.

Functional-free reads the current Vault version with its OCI instance principal, logs in only long enough to pull the approved digest, and removes `/run/plenum/docker` before application startup. Production-parity supplies the same secret OCID to OCI Container Instances as a native `VAULT` image-pull secret. Rotation is a new `CURRENT` OCI secret version followed by a service restart or container-instance replacement; the image digest does not change.

Read [RUNBOOK.md](./RUNBOOK.md) before deployment or rollback and [IAM.md](./IAM.md) before changing policies.
