"""
GET /admin/me - whether the caller is a site admin. 200 {"email": ...} or 403.

The console asks before drawing anything; every other admin endpoint checks again.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.api import api_handler, ok


@api_handler("admin_me")
def handler(event, context):
    return ok({"email": require_admin(event)})
