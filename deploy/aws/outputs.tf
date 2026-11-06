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

output "instance_id" {
  value = aws_instance.plenum.id
}

output "public_ipv4" {
  value = aws_eip.public.public_ip
}

output "public_url" {
  value = "https://${var.application_hostname}"
}

output "object_bucket" {
  description = "Private regional S3 bucket used by the EC2 runtime role."
  value       = aws_s3_bucket.objects.id
}

output "required_parameter_names" {
  description = "Create these as SSM SecureString values outside Terraform. Values never enter state."
  value = [
    "${var.ssm_parameter_prefix}/application",
    "${var.ssm_parameter_prefix}/postgres-password",
    "${var.ssm_parameter_prefix}/keycloak-admin-password",
    "${var.ssm_parameter_prefix}/test-user-password",
    "${var.ssm_parameter_prefix}/livekit-keys",
    "${var.ssm_parameter_prefix}/operations",
    "${var.ssm_parameter_prefix}/registry"
  ]
}

output "cost_guard" {
  value = {
    free_account_plan               = true
    credit_funded_resources         = var.acknowledge_credit_funded_resources
    fixed_performance_instance      = var.instance_type
    encrypted_root_volume_gbs       = var.root_volume_gbs
    public_ipv4_hourly_cost_applies = true
    apply_wrapper_present           = false
  }
}
