"""
armchair-groups: a group is a filter over users, never a place scores live.

Items, per PLAN.md "Data model":
    GROUP#{gid}  META          name, createdBy, inviteCode
    GROUP#{gid}  MEMBER#{sub}  joinedAt
    USER#{sub}   GROUP#{gid}   joinedAt   (the caller's groups)
    INVITE#{code} GROUP        gid
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime

from lambdas.common.api import NotFoundError
from lambdas.common.dynamo import query_all, resource, table
from lambdas.common.users_dynamo import cards


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def create(sub: str, name: str) -> dict:
    gid = secrets.token_urlsafe(9)
    # 96 bits: the code is the only thing standing between a stranger and the group.
    code = secrets.token_urlsafe(12)
    now = _now()
    tbl = table("GROUPS_TABLE").name
    items = [
        {"pk": f"GROUP#{gid}", "sk": "META", "name": name, "createdBy": sub, "inviteCode": code},
        {"pk": f"INVITE#{code}", "sk": "GROUP", "gid": gid},
        {"pk": f"GROUP#{gid}", "sk": f"MEMBER#{sub}", "joinedAt": now},
        {"pk": f"USER#{sub}", "sk": f"GROUP#{gid}", "joinedAt": now},
    ]
    resource().meta.client.transact_write_items(
        TransactItems=[
            {
                "Put": {
                    "TableName": tbl,
                    "Item": item,
                    # A collision fails the create rather than taking over another group.
                    "ConditionExpression": "attribute_not_exists(pk)",
                }
            }
            for item in items
        ]
    )
    return {"id": gid, "name": name, "inviteCode": code}


def join(sub: str, code: str) -> dict:
    """Adds the caller by invite code. Joining twice keeps the first joinedAt."""
    tbl = table("GROUPS_TABLE")
    invite = tbl.get_item(Key={"pk": f"INVITE#{code}", "sk": "GROUP"}).get("Item")
    if invite is None:
        raise NotFoundError("That invite link doesn't match a group")
    gid = invite["gid"]
    joined = {
        "UpdateExpression": "SET joinedAt = if_not_exists(joinedAt, :now)",
        "ExpressionAttributeValues": {":now": _now()},
        "TableName": tbl.name,
    }
    resource().meta.client.transact_write_items(
        TransactItems=[
            {"Update": {**joined, "Key": {"pk": f"GROUP#{gid}", "sk": f"MEMBER#{sub}"}}},
            {"Update": {**joined, "Key": {"pk": f"USER#{sub}", "sk": f"GROUP#{gid}"}}},
        ]
    )
    meta = tbl.get_item(Key={"pk": f"GROUP#{gid}", "sk": "META"})["Item"]
    return {"id": gid, "name": meta["name"]}


def members(gid: str) -> set[str]:
    rows = query_all(table("GROUPS_TABLE"), f"GROUP#{gid}")
    return {r["sk"].removeprefix("MEMBER#") for r in rows if r["sk"].startswith("MEMBER#")}


def mine(sub: str) -> list[dict]:
    """The caller's groups, oldest first, each with its members' names and avatars."""
    tbl = table("GROUPS_TABLE")
    links = sorted(query_all(tbl, f"USER#{sub}"), key=lambda r: r["joinedAt"])
    groups = []
    for link in links:
        gid = link["sk"].removeprefix("GROUP#")
        rows = query_all(tbl, f"GROUP#{gid}")
        meta = next(r for r in rows if r["sk"] == "META")
        subs = [r["sk"].removeprefix("MEMBER#") for r in rows if r["sk"].startswith("MEMBER#")]
        groups.append(
            {"id": gid, "name": meta["name"], "inviteCode": meta["inviteCode"], "members": subs}
        )

    profiles = cards({s for g in groups for s in g["members"]})
    for g in groups:
        g["members"] = [profiles[s] for s in g["members"]]
    return groups
