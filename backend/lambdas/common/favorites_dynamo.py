"""
armchair-favorites: one item per season and episode, written by cron_favorites.

    pk FAV#{show}#{season}   sk EP#{nn}   entries, market, computedAt

Nothing here decides what a caller sees: common/favorites.for_viewer does.
"""

from __future__ import annotations

import json
from datetime import UTC
from decimal import Decimal
from zoneinfo import ZoneInfo

from lambdas.common import window
from lambdas.common.dynamo import query_all, table


def favorites_pk(show: str, season: int) -> str:
    return f"FAV#{show}#{season}"


def _plain(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


def snapshots(show: str, season: int) -> dict[int, dict]:
    rows = query_all(table("FAVORITES_TABLE"), favorites_pk(show, season))
    return {int(r["sk"].removeprefix("EP#")): _plain(r) for r in rows}


def write(show: str, season: int, n: int, item: dict) -> None:
    body = json.loads(json.dumps(item), parse_float=Decimal)
    table("FAVORITES_TABLE").put_item(
        Item={"pk": favorites_pk(show, season), "sk": f"EP#{n:02d}", **body}
    )


def starts(show: str, meta: dict, rows: list[dict]) -> dict[int, str | None]:
    """Each episode's start as a UTC ISO stamp: a DWTS air time, a Traitors release."""
    out = {}
    for r in rows:
        if not r["sk"].startswith("EP#"):
            continue
        n = int(r["sk"].removeprefix("EP#"))
        if show != "dwts":
            out[n] = r.get("releaseAt")
            continue
        at = window.airs_at(r, ZoneInfo(meta["timezone"]))
        out[n] = at and at.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return out


def next_starts(start: dict[int, str | None]) -> dict[int, str | None]:
    """Episode n mapped to when n + 1 starts; 0 is the premiere."""
    return {n: start.get(n + 1) for n in [0, *start]}


def latest(start: dict[int, str | None], now: str) -> int:
    """The newest episode out, 0 before the premiere."""
    return max((n for n, at in start.items() if at is not None and at <= now), default=0)
