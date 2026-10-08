# Email for every show app, sent from the hub domain: dwts@, traitors@ and
# noreply@armchairjudge.com. The domain identity's DKIM covers every address
# under it, so no sender is verified on its own. Sending code:
# backend/lambdas/common/mailer.py.

locals {
  email_domain     = var.hub_domain_name
  mail_from_domain = "mail.${var.hub_domain_name}"
}

resource "aws_sesv2_configuration_set" "mail" {
  configuration_set_name = "${var.app_name}-mail"

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }

  # SES drops a later send to a suppressed address itself; email_events also
  # records it so targeting skips the address before rendering.
  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

# The configuration set is the identity's default, so a send that omits it
# still reports bounces and complaints.
resource "aws_sesv2_email_identity" "domain" {
  email_identity         = local.email_domain
  configuration_set_name = aws_sesv2_configuration_set.mail.configuration_set_name
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.hub_zone.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.email_domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# SPF lives on a MAIL FROM subdomain: the apex already holds the Google site
# verification TXT (route53.tf), and the MX here never claims the apex takes mail.
resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = local.mail_from_domain
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = data.aws_route53_zone.hub_zone.zone_id
  name    = local.mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = data.aws_route53_zone.hub_zone.zone_id
  name    = local.mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# Monitor-only, and no rua: the domain has no inbox to read reports in.
# Tighten to quarantine once real sending is known to pass DKIM.
resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.hub_zone.zone_id
  name    = "_dmarc.${local.email_domain}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=none;"]
}

resource "aws_sns_topic" "mail_events" {
  name = "${var.app_name}-mail-events"
}

resource "aws_sesv2_configuration_set_event_destination" "bounce_complaint" {
  configuration_set_name = aws_sesv2_configuration_set.mail.configuration_set_name
  event_destination_name = "bounce-complaint"

  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT"]

    sns_destination {
      topic_arn = aws_sns_topic.mail_events.arn
    }
  }
}

# HMAC key for unsubscribe links (backend/lambdas/common/unsubscribe.py).
# Changing it breaks every link already sent, so Terraform never rewrites the
# value; rotate it by hand only if it leaks. Under the AWS-managed aws/ssm key,
# not the app CMK: the Terraform plan role reads it on refresh and can't use the CMK.
resource "random_password" "email_unsubscribe_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "email_unsubscribe_secret" {
  name = "/${var.app_name}/email-unsubscribe-secret"
  type = "SecureString"
  # Named, not omitted: key_id is computed, so leaving it out keeps whatever key it has.
  key_id = "alias/aws/ssm"
  value  = random_password.email_unsubscribe_secret.result

  lifecycle {
    ignore_changes = [value]
  }
}
