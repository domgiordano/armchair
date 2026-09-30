"""
POST /notifications/read - mark one notification read, or all of them.

Body: {"id": "<notification id>"} or {"all": true}. Returns {unread: 0} after
"all", else {id}. An unknown id is 404. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import NotFoundError, ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.notifications_dynamo import ID, mark_all_read, mark_read


@api_handler("notifications_read")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    if source.get("all") is True:
        mark_all_read(sub)
        return ok({"unread": 0})
    nid = source.get("id")
    if not isinstance(nid, str) or not ID.fullmatch(nid):
        raise ValidationError("Send an id or all: true", field="id")
    if not mark_read(sub, nid):
        raise NotFoundError("No such notification")
    return ok({"id": nid})
