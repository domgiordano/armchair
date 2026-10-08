"""
POST /email/prefs-set - turn email types on or off, and/or dismiss the first-run notice.

Body, either or both: {"prefs": {"dwts.digest": false, ...}, "noticeSeen": true}.
`prefs` is partial; unnamed types keep their value. Returns what /email/prefs does.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common.api import NotFoundError, ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.email_prefs import parse, with_defaults
from lambdas.common.email_view import settings_view
from lambdas.common.users_dynamo import email_settings, set_email_settings


@api_handler("email_prefs_set")
def handler(event, context):
    sub = caller_sub(event)
    req = body(event)
    if "prefs" not in req and "noticeSeen" not in req:
        raise ValidationError("Send prefs, noticeSeen or both")
    if "noticeSeen" in req and req["noticeSeen"] is not True:
        raise ValidationError("noticeSeen can only be true", field="noticeSeen")
    changes = parse(req["prefs"]) if "prefs" in req else None

    row = email_settings(sub)
    if row is None:
        raise NotFoundError("No profile yet; load /users/me first")
    prefs = {**with_defaults(row.get("emailPrefs")), **changes} if changes else None
    notice = datetime.now(UTC).isoformat(timespec="seconds") if "noticeSeen" in req else None
    return ok(settings_view(set_email_settings(sub, prefs, notice)))
