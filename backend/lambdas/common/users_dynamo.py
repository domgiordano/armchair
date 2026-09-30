"""armchair-users: one profile per Cognito sub, mirrored from the ID token."""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common.dynamo import table

FIELDS = ("email", "name", "picture", "avatarKind", "createdAt", "lastSeenAt")


def upsert(sub: str, email: str, name: str | None, picture: str | None) -> dict:
    """
    Writes the token's identity over the stored profile. A claim missing from
    the token is removed rather than kept, so the profile never shows a photo
    Google has stopped sending.
    """
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    values = {
        ":email": email,
        ":kind": "google" if picture else "initials",
        ":now": now,
    }
    sets = [
        "email = :email",
        "avatarKind = :kind",
        "lastSeenAt = :now",
        "createdAt = if_not_exists(createdAt, :now)",
    ]
    removes = []
    if name:
        sets.append("#name = :name")
        values[":name"] = name
    else:
        removes.append("#name")
    if picture:
        sets.append("picture = :picture")
        values[":picture"] = picture
    else:
        removes.append("picture")

    expression = "SET " + ", ".join(sets)
    if removes:
        expression += " REMOVE " + ", ".join(removes)
    item = table("USERS_TABLE").update_item(
        Key={"sub": sub},
        UpdateExpression=expression,
        # `name` is a DynamoDB reserved word.
        ExpressionAttributeNames={"#name": "name"},
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return {"sub": sub, **{k: item.get(k) for k in FIELDS}}
