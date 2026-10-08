"""
Site admins: the SSM StringList named by ADMIN_EMAILS_PARAM, which Terraform
writes from the ADMIN_EMAILS repo secret.

Read on every call, never cached, so a changed list takes effect on the next
request after the Terraform run, with no Lambda deploy.
"""

from __future__ import annotations

import os

import boto3

from lambdas.common.api import ForbiddenError, ValidationError, caller_email, text
from lambdas.common.social_dynamo import SUB

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


REASON_MAX = 300


def reason(data: dict) -> str:
    """Why an admin is changing someone's data. Every support action needs one for the audit log."""
    value = text(data, "reason")
    if len(value) > REASON_MAX:
        raise ValidationError(f"reason must be at most {REASON_MAX} characters", field="reason")
    return value


def target(data: dict, field: str = "sub") -> str:
    """A user id from the request, the user an admin is acting on."""
    sub = text(data, field)
    if not SUB.fullmatch(sub):
        raise ValidationError(f"{field} is not a user id", field=field)
    return sub
