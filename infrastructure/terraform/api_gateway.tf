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
  seasons_endpoints = [
    for l in local.seasons_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["seasons_${l.name}"].invoke_arn
    })
  ]
  groups_endpoints = [
    for l in local.groups_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["groups_${l.name}"].invoke_arn
    })
  ]
  admin_endpoints = [
    for l in local.admin_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["admin_${l.name}"].invoke_arn
    })
  ]
  stats_endpoints = [
    for l in local.stats_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["stats_${l.name}"].invoke_arn
    })
  ]
  leaderboard_endpoints = [
    for l in local.leaderboard_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["leaderboard_${l.name}"].invoke_arn
    })
  ]
  overview_endpoints = [
    for l in local.overview_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["overview_${l.name}"].invoke_arn
    })
  ]
  friends_endpoints = [
    for l in local.friends_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["friends_${l.name}"].invoke_arn
    })
  ]
  notifications_endpoints = [
    for l in local.notifications_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["notifications_${l.name}"].invoke_arn
    })
  ]
  performers_endpoints = [
    for l in local.performers_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["performers_${l.name}"].invoke_arn
    })
  ]
  week_board_endpoints = [
    for l in local.week_board_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["week_board_${l.name}"].invoke_arn
    })
  ]
  traitors_endpoints = [
    for l in local.traitors_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["traitors_${l.name}"].invoke_arn
    })
  ]
  people_endpoints = [
    for l in local.people_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["people_${l.name}"].invoke_arn
    })
  ]
  email_endpoints = [
    for l in local.email_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["email_${l.name}"].invoke_arn
    })
  ]
  events_endpoints = [
    for l in local.events_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["events_${l.name}"].invoke_arn
    })
  ]
  invite_endpoints = [
    for l in local.invite_lambdas : merge(l, {
      invoke_arn = aws_lambda_function.api["invite_${l.name}"].invoke_arn
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
  # explicitly, so no route can inherit something weaker; invite/preview is
  # the one public route.
  authorization          = "COGNITO_USER_POOLS"
  cognito_user_pool_arns = [data.aws_ssm_parameter.cognito_user_pool_arn.value]

  # The module answers preflights from a MOCK integration, whose response
  # template can't read the request's Origin, so a list always returned its
  # first entry and the hub's calls failed. "*" is safe here: the API takes a
  # bearer token, never cookies. Real responses still echo only the allowed
  # origins (CORS_ALLOW_ORIGIN in the Lambdas).
  allow_origin = "*"

  # Data trace writes full request and response bodies to CloudWatch, and these
  # carry friends' names and emails.
  data_trace_enabled = false

  services = {
    users         = { path_prefix = "users", endpoints = local.users_endpoints }
    scores        = { path_prefix = "scores", endpoints = local.scores_endpoints }
    episodes      = { path_prefix = "episodes", endpoints = local.episodes_endpoints }
    seasons       = { path_prefix = "seasons", endpoints = local.seasons_endpoints }
    admin         = { path_prefix = "admin", endpoints = local.admin_endpoints }
    stats         = { path_prefix = "stats", endpoints = local.stats_endpoints }
    groups        = { path_prefix = "groups", endpoints = local.groups_endpoints }
    overview      = { path_prefix = "overview", endpoints = local.overview_endpoints }
    friends       = { path_prefix = "friends", endpoints = local.friends_endpoints }
    leaderboard   = { path_prefix = "leaderboard", endpoints = local.leaderboard_endpoints }
    notifications = { path_prefix = "notifications", endpoints = local.notifications_endpoints }
    performers    = { path_prefix = "performers", endpoints = local.performers_endpoints }
    week_board    = { path_prefix = "week-board", endpoints = local.week_board_endpoints }
    people        = { path_prefix = "people", endpoints = local.people_endpoints }
    traitors      = { path_prefix = "traitors", endpoints = local.traitors_endpoints }
    invite        = { path_prefix = "invite", endpoints = local.invite_endpoints }
    email         = { path_prefix = "email", endpoints = local.email_endpoints }
    events        = { path_prefix = "events", endpoints = local.events_endpoints }
  }
}
