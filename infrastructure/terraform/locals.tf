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
  # fallback for an origin that matches none of them (common/api.py).
  cors_allowed_origins = "https://${var.domain_name},http://localhost:3000"

  lambda_variables = {
    APP_NAME           = var.app_name
    CORS_ALLOW_ORIGIN  = local.cors_allowed_origins
    USERS_TABLE        = aws_dynamodb_table.users.id
    CATALOG_TABLE      = aws_dynamodb_table.catalog.id
    ADMIN_EMAILS_PARAM = aws_ssm_parameter.admin_emails.name
  }
}
