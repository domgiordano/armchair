"""
EventBridge Scheduler, every minute: poll each edition's current Traitors season while an
episode is fresh, and publish the results its Wikipedia page settles.

Fresh means released within the last 6 hours: every tick. Then hourly, at minute 0, for
72 hours, for edits that land late. Off-air, a tick is three catalog Queries and no fetch.
Only episodes already released are published, so a page that knows the result early
(finale cells appeared 9 h before a Peacock drop) shows nothing before release.

Results go provisional -> confirmed (common/traitors_publish.py). A confirmed round table
or murder marks the PLAYER's exit, and every episode it touches is reconciled into the
points board. Once the page names the winners, the winner bets are settled.

Invoke with {"backfill": true} to publish every released episode of every current season
at once, confirmed with no window: for episodes that aired before the season was seeded.
{"backfill": true, "season": "tus-3"} does the same for that one season, current or not;
a finished season also gets every player's final faction and exit.
"""

from __future__ import annotations

import json
import time

from lambdas.common import confirm
from lambdas.common.dynamo import query_all, table
from lambdas.common.traitors_dynamo import season_parts, traitors_ref
from lambdas.common.traitors_parse import season, voting_grid
from lambdas.common.traitors_publish import epoch, publish_season
from lambdas.common.wiki_fetch import latest

SHOWS = ("tus", "tuk", "tukc")
LIVE, SWEEP = 6 * 3600, 72 * 3600
# A redirect left by a page move is ~150 bytes; a real season page is 20 KB and up.
MIN_PAGE = 5000


def due(episodes: list[dict], t: int) -> bool:
    ages = [t - epoch(e["releaseAt"]) for e in episodes]
    return any(0 <= a < LIVE for a in ages) or (
        t % 3600 < 60 and any(LIVE <= a < SWEEP for a in ages)
    )


def summary(parsed: dict) -> dict:
    return {
        "roundTables": [
            {
                "ep": rt["ep"],
                "banished": rt["banished"],
                "complete": rt["complete"],
                "declared": rt["declared"],
                "top3": sorted(rt["firstVote"].items(), key=lambda kv: -kv[1])[:3],
                "unresolved": rt["unresolved"],
            }
            for rt in parsed["roundTables"]
        ],
        "murdered": parsed["murdered"],
        "recruited": parsed["recruited"],
        "winners": parsed["winners"],
    }


def poll(show: str, number: int, rows: list[dict], t: int, window: int) -> bool:
    """Fetches, parses and publishes one season. False when the page is no season page."""
    meta = next(r for r in rows if r["sk"] == "META")
    page = latest(int(meta["pageid"]))
    line = {"season": f"{show}-{number}", "revid": page["revid"], "timestamp": page["timestamp"]}
    if len(page["content"]) < MIN_PAGE or voting_grid(page["content"]) is None:
        # A bare JSON line, so Logs Insights discovers the fields without a parse step.
        print(
            json.dumps({**line, "skipped": "no elimination table", "bytes": len(page["content"])})
        )
        return False
    parsed = season(page["content"])
    done = publish_season(show, number, rows, parsed, page["revid"], t, window)
    print(json.dumps({**line, **done, **summary(parsed)}, ensure_ascii=False))
    return True


def handler(event, context):
    event = event or {}
    backfill = event.get("backfill") is True
    t = int(time.time())
    catalog = table("CATALOG_TABLE")
    if backfill and event.get("season"):
        show, number = traitors_ref(event)
        rows = query_all(catalog, f"SEASON#{show}#{number}")
        season_parts(rows, show, number)
        return {"polled": [f"{show}-{number}"] if poll(show, number, rows, t, 0) else []}

    polled = []
    for show in SHOWS:
        for index in query_all(catalog, f"SEASONS#{show}"):
            if not index.get("current"):
                continue
            number = int(index["number"])
            rows = query_all(catalog, f"SEASON#{show}#{number}")
            if not backfill and not due([r for r in rows if r["sk"].startswith("EP#")], t):
                continue
            if poll(show, number, rows, t, 0 if backfill else confirm.WINDOW):
                polled.append(index["id"])
    return {"polled": polled}
