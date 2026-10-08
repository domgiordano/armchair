"""
POST /admin/friendship - undo a block or a friendship between two users. Admins only.

Body: {"a": <user>, "b": <user>, "action": "unblock" | "unlink", "reason": str}.
unblock clears a block in both directions, leaving no relationship; either can ask
again. unlink ends a friendship or a pending request. Logged with both sides before
and after.
"""

from __future__ import annotations

from lambdas.common import events_dynamo, social_dynamo
from lambdas.common.admins import reason, require_admin, target
from lambdas.common.api import ValidationError, api_handler, body, ok


def sides(a: str, b: str) -> dict:
    return {
        "a": social_dynamo.status(social_dynamo.peer(a, b)),
        "b": social_dynamo.status(social_dynamo.peer(b, a)),
    }


@api_handler("admin_friendship")
def handler(event, context):
    admin = require_admin(event)
    data = body(event)
    a, b, why = target(data, "a"), target(data, "b"), reason(data)
    if a == b:
        raise ValidationError("a and b are the same user", field="b")
    action = data.get("action")
    if action not in ("unblock", "unlink"):
        raise ValidationError("action must be unblock or unlink", field="action")

    before = sides(a, b)
    if action == "unblock":
        social_dynamo.unblock(a, b)
        social_dynamo.unblock(b, a)
    else:
        social_dynamo.unlink(a, b)
    after = sides(a, b)
    events_dynamo.audit(
        admin, f"friendship_{action}", a, why, {"with": b, **before}, {"with": b, **after}
    )
    return ok(after)
