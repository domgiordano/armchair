"""
GET /traitors/history?season=tus-3 - a finished Traitors season in one read, for the voting-table view.

    {season, title, winners: [{id, faction}],
     players: [{id, name, headshot, faction, exit: {ep, how} | null}],
     episodes: [{ep, title, airDate, releaseAt,
                 recap: {text, source: "wikipedia" | "fandom", sourceUrl} | null,
                 roundTable: {banished, faction, firstVote: {id: n},
                              ballots: {voter id: target id}, daggers: [id]} | null,
                 murdered: [id] | null, recruited: [id] | null, shields: [id] | null}]}

Only confirmed results; null where the page never settled one. `ballots` is each
voter's first vote and `daggers` whose counted twice; a round table published before
they were parsed has neither. A past season has no gate (PLAN "Gate" rule 5), so this
needs no picks. The current season is 403: it goes through /traitors/episode, one
gated episode at a time.
"""

from __future__ import annotations

from lambdas.common.api import ForbiddenError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, season_pk
from lambdas.common.traitors_dynamo import season_parts, traitors_ref
from lambdas.common.traitors_gate import ep_number, player_id, shown


@api_handler("traitors_history")
def handler(event, context):
    caller_sub(event)
    show, number = traitors_ref(query(event))
    (rows,) = query_many([("CATALOG_TABLE", season_pk(show, number))])
    meta, episodes, players = season_parts(rows, show, number)
    if meta.get("current"):
        raise ForbiddenError("The current season is read an episode at a time", current=True)

    stored = query_many(
        [("PERFORMANCES_TABLE", episode_pk(show, number, ep_number(e))) for e in episodes]
    )
    timeline = []
    for e, evts in zip(episodes, stored):
        got = {r["sk"].removeprefix("EVT#"): shown(r) for r in evts}
        murder, recruit, shield = got.get("MURDER"), got.get("RECRUIT"), got.get("SHIELD")
        timeline.append(
            {
                "ep": ep_number(e),
                "title": e.get("title"),
                "airDate": e.get("airDate"),
                "releaseAt": e["releaseAt"],
                "recap": e.get("recap"),
                "roundTable": got.get("RT"),
                "murdered": murder and murder["victims"],
                "recruited": recruit and recruit["recruits"],
                "shields": shield and shield["shields"],
            }
        )
    cast = [
        {
            "id": player_id(p),
            "name": p["name"],
            "headshot": p.get("headshot") and p["headshot"]["image"],
            "faction": p.get("faction"),
            "exit": p.get("exit"),
        }
        for p in sorted(players, key=lambda p: p["name"])
    ]
    return ok(
        {
            "season": f"{show}-{number}",
            "title": meta.get("wikiTitle"),
            "winners": [
                {"id": p["id"], "faction": p["faction"]}
                for p in cast
                if (p["exit"] or {}).get("how") == "winner"
            ],
            "players": cast,
            "episodes": timeline,
        }
    )
