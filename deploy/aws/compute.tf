data "aws_ami" "ubuntu_amd64" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

data "aws_iam_instance_profile" "runtime" {
  name = var.runtime_instance_profile_name
}

resource "aws_instance" "plenum" {
  ami                         = data.aws_ami.ubuntu_amd64.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.edge.id]
  iam_instance_profile        = data.aws_iam_instance_profile.runtime.name
  associate_public_ip_address = false
  monitoring                  = false
  user_data_base64            = base64gzip(local.user_data)
  user_data_replace_on_change = false

  metadata_options {
    http_endpoint               = "enabled"
    http_protocol_ipv6          = "disabled"
    http_put_response_hop_limit = 2
    http_tokens                 = "required"
    instance_metadata_tags      = "disabled"
  }

  root_block_device {
    encrypted             = true
    delete_on_termination = true
    volume_type           = "gp3"
    volume_size           = var.root_volume_gbs
  }

  tags = { Name = "${var.name_prefix}-host" }

  lifecycle {
    # Cloud-init is bootstrap-only after first creation. The imported host also
    # reports its launch-time automatic-public-IP flag differently from the
    # desired EIP-only network contract. Both immutable attributes are frozen;
    # runtime updates use the reviewed in-place Session Manager procedure.
    ignore_changes = [
      associate_public_ip_address,
      user_data,
      user_data_base64
    ]

    precondition {
      condition     = var.instance_type == "m7i-flex.large" && var.root_volume_gbs == 50
      error_message = "The staging host exceeds the reviewed shape or storage ceiling."
    }
  }
}

resource "aws_eip" "public" {
  domain   = "vpc"
  instance = aws_instance.plenum.id

  tags       = { Name = "${var.name_prefix}-public-ip" }
  depends_on = [aws_internet_gateway.public]
}
