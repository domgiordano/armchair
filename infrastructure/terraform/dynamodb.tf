# Data model: docs/features/dwts-companion/PLAN.md. No GSIs: a season is a few dozen
# catalog items, one partition Query.

resource "aws_dynamodb_table" "catalog" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-catalog"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # SEASON#{show}#{season}
    type = "S"
  }
  attribute {
    name = "sk" # META, EP#{nn}, CONTESTANT#{cid}, JUDGE#{jid}, POLLER
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
