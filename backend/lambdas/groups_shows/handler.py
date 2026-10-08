"""
POST /groups/shows - start or stop a show for a group.

Body: {"group": "<gid>", "app": "dwts" | "traitors", "active": true | false}.
Any member starts a show, and every other member gets a group_show_started
notification; starting one already on is a 200 that tells nobody. Only the
owner stops one (403). Returns {app, active, started}, where `started` says
this call switched it on. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common import group_shows
from lambdas.common.api import ForbiddenError, ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.groups_dynamo import is_member, members, meta, ref


@api_handler("groups_shows")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    gid = ref(source)
    app = group_shows.app_ref(source)
    active = source.get("active")
    if not isinstance(active, bool):
        raise ValidationError("active must be true or false", field="active")
    group = meta(gid)
    if not is_member(gid, sub):
        raise ForbiddenError("Only members can change the group's shows")
    if not active:
        if group["createdBy"] != sub:
            raise ForbiddenError("Only the group's owner can stop a show")
        group_shows.stop(gid, app)
        return ok({"app": app, "active": False, "started": False})
    started = group_shows.start(gid, group["name"], app, sub, members(gid))
    return ok({"app": app, "active": True, "started": started})
