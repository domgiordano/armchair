# Traitors season discovery: daily, reads each edition's main Wikipedia article,
# seeds new season pages into the catalog and moves the `current` flag, so a new
# season needs no code change (docs/features/traitors/PLAN.md "Future seasons").

locals {
  discover_traitors_name = "${var.app_name}-cron-discover-traitors"
}

resource "aws_cloudwatch_log_group" "discover_traitors" {
  name              = "/aws/lambda/${local.discover_traitors_name}"
  retention_in_days = 30
}

resource "aws_iam_role" "discover_traitors" {
  name               = "${local.discover_traitors_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "discover_traitors" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.discover_traitors.arn}:*"]
  }

  statement {
    sid       = "SeedCatalog"
    actions   = ["dynamodb:Query", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.catalog.arn]
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "discover_traitors" {
  name   = "discover-traitors"
  role   = aws_iam_role.discover_traitors.id
  policy = data.aws_iam_policy_document.discover_traitors.json
}

resource "aws_lambda_function" "discover_traitors" {
  # Folder lambdas/cron_discover_traitors: deploy-backend.yml maps underscores to dashes.
  # The timeout covers about 15 sequential Wikipedia fetches, each allowed 10 s.
  function_name = local.discover_traitors_name
  description   = "Find and seed Traitors seasons, and move the current flag"
  role          = aws_iam_role.discover_traitors.arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 256
  timeout       = 180
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment {
    variables = {
      CATALOG_TABLE = aws_dynamodb_table.catalog.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.discover_traitors]

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}

data "aws_iam_policy_document" "scheduler_discover_traitors" {
  statement {
    sid       = "InvokeTraitorsDiscovery"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.discover_traitors.arn]
  }
}

resource "aws_iam_role_policy" "scheduler_discover_traitors" {
  name   = "invoke-discover-traitors"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_discover_traitors.json
}

resource "aws_scheduler_schedule" "discover_traitors" {
  name                = local.discover_traitors_name
  description         = "Daily at 06:00 UTC"
  schedule_expression = "cron(0 6 * * ? *)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.discover_traitors.arn
    role_arn = aws_iam_role.scheduler.arn
  }
}
