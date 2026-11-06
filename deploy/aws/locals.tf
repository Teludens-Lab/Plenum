locals {
  common_tags = {
    "plenum-environment" = "staging"
    "plenum-profile"     = var.deployment_profile
    "plenum-release"     = var.application_release
    "plenum-managed-by"  = "terraform"
    "plenum-cost-class"  = "free-plan-credit-funded"
  }

  oidc_issuer = "https://${var.identity_hostname}/realms/plenum"
  media_url   = "wss://${var.media_hostname}"

  application_environment = {
    PLENUM_DEPLOYMENT_PROFILE        = "cloud"
    PLENUM_DEPLOYMENT_ID             = var.application_contract.deployment_id
    PLENUM_RETENTION_ACTOR_PERSON_ID = var.application_contract.retention_actor_person_id
    PLENUM_TRUST_PROXY               = "1"
    PORT                             = "8080"
    S3_REGION                        = var.region
    S3_FORCE_PATH_STYLE              = "0"
    S3_BUCKET                        = aws_s3_bucket.objects.id
    OIDC_ISSUER                      = local.oidc_issuer
    OIDC_PROVIDER_KEY                = var.application_contract.oidc_provider_key
    OIDC_ORGANIZATION_ID             = var.application_contract.oidc_organization_id
    OIDC_CLIENT_ID                   = var.application_contract.oidc_client_id
    OIDC_REDIRECT_URI                = "https://${var.application_hostname}/auth/callback"
    MEDIA_URL                        = local.media_url
    MEDIA_API_URL                    = replace(local.media_url, "wss://", "https://")
    MEDIA_ADAPTER_DIGEST             = var.application_contract.media_adapter_digest
    PLENUM_PUBLIC_BASE_URL           = "https://${var.application_hostname}"
    INVITATION_DELIVERY_ENDPOINT     = var.application_contract.invitation_delivery_endpoint
    NOTIFICATIONS_HOSTNAME           = var.notifications_hostname
  }

  compose_content = templatefile("${path.module}/../oci/runtime/compose.functional-free.yaml.tftpl", {
    application_image      = var.application_image
    application_hostname   = var.application_hostname
    identity_hostname      = var.identity_hostname
    media_hostname         = var.media_hostname
    notifications_hostname = var.notifications_hostname
    person_id              = var.application_contract.retention_actor_person_id
    organization_id        = var.application_contract.oidc_organization_id
    test_username          = var.functional_test_username
    oidc_issuer            = local.oidc_issuer
    environment            = local.application_environment
  })

  caddy_content = templatefile("${path.module}/../oci/runtime/Caddyfile.tftpl", {
    application_hostname   = var.application_hostname
    identity_hostname      = var.identity_hostname
    media_hostname         = var.media_hostname
    notifications_hostname = var.notifications_hostname
  })

  realm_content = templatefile("${path.module}/../oci/runtime/realm-plenum.json.tftpl", {
    test_user_id         = var.application_contract.retention_actor_person_id
    test_username        = var.functional_test_username
    oidc_client_id       = var.application_contract.oidc_client_id
    application_hostname = var.application_hostname
  })

  fetch_secrets = templatefile("${path.module}/runtime/fetch-secrets.sh.tftpl", {
    region           = var.region
    parameter_prefix = var.ssm_parameter_prefix
  })

  private_image_pull = templatefile("${path.module}/runtime/private-image-pull.sh.tftpl", {
    region                  = var.region
    registry_parameter_name = "${var.ssm_parameter_prefix}/registry"
  })

  user_data = templatefile("${path.module}/cloud-init/staging.yaml.tftpl", {
    compose_content    = local.compose_content
    caddy_content      = local.caddy_content
    realm_content      = local.realm_content
    livekit_content    = file("${path.module}/../oci/runtime/livekit.yaml")
    fetch_secrets      = local.fetch_secrets
    private_image_pull = local.private_image_pull
    application_image  = var.application_image
  })
}
