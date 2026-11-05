"""
POST /scores/call - the caller's final call on one of the night's segments.

Body: {"season": "dwts-35", "ep": "10", "kind": "dance-off", "picks": ["<cid>", ...]}

`kind` is one the episode's format names (common/calls.py): a marathon takes
the one couple you think lasts longest, a dance-off up to half the couples
dancing that night as its winners. Final like a score: a retry with the same
picks returns the stored row, different ones are 409.

Blind: calls open once the night's couples are set (calls.known; 409
calls_not_open before then) and lock when the episode airs (window.airs_at;
403 calls_locked from then on). A past season is 403.
"""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from lambdas.common import calls, window
from lambdas.common.api import (
    ConflictError,
    ForbiddenError,
    ValidationError,
    api_handler,
    body,
    caller_sub,
    ok,
    text,
)
from lambdas.common.episodes_dynamo import (
    create_score,
    episode_pk,
    episode_rows,
    performances,
    ref,
    season_rows,
)
from lambdas.common.gate import is_open, rateable


@api_handler("scores_call")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)
    show, season, ep = ref(data)
    kind = text(data, "kind")
    picks = data.get("picks")
    if not isinstance(picks, list) or not all(isinstance(p, str) for p in picks):
        raise ValidationError("picks must be a list of couple ids", field="picks")

    rows = season_rows(show, season)
    meta, episode, contestants = episode_rows(rows, show, season, ep)
    if is_open(meta):
        raise ForbiddenError("Past seasons are view-only", season=f"{show}-{season}")
    if kind not in calls.kinds(episode):
        raise ValidationError(f"This episode has no {kind} to call", field="kind")
    locks = window.airs_at(episode, ZoneInfo(meta["timezone"]))
    if locks is not None and window.now() >= locks:
        raise ForbiddenError(
            "Calls locked at showtime", code="calls_locked", locksAt=window.iso(locks)
        )
    previous = next((r for r in rows if r["sk"] == f"EP#{ep - 1:02d}"), None)
    if locks is None or not calls.known(episode, previous):
        raise ConflictError("Calls open once the night's couples are set", code="calls_not_open")
    dancing = calls.couples(
        rateable(ep, episode, contestants, performances(episode_pk(show, season, ep)))
    )
    most = calls.limit(kind, len(dancing))
    if not 1 <= len(set(picks)) == len(picks) <= most:
        raise ValidationError(f"Pick 1 to {most} different couples", field="picks")
    if not set(picks) <= dancing:
        raise ValidationError("Pick couples dancing that night", field="picks")

    stored = create_score(
        {
            "pk": calls.pk(show, season, ep),
            "sk": calls.sk(kind, sub),
            "picks": sorted(picks),
            "submittedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        }
    )
    if stored["picks"] != sorted(picks):
        raise ConflictError("Already called; calls are final")
    return ok({"kind": kind, "picks": stored["picks"], "submittedAt": stored["submittedAt"]})
