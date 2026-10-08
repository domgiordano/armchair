"""
POST /admin/answer - set or clear one user's score or pick, for someone stuck. Admins only.

Body: {"sub": <user>, "season": "dwts-35" | "tus-5", "ep": "05", "key": <performance
key, or MURDER | RT | RECRUIT>, "reason": str} plus one of "value": 1-10 (DWTS),
"picks": [ids] (Traitors), "forfeit": true or "clear": true. A closed episode also
needs "override": true and "confirm": "OVERRIDE"; an unaired one is 409. The board
is re-counted, and the change is logged with before and after. Rules: common/fixes.py.
"""

from __future__ import annotations

from lambdas.common import events_dynamo
from lambdas.common.admins import reason, require_admin, target
from lambdas.common.api import api_handler, body, ok
from lambdas.common.fixes import Episode


@api_handler("admin_answer")
def handler(event, context):
    admin = require_admin(event)
    data = body(event)
    sub, why = target(data), reason(data)
    ep = Episode(data, sub)
    before, after = ep.fix(data, admin)
    where = {"season": f"{ep.show}-{ep.season}", "ep": ep.ep, "key": data["key"], "state": ep.state}
    events_dynamo.audit(
        admin, "answer", sub, why, {**where, "answer": before}, {**where, "answer": after}
    )
    return ok({**where, "answer": after})
