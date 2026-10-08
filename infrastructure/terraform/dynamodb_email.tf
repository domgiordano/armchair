# Email bookkeeping: the sent log that makes every send idempotent, each run's
# counts for the admin console, and addresses SES reported as bounced or
# complained. Items: backend/lambdas/common/email_dynamo.py.
resource "aws_dynamodb_table" "email" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-email"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # SENT#{kind}#{event} | RUN#{kind} | SUPPRESS
    type = "S"
  }
  attribute {
    name = "sk" # USER#{sub} | {event} | {address}
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  # Sent-log and run rows expire; suppressions carry no expiresAt and stay.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery { enabled = true }
}
