"""
armchair-events: first-party activity from the three sites, its daily rollups, the
write rate limit, and the admin audit log. Design and privacy:
docs/architecture/activity.md.

    DAY#{yyyy-mm-dd}  {at}#{rand}   uid, sub?, did, app, kind, name, route, session, device, props
    ROLLUP            DAY#{date}    rollup(): per-app and per-user counts for one UTC day
    RATE#{key}        {minute}      n                    writes allowed per key per minute
    AUDIT             {at}#{rand}   admin, action, target, reason, before, after

GSI byUid (uid, sk) is one person's events newest first. uid is the sub when signed
in, else anon#{did}; did is a random id the browser keeps. Events and RATE rows
carry expiresAt; rollups and the audit log are kept.
"""

from __future__ import annotations

import re
import secrets
import time
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from lambdas.common.api import ApiError, ValidationError
from lambdas.common.dynamo import query_all, table

APPS = ("dwts", "traitors", "hub")
KINDS = ("view", "action", "error")
DEVICES = ("phone", "tablet", "desktop")
# Answers made: what the funnel's last step and the users table's "scores" column count.
ANSWERS = (
    "scores_submit",
    "scores_reveal_all",
    "scores_skip_before",
    "traitors_pick",
    "traitors_winner",
)
MAX_BATCH = 25
PER_MINUTE = 120
KEEP = timedelta(days=400)
# A batch queued offline arrives late; past this the client clock is not believed.
SKEW = timedelta(minutes=15)
ID = re.compile(r"[A-Za-z0-9_-]{8,64}")
NAME = re.compile(r"[a-z0-9_:./-]{1,64}")
PROP = re.compile(r"[A-Za-z]{1,24}")
# Query parameters a route keeps. Everything else is dropped: an invite code is the
# only key to its group, and the log has no business holding one.
ROUTE_PARAMS = ("season", "ep", "id", "tab", "show", "group")


def _now() -> datetime:
    return datetime.now(UTC)


def _ttl(at: datetime) -> int:
    return int((at + KEEP).timestamp())


def _route(value) -> str:
    if not isinstance(value, str) or not value.startswith("/"):
        raise ValidationError("route must be a path", field="route")
    path, _, qs = value[:300].partition("?")
    kept = []
    for pair in qs.split("&") if qs else []:
        k, _, v = pair.partition("=")
        if k in ROUTE_PARAMS and len(v) <= 64:
            kept.append(f"{k}={v}")
    return path[:200] + ("?" + "&".join(kept) if kept else "")


def _props(value) -> dict:
    if value is None:
        return {}
    if not isinstance(value, dict) or len(value) > 8:
        raise ValidationError("props must be an object of at most 8 keys", field="props")
    out = {}
    for k, v in value.items():
        if not PROP.fullmatch(str(k)):
            raise ValidationError("props keys are letters only", field="props")
        if isinstance(v, bool) or (isinstance(v, int) and abs(v) < 10**9):
            out[k] = v
        elif isinstance(v, str):
            out[k] = v[:100]
        else:
            raise ValidationError(
                "props values are short text, whole numbers or booleans", field="props"
            )
    return out


def _one_of(source: dict, field: str, allowed: tuple) -> str:
    value = source.get(field)
    if value not in allowed:
        raise ValidationError(f"{field} must be one of {', '.join(allowed)}", field=field)
    return value


def _id(source: dict, field: str) -> str:
    value = source.get(field)
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValidationError(f"{field} must be 8-64 letters, digits, - or _", field=field)
    return value


def clean(batch: dict, sub: str | None) -> list[dict]:
    """The rows a batch from the browser writes, or a 400 naming the first bad field."""
    app = _one_of(batch, "app", APPS)
    device = _one_of(batch, "device", DEVICES)
    did, session = _id(batch, "did"), _id(batch, "session")
    events = batch.get("events")
    if not isinstance(events, list) or not 1 <= len(events) <= MAX_BATCH:
        raise ValidationError(f"events must be a list of 1 to {MAX_BATCH}", field="events")

    now = _now()
    rows = []
    for e in events:
        if not isinstance(e, dict):
            raise ValidationError("each event must be an object", field="events")
        name = e.get("name")
        if not isinstance(name, str) or not NAME.fullmatch(name):
            raise ValidationError("name must be 1-64 of a-z 0-9 _ : . / -", field="name")
        at = e.get("at")
        when = datetime.fromtimestamp(at / 1000, UTC) if type(at) is int and at > 0 else now
        if abs(when - now) > SKEW:
            when = now
        stamp = when.isoformat(timespec="milliseconds").replace("+00:00", "Z")
        row = {
            "pk": f"DAY#{stamp[:10]}",
            "sk": f"{stamp}#{secrets.token_hex(3)}",
            "uid": sub or f"anon#{did}",
            "did": did,
            "app": app,
            "kind": _one_of(e, "kind", KINDS),
            "name": name,
            "route": _route(e.get("route")),
            "session": session,
            "device": device,
            "expiresAt": _ttl(when),
        }
        if sub:
            row["sub"] = sub
        if props := _props(e.get("props")):
            row["props"] = props
        rows.append(row)
    return rows


def allow(key: str, n: int) -> None:
    """429 once `key` has written PER_MINUTE events this minute."""
    minute = int(time.time() // 60)
    try:
        table("EVENTS_TABLE").update_item(
            Key={"pk": f"RATE#{key}", "sk": str(minute)},
            UpdateExpression="ADD n :n SET expiresAt = :exp",
            ConditionExpression="attribute_not_exists(n) OR n <= :room",
            ExpressionAttributeValues={":n": n, ":room": PER_MINUTE - n, ":exp": (minute + 5) * 60},
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        raise ApiError("Too many events; slow down", status=429)


def write(rows: list[dict]) -> None:
    with table("EVENTS_TABLE").batch_writer() as batch:
        for row in rows:
            batch.put_item(Item=row)


def day_rows(day: str) -> list[dict]:
    return query_all(table("EVENTS_TABLE"), f"DAY#{day}")


def rollup(day: str, rows: list[dict]) -> dict:
    """
    One day's counts. Sets hold ids, so a week's distinct users is the union of its
    days. An empty set is left out: DynamoDB can't store one.
    """
    apps: dict = defaultdict(
        lambda: {"events": 0, "views": 0, "sessions": set(), "devices": set(), "users": set()}
    )
    users: dict = defaultdict(
        lambda: {
            "events": 0,
            "sessions": set(),
            "last": "",
            "apps": defaultdict(int),
            "acts": defaultdict(int),
        }
    )
    for r in rows:
        a = apps[r["app"]]
        a["events"] += 1
        a["views"] += r["kind"] == "view"
        a["sessions"].add(r["session"])
        a["devices"].add(r["did"])
        if not r.get("sub"):
            continue
        a["users"].add(r["sub"])
        u = users[r["sub"]]
        u["events"] += 1
        u["sessions"].add(r["session"])
        u["last"] = max(u["last"], r["sk"].partition("#")[0])
        u["apps"][r["app"]] += 1
        if r["kind"] == "action":
            u["acts"][r["name"]] += 1

    def app_view(a: dict) -> dict:
        out = {"events": a["events"], "views": a["views"], "sessions": len(a["sessions"])}
        out.update({k: a[k] for k in ("devices", "users") if a[k]})
        return out

    return {
        "pk": "ROLLUP",
        "sk": f"DAY#{day}",
        "events": len(rows),
        "apps": {name: app_view(a) for name, a in apps.items()},
        "users": {
            sub: {
                "events": u["events"],
                "sessions": len(u["sessions"]),
                "last": u["last"],
                "apps": dict(u["apps"]),
                "acts": dict(u["acts"]),
            }
            for sub, u in users.items()
        },
    }


def save_rollup(day: str) -> dict:
    item = rollup(day, day_rows(day))
    table("EVENTS_TABLE").put_item(Item=item)
    return item


def rollups(start: date, end: date) -> list[dict]:
    """Stored rollups from start to end inclusive, oldest first, and today computed live."""
    today = _now().date()
    tbl = table("EVENTS_TABLE")
    kwargs = {
        "KeyConditionExpression": Key("pk").eq("ROLLUP")
        & Key("sk").between(
            f"DAY#{start.isoformat()}", f"DAY#{min(end, today - timedelta(days=1)).isoformat()}"
        )
    }
    items = []
    if start < today:
        while True:
            page = tbl.query(**kwargs)
            items += page["Items"]
            if "LastEvaluatedKey" not in page:
                break
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    if start <= today <= end:
        items.append(rollup(today.isoformat(), day_rows(today.isoformat())))
    return items


def active_users(app: str, days: int = 30, action: str | None = None) -> set[str]:
    """
    Subs signed in on `app` in the last `days` days, today included. With `action`
    (an endpoint name such as traitors_pick), only those who made that call, on any
    app. Activity before tracking started is not here; the scores table has that.
    """
    if app not in APPS:
        raise ValueError(f"app must be one of {APPS}")
    today = _now().date()
    subs: set[str] = set()
    for day in rollups(today - timedelta(days=days - 1), today):
        if action is None:
            subs |= set(day.get("apps", {}).get(app, {}).get("users", ()))
        else:
            subs |= {s for s, u in day.get("users", {}).items() if u.get("acts", {}).get(action)}
    return subs


def user_events(
    uid: str, limit: int = 100, before: str | None = None
) -> tuple[list[dict], str | None]:
    """One person's events newest first, and the sk to pass as `before` for the next page."""
    cond = Key("uid").eq(uid)
    if before:
        cond &= Key("sk").lt(before)
    page = table("EVENTS_TABLE").query(
        IndexName="byUid", KeyConditionExpression=cond, ScanIndexForward=False, Limit=limit
    )
    items = page["Items"]
    return items, (items[-1]["sk"] if "LastEvaluatedKey" in page and items else None)


def recent(limit: int = 50) -> list[dict]:
    """The newest events across every site: today's partition, then yesterday's."""
    tbl = table("EVENTS_TABLE")
    today = _now().date()
    out: list[dict] = []
    for day in (today, today - timedelta(days=1)):
        page = tbl.query(
            KeyConditionExpression=Key("pk").eq(f"DAY#{day.isoformat()}"),
            ScanIndexForward=False,
            Limit=limit - len(out),
        )
        out += page["Items"]
        if len(out) >= limit:
            break
    return out


def audit(admin: str, action: str, target: str, reason: str, before=None, after=None) -> dict:
    stamp = _now().isoformat(timespec="milliseconds").replace("+00:00", "Z")
    item = {
        "pk": "AUDIT",
        "sk": f"{stamp}#{secrets.token_hex(3)}",
        "admin": admin,
        "action": action,
        "target": target,
        "reason": reason,
        "before": before,
        "after": after,
    }
    table("EVENTS_TABLE").put_item(Item={k: v for k, v in item.items() if v is not None})
    return item


def audit_log(
    limit: int = 100, before: str | None = None, target: str | None = None
) -> tuple[list[dict], str | None]:
    cond = Key("pk").eq("AUDIT")
    if before:
        cond &= Key("sk").lt(before)
    kwargs = {"KeyConditionExpression": cond, "ScanIndexForward": False, "Limit": limit}
    if target:
        kwargs["FilterExpression"] = Attr("target").eq(target)
    page = table("EVENTS_TABLE").query(**kwargs)
    items = page["Items"]
    return items, (page["LastEvaluatedKey"]["sk"] if "LastEvaluatedKey" in page else None)


def forget(sub: str) -> None:
    """
    Takes a deleted account out of the activity data: its events, its entries in
    every rollup, and the before/after of audit entries about it. The entries stay,
    so the log still shows an admin acted.
    """
    tbl = table("EVENTS_TABLE")
    keys = []
    kwargs = {
        "IndexName": "byUid",
        "KeyConditionExpression": Key("uid").eq(sub),
        "ProjectionExpression": "pk, sk",
    }
    while True:
        page = tbl.query(**kwargs)
        keys += page["Items"]
        if "LastEvaluatedKey" not in page:
            break
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    with tbl.batch_writer() as batch:
        for key in keys:
            batch.delete_item(Key=key)

    for day in query_all(tbl, "ROLLUP"):
        if sub not in day.get("users", {}):
            continue
        apps = [a for a, v in day.get("apps", {}).items() if sub in v.get("users", ())]
        expression = "REMOVE #u.#s"
        names = {"#u": "users", "#s": sub}
        kwargs = {}
        if apps:
            expression += " DELETE " + ", ".join(f"apps.#a{i}.#u :s" for i in range(len(apps)))
            names.update({f"#a{i}": a for i, a in enumerate(apps)})
            kwargs["ExpressionAttributeValues"] = {":s": {sub}}
        tbl.update_item(
            Key={"pk": "ROLLUP", "sk": day["sk"]},
            UpdateExpression=expression,
            ExpressionAttributeNames=names,
            **kwargs,
        )

    for entry in query_all(tbl, "AUDIT"):
        if entry.get("target") == sub and ("before" in entry or "after" in entry):
            tbl.update_item(
                Key={"pk": "AUDIT", "sk": entry["sk"]},
                UpdateExpression="REMOVE #b, #a",
                ExpressionAttributeNames={"#b": "before", "#a": "after"},
            )
