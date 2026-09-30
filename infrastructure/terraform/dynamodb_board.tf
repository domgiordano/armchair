# Leaderboard sums, kept current on every scored dance so a leaderboard read is
# one Query and never touches a score. Items and why: backend/lambdas/common/board_dynamo.py.
resource "aws_dynamodb_table" "board" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-board"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # ERR#{show}#{season}#{nn} | BOARD#{show}#{season|all}
    type = "S"
  }
  attribute {
    name = "sk" # {cid}#{n}#USER#{sub} | USER#{sub}
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
