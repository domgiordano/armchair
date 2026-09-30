# dwts.xomware.com, the launch host, 301s to var.domain_name with the path and
# query intact, so old links and group invites keep working. The function
# answers every request; the origin is never reached.

locals {
  legacy_domain_name = "dwts.xomware.com"
}

data "aws_route53_zone" "legacy" {
  name         = "xomware.com"
  private_zone = false
}

resource "aws_acm_certificate" "legacy" {
  domain_name       = local.legacy_domain_name
  validation_method = "DNS"

  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "legacy_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.legacy.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = data.aws_route53_zone.legacy.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "legacy" {
  certificate_arn         = aws_acm_certificate.legacy.arn
  validation_record_fqdns = [for r in aws_route53_record.legacy_cert_validation : r.fqdn]
}

# Query values arrive still percent-encoded, so they are rejoined as-is.
resource "aws_cloudfront_function" "legacy_redirect" {
  name    = "${var.app_name}-legacy-redirect"
  runtime = "cloudfront-js-2.0"
  comment = "301 ${local.legacy_domain_name} to ${var.domain_name}"
  publish = true
  code    = <<-EOF
    function handler(event) {
      var params = event.request.querystring;
      var qs = [];
      for (var key in params) {
        var values = params[key].multiValue || [params[key]];
        for (var i = 0; i < values.length; i++) {
          qs.push(values[i].value === '' ? key : key + '=' + values[i].value);
        }
      }
      var location = 'https://${var.domain_name}' + event.request.uri + (qs.length ? '?' + qs.join('&') : '');
      return {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: { location: { value: location } }
      };
    }
  EOF
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

resource "aws_cloudfront_distribution" "legacy_redirect" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "301 ${local.legacy_domain_name} to ${var.domain_name}"
  aliases         = [local.legacy_domain_name]
  web_acl_id      = data.aws_ssm_parameter.shared_cloudfront_waf_arn.value

  origin {
    domain_name = var.domain_name
    origin_id   = "unused"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id = "unused"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    cache_policy_id  = data.aws_cloudfront_cache_policy.disabled.id

    # allow-all so http:// makes one hop to the new host, not two.
    viewer_protocol_policy = "allow-all"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.legacy_redirect.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.legacy.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_route53_record" "legacy" {
  zone_id = data.aws_route53_zone.legacy.zone_id
  name    = local.legacy_domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.legacy_redirect.domain_name
    zone_id                = aws_cloudfront_distribution.legacy_redirect.hosted_zone_id
    evaluate_target_health = false
  }
}
