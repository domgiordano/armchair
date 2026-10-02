"""
GET /traitors/episode?season=tus-5&ep=05[&group=<gid>] - one Traitors episode as the caller may see it.

Everything goes through common/traitors_gate.py: an event stays locked until the caller
picks or forfeits it. A current season is 403 until the caller locks a winner bet.
`group` narrows the picks shown to that group's members and is 403 unless the caller is one.
"""

from __future__ import annotations

from lambdas.common.api import ForbiddenError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, ref, season_pk
from lambdas.common.groups_dynamo import members
from lambdas.common.traitors_dynamo import bet, episode, season_parts, traitors_ref
from lambdas.common.traitors_gate import episode_view, needs_bet


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
    rows, results, picks = query_many(
        [
            ("CATALOG_TABLE", season_pk(show, number)),
            ("PERFORMANCES_TABLE", pk),
            ("SCORES_TABLE", pk),
        ]
    )
    meta, episodes, players = season_parts(rows, show, number)
    if needs_bet(meta, bet(show, number, sub)):
        raise ForbiddenError("Lock in your winner bet first", needsBet=True)
    view = episode_view(
        sub, meta, episode(episodes, ep, show, number), players, results, picks, in_group
    )
    return ok({"season": f"{show}-{number}", **view})
