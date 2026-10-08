# First-party activity events, their daily rollups, the write rate limit and the
# admin audit log. Items and access patterns: backend/lambdas/common/events_dynamo.py.
# Design and privacy: docs/architecture/activity.md.
resource "aws_dynamodb_table" "events" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-events"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # DAY#{date} | ROLLUP | RATE#{key} | AUDIT
    type = "S"
  }
  attribute {
    name = "sk" # {at}#{rand} | DAY#{date} | {minute}
    type = "S"
  }
  attribute {
    name = "uid" # the sub, or anon#{did} for a signed-out browser
    type = "S"
  }

  # One person's events, newest first: the admin console's user timeline.
  global_secondary_index {
    name            = "byUid"
    hash_key        = "uid"
    range_key       = "sk"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  # Events go 400 days after they happen, RATE rows after five minutes. Rollups
  # and the audit log carry no expiresAt and stay.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery { enabled = true }
}
