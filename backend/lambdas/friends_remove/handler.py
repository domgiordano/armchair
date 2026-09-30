"""
POST /friends/remove - unfriend, cancel the caller's request, or decline theirs.

Body: {"sub": "<other user's sub>"}. Returns {status: null}, including when
there was nothing to remove. Leaves blocks alone. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, body, caller_sub, ok
from lambdas.common.social_dynamo import target, unlink


@api_handler("friends_remove")
def handler(event, context):
    sub = caller_sub(event)
    unlink(sub, target(body(event), sub))
    return ok({"status": None})
