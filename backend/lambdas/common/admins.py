"""
Site admins: the SSM StringList named by ADMIN_EMAILS_PARAM, which Terraform
writes from the ADMIN_EMAILS repo secret.

Read on every call, never cached, so a changed list takes effect on the next
request after the Terraform run, with no Lambda deploy.
"""

from __future__ import annotations

import os

import boto3

from lambdas.common.api import ForbiddenError, caller_email

_ssm = None


def _client():
    global _ssm
    if _ssm is None:
        _ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return _ssm


def is_admin(email: str) -> bool:
    value = _client().get_parameter(Name=os.environ["ADMIN_EMAILS_PARAM"])["Parameter"]["Value"]
    admins = {e.strip().lower() for e in value.split(",")}
    return email.strip().lower() in admins


def require_admin(event: dict) -> str:
    email = caller_email(event)
    if not is_admin(email):
        raise ForbiddenError("Admins only")
    return email
