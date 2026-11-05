"""
GET /traitors/stats?season=tus-5[&scope=global | &scope=group&group=<gid>] - Traitors numbers
for one season.

Without `scope` it's the caller's own, built from their PTS items (common/traitors_board.py),
which exist only for picks they made on confirmed results, so nothing here reaches past the
gate. An episode with a call the caller sealed (common/seals.py) counts for nothing until
they reveal it.

`scope=global` (everyone) or `scope=group` (403 unless the caller is a member) is the crowd:

    {season, scope, group,
     episodes: [{ep, title, calls: {type: {voters, hits, banished?, top?, topVotes?}}}],
     byEvent: {type: {scored, hits}}, mine: {type: {scored, hits}},
     leaders: [{rank, sub, name, picture, points}], me: {rank, points}, ranked}

It counts only episodes traitors_gate.seen lets the caller see whole: closed, or every event
answered, with nothing sealed. A night with no murder or recruit is void and left out. RT
`hits` are first picks naming who was banished; `top` is the most-picked first choice.
Leaders' points come off every episode the caller hasn't seen, so a total can't hint at one.
"""

from __future__ import annotations

from lambdas.common import board_dynamo, seals
from lambdas.common.api import (
    ForbiddenError,
    ValidationError,
    api_handler,
    caller_sub,
    ok,
    query,
    require,
)
from lambdas.common.board_dynamo import board_pk
from lambdas.common.dynamo import query_many, resource, table
from lambdas.common.episodes_dynamo import episode_pk, season_pk, season_rows
from lambdas.common.groups_dynamo import members
from lambdas.common.points import calls
from lambdas.common.traitors_board import less, pts_pk, ranks, standing, withheld
from lambdas.common.traitors_dynamo import season_parts, traitors_ref
from lambdas.common.traitors_gate import EVENTS, ep_number, events, pick_owner, result, seen
from lambdas.common.users_dynamo import cards

LEADERS = 5
HIT = {"banished", "hit"}


def batch(keys: list[dict]) -> list[dict]:
    name = table("BOARD_TABLE").name
    out = []
    for i in range(0, len(keys), 100):
        request = {name: {"Keys": keys[i : i + 100]}}
        while request:
            page = resource().batch_get_item(RequestItems=request)
            out += page["Responses"].get(name, [])
            request = page.get("UnprocessedKeys")
    return out


@api_handler("traitors_stats")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, number = traitors_ref(params)
    scope = params.get("scope")
    if scope is None:
        return ok(own(sub, show, number))
    if scope == "global":
        return ok(crowd(sub, show, number, None) | {"scope": scope, "group": None})
    if scope != "group":
        raise ValidationError("scope must be global or group", field="scope")
    (gid,) = require(params, "group")
    people = members(gid)
    # A group that doesn't exist answers the same, so a guess learns nothing.
    if sub not in people:
        raise ForbiddenError("Not a member of that group")
    return ok(crowd(sub, show, number, people) | {"scope": scope, "group": gid})


def own(sub: str, show: str, number: int) -> dict:
    _, episodes, _ = season_parts(season_rows(show, number), show, number)
    eps = [ep_number(e) for e in episodes]
    held = seals.episodes(seals.of(sub, show, number))
    keys = [
        {"pk": pts_pk(show, number, ep), "sk": f"{kind}#USER#{sub}"}
        for ep in eps
        if ep not in held
        for kind in EVENTS
    ]
    keys.append({"pk": pts_pk(show, number, "WIN"), "sk": f"WIN#USER#{sub}"})
    items = batch(keys)

    kinds = {k: {"scored": 0, "hits": 0, "points": 0} for k in EVENTS}
    per_ep = {ep: 0 for ep in eps}
    winner = None
    for item in items:
        pts = int(item["pts"])
        if item["pk"].endswith("#WIN"):
            winner = pts
            continue
        kind = item["sk"].partition("#USER#")[0]
        kinds[kind]["scored"] += 1
        kinds[kind]["hits"] += pts > 0
        kinds[kind]["points"] += pts
        per_ep[int(item["pk"].rsplit("#", 1)[1])] += pts

    total = (
        table("BOARD_TABLE")
        .get_item(Key={"pk": board_pk(show, number), "sk": f"USER#{sub}"})
        .get("Item")
        or {}
    )
    if held:
        total = less({sub: total}, withheld(show, number, held))[sub]
    return {
        "season": f"{show}-{number}",
        "points": int(total.get("pts", 0)),
        "events": int(total.get("events", 0)),
        "banishHits": int(total.get("banishHits", 0)),
        "byEvent": kinds,
        "byEpisode": [{"ep": ep, "points": per_ep[ep]} for ep in eps],
        "winnerPoints": winner,
    }


def crowd(sub: str, show: str, number: int, people: set[str] | None) -> dict:
    """The crowd's calls over the episodes the caller has seen; `people` None is everyone."""
    (rows,) = query_many([("CATALOG_TABLE", season_pk(show, number))])
    meta, episodes, _ = season_parts(rows, show, number)
    pks = [episode_pk(show, number, ep_number(e)) for e in episodes]
    reads = query_many(
        [("PERFORMANCES_TABLE", pk) for pk in pks] + [("SCORES_TABLE", pk) for pk in pks]
    )
    held = seals.episodes(seals.of(sub, show, number))
    totals = {k: {"scored": 0, "hits": 0} for k in EVENTS}
    mine = {k: {"scored": 0, "hits": 0} for k in EVENTS}
    timeline, unseen = [], set()
    for e, results, picks in zip(episodes, reads[: len(pks)], reads[len(pks) :]):
        n = ep_number(e)
        if not seen(sub, meta, e, picks, n in held):
            unseen.add(n)
            continue
        settled = {r["sk"].removeprefix("EVT#"): result(r) for r in results}
        per = {}
        for kind in events(e):
            res = settled.get(kind)
            chosen = {
                owner: list(r["picks"])
                for r in picks
                for k, owner in [pick_owner(r)]
                if k == kind and r.get("picks") and (people is None or owner in people)
            }
            if res is None or not chosen:
                continue
            whys = {s: calls(kind, p, res)[0]["why"] for s, p in chosen.items()}
            if "void" in whys.values():
                continue
            call = {"voters": len(whys), "hits": sum(w in HIT for w in whys.values())}
            if kind == "RT":
                firsts: dict[str, int] = {}
                for p in chosen.values():
                    firsts[p[0]] = firsts.get(p[0], 0) + 1
                top = max(sorted(firsts), key=firsts.__getitem__)
                call |= {"banished": res.get("banished"), "top": top, "topVotes": firsts[top]}
            per[kind] = call
            totals[kind]["scored"] += call["voters"]
            totals[kind]["hits"] += call["hits"]
            if sub in whys:
                mine[kind]["scored"] += 1
                mine[kind]["hits"] += whys[sub] in HIT
        timeline.append({"ep": n, "title": e.get("title"), "calls": per})

    board = board_dynamo.rows(show, number, people)
    if unseen | held:
        board = less(board, withheld(show, number, unseen | held))
    standings = {s: standing(r) for s, r in board.items() if r.get("events") or r.get("pts")}
    standings.setdefault(sub, standing(None))
    places = ranks(standings)
    top = sorted(standings, key=places.__getitem__)[:LEADERS]
    who = cards(set(top))
    return {
        "season": f"{show}-{number}",
        "episodes": timeline,
        "byEvent": totals,
        "mine": mine,
        "leaders": [{"rank": places[s], **who[s], "points": standings[s]["points"]} for s in top],
        "me": {"rank": places[sub], "points": standings[sub]["points"]},
        "ranked": len(standings),
    }
