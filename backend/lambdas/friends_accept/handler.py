"""
POST /friends/accept - accept a friend request the caller received.

Body: {"sub": "<requester's sub>"}. Returns {status: "friend"}; 404 when there
is no pending request from them. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, body, caller_sub, ok
from lambdas.common.social_dynamo import accept, target


@api_handler("friends_accept")
def handler(event, context):
    sub = caller_sub(event)
    return ok({"status": accept(sub, target(body(event), sub))})
