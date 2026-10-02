"""
GET /traitors/credits?season=tus-5 - the season's headshots and who made them, for the Credits page.

    [{id, name, image, source, sourceUrl, author, license}]

One entry per player with a headshot, by name. `author` and `license` are null where the
source didn't give them. Headshots are not gated, so any caller may read any season.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, caller_sub, ok, query
from lambdas.common.episodes_dynamo import season_rows
from lambdas.common.traitors_dynamo import season_parts, traitors_ref
from lambdas.common.traitors_gate import credit, player_id


@api_handler("traitors_credits")
def handler(event, context):
    caller_sub(event)
    show, number = traitors_ref(query(event))
    _, _, players = season_parts(season_rows(show, number), show, number)
    return ok(
        [
            {
                "id": player_id(p),
                "name": p["name"],
                "image": p["headshot"]["image"],
                **credit(p["headshot"]),
            }
            for p in sorted(players, key=lambda p: p["name"])
            if p.get("headshot")
        ]
    )
