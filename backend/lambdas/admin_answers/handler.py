"""
GET /admin/answers?sub=<user>&season=dwts-35|tus-5&ep=05 - one user's answers in one
episode, for fixing a stuck score or pick. Admins only.

Returns {season, ep, app, state: live | closed | upcoming, slots: [{key, label,
picks?, answer}], roster?}: every performance (DWTS) or event (Traitors) with the
user's own answer or null, and for Traitors the players still in. Nobody else's
answers and no results. Rules: common/fixes.py.
"""

from __future__ import annotations

from lambdas.common.admins import require_admin, target
from lambdas.common.api import api_handler, ok, query
from lambdas.common.fixes import Episode


@api_handler("admin_answers")
def handler(event, context):
    require_admin(event)
    q = query(event)
    return ok(Episode(q, target(q)).view())
