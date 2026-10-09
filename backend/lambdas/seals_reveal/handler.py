"""
POST /seals/reveal - turn face-down answers over.

Body: {"app": "dwts" | "traitors", "ids": [...]} for those, or {"app", "season":
"dwts-35", "ep": 6} for every one in that episode, including any sealed on another
device. Revealing what isn't sealed changes nothing. Returns {app, sealed}: the ids
still face down in the app. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common import seals
from lambdas.common.api import api_handler, body, caller_sub, ok
from lambdas.common.episodes_dynamo import ref


@api_handler("seals_reveal")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    app = seals.app_of(source)
    if "ids" in source:
        ids = seals.valid(app, source["ids"])
    else:
        show, season, ep = ref(source)
        held = seals.of_app(app, seals.stored(sub))
        ids = {i for i in held if i.startswith(f"{show}-{season}|{ep}|")}
        if not ids:
            return ok({"app": app, "sealed": held})
    return ok({"app": app, "sealed": seals.of_app(app, seals.remove(sub, ids))})
