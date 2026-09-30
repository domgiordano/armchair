"""
GET /friends/list - the caller's friends, requests both ways, blocks, and invite code.

Returns {inviteCode, friends, incoming, outgoing, blocked}, each list of
{sub, name, picture, avatarKind, at}, newest first. No emails. Identity is the
Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, caller_sub, ok
from lambdas.common.social_dynamo import invite_code, peers
from lambdas.common.users_dynamo import cards

LIST = {"friend": "friends", "incoming": "incoming", "outgoing": "outgoing"}


@api_handler("friends_list")
def handler(event, context):
    sub = caller_sub(event)
    items = peers(sub)
    # Only `blocking` shows: being blocked by someone is never revealed.
    groups = {"friends": [], "incoming": [], "outgoing": [], "blocked": []}
    for other, item in items.items():
        if item.get("blocking"):
            groups["blocked"].append(other)
        elif item.get("state") and not item.get("blockedBy"):
            groups[LIST[item["state"]]].append(other)

    profiles = cards({s for subs in groups.values() for s in subs})
    out = {
        kind: sorted(
            ({**profiles[s], "at": items[s].get("at")} for s in subs),
            key=lambda c: c["at"] or "",
            reverse=True,
        )
        for kind, subs in groups.items()
    }
    return ok({"inviteCode": invite_code(sub), **out})
