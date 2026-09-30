locals {
  users_endpoints = [
    for l in local.users_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["users_${l.name}"].invoke_arn
    })
  ]
  scores_endpoints = [
    for l in local.scores_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["scores_${l.name}"].invoke_arn
    })
  ]
  episodes_endpoints = [
    for l in local.episodes_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["episodes_${l.name}"].invoke_arn
    })
  ]
}

module "api" {
  source = "git::https://github.com/domgiordano/api-gateway-service.git?ref=v2.8.0"

  app_name        = var.app_name
  domain_name     = local.api_domain_name
  stage_name      = "prod"
  certificate_arn = aws_acm_certificate_validation.api.certificate_arn

  # The module defaults to "CUSTOM", which provisions a Lambda authorizer this
  # stack does not have and fails the plan. Every endpoint also sets it
  # explicitly, so no route can inherit something weaker.
  authorization          = "COGNITO_USER_POOLS"
  cognito_user_pool_arns = [data.aws_ssm_parameter.cognito_user_pool_arn.value]

  allow_origin = local.cors_allowed_origins

  # Data trace writes full request and response bodies to CloudWatch, and these
  # carry friends' names and emails.
  data_trace_enabled = false

  services = {
    users    = { path_prefix = "users", endpoints = local.users_endpoints }
    scores   = { path_prefix = "scores", endpoints = local.scores_endpoints }
    episodes = { path_prefix = "episodes", endpoints = local.episodes_endpoints }
  }
}
