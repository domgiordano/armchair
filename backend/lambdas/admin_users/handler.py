"""
GET /admin/users[?days=30] - every user with their activity over the last `days`
(1-90): events, sessions, answers made, last active, per-app events and group
count, most events first. Admins only. The console searches and sorts it.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.analytics import users_table
from lambdas.common.api import ValidationError, api_handler, ok, query


@api_handler("admin_users")
def handler(event, context):
    require_admin(event)
    raw = query(event).get("days") or "30"
    if not raw.isdigit() or not 1 <= int(raw) <= 90:
        raise ValidationError("days must be 1 to 90", field="days")
    rows = users_table(int(raw))
    return ok(rows, meta={"count": len(rows), "days": int(raw)})
