# S3 + CloudFront + ACM + Route53 for var.domain_name. The bucket uses SSE-S3:
# it holds only the public static bundle, so a CMK would add a KMS grant for
# CloudFront and the deploy role without protecting anything.
module "web" {
  source = "git::https://github.com/domgiordano/web-hosting.git?ref=v1.8.0"

  app_name    = var.app_name
  domain_name = var.domain_name
  zone_id     = data.aws_route53_zone.web_zone.zone_id
  waf_acl_arn = data.aws_ssm_parameter.shared_cloudfront_waf_arn.value

  # Required for a trailingSlash static export. CloudFront's default root
  # object applies to "/" only, so without the rewrite every deep route falls
  # through to the SPA error path and serves the home page with a 200.
  enable_subroute_rewrite = true
  subroute_style          = "directory"

  spa_error_path      = "/index.html"
  enable_cache        = true
  minimum_tls_version = "TLSv1.2_2021"
  retain_on_delete    = false
}

# The Armchair Judge hub (hub/) on the apex of its own domain. The module
# names its OAC, function and header policy after app_name, so this instance
# needs its own.
module "hub" {
  source = "git::https://github.com/domgiordano/web-hosting.git?ref=v1.8.0"

  app_name    = "${var.app_name}-hub"
  domain_name = var.hub_domain_name
  zone_id     = data.aws_route53_zone.hub_zone.zone_id
  waf_acl_arn = data.aws_ssm_parameter.shared_cloudfront_waf_arn.value

  # www is on the cert and distribution too; the viewer-request function
  # 301s it to the apex.
  subject_alternative_names = ["www.${var.hub_domain_name}"]
  canonical_host            = var.hub_domain_name

  enable_subroute_rewrite = true
  subroute_style          = "directory"
  spa_error_path          = "/404.html"
  spa_error_response_code = 404

  enable_cache        = true
  minimum_tls_version = "TLSv1.2_2021"
  retain_on_delete    = false
}

# The Traitors companion (traitors/). Its own app_name for the same reason as
# the hub's.
module "traitors" {
  source = "git::https://github.com/domgiordano/web-hosting.git?ref=v1.8.0"

  app_name    = "${var.app_name}-traitors"
  domain_name = var.traitors_domain_name
  zone_id     = data.aws_route53_zone.hub_zone.zone_id
  waf_acl_arn = data.aws_ssm_parameter.shared_cloudfront_waf_arn.value

  enable_subroute_rewrite = true
  subroute_style          = "directory"
  spa_error_path          = "/404.html"
  spa_error_response_code = 404

  enable_cache        = true
  minimum_tls_version = "TLSv1.2_2021"
  retain_on_delete    = false
}
