"""
GET /admin/email-log[?type=<type>&event=<event>] - what email went out. Admins only.

Without `type`: every email type's runs, newest first, each {event, lastAt,
sent, failed, held, off, dup, suppressed, noaddress, noprofile} (absent counts
are 0). Types are common/email_prefs.TYPES. With `type` and `event`: that
event's readers, each {sub, name, status, at}. Also returns `templates`, the
names POST /admin/email-test takes.
"""

from __future__ import annotations

from lambdas.common import email_dynamo
from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, ok, query
from lambdas.common.email_prefs import TYPES
from lambdas.common.email_samples import SAMPLES
from lambdas.common.users_dynamo import cards

OUTCOMES = ("sent", "failed", "held", "off", "dup", "suppressed", "noaddress", "noprofile", "error")


def _run(row: dict) -> dict:
    return {
        "event": row["sk"],
        "lastAt": row.get("lastAt"),
        **{k: int(row.get(k, 0)) for k in OUTCOMES},
    }


@api_handler("admin_email_log")
def handler(event, context):
    require_admin(event)
    params = query(event)
    kind, ev = params.get("type"), params.get("event")
    if kind is not None and kind not in TYPES:
        raise ValidationError("type is not an email type", field="type", types=list(TYPES))
    if kind and ev:
        rows = email_dynamo.sent(kind, ev)
        subs = {r["sk"].removeprefix("USER#") for r in rows}
        people = cards(subs) if subs else {}
        readers = [
            {
                "sub": s,
                "name": people[s]["name"],
                "status": r["status"],
                "at": r["at"],
            }
            for r in rows
            for s in [r["sk"].removeprefix("USER#")]
        ]
        return ok({"type": kind, "event": ev, "readers": readers}, meta={"count": len(readers)})

    types = [kind] if kind else list(TYPES)
    runs = {
        t: sorted(
            (_run(r) for r in email_dynamo.runs(t)), key=lambda r: r["lastAt"] or "", reverse=True
        )
        for t in types
    }
    return ok({"runs": runs, "templates": sorted(SAMPLES)})
