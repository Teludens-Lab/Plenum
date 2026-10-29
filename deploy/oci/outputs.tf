output "deployment_profile" {
  value = var.deployment_profile
}

output "application_release" {
  value = {
    release   = var.application_release
    image     = var.application_image
    platforms = sort(tolist(var.application_platforms))
  }
}

output "public_url" {
  value = "https://${var.application_hostname}"
}

output "functional_free_public_ip" {
  value = local.is_functional_free ? oci_core_instance.functional_free[0].public_ip : null
}

output "production_load_balancer_ip" {
  value = local.is_production_parity ? oci_load_balancer_load_balancer.production[0].ip_address_details[0].ip_address : null
}

output "object_storage_bucket" {
  value = oci_objectstorage_bucket.plenum.name
}

output "production_database_endpoint" {
  description = "Use this private endpoint when preparing the out-of-band runtime secret bundle."
  value       = local.is_production_parity ? var.production_database_private_ip : null
}

output "cost_guard" {
  value = {
    always_free_targeted       = local.is_functional_free
    billable_resources_enabled = local.is_production_parity && var.allow_billable_resources
    production_prevent_destroy = local.is_production_parity
  }
}
