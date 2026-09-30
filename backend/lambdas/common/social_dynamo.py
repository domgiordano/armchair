"""
armchair-social: friendships, requests, blocks, personal invite codes and the
name search index. Family-level, so nothing here is keyed by show or season.

    USER#{a}     PEER#{b}      state, at, notif, blocking, blockedBy
    USER#{a}     CODE          code        a's personal invite code
    USER#{a}     NAME          nameSk, name, picture, avatarKind   a's current search row
    CODE#{code}  USER          sub
    NAME#{xy}    {name}#{sub}  sub, name, picture, avatarKind

A pair has one PEER item on each side, so every transition is a two-item
transaction. `state` is friend | outgoing (a asked b) | incoming (b asked a).
`blocking` means a blocked b and `blockedBy` means b blocked a; either one
clears `state` and keeps the pair apart. Unblocking can leave an item with
only its keys, which reads as no relationship. While a request is pending,
`notif` on both sides is the id of the requestee's notification, so answering
or withdrawing it can close that out.
"""

from __future__ import annotations

import re
import secrets
from datetime import UTC, datetime

from boto3.dynamodb.conditions import Key

from lambdas.common import notifications_dynamo as notifications
from lambdas.common.api import NotFoundError, ValidationError, text
from lambdas.common.dynamo import table, transact

SEARCH_LIMIT = 20
SUB = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
NO_BLOCK = "attribute_not_exists(blocking) AND attribute_not_exists(blockedBy)"


def target(source: dict, caller: str) -> str:
    """The other user's sub from a request body: a Cognito sub, and not the caller's."""
    sub = text(source, "sub")
    if not SUB.fullmatch(sub):
        raise ValidationError("sub is not a user id", field="sub")
    if sub == caller:
        raise ValidationError("That's you", field="sub")
    return sub


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _peer(a: str, b: str) -> dict:
    return {"pk": f"USER#{a}", "sk": f"PEER#{b}"}


def _transact(items: list[tuple[str, dict]]) -> bool:
    return transact(items, "SOCIAL_TABLE")


def _query(key) -> list[dict]:
    tbl = table("SOCIAL_TABLE")
    kwargs = {"KeyConditionExpression": key}
    items = []
    while True:
        page = tbl.query(**kwargs)
        items += page["Items"]
        if "LastEvaluatedKey" not in page:
            return items
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def status(item: dict | None) -> str | None:
    """friend | outgoing | incoming | blocked, or None for no relationship."""
    if not item:
        return None
    if item.get("blocking") or item.get("blockedBy"):
        return "blocked"
    return item.get("state")


def peer(a: str, b: str) -> dict | None:
    return table("SOCIAL_TABLE").get_item(Key=_peer(a, b), ConsistentRead=True).get("Item")


def peers(sub: str) -> dict[str, dict]:
    """Every PEER item on the caller's side, by the other user's sub."""
    rows = _query(Key("pk").eq(f"USER#{sub}") & Key("sk").begins_with("PEER#"))
    return {r["sk"].removeprefix("PEER#"): r for r in rows}


def _set_state(
    a: str, b: str, state: str, now: str, expect: str | None, notif: str | None = None
) -> tuple[str, dict]:
    """a's side moves to `state`, from `expect` or, when None, from no relationship."""
    values = {":state": state, ":at": now}
    update = "SET #state = :state, #at = :at"
    if notif:
        update += ", notif = :notif"
        values[":notif"] = notif
    else:
        update += " REMOVE notif"
    if expect is None:
        condition = f"attribute_not_exists(#state) AND {NO_BLOCK}"
    else:
        condition = "#state = :expect"
        values[":expect"] = expect
    return (
        "Update",
        {
            "Key": _peer(a, b),
            "UpdateExpression": update,
            "ConditionExpression": condition,
            "ExpressionAttributeNames": {"#state": "state", "#at": "at"},
            "ExpressionAttributeValues": values,
        },
    )


def request(a: str, b: str) -> str:
    """
    a asks b. Asking someone who already asked you makes you friends. Returns
    the pair's status afterwards; a block in either direction reads as the
    user not existing, so it can't be probed for.
    """
    current = status(peer(a, b))
    if current == "blocked":
        raise NotFoundError("No such user")
    if current == "incoming":
        return accept(a, b)
    if current in ("friend", "outgoing"):
        return current
    now = _now()
    notif, put = notifications.put(b, "friend_request", a)
    if _transact(
        [
            _set_state(a, b, "outgoing", now, None, notif),
            _set_state(b, a, "incoming", now, None, notif),
            put,
        ]
    ):
        return "outgoing"
    # b asked, or blocked, in the same instant: report where the pair landed.
    return request(a, b)


def accept(a: str, b: str) -> str:
    """a accepts b's request, and b hears about it."""
    item = peer(a, b) or {}
    now = _now()
    _, put = notifications.put(b, "friend_accepted", a)
    if not _transact(
        [
            _set_state(a, b, "friend", now, "incoming"),
            _set_state(b, a, "friend", now, "outgoing"),
            put,
        ]
    ):
        raise NotFoundError("No friend request from that user")
    notifications.resolve(a, item.get("notif"), "accepted")
    return "friend"


def _settle(a: str, b: str, item: dict) -> None:
    """Closes out the notification behind a pending request that a just ended."""
    if item.get("state") == "incoming":
        notifications.resolve(a, item.get("notif"), "declined")
    elif item.get("state") == "outgoing":
        notifications.drop(b, item.get("notif"))


def unlink(a: str, b: str) -> None:
    """Removes a friend, cancels a's request or declines b's. Blocks are left alone."""
    item = peer(a, b)
    if status(item) not in ("friend", "outgoing", "incoming"):
        return
    remove = {
        "UpdateExpression": "REMOVE #state, #at, notif",
        "ConditionExpression": "attribute_exists(#state)",
        "ExpressionAttributeNames": {"#state": "state", "#at": "at"},
    }
    if _transact(
        [("Update", {"Key": _peer(a, b), **remove}), ("Update", {"Key": _peer(b, a), **remove})]
    ):
        _settle(a, b, item)


def block(a: str, b: str) -> None:
    """a blocks b: any friendship or request between them goes with it."""
    item = peer(a, b) or {}
    now = _now()

    def side(x: str, y: str, flag: str) -> tuple[str, dict]:
        return (
            "Update",
            {
                "Key": _peer(x, y),
                "UpdateExpression": f"SET {flag} = :t, #at = :at REMOVE #state, notif",
                "ExpressionAttributeNames": {"#state": "state", "#at": "at"},
                "ExpressionAttributeValues": {":t": True, ":at": now},
            },
        )

    if _transact([side(a, b, "blocking"), side(b, a, "blockedBy")]):
        _settle(a, b, item)


def unblock(a: str, b: str) -> None:
    def side(x: str, y: str, flag: str) -> tuple[str, dict]:
        return (
            "Update",
            {
                "Key": _peer(x, y),
                "UpdateExpression": f"REMOVE {flag}",
                "ConditionExpression": f"attribute_exists({flag})",
            },
        )

    _transact([side(a, b, "blocking"), side(b, a, "blockedBy")])


def invite_code(sub: str) -> str:
    """The caller's personal invite code, minted on first use."""
    tbl = table("SOCIAL_TABLE")
    key = {"pk": f"USER#{sub}", "sk": "CODE"}
    existing = tbl.get_item(Key=key, ConsistentRead=True).get("Item")
    if existing:
        return existing["code"]
    # 96 bits, like group codes: the code alone is enough to send a request.
    code = secrets.token_urlsafe(12)
    new = "attribute_not_exists(pk)"
    if _transact(
        [
            ("Put", {"Item": {**key, "code": code}, "ConditionExpression": new}),
            (
                "Put",
                {
                    "Item": {"pk": f"CODE#{code}", "sk": "USER", "sub": sub},
                    "ConditionExpression": new,
                },
            ),
        ]
    ):
        return code
    # A concurrent call minted one first.
    return tbl.get_item(Key=key, ConsistentRead=True)["Item"]["code"]


def code_owner(code: str) -> str | None:
    item = table("SOCIAL_TABLE").get_item(Key={"pk": f"CODE#{code}", "sk": "USER"}).get("Item")
    return item["sub"] if item else None


def normalize(name: str) -> str:
    return " ".join(name.split()).casefold()


def index_name(sub: str, name: str | None, picture: str | None, kind: str | None) -> None:
    """
    Keeps the caller's one search row in step with their profile. Rows live in
    a partition per first two letters, so a prefix search is one Query and no
    GSI. Writes nothing when the profile hasn't changed.
    """
    tbl = table("SOCIAL_TABLE")
    pointer_key = {"pk": f"USER#{sub}", "sk": "NAME"}
    pointer = tbl.get_item(Key=pointer_key).get("Item") or {}
    folded = normalize(name) if name else ""
    card = {"name": name, "picture": picture, "avatarKind": kind}
    if len(folded) < 2:
        card = {}

    if card and pointer.get("nameSk") and all(pointer.get(k) == v for k, v in card.items()):
        return
    if not card and not pointer:
        return

    items: list[tuple[str, dict]] = []
    old = pointer.get("nameSk")
    new = f"{folded}#{sub}" if card else None
    if old and old != new:
        items.append(("Delete", {"Key": {"pk": f"NAME#{old[:2]}", "sk": old}}))
    if new:
        row = {k: v for k, v in card.items() if v is not None}
        items.append(("Put", {"Item": {"pk": f"NAME#{folded[:2]}", "sk": new, "sub": sub, **row}}))
        items.append(("Put", {"Item": {**pointer_key, "nameSk": new, **row}}))
    else:
        items.append(("Delete", {"Key": pointer_key}))
    _transact(items)


def search(query: str) -> list[dict]:
    """Search rows whose name starts with `query` (already normalized, 2+ characters)."""
    tbl = table("SOCIAL_TABLE")
    page = tbl.query(
        KeyConditionExpression=Key("pk").eq(f"NAME#{query[:2]}") & Key("sk").begins_with(query),
        # Room for the caller and anyone blocked to be dropped afterwards.
        Limit=SEARCH_LIMIT + 10,
    )
    return page["Items"]
