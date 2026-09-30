"""
POST /groups/respond - accept or decline an invite into a group.

Body: {"group": "<gid>", "accept": true | false}. Accepting makes the caller a
member. Returns {id, name, member}. 404 when there is no invite. Identity is
the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.groups_dynamo import meta, ref, respond


@api_handler("groups_respond")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    gid = ref(source)
    accept = source.get("accept")
    if not isinstance(accept, bool):
        raise ValidationError("accept must be true or false", field="accept")
    group = meta(gid)
    respond(gid, sub, accept)
    return ok({"id": gid, "name": group["name"], "member": accept})
