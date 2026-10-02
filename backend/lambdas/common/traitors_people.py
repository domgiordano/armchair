"""
The Traitors people index, in DWTS's shape (common/people.py) so people_search reads it:

    PERSON#{show}#{id}  META          name, roles, headshot, seasons: [{season, finish, faction}]
    PEOPLE#{show}       PERSON#{id}   name, roles, headshot image, season numbers

An id is the PLAYER id, so one person across an edition's seasons is one PERSON. A
season's `finish` ({how, ep}) and `faction` are written only once it is finished; the
current season is listed bare, since its exits are gated per episode.
"""

from __future__ import annotations

from lambdas.common.catalog_dynamo import write
from lambdas.common.people import person, slug
from lambdas.common.traitors_gate import player_id
from lambdas.common.traitors_publish import final

ROLES = ["player"]


def index(catalog, show: str, number: int, players: list[dict], cast: list[dict] | None) -> None:
    """Merges one season into its players' PERSON and PEOPLE rows. `cast` is the parsed
    Contestants table of a finished season, None for one still running."""
    ended = {slug(p["name"]): final(p) for p in cast or []}
    rows = []
    for player in players:
        pid = player_id(player)
        stint: dict = {"season": number}
        if pid in ended:
            stint["faction"], stint["finish"] = ended[pid]
        have = person(show, pid) or {}
        seasons = [s for s in have.get("seasons", []) if int(s["season"]) != number]
        seasons = sorted([*seasons, stint], key=lambda s: int(s["season"]))
        shot = player.get("headshot") or have.get("headshot")
        rows += [
            {
                "pk": f"PERSON#{show}#{pid}",
                "sk": "META",
                "name": player["name"],
                "roles": ROLES,
                "headshot": shot,
                "seasons": seasons,
            },
            {
                "pk": f"PEOPLE#{show}",
                "sk": f"PERSON#{pid}",
                "name": player["name"],
                "roles": ROLES,
                "headshot": shot and shot["image"],
                "seasons": [int(s["season"]) for s in seasons],
            },
        ]
    write(catalog, rows, keep=set())
