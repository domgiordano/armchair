"""
GET /seals/list?app=dwts|traitors - the caller's answers still face down in one app, as
ids `{season}|{ep}|{item}` (common/seals.py). The apps cache this and sync it on load,
so a reveal on one device turns the result over on the others. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common import seals
from lambdas.common.api import api_handler, caller_sub, ok, query


@api_handler("seals_list")
def handler(event, context):
    sub = caller_sub(event)
    app = seals.app_of(query(event))
    return ok({"app": app, "sealed": seals.of_app(app, seals.stored(sub))})
