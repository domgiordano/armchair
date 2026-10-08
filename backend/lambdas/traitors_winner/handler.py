"""
POST /traitors/winner - the caller's ranked top 3 winners for a current season.

Body: {"season": "tus-5", "picks": [{"player": "<id>", "faction": "Faithful"|"Traitor"}]},
one to three picks in rank order, 1st choice first. A sealed slot is final. A bet with
fewer than three can be completed later: send the sealed picks unchanged with the new
ones after them. Anything that changes a sealed slot is 409; the same bet again returns
it. Each slot records `released`, how many episodes were out when it was sealed: its
points multiplier is (episodes - released) / episodes. Scoring: common/points.py.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime

from lambdas.common.api import (
    ConflictError,
    ForbiddenError,
    ValidationError,
    api_handler,
    body,
    caller_sub,
    ok,
)
from lambdas.common.episodes_dynamo import create_score, season_rows
from lambdas.common.points import RANK_SHARE
from lambdas.common.traitors_dynamo import bet, bet_key, extend_bet, season_parts, traitors_ref
from lambdas.common.traitors_gate import bet_roster, released

FACTIONS = {"Faithful", "Traitor"}
MAX_PICKS = len(RANK_SHARE)


def picks(data: dict) -> list[dict]:
    given = data.get("picks")
    if not isinstance(given, list) or not 1 <= len(given) <= MAX_PICKS:
        raise ValidationError(f"Pick 1-{MAX_PICKS} winners", field="picks")
    out = []
    for p in given:
        if (
            not isinstance(p, dict)
            or not isinstance(p.get("player"), str)
            or p.get("faction") not in FACTIONS
        ):
            raise ValidationError("Each pick needs a player and Faithful or Traitor", field="picks")
        out.append({"player": p["player"], "faction": p["faction"]})
    if len({p["player"] for p in out}) != len(out):
        raise ValidationError("Pick different players", field="picks")
    return out


def calls(slots: list[dict]) -> list[tuple[str, str]]:
    return [(p["player"], p["faction"]) for p in slots]


@api_handler("traitors_winner")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)
    show, number = traitors_ref(data)
    given = picks(data)
    meta, episodes, players = season_parts(season_rows(show, number), show, number)
    if not meta.get("current"):
        raise ForbiddenError("Past seasons are view-only", season=f"{show}-{number}")

    stored = bet(show, number, sub)
    have = list(stored["picks"]) if stored else []
    if calls(given[: len(have)]) != calls(have):
        raise ConflictError("Sealed winner picks are final; you can only fill empty places")
    added = given[len(have) :]
    allowed = {p["id"] for p in bet_roster(meta, episodes, players)}
    if any(p["player"] not in allowed for p in added):
        raise ValidationError("Each pick needs a player still in the game", field="picks")

    out = released(episodes, int(time.time()))
    added = [{**p, "released": out} for p in added]
    if stored is None:
        stored = create_score(
            {
                **bet_key(show, number, sub),
                "picks": added,
                "released": out,
                "submittedAt": datetime.now(UTC).isoformat(timespec="seconds"),
            }
        )
        if calls(stored["picks"]) != calls(added):
            raise ConflictError("Already bet; the winner bet is final")
    elif added:
        if not extend_bet(show, number, sub, len(have), added):
            raise ConflictError("Your bet changed since you loaded it; reload and try again")
        stored = {**stored, "picks": have + added}
    return ok({k: stored[k] for k in ("picks", "released", "submittedAt")})
