"""
GET /groups/mine - the caller's groups with each member's name and avatar.

Returns [{id, name, inviteCode, owner, approval, members, invited, requests}],
where the three lists hold {sub, name, picture, avatarKind} and `requests` is
filled for the owner only. No emails. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, caller_sub, ok
from lambdas.common.groups_dynamo import mine


@api_handler("groups_mine")
def handler(event, context):
    return ok(mine(caller_sub(event)))
