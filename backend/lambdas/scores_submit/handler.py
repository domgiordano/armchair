"""
POST /scores/submit - the caller's final answer on one performance.

Body: {"season": "dwts-35", "ep": "05", "contestant": "<cid>", "n": 1, "value": 1-10}
or the same with {"forfeit": true} in place of value ("Reveal without scoring").

Answers are final. A retry with the same answer returns the stored row; a
different one is 409. Identity is the Cognito sub.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common.api import (
    ConflictError,
    NotFoundError,
    ValidationError,
    api_handler,
    body,
    caller_sub,
    ok,
    text,
    whole,
)
from lambdas.common.episodes_dynamo import catalog, create_score, episode_pk, performances, ref
from lambdas.common.gate import cid, rateable


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

    _, episode, contestants = catalog(show, season, ep)
    pk = episode_pk(show, season, ep)
    key = f"{contestant}#{n}"
    if key not in rateable(ep, episode, contestants, performances(pk)):
        if contestant not in {cid(c) for c in contestants}:
            raise NotFoundError("Unknown contestant", contestant=contestant)
        raise ValidationError("That performance can't be scored in this episode", key=key)

    stored = create_score(
        {
            "pk": pk,
            "sk": f"PERF#{key}#USER#{sub}",
            **given,
            "submittedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        }
    )
    if stored.get("value") != given.get("value") or stored.get("forfeit") != given.get("forfeit"):
        raise ConflictError("Already answered; answers are final")
    return ok(
        {"key": key, **{k: stored[k] for k in ("value", "forfeit", "submittedAt") if k in stored}}
    )
