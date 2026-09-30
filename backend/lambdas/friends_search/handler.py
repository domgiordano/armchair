"""
GET /friends/search?q=<name prefix> - find people by display name.

Case-insensitive prefix match on the whole name, at least 2 characters.
Returns up to 20 of [{sub, name, picture, avatarKind, status}], where status
is friend | outgoing | incoming | null. Never the caller, never anyone blocked
either way, never an email. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.social_dynamo import SEARCH_LIMIT, normalize, peers, search, status

Q_MAX = 40


@api_handler("friends_search")
def handler(event, context):
    sub = caller_sub(event)
    q = normalize(str(query(event).get("q") or ""))
    if not 2 <= len(q) <= Q_MAX:
        raise ValidationError(f"q must be 2-{Q_MAX} characters", field="q")
    mine = peers(sub)
    out = []
    for row in search(q):
        other = row["sub"]
        relation = status(mine.get(other))
        if other == sub or relation == "blocked":
            continue
        out.append(
            {
                "sub": other,
                "name": row.get("name"),
                "picture": row.get("picture"),
                "avatarKind": row.get("avatarKind"),
                "status": relation,
            }
        )
    return ok(out[:SEARCH_LIMIT])
