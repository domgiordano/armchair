"""
POST /events/anon - a signed-out visitor's batch of activity events. No token.

Body as /events/track. Rows are keyed anon#{did}, a random id the browser made, and
carry no sub. A request with DNT: 1 or Sec-GPC: 1 writes nothing, which the client
honours already by not sending. Rate-limited per source IP, which is hashed and
kept only for the minute it counts.
"""

from __future__ import annotations

import hashlib

from lambdas.common import events_dynamo as events
from lambdas.common.api import api_handler, body, ok


def opted_out(event: dict) -> bool:
    headers = {k.lower(): v for k, v in ((event or {}).get("headers") or {}).items()}
    return headers.get("dnt") == "1" or headers.get("sec-gpc") == "1"


@api_handler("events_anon")
def handler(event, context):
    if opted_out(event):
        return ok({"accepted": 0})
    rows = events.clean(body(event), None)
    ip = ((event.get("requestContext") or {}).get("identity") or {}).get("sourceIp") or "unknown"
    events.allow("ip#" + hashlib.sha256(ip.encode()).hexdigest()[:16], len(rows))
    events.write(rows)
    return ok({"accepted": len(rows)})
