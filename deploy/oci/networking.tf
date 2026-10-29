resource "oci_core_vcn" "plenum" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.42.0.0/16"]
  display_name   = "${var.name_prefix}-vcn"
  dns_label      = "plenum"
  freeform_tags  = local.common_tags
}

resource "oci_core_internet_gateway" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.plenum.id
  display_name   = "${var.name_prefix}-internet"
  enabled        = true
  freeform_tags  = local.common_tags
}

resource "oci_core_nat_gateway" "production" {
  count          = local.is_production_parity ? 1 : 0
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.plenum.id
  display_name   = "${var.name_prefix}-nat"
  freeform_tags  = merge(local.common_tags, { "plenum-cost-class" = "billable" })

  lifecycle {
    precondition {
      condition     = var.allow_billable_resources
      error_message = "The production NAT gateway requires allow_billable_resources=true."
    }
  }
}

resource "oci_core_route_table" "public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.plenum.id
  display_name   = "${var.name_prefix}-public-routes"
  freeform_tags  = local.common_tags
  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.public.id
  }
}

resource "oci_core_route_table" "private" {
  count          = local.is_production_parity ? 1 : 0
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.plenum.id
  display_name   = "${var.name_prefix}-private-routes"
  freeform_tags  = local.common_tags
  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_nat_gateway.production[0].id
  }
}

resource "oci_core_security_list" "empty" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.plenum.id
  display_name   = "${var.name_prefix}-nsg-only"
  freeform_tags  = local.common_tags
}

resource "oci_core_subnet" "public" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.plenum.id
  cidr_block                 = "10.42.0.0/24"
  display_name               = "${var.name_prefix}-public"
  dns_label                  = "public"
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_security_list.empty.id]
  prohibit_public_ip_on_vnic = false
  freeform_tags              = local.common_tags
}

resource "oci_core_subnet" "application" {
  count                      = local.is_production_parity ? 1 : 0
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.plenum.id
  cidr_block                 = "10.42.10.0/24"
  display_name               = "${var.name_prefix}-application"
  dns_label                  = "app"
  route_table_id             = oci_core_route_table.private[0].id
  security_list_ids          = [oci_core_security_list.empty.id]
  prohibit_public_ip_on_vnic = true
  freeform_tags              = local.common_tags
}

resource "oci_core_subnet" "database" {
  count                      = local.is_production_parity ? 1 : 0
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.plenum.id
  cidr_block                 = "10.42.20.0/24"
  display_name               = "${var.name_prefix}-database"
  dns_label                  = "db"
  route_table_id             = oci_core_route_table.private[0].id
  security_list_ids          = [oci_core_security_list.empty.id]
  prohibit_public_ip_on_vnic = true
  freeform_tags              = local.common_tags
}

resource "oci_core_network_security_group" "edge" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.plenum.id
  display_name   = "${var.name_prefix}-edge"
  freeform_tags  = local.common_tags
}

resource "oci_core_network_security_group_security_rule" "edge_https" {
  network_security_group_id = oci_core_network_security_group.edge.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "Public HTTPS"
  tcp_options {
    destination_port_range {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_network_security_group_security_rule" "edge_http_acme" {
  count                     = local.is_functional_free && var.free_public_http_for_acme ? 1 : 0
  network_security_group_id = oci_core_network_security_group.edge.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "ACME validation and redirect to HTTPS only"
  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

resource "oci_core_network_security_group_security_rule" "free_ssh" {
  count                     = local.is_functional_free ? 1 : 0
  network_security_group_id = oci_core_network_security_group.edge.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = var.admin_cidr
  source_type               = "CIDR_BLOCK"
  description               = "Restricted staging administration"
  tcp_options {
    destination_port_range {
      min = 22
      max = 22
    }
  }
}

resource "oci_core_network_security_group_security_rule" "free_livekit_udp" {
  count                     = local.is_functional_free ? 1 : 0
  network_security_group_id = oci_core_network_security_group.edge.id
  direction                 = "INGRESS"
  protocol                  = "17"
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "LiveKit WebRTC media range"
  udp_options {
    destination_port_range {
      min = 50000
      max = 50100
    }
  }
}

resource "oci_core_network_security_group_security_rule" "free_livekit_tcp" {
  count                     = local.is_functional_free ? 1 : 0
  network_security_group_id = oci_core_network_security_group.edge.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  description               = "LiveKit WebRTC TCP fallback"
  tcp_options {
    destination_port_range {
      min = 7881
      max = 7881
    }
  }
}

resource "oci_core_network_security_group" "application" {
  count          = local.is_production_parity ? 1 : 0
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.plenum.id
  display_name   = "${var.name_prefix}-application"
  freeform_tags  = local.common_tags
}

resource "oci_core_network_security_group_security_rule" "load_balancer_to_application" {
  count                     = local.is_production_parity ? 1 : 0
  network_security_group_id = oci_core_network_security_group.application[0].id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = oci_core_network_security_group.edge.id
  source_type               = "NETWORK_SECURITY_GROUP"
  description               = "HTTPS load balancer to Plenum application"
  tcp_options {
    destination_port_range {
      min = 8080
      max = 8080
    }
  }
}

resource "oci_core_network_security_group" "database" {
  count          = local.is_production_parity ? 1 : 0
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.plenum.id
  display_name   = "${var.name_prefix}-database"
  freeform_tags  = local.common_tags
}

resource "oci_core_network_security_group_security_rule" "application_to_database" {
  count                     = local.is_production_parity ? 1 : 0
  network_security_group_id = oci_core_network_security_group.database[0].id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = oci_core_network_security_group.application[0].id
  source_type               = "NETWORK_SECURITY_GROUP"
  description               = "Plenum application to managed PostgreSQL"
  tcp_options {
    destination_port_range {
      min = 5432
      max = 5432
    }
  }
}

resource "oci_core_network_security_group_security_rule" "edge_egress" {
  network_security_group_id = oci_core_network_security_group.edge.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  description               = "Required outbound dependency access"
}

resource "oci_core_network_security_group_security_rule" "application_egress" {
  count                     = local.is_production_parity ? 1 : 0
  network_security_group_id = oci_core_network_security_group.application[0].id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  description               = "OIDC, object storage, media, Vault, and PostgreSQL"
}

resource "oci_core_network_security_group_security_rule" "database_egress" {
  count                     = local.is_production_parity ? 1 : 0
  network_security_group_id = oci_core_network_security_group.database[0].id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  description               = "Managed database service control and backup traffic"
}
