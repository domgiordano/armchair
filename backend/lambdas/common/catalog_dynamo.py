"""Catalog writes shared by scripts/seed_traitors_season.py and cron_discover_traitors."""

from __future__ import annotations


def write(table, rows: list[dict], keep: set[str]) -> None:
    """Updates rather than puts, so attributes the poller wrote survive a re-seed."""
    for row in rows:
        attrs = {k: v for k, v in row.items() if k not in ("pk", "sk")}
        sets = [
            f"#a{i} = if_not_exists(#a{i}, :a{i})" if k in keep else f"#a{i} = :a{i}"
            for i, k in enumerate(attrs)
        ]
        table.update_item(
            Key={"pk": row["pk"], "sk": row["sk"]},
            UpdateExpression="SET " + ", ".join(sets),
            ExpressionAttributeNames={f"#a{i}": k for i, k in enumerate(attrs)},
            ExpressionAttributeValues={f":a{i}": v for i, v in enumerate(attrs.values())},
        )
