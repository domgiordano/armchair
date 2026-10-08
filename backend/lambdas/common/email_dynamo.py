"""
armchair-email: the sent log, run counts and suppressions behind every email.

    SUPPRESS  {address}  reason, at   SES reported a hard bounce or a complaint
"""

from __future__ import annotations

from datetime import UTC, datetime

from botocore.exceptions import ClientError

from lambdas.common.dynamo import query_all, table

SUPPRESS = "SUPPRESS"


def suppress(address: str, reason: str) -> None:
    table("EMAIL_TABLE").put_item(
        Item={
            "pk": SUPPRESS,
            "sk": address.strip().lower(),
            "reason": reason,
            "at": datetime.now(UTC).isoformat(timespec="seconds"),
        }
    )


def suppressed() -> set[str]:
    return {r["sk"] for r in query_all(table("EMAIL_TABLE"), SUPPRESS)}


def is_suppressed(address: str) -> bool:
    key = {"pk": SUPPRESS, "sk": address.strip().lower()}
    return "Item" in table("EMAIL_TABLE").get_item(Key=key)


# The sent log: one row per reader per email, claimed before the send so a
# rerun or an overlapping run can't send twice.
#     SENT#{type}#{event}  USER#{sub}  status (sent | failed), at, expiresAt
#     RUN#{type}           {event}     sent, failed, held, ..., lastAt, expiresAt
# A failed send flips its row to failed, which the next run may claim again. A
# crash between claim and send loses that one email rather than risking a double.
KEEP_DAYS = 180


def _expires(now: datetime) -> int:
    return int(now.timestamp()) + KEEP_DAYS * 86400


def claim(kind: str, event: str, sub: str, now: datetime) -> bool:
    try:
        table("EMAIL_TABLE").put_item(
            Item={
                "pk": f"SENT#{kind}#{event}",
                "sk": f"USER#{sub}",
                "status": "sent",
                "at": now.isoformat(timespec="seconds"),
                "expiresAt": _expires(now),
            },
            ConditionExpression="attribute_not_exists(sk) OR #status = :failed",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":failed": "failed"},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        return False
    return True


def release(kind: str, event: str, sub: str) -> None:
    table("EMAIL_TABLE").update_item(
        Key={"pk": f"SENT#{kind}#{event}", "sk": f"USER#{sub}"},
        UpdateExpression="SET #status = :failed",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":failed": "failed"},
    )


def record_run(kind: str, event: str, counts: dict[str, int], now: datetime) -> None:
    """Adds one run's outcome counts to the event's row, for the admin console."""
    if not counts:
        return
    names = {f"#c{i}": k for i, k in enumerate(counts)}
    values = {f":c{i}": n for i, n in enumerate(counts.values())}
    table("EMAIL_TABLE").update_item(
        Key={"pk": f"RUN#{kind}", "sk": event},
        UpdateExpression="ADD " + ", ".join(f"{n} :c{n[2:]}" for n in names)
        + " SET lastAt = :at, expiresAt = :exp",
        ExpressionAttributeNames=names,
        ExpressionAttributeValues={
            **values,
            ":at": now.isoformat(timespec="seconds"),
            ":exp": _expires(now),
        },
    )


def runs(kind: str) -> list[dict]:
    return query_all(table("EMAIL_TABLE"), f"RUN#{kind}")


def sent(kind: str, event: str) -> list[dict]:
    return query_all(table("EMAIL_TABLE"), f"SENT#{kind}#{event}")
