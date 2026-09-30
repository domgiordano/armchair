"""
POST /groups/create - start a group; the caller is its first member.

Body: {"name": "Family"} (1-40 characters). Returns {id, name, inviteCode}.
Anyone signed in can create one. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok, text
from lambdas.common.groups_dynamo import create

NAME_MAX = 40


@api_handler("groups_create")
def handler(event, context):
    sub = caller_sub(event)
    name = text(body(event), "name")
    if len(name) > NAME_MAX:
        raise ValidationError(f"name must be at most {NAME_MAX} characters", field="name")
    return ok(create(sub, name))
