"""
EventBridge Scheduler, every minute 8-10:59 pm ET on Mon and Tue: fetch the S35
page, parse the week being filled in, log one JSON line. Writes nothing.

This is the 10/6 dry run (PLAN.md PR 4). PR 10 swaps ALIASES for the catalog and
turns the log line into writes.
"""

from __future__ import annotations

import json
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from lambdas.common.wiki_parse import parse_week

PAGE = "Dancing with the Stars (American TV series) season 35"
USER_AGENT = "armchair/0.1 (https://github.com/domgiordano/armchair)"
API = "https://en.wikipedia.org/w/api.php"

# Copy of S35_ALIASES in backend/scripts/build_wiki_fixtures.py until PR 6 seeds the catalog.
ALIASES = {
    "Amber": "amber-glenn",
    "Ciara": "ciara-miller",
    "Conner L.": "conner-leavitt",
    "Connor": "connor-wood",
    "Connor W.": "connor-wood",
    "Ezra": "ezra-frech",
    "Giada": "giada-de-laurentiis",
    "Guillermo": "guillermo-rodriguez",
    "Harry": "harry-shum-jr",
    "Jackson": "jackson-olson",
    "Jenna": "jenna-dewan",
    "Julia": "julia-stiles",
    "Maura": "maura-higgins",
    "Sarah Jane": "sarah-jane-nader",
    "Tatyana": "tatyana-ali",
    "Taylor": "taylor-hanson",
    "Tyler": "tyler-cameron",
}


def fetch() -> dict:
    query = urlencode(
        {
            "action": "query",
            "prop": "revisions",
            "titles": PAGE,
            "rvprop": "ids|timestamp|content",
            "rvslots": "main",
            "format": "json",
            "formatversion": "2",
        }
    )
    req = Request(f"{API}?{query}", headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=10) as resp:
        return json.load(resp)["query"]["pages"][0]["revisions"][0]


def current_week(wikitext: str) -> dict | None:
    """The highest week with any table rows. Pre-show tables list couples with empty scores."""
    numbers = {int(n) for n in re.findall(r"^===\s*Week (\d+)", wikitext, flags=re.MULTILINE)}
    for n in sorted(numbers, reverse=True):
        week = parse_week(wikitext, n, ALIASES)
        if week and (week["performances"] or week["rejected"]):
            return week
    return None


def handler(event, context):
    rev = fetch()
    week = current_week(rev["slots"]["main"]["content"])
    line = {"revid": rev["revid"], "timestamp": rev["timestamp"], "week": week}
    # A bare JSON line, not the logger's prefixed format, so Logs Insights
    # discovers revid, week and the per-row fields without a parse step.
    print(json.dumps(line, default=float))
    return {"revid": rev["revid"], "week": week and week["week"]}
