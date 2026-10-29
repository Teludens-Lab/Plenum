resource "oci_psql_db_system" "production" {
  count                       = local.is_production_parity ? 1 : 0
  compartment_id              = var.compartment_ocid
  db_version                  = "18"
  display_name                = "${var.name_prefix}-postgresql"
  description                 = "Managed PostgreSQL for the Plenum production-parity profile"
  shape                       = var.production_database_shape
  instance_count              = 1
  instance_ocpu_count         = var.production_database_ocpus
  instance_memory_size_in_gbs = var.production_database_memory_gbs
  freeform_tags               = merge(local.common_tags, { "plenum-cost-class" = "billable" })

  credentials {
    username = "plenum_admin"
    password_details {
      password_type  = "VAULT_SECRET"
      secret_id      = var.database_password_secret_ocid
      secret_version = var.database_password_secret_version
    }
  }

  network_details {
    subnet_id                      = oci_core_subnet.database[0].id
    nsg_ids                        = [oci_core_network_security_group.database[0].id]
    primary_db_endpoint_private_ip = var.production_database_private_ip
    is_reader_endpoint_enabled     = false
  }

  storage_details {
    availability_domain   = data.oci_identity_availability_domains.current.availability_domains[0].name
    is_regionally_durable = false
    system_type           = "OCI_OPTIMIZED_STORAGE"
    iops                  = var.production_database_iops
  }

  management_policy {
    backup_policy {
      kind           = "DAILY"
      backup_start   = "02:00"
      retention_days = 14
    }
    pitr_policy {
      kind         = "STANDARD"
      restore_days = 14
    }
  }

  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.allow_billable_resources
      error_message = "Managed PostgreSQL is billable and requires allow_billable_resources=true."
    }
  }
}

resource "oci_container_instances_container_instance" "application" {
  count                                = local.is_production_parity ? 1 : 0
  availability_domain                  = data.oci_identity_availability_domains.current.availability_domains[0].name
  compartment_id                       = var.compartment_ocid
  display_name                         = "${var.name_prefix}-application"
  shape                                = var.production_container_shape
  container_restart_policy             = "ALWAYS"
  graceful_shutdown_timeout_in_seconds = 60
  freeform_tags                        = merge(local.common_tags, { "plenum-cost-class" = "billable" })

  shape_config {
    ocpus         = var.production_container_ocpus
    memory_in_gbs = var.production_container_memory_gbs
  }

  vnics {
    subnet_id             = oci_core_subnet.application[0].id
    nsg_ids               = [oci_core_network_security_group.application[0].id]
    is_public_ip_assigned = false
    display_name          = "${var.name_prefix}-application"
    hostname_label        = "plenum"
  }

  image_pull_secrets {
    secret_type       = "VAULT"
    registry_endpoint = "ghcr.io"
    secret_id         = var.image_pull_secret_ocid
  }

  containers {
    image_url                      = var.application_image
    display_name                   = "plenum-platform"
    environment_variables          = merge(local.application_environment, { PLENUM_SECRET_BUNDLE_OCID = var.runtime_secret_ocid })
    is_resource_principal_disabled = false

    resource_config {
      memory_limit_in_gbs = var.production_container_memory_gbs
      vcpus_limit         = var.production_container_ocpus * 2
    }

    security_context {
      is_non_root_user_check_enabled = true
      is_root_file_system_readonly   = true
      run_as_user                    = 65532
      run_as_group                   = 65532
      security_context_type          = "LINUX"
      capabilities {
        drop_capabilities = ["ALL"]
      }
    }

    health_checks {
      name                     = "plenum-readiness"
      health_check_type        = "HTTP"
      path                     = "/healthz"
      port                     = 8080
      initial_delay_in_seconds = 60
      interval_in_seconds      = 30
      timeout_in_seconds       = 10
      failure_threshold        = 3
      success_threshold        = 1
      failure_action           = "KILL"
    }
  }

  lifecycle {
    precondition {
      condition     = var.allow_billable_resources
      error_message = "Managed containers are billable and require allow_billable_resources=true."
    }
    precondition {
      condition     = can(regex("^ocid1\\.vaultsecret\\.", var.runtime_secret_ocid))
      error_message = "runtime_secret_ocid must identify an OCI Vault secret."
    }
  }

  depends_on = [oci_psql_db_system.production]
}

data "oci_core_vnic" "application" {
  count   = local.is_production_parity ? 1 : 0
  vnic_id = oci_container_instances_container_instance.application[0].vnics[0].vnic_id
}

resource "oci_load_balancer_load_balancer" "production" {
  count                        = local.is_production_parity ? 1 : 0
  compartment_id               = var.compartment_ocid
  display_name                 = "${var.name_prefix}-https"
  shape                        = "flexible"
  subnet_ids                   = [oci_core_subnet.public.id]
  network_security_group_ids   = [oci_core_network_security_group.edge.id]
  is_private                   = false
  is_delete_protection_enabled = true
  freeform_tags                = merge(local.common_tags, { "plenum-cost-class" = "billable" })

  shape_details {
    minimum_bandwidth_in_mbps = var.production_lb_min_bandwidth_mbps
    maximum_bandwidth_in_mbps = var.production_lb_max_bandwidth_mbps
  }

  lifecycle {
    precondition {
      condition     = var.allow_billable_resources
      error_message = "The flexible load balancer is billable and requires allow_billable_resources=true."
    }
  }
}

resource "oci_load_balancer_backend_set" "application" {
  count            = local.is_production_parity ? 1 : 0
  load_balancer_id = oci_load_balancer_load_balancer.production[0].id
  name             = "plenum-application"
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol          = "HTTP"
    port              = 8080
    url_path          = "/healthz"
    return_code       = 200
    retries           = 3
    timeout_in_millis = 5000
    interval_ms       = 10000
  }
}

resource "oci_load_balancer_backend" "application" {
  count            = local.is_production_parity ? 1 : 0
  load_balancer_id = oci_load_balancer_load_balancer.production[0].id
  backendset_name  = oci_load_balancer_backend_set.application[0].name
  ip_address       = data.oci_core_vnic.application[0].private_ip_address
  port             = 8080
  weight           = 1
  backup           = false
  drain            = false
  offline          = false
}

resource "oci_load_balancer_listener" "https" {
  count                    = local.is_production_parity ? 1 : 0
  load_balancer_id         = oci_load_balancer_load_balancer.production[0].id
  name                     = "https"
  default_backend_set_name = oci_load_balancer_backend_set.application[0].name
  port                     = 443
  protocol                 = "HTTP"

  ssl_configuration {
    certificate_ids         = [var.https_certificate_ocid]
    protocols               = ["TLSv1.2"]
    server_order_preference = "ENABLED"
    verify_peer_certificate = false
  }
}
