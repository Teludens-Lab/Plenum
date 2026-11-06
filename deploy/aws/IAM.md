# AWS staging IAM contract

Two identities exist outside Terraform so the infrastructure deployment cannot widen its own authority:

- `plenum-deployer`: local plan/deployment user restricted to the selected project Region and the named runtime role.
- `plenum-staging-runtime`: EC2 instance role with `AmazonSSMManagedInstanceCore` and read-only access to `arn:aws:ssm:us-east-2:*:parameter/plenum/staging/*`.

The managed S3 bucket policy names `plenum-staging-runtime` as its only application principal. It grants `s3:ListBucket` on the bucket and `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on its objects. The policy denies non-TLS requests. The application uses the AWS SDK default credential chain and receives short-lived role credentials from IMDSv2; it never receives a static S3 access key.

The deployer may pass only `plenum-staging-runtime` to EC2. It must not receive IAM policy-management, AWS Organizations, billing, or unrestricted role-passing permissions.

Before the first S3 apply, extend the existing `PlenumStagingTerraform` managed policy with this bucket-scoped statement, replacing `<ACCOUNT_ID>` with the current account ID. Do not copy Autopilot's generic KMS, ACL, Object Lambda, access-point, retention, or object-tagging suggestions: this package uses SSE-S3, bucket-owner-enforced ownership, and no access points or Object Lock.

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:CreateBucket",
    "s3:GetAccelerateConfiguration",
    "s3:GetBucketAcl",
    "s3:GetBucketCORS",
    "s3:GetBucketLocation",
    "s3:GetBucketLogging",
    "s3:GetBucketObjectLockConfiguration",
    "s3:GetBucketOwnershipControls",
    "s3:GetBucketPolicy",
    "s3:GetBucketPublicAccessBlock",
    "s3:GetBucketRequestPayment",
    "s3:GetBucketTagging",
    "s3:GetBucketVersioning",
    "s3:GetBucketWebsite",
    "s3:GetEncryptionConfiguration",
    "s3:GetLifecycleConfiguration",
    "s3:GetReplicationConfiguration",
    "s3:ListBucket",
    "s3:PutBucketOwnershipControls",
    "s3:PutBucketPolicy",
    "s3:PutBucketPublicAccessBlock",
    "s3:PutBucketTagging",
    "s3:PutBucketVersioning",
    "s3:PutEncryptionConfiguration",
    "s3:PutLifecycleConfiguration"
  ],
  "Resource": "arn:aws:s3:::plenum-staging-objects-<ACCOUNT_ID>-us-east-2"
}
```

Deletion permissions are deliberately absent from the deploy policy. Offboarding the bucket is a separate destructive approval after its versioned contents are exported or explicitly discarded.

After producing the credentialed Terraform plan, render it to ignored JSON and use IAM Policy Autopilot to verify the deployment policy from the actual plan. Do not upload generated policies automatically:

```powershell
terraform -chdir=deploy/aws show -json deploy/aws/.plans/free-plan-staging.tfplan | Set-Content -Encoding utf8 deploy/aws/.plans/free-plan-staging.plan.json
uvx iam-policy-autopilot@latest generate-policies (Resolve-Path deploy/aws/.plans/free-plan-staging.plan.json) --region us-east-2 --account (aws sts get-caller-identity --profile plenum-staging --query Account --output text) --pretty
```

Treat both plan files as sensitive local artifacts. Review the generated policy in IAM Policy Simulator, reconcile it with `PlenumStagingTerraform`, and delete the JSON after review. Never use Autopilot's upload option without a separate approval.
