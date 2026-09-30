# Uploaded profile photos. Their own bucket rather than a prefix of the site
# bucket: that one is named after the domain, and a dotted bucket name fails
# TLS on the virtual-hosted URL a browser POSTs to. Read through a CloudFront
# distribution on its default domain; users_avatar_upload presigns the writes
# and users_update deletes a replaced photo (common/avatars.py).
resource "aws_s3_bucket" "avatars" {
  bucket = "${var.app_name}-avatars-${local.account_id}"
}

resource "aws_s3_bucket_ownership_controls" "avatars" {
  bucket = aws_s3_bucket.avatars.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "avatars" {
  bucket                  = aws_s3_bucket.avatars.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# SSE-S3, like the site bucket: CloudFront serves these to anyone signed in,
# so a CMK would need a CloudFront grant without protecting anything.
resource "aws_s3_bucket_server_side_encryption_configuration" "avatars" {
  bucket = aws_s3_bucket.avatars.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# The browser POSTs the file straight to S3 from the site or local dev.
resource "aws_s3_bucket_cors_configuration" "avatars" {
  bucket = aws_s3_bucket.avatars.id
  cors_rule {
    allowed_methods = ["POST"]
    allowed_origins = split(",", local.cors_allowed_origins)
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}

resource "aws_cloudfront_origin_access_control" "avatars" {
  name                              = "oac-for-${var.app_name}-avatars"
  description                       = "OAC for ${aws_s3_bucket.avatars.id}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# nosniff among them: an upload's type is pinned by the POST policy, and this
# keeps a browser from second-guessing it.
data "aws_cloudfront_response_headers_policy" "security" {
  name = "Managed-SecurityHeadersPolicy"
}

resource "aws_cloudfront_distribution" "avatars" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.app_name} profile photos"
  web_acl_id      = data.aws_ssm_parameter.shared_cloudfront_waf_arn.value
  price_class     = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.avatars.bucket_regional_domain_name
    origin_id                = "avatars"
    origin_access_control_id = aws_cloudfront_origin_access_control.avatars.id
  }

  # Every upload is a fresh key, so objects never change under a cached copy.
  default_cache_behavior {
    target_origin_id           = "avatars"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id
    viewer_protocol_policy     = "redirect-to-https"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

data "aws_iam_policy_document" "avatars_bucket" {
  statement {
    sid       = "CloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.avatars.arn}/avatars/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.avatars.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "avatars" {
  bucket = aws_s3_bucket.avatars.id
  policy = data.aws_iam_policy_document.avatars_bucket.json
}
