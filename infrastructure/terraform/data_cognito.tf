# The armchair-users pool, owned by xomware-infrastructure (cognito_armchair.tf
# there). This stack creates no pool and no client. The authorizer needs only
# the pool ARN; the frontend build reads the client id and Hosted UI domain from
# SSM itself.
data "aws_ssm_parameter" "cognito_user_pool_arn" {
  name = "/armchair/shared/cognito/user-pool-arn"
}
