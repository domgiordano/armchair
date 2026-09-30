"""
GET /notifications/list?cursor=<n>&limit=<1-50> - the caller's notifications, unread first.

Returns data [{id, type, read, state, at, from: {sub, name, picture,
avatarKind}, group: {id, name} | null}] and meta {unread, next}; pass `next`
back as `cursor` for the following page, null on the last. `state` is
pending | accepted | declined on requests and invites, else null. Identity is
the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.notifications_dynamo import listing
from lambdas.common.users_dynamo import cards

LIMIT = 20
LIMIT_MAX = 50


def _int(source: dict, field: str, default: int, lo: int, hi: int) -> int:
    raw = source.get(field)
    if raw is None:
        return default
    if not str(raw).isdigit() or not lo <= int(raw) <= hi:
        raise ValidationError(f"{field} must be a whole number from {lo} to {hi}", field=field)
    return int(raw)


@api_handler("notifications_list")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    start = _int(params, "cursor", 0, 0, 10_000)
    limit = _int(params, "limit", LIMIT, 1, LIMIT_MAX)

    # A partition holds at most EXPIRE_DAYS of notifications, so it is read
    # whole and paged in memory; that is what lets unread sort first.
    rows = listing(sub)
    page = rows[start : start + limit]
    senders = cards({r["from"] for r in page})
    items = [
        {
            "id": r["sk"],
            "type": r["type"],
            "read": r["read"],
            "state": r.get("state"),
            "at": r["sk"].partition("#")[0],
            "from": senders[r["from"]],
            "group": {"id": r["group"], "name": r.get("groupName")} if r.get("group") else None,
        }
        for r in page
    ]
    end = start + len(page)
    meta = {
        "unread": sum(not r["read"] for r in rows),
        "next": str(end) if end < len(rows) else None,
    }
    return ok(items, meta=meta)
