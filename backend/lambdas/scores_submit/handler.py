"""
POST /scores/submit - the caller's final answer on one performance.

Body: {"season": "dwts-35", "ep": "05", "contestant": "<cid>", "n": 1, "value": 1-10}
or the same with {"forfeit": true} in place of value ("Reveal without scoring").

Answers are final. A retry with the same answer returns the stored row; a
different one is 409. A past season is view-only (gate.is_open): 403. An
episode outside its scoring window (common/window.py) is 409 with detail.code
episode_closed or episode_not_open. Identity is the Cognito sub.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common import board_dynamo, window
from lambdas.common.accuracy import judged
from lambdas.common.api import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    api_handler,
    body,
    caller_sub,
    ok,
    text,
    whole,
)
from lambdas.common.episodes_dynamo import (
    create_score,
    episode_pk,
    episode_rows,
    performances,
    ref,
    season_rows,
)
from lambdas.common.gate import cid, is_open, perf_key, rateable


def answer(data: dict) -> dict:
    if "forfeit" not in data:
        return {"value": whole(data, "value", 1, 10)}
    if data["forfeit"] is not True or "value" in data:
        raise ValidationError("Send either value 1-10 or forfeit: true", field="forfeit")
    return {"forfeit": True}


@api_handler("scores_submit")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)
    show, season, ep = ref(data)
    contestant = text(data, "contestant")
    n = whole(data, "n", 1, 9)
    given = answer(data)

    rows = season_rows(show, season)
    meta, episode, contestants = episode_rows(rows, show, season, ep)
    if is_open(meta):
        raise ForbiddenError("Past seasons are view-only", season=f"{show}-{season}")
    window.require_live(meta, window.spans(meta, rows)[ep], window.now())
    pk = episode_pk(show, season, ep)
    perfs = performances(pk)
    key = f"{contestant}#{n}"
    if key not in rateable(ep, episode, contestants, perfs):
        if contestant not in {cid(c) for c in contestants}:
            raise NotFoundError("Unknown contestant", contestant=contestant)
        raise ValidationError("That performance can't be scored in this episode", key=key)

    # Judges already confirmed (a late answer): the dance counts
    # toward the leaderboard now. Otherwise the poller counts it on confirm.
    also = []
    perf = next((p for p in perfs if perf_key(p["sk"]) == key), None)
    panel_values = perf and judged(perf, episode.get("panel") or meta["defaultPanel"])
    if "value" in given and panel_values:
        change = (key, None, board_dynamo.contribution(panel_values, given["value"]))
        also = board_dynamo.ops(sub, show, season, ep, [change])

    stored = create_score(
        {
            "pk": pk,
            "sk": f"PERF#{key}#USER#{sub}",
            **given,
            "submittedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        },
        also,
    )
    if stored.get("value") != given.get("value") or stored.get("forfeit") != given.get("forfeit"):
        raise ConflictError("Already answered; answers are final")
    return ok(
        {"key": key, **{k: stored[k] for k in ("value", "forfeit", "submittedAt") if k in stored}}
    )
