"""
POST /groups/leave - the caller leaves a group.

Body: {"group": "<gid>"}. Returns {ok: true}. The owner can't leave (409):
they delete the group instead, so no group is left without one. Identity is
the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ConflictError, NotFoundError, api_handler, body, caller_sub, ok
from lambdas.common.groups_dynamo import is_member, meta, ref, remove


@api_handler("groups_leave")
def handler(event, context):
    sub = caller_sub(event)
    gid = ref(body(event))
    group = meta(gid)
    if group["createdBy"] == sub:
        raise ConflictError("Owners can't leave; delete the group instead")
    if not is_member(gid, sub):
        raise NotFoundError("You're not in that group")
    remove(gid, sub)
    return ok({"ok": True})
