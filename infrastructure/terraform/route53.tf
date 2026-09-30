data "aws_route53_zone" "web_zone" {
  name         = var.route53_zone_name
  private_zone = false
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.web_zone.zone_id
  name    = local.api_domain_name
  type    = "A"

  alias {
    name                   = module.api.domain_regional_domain_name
    zone_id                = module.api.domain_regional_zone_id
    evaluate_target_health = false
  }
}

# Created by the domain registration, not by Terraform. Read only.
data "aws_route53_zone" "hub_zone" {
  name         = var.hub_domain_name
  private_zone = false
}

# Google Search Console domain verification, required for the OAuth consent
# screen to show Armchair Judge's branding. Created by hand first so Dom could
# verify immediately; the import adopts it.
import {
  to = aws_route53_record.google_site_verification
  id = "Z0279759OM4WDKB0TGYQ_armchairjudge.com_TXT"
}

resource "aws_route53_record" "google_site_verification" {
  zone_id = data.aws_route53_zone.hub_zone.zone_id
  name    = var.hub_domain_name
  type    = "TXT"
  ttl     = 300
  records = ["google-site-verification=-cc5WijEUV0S5w8PJjHw_BUPWLtkf3JpIPvnoeh5xis"]
}
