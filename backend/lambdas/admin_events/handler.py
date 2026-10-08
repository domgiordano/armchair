"""
GET /admin/events[?limit=50] - the newest activity events across every site,
each with the signed-in user's card. Admins only; the console polls it.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.api import ValidationError, api_handler, ok, query
from lambdas.common.events_dynamo import recent
from lambdas.common.users_dynamo import cards

FIELDS = ("sk", "uid", "sub", "did", "app", "kind", "name", "route", "session", "device", "props")


def shown(row: dict) -> dict:
    return {"at": row["sk"].partition("#")[0], **{k: row[k] for k in FIELDS if k in row}}


@api_handler("admin_events")
def handler(event, context):
    require_admin(event)
    raw = query(event).get("limit") or "50"
    if not raw.isdigit() or not 1 <= int(raw) <= 200:
        raise ValidationError("limit must be 1 to 200", field="limit")
    rows = [shown(r) for r in recent(int(raw))]
    people = cards({r["sub"] for r in rows if r.get("sub")})
    return ok({"events": rows, "people": people})
