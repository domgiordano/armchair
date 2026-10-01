"""
POST /scores/reveal-all - forfeit every rateable performance the caller hasn't
answered in one episode, for catching up on a week already watched.

Body: {"season": "dwts-35", "ep": "03"}. Each forfeit is the same conditional
put /scores/submit makes, so an answer already stored stands and a repeat call
reveals nothing new. A past season has nothing to reveal and is 403.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common.api import ForbiddenError, api_handler, body, caller_sub, ok
from lambdas.common.episodes_dynamo import (
    catalog,
    create_score,
    episode_pk,
    performances,
    ref,
    scores,
)
from lambdas.common.gate import answered, is_open, rateable


@api_handler("scores_reveal_all")
def handler(event, context):
    sub = caller_sub(event)
    show, season, ep = ref(body(event))
    meta, episode, contestants = catalog(show, season, ep)
    if is_open(meta):
        raise ForbiddenError("Past seasons are view-only", season=f"{show}-{season}")
    pk = episode_pk(show, season, ep)
    done = answered(sub, scores(pk))
    todo = [k for k in rateable(ep, episode, contestants, performances(pk)) if k not in done]
    now = datetime.now(UTC).isoformat(timespec="seconds")
    for key in todo:
        create_score(
            {"pk": pk, "sk": f"PERF#{key}#USER#{sub}", "forfeit": True, "submittedAt": now}
        )
    return ok({"revealed": todo})
