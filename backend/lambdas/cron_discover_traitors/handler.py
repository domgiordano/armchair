"""
EventBridge Scheduler, daily: find each edition's seasons on its main Wikipedia article,
seed any season page with a cast and dated episodes, and move the `current` flag.

A season already in the catalog only gets its episodes and players refreshed, keeping its
openAt and any per-season releaseTime. docs/features/traitors/PLAN.md "Future seasons".
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime, timedelta

from boto3.dynamodb.conditions import Key

from lambdas.common.catalog_dynamo import write
from lambdas.common.dynamo import query_all, table
from lambdas.common.traitors_catalog import EDITIONS, items
from lambdas.common.traitors_parse import season, seasons
from lambdas.common.wiki_fetch import latest, pageids

WEEK = timedelta(days=7)


def stamp(t: datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def current_season(releases: dict[int, list[datetime]], now: datetime) -> int | None:
    """A season is current from a week before its first episode to a week after its last.

    Between seasons the latest one with an episode out stays current.
    """
    live = [n for n, r in releases.items() if r and min(r) - WEEK <= now < max(r) + WEEK]
    if live:
        return max(live)
    return max((n for n, r in releases.items() if r and min(r) <= now), default=None)


def seed(catalog, show: str, number: int, page: dict, parsed: dict, now: datetime) -> bool:
    """Writes the season's items; True when it is new to the catalog."""
    pk = f"SEASON#{show}#{number}"
    found = catalog.query(KeyConditionExpression=Key("pk").eq(pk) & Key("sk").eq("META"))
    meta = found["Items"][0] if found["Items"] else None
    rows = items(
        show,
        number,
        page,
        parsed,
        current=False,
        open_at=stamp(now),
        release_time=meta["releaseTime"] if meta else None,
    )
    if meta:
        rows = [r for r in rows if r["sk"].startswith(("EP#", "PLAYER#"))]
        rows.append({"pk": pk, "sk": "META", "episodes": len(parsed["episodes"])})
    write(catalog, rows, keep={"openAt"})
    return meta is None


def flip(catalog, show: str, now: datetime) -> int | None:
    """Sets `current` on META and the season-picker row of exactly one season, if any."""
    index = query_all(catalog, f"SEASONS#{show}")
    releases = {}
    for row in index:
        number = int(row["number"])
        eps = query_all(catalog, f"SEASON#{show}#{number}")
        releases[number] = [
            datetime.strptime(e["releaseAt"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
            for e in eps
            if e["sk"].startswith("EP#")
        ]
    pick = current_season(releases, now)
    for row in index:
        on = int(row["number"]) == pick
        if bool(row.get("current")) == on:
            continue
        keys = [(f"SEASON#{show}#{int(row['number'])}", "META"), (row["pk"], row["sk"])]
        write(catalog, [{"pk": pk, "sk": sk, "current": on} for pk, sk in keys], keep=set())
    return pick


def handler(event, context):
    now = datetime.fromtimestamp(time.time(), UTC)
    catalog = table("CATALOG_TABLE")
    for show, edition in EDITIONS.items():
        titles = seasons(latest(edition["article"])["content"])
        pages = pageids(list(titles.values()))
        seeded, refreshed, skipped, failed = [], [], [], []
        for number, title in titles.items():
            page = pages.get(title)
            try:
                parsed = season(latest(page["pageid"])["content"]) if page else None
            except Exception as e:  # noqa: BLE001 -- any parse bug, logged and skipped
                # One bad page must not stop the other seasons; US season 2's cast table
                # crashed the parser on 2026-10-02 (rev 1376555148). Retried tomorrow.
                failed.append({"season": number, "error": repr(e)})
                continue
            if not parsed or not parsed["contestants"] or not parsed["episodes"]:
                skipped.append(number)
                continue
            new = seed(catalog, show, number, page, parsed, now)
            (seeded if new else refreshed).append(number)
        pick = flip(catalog, show, now)
        # A bare JSON line, so Logs Insights discovers the fields without a parse step.
        print(
            json.dumps(
                {
                    "show": show,
                    "found": list(titles),
                    "seeded": seeded,
                    "refreshed": refreshed,
                    "skipped": skipped,
                    "failed": failed,
                    "current": f"{show}-{pick}" if pick else None,
                }
            )
        )
