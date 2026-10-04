"""
GET /traitors/player?show=tus&id=<player id> - one Traitors player across an edition's seasons.

    {id, name, headshot, headshotCredit: {source, sourceUrl, author, license} | null,
     bio: {text, source: "wikipedia" | "fandom" | "official", sourceUrl} | null,
     about: {age: int | null, hometown: str | null, occupation: str | null} | null,
     seasons: [{season, number, current, championship: bool,
      finish: {how, ep} | null, faction: str | null, votes: [{ep, received}] | null,
      traitorFrom: ep | null}],
     story: [{season, ep, title, voted: id | null, votesReceived: n | null,
              shield: bool, out: {how} | null, murdered: [id] | null, recruited: [id] | null}],
     people: {id: {name, headshot}}}

`bio` is the lead of the player's Wikipedia article, else the intro of their Fandom
page, else their entry on the network's cast page, attributed by `sourceUrl`, written by
discovery (common/traitors_about.py). One from Fandom or the network for a season still
running has been scrubbed of anything that could tell how it went. `about` is their row
of the season article's Contestants table, from their latest season; `occupation` is
what the table lists, which for a celebrity season is what they're known for.

A past season shows everything: the finish, the final faction, and the first-vote count
the player drew at each round table they sat at with a confirmed result. The current
season shows an exit, and the faction it revealed, only from a closed episode (an exit
in an episode still open to picks would spoil it), and has no votes.

`story` is each released episode up to the player's exit, season by season. `voted` and
`votesReceived` are null without a confirmed round table. A current season's story
stops before the first episode the caller hasn't seen (traitors_gate.story).

`traitorFrom`, `murdered` and `recruited` are a Traitor's tenure, kills and recruits. In
a current season they stay null until a banishment the caller has seen revealed the
player as a Traitor (traitors_gate.traitor_from). `people` has the name and photo of
everyone the story names.
"""

from __future__ import annotations

import re
import time

from lambdas.common.api import NotFoundError, ValidationError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, season_pk
from lambdas.common.people import person
from lambdas.common.traitors_catalog import EDITIONS
from lambdas.common.traitors_dynamo import season_parts
from lambdas.common.traitors_gate import (
    card,
    closed,
    credit,
    ep_number,
    result,
    story,
    traitor_from,
)

ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


@api_handler("traitors_player")
def handler(event, context):
    sub = caller_sub(event)
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
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    seasons = []
    for n, rows in zip(numbers, catalog):
        meta, episodes, players = season_parts(rows, show, n)
        me = next((p for p in players if p["sk"] == f"PLAYER#{pid}"), {})
        # The episodes the player was in: released, up to and including their exit.
        span = [
            e
            for e in episodes
            if me
            and e["releaseAt"] <= now
            and (not me.get("exit") or ep_number(e) <= int(me["exit"]["ep"]))
        ]
        seasons.append((n, meta, episodes, players, me, span))

    keys = [(n, ep_number(e)) for n, *_, span in seasons for e in span]
    running = {n for n, meta, *_ in seasons if meta.get("current")}
    live = [(n, ep) for n, ep in keys if n in running]
    reads = query_many(
        [("PERFORMANCES_TABLE", episode_pk(show, n, ep)) for n, ep in keys]
        + [("SCORES_TABLE", episode_pk(show, n, ep)) for n, ep in live]
    )
    stored = dict(zip(keys, reads[: len(keys)]))
    picks = dict(zip(live, reads[len(keys) :]))

    out, told, faces = [], [], {}
    for n, meta, episodes, players, me, span in seasons:
        current = bool(meta.get("current"))
        exit_ = me.get("exit")
        if current and exit_:
            shut = {ep_number(e) for e in episodes if closed(meta, e)}
            exit_ = exit_ if int(exit_["ep"]) in shut else None
        own = {ep_number(e): stored[n, ep_number(e)] for e in span}
        mine = {ep: picks[n, ep] for m, ep in live if m == n}
        votes = []
        for e in span:
            rt = result(next((r for r in own[ep_number(e)] if r["sk"] == "EVT#RT"), None))
            if rt and not e.get("noRoundTable"):
                votes.append({"ep": ep_number(e), "received": rt["firstVote"].get(pid, 0)})
        out.append(
            {
                "season": f"{show}-{n}",
                "number": n,
                "current": current,
                "championship": (exit_ or {}).get("how") == "winner",
                "finish": exit_,
                # A running season's faction is only ever written by the banishment that ends it.
                "faction": me.get("faction") if exit_ or not current else None,
                "votes": None if current else votes,
                "traitorFrom": traitor_from(sub, meta, span, me, own, mine) if me else None,
            }
        )
        if me:
            told += [{"season": f"{show}-{n}", **s} for s in story(sub, meta, span, me, own, mine)]
            faces |= {c["id"]: c for c in map(card, players)}
    named = {
        who
        for s in told
        for who in [s["voted"], *(s["murdered"] or []), *(s["recruited"] or [])]
        if who
    }
    shot = found.get("headshot")
    return ok(
        {
            "id": pid,
            "name": found["name"],
            "headshot": shot and shot["image"],
            "headshotCredit": shot and credit(shot),
            "bio": found.get("bio"),
            "about": found.get("about"),
            "seasons": out,
            "story": told,
            "people": {
                who: {"name": faces[who]["name"], "headshot": faces[who]["headshot"]}
                for who in sorted(named)
                if who in faces
            },
        }
    )
