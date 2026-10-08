"""
EventBridge Scheduler, every 15 minutes: write the favorites snapshots of each current
season (common/favorites.py). The newest episode out is recomputed every run, so it
follows the poller's scores and eliminations and the crowd's answers as they land.
An older episode is written once, if missing, and never again: that is what keeps the
board a viewer behind sees identical to the one computed before the next episode, and
its market price from before that episode started.

{"season": "dwts-35"} runs one season, current or not.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common import favorites, polymarket
from lambdas.common.dynamo import query_all, query_many, table
from lambdas.common.episodes_dynamo import SHOWS, episode_pk, season_pk, season_ref
from lambdas.common.favorites_dynamo import latest, snapshots, starts, write
from lambdas.common.logger import get_logger

log = get_logger(__file__)


def now() -> datetime:
    return datetime.now(UTC)


def _names(show: str, rows: list[dict]) -> dict[str, str]:
    """Folded celebrity or player name -> id, for matching market titles."""
    if show == "dwts":
        return {
            polymarket.fold(m["name"]): r["sk"].removeprefix("CONTESTANT#")
            for r in rows
            if r["sk"].startswith("CONTESTANT#")
            for m in r["members"]
            if m["role"] == "celebrity"
        }
    return {
        polymarket.fold(r["name"]): r["sk"].removeprefix("PLAYER#")
        for r in rows
        if r["sk"].startswith("PLAYER#")
    }


def _market(show: str, number: int, rows: list[dict], at: datetime, kept: dict | None):
    """
    The price now, or the one already stored for this episode when the fetch fails:
    a missed fetch shouldn't blank the board's odds until the next run.
    """
    try:
        return polymarket.market(show, number, _names(show, rows), at)
    except (OSError, ValueError) as e:
        log.warning("market fetch failed for %s-%d: %s", show, number, e)
        return kept


def run(show: str, number: int, at: datetime) -> list[int]:
    rows = query_all(table("CATALOG_TABLE"), season_pk(show, number))
    meta = next(r for r in rows if r["sk"] == "META")
    start = starts(show, meta, rows)
    newest = latest(start, at.strftime("%Y-%m-%dT%H:%M:%SZ"))
    stored = snapshots(show, number)
    due = [n for n in range(newest + 1) if n == newest or n not in stored]
    if not due:
        return []

    eps = list(range(1, newest + 1))
    pairs = [
        (t, episode_pk(show, number, n))
        for n in eps
        for t in ("PERFORMANCES_TABLE", "SCORES_TABLE")
    ]
    if show != "dwts":
        pairs.append(("SCORES_TABLE", f"WIN#{show}#{number}"))
    found = query_many(pairs)
    by_ep = {n: (found[2 * i], found[2 * i + 1]) for i, n in enumerate(eps)}
    bets = found[-1] if show != "dwts" else []

    written = []
    for n in due:
        cutoff = start.get(n + 1)
        if show == "dwts":
            contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
            entries = favorites.dwts(n, contestants, by_ep, cutoff)
        else:
            players = [r for r in rows if r["sk"].startswith("PLAYER#")]
            entries = favorites.traitors(n, players, by_ep, bets, cutoff)
        item = {
            "entries": entries,
            "computedAt": at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            # A backfilled older episode has no price from its own week.
            "market": _market(show, number, rows, at, (stored.get(n) or {}).get("market"))
            if n == newest
            else None,
        }
        write(show, number, n, item)
        written.append(n)
    return written


def handler(event, context):
    event = event or {}
    at = now()
    if event.get("season"):
        show, number = season_ref(event)
        return {"written": {f"{show}-{number}": run(show, number, at)}}
    out = {}
    catalog = table("CATALOG_TABLE")
    for show in SHOWS:
        for index in query_all(catalog, f"SEASONS#{show}"):
            if index.get("current"):
                out[index["id"]] = run(show, int(index["number"]), at)
    log.info("favorites written %s", out)
    return {"written": out}
