# Per-episode partitions, both read in one Query each and filtered through
# common/gate.py. Data model: docs/features/dwts-companion/PLAN.md.

resource "aws_dynamodb_table" "performances" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-performances"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # EP#{show}#{season}#{nn}
    type = "S"
  }
  attribute {
    name = "sk" # PERF#{cid}#{n}
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}

resource "aws_dynamodb_table" "scores" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-scores"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # EP#{show}#{season}#{nn}
    type = "S"
  }
  attribute {
    name = "sk" # PERF#{cid}#{n}#USER#{sub}
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
