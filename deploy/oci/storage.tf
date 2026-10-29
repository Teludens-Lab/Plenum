data "oci_objectstorage_namespace" "current" {}

resource "oci_objectstorage_bucket" "plenum" {
  compartment_id        = var.compartment_ocid
  namespace             = data.oci_objectstorage_namespace.current.namespace
  name                  = "${var.name_prefix}-objects"
  access_type           = "NoPublicAccess"
  auto_tiering          = "InfrequentAccess"
  object_events_enabled = false
  storage_tier          = "Standard"
  versioning            = "Enabled"
  freeform_tags         = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}
