# Email Lambdas. email_events takes SES bounce and complaint notifications off
# the mail-events topic and suppresses the address (common/email_dynamo.py).

locals {
  email_events_name = "${var.app_name}-email-events"
}

resource "aws_cloudwatch_log_group" "email_events" {
  name              = "/aws/lambda/${local.email_events_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "email_events" {
  name               = "${local.email_events_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "email_events" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.email_events.arn}:*"]
  }

  statement {
    sid       = "Suppress"
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.email.arn]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "email_events" {
  name   = "email-events"
  role   = aws_iam_role.email_events.id
  policy = data.aws_iam_policy_document.email_events.json
}

resource "aws_lambda_function" "email_events" {
  # Folder lambdas/email_events: deploy-backend.yml maps underscores to dashes.
  function_name = local.email_events_name
  description   = "Suppress addresses SES reports as bounced or complained"
  role          = aws_iam_role.email_events.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 256
  timeout       = 30
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment {
    variables = {
      EMAIL_TABLE = aws_dynamodb_table.email.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.email_events]

  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

resource "aws_lambda_permission" "email_events_sns" {
  statement_id  = "AllowMailEventsTopic"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_events.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.mail_events.arn
}

resource "aws_sns_topic_subscription" "email_events" {
  topic_arn = aws_sns_topic.mail_events.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.email_events.arn
}

# cron_email sends the scheduled show email: reminders now, digests too
# (backend/lambdas/cron_email/handler.py).

locals {
  cron_email_name = "${var.app_name}-cron-email"

  # What every function that sends email needs beyond lambda_variables.
  email_env = {
    EMAIL_DOMAIN       = local.email_domain
    EMAIL_CONFIG_SET   = aws_sesv2_configuration_set.mail.configuration_set_name
    ADMIN_EMAILS_PARAM = aws_ssm_parameter.admin_emails.name
  }
}

# Sending from any address on the domain through the configuration set, the
# sandbox check (mailer.production), and the two parameters a send reads.
data "aws_iam_policy_document" "send_email" {
  # identity/* rather than the domain alone: in the sandbox SES also authorizes
  # each verified recipient's identity.
  statement {
    sid     = "SendEmail"
    actions = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [
      "arn:aws:ses:${var.aws_region}:${local.account_id}:identity/*",
      aws_sesv2_configuration_set.mail.arn,
    ]
  }

  statement {
    sid       = "SandboxCheck"
    actions   = ["ses:GetAccount"]
    resources = ["*"]
  }

  statement {
    sid       = "MailParams"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.email_unsubscribe_secret.arn, aws_ssm_parameter.admin_emails.arn]
  }
}

resource "aws_cloudwatch_log_group" "cron_email" {
  name              = "/aws/lambda/${local.cron_email_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "cron_email" {
  name               = "${local.cron_email_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "cron_email" {
  source_policy_documents = [data.aws_iam_policy_document.send_email.json]

  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.cron_email.arn}:*"]
  }

  statement {
    sid     = "ReadShows"
    actions = ["dynamodb:Query", "dynamodb:BatchGetItem"]
    resources = [
      aws_dynamodb_table.catalog.arn,
      aws_dynamodb_table.performances.arn,
      aws_dynamodb_table.scores.arn,
      aws_dynamodb_table.board.arn,
      aws_dynamodb_table.groups.arn,
    ]
  }

  statement {
    sid       = "Recipients"
    actions   = ["dynamodb:Scan", "dynamodb:BatchGetItem"]
    resources = [aws_dynamodb_table.users.arn]
  }

  statement {
    sid       = "SentLog"
    actions   = ["dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.email.arn]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "cron_email" {
  name   = "cron-email"
  role   = aws_iam_role.cron_email.id
  policy = data.aws_iam_policy_document.cron_email.json
}

resource "aws_lambda_function" "cron_email" {
  # Folder lambdas/cron_email: deploy-backend.yml maps underscores to dashes.
  function_name = local.cron_email_name
  description   = "Send the show email that's due: reminders and digests"
  role          = aws_iam_role.cron_email.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 512
  timeout       = 300
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment {
    variables = merge(local.lambda_variables, local.email_env, {
      # How long before a DWTS week locks the closing reminder goes out.
      CLOSING_DAYS = "2"
    })
  }

  depends_on = [aws_cloudwatch_log_group.cron_email]

  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

data "aws_iam_policy_document" "scheduler_email" {
  statement {
    sid       = "InvokeCronEmail"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.cron_email.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_email" {
  name   = "invoke-cron-email"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_email.json
}

resource "aws_scheduler_schedule" "cron_email" {
  name        = local.cron_email_name
  description = "Every 15 minutes: reminders two hours before air, closing reminders, digests"
  # A tick with nothing due is a handful of catalog Queries.
  schedule_expression = "rate(15 minutes)"
  # Off until the test sends and the apps' email settings are live.
  state = "DISABLED"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.cron_email.arn
    role_arn = aws_iam_role.scheduler.arn

    # The next tick retries anything that failed, through the sent log.
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
