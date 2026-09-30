# Family-level social graph: friendships, requests, blocks, personal invite
# codes, the name search index and notifications, shared by every Armchair show app. Items and
# access patterns: backend/lambdas/common/social_dynamo.py. Name search is a
# partition per first two letters, so there is no GSI.
resource "aws_dynamodb_table" "social" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-social"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # USER#{sub} | CODE#{code} | NAME#{first two letters} | NOTIF#{sub}
    type = "S"
  }
  attribute {
    name = "sk" # PEER#{sub} | CODE | NAME | USER | {name}#{sub} | {time}#{rand}
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  # Only notifications carry expiresAt; they go 90 days after they are written.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery { enabled = true }
}
