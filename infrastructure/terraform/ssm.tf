# The value comes from the ADMIN_EMAILS repo secret via TF_VAR_admin_emails, so no
# address lands in this public repo. To change it, edit the secret and re-run the
# Terraform workflow.
resource "aws_ssm_parameter" "admin_emails" {
  name  = "/${var.app_name}/admin-emails"
  type  = "StringList"
  value = var.admin_emails
}

# Read by the frontend build (deploy-frontend.yml) to bake the API base URL in.
resource "aws_ssm_parameter" "api_url" {
  name  = "/${var.app_name}/api-url"
  type  = "String"
  value = "https://${local.api_domain_name}"
}
