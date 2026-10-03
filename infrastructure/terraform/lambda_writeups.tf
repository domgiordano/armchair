# AI write-ups of each dance from published recaps, the mornings after show
# nights. Recap text is cached under recaps/ in the avatars bucket, which its
# CloudFront distribution can't read (avatars.tf grants it avatars/* only).

locals {
  writeups_name     = "${var.app_name}-cron-writeups"
  # Put by hand, never by Terraform, so the key stays out of state.
  anthropic_key_arn = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/${var.app_name}/api/ANTHROPIC_API_KEY"
}

resource "aws_cloudwatch_log_group" "writeups" {
  name              = "/aws/lambda/${local.writeups_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "writeups" {
  name               = "${local.writeups_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "writeups" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.writeups.arn}:*"]
  }

  statement {
    sid       = "ReadShow"
    actions   = ["dynamodb:Query"]
    resources = [aws_dynamodb_table.catalog.arn, aws_dynamodb_table.performances.arn]
  }

  statement {
    sid       = "Writeups"
    actions   = ["dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:BatchWriteItem"]
    resources = [aws_dynamodb_table.writeups.arn]
  }

  statement {
    sid       = "RecapCache"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${aws_s3_bucket.avatars.arn}/recaps/*"]
  }

  # Without ListBucket a missing key answers 403, not 404, and every miss looks like an outage.
  statement {
    sid       = "RecapCacheMisses"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.avatars.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["recaps/*"]
    }
  }

  # A SecureString under the AWS-managed aws/ssm key, whose key policy already
  # lets account principals decrypt through SSM.
  statement {
    sid       = "AnthropicKey"
    actions   = ["ssm:GetParameter"]
    resources = [local.anthropic_key_arn]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "writeups" {
  name   = "writeups"
  role   = aws_iam_role.writeups.id
  policy = data.aws_iam_policy_document.writeups.json
}

resource "aws_lambda_function" "writeups" {
  # Folder lambdas/cron_writeups: deploy-backend.yml maps underscores to dashes.
  # The timeout covers a backfill of four episodes: a dozen polite fetches and a
  # Claude call of a minute or two each.
  function_name = local.writeups_name
  description   = "AI write-ups of each dance from published recaps"
  role          = aws_iam_role.writeups.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 512
  timeout       = 900
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment {
    variables = {
      CATALOG_TABLE      = aws_dynamodb_table.catalog.id
      PERFORMANCES_TABLE = aws_dynamodb_table.performances.id
      WRITEUPS_TABLE     = aws_dynamodb_table.writeups.id
      RECAPS_BUCKET      = aws_s3_bucket.avatars.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.writeups]

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

data "aws_iam_policy_document" "scheduler_writeups" {
  statement {
    sid       = "InvokeWriteups"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.writeups.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_writeups" {
  name   = "invoke-writeups"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_writeups.json
}

resource "aws_scheduler_schedule" "writeups" {
  name                         = local.writeups_name
  description                  = "9 am ET the mornings after show nights"
  schedule_expression          = "cron(0 9 ? * TUE,WED *)"
  schedule_expression_timezone = "America/New_York"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.writeups.arn
    role_arn = aws_iam_role.scheduler.arn

    # A retry would re-run a paid call that may have succeeded; the next morning catches up.
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
