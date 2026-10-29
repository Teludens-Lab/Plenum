variable "deployment_profile" {
  description = "Exactly one deployment topology to plan."
  type        = string
  validation {
    condition     = contains(["functional-free", "production-parity"], var.deployment_profile)
    error_message = "deployment_profile must be functional-free or production-parity."
  }
}

variable "oci_config_profile" {
  description = "Profile name in the local OCI CLI config. Credentials are never Terraform inputs."
  type        = string
  default     = "DEFAULT"
}

variable "tenancy_ocid" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^ocid1\\.tenancy\\.", var.tenancy_ocid))
    error_message = "tenancy_ocid must be an OCI tenancy OCID."
  }
}

variable "compartment_ocid" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^ocid1\\.compartment\\.", var.compartment_ocid))
    error_message = "compartment_ocid must be the plenum-staging compartment OCID."
  }
}

variable "region" {
  type    = string
  default = "us-ashburn-1"
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
    error_message = "application_image must use the form registry/repository@sha256:<64 lowercase hex characters>."
  }
}

variable "application_platforms" {
  description = "Platforms that the supplied manifest list has been independently verified to contain."
  type        = set(string)
  default     = ["linux/amd64", "linux/arm64"]
  validation {
    condition     = var.application_platforms == toset(["linux/amd64", "linux/arm64"])
    error_message = "The release contract requires exactly linux/amd64 and linux/arm64."
  }
}

variable "application_release" {
  description = "Human-readable immutable release identifier used for audit tags."
  type        = string
  validation {
    condition     = trimspace(var.application_release) != "" && !contains(["latest", "main", "master"], lower(var.application_release))
    error_message = "application_release must be an immutable release identifier, not a moving label."
  }
}

variable "image_pull_secret_ocid" {
  description = "OCI Vault secret containing the private GHCR username/password JSON contract. Only the OCID enters Terraform."
  type        = string
  validation {
    condition     = can(regex("^ocid1\\.vaultsecret\\.", var.image_pull_secret_ocid))
    error_message = "image_pull_secret_ocid must identify an OCI Vault secret."
  }
}

variable "application_hostname" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$", var.application_hostname))
    error_message = "application_hostname must be a fully-qualified DNS hostname."
  }
}

variable "identity_hostname" {
  description = "Functional-free Keycloak hostname. Production may point OIDC at an institution-managed provider."
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$", var.identity_hostname))
    error_message = "identity_hostname must be a fully-qualified DNS hostname."
  }
}

variable "media_hostname" {
  description = "Functional-free LiveKit hostname."
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$", var.media_hostname))
    error_message = "media_hostname must be a fully-qualified DNS hostname."
  }
}

variable "oidc_issuer" {
  description = "Production OIDC issuer. Leave null for functional-free, where it is derived from identity_hostname."
  type        = string
  default     = null
  nullable    = true
}

variable "media_url" {
  description = "Production LiveKit WebSocket URL. Leave null for functional-free."
  type        = string
  default     = null
  nullable    = true
}

variable "application_contract" {
  description = "Non-secret application configuration shared by both profiles."
  type = object({
    deployment_id             = string
    retention_actor_person_id = string
    oidc_provider_key         = string
    oidc_organization_id      = string
    oidc_client_id            = string
    s3_region                 = string
    media_adapter_digest      = string
  })
  validation {
    condition = alltrue([
      can(regex("^[0-9a-fA-F-]{36}$", var.application_contract.retention_actor_person_id)),
      can(regex("^[0-9a-fA-F-]{36}$", var.application_contract.oidc_organization_id))
    ])
    error_message = "The organization and retention actor identifiers must be UUIDs."
  }
}

variable "functional_test_username" {
  description = "Single staging-only Keycloak user created without a password; the password remains an out-of-band VM secret."
  type        = string
  default     = "plenum-tester"
  validation {
    condition     = can(regex("^[a-z][a-z0-9._-]{2,62}$", var.functional_test_username))
    error_message = "functional_test_username must be a safe lowercase username."
  }
}

variable "admin_cidr" {
  description = "Single trusted administrator CIDR for SSH to functional-free. Never use 0.0.0.0/0."
  type        = string
  default     = null
  nullable    = true
  validation {
    condition     = var.admin_cidr == null || (can(cidrnetmask(var.admin_cidr)) && var.admin_cidr != "0.0.0.0/0" && var.admin_cidr != "::/0")
    error_message = "admin_cidr must be a valid, restricted CIDR and cannot be open to the internet."
  }
}

variable "ssh_authorized_key" {
  description = "Public SSH key for functional-free. This is not a private key or a secret."
  type        = string
  default     = null
  nullable    = true
  validation {
    condition     = var.ssh_authorized_key == null || can(regex("^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256) [A-Za-z0-9+/=]+(?: .*)?$", trimspace(var.ssh_authorized_key)))
    error_message = "ssh_authorized_key must be a valid public SSH key."
  }
}

variable "free_shape" {
  type    = string
  default = "VM.Standard.A1.Flex"
  validation {
    condition     = var.free_shape == "VM.Standard.A1.Flex"
    error_message = "functional-free is locked to the Always Free Ampere A1 shape."
  }
}

variable "free_availability_domain_index" {
  description = "Zero-based availability-domain selector for Always Free A1 capacity retries."
  type        = number
  default     = 0
  validation {
    condition     = contains([0, 1, 2], var.free_availability_domain_index)
    error_message = "free_availability_domain_index must be 0, 1, or 2."
  }
}

variable "free_ocpus" {
  type    = number
  default = 2
  validation {
    condition     = var.free_ocpus > 0 && var.free_ocpus <= 2
    error_message = "free_ocpus must stay within the configured 2 OCPU tenancy safeguard."
  }
}

variable "free_memory_gbs" {
  type    = number
  default = 12
  validation {
    condition     = var.free_memory_gbs > 0 && var.free_memory_gbs <= 12
    error_message = "free_memory_gbs must stay within the configured 12 GB tenancy safeguard."
  }
}

variable "free_boot_volume_gbs" {
  type    = number
  default = 50
  validation {
    condition     = var.free_boot_volume_gbs >= 50 && var.free_boot_volume_gbs <= 200
    error_message = "free_boot_volume_gbs must be between 50 GB and the 200 GB Always Free safeguard."
  }
}

variable "free_public_http_for_acme" {
  description = "Allow port 80 only for Caddy ACME validation and HTTPS redirect."
  type        = bool
  default     = true
}

variable "allow_billable_resources" {
  description = "Explicit stop-review gate. Must be true to plan production-parity resources."
  type        = bool
  default     = false
}

variable "runtime_secret_ocid" {
  description = "OCI Vault secret containing the JSON application secret contract. Secret content never enters Terraform."
  type        = string
  default     = null
  nullable    = true
}

variable "database_password_secret_ocid" {
  description = "OCI Vault secret containing only the managed PostgreSQL administrator password."
  type        = string
  default     = null
  nullable    = true
}

variable "database_password_secret_version" {
  description = "Pinned version number of the managed PostgreSQL password secret."
  type        = number
  default     = 1
  validation {
    condition     = var.database_password_secret_version >= 1 && floor(var.database_password_secret_version) == var.database_password_secret_version
    error_message = "database_password_secret_version must be a positive integer."
  }
}

variable "https_certificate_ocid" {
  description = "OCI Certificates service certificate for application_hostname."
  type        = string
  default     = null
  nullable    = true
}

variable "production_container_shape" {
  type    = string
  default = "CI.Standard.E4.Flex"
}

variable "production_container_ocpus" {
  type    = number
  default = 2
}

variable "production_container_memory_gbs" {
  type    = number
  default = 16
}

variable "production_database_shape" {
  type    = string
  default = "PostgreSQL.VM.Standard.E5.Flex.16GB"
}

variable "production_database_ocpus" {
  type    = number
  default = 1
}

variable "production_database_memory_gbs" {
  type    = number
  default = 16
}

variable "production_database_iops" {
  type    = number
  default = 3000
}

variable "production_database_private_ip" {
  description = "Reserved managed PostgreSQL endpoint inside the database subnet; makes the Vault DATABASE_URL knowable before apply."
  type        = string
  default     = "10.42.20.10"
  validation {
    condition     = can(regex("^10\\.42\\.20\\.(?:[1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$", var.production_database_private_ip))
    error_message = "production_database_private_ip must be inside 10.42.20.0/24."
  }
}

variable "production_lb_min_bandwidth_mbps" {
  type    = number
  default = 10
}

variable "production_lb_max_bandwidth_mbps" {
  type    = number
  default = 10
}
