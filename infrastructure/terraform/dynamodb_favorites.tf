# Favorites-to-win snapshots, one per season and episode, written by cron_favorites
# (lambda_favorites.tf) and read only through common/favorites.for_viewer.
resource "aws_dynamodb_table" "favorites" {
  deletion_protection_enabled = true
  name                        = "${var.app_name}-favorites"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  range_key                   = "sk"

  attribute {
    name = "pk" # FAV#{show}#{season}
    type = "S"
  }
  attribute {
    name = "sk" # EP#{nn}, 00 before the premiere
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.app.arn
  }

  point_in_time_recovery { enabled = true }
}
