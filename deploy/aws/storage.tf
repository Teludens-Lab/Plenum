data "aws_caller_identity" "current" {}

data "aws_iam_role" "runtime" {
  name = var.runtime_instance_profile_name
}

locals {
  object_bucket_name = "${var.name_prefix}-objects-${data.aws_caller_identity.current.account_id}-${var.region}"
}

resource "aws_s3_bucket" "objects" {
  bucket        = local.object_bucket_name
  force_destroy = false

  tags = { Name = local.object_bucket_name }
}

resource "aws_s3_bucket_public_access_block" "objects" {
  bucket = aws_s3_bucket.objects.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "objects" {
  bucket = aws_s3_bucket.objects.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "objects" {
  bucket = aws_s3_bucket.objects.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = false
  }
}

resource "aws_s3_bucket_versioning" "objects" {
  bucket = aws_s3_bucket.objects.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "objects" {
  bucket = aws_s3_bucket.objects.id

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  rule {
    id     = "expire-noncurrent-versions-after-30-days"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  # All transient audio writers must use this namespace. With S3's midnight
  # UTC rounding, a one-day rule makes objects eligible after roughly 24-48h.
  rule {
    id     = "expire-transient-audio-after-one-day"
    status = "Enabled"

    filter {
      prefix = "transient-audio/"
    }

    expiration {
      days = 1
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }

  rule {
    id     = "remove-expired-transient-audio-delete-markers"
    status = "Enabled"

    filter {
      prefix = "transient-audio/"
    }

    expiration {
      expired_object_delete_marker = true
    }
  }
}

resource "aws_s3_bucket_policy" "objects" {
  bucket = aws_s3_bucket.objects.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.objects.arn,
          "${aws_s3_bucket.objects.arn}/*"
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
      {
        Sid       = "AllowRuntimeBucketReadiness"
        Effect    = "Allow"
        Principal = { AWS = data.aws_iam_role.runtime.arn }
        Action    = ["s3:ListBucket"]
        Resource  = aws_s3_bucket.objects.arn
      },
      {
        Sid       = "AllowRuntimeObjectLifecycle"
        Effect    = "Allow"
        Principal = { AWS = data.aws_iam_role.runtime.arn }
        Action = [
          "s3:DeleteObject",
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.objects.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.objects]
}
