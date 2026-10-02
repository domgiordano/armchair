# Traitors poller: reads each edition's current season page while an episode is
# fresh. Every minute, all week: which ticks fetch is decided from catalog
# release times, so new seasons and schedules need no cron edit. Log-only until
# publishing lands (docs/features/traitors/PLAN.md PR 9).

locals {
  poll_traitors_name = "${var.app_name}-cron-poll-traitors"
}

resource "aws_cloudwatch_log_group" "poll_traitors" {
  name              = "/aws/lambda/${local.poll_traitors_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "poll_traitors" {
  name               = "${local.poll_traitors_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "poll_traitors" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.poll_traitors.arn}:*"]
  }

  statement {
    sid       = "ReadCatalog"
    actions   = ["dynamodb:Query"]
    resources = [aws_dynamodb_table.catalog.arn]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "poll_traitors" {
  name   = "poll-traitors"
  role   = aws_iam_role.poll_traitors.id
  policy = data.aws_iam_policy_document.poll_traitors.json
}

resource "aws_lambda_function" "poll_traitors" {
  # Folder lambdas/cron_poll_traitors: deploy-backend.yml maps underscores to dashes.
  function_name = local.poll_traitors_name
  description   = "Read current Traitors season pages while an episode is fresh"
  role          = aws_iam_role.poll_traitors.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 256
  timeout       = 30
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment {
    variables = {
      CATALOG_TABLE = aws_dynamodb_table.catalog.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.poll_traitors]

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

data "aws_iam_policy_document" "scheduler_traitors" {
  statement {
    sid       = "InvokeTraitorsPoller"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.poll_traitors.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_traitors" {
  name   = "invoke-poll-traitors"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_traitors.json
}

resource "aws_scheduler_schedule" "poll_traitors" {
  name                = local.poll_traitors_name
  description         = "Every minute; the handler polls only around releases"
  schedule_expression = "rate(1 minute)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.poll_traitors.arn
    role_arn = aws_iam_role.scheduler.arn

    # The next tick is a minute away.
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
