"""
POST /friends/block - block or unblock someone.

Body: {"sub": "<other user's sub>", "blocked": true | false}. Blocking drops
any friendship or request between the two, and each disappears from the
other's search. Returns {status}. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.social_dynamo import block, peer, status, target, unblock


@api_handler("friends_block")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    other = target(source, sub)
    blocked = source.get("blocked")
    if not isinstance(blocked, bool):
        raise ValidationError("blocked must be true or false", field="blocked")
    if blocked:
        block(sub, other)
    else:
        unblock(sub, other)
    return ok({"status": status(peer(sub, other))})
