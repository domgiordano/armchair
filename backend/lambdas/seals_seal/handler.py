"""
POST /seals/seal - keep answers face down: a lock-in's "Not yet", or a device's seals
from before they synced, posted once.

Body: {"app": "dwts" | "traitors", "ids": ["dwts-35|6|a-b#1", ...]}. Sealing what is
already sealed changes nothing. Returns {app, sealed}: every id the caller holds in the
app. Over seals.MAX in all is 400; no profile yet is 404. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common import seals
from lambdas.common.api import api_handler, body, caller_sub, ok


@api_handler("seals_seal")
def handler(event, context):
    sub = caller_sub(event)
    source = body(event)
    app = seals.app_of(source)
    held = seals.add(sub, seals.valid(app, source.get("ids")))
    return ok({"app": app, "sealed": seals.of_app(app, held)})
