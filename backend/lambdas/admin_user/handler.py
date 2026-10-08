"""
GET /admin/user?sub=<sub>[&before=<sk>] - one user for the console: their full
profile, groups (flagging a half-written membership), friends and blocks, the
devices they used, 30 days of daily activity, admin actions about them, and
their activity log newest first, 100 a page (`before` is meta.next). Admins only.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.analytics import daily, load_days
from lambdas.common.api import NotFoundError, ValidationError, api_handler, ok, query, text
from lambdas.common.dynamo import query_all, query_many, table
from lambdas.common.events_dynamo import audit_log, user_events
from lambdas.common.social_dynamo import SUB, peers, status
from lambdas.common.users_dynamo import cards, view

FIELDS = ("uid", "did", "app", "kind", "name", "route", "session", "device", "props")


def groups(sub: str) -> list[dict]:
    links = query_all(table("GROUPS_TABLE"), f"USER#{sub}")
    gids = [link["sk"].removeprefix("GROUP#") for link in links]
    out = []
    for link, gid, rows in zip(
        links, gids, query_many([("GROUPS_TABLE", f"GROUP#{g}") for g in gids])
    ):
        meta = next((r for r in rows if r["sk"] == "META"), None)
        members = [r for r in rows if r["sk"].startswith("MEMBER#")]
        out.append(
            {
                "id": gid,
                "name": meta and meta["name"],
                "owner": meta and meta["createdBy"] == sub,
                "members": len(members),
                "joinedAt": link.get("joinedAt"),
                # The link and the MEMBER row are written together; one alone is a stuck join.
                "member": any(r["sk"] == f"MEMBER#{sub}" for r in members),
                "exists": meta is not None,
            }
        )
    return out


def friends(sub: str) -> list[dict]:
    rows = peers(sub)
    people = cards(set(rows))
    return [
        {
            **people[other],
            "status": status(item),
            "blocking": bool(item.get("blocking")),
            "blockedBy": bool(item.get("blockedBy")),
            "at": item.get("at"),
        }
        for other, item in rows.items()
        if status(item)
    ]


@api_handler("admin_user")
def handler(event, context):
    require_admin(event)
    q = query(event)
    sub = text(q, "sub")
    if not SUB.fullmatch(sub):
        raise ValidationError("sub is not a user id", field="sub")
    row = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    if row is None:
        raise NotFoundError("No such user", sub=sub)

    rows, next_key = user_events(sub, 100, q.get("before"))
    devices: dict[str, dict] = {}
    for r in rows:
        d = devices.setdefault(
            r["did"], {"did": r["did"], "device": r["device"], "last": r["sk"][:24], "events": 0}
        )
        d["events"] += 1
    data = {
        "profile": view(row),
        "groups": groups(sub),
        "friends": friends(sub),
        "devices": list(devices.values()),
        "daily": daily(load_days(30), sub),
        "audit": audit_log(50, target=sub)[0],
        "events": [
            {"at": r["sk"].partition("#")[0], "sk": r["sk"], **{k: r[k] for k in FIELDS if k in r}}
            for r in rows
        ],
    }
    return ok(data, meta={"next": next_key})
