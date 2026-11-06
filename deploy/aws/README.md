# Plenum AWS Free-plan staging package

This is a **plan-only** Terraform package for the AWS project currently locked to `us-east-2`. It creates nothing during `init`, `validate`, `test`, or `plan`, and intentionally provides no `apply` wrapper.

## Topology

- One `m7i-flex.large` EC2 host: 2 vCPU, 8 GiB, x86-64.
- One encrypted 50 GB gp3 root volume.
- One VPC, public subnet, internet gateway, route table, and security group.
- One stable Elastic IP for the four existing DuckDNS names.
- Caddy, Plenum, PostgreSQL, Keycloak, LiveKit, the pinned ClamAV scanner and the bounded operations agent run through the digest-pinned Compose contract.
- One private, versioned, AES-256-encrypted S3 bucket in `us-east-2`, with all public access blocked.
- The application reaches S3 only as the `plenum-staging-runtime` EC2 role; no object-storage access key is stored in the application secret bundle.
- Noncurrent object versions expire after 30 days. Objects written below `transient-audio/` expire through a one-day S3 lifecycle rule, which produces an approximately 24-48 hour eligibility window because S3 rounds lifecycle dates to midnight UTC.
- Governed text remains authoritative in PostgreSQL; release JSON, images, exports, and other file objects have no blanket current-version expiry.
- Session Manager replaces SSH; port 22 is not exposed.
- Runtime, operations-agent and GHCR credentials are fetched from seven scoped SSM `SecureString` parameters and never enter Terraform state or user data.
- `plenum_operations` is a separate PostgreSQL login with a generated password and read-only access to one scrubbed security-evidence view. The operations agent retains bounded metric samples locally for 90 days and sends actionable alerts to one configured Postmark receiver.

This is a staging topology, not a production topology. It has one host, no automatic failover, and consumes the Free-plan credit balance while running. Public IPv4 and EBS continue to consume credits even when the instance is stopped.

## Commands

Copy `profiles/staging.tfvars.example` to the ignored `local/staging.tfvars`, replace every `REPLACE` value, and run:

```powershell
./deploy/aws/scripts/init.ps1
./deploy/aws/scripts/validate.ps1
./deploy/aws/scripts/plan.ps1 -VarFile ./deploy/aws/local/staging.tfvars
```

Review the saved plan with:

```powershell
terraform -chdir=deploy/aws show deploy/aws/.plans/free-plan-staging.tfplan
```

The EC2 `user_data` is bootstrap-only and ignored after first creation. Runtime image/configuration changes follow the in-place Session Manager procedure in the runbook, preventing an application release from replacing the persistent staging instance.

The final apply is a separate destructive/cost approval gate and must not occur until the plan, credit forecast, IAM/bucket policy, and rollback procedure are reviewed.

Read [IAM.md](./IAM.md) before altering permissions and [RUNBOOK.md](./RUNBOOK.md) before deployment.
