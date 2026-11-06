variable "deployment_profile" {
  description = "The single AWS topology supported by this package."
  type        = string
  default     = "free-plan-staging"
  validation {
    condition     = var.deployment_profile == "free-plan-staging"
    error_message = "deployment_profile must be free-plan-staging."
  }
}

variable "aws_profile" {
  description = "Local AWS CLI profile. Credentials never enter Terraform variables."
  type        = string
  default     = "plenum-staging"
}

variable "region" {
  description = "AWS project Region. The current Free-plan project is locked to US East (Ohio)."
  type        = string
  default     = "us-east-2"
  validation {
    condition     = var.region == "us-east-2"
    error_message = "This Free-plan project is region-locked to us-east-2."
  }
}

variable "name_prefix" {
  type    = string
  default = "plenum-staging"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.name_prefix))
    error_message = "name_prefix must be a short lowercase DNS-style label."
  }
}

variable "application_image" {
  description = "Immutable multi-platform Plenum OCI image reference. Tags without a sha256 digest are rejected."
  type        = string
  validation {
    condition     = can(regex("^[^[:space:]]+@sha256:[0-9a-f]{64}$", var.application_image))
    error_message = "application_image must use registry/repository@sha256:<64 lowercase hex characters>."
  }
}

variable "application_platforms" {
  description = "Platforms independently verified in the supplied manifest list."
  type        = set(string)
  default     = ["linux/amd64", "linux/arm64"]
  validation {
    condition     = var.application_platforms == toset(["linux/amd64", "linux/arm64"])
    error_message = "The release contract requires exactly linux/amd64 and linux/arm64."
  }
}

variable "application_release" {
  description = "Immutable human-readable release identifier used for audit tags."
  type        = string
  validation {
    condition     = trimspace(var.application_release) != "" && !contains(["latest", "main", "master"], lower(var.application_release))
    error_message = "application_release must be immutable and cannot be a moving label."
  }
}

variable "runtime_instance_profile_name" {
  description = "Pre-created EC2 instance profile. Terraform can pass but cannot alter this role."
  type        = string
  default     = "plenum-staging-runtime"
  validation {
    condition     = var.runtime_instance_profile_name == "plenum-staging-runtime"
    error_message = "runtime_instance_profile_name is locked to plenum-staging-runtime."
  }
}

variable "ssm_parameter_prefix" {
  description = "Prefix containing runtime SecureString parameters created outside Terraform."
  type        = string
  default     = "/plenum/staging"
  validation {
    condition     = var.ssm_parameter_prefix == "/plenum/staging"
    error_message = "ssm_parameter_prefix is locked to /plenum/staging."
  }
}

variable "application_hostname" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$", var.application_hostname))
    error_message = "application_hostname must be a fully qualified hostname."
  }
}

variable "identity_hostname" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$", var.identity_hostname))
    error_message = "identity_hostname must be a fully qualified hostname."
  }
}

variable "media_hostname" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$", var.media_hostname))
    error_message = "media_hostname must be a fully qualified hostname."
  }
}

variable "notifications_hostname" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$", var.notifications_hostname))
    error_message = "notifications_hostname must be a fully qualified hostname."
  }
}

variable "application_contract" {
  description = "Non-secret runtime configuration. AWS object storage is derived from the managed private S3 bucket."
  type = object({
    deployment_id                = string
    retention_actor_person_id    = string
    oidc_provider_key            = string
    oidc_organization_id         = string
    oidc_client_id               = string
    media_adapter_digest         = string
    invitation_delivery_endpoint = string
  })
  validation {
    condition = alltrue([
      can(regex("^[0-9a-fA-F-]{36}$", var.application_contract.retention_actor_person_id)),
      can(regex("^[0-9a-fA-F-]{36}$", var.application_contract.oidc_organization_id)),
      can(regex("^https://", var.application_contract.invitation_delivery_endpoint))
    ])
    error_message = "Identifiers must be UUIDs and external endpoints must use HTTPS."
  }
  validation {
    condition     = startswith(var.application_contract.invitation_delivery_endpoint, "https://${var.notifications_hostname}/")
    error_message = "invitation_delivery_endpoint must use notifications_hostname."
  }
}

variable "functional_test_username" {
  type    = string
  default = "plenum-tester"
  validation {
    condition     = can(regex("^[a-z][a-z0-9._-]{2,62}$", var.functional_test_username))
    error_message = "functional_test_username must be a safe lowercase username."
  }
}

variable "instance_type" {
  description = "Free-plan-eligible fixed-performance shape verified in us-east-2."
  type        = string
  default     = "m7i-flex.large"
  validation {
    condition     = var.instance_type == "m7i-flex.large"
    error_message = "This staging package is locked to m7i-flex.large (2 vCPU, 8 GiB, x86-64)."
  }
}

variable "root_volume_gbs" {
  description = "Encrypted gp3 root volume ceiling for the single-host staging stack."
  type        = number
  default     = 50
  validation {
    condition     = var.root_volume_gbs == 50
    error_message = "root_volume_gbs is locked to 50 GB for the reviewed cost posture."
  }
}

variable "acknowledge_credit_funded_resources" {
  description = "Explicit planning gate acknowledging that apply would consume Free-plan credits and public IPv4 hours."
  type        = bool
  default     = false
}

check "free_plan_guard" {
  assert {
    condition     = var.acknowledge_credit_funded_resources
    error_message = "Set acknowledge_credit_funded_resources=true only to review a credit-funded staging plan."
  }
}
