"""
GET /admin/overview - the console's dashboard. Admins only.

DAU/WAU/MAU overall and per app, active users and signups by week, retention by
signup week, the 30-day funnel (devices -> signed in -> answered, and signups),
and answers per episode of every current season. Shape: common/analytics.py overview().
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.analytics import overview
from lambdas.common.api import api_handler, ok


@api_handler("admin_overview")
def handler(event, context):
    require_admin(event)
    return ok(overview())
