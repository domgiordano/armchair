# Rolls each UTC day's activity events into one ROLLUP item for the admin console.

locals {
  rollup_events_name = "${var.app_name}-cron-rollup-events"
}

resource "aws_cloudwatch_log_group" "rollup_events" {
  name              = "/aws/lambda/${local.rollup_events_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "rollup_events" {
  name               = "${local.rollup_events_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "rollup_events" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.rollup_events.arn}:*"]
  }

  statement {
    sid       = "Events"
    actions   = ["dynamodb:Query", "dynamodb:PutItem"]
    resources = [aws_dynamodb_table.events.arn]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "rollup_events" {
  name   = "rollup-events"
  role   = aws_iam_role.rollup_events.id
  policy = data.aws_iam_policy_document.rollup_events.json
}

resource "aws_lambda_function" "rollup_events" {
  # Folder lambdas/cron_rollup_events: deploy-backend.yml maps underscores to dashes.
  function_name = local.rollup_events_name
  description   = "Daily rollups of activity events for the admin console"
  role          = aws_iam_role.rollup_events.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 512
  timeout       = 300
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment {
    variables = { EVENTS_TABLE = aws_dynamodb_table.events.id }
  }

  depends_on = [aws_cloudwatch_log_group.rollup_events]

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

data "aws_iam_policy_document" "scheduler_rollup_events" {
  statement {
    sid       = "InvokeRollup"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.rollup_events.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_rollup_events" {
  name   = "invoke-rollup-events"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_rollup_events.json
}

resource "aws_scheduler_schedule" "rollup_events" {
  name                = local.rollup_events_name
  description         = "Daily 00:30 UTC: roll up the last two UTC days"
  schedule_expression = "cron(30 0 * * ? *)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.rollup_events.arn
    role_arn = aws_iam_role.scheduler.arn

    # Rewriting a day is idempotent, so a retry is harmless.
    retry_policy {
      maximum_retry_attempts = 2
    }
  }
}
