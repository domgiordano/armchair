"""
GET /traitors/player?show=tus&id=<player id> - one Traitors player across an edition's seasons.

    {id, name, headshot, seasons: [{season, number, current,
      finish: {how, ep} | null, faction: str | null, votes: [{ep, received}] | null}]}

A past season shows everything: the finish, the final faction, and the first-vote count
the player drew at each round table they sat at with a confirmed result. The current
season shows an exit, and the faction it revealed, only from a closed episode (an exit
in an episode still open to picks would spoil it), and has no votes.
"""

from __future__ import annotations

import re

from lambdas.common.api import NotFoundError, ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, season_pk
from lambdas.common.people import person
from lambdas.common.traitors_catalog import EDITIONS
from lambdas.common.traitors_dynamo import season_parts
from lambdas.common.traitors_gate import closed, ep_number, result

ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


@api_handler("traitors_player")
def handler(event, context):
    caller_sub(event)
    params = query(event)
    show = str(params.get("show") or "")
    if show not in EDITIONS:
        raise ValidationError("show must be a Traitors edition", field="show")
    pid = str(params.get("id") or "")
    if not ID.fullmatch(pid) or len(pid) > 80:
        raise ValidationError("id is not a player id", field="id")
    found = person(show, pid)
    if found is None:
        raise NotFoundError("No such player", id=pid)

    numbers = [int(s["season"]) for s in found["seasons"]]
    catalog = query_many([("CATALOG_TABLE", season_pk(show, n)) for n in numbers])
    seasons = []
    for n, rows in zip(numbers, catalog):
        meta, episodes, players = season_parts(rows, show, n)
        me = next((p for p in players if p["sk"] == f"PLAYER#{pid}"), {})
        seasons.append((n, meta, episodes, me))

    # Round tables the player sat at, in past seasons: up to and including their exit.
    sat = [
        (n, ep_number(e))
        for n, meta, episodes, me in seasons
        if not meta.get("current")
        for e in episodes
        if not e.get("noRoundTable")
        and (not me.get("exit") or ep_number(e) <= int(me["exit"]["ep"]))
    ]
    stored = query_many([("PERFORMANCES_TABLE", episode_pk(show, n, ep)) for n, ep in sat])
    votes: dict[int, list[dict]] = {}
    for (n, ep), evts in zip(sat, stored):
        rt = result(next((r for r in evts if r["sk"] == "EVT#RT"), None))
        if rt:
            votes.setdefault(n, []).append({"ep": ep, "received": rt["firstVote"].get(pid, 0)})

    out = []
    for n, meta, episodes, me in seasons:
        current = bool(meta.get("current"))
        exit_ = me.get("exit")
        if current and exit_:
            shut = {ep_number(e) for e in episodes if closed(meta, e)}
            exit_ = exit_ if int(exit_["ep"]) in shut else None
        out.append(
            {
                "season": f"{show}-{n}",
                "number": n,
                "current": current,
                "finish": exit_,
                # A running season's faction is only ever written by the banishment that ends it.
                "faction": me.get("faction") if exit_ or not current else None,
                "votes": None if current else votes.get(n, []),
            }
        )
    shot = found.get("headshot")
    return ok(
        {
            "id": pid,
            "name": found["name"],
            "headshot": shot and shot["image"],
            "seasons": out,
        }
    )
