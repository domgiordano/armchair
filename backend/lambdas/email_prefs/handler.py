"""
GET /email/prefs - the caller's email address, each email type on or off, and
whether they have seen the first-run notice.

Response: {address, prefs: {type: bool}, noticeSeen, suppressed}. Types are
common/email_prefs.TYPES. Identity is the Cognito sub.
"""

from __future__ import annotations

from lambdas.common.api import NotFoundError, api_handler, caller_sub, ok
from lambdas.common.email_view import settings_view
from lambdas.common.users_dynamo import email_settings


@api_handler("email_prefs")
def handler(event, context):
    row = email_settings(caller_sub(event))
    if row is None:
        raise NotFoundError("No profile yet; load /users/me first")
    return ok(settings_view(row))
