"""
POST /groups/create - start a group; the caller is its first member.

Body: {"name": "Family", "app": "dwts"} (1-40 characters). Returns {id, name,
inviteCode}. `app`, optional, is the show it was made in, which it starts out
playing (common/group_shows.py). Anyone signed in can create one. Identity is
the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok, text
from lambdas.common.group_shows import app_ref
from lambdas.common.groups_dynamo import create

NAME_MAX = 40


@api_handler("groups_create")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    name = text(source, "name")
    if len(name) > NAME_MAX:
        raise ValidationError(f"name must be at most {NAME_MAX} characters", field="name")
    return ok(create(sub, name, app_ref(source) if source.get("app") else None))
