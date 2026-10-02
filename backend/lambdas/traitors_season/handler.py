"""
GET /traitors/season?season=tus-5 - a Traitors season's schedule and the caller's place in it.

Each episode carries how many of its events the caller has answered, which needs no gate:
it's the caller's own rows. Until the caller bets, a current season answers with
`needsBet` and the players they may bet on, and nothing else.
"""

from __future__ import annotations

import time

from lambdas.common.api import api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, season_pk
from lambdas.common.traitors_dynamo import bet, season_parts, traitors_ref
from lambdas.common.traitors_gate import (
    bet_roster,
    closed,
    ep_number,
    events,
    mine,
    needs_bet,
    released,
)


@api_handler("traitors_season")
def handler(event, context):
    sub = caller_sub(event)
    show, number = traitors_ref(query(event))
    rows, *_ = query_many([("CATALOG_TABLE", season_pk(show, number))])
    meta, episodes, players = season_parts(rows, show, number)
    own_bet = bet(show, number, sub)
    head = {
        "season": f"{show}-{number}",
        "title": meta["wikiTitle"],
        "current": bool(meta.get("current")),
    }

    if needs_bet(meta, own_bet):
        return ok(
            {
                **head,
                "needsBet": True,
                "episodes": len(episodes),
                "released": released(episodes, int(time.time())),
                "players": bet_roster(meta, episodes, players),
            }
        )

    picks = query_many([("SCORES_TABLE", episode_pk(show, number, ep_number(e))) for e in episodes])
    return ok(
        {
            **head,
            "needsBet": False,
            "bet": own_bet and {k: own_bet[k] for k in ("picks", "released")},
            "episodes": [
                {
                    "ep": ep_number(e),
                    "title": e.get("title"),
                    "releaseAt": e["releaseAt"],
                    "closed": closed(meta, e),
                    "events": len(events(e)),
                    "answered": len(mine(sub, answers)),
                }
                for e, answers in zip(episodes, picks)
            ],
        }
    )
