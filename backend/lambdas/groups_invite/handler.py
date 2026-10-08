"""
POST /groups/invite - invite a friend into a group the caller belongs to.

Body: {"group": "<gid>", "sub": "<friend's sub>"}. Returns {status}: invited,
or member when they're in already. Inviting twice is a 200 and notifies once.
Only members may invite (403), and only their friends (403). The friend also
gets an email unless they turned invites off (common/email_social.py). Identity
is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common import email_social
from lambdas.common.api import ForbiddenError, api_handler, body, caller_sub, ok
from lambdas.common.groups_dynamo import invite, is_member, meta, ref
from lambdas.common.social_dynamo import peer, status, target


@api_handler("groups_invite")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    gid = ref(source)
    friend = target(source, sub)
    group = meta(gid)
    if not is_member(gid, sub):
        raise ForbiddenError("Only members can invite people to this group")
    if status(peer(sub, friend)) != "friend":
        raise ForbiddenError("You can only invite your friends")
    result = invite(gid, sub, friend)
    if result == "invited":
        email_social.group_invite(event, gid, group["name"], sub, friend)
    return ok({"status": result})
