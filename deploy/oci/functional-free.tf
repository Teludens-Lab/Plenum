data "oci_identity_availability_domains" "current" {
  compartment_id = var.tenancy_ocid
}

data "oci_core_images" "oracle_linux_arm" {
  compartment_id           = var.tenancy_ocid
  operating_system         = "Oracle Linux"
  operating_system_version = "9"
  shape                    = var.free_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

locals {
  free_compose = templatefile("${path.module}/runtime/compose.functional-free.yaml.tftpl", {
    application_image    = var.application_image
    application_hostname = var.application_hostname
    identity_hostname    = var.identity_hostname
    media_hostname       = var.media_hostname
    notifications_hostname = var.notifications_hostname
    environment          = local.application_environment
    organization_id      = var.application_contract.oidc_organization_id
    person_id            = var.application_contract.retention_actor_person_id
    oidc_issuer          = local.resolved_oidc_issuer
    test_username        = var.functional_test_username
  })
  free_caddyfile = templatefile("${path.module}/runtime/Caddyfile.tftpl", {
    application_hostname   = var.application_hostname
    identity_hostname      = var.identity_hostname
    media_hostname         = var.media_hostname
    notifications_hostname = var.notifications_hostname
  })
  free_realm = templatefile("${path.module}/runtime/realm-plenum.json.tftpl", {
    application_hostname = var.application_hostname
    oidc_client_id       = var.application_contract.oidc_client_id
    test_user_id         = var.application_contract.retention_actor_person_id
    test_username        = var.functional_test_username
  })
  free_cloud_init = templatefile("${path.module}/cloud-init/functional-free.yaml.tftpl", {
    application_image      = var.application_image
    image_pull_secret_ocid = var.image_pull_secret_ocid
    private_image_pull     = file("${path.module}/runtime/private-image-pull.py")
    compose_content        = local.free_compose
    caddy_content          = local.free_caddyfile
    realm_content          = local.free_realm
    livekit_content        = file("${path.module}/runtime/livekit.yaml")
  })
}

resource "oci_core_instance" "functional_free" {
  count               = local.is_functional_free ? 1 : 0
  availability_domain = data.oci_identity_availability_domains.current.availability_domains[var.free_availability_domain_index].name
  compartment_id      = var.compartment_ocid
  display_name        = "${var.name_prefix}-functional-free"
  shape               = var.free_shape
  freeform_tags       = merge(local.common_tags, { "plenum-cost-class" = "always-free-target" })

  shape_config {
    ocpus         = var.free_ocpus
    memory_in_gbs = var.free_memory_gbs
  }

  create_vnic_details {
    assign_public_ip = true
    display_name     = "${var.name_prefix}-functional-free"
    hostname_label   = "staging"
    nsg_ids          = [oci_core_network_security_group.edge.id]
    subnet_id        = oci_core_subnet.public.id
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.oracle_linux_arm.images[0].id
    boot_volume_size_in_gbs = var.free_boot_volume_gbs
    boot_volume_vpus_per_gb = 10
  }

  instance_options {
    are_legacy_imds_endpoints_disabled = true
  }

  metadata = {
    ssh_authorized_keys = trimspace(var.ssh_authorized_key)
    user_data           = base64encode(local.free_cloud_init)
  }

  lifecycle {
    precondition {
      condition     = var.free_shape == "VM.Standard.A1.Flex" && var.free_ocpus <= 2 && var.free_memory_gbs <= 12 && var.free_boot_volume_gbs <= 200
      error_message = "The functional-free VM exceeds this package's explicit Always Free ceilings."
    }
    precondition {
      condition     = length(data.oci_core_images.oracle_linux_arm.images) > 0
      error_message = "No compatible Oracle Linux 9 Ampere image was found in this region."
    }
  }
}
