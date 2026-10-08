"""
armchair-email: the sent log, run counts and suppressions behind every email.

    SUPPRESS  {address}  reason, at   SES reported a hard bounce or a complaint
"""

from __future__ import annotations

from datetime import UTC, datetime

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
