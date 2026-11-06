resource "aws_vpc" "plenum" {
  cidr_block           = "10.43.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.name_prefix}-vpc" }
}

resource "aws_internet_gateway" "public" {
  vpc_id = aws_vpc.plenum.id
  tags   = { Name = "${var.name_prefix}-internet" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.plenum.id
  cidr_block              = "10.43.0.0/24"
  map_public_ip_on_launch = false
  availability_zone       = "${var.region}a"

  tags = { Name = "${var.name_prefix}-public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.plenum.id
  tags   = { Name = "${var.name_prefix}-public-routes" }
}

resource "aws_route" "public_ipv4" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.public.id
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "edge" {
  name_prefix            = "${var.name_prefix}-edge-"
  description            = "Plenum staging HTTPS and LiveKit media; no SSH ingress"
  vpc_id                 = aws_vpc.plenum.id
  revoke_rules_on_delete = true

  tags = { Name = "${var.name_prefix}-edge" }
}

resource "aws_vpc_security_group_ingress_rule" "http_acme" {
  security_group_id = aws_security_group.edge.id
  description       = "ACME validation and HTTPS redirect"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.edge.id
  description       = "Public HTTPS"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "livekit_tcp" {
  security_group_id = aws_security_group.edge.id
  description       = "LiveKit RTC over TCP"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 7881
  to_port           = 7881
}

resource "aws_vpc_security_group_ingress_rule" "livekit_udp" {
  security_group_id = aws_security_group.edge.id
  description       = "LiveKit RTC UDP range"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "udp"
  from_port         = 50000
  to_port           = 50100
}

resource "aws_vpc_security_group_egress_rule" "all_ipv4" {
  security_group_id = aws_security_group.edge.id
  description       = "Runtime dependency and update egress"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}
