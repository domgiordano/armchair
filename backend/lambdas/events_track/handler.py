"""
POST /events/track - a signed-in visitor's batch of activity events.

Body: {"app": "dwts" | "traitors" | "hub", "did": <browser id>, "session": <id>,
"device": "phone" | "tablet" | "desktop", "events": [{"kind": "view" | "action" | "error",
"name": str, "route": "/path?season=..", "at": <epoch ms>, "props": {..}}]}, at most 25.
Identity is the Cognito sub, so a signed-in visitor is tracked under their account
whatever their Do-Not-Track setting: the same data the app holds about them anyway
(docs/architecture/activity.md). Returns {"accepted": n}.
"""

from __future__ import annotations

from lambdas.common import events_dynamo as events
from lambdas.common.api import api_handler, body, caller_sub, ok


@api_handler("events_track")
def handler(event, context):
    sub = caller_sub(event)
    rows = events.clean(body(event), sub)
    events.allow(sub, len(rows))
    events.write(rows)
    return ok({"accepted": len(rows)})
