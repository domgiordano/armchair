"""
POST /users/avatar-upload - a presigned S3 POST for one profile photo.

Body: contentType, one of image/jpeg, image/png, image/webp. The browser sends
the file to `url` with `fields`, then passes `key` to /users/update. S3 rejects
anything over 2 MB or of another type (common/avatars.py).
"""

from __future__ import annotations

from lambdas.common import avatars
from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok


@api_handler("users_avatar_upload")
def handler(event, context):
    sub = caller_sub(event)
    content_type = body(event).get("contentType")
    if not isinstance(content_type, str) or content_type not in avatars.TYPES:
        raise ValidationError(
            "contentType must be image/jpeg, image/png or image/webp", field="contentType"
        )
    key = avatars.new_key(sub, content_type)
    post = avatars.presigned_post(key, content_type)
    return ok(
        {"key": key, "url": post["url"], "fields": post["fields"], "maxBytes": avatars.MAX_BYTES}
    )
