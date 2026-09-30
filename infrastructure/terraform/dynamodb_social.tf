# Family-level social graph: friendships, requests, blocks, personal invite
# codes and the name search index, shared by every Armchair show app. Items and
# access patterns: backend/lambdas/common/social_dynamo.py. Name search is a
# partition per first two letters, so there is no GSI.
resource "aws_dynamodb_table" "social" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-social"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # USER#{sub} | CODE#{code} | NAME#{first two letters}
    type = "S"
  }
  attribute {
    name = "sk" # PEER#{sub} | CODE | NAME | USER | {name}#{sub}
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
