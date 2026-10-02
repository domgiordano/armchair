"""
POST /traitors/pick - the caller's final pick for one event in one episode.

Body: {"season": "tus-5", "ep": "05", "event": "RT", "picks": ["<id>", "<id>", "<id>"]}
(three, in order, for a round table; one for MURDER or RECRUIT), or {"forfeit": true}
in place of picks. Picks are final: a retry with the same pick returns it, a different
one is 409. A closed episode or finished season is 403, and so is any pick before the
caller's winner bet. A pick made after its result confirmed is scored here; the poller
has stopped looking by then.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common import traitors_board
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
from lambdas.common.episodes_dynamo import create_score, episode_pk, ref, season_rows
from lambdas.common.traitors_dynamo import bet, episode, season_parts, traitors_ref
from lambdas.common.traitors_gate import PICKS, closed, events, needs_bet, roster


def answer(data: dict, kind: str, allowed: set[str]) -> dict:
    if "forfeit" in data:
        if data["forfeit"] is not True or "picks" in data:
            raise ValidationError("Send either picks or forfeit: true", field="forfeit")
        return {"forfeit": True}
    picks = data.get("picks")
    if (
        not isinstance(picks, list)
        or len(picks) != PICKS[kind]
        or len(set(picks)) != len(picks)
        or not all(isinstance(p, str) and p in allowed for p in picks)
    ):
        raise ValidationError(
            f"{kind} takes {PICKS[kind]} different players still in the game", field="picks"
        )
    return {"picks": picks}


@api_handler("traitors_pick")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)
    show, number = traitors_ref(data)
    _, _, ep = ref(data)
    kind = text(data, "event")

    meta, episodes, players = season_parts(season_rows(show, number), show, number)
    found = episode(episodes, ep, show, number)
    if closed(meta, found):
        raise ForbiddenError("This episode is closed", season=f"{show}-{number}", ep=ep)
    if needs_bet(meta, bet(show, number, sub)):
        raise ForbiddenError("Lock in your winner bet first", needsBet=True)
    if kind not in events(found):
        raise ValidationError("That event isn't part of this episode", field="event")
    given = answer(data, kind, {p["id"] for p in roster(ep, players)})

    stored = create_score(
        {
            "pk": episode_pk(show, number, ep),
            "sk": f"EVT#{kind}#USER#{sub}",
            **given,
            "submittedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        }
    )
    if stored.get("picks") != given.get("picks") or stored.get("forfeit") != given.get("forfeit"):
        raise ConflictError("Already picked; picks are final")
    if "picks" in given:
        traitors_board.reconcile(show, number, ep)
    return ok(
        {
            "event": kind,
            **{k: stored[k] for k in ("picks", "forfeit", "submittedAt") if k in stored},
        }
    )
