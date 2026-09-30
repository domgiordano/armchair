# API Lambdas. The api-gateway-service module supports exactly two path levels,
# /<prefix>/<part>, so ids travel in the body or query string.

locals {
  users_lambdas = [
    { name = "me", description = "Upsert and return the caller's profile", path_part = "me", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  scores_lambdas = [
    { name = "submit", description = "Record the caller's final answer on one performance", path_part = "submit", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "reveal_all", description = "Forfeit every performance the caller left unanswered in one episode", path_part = "reveal-all", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]
  episodes_lambdas = [
    { name = "state", description = "One episode as the caller may see it, through the gate", path_part = "state", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  groups_lambdas = [
    { name = "create", description = "Start a group with the caller as its first member", path_part = "create", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "join", description = "Join a group by invite code", path_part = "join", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "mine", description = "The caller's groups with member names and avatars", path_part = "mine", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "invite", description = "Invite a friend into a group", path_part = "invite", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "respond", description = "Accept or decline a group invite", path_part = "respond", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "manage", description = "Owner: rename, remove a member, approval, answer join requests", path_part = "manage", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "delete", description = "Owner: delete a group for everyone", path_part = "delete", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "leave", description = "Leave a group", path_part = "leave", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]
  seasons_lambdas = [
    { name = "get", description = "Schedule, roster, judges and headshot credits for one season", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  admin_lambdas = [
    { name = "keyword", description = "Set a couple's SMS keyword override", path_part = "keyword", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]
  stats_lambdas = [
    { name = "get", description = "The caller's accuracy against the judges, and everyone's, through the gate", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  friends_lambdas = [
    { name = "request", description = "Ask someone to be friends, by sub or invite code", path_part = "request", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "accept", description = "Accept a friend request", path_part = "accept", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "remove", description = "Unfriend, cancel a request, or decline one", path_part = "remove", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "block", description = "Block or unblock someone", path_part = "block", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "list", description = "The caller's friends, requests, blocks and invite code", path_part = "list", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "search", description = "Find people by display name prefix", path_part = "search", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  notifications_lambdas = [
    { name = "list", description = "The caller's notifications, unread first, paged", path_part = "list", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "read", description = "Mark one notification read, or all", path_part = "read", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]

  all_api_lambdas = merge(
    { for l in local.users_lambdas : "users_${l.name}" => l },
    { for l in local.scores_lambdas : "scores_${l.name}" => l },
    { for l in local.episodes_lambdas : "episodes_${l.name}" => l },
    { for l in local.seasons_lambdas : "seasons_${l.name}" => l },
    { for l in local.admin_lambdas : "admin_${l.name}" => l },
    { for l in local.stats_lambdas : "stats_${l.name}" => l },
    { for l in local.groups_lambdas : "groups_${l.name}" => l },
    { for l in local.friends_lambdas : "friends_${l.name}" => l },
    { for l in local.notifications_lambdas : "notifications_${l.name}" => l },
  )

  # One role per function, granted only the table actions its handler makes.
  # PutItem can still overwrite, so the conditional put in episodes_dynamo is
  # the only thing keeping an answer final. TransactWriteItems is authorized
  # per item, as PutItem or UpdateItem.
  api_tables = {
    catalog      = aws_dynamodb_table.catalog.arn
    performances = aws_dynamodb_table.performances.arn
    scores       = aws_dynamodb_table.scores.arn
    users        = aws_dynamodb_table.users.arn
    groups       = aws_dynamodb_table.groups.arn
    social       = aws_dynamodb_table.social.arn
  }
  api_grants = {
    users_me           = ["users:UpdateItem", "social:GetItem", "social:PutItem", "social:DeleteItem"]
    scores_submit      = ["catalog:Query", "performances:Query", "scores:PutItem", "scores:GetItem"]
    scores_reveal_all  = ["catalog:Query", "performances:Query", "scores:Query", "scores:PutItem", "scores:GetItem"]
    episodes_state     = ["catalog:Query", "performances:Query", "scores:Query", "groups:Query"]
    seasons_get        = ["catalog:Query"]
    admin_keyword      = ["catalog:UpdateItem"]
    stats_get          = ["catalog:Query", "performances:Query", "scores:Query", "groups:Query"]
    groups_create      = ["groups:PutItem"]
    groups_join        = ["groups:GetItem", "groups:UpdateItem", "groups:PutItem", "social:PutItem"]
    groups_mine        = ["groups:Query", "users:BatchGetItem"]
    friends_request    = ["social:GetItem", "social:UpdateItem", "social:PutItem", "users:GetItem"]
    friends_accept     = ["social:GetItem", "social:UpdateItem", "social:PutItem"]
    friends_remove     = ["social:GetItem", "social:UpdateItem", "social:DeleteItem"]
    friends_block      = ["social:GetItem", "social:UpdateItem", "social:DeleteItem"]
    friends_list       = ["social:Query", "social:GetItem", "social:PutItem", "users:BatchGetItem"]
    friends_search     = ["social:Query"]
    notifications_list = ["social:Query", "users:BatchGetItem"]
    notifications_read = ["social:Query", "social:UpdateItem"]
    groups_invite      = ["groups:GetItem", "groups:PutItem", "social:GetItem", "social:PutItem"]
    groups_respond     = ["groups:GetItem", "groups:DeleteItem", "groups:UpdateItem", "social:UpdateItem"]
    groups_manage      = ["groups:GetItem", "groups:UpdateItem", "groups:DeleteItem", "social:PutItem", "social:UpdateItem"]
    groups_delete      = ["groups:GetItem", "groups:Query", "groups:BatchWriteItem", "groups:DeleteItem", "social:DeleteItem"]
    groups_leave       = ["groups:GetItem", "groups:DeleteItem"]
  }
}

resource "aws_cloudwatch_log_group" "api" {
  for_each          = local.all_api_lambdas
  name              = "/aws/lambda/${var.app_name}-${replace(each.key, "_", "-")}"
  retention_in_days = 30
}

resource "aws_iam_role" "api" {
  for_each           = local.all_api_lambdas
  name               = "${var.app_name}-${replace(each.key, "_", "-")}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "api" {
  for_each = local.all_api_lambdas

  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api[each.key].arn}:*"]
  }

  dynamic "statement" {
    for_each = local.api_grants[each.key]
    content {
      actions   = ["dynamodb:${split(":", statement.value)[1]}"]
      resources = [local.api_tables[split(":", statement.value)[0]]]
    }
  }

  # Admin handlers read the admin list on every call (common/admins.py).
  dynamic "statement" {
    for_each = startswith(each.key, "admin_") ? [1] : []
    content {
      sid       = "ReadAdmins"
      actions   = ["ssm:GetParameter"]
      resources = [aws_ssm_parameter.admin_emails.arn]
    }
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "api" {
  for_each = local.all_api_lambdas
  name     = "api"
  role     = aws_iam_role.api[each.key].id
  policy   = data.aws_iam_policy_document.api[each.key].json
}

resource "aws_lambda_function" "api" {
  for_each = local.all_api_lambdas

  # Folder lambdas/users_me is function armchair-users-me: deploy-backend.yml
  # maps every underscore to a dash.
  function_name = "${var.app_name}-${replace(each.key, "_", "-")}"
  description   = each.value.description
  role          = aws_iam_role.api[each.key].arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 256
  timeout       = 10
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment { variables = local.lambda_variables }

  depends_on = [aws_cloudwatch_log_group.api]

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}
