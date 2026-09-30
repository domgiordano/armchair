variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Resource name prefix. Drives every AWS resource name. Effectively permanent: tables and pools can't be renamed."
  type        = string
  default     = "armchair"
}

variable "domain_name" {
  description = "Public hostname for the site. Also the site bucket's name."
  type        = string
  default     = "dwts.armchairjudge.com"
}

variable "route53_zone_name" {
  description = "Hosted zone that domain_name lives in."
  type        = string
  default     = "armchairjudge.com"
}

variable "environment" {
  description = "Tag value only. There is one deployed environment."
  type        = string
  default     = "production"
}

variable "lambda_runtime" {
  description = "Python runtime for all Lambdas and the shared layer."
  type        = string
  default     = "python3.12"
}

variable "admin_emails" {
  description = "Comma-separated admin emails, from the ADMIN_EMAILS repo secret."
  type        = string
  sensitive   = true
}
