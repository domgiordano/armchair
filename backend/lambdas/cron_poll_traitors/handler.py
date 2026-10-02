"""
EventBridge Scheduler, every minute: poll each edition's current Traitors season while an
episode is fresh, and log what its Wikipedia page says. Log-only for now; publishing
comes with the confirm and release-time guards (docs/features/traitors/PLAN.md PR 9).

Fresh means released within the last 6 hours: every tick. Then hourly, at minute 0, for
72 hours, for edits that land late. Off-air, a tick is three catalog Queries and no fetch.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime

from lambdas.common.dynamo import query_all, table
from lambdas.common.traitors_parse import season, voting_grid
from lambdas.common.wiki_fetch import latest

SHOWS = ("tus", "tuk", "tukc")
LIVE, SWEEP = 6 * 3600, 72 * 3600
# A redirect left by a page move is ~150 bytes; a real season page is 20 KB and up.
MIN_PAGE = 5000


def epoch(stamp: str) -> int:
    return int(datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC).timestamp())


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


def handler(event, context):
    t = int(time.time())
    catalog = table("CATALOG_TABLE")
    polled = []
    for show in SHOWS:
        for index in query_all(catalog, f"SEASONS#{show}"):
            if not index.get("current"):
                continue
            rows = query_all(catalog, f"SEASON#{show}#{index['number']}")
            episodes = [r for r in rows if r["sk"].startswith("EP#")]
            if not due(episodes, t):
                continue
            meta = next(r for r in rows if r["sk"] == "META")
            page = latest(int(meta["pageid"]))
            line = {"season": index["id"], "revid": page["revid"], "timestamp": page["timestamp"]}
            if len(page["content"]) < MIN_PAGE or voting_grid(page["content"]) is None:
                # A bare JSON line, so Logs Insights discovers the fields without a parse step.
                print(
                    json.dumps(
                        {**line, "skipped": "no elimination table", "bytes": len(page["content"])}
                    )
                )
                continue
            print(json.dumps({**line, **summary(season(page["content"]))}, ensure_ascii=False))
            polled.append(index["id"])
    return {"polled": polled}
