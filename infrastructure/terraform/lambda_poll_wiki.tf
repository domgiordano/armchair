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

  # A guest judge's Commons photo (common/guest_judges.py), beside the seeded crops.
  statement {
    sid       = "GuestHeadshots"
    actions   = ["s3:PutObject"]
    resources = ["arn:aws:s3:::${var.domain_name}/headshots/auto/*"]
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
      SITE_BUCKET        = var.domain_name
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

# The lineup pass (cron_poll_wiki {"lineup": true}): dance, song and running
# order onto each episode's cards before air. Dances and songs come days ahead;
# editors set the order on show day, 5-6 hours before air in S35 weeks 2 and 4
# and at air in week 3. Daily for the dances, then on air dates every 30 minutes
# from 8 am and every 5 in the two hours before the 8 pm show. "showDay" runs
# return before any request on other days.
locals {
  lineup_schedules = {
    daily        = { cron = "cron(0 9 * * ? *)", input = { lineup = true } }
    show-day     = { cron = "cron(0/30 8-17 * * ? *)", input = { lineup = true, showDay = true } }
    show-day-eve = { cron = "cron(0/5 18-19 * * ? *)", input = { lineup = true, showDay = true } }
  }
}

resource "aws_scheduler_schedule" "poll_wiki_lineup" {
  for_each                     = local.lineup_schedules
  name                         = "${local.poll_wiki_name}-lineup-${each.key}"
  description                  = "Running order and dances from the Wikipedia page (${each.key})"
  schedule_expression          = each.value.cron
  schedule_expression_timezone = "America/New_York"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.poll_wiki.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode(each.value.input)

    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
