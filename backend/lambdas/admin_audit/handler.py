"""
GET /admin/audit[?before=<sk>&sub=<target>] - every admin support action, newest
first, 100 a page: who, what, the target, the reason, and before/after. `before`
is meta.next from the previous page. Admins only.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin
from lambdas.common.api import api_handler, ok, query
from lambdas.common.events_dynamo import audit_log


@api_handler("admin_audit")
def handler(event, context):
    require_admin(event)
    q = query(event)
    entries, next_key = audit_log(100, q.get("before"), q.get("sub"))
    return ok(entries, meta={"next": next_key})
