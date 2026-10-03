"""
GET /traitors/season?season=tus-5 - a Traitors season's schedule and the caller's place in it.

    {season, title, current, summary: {text, sourceUrl} | null,
     needsBet, bet: {picks, released} | null, released,
     episodes: [{ep, title, releaseAt, closed, events, answered,
                 recap: {text, source, sourceUrl} | null}],
     cast: [{id, name, headshot, faction, exit: {ep, how} | null}],
     winners: [{id, name, headshot, faction}]      past seasons only
     betRoster: [{id, name, headshot}]}            when needsBet only

Each episode carries how many of its events the caller has answered, which needs no gate:
it's the caller's own rows. A current season can be browsed before the winner bet;
`needsBet` says picking waits for it and `betRoster` is who it may name. `cast` follows
traitors_gate.wall: in a current season only exits from closed episodes show. `summary`
is the season article's lead, attributed by `sourceUrl` (CC BY-SA), written by discovery.
A recap reveals its episode's results, so it follows traitors_gate.seen like the episode
view: closed, or every event answered. The wiki's recap, else one written from the
confirmed results.
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
    recap,
    released,
    seen,
    wall,
)


@api_handler("traitors_season")
def handler(event, context):
    sub = caller_sub(event)
    show, number = traitors_ref(query(event))
    rows, *_ = query_many([("CATALOG_TABLE", season_pk(show, number))])
    meta, episodes, players = season_parts(rows, show, number)
    own_bet = bet(show, number, sub)
    picks = query_many([("SCORES_TABLE", episode_pk(show, number, ep_number(e))) for e in episodes])
    cast = wall(meta, episodes, players)
    open_eps = [e for e, answers in zip(episodes, picks) if seen(sub, meta, e, answers)]
    results = dict(
        zip(
            (ep_number(e) for e in open_eps),
            query_many(
                [("PERFORMANCES_TABLE", episode_pk(show, number, ep_number(e))) for e in open_eps]
            ),
        )
    )
    data = {
        "season": f"{show}-{number}",
        "title": meta["wikiTitle"],
        "current": bool(meta.get("current")),
        "summary": meta.get("summary"),
        "needsBet": needs_bet(meta, own_bet),
        "bet": own_bet and {k: own_bet[k] for k in ("picks", "released")},
        "released": released(episodes, int(time.time())),
        "episodes": [
            {
                "ep": ep_number(e),
                "title": e.get("title"),
                "releaseAt": e["releaseAt"],
                "closed": closed(meta, e),
                "events": len(events(e)),
                "answered": len(mine(sub, answers)),
                "recap": (
                    recap(
                        e, {r["sk"].removeprefix("EVT#"): r for r in results[ep_number(e)]}, players
                    )
                    if ep_number(e) in results
                    else None
                ),
            }
            for e, answers in zip(episodes, picks)
        ],
        "cast": cast,
    }
    if not data["current"]:
        data["winners"] = [
            {k: p[k] for k in ("id", "name", "headshot", "faction")}
            for p in cast
            if (p["exit"] or {}).get("how") == "winner"
        ]
    if data["needsBet"]:
        data["betRoster"] = bet_roster(meta, episodes, players)
    return ok(data)
