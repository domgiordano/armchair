"""armchair-users: one profile per Cognito sub, mirrored from the ID token."""

from __future__ import annotations

from datetime import datetime, timezone

from lambdas.common.dynamo import resource, table

FIELDS = ("email", "name", "picture", "avatarKind", "createdAt", "lastSeenAt")
# What other users may see of someone: a name and a face, never the email.
CARD_FIELDS = ("name", "picture", "avatarKind")


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


def cards(subs: set[str]) -> dict[str, dict]:
    """A card per sub, with None fields for a sub that has no profile yet."""
    name = table("USERS_TABLE").name
    keys = [{"sub": s} for s in sorted(subs)]
    rows = {}
    for i in range(0, len(keys), 100):
        request = {
            name: {
                "Keys": keys[i : i + 100],
                "ProjectionExpression": "#sub, #name, picture, avatarKind",
                "ExpressionAttributeNames": {"#sub": "sub", "#name": "name"},
            }
        }
        while request:
            page = resource().batch_get_item(RequestItems=request)
            for row in page["Responses"].get(name, []):
                rows[row["sub"]] = row
            request = page.get("UnprocessedKeys")
    return {s: {"sub": s, **{f: rows.get(s, {}).get(f) for f in CARD_FIELDS}} for s in subs}


def card(sub: str) -> dict | None:
    """One user's card, or None when they have never signed in."""
    row = (
        table("USERS_TABLE")
        .get_item(
            Key={"sub": sub},
            ProjectionExpression="#sub, #name, picture, avatarKind",
            ExpressionAttributeNames={"#sub": "sub", "#name": "name"},
        )
        .get("Item")
    )
    return {"sub": sub, **{f: row.get(f) for f in CARD_FIELDS}} if row else None
