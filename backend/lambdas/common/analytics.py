"""
The admin console's numbers, from daily rollups (common/events_dynamo.py), the
users table and the scores table. Admin-only: callers gate with admins.require_admin.

Activity counts start when tracking did (`since`); signups and answers come from
the tables and go back to launch.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from lambdas.common.dynamo import query_many, table
from lambdas.common.episodes_dynamo import episode_pk, season_index, season_rows
from lambdas.common.events_dynamo import ANSWERS, APPS, rollups
from lambdas.common.traitors_catalog import EDITIONS

WEEKS = 12
COHORTS = 8


def _today() -> date:
    return datetime.now(UTC).date()


def week_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _scan(env_var: str, **kwargs) -> list[dict]:
    tbl = table(env_var)
    items = []
    while True:
        page = tbl.scan(**kwargs)
        items += page["Items"]
        if "LastEvaluatedKey" not in page:
            return items
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def everyone() -> list[dict]:
    """Every profile. A Scan: the console needs all of them, and the table is one row per person."""
    return _scan("USERS_TABLE")


def group_counts() -> dict[str, int]:
    """Groups each sub belongs to, from the USER# link rows."""
    counts: dict[str, int] = defaultdict(int)
    rows = _scan(
        "GROUPS_TABLE",
        FilterExpression="begins_with(pk, :u)",
        ExpressionAttributeValues={":u": "USER#"},
        ProjectionExpression="pk",
    )
    for row in rows:
        counts[row["pk"].removeprefix("USER#")] += 1
    return counts


def _created(profile: dict) -> date | None:
    at = profile.get("createdAt")
    return date.fromisoformat(at[:10]) if at else None


class Days:
    """Rollups by date, with unions over any span of them."""

    def __init__(self, items: list[dict]):
        self.by_date = {date.fromisoformat(i["sk"].removeprefix("DAY#")): i for i in items}
        self.since = min(self.by_date) if self.by_date else _today()

    def span(self, start: date, end: date) -> list[dict]:
        return [i for d, i in self.by_date.items() if start <= d <= end]

    def users(self, start: date, end: date, app: str | None = None) -> set[str]:
        out: set[str] = set()
        for day in self.span(start, end):
            if app is None:
                out |= set(day.get("users", {}))
            else:
                out |= set(day.get("apps", {}).get(app, {}).get("users", ()))
        return out

    def devices(self, start: date, end: date, app: str | None = None) -> set[str]:
        out: set[str] = set()
        for day in self.span(start, end):
            for name, a in day.get("apps", {}).items():
                if app in (None, name):
                    out |= set(a.get("devices", ()))
        return out

    def events(self, start: date, end: date, app: str) -> int:
        return sum(
            int(d.get("apps", {}).get(app, {}).get("events", 0)) for d in self.span(start, end)
        )

    def answered(self, start: date, end: date) -> set[str]:
        return {
            sub
            for day in self.span(start, end)
            for sub, u in day.get("users", {}).items()
            if any(u.get("acts", {}).get(a) for a in ANSWERS)
        }


def load_days(days: int) -> Days:
    today = _today()
    return Days(rollups(today - timedelta(days=days - 1), today))


def _counts(d: Days, today: date, app: str | None = None) -> dict:
    return {
        "dau": len(d.users(today, today, app)),
        "wau": len(d.users(today - timedelta(days=6), today, app)),
        "mau": len(d.users(today - timedelta(days=29), today, app)),
        "devices30": len(d.devices(today - timedelta(days=29), today, app)),
    }


def weeks(d: Days, profiles: list[dict], today: date) -> list[dict]:
    """Active users and signups per Monday-started week, oldest first."""
    signups: dict[date, int] = defaultdict(int)
    for p in profiles:
        if created := _created(p):
            signups[week_of(created)] += 1
    out = []
    for back in range(WEEKS - 1, -1, -1):
        start = week_of(today) - timedelta(weeks=back)
        end = start + timedelta(days=6)
        out.append(
            {
                "week": start.isoformat(),
                "active": len(d.users(start, end)),
                "byApp": {a: len(d.users(start, end, a)) for a in APPS},
                "signups": signups.get(start, 0),
                "tracked": end >= d.since,
            }
        )
    return out


def retention(d: Days, profiles: list[dict], today: date) -> list[dict]:
    """
    Per signup week, the share of that week's signups active in each week after.
    None for a week before tracking began, so a cohort from launch isn't read as
    having churned.
    """
    cohorts: dict[date, set[str]] = defaultdict(set)
    for p in profiles:
        if created := _created(p):
            cohorts[week_of(created)].add(p["sub"])
    this_week = week_of(today)
    out = []
    for back in range(COHORTS - 1, -1, -1):
        start = this_week - timedelta(weeks=back)
        members = cohorts.get(start, set())
        row = []
        for k in range(back + 1):
            w = start + timedelta(weeks=k)
            if w + timedelta(days=6) < d.since or not members:
                row.append(None)
                continue
            row.append(round(len(members & d.users(w, w + timedelta(days=6))) / len(members), 3))
        out.append({"cohort": start.isoformat(), "size": len(members), "weeks": row})
    return out


def funnel(d: Days, profiles: list[dict], today: date) -> dict:
    start = today - timedelta(days=29)
    return {
        "visitors": len(d.devices(start, today)),
        "signedIn": len(d.users(start, today)),
        "answered": len(d.answered(start, today)),
        "signups": sum(1 for p in profiles if (c := _created(p)) and c >= start),
    }


def _episode_counts(pks: list[str], prefix: str) -> list[dict]:
    out = []
    for rows in query_many([("SCORES_TABLE", pk) for pk in pks]):
        mine = [r for r in rows if r["sk"].startswith(prefix)]
        out.append(
            {
                "users": len({r["sk"].rpartition("#USER#")[2] for r in mine}),
                "answers": sum("value" in r or "picks" in r for r in mine),
                "forfeits": sum(bool(r.get("forfeit")) for r in mine),
            }
        )
    return out


def participation() -> list[dict]:
    """Per current season, each aired episode's users who answered, answers and forfeits."""
    now = datetime.now(UTC)
    out = []
    for show in ("dwts", *EDITIONS):
        for s in season_index(show):
            if not s.get("current"):
                continue
            number = int(s["number"])
            rows = season_rows(show, number)
            eps = sorted((r for r in rows if r["sk"].startswith("EP#")), key=lambda r: r["sk"])
            if show == "dwts":
                aired = [
                    e for e in eps if e.get("airDate") and e["airDate"] <= now.date().isoformat()
                ]
                prefix = "PERF#"
            else:
                aired = [
                    e
                    for e in eps
                    if e.get("releaseAt") and e["releaseAt"] <= now.strftime("%Y-%m-%dT%H:%M:%SZ")
                ]
                prefix = "EVT#"
            nums = [int(e["sk"].removeprefix("EP#")) for e in aired]
            counts = _episode_counts([episode_pk(show, number, n) for n in nums], prefix)
            out.append(
                {
                    "season": s["id"],
                    "app": "dwts" if show == "dwts" else "traitors",
                    "episodes": [
                        {"ep": n, "title": e.get("title"), **c}
                        for n, e, c in zip(nums, aired, counts)
                    ],
                }
            )
    return out


def overview() -> dict:
    today = _today()
    d = load_days(7 * (WEEKS + 1))
    profiles = everyone()
    return {
        "since": d.since.isoformat(),
        "totals": {"users": len(profiles), **_counts(d, today)},
        "apps": {
            a: {**_counts(d, today, a), "events30": d.events(today - timedelta(days=29), today, a)}
            for a in APPS
        },
        "weeks": weeks(d, profiles, today),
        "retention": retention(d, profiles, today),
        "funnel": funnel(d, profiles, today),
        "participation": participation(),
    }


def per_user(d: Days) -> dict[str, dict]:
    """Each sub's totals over the loaded days."""
    out: dict[str, dict] = {}
    for day in d.by_date.values():
        for sub, u in day.get("users", {}).items():
            t = out.setdefault(
                sub,
                {"events": 0, "sessions": 0, "answers": 0, "last": "", "apps": defaultdict(int)},
            )
            t["events"] += int(u.get("events", 0))
            t["sessions"] += int(u.get("sessions", 0))
            t["answers"] += sum(int(u.get("acts", {}).get(a, 0)) for a in ANSWERS)
            t["last"] = max(t["last"], u.get("last", ""))
            for app, n in u.get("apps", {}).items():
                t["apps"][app] += int(n)
    return out


def users_table(days: int) -> list[dict]:
    """Every user with their activity over `days`, most events first."""
    stats = per_user(load_days(days))
    groups = group_counts()
    empty = {"events": 0, "sessions": 0, "answers": 0, "last": None, "apps": {}}
    rows = []
    for p in everyone():
        s = stats.get(p["sub"], empty)
        rows.append(
            {
                "sub": p["sub"],
                "name": p.get("name"),
                "email": p.get("email"),
                "picture": p.get("picture"),
                "avatarKind": p.get("avatarKind"),
                "createdAt": p.get("createdAt"),
                "lastSeenAt": p.get("lastSeenAt"),
                "events": s["events"],
                "sessions": s["sessions"],
                "answers": s["answers"],
                "lastActive": s["last"] or None,
                "apps": dict(s["apps"]),
                "groups": groups.get(p["sub"], 0),
            }
        )
    return sorted(rows, key=lambda r: (-r["events"], r["name"] or ""))


def daily(d: Days, sub: str) -> list[dict]:
    """One user's events per day over the loaded days, oldest first."""
    return [
        {"day": day.isoformat(), "events": int(item.get("users", {}).get(sub, {}).get("events", 0))}
        for day, item in sorted(d.by_date.items())
    ]
