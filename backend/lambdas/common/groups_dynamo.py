"""
armchair-groups: a group is a filter over users, never a place scores live.

Items, per PLAN.md "Data model":
    GROUP#{gid}  META           name, createdBy, inviteCode, approval
    GROUP#{gid}  MEMBER#{sub}   joinedAt
    GROUP#{gid}  INVITED#{sub}  by, at, notif   a member invited a friend
    GROUP#{gid}  REQUEST#{sub}  at, notif       a code-holder asked to join
    USER#{sub}   GROUP#{gid}    joinedAt   (the caller's groups)
    INVITE#{code} GROUP         gid

`createdBy` is the owner. With `approval` set, the invite link files a join
request for the owner to answer instead of adding the member outright. The
`notif` on an invite or request is the id of the notification it raised, so
answering it can mark that notification answered.
"""

from __future__ import annotations

import re
import secrets
from datetime import UTC, datetime

from lambdas.common import notifications_dynamo as notifications
from lambdas.common.api import ForbiddenError, NotFoundError, ValidationError, text
from lambdas.common.dynamo import query_all, resource, table, transact
from lambdas.common.users_dynamo import cards

GID = re.compile(r"[A-Za-z0-9_-]{12}")


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


def _key(gid: str, sk: str) -> dict:
    return {"pk": f"GROUP#{gid}", "sk": sk}


def _get(gid: str, sk: str) -> dict | None:
    return table("GROUPS_TABLE").get_item(Key=_key(gid, sk), ConsistentRead=True).get("Item")


def _joins(gid: str, sub: str) -> list[tuple[str, dict]]:
    """The member row and the caller's link; joining twice keeps the first joinedAt."""
    joined = {
        "UpdateExpression": "SET joinedAt = if_not_exists(joinedAt, :now)",
        "ExpressionAttributeValues": {":now": _now()},
    }
    return [
        ("Update", {**joined, "Key": _key(gid, f"MEMBER#{sub}")}),
        ("Update", {**joined, "Key": {"pk": f"USER#{sub}", "sk": f"GROUP#{gid}"}}),
    ]


def _leaves(gid: str, sub: str) -> list[tuple[str, dict]]:
    return [
        ("Delete", {"Key": _key(gid, f"MEMBER#{sub}")}),
        ("Delete", {"Key": {"pk": f"USER#{sub}", "sk": f"GROUP#{gid}"}}),
    ]


def ref(source: dict) -> str:
    """The group id from a request body."""
    gid = text(source, "group")
    if not GID.fullmatch(gid):
        raise ValidationError("group is not a group id", field="group")
    return gid


def meta(gid: str) -> dict:
    group = _get(gid, "META")
    if group is None:
        raise NotFoundError("No such group")
    return group


def is_member(gid: str, sub: str) -> bool:
    return _get(gid, f"MEMBER#{sub}") is not None


def owned(gid: str, sub: str) -> dict:
    """The group's META when the caller owns it."""
    group = meta(gid)
    if group["createdBy"] != sub:
        raise ForbiddenError("Only the group's owner can do that")
    return group


def by_code(code: str) -> dict | None:
    """The META of the group an invite code opens, or None."""
    invite = table("GROUPS_TABLE").get_item(Key={"pk": f"INVITE#{code}", "sk": "GROUP"}).get("Item")
    return invite and _get(invite["gid"], "META")


def join(sub: str, code: str) -> dict:
    """
    Adds the caller by invite code, or files a join request when the group
    needs the owner's approval. `pending` says which happened.
    """
    invite = table("GROUPS_TABLE").get_item(Key={"pk": f"INVITE#{code}", "sk": "GROUP"}).get("Item")
    if invite is None:
        raise NotFoundError("That invite link doesn't match a group")
    gid = invite["gid"]
    group = meta(gid)
    if group.get("approval") and not is_member(gid, sub):
        notif, put = notifications.put(
            group["createdBy"], "group_join_request", sub, group=gid, groupName=group["name"]
        )
        request = {"Item": {**_key(gid, f"REQUEST#{sub}"), "at": _now(), "notif": notif}}
        # Asking twice leaves the first request, and its notification, standing.
        transact(
            [("Put", {**request, "ConditionExpression": "attribute_not_exists(pk)"}), put],
            "GROUPS_TABLE",
        )
        return {"id": gid, "name": group["name"], "pending": True}
    transact(_joins(gid, sub), "GROUPS_TABLE")
    return {"id": gid, "name": group["name"], "pending": False}


def invite(gid: str, by: str, to: str) -> str:
    """A member invites `to`. Returns member when they're in already, else invited."""
    group = meta(gid)
    if is_member(gid, to):
        return "member"
    notif, put = notifications.put(to, "group_invite", by, group=gid, groupName=group["name"])
    item = {**_key(gid, f"INVITED#{to}"), "by": by, "at": _now(), "notif": notif}
    # A second invite is a no-op, so nobody gets a notification per member who asks.
    transact(
        [("Put", {"Item": item, "ConditionExpression": "attribute_not_exists(pk)"}), put],
        "GROUPS_TABLE",
    )
    return "invited"


def respond(gid: str, sub: str, accept: bool) -> None:
    """The invitee accepts, joining the group, or declines."""
    invited = _get(gid, f"INVITED#{sub}")
    if invited is None:
        raise NotFoundError("That invite has been withdrawn")
    drop = (
        "Delete",
        {"Key": _key(gid, f"INVITED#{sub}"), "ConditionExpression": "attribute_exists(pk)"},
    )
    if not transact([drop, *(_joins(gid, sub) if accept else [])], "GROUPS_TABLE"):
        raise NotFoundError("That invite has been withdrawn")
    notifications.resolve(sub, invited.get("notif"), "accepted" if accept else "declined")


def answer(gid: str, owner: str, sub: str, accept: bool) -> None:
    """The owner lets a join request in, or turns it away."""
    request = _get(gid, f"REQUEST#{sub}")
    if request is None:
        raise NotFoundError("No join request from that user")
    drop = (
        "Delete",
        {"Key": _key(gid, f"REQUEST#{sub}"), "ConditionExpression": "attribute_exists(pk)"},
    )
    items = [drop]
    if accept:
        name = meta(gid)["name"]
        _, put = notifications.put(sub, "group_join_accepted", owner, group=gid, groupName=name)
        items += [*_joins(gid, sub), put]
    if not transact(items, "GROUPS_TABLE"):
        raise NotFoundError("No join request from that user")
    notifications.resolve(owner, request.get("notif"), "accepted" if accept else "declined")


def rename(gid: str, name: str) -> None:
    table("GROUPS_TABLE").update_item(
        Key=_key(gid, "META"),
        UpdateExpression="SET #name = :name",
        ConditionExpression="attribute_exists(pk)",
        ExpressionAttributeNames={"#name": "name"},
        ExpressionAttributeValues={":name": name},
    )


def set_approval(gid: str, on: bool) -> None:
    table("GROUPS_TABLE").update_item(
        Key=_key(gid, "META"),
        UpdateExpression="SET approval = :on",
        ConditionExpression="attribute_exists(pk)",
        ExpressionAttributeValues={":on": on},
    )


def remove(gid: str, sub: str) -> None:
    """Takes a member out; the owner's own membership is never removed this way."""
    transact(_leaves(gid, sub), "GROUPS_TABLE")


def delete(gid: str) -> None:
    """
    Removes every row of the group. Links and members go first and META last, so
    a failure partway leaves a group that still reads as whole to its owner, who
    can delete again. Pending invites and requests take their notifications along.
    """
    tbl = table("GROUPS_TABLE")
    rows = query_all(tbl, f"GROUP#{gid}")
    group = next(r for r in rows if r["sk"] == "META")
    with tbl.batch_writer() as batch:
        for r in rows:
            kind, _, sub = r["sk"].partition("#")
            if kind == "MEMBER":
                batch.delete_item(Key={"pk": f"USER#{sub}", "sk": f"GROUP#{gid}"})
            if kind in ("MEMBER", "INVITED", "REQUEST"):
                batch.delete_item(Key=_key(gid, r["sk"]))
        batch.delete_item(Key={"pk": f"INVITE#{group['inviteCode']}", "sk": "GROUP"})
    tbl.delete_item(Key=_key(gid, "META"))
    for r in rows:
        kind, _, sub = r["sk"].partition("#")
        if kind == "INVITED":
            notifications.drop(sub, r.get("notif"))
        elif kind == "REQUEST":
            notifications.drop(group["createdBy"], r.get("notif"))


def forget(sub: str) -> None:
    """
    Takes a deleted account out of every group it's in. A group it owns passes
    to the member who joined first, or goes entirely when nobody else is left.
    """
    tbl = table("GROUPS_TABLE")
    for link in query_all(tbl, f"USER#{sub}"):
        gid = link["sk"].removeprefix("GROUP#")
        rows = query_all(tbl, f"GROUP#{gid}")
        group = next((r for r in rows if r["sk"] == "META"), None)
        items = _leaves(gid, sub)
        if group and group["createdBy"] == sub:
            heirs = sorted(
                (r["joinedAt"], r["sk"].removeprefix("MEMBER#"))
                for r in rows
                if r["sk"].startswith("MEMBER#") and r["sk"] != f"MEMBER#{sub}"
            )
            if not heirs:
                delete(gid)
                continue
            items.append(
                (
                    "Update",
                    {
                        "Key": _key(gid, "META"),
                        "UpdateExpression": "SET createdBy = :heir",
                        "ConditionExpression": "createdBy = :sub",
                        "ExpressionAttributeValues": {":heir": heirs[0][1], ":sub": sub},
                    },
                )
            )
        if not transact(items, "GROUPS_TABLE"):
            raise RuntimeError(f"handing over group {gid} conflicted")


def members(gid: str) -> set[str]:
    rows = query_all(table("GROUPS_TABLE"), f"GROUP#{gid}")
    return {r["sk"].removeprefix("MEMBER#") for r in rows if r["sk"].startswith("MEMBER#")}


def _subs(rows: list[dict], kind: str) -> list[str]:
    return [r["sk"].removeprefix(kind) for r in rows if r["sk"].startswith(kind)]


def mine(sub: str) -> list[dict]:
    """
    The caller's groups, oldest first, each with its members' names and avatars,
    who is invited, and, for the owner only, who is asking to join.
    """
    tbl = table("GROUPS_TABLE")
    links = sorted(query_all(tbl, f"USER#{sub}"), key=lambda r: r["joinedAt"])
    groups = []
    for link in links:
        gid = link["sk"].removeprefix("GROUP#")
        rows = query_all(tbl, f"GROUP#{gid}")
        group = next((r for r in rows if r["sk"] == "META"), None)
        if group is None:
            # A delete in progress: the link outlived the group by a moment.
            continue
        owner = group["createdBy"]
        members = _subs(rows, "MEMBER#")
        groups.append(
            {
                "id": gid,
                "name": group["name"],
                "inviteCode": group["inviteCode"],
                "owner": owner,
                "approval": bool(group.get("approval")),
                "members": members,
                # Someone invited who then joined by the link keeps a stale invite row.
                "invited": [i for i in _subs(rows, "INVITED#") if i not in members],
                "requests": _subs(rows, "REQUEST#") if owner == sub else [],
            }
        )

    lists = ("members", "invited", "requests")
    profiles = cards({s for g in groups for k in lists for s in g[k]})
    for g in groups:
        for k in lists:
            g[k] = [profiles[s] for s in g[k]]
    return groups
