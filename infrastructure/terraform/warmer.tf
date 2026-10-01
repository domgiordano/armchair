# Pings the busiest API functions every five minutes so one container of each
# stays warm: a cold start was ~2 s. Six functions at rate(5 minutes) is about
# 52k invocations a month, inside the Lambda free tier. The handler answers the
# ping before any auth or table read (common/api.py api_handler).

locals {
  warm_lambdas = ["users_me", "notifications_list", "seasons_get", "overview_get", "episodes_state", "stats_get"]
}

data "aws_iam_policy_document" "warmer_assume" {
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

resource "aws_iam_role" "warmer" {
  name               = "${var.app_name}-warmer"
  assume_role_policy = data.aws_iam_policy_document.warmer_assume.json
}

data "aws_iam_policy_document" "warmer" {
  statement {
    actions   = ["lambda:InvokeFunction"]
    resources = [for k in local.warm_lambdas : aws_lambda_function.api[k].arn]
  }
}

resource "aws_iam_role_policy" "warmer" {
  name   = "invoke"
  role   = aws_iam_role.warmer.id
  policy = data.aws_iam_policy_document.warmer.json
}

resource "aws_scheduler_schedule" "warm" {
  for_each = toset(local.warm_lambdas)

  name                = "${var.app_name}-warm-${replace(each.key, "_", "-")}"
  schedule_expression = "rate(5 minutes)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.api[each.key].arn
    role_arn = aws_iam_role.warmer.arn
    input    = jsonencode({ warm = true })

    # A missed ping costs one cold start; a retry storm costs more.
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
