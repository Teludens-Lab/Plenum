mock_provider "aws" {
  mock_data "aws_ami" {
    override_during = plan
    defaults = {
      id               = "ami-0123456789abcdef0"
      architecture     = "x86_64"
      root_device_name = "/dev/sda1"
    }
  }

  mock_data "aws_iam_instance_profile" {
    override_during = plan
    defaults = {
      name = "plenum-staging-runtime"
      arn  = "arn:aws:iam::123456789012:instance-profile/plenum-staging-runtime"
    }
  }

  mock_data "aws_caller_identity" {
    override_during = plan
    defaults = {
      account_id = "123456789012"
      arn        = "arn:aws:iam::123456789012:user/terraform-test"
      user_id    = "AIDATEST"
    }
  }

  mock_data "aws_iam_role" {
    override_during = plan
    defaults = {
      name = "plenum-staging-runtime"
      arn  = "arn:aws:iam::123456789012:role/plenum-staging-runtime"
    }
  }

  mock_resource "aws_s3_bucket" {
    override_during = plan
    defaults = {
      id  = "plenum-staging-objects-123456789012-us-east-2"
      arn = "arn:aws:s3:::plenum-staging-objects-123456789012-us-east-2"
    }
  }
}

variables {
  application_image                   = "ghcr.io/teludens-lab/plenum@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  application_release                 = "plenum-test-0.1.0"
  application_hostname                = "staging.plenum.example"
  identity_hostname                   = "identity.staging.plenum.example"
  media_hostname                      = "media.staging.plenum.example"
  notifications_hostname              = "notifications.staging.plenum.example"
  acknowledge_credit_funded_resources = true
  application_contract = {
    deployment_id                = "plenum-staging"
    retention_actor_person_id    = "00000000-0000-4000-8000-000000000001"
    oidc_provider_key            = "plenum-staging"
    oidc_organization_id         = "00000000-0000-4000-8000-000000000002"
    oidc_client_id               = "plenum"
    media_adapter_digest         = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    invitation_delivery_endpoint = "https://notifications.staging.plenum.example/v1/messages"
  }
}

run "free_plan_staging" {
  command = plan

  assert {
    condition     = aws_instance.plenum.instance_type == "m7i-flex.large"
    error_message = "AWS staging must use the verified 2 vCPU / 8 GiB shape."
  }


  assert {
    condition = (aws_s3_bucket_public_access_block.objects.block_public_acls &&
      aws_s3_bucket_public_access_block.objects.block_public_policy &&
      aws_s3_bucket_public_access_block.objects.ignore_public_acls &&
    aws_s3_bucket_public_access_block.objects.restrict_public_buckets)
    error_message = "The staging object bucket must block every form of public access."
  }

  assert {
    condition = (aws_s3_bucket_versioning.objects.versioning_configuration[0].status == "Enabled" &&
    one(aws_s3_bucket_server_side_encryption_configuration.objects.rule).apply_server_side_encryption_by_default[0].sse_algorithm == "AES256")
    error_message = "The staging object bucket must enable versioning and server-side encryption."
  }

  assert {
    condition = (length([
      for rule in aws_s3_bucket_lifecycle_configuration.objects.rule : rule
      if rule.id == "expire-noncurrent-versions-after-30-days" &&
      one(rule.noncurrent_version_expiration).noncurrent_days == 30
      ]) == 1 && length([
      for rule in aws_s3_bucket_lifecycle_configuration.objects.rule : rule
      if rule.id == "expire-transient-audio-after-one-day" &&
      one(rule.filter).prefix == "transient-audio/" &&
      one(rule.expiration).days == 1 &&
      one(rule.noncurrent_version_expiration).noncurrent_days == 1
    ]) == 1)
    error_message = "Noncurrent versions must expire after 30 days and transient audio after the one-day (roughly 24-48 hour) S3 window."
  }

  assert {
    condition = (strcontains(aws_s3_bucket_policy.objects.policy, "plenum-staging-runtime") &&
      strcontains(aws_s3_bucket_policy.objects.policy, "s3:ListBucket") &&
      strcontains(aws_s3_bucket_policy.objects.policy, "s3:PutObject") &&
      strcontains(aws_s3_bucket_policy.objects.policy, "s3:GetObject") &&
    strcontains(aws_s3_bucket_policy.objects.policy, "s3:DeleteObject"))
    error_message = "The private bucket policy must grant only the runtime role's required object lifecycle actions."
  }

  assert {
    condition     = aws_instance.plenum.metadata_options[0].http_tokens == "required" && aws_instance.plenum.metadata_options[0].http_put_response_hop_limit == 2
    error_message = "The container host must require IMDSv2 with a hop limit of two."
  }

  assert {
    condition     = aws_instance.plenum.root_block_device[0].encrypted && aws_instance.plenum.root_block_device[0].volume_size == 50
    error_message = "The root volume must remain encrypted and within the reviewed ceiling."
  }

  assert {
    condition     = !aws_instance.plenum.associate_public_ip_address && aws_eip.public.domain == "vpc"
    error_message = "The host must use the reviewed stable VPC Elastic IP."
  }

  assert {
    condition     = strcontains(local.user_data, "plenum-fetch-secrets") && strcontains(local.user_data, "/plenum/staging/registry")
    error_message = "Runtime and registry credentials must be fetched from the scoped SSM prefix."
  }

  assert {
    condition = (strcontains(local.user_data, "snap install aws-cli --classic") &&
      strcontains(local.user_data, "Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin") &&
    !strcontains(local.user_data, "  - awscli"))
    error_message = "AWS CLI v2 must use the supported Snap package and be visible to the systemd service."
  }

  assert {
    condition     = strcontains(local.user_data, "content: |\n      name: plenum-functional-free")
    error_message = "Embedded Compose content must remain correctly indented inside cloud-init YAML."
  }

  assert {
    condition = (strcontains(local.user_data, "postgres-data:/var/lib/postgresql") &&
    !strcontains(local.user_data, "postgres-data:/var/lib/postgresql/data"))
    error_message = "PostgreSQL 18 must mount the parent data directory."
  }

  assert {
    condition     = output.cost_guard.credit_funded_resources && output.cost_guard.public_ipv4_hourly_cost_applies
    error_message = "The plan must disclose its Free-plan credit and public IPv4 cost posture."
  }
}
