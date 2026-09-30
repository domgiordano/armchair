"""
POST /scores/skip-before - forfeit every rateable performance the caller hasn't
answered in the aired episodes before `ep`, for a viewer who would rather start
from this week than catch up week by week.

Body: {"season": "dwts-35", "ep": "05"}. `ep` needn't exist, so one past the
last episode skips a finished season whole. An episode still to air is never
touched, so a stray `ep` can't forfeit dances nobody has danced. Each forfeit
is the conditional put /scores/submit makes: an answer already stored stands,
and a repeat call reveals nothing new.
"""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from lambdas.common.api import NotFoundError, api_handler, body, caller_sub, ok
from lambdas.common.episodes_dynamo import (
    create_scores,
    episode_pk,
    performances,
    ref,
    scores,
    season_rows,
)
from lambdas.common.gate import answered, rateable, score_owner


def _now() -> datetime:
    return datetime.now(UTC)


def aired(meta: dict, episode: dict, tz: ZoneInfo, now: datetime) -> bool:
    # Past-season fixtures leave start times null; every one of their episodes has aired.
    if not meta.get("current"):
        return True
    if not episode.get("airDate") or not episode.get("start"):
        return False
    return (
        datetime.fromisoformat(f"{episode['airDate']}T{episode['start']}").replace(tzinfo=tz) <= now
    )


@api_handler("scores_skip_before")
def handler(event, context):
    sub = caller_sub(event)
    show, season, ep = ref(body(event))
    rows = season_rows(show, season)
    by_sk = {r["sk"]: r for r in rows}
    meta = by_sk.get("META")
    if meta is None:
        raise NotFoundError("No such season", season=f"{show}-{season}")
    contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
    tz = ZoneInfo(meta["timezone"])
    now = _now()
    stamp = now.isoformat(timespec="seconds")

    todo = []
    for sk, episode in sorted(by_sk.items()):
        if not sk.startswith("EP#"):
            continue
        n = int(sk.removeprefix("EP#"))
        if n >= ep or not aired(meta, episode, tz, now):
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
