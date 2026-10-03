"""
GET /traitors/episode?season=tus-5&ep=05[&group=<gid>] - one Traitors episode as the caller may see it.

    {season, ep, title, releaseAt, closed, needsBet, roster, events,
     recap: {text, source: "wikipedia" | "fandom", sourceUrl} | null,
     out: [{id, ep, how, faction | null}]}

Everything goes through common/traitors_gate.py: an event stays locked until the caller
picks or forfeits it. An unlocked round table's result carries `ballots` ({voter id:
target id}, first vote) and `daggers` ([voter id]). `recap` tells the whole episode, so
it shows only once the episode is closed or the caller has answered every event. Without a winner bet a current season can still be browsed:
`needsBet` is true and, since picking needs the bet, every open event stays locked.
`out` is who left in earlier episodes the caller has fully answered or that are closed.
`group` narrows the picks shown to that group's members and is 403 unless the caller is one.
"""

from __future__ import annotations

from lambdas.common.api import ForbiddenError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, ref, season_pk
from lambdas.common.groups_dynamo import members
from lambdas.common.traitors_dynamo import bet, episode, season_parts, traitors_ref
from lambdas.common.traitors_gate import episode_view, needs_bet, out


@api_handler("traitors_episode")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, number = traitors_ref(params)
    _, _, ep = ref(params)
    group = params.get("group")
    in_group = None
    if group:
        in_group = members(group)
        # A group that doesn't exist answers the same, so a guess learns nothing.
        if sub not in in_group:
            raise ForbiddenError("Not a member of that group")
    pk = episode_pk(show, number, ep)
    prior = range(1, ep)
    rows, results, picks, *earlier = query_many(
        [
            ("CATALOG_TABLE", season_pk(show, number)),
            ("PERFORMANCES_TABLE", pk),
            ("SCORES_TABLE", pk),
            *[("SCORES_TABLE", episode_pk(show, number, n)) for n in prior],
        ]
    )
    meta, episodes, players = season_parts(rows, show, number)
    view = episode_view(
        sub, meta, episode(episodes, ep, show, number), players, results, picks, in_group
    )
    return ok(
        {
            "season": f"{show}-{number}",
            **view,
            "needsBet": needs_bet(meta, bet(show, number, sub)),
            "out": out(sub, meta, episodes, players, ep, dict(zip(prior, earlier))),
        }
    )
