# AI write-ups of each dance, written by cron_writeups (lambda_writeups.tf) and read
# only through common/gate.py. Items and why: backend/lambdas/common/writeups.py.
resource "aws_dynamodb_table" "writeups" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-writeups"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # EP#{show}#{season}#{nn}
    type = "S"
  }
  attribute {
    name = "sk" # PERF#{key} | META (the episode's spend across runs)
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
