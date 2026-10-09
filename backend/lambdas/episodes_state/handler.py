"""
GET /episodes/state?season=dwts-35&ep=05[&group=<gid>] - the caller's view of one episode.

Every performance, judges' score and other user's value goes through
common/gate.py: locked cards until the caller answers, results only once they
have answered the whole episode, and each dance's AI write-up with its card.
`group` narrows other users to that group's
members and is 403 unless the caller is one; it never widens what the gate
shows. Once the episode's scoring window (common/window.py) closes, it shows
whole and unanswered dances stay missed.

Beside the gated view: `window` {opensAt, closesAt, open} for this episode, and
`activeEpisode`, the episode taking answers now with the caller's progress on
it ({ep, pk, opensAt, closesAt, answered, rateable}), or null between seasons.
A dance the caller sealed (common/seals.py) stays locked with their answer and
`sealed`, and holds back the results. Identity is the Cognito sub; admins get
the same view as everyone else.
"""

from __future__ import annotations

from lambdas.common import seals, window
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
    spans = window.spans(meta, rows)
    now = window.now()
    view = episode_view(
        sub,
        ep,
        meta,
        episode,
        contestants,
        perfs,
        score_rows,
        in_group,
        writeups=notes,
        closed=window.closed(meta, spans[ep], now),
        sealed=seals.keys(seals.of(sub, show, season, params), ep),
    )
    live = window.active(meta, spans, now)
    if live is None:
        current = None
    elif live == ep:
        current = window.summary(ep, pk, spans[ep], view["rateable"], view["answered"])
    else:
        live_episode = episode_rows(rows, show, season, live)[1]
        current = window.progress(sub, show, season, live, live_episode, contestants, spans[live])
    return ok(
        {
            "season": f"{show}-{season}",
            **view,
            "window": window.view(meta, spans[ep], now),
            "activeEpisode": current,
        }
    )
