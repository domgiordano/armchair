"""
POST /groups/join - join a group by its invite code.

Body: {"code": "<inviteCode>"}. Returns {id, name, pending}; pending is true
when the group needs the owner's approval and a join request was filed
instead. Joining a group the caller is already in returns the same 200.
Identity is the Cognito sub.
"""

from __future__ import annotations

import re

from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok, text
from lambdas.common.groups_dynamo import join

CODE = re.compile(r"[A-Za-z0-9_-]{16}")


@api_handler("groups_join")
def handler(event, context):
    sub = caller_sub(event)
    code = text(body(event), "code")
    if not CODE.fullmatch(code):
        raise ValidationError("code is not an invite code", field="code")
    return ok(join(sub, code))
