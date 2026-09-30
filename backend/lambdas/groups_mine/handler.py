"""
GET /groups/mine - the caller's groups with each member's name and avatar.

Returns [{id, name, inviteCode, members: [{sub, name, picture, avatarKind}]}].
No emails. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, caller_sub, ok
from lambdas.common.groups_dynamo import mine


@api_handler("groups_mine")
def handler(event, context):
    return ok(mine(caller_sub(event)))
