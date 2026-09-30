"""
Notifications, in armchair-social beside the graph they report on:

    NOTIF#{sub}  {iso time}#{rand}  type, from, read, state?, group?, groupName?, expiresAt

`type` is friend_request | friend_accepted | group_invite | group_join_request
| group_join_accepted. The actionable ones (a request or an invite) carry
`state`: pending until answered, then accepted or declined, so the list can
drop its buttons. DynamoDB TTL deletes each one EXPIRE_DAYS after it was
written, which keeps a user's partition small enough to read whole.
"""

from __future__ import annotations

import re
import secrets
import time
from datetime import UTC, datetime

from botocore.exceptions import ClientError

from lambdas.common.dynamo import query_all, table

EXPIRE_DAYS = 90
ACTIONABLE = {"friend_request", "group_invite", "group_join_request"}
ID = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00#[A-Za-z0-9_-]{8}")


def _pk(sub: str) -> str:
    return f"NOTIF#{sub}"


def put(to: str, kind: str, frm: str, **group: str) -> tuple[str, tuple[str, dict]]:
    """(id, a transaction Put) for one new notification to `to`."""
    sk = f"{datetime.now(UTC).isoformat(timespec='seconds')}#{secrets.token_urlsafe(6)}"
    item = {
        "pk": _pk(to),
        "sk": sk,
        "type": kind,
        "from": frm,
        "read": False,
        "expiresAt": int(time.time()) + EXPIRE_DAYS * 86400,
        **group,
    }
    if kind in ACTIONABLE:
        item["state"] = "pending"
    # Named here so a groups transaction can carry it too.
    return sk, ("Put", {"TableName": table("SOCIAL_TABLE").name, "Item": item})


def resolve(sub: str, sk: str | None, state: str) -> None:
    """Marks an actionable notification answered. Gone already (TTL) is fine."""
    if not sk:
        return
    try:
        table("SOCIAL_TABLE").update_item(
            Key={"pk": _pk(sub), "sk": sk},
            UpdateExpression="SET #state = :state, #read = :t",
            ConditionExpression="attribute_exists(pk)",
            ExpressionAttributeNames={"#state": "state", "#read": "read"},
            ExpressionAttributeValues={":state": state, ":t": True},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise


def drop(sub: str, sk: str | None) -> None:
    """Deletes a notification that no longer means anything, like a withdrawn request."""
    if sk:
        table("SOCIAL_TABLE").delete_item(Key={"pk": _pk(sub), "sk": sk})


def listing(sub: str) -> list[dict]:
    """Unread first, then newest first. TTL deletes lag, so expired rows are dropped here."""
    now = int(time.time())
    rows = [r for r in query_all(table("SOCIAL_TABLE"), _pk(sub)) if r["expiresAt"] > now]
    rows.sort(key=lambda r: r["sk"], reverse=True)
    rows.sort(key=lambda r: r["read"])
    return rows


def mark_read(sub: str, sk: str) -> bool:
    """False when there is no such notification."""
    try:
        table("SOCIAL_TABLE").update_item(
            Key={"pk": _pk(sub), "sk": sk},
            UpdateExpression="SET #read = :t",
            ConditionExpression="attribute_exists(pk)",
            ExpressionAttributeNames={"#read": "read"},
            ExpressionAttributeValues={":t": True},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        return False
    return True


def mark_all_read(sub: str) -> None:
    for row in listing(sub):
        if not row["read"]:
            mark_read(sub, row["sk"])
