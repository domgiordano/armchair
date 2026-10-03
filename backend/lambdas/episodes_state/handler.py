"""
GET /episodes/state?season=dwts-35&ep=05[&group=<gid>] - the caller's view of one episode.

Every performance, judges' score and other user's value goes through
common/gate.py: locked cards until the caller answers, results only once they
have answered the whole episode, and each dance's AI write-up with its card.
`group` narrows other users to that group's
members and is 403 unless the caller is one; it never widens what the gate
shows. Identity is the Cognito sub; admins get the same view as everyone else.
"""

from __future__ import annotations

from lambdas.common.api import ForbiddenError, api_handler, caller_sub, ok, query
from lambdas.common.dynamo import query_many
from lambdas.common.episodes_dynamo import episode_pk, episode_rows, ref, season_pk
from lambdas.common.gate import episode_view
from lambdas.common.groups_dynamo import members


@api_handler("episodes_state")
def handler(event, context):
    sub = caller_sub(event)
    params = query(event)
    show, season, ep = ref(params)
    group = params.get("group")
    in_group = None
    if group:
        in_group = members(group)
        # A group that doesn't exist answers the same, so a guess learns nothing.
        if sub not in in_group:
            raise ForbiddenError("Not a member of that group")
    pk = episode_pk(show, season, ep)
    rows, perfs, score_rows, notes = query_many(
        [
            ("CATALOG_TABLE", season_pk(show, season)),
            ("PERFORMANCES_TABLE", pk),
            ("SCORES_TABLE", pk),
            ("WRITEUPS_TABLE", pk),
        ]
    )
    meta, episode, contestants = episode_rows(rows, show, season, ep)
    view = episode_view(
        sub, ep, meta, episode, contestants, perfs, score_rows, in_group, writeups=notes
    )
    return ok({"season": f"{show}-{season}", **view})
