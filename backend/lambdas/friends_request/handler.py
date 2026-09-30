"""
POST /friends/request - ask someone to be friends, by their sub or their invite code.

Body: {"sub": "<cognito sub>"} or {"code": "<personal invite code>"}.
Returns {status, user: {sub, name, picture, avatarKind}}; status is outgoing,
or friend when they had already asked the caller. Asking again is a 200 with
the same status. A blocked or unknown user is 404. Identity is the Cognito sub.
"""

from __future__ import annotations

import re

from lambdas.common.api import NotFoundError, ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.social_dynamo import code_owner, request, target
from lambdas.common.users_dynamo import card

CODE = re.compile(r"[A-Za-z0-9_-]{16}")


@api_handler("friends_request")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    code = source.get("code")
    if code is not None:
        if not isinstance(code, str) or not CODE.fullmatch(code):
            raise ValidationError("code is not an invite code", field="code")
        owner = code_owner(code)
        if owner is None:
            raise NotFoundError("That invite link doesn't match anyone")
        if owner == sub:
            raise ValidationError("That's your own invite link", field="code")
        source = {"sub": owner}
    other = target(source, sub)
    user = card(other)
    if user is None:
        raise NotFoundError("No such user")
    return ok({"status": request(sub, other), "user": user})
