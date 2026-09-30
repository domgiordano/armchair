# One profile per Cognito sub, mirrored from the ID token by /users/me.
resource "aws_dynamodb_table" "users" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-users"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "sub"

  attribute {
    name = "sub"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
