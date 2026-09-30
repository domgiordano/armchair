"""
PATCH /users/update - set the caller's display name and which photo they show.

Body, any of: name (2-40 characters once trimmed), avatar (google | upload |
initials), uploadKey (from /users/avatar-upload, after the browser has sent the
file). An uploadKey on its own also switches the avatar to it. The friend-search
row follows the new name and photo.
"""

from __future__ import annotations

from lambdas.common import avatars
from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.social_dynamo import index_name
from lambdas.common.users_dynamo import CHOICES, update

NAME_MIN, NAME_MAX = 2, 40


@api_handler("users_update")
def handler(event, context):
    sub = caller_sub(event)
    req = body(event)
    name, avatar, key = req.get("name"), req.get("avatar"), req.get("uploadKey")
    if name is None and avatar is None and key is None:
        raise ValidationError("Send a name, an avatar or an uploadKey")

    if name is not None:
        if not isinstance(name, str) or not NAME_MIN <= len(name.strip()) <= NAME_MAX:
            raise ValidationError(f"name must be {NAME_MIN} to {NAME_MAX} characters", field="name")
        name = name.strip()
    if avatar is not None and avatar not in CHOICES:
        raise ValidationError("avatar must be google, upload or initials", field="avatar")
    if key is not None:
        # The key is the only thing tying a photo to its owner, so it must sit
        # under the caller's own prefix.
        if not isinstance(key, str) or not avatars.owns(sub, key):
            raise ValidationError("uploadKey is not one of your uploads", field="uploadKey")
        if avatar not in (None, "upload"):
            raise ValidationError("uploadKey only goes with avatar=upload", field="avatar")
        avatar = "upload"

    profile = update(sub, name, avatar, key)
    index_name(sub, profile["name"], profile["picture"], profile["avatarKind"])
    return ok(profile)
