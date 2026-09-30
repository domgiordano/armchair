# Shared org-wide CloudFront WAF ACL, owned by xomware-infrastructure (waf.tf).
data "aws_ssm_parameter" "shared_cloudfront_waf_arn" {
  name = "/xomware/shared/cloudfront-waf-acl-arn"
}
