locals {
  is_functional_free   = var.deployment_profile == "functional-free"
  is_production_parity = var.deployment_profile == "production-parity"

  common_tags = {
    "plenum-environment" = "staging"
    "plenum-profile"     = var.deployment_profile
    "plenum-release"     = var.application_release
    "plenum-managed-by"  = "terraform"
  }

  resolved_oidc_issuer = local.is_functional_free ? "https://${var.identity_hostname}/realms/plenum" : coalesce(var.oidc_issuer, "")
  resolved_media_url   = local.is_functional_free ? "wss://${var.media_hostname}" : coalesce(var.media_url, "")

  application_environment = {
    PLENUM_DEPLOYMENT_PROFILE        = "cloud"
    PLENUM_DEPLOYMENT_ID             = var.application_contract.deployment_id
    PLENUM_RETENTION_ACTOR_PERSON_ID = var.application_contract.retention_actor_person_id
    PLENUM_TRUST_PROXY               = "1"
    PORT                             = "8080"
    S3_ENDPOINT                      = "https://${data.oci_objectstorage_namespace.current.namespace}.compat.objectstorage.${var.region}.oraclecloud.com"
    S3_REGION                        = var.application_contract.s3_region
    S3_FORCE_PATH_STYLE              = "1"
    S3_BUCKET                        = oci_objectstorage_bucket.plenum.name
    OIDC_ISSUER                      = local.resolved_oidc_issuer
    OIDC_PROVIDER_KEY                = var.application_contract.oidc_provider_key
    OIDC_ORGANIZATION_ID             = var.application_contract.oidc_organization_id
    OIDC_CLIENT_ID                   = var.application_contract.oidc_client_id
    OIDC_REDIRECT_URI                = "https://${var.application_hostname}/auth/callback"
    MEDIA_URL                        = local.resolved_media_url
    MEDIA_API_URL                    = local.is_functional_free ? "http://media:7880" : replace(local.resolved_media_url, "wss://", "https://")
    MEDIA_ADAPTER_DIGEST             = var.application_contract.media_adapter_digest
  }
}

check "profile_inputs" {
  assert {
    condition     = !local.is_functional_free || (var.admin_cidr != null && var.ssh_authorized_key != null)
    error_message = "functional-free requires admin_cidr and ssh_authorized_key."
  }
  assert {
    condition     = !local.is_production_parity || var.allow_billable_resources
    error_message = "production-parity creates billable services. Set allow_billable_resources=true only after cost review."
  }
  assert {
    condition = !local.is_production_parity || alltrue([
      var.oidc_issuer != null,
      var.media_url != null,
      var.runtime_secret_ocid != null,
      var.database_password_secret_ocid != null,
      var.https_certificate_ocid != null
    ])
    error_message = "production-parity requires managed OIDC/media endpoints and OCI Vault/Certificate OCIDs."
  }
}
