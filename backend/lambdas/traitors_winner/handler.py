"""
POST /traitors/winner - the caller's season-long winner bet, made before anything else.

Body: {"season": "tus-5", "picks": [{"player": "<id>", "faction": "Faithful"|"Traitor"}]},
one or two picks. Final, like every pick. `released` records how many episodes were out
when it was made: the points multiplier is (episodes - released) / episodes.
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
from lambdas.common.traitors_dynamo import bet_key, season_parts, traitors_ref
from lambdas.common.traitors_gate import bet_roster, released

FACTIONS = {"Faithful", "Traitor"}


def picks(data: dict, allowed: set[str]) -> list[dict]:
    given = data.get("picks")
    if not isinstance(given, list) or not 1 <= len(given) <= 2:
        raise ValidationError("Pick one or two winners", field="picks")
    out = []
    for p in given:
        if (
            not isinstance(p, dict)
            or p.get("player") not in allowed
            or p.get("faction") not in FACTIONS
        ):
            raise ValidationError(
                "Each pick needs a player still in the game and Faithful or Traitor", field="picks"
            )
        out.append({"player": p["player"], "faction": p["faction"]})
    if len({p["player"] for p in out}) != len(out):
        raise ValidationError("Pick two different players", field="picks")
    return out


@api_handler("traitors_winner")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)
    show, number = traitors_ref(data)
    meta, episodes, players = season_parts(season_rows(show, number), show, number)
    if not meta.get("current"):
        raise ForbiddenError("Past seasons are view-only", season=f"{show}-{number}")
    given = picks(data, {p["id"] for p in bet_roster(meta, episodes, players)})

    stored = create_score(
        {
            **bet_key(show, number, sub),
            "picks": given,
            "released": released(episodes, int(time.time())),
            "submittedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        }
    )
    if stored["picks"] != given:
        raise ConflictError("Already bet; the winner bet is final")
    return ok({k: stored[k] for k in ("picks", "released", "submittedAt")})
