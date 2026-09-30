"""
GET /users/me - upsert the caller's profile from their ID token claims and return it.

Identity is sub + email from the Cognito authorizer; name and picture come from
the Google attribute mapping when present. With no picture, avatarKind is
"initials" and the client draws them from name.
"""

from __future__ import annotations

from lambdas.common.api import api_handler, caller_email, caller_sub, claims, ok
from lambdas.common.logger import get_logger
from lambdas.common.users_dynamo import upsert

log = get_logger(__file__)


@api_handler("users_me")
def handler(event, context):
    sub = caller_sub(event)
    email = caller_email(event)
    token = claims(event)
    name = (token.get("name") or "").strip() or None
    picture = (token.get("picture") or "").strip() or None
    # PLAN.md leaves open whether the authorizer passes `picture` through; this
    # answers it in CloudWatch without logging the value.
    log.info("users_me claims: name=%s picture=%s", bool(name), bool(picture))
    return ok(upsert(sub, email, name, picture))
