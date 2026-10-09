"""
GET /traitors/stats?season=tus-5 - the caller's own Traitors numbers for one season.

Built from the caller's PTS items (common/traitors_board.py), which exist only for picks
they made on confirmed results, so nothing here reaches past the gate. An episode with a
call the caller sealed (common/seals.py) counts for nothing until they reveal it.
"""

from __future__ import annotations

from lambdas.common import seals
from lambdas.common.api import api_handler, caller_sub, ok, query
from lambdas.common.board_dynamo import board_pk
from lambdas.common.dynamo import resource, table
from lambdas.common.episodes_dynamo import season_rows
from lambdas.common.traitors_board import less, pts_pk, withheld
from lambdas.common.traitors_dynamo import season_parts, traitors_ref
from lambdas.common.traitors_gate import EVENTS, ep_number


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
    show, number = traitors_ref(query(event))
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
    return ok(
        {
            "season": f"{show}-{number}",
            "points": int(total.get("pts", 0)),
            "events": int(total.get("events", 0)),
            "banishHits": int(total.get("banishHits", 0)),
            "byEvent": kinds,
            "byEpisode": [{"ep": ep, "points": per_ep[ep]} for ep in eps],
            "winnerPoints": winner,
        }
    )
