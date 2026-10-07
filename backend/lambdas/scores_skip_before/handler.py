"""
POST /scores/skip-before - forfeit every rateable performance the caller hasn't
answered in the aired episodes before `ep`, for a viewer who would rather start
from this week than catch up week by week.

Body: {"season": "dwts-35", "ep": "05"}. Only an episode inside its scoring
window (common/window.py) is touched: one closed already shows whole with its
dances missed, and one still to air has nothing danced. Each forfeit
is the conditional put /scores/submit makes: an answer already stored stands,
and a repeat call reveals nothing new. A past season has nothing to skip and is 403.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common import window
from lambdas.common.api import ForbiddenError, NotFoundError, api_handler, body, caller_sub, ok
from lambdas.common.episodes_dynamo import (
    create_scores,
    episode_pk,
    performances,
    ref,
    scores,
    season_rows,
)
from lambdas.common.gate import answered, is_open, rateable, score_owner


def _now() -> datetime:
    return datetime.now(UTC)


@api_handler("scores_skip_before")
def handler(event, context):
    sub = caller_sub(event)
    show, season, ep = ref(body(event))
    rows = season_rows(show, season)
    by_sk = {r["sk"]: r for r in rows}
    meta = by_sk.get("META")
    if meta is None:
        raise NotFoundError("No such season", season=f"{show}-{season}")
    if is_open(meta):
        raise ForbiddenError("Past seasons are view-only", season=f"{show}-{season}")
    contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
    spans = window.spans(meta, rows)
    now = _now()
    stamp = now.isoformat(timespec="seconds")

    todo = []
    for sk, episode in sorted(by_sk.items()):
        if not sk.startswith("EP#"):
            continue
        n = int(sk.removeprefix("EP#"))
        if n >= ep or not window.is_live(meta, spans[n], now):
            continue
        pk = episode_pk(show, season, n)
        done = answered(sub, scores(pk))
        todo += [
            {"pk": pk, "sk": f"PERF#{key}#USER#{sub}", "forfeit": True, "submittedAt": stamp}
            for key in rateable(n, episode, contestants, performances(pk))
            if key not in done
        ]

    revealed: dict[int, list[str]] = {}
    for row in create_scores(todo):
        n = int(row["pk"].rsplit("#", 1)[1])
        revealed.setdefault(n, []).append(score_owner(row)[0])
    return ok({"revealed": [{"ep": n, "keys": keys} for n, keys in sorted(revealed.items())]})
