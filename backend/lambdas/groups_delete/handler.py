"""
POST /groups/delete - the owner deletes a group for everyone.

Body: {"group": "<gid>"}. Returns {ok: true}. Anyone but the owner gets 403.
Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, body, caller_sub, ok
from lambdas.common.groups_dynamo import delete, owned, ref


@api_handler("groups_delete")
def handler(event, context):
    sub = caller_sub(event)
    gid = ref(body(event))
    owned(gid, sub)
    delete(gid)
    return ok({"ok": True})
