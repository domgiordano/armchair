"""
POST /admin/profile - change someone's display name or reset their photo. Admins only.

Body: {"sub": <user>, "reason": str, "name": str (2-40) | null, "resetAvatar": true}, with
name, resetAvatar or both. A null name drops their custom name, back to Google's.
resetAvatar drops an uploaded photo (deleting it) and their photo choice, back to
Google's picture or initials. The search index follows. Logged with before and after.
"""

from __future__ import annotations

from lambdas.common import events_dynamo
from lambdas.common.admins import reason, require_admin, target
from lambdas.common.api import ValidationError, api_handler, body, ok
from lambdas.common.social_dynamo import index_name
from lambdas.common.users_dynamo import admin_update

NAME_MIN, NAME_MAX = 2, 40
SHOWN = ("name", "customName", "picture", "avatarKind")


@api_handler("admin_profile")
def handler(event, context):
    admin = require_admin(event)
    data = body(event)
    sub, why = target(data), reason(data)
    changes = {}
    if "name" in data:
        name = data["name"]
        if name is not None and (
            not isinstance(name, str) or not NAME_MIN <= len(name.strip()) <= NAME_MAX
        ):
            raise ValidationError(
                f"name must be {NAME_MIN} to {NAME_MAX} characters, or null", field="name"
            )
        changes["customName"] = name and name.strip()
    if data.get("resetAvatar") is True:
        changes["avatarChoice"] = None
        changes["uploadKey"] = None
    if not changes:
        raise ValidationError("Send a name, resetAvatar: true, or both")

    before, after = admin_update(sub, changes)
    index_name(sub, after["name"], after["picture"], after["avatarKind"])
    events_dynamo.audit(
        admin,
        "profile",
        sub,
        why,
        {k: before.get(k) for k in SHOWN},
        {k: after.get(k) for k in SHOWN},
    )
    return ok(after)
