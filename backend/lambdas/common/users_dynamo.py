"""
armchair-users: one profile per Cognito sub.

Google's name and photo are mirrored from the ID token into googleName and
googlePicture on every sign-in. What the user picked lives beside them:
customName, avatarChoice (google | upload | initials) and uploadKey. The
effective name, picture and avatarKind are stored too, because other handlers
read them straight off the row (groups_dynamo._profiles); _settle keeps them in
step with the inputs.
"""

from __future__ import annotations

from datetime import UTC, datetime

from lambdas.common import avatars
from lambdas.common.api import NotFoundError, ValidationError
from lambdas.common.dynamo import resource, table

FIELDS = ("email", "name", "picture", "avatarKind", "createdAt", "lastSeenAt")
CHOICES = ("google", "upload", "initials")
# What other users may see of someone: a name and a face, never the email.
CARD_FIELDS = ("name", "picture", "avatarKind")


def upsert(sub: str, email: str, name: str | None, picture: str | None) -> dict:
    """
    Writes the token's identity over the stored Google fields. A claim missing
    from the token is removed rather than kept, so the profile never shows a
    photo Google has stopped sending.
    """
    now = datetime.now(UTC).isoformat(timespec="seconds")
    item = _write(
        sub,
        {
            "email": email,
            "lastSeenAt": now,
            "googleName": name,
            "googlePicture": picture,
        },
        created=now,
    )
    return view(_settle(item))


def update(sub: str, name: str | None, avatar: str | None, upload_key: str | None) -> dict:
    """Applies the caller's choices. A replaced upload is deleted from the bucket."""
    old = table("USERS_TABLE").get_item(Key={"sub": sub}).get("Item")
    if old is None:
        raise NotFoundError("No profile yet; load /users/me first")
    if avatar == "upload" and not (upload_key or old.get("uploadKey")):
        raise ValidationError("Upload a photo before choosing it", field="avatar")

    changes = {}
    if name is not None:
        changes["customName"] = name
    if avatar is not None:
        changes["avatarChoice"] = avatar
    if upload_key is not None:
        changes["uploadKey"] = upload_key
    item = _settle(_write(sub, changes))

    replaced = old.get("uploadKey")
    if upload_key and replaced and replaced != upload_key:
        avatars.delete(replaced)
    return view(item)


def effective(item: dict) -> dict:
    """The name, picture and avatarKind everyone sees, from what's stored."""
    choice = item.get("avatarChoice")
    if choice == "upload" and item.get("uploadKey"):
        picture, kind = avatars.url(item["uploadKey"]), "upload"
    elif choice != "initials" and item.get("googlePicture"):
        picture, kind = item["googlePicture"], "google"
    else:
        picture, kind = None, "initials"
    return {
        "name": item.get("customName") or item.get("googleName"),
        "picture": picture,
        "avatarKind": kind,
    }


def view(item: dict) -> dict:
    """The owner's own profile: the effective fields plus what they can switch between."""
    key = item.get("uploadKey")
    return {
        "sub": item["sub"],
        **{k: item.get(k) for k in FIELDS},
        "customName": item.get("customName"),
        "googleName": item.get("googleName"),
        "googlePicture": item.get("googlePicture"),
        "uploadPicture": avatars.url(key) if key else None,
    }


def _settle(item: dict) -> dict:
    """Rewrites the stored effective fields when they have drifted from the inputs."""
    want = effective(item)
    if all(item.get(k) == v for k, v in want.items()):
        return item
    return _write(item["sub"], want)


def _write(sub: str, values: dict, created: str | None = None) -> dict:
    """SETs each non-empty value and REMOVEs each None, returning the whole new row."""
    names = {f"#{k}": k for k in values}
    sets = [f"#{k} = :{k}" for k, v in values.items() if v is not None]
    removes = [f"#{k}" for k, v in values.items() if v is None]
    attrs = {f":{k}": v for k, v in values.items() if v is not None}
    if created:
        sets.append("createdAt = if_not_exists(createdAt, :created)")
        attrs[":created"] = created
    expression = "SET " + ", ".join(sets) if sets else ""
    if removes:
        expression += " REMOVE " + ", ".join(removes)
    kwargs = {
        "Key": {"sub": sub},
        "UpdateExpression": expression.strip(),
        "ExpressionAttributeNames": names,
        "ReturnValues": "ALL_NEW",
    }
    if attrs:
        kwargs["ExpressionAttributeValues"] = attrs
    return table("USERS_TABLE").update_item(**kwargs)["Attributes"]


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


def email_settings(sub: str) -> dict | None:
    """The address, the stored prefs and whether the first-run notice was seen; None with no profile."""
    row = (
        table("USERS_TABLE")
        .get_item(
            Key={"sub": sub},
            ProjectionExpression="email, emailPrefs, emailNoticeAt",
        )
        .get("Item")
    )
    return row


def set_email_settings(sub: str, prefs: dict | None, notice_at: str | None) -> dict:
    """Writes the whole prefs map and/or stamps the notice, returning the updated row."""
    values = {}
    if prefs is not None:
        values["emailPrefs"] = prefs
    if notice_at is not None:
        values["emailNoticeAt"] = notice_at
    return _write(sub, values)

