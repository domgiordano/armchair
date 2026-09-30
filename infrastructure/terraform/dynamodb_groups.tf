# Groups are filters over users; scores never live here. Items and access
# patterns: docs/features/dwts-companion/PLAN.md "Data model". "My groups" is a
# USER#{sub} partition in this table, so there is no GSI.
resource "aws_dynamodb_table" "groups" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-groups"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # GROUP#{gid} | USER#{sub} | INVITE#{code}
    type = "S"
  }
  attribute {
    name = "sk" # META | MEMBER#{sub} | GROUP#{gid} | GROUP
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
