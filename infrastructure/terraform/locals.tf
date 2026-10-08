locals {
  standard_tags = {
    source      = "terraform"
    project     = var.app_name
    environment = var.environment
    owner       = "xomware"
  }

  account_id      = data.aws_caller_identity.current.account_id
  api_domain_name = "api.${var.domain_name}"

  # Comma-delimited, the api-gateway-service contract. The first entry is the
  # fallback for an origin that matches none of them (common/api.py). The hub
  # and Traitors call the same API; the hub's www host needs no entry,
  # CloudFront 301s it first.
  cors_allowed_origins = "https://${var.domain_name},https://${var.hub_domain_name},https://${var.traitors_domain_name},http://localhost:3000,http://localhost:3001"

  lambda_variables = {
    APP_NAME           = var.app_name
    CORS_ALLOW_ORIGIN  = local.cors_allowed_origins
    USERS_TABLE        = aws_dynamodb_table.users.id
    CATALOG_TABLE      = aws_dynamodb_table.catalog.id
    PERFORMANCES_TABLE = aws_dynamodb_table.performances.id
    SCORES_TABLE       = aws_dynamodb_table.scores.id
    ADMIN_EMAILS_PARAM = aws_ssm_parameter.admin_emails.name
    GROUPS_TABLE       = aws_dynamodb_table.groups.id
    BOARD_TABLE        = aws_dynamodb_table.board.id
    SOCIAL_TABLE       = aws_dynamodb_table.social.id
    WRITEUPS_TABLE     = aws_dynamodb_table.writeups.id
    EVENTS_TABLE       = aws_dynamodb_table.events.id
    AVATARS_BUCKET     = aws_s3_bucket.avatars.id
    AVATARS_URL        = "https://${aws_cloudfront_distribution.avatars.domain_name}"
  }
}
