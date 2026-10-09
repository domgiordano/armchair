"""
The caller's "Not yet" seals: answers locked in whose results they chose to keep face
down until they reveal them. One string set, `seals`, on their armchair-users item, of
ids `{show}-{season}|{ep}|{item}`, the item a DWTS dance key (`a+b#1`) or a Traitors
event type. The ids are the apps' own (packages/app-core/src/show/sealed.ts), so a
device's cache and the server hold the same strings.

Every gated read narrows by these (gate.sees, traitors_gate), and so does the email
digest. A seal only ever hides; nothing here opens what the gate keeps closed.
"""

from __future__ import annotations

import re

from botocore.exceptions import ClientError

from lambdas.common.api import NotFoundError, ValidationError
from lambdas.common.dynamo import resource, table
from lambdas.common.gate import sealed_param

ATTR = "seals"
# Far past a season of dances and calls; keeps the users item small.
MAX = 600
IDS = {
    "dwts": re.compile(r"dwts-\d{1,3}\|\d{1,2}\|[a-z0-9-]+(\+[a-z0-9-]+)*#\d{1,2}"),
    "traitors": re.compile(r"(tus|tuk|tukc)-\d{1,3}\|\d{1,2}\|(MURDER|RT|RECRUIT)"),
}

Sealed = set[tuple[int, str]]


def app_of(source: dict) -> str:
    app = source.get("app")
    if app not in IDS:
        raise ValidationError("app must be dwts or traitors", field="app")
    return app


def valid(app: str, ids: object) -> set[str]:
    if not isinstance(ids, list) or not ids or len(ids) > MAX:
        raise ValidationError(f"ids must be a list of 1 to {MAX} ids", field="ids")
    bad = [i for i in ids if not isinstance(i, str) or not IDS[app].fullmatch(i)]
    if bad:
        raise ValidationError(f"Not a {app} seal id", field="ids", ids=bad[:5])
    return set(ids)


def of_app(app: str, ids: set[str]) -> list[str]:
    return sorted(i for i in ids if IDS[app].fullmatch(i))


def stored(sub: str) -> set[str]:
    item = table("USERS_TABLE").get_item(Key={"sub": sub}, ProjectionExpression=ATTR).get("Item")
    return set((item or {}).get(ATTR) or ())


def stored_many(subs: set[str]) -> dict[str, set[str]]:
    """stored() for many users at once, as the digest needs; a user with none is left out."""
    tbl = table("USERS_TABLE")
    keys = [{"sub": s} for s in sorted(subs)]
    out = {}
    for i in range(0, len(keys), 100):
        request = {
            tbl.name: {
                "Keys": keys[i : i + 100],
                "ProjectionExpression": "#sub, #seals",
                "ExpressionAttributeNames": {"#sub": "sub", "#seals": ATTR},
            }
        }
        while request:
            page = resource().batch_get_item(RequestItems=request)
            for row in page["Responses"].get(tbl.name, []):
                if row.get(ATTR):
                    out[row["sub"]] = set(row[ATTR])
            request = page.get("UnprocessedKeys")
    return out


def in_season(ids: set[str], show: str, season: int) -> Sealed:
    """(ep, item) of the ids in one season."""
    prefix = f"{show}-{season}|"
    out = set()
    for i in ids:
        if i.startswith(prefix):
            _, ep, item = i.split("|")
            out.add((int(ep), item))
    return out


def of(sub: str, show: str, season: int, params: dict | None = None) -> Sealed:
    """
    The caller's seals in one season. A DWTS read may also name some in `sealed`
    (gate.sealed_param): a device's seal that hasn't reached the server yet. Those only
    add; one revealed on another device drops out once that device's cache syncs.
    """
    out = in_season(stored(sub), show, season)
    if params:
        out |= sealed_param(params)
    return out


def held_by(subs: set[str], season_id: str) -> dict[str, set[int]]:
    """Per user, the episodes of `season_id` (`dwts-35`, `tus-5`) they hold anything sealed in."""
    show, number = season_id.rsplit("-", 1)
    return {s: episodes(in_season(ids, show, int(number))) for s, ids in stored_many(subs).items()}


def keys(sealed: Sealed, ep: int) -> set[str]:
    """The sealed items of one episode."""
    return {item for n, item in sealed if n == ep}


def episodes(sealed: Sealed) -> set[int]:
    return {n for n, _ in sealed}


def _update(sub: str, op: str, ids: set[str]) -> set[str]:
    try:
        out = table("USERS_TABLE").update_item(
            Key={"sub": sub},
            UpdateExpression=f"{op} #seals :ids",
            ConditionExpression="attribute_exists(#sub)",
            ExpressionAttributeNames={"#seals": ATTR, "#sub": "sub"},
            ExpressionAttributeValues={":ids": ids},
            ReturnValues="ALL_NEW",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        raise NotFoundError("No profile yet; load /users/me first")
    return set(out["Attributes"].get(ATTR) or ())


def add(sub: str, ids: set[str]) -> set[str]:
    """Seals `ids`, returning every seal the caller holds."""
    if len(stored(sub) | ids) > MAX:
        raise ValidationError(f"At most {MAX} answers can stay face down; reveal some first")
    return _update(sub, "ADD", ids)


def remove(sub: str, ids: set[str]) -> set[str]:
    """Reveals `ids`, returning the seals left. Revealing what isn't sealed is a no-op."""
    return _update(sub, "DELETE", ids)
