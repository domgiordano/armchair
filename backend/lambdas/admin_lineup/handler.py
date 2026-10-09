"""
GET /admin/lineup?season=dwts-35&ep=06 - one night's dances in their running order,
and where that order came from. Admins only.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.api import api_handler, ok, query
from lambdas.common.episodes_dynamo import ref
from lambdas.common.lineup import night


@api_handler("admin_lineup")
def handler(event, context):
    require_admin(event)
    show, season, ep = ref(query(event))
    episode, dances = night(show, season, ep)
    return ok(
        {
            "season": f"{show}-{season}",
            "ep": ep,
            "airDate": episode.get("airDate"),
            "theme": episode.get("theme"),
            "runningOrder": bool(episode.get("runningOrder")),
            "orderSource": episode.get("orderSource"),
            "orderAt": episode.get("orderAt"),
            "dances": dances,
        }
    )
