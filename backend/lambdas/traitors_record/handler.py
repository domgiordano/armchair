"""
GET /traitors/record?season=tus-5[&scope=friends | &group=<gid>] - every call the caller may
see in one season, by person: who they chose each episode and what it scored, for the
breakdown, accuracy and head-to-head pages, which aggregate it in the app.

    {season, people: [{sub, name, picture, me,
                       winner: [{player, faction, released}] | null,
                       calls: [{ep, type, picks | null, forfeit,
                                points?, calls?: [{player, points, why}]}]}]}

Without either it's the caller alone. `scope=friends` adds their accepted friends;
`group` that group's members, 403 unless the caller is one. Visibility is
traitors_gate.visible_calls: someone else's call shows only for an event the caller has
answered or a closed episode, and `points` only once the result is confirmed. Someone
else's winner bet shows once the caller's has every place, or the season is over
(traitors_gate.bets_shown). Results the caller hasn't turned over stay face down in the
app, which holds that state per device.
"""

from __future__ import annotations

from lambdas.common.api import ForbiddenError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_all, query_many, table
from lambdas.common.episodes_dynamo import episode_pk, season_pk
from lambdas.common.groups_dynamo import members
from lambdas.common.social_dynamo import peers, status
from lambdas.common.traitors_dynamo import season_parts, traitors_ref
from lambdas.common.traitors_gate import bets_shown, ep_number, visible_calls
from lambdas.common.users_dynamo import cards


@api_handler("traitors_record")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, number = traitors_ref(params)
    people = {sub}
    if params.get("group"):
        people = members(params["group"])
        # A group that doesn't exist answers the same, so a guess learns nothing.
        if sub not in people:
            raise ForbiddenError("Not a member of that group")
    elif params.get("scope") == "friends":
        people |= {s for s, item in peers(sub).items() if status(item) == "friend"}

    (rows,) = query_many([("CATALOG_TABLE", season_pk(show, number))])
    meta, episodes, _ = season_parts(rows, show, number)
    pks = [episode_pk(show, number, ep_number(e)) for e in episodes]
    reads = query_many(
        [("PERFORMANCES_TABLE", pk) for pk in pks] + [("SCORES_TABLE", pk) for pk in pks]
    )
    by_person: dict[str, list[dict]] = {s: [] for s in people}
    for e, results, picks in zip(episodes, reads[: len(pks)], reads[len(pks) :]):
        for owner, call in visible_calls(sub, meta, e, results, picks, people):
            by_person[owner].append(call)

    bets = {
        b["sk"].removeprefix("USER#"): b["picks"]
        for b in query_all(table("SCORES_TABLE"), f"WIN#{show}#{number}")
        if b["sk"].removeprefix("USER#") in people
    }
    shown = bets_shown(meta, {"picks": bets.get(sub, [])})
    who = cards(people)
    order = sorted(people, key=lambda s: (s != sub, (who[s].get("name") or "").lower()))
    return ok(
        {
            "season": f"{show}-{number}",
            "people": [
                {
                    **who[s],
                    "me": s == sub,
                    "winner": bets.get(s) if s == sub or shown else None,
                    "calls": sorted(by_person[s], key=lambda c: (c["ep"], c["type"])),
                }
                for s in order
            ],
        }
    )
