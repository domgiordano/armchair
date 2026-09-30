"""
GET /episodes/state?season=dwts-35&ep=05 - the caller's view of one episode.

Every performance, judges' score and other user's value goes through
common/gate.py: locked cards until the caller answers, results only once they
have answered the whole episode. Identity is the Cognito sub; admins get the
same view as everyone else.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, caller_sub, ok, query
from lambdas.common.episodes_dynamo import catalog, episode_pk, performances, ref, scores
from lambdas.common.gate import episode_view


@api_handler("episodes_state")
def handler(event, context):
    sub = caller_sub(event)
    show, season, ep = ref(query(event))
    meta, episode, contestants = catalog(show, season, ep)
    pk = episode_pk(show, season, ep)
    view = episode_view(sub, ep, meta, episode, contestants, performances(pk), scores(pk))
    return ok({"season": f"{show}-{season}", **view})
