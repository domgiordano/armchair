"""Catalog items for a Traitors season, built from a parsed season page.

Shared by scripts/seed_traitors_season.py and, later, season discovery. Pure: no AWS.
The editions, and why a slug is an edition: docs/features/traitors/PLAN.md "Editions as shows".
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from lambdas.common.people import slug
from lambdas.common.traitors_parse import aliases

# Local release time of an episode on its air date. A season can override it in META
# (`releaseTime`): the Peacock drop time for US season 6 is unknown (RESEARCH open question 1).
EDITIONS = {
    "tus": {"tz": "America/New_York", "time": "20:00", "firstRoundTable": 2},
    "tuk": {"tz": "Europe/London", "time": "20:00", "firstRoundTable": 2},
    "tukc": {"tz": "Europe/London", "time": "20:00", "firstRoundTable": 3},
}


def release_times(episodes: list[dict], tz: str, at: str) -> dict[int, str]:
    """UTC release per episode. A second episode on the same night follows an hour later."""
    zone = ZoneInfo(tz)
    out: dict[int, str] = {}
    previous: datetime | None = None
    for e in sorted(episodes, key=lambda e: e["n"]):
        start = datetime.fromisoformat(f"{e['date']}T{at}").replace(tzinfo=zone)
        if previous and start <= previous:
            start = previous + timedelta(hours=1)
        previous = start
        out[e["n"]] = start.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
    return out


def items(
    show: str,
    number: int,
    page: dict,
    parsed: dict,
    *,
    current: bool,
    open_at: str,
    release_time: str | None = None,
    headshots: dict[str, dict] | None = None,
) -> list[dict]:
    """META, the season-picker row, one EP per episode and one PLAYER per contestant.

    Nothing gated is written here: factions, exits and results come from the poller.
    `open_at` (UTC) closes every episode released before it: those show results and take no picks.
    """
    edition = EDITIONS[show]
    pk = f"SEASON#{show}#{number}"
    at = release_time or edition["time"]
    releases = release_times(parsed["episodes"], edition["tz"], at)
    year = int(parsed["episodes"][0]["date"][:4]) if parsed["episodes"] else None
    names = [p["name"] for p in parsed["contestants"]]
    short = aliases(names)

    rows = [
        {
            "pk": pk,
            "sk": "META",
            "pageid": page["pageid"],
            "wikiTitle": page["title"],
            "timezone": edition["tz"],
            "releaseTime": at,
            "episodes": len(parsed["episodes"]),
            "openAt": open_at,
            "current": current,
        },
        {
            "pk": f"SEASONS#{show}",
            "sk": f"SEASON#{number:03d}",
            "id": f"{show}-{number}",
            "number": number,
            "title": page["title"],
            "year": year,
            "current": current,
        },
    ]
    rows += [
        {
            "pk": pk,
            "sk": f"EP#{e['n']:02d}",
            "title": e["title"],
            "airDate": e["date"],
            "releaseAt": releases[e["n"]],
            "noRoundTable": e["n"] < edition["firstRoundTable"],
        }
        for e in parsed["episodes"]
    ]
    rows += [
        {
            "pk": pk,
            "sk": f"PLAYER#{slug(name)}",
            "name": name,
            "aliases": sorted(a for a, full in short.items() if full == name and a != name.lower()),
            "headshot": (headshots or {}).get(name),
        }
        for name in names
    ]
    return rows
