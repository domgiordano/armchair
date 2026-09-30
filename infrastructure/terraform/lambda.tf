# API Lambdas. The api-gateway-service module supports exactly two path levels,
# /<prefix>/<part>, so ids travel in the body or query string.

locals {
  users_lambdas = [
    { name = "me", description = "Upsert and return the caller's profile", path_part = "me", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]

  seasons_lambdas = [
    { name = "vote", description = "Air schedule and SMS keywords for the vote panel", path_part = "vote", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]

  admin_lambdas = [
    { name = "keyword", description = "Set a couple's SMS keyword override", path_part = "keyword", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]

  all_api_lambdas = merge(
    { for l in local.users_lambdas : "users_${l.name}" => l },
    { for l in local.seasons_lambdas : "seasons_${l.name}" => l },
    { for l in local.admin_lambdas : "admin_${l.name}" => l },
  )
}

resource "aws_cloudwatch_log_group" "api" {
  for_each          = local.all_api_lambdas
  name              = "/aws/lambda/${var.app_name}-${replace(each.key, "_", "-")}"
  retention_in_days = 30
}

resource "aws_iam_role" "api" {
  name               = "${var.app_name}-api-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "api" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [for g in aws_cloudwatch_log_group.api : "${g.arn}:*"]
  }

  # Table-prefix grant, as in smirnoff-league: a new armchair-* table needs no
  # IAM change.
  statement {
    sid = "DynamoDB"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
    ]
    resources = ["arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/${var.app_name}-*"]
  }

  statement {
    sid       = "ReadConfig"
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/${var.app_name}/*"]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "api" {
  name   = "api"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api.json
}

resource "aws_lambda_function" "api" {
  for_each = local.all_api_lambdas

  # Folder lambdas/users_me is function armchair-users-me: deploy-backend.yml
  # maps every underscore to a dash.
  function_name = "${var.app_name}-${replace(each.key, "_", "-")}"
  description   = each.value.description
  role          = aws_iam_role.api.arn
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
