mock_provider "oci" {
  mock_data "oci_identity_availability_domains" {
    defaults = {
      availability_domains = [{ name = "iad:US-ASHBURN-AD-1" }]
    }
  }

  mock_data "oci_core_images" {
    defaults = {
      images = [{ id = "ocid1.image.oc1.iad.mock" }]
    }
  }

  mock_data "oci_objectstorage_namespace" {
    defaults = {
      namespace = "plenumtest"
    }
  }

  mock_data "oci_core_vnic" {
    defaults = {
      private_ip_address = "10.42.10.10"
    }
  }
}

variables {
  tenancy_ocid           = "ocid1.tenancy.oc1..mock"
  compartment_ocid       = "ocid1.compartment.oc1..mock"
  region                 = "us-ashburn-1"
  application_image      = "ghcr.io/teludens-lab/plenum@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  application_release    = "plenum-test-0.1.0"
  image_pull_secret_ocid = "ocid1.vaultsecret.oc1.iad.mockregistry"
  application_hostname   = "staging.plenum.example"
  identity_hostname      = "identity.staging.plenum.example"
  media_hostname         = "media.staging.plenum.example"
  notifications_hostname = "notifications.staging.plenum.example"
  application_contract = {
    deployment_id                = "00000000-0000-4000-8000-000000000003"
    retention_actor_person_id    = "00000000-0000-4000-8000-000000000001"
    oidc_provider_key            = "plenum-staging"
    oidc_organization_id         = "00000000-0000-4000-8000-000000000002"
    oidc_client_id               = "plenum"
    s3_region                    = "us-ashburn-1"
    media_adapter_digest         = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    invitation_delivery_endpoint = "https://notifications.staging.plenum.example/v1/messages"
  }
}

run "functional_free_plan" {
  command = plan

  variables {
    deployment_profile = "functional-free"
    admin_cidr         = "203.0.113.10/32"
    ssh_authorized_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMockPublicKeyMaterialOnlyForTerraformPlan"
  }

  assert {
    condition     = length(oci_core_instance.functional_free) == 1
    error_message = "functional-free must plan exactly one A1 VM."
  }

  assert {
    condition     = oci_core_instance.functional_free[0].shape == "VM.Standard.A1.Flex"
    error_message = "functional-free must use the Always Free-targeted Ampere shape."
  }

  assert {
    condition     = length(oci_container_instances_container_instance.application) == 0 && length(oci_psql_db_system.production) == 0
    error_message = "functional-free must not plan managed billable compute or PostgreSQL."
  }

  assert {
    condition     = output.cost_guard.always_free_targeted && !output.cost_guard.billable_resources_enabled
    error_message = "functional-free cost guard must remain closed to billable resources."
  }

  assert {
    condition = (
      strcontains(base64decode(oci_core_instance.functional_free[0].metadata.user_data), "--auth") &&
      strcontains(base64decode(oci_core_instance.functional_free[0].metadata.user_data), "instance_principal") &&
      strcontains(base64decode(oci_core_instance.functional_free[0].metadata.user_data), var.image_pull_secret_ocid)
    )
    error_message = "functional-free must retrieve the private-image credential from OCI Vault through its instance principal."
  }
}

run "production_parity_plan" {
  command = plan

  variables {
    deployment_profile               = "production-parity"
    allow_billable_resources         = true
    oidc_issuer                      = "https://identity.example/realms/plenum"
    media_url                        = "wss://media.example"
    runtime_secret_ocid              = "ocid1.vaultsecret.oc1.iad.mock"
    database_password_secret_ocid    = "ocid1.vaultsecret.oc1.iad.mockdb"
    database_password_secret_version = 1
    https_certificate_ocid           = "ocid1.certificate.oc1.iad.mock"
  }

  assert {
    condition = (
      length(oci_container_instances_container_instance.application) == 1 &&
      length(oci_psql_db_system.production) == 1 &&
      length(oci_load_balancer_listener.https) == 1
    )
    error_message = "production-parity must plan managed containers, PostgreSQL, and HTTPS ingress."
  }

  assert {
    condition     = !oci_container_instances_container_instance.application[0].vnics[0].is_public_ip_assigned
    error_message = "The production application container must remain private."
  }

  assert {
    condition     = oci_container_instances_container_instance.application[0].containers[0].image_url == var.application_image
    error_message = "Production must use the shared immutable application image."
  }

  assert {
    condition = (
      oci_container_instances_container_instance.application[0].image_pull_secrets[0].secret_type == "VAULT" &&
      oci_container_instances_container_instance.application[0].image_pull_secrets[0].registry_endpoint == "ghcr.io" &&
      oci_container_instances_container_instance.application[0].image_pull_secrets[0].secret_id == var.image_pull_secret_ocid
    )
    error_message = "Production must pull the private GHCR image through an OCI Vault image-pull secret."
  }

  assert {
    condition     = output.cost_guard.billable_resources_enabled
    error_message = "The production plan must visibly acknowledge billable resources."
  }
}
