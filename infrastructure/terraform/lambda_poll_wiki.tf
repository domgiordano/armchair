# Wikipedia poller: publishes judges' scores to performances and results to
# catalog. EventBridge Scheduler rather than the estate's usual
# aws_cloudwatch_event_rule because rules have no timezone: this one follows
# America/New_York through DST on 11/1 with no edit.

locals {
  poll_wiki_name = "${var.app_name}-cron-poll-wiki"
}

resource "aws_cloudwatch_log_group" "poll_wiki" {
  name              = "/aws/lambda/${local.poll_wiki_name}"
  retention_in_days = 30
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "poll_wiki" {
  name               = "${local.poll_wiki_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "poll_wiki" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.poll_wiki.arn}:*"]
  }

  # Reads the season and each episode's stored values; writes only through
  # conditional UpdateItem. No Put, no Delete.
  statement {
    sid       = "Tables"
    actions   = ["dynamodb:Query", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.catalog.arn, aws_dynamodb_table.performances.arn]
  }

  # Reconciling the leaderboard sums: reads answers, never writes them.
  statement {
    sid       = "ReadScores"
    actions   = ["dynamodb:Query"]
    resources = [aws_dynamodb_table.scores.arn]
  }

  statement {
    sid       = "Board"
    actions   = ["dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.board.arn]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "poll_wiki" {
  name   = "poll-wiki"
  role   = aws_iam_role.poll_wiki.id
  policy = data.aws_iam_policy_document.poll_wiki.json
}

resource "aws_lambda_function" "poll_wiki" {
  # Folder lambdas/cron_poll_wiki: deploy-backend.yml maps underscores to dashes.
  function_name = local.poll_wiki_name
  description   = "Publish judges' scores and results from the S35 Wikipedia page"
  role          = aws_iam_role.poll_wiki.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 256
  timeout       = 30
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment {
    variables = {
      CATALOG_TABLE      = aws_dynamodb_table.catalog.id
      PERFORMANCES_TABLE = aws_dynamodb_table.performances.id
      SCORES_TABLE       = aws_dynamodb_table.scores.id
      BOARD_TABLE        = aws_dynamodb_table.board.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.poll_wiki]

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [local.account_id]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.app_name}-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

data "aws_iam_policy_document" "scheduler" {
  statement {
    sid       = "InvokePoller"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.poll_wiki.arn]
  }
}

resource "aws_iam_role_policy" "scheduler" {
  name   = "invoke-poll-wiki"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler.json
}

resource "aws_scheduler_schedule" "poll_wiki" {
  name                         = local.poll_wiki_name
  description                  = "Every minute 8:00-11:59 pm ET on show nights"
  schedule_expression          = "cron(* 20-23 ? * MON,TUE *)"
  schedule_expression_timezone = "America/New_York"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.poll_wiki.arn
    role_arn = aws_iam_role.scheduler.arn

    # A retry would be a second API call inside the same tick, and the next
    # tick is a minute away anyway.
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
