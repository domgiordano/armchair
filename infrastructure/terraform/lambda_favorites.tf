# Favorites-to-win snapshots for every current season. Every 15 minutes so the
# newest episode's board follows the poller's scores and eliminations within the
# night; older episodes are written once and never again (cron_favorites).

locals {
  favorites_name = "${var.app_name}-cron-favorites"
}

resource "aws_cloudwatch_log_group" "favorites" {
  name              = "/aws/lambda/${local.favorites_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "favorites" {
  name               = "${local.favorites_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "favorites" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.favorites.arn}:*"]
  }

  statement {
    sid       = "ReadShow"
    actions   = ["dynamodb:Query"]
    resources = [aws_dynamodb_table.catalog.arn, aws_dynamodb_table.performances.arn, aws_dynamodb_table.scores.arn]
  }

  statement {
    sid       = "Snapshots"
    actions   = ["dynamodb:Query", "dynamodb:PutItem"]
    resources = [aws_dynamodb_table.favorites.arn]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "favorites" {
  name   = "favorites"
  role   = aws_iam_role.favorites.id
  policy = data.aws_iam_policy_document.favorites.json
}

resource "aws_lambda_function" "favorites" {
  # Folder lambdas/cron_favorites: deploy-backend.yml maps underscores to dashes.
  function_name = local.favorites_name
  description   = "Favorites-to-win snapshots for each current season"
  role          = aws_iam_role.favorites.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 512
  timeout       = 60
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment {
    variables = {
      CATALOG_TABLE      = aws_dynamodb_table.catalog.id
      PERFORMANCES_TABLE = aws_dynamodb_table.performances.id
      SCORES_TABLE       = aws_dynamodb_table.scores.id
      FAVORITES_TABLE    = aws_dynamodb_table.favorites.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.favorites]

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

data "aws_iam_policy_document" "scheduler_favorites" {
  statement {
    sid       = "InvokeFavorites"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.favorites.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_favorites" {
  name   = "invoke-favorites"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_favorites.json
}

resource "aws_scheduler_schedule" "favorites" {
  name                = local.favorites_name
  description         = "Every 15 minutes; rewrites only the newest episode's snapshot"
  schedule_expression = "rate(15 minutes)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.favorites.arn
    role_arn = aws_iam_role.scheduler.arn

    # The next run is 15 minutes away.
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
