# Deploy role for this repo's frontend and hub workflows. It lives here rather
# than in xomware-infrastructure because this stack owns the buckets and
# distributions (see oidc_unmanaged_apps.tf there). Only main can assume it.

locals {
  # Both subject forms: this org emits the numeric one, and the plain form
  # alone fails AssumeRoleWithWebIdentity.
  deploy_subjects = [
    "repo:domgiordano/armchair",
    "repo:domgiordano@44783934/armchair@1398549188",
  ]
}

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for s in local.deploy_subjects : "${s}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.app_name}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid     = "PublishSite"
    effect  = "Allow"
    actions = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [
      module.web.s3_bucket_arn,
      "${module.web.s3_bucket_arn}/*",
      module.hub.s3_bucket_arn,
      "${module.hub.s3_bucket_arn}/*",
      module.traitors.s3_bucket_arn,
      "${module.traitors.s3_bucket_arn}/*",
    ]
  }

  # ListDistributions has no resource-level form. The workflow uses it to find
  # the distribution by alias; the invalidation itself is scoped below.
  statement {
    sid       = "FindDistribution"
    effect    = "Allow"
    actions   = ["cloudfront:ListDistributions"]
    resources = ["*"]
  }

  statement {
    sid       = "InvalidateCache"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = [
      module.web.cloudfront_distribution_arn,
      module.hub.cloudfront_distribution_arn,
      module.traitors.cloudfront_distribution_arn,
    ]
  }

  # The frontend, hub and Traitors builds bake these into the bundle. xomware-infrastructure
  # owns the Cognito ones (cognito_armchair.tf, cognito_armchair_google.tf).
  statement {
    sid     = "ReadCognitoConfig"
    effect  = "Allow"
    actions = ["ssm:GetParameter"]
    resources = [
      for name in [
        "user-pool-id",
        "hosted-ui-domain",
        "clients/dwts-id",
        "clients/hub-id",
        "clients/traitors-id",
      ]: "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/armchair/shared/cognito/${name}"
    ]
  }

  statement {
    sid       = "ReadApiUrl"
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = [aws_ssm_parameter.api_url.arn]
  }
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

# The backend workflow's grants, as a second policy on the same role so adding
# them leaves the frontend's untouched. Same grants as the reeses role in
# xomware-infrastructure/terraform/oidc_unmanaged_apps.tf.
data "aws_iam_policy_document" "deploy_backend" {
  statement {
    sid    = "DeployFunctions"
    effect = "Allow"
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:PublishLayerVersion",
      "lambda:ListLayerVersions",
      "lambda:GetLayerVersion",
    ]
    resources = [
      "arn:aws:lambda:${var.aws_region}:${local.account_id}:function:${var.app_name}-*",
      "arn:aws:lambda:${var.aws_region}:${local.account_id}:layer:${var.app_name}-*",
    ]
  }

  # ListFunctions has no resource-level form. verify-layer enumerates the
  # armchair-* functions to check each one runs the newest layer.
  statement {
    sid       = "EnumerateFunctions"
    effect    = "Allow"
    actions   = ["lambda:ListFunctions"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy_backend" {
  name   = "deploy-backend"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_backend.json
}

# The Seed Season workflow writes catalog items. Traitors Headshots also reads a
# season's META and PLAYER rows. The table is encrypted with the app CMK, so the
# reads and writes also need the key.
data "aws_iam_policy_document" "deploy_seed" {
  statement {
    sid       = "SeedCatalog"
    effect    = "Allow"
    actions   = ["dynamodb:Query", "dynamodb:UpdateItem", "dynamodb:DescribeTable"]
    resources = [aws_dynamodb_table.catalog.arn]
  }

  statement {
    sid       = "UseAppKey"
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey*", "kms:DescribeKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "deploy_seed" {
  name   = "seed-catalog"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_seed.json
}

# The Backfill Scores, Backfill Traitors and Backfill Write-ups workflows invoke their
# Lambdas with {"backfill": true}; Discover Traitors runs the daily discovery on demand.
data "aws_iam_policy_document" "deploy_backfill" {
  statement {
    sid     = "InvokePoller"
    effect  = "Allow"
    actions = ["lambda:InvokeFunction"]
    resources = [
      aws_lambda_function.poll_wiki.arn,
      aws_lambda_function.poll_traitors.arn,
      aws_lambda_function.discover_traitors.arn,
      aws_lambda_function.writeups.arn,
    ]
  }
}

resource "aws_iam_role_policy" "deploy_backfill" {
  name   = "backfill-scores"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_backfill.json
}

# Seed Season also publishes a finished season's performances, confirmed, through
# the poller's publish(): it reads an episode's stored performances and writes
# them with conditional UpdateItem, like the poller's own role.
data "aws_iam_policy_document" "deploy_seed_performances" {
  statement {
    sid       = "SeedPerformances"
    effect    = "Allow"
    actions   = ["dynamodb:Query", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.performances.arn]
  }
}

resource "aws_iam_role_policy" "deploy_seed_performances" {
  name   = "seed-performances"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_seed_performances.json
}

# The Email Ops workflow reports whether SES is still in the sandbox and whether
# the domain identity verified. Neither action has a resource-level form for the
# account, and GetEmailIdentity is scoped to the one identity.
data "aws_iam_policy_document" "deploy_email_status" {
  statement {
    sid       = "ReadSesAccount"
    effect    = "Allow"
    actions   = ["ses:GetAccount"]
    resources = ["*"]
  }

  statement {
    sid       = "ReadSesIdentity"
    effect    = "Allow"
    actions   = ["ses:GetEmailIdentity"]
    resources = ["arn:aws:ses:${var.aws_region}:${local.account_id}:identity/${local.email_domain}"]
  }
}

# Email Ops `test` invokes admin-email-test directly with the dispatcher's address.
data "aws_iam_policy_document" "deploy_email_test" {
  statement {
    sid       = "InvokeEmailTest"
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.api["admin_email_test"].arn]
  }
}

resource "aws_iam_role_policy" "deploy_email_test" {
  name   = "email-test"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_email_test.json
}

resource "aws_iam_role_policy" "deploy_email_status" {
  name   = "email-status"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_email_status.json
}

# Migrate Traitors Bets rewrites winner-bet rows, and only those: WIN# partitions.
data "aws_iam_policy_document" "deploy_migrate_bets" {
  statement {
    sid       = "MigrateWinnerBets"
    effect    = "Allow"
    actions   = ["dynamodb:Query", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.scores.arn]
    condition {
      test     = "ForAllValues:StringLike"
      variable = "dynamodb:LeadingKeys"
      values   = ["WIN#*"]
    }
  }
}

resource "aws_iam_role_policy" "deploy_migrate_bets" {
  name   = "migrate-traitors-bets"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_migrate_bets.json
}
