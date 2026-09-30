"""
GET /seasons/list[?show=dwts] - every season of a show for the season picker, newest first.

Each is {id, number, year, current}; `current` marks the default season. Read from the
SEASONS#<show> index partition that seed_season.py writes beside each season.
"""

from __future__ import annotations

import re

from lambdas.common.api import ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.episodes_dynamo import season_index

SHOW = re.compile(r"[a-z]+")


@api_handler("seasons_list")
def handler(event, context):
    caller_sub(event)
    show = query(event).get("show") or "dwts"
    if not SHOW.fullmatch(show):
        raise ValidationError("show must look like dwts", field="show")
    seasons = [
        {"id": s["id"], "number": int(s["number"]), "year": int(s["year"]), "current": s["current"]}
        for s in season_index(show)
    ]
    return ok({"show": show, "seasons": sorted(seasons, key=lambda s: -s["number"])})
