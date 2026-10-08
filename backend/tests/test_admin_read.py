"""The admin console's read endpoints: gated on every one, and the numbers they compute."""

import json
import time
from datetime import UTC, datetime, timedelta

import pytest

from lambdas.admin_audit.handler import handler as audit_handler
from lambdas.admin_events.handler import handler as events_handler
from lambdas.admin_me.handler import handler as me_handler
from lambdas.admin_overview.handler import handler as overview_handler
from lambdas.admin_user.handler import handler as user_handler
from lambdas.admin_users.handler import handler as users_handler
from lambdas.common import analytics
from lambdas.common import events_dynamo as events
from lambdas.events_track.handler import handler as track_handler
from tests.conftest import EVENTS_TABLE, set_admins
from tests.events import authorized_event
from tests.social import A, B, C, accept, ask
from tests.test_groups import create

ADMIN = "boss@example.com"
HANDLERS = {
    "/admin/me": (me_handler, None),
    "/admin/overview": (overview_handler, None),
    "/admin/users": (users_handler, None),
    "/admin/user": (user_handler, {"sub": A}),
    "/admin/events": (events_handler, None),
    "/admin/audit": (audit_handler, None),
}


def get(path, query=None, email=ADMIN) -> tuple[int, dict]:
    handler, default = HANDLERS[path]
    res = handler(authorized_event(path=path, email=email, query=query or default), None)
    return res["statusCode"], json.loads(res["body"])


def track(sub, *evts, app="dwts", did="device-0001"):
    payload = {
        "app": app,
        "did": did,
        "session": f"session-{sub[-4:]}",
        "device": "phone",
        "events": list(evts),
    }
    res = track_handler(
        authorized_event(path="/events/track", method="POST", sub=sub, body=payload), None
    )
    assert res["statusCode"] == 200


def page(route="/"):
    return {"kind": "view", "name": "page", "route": route}


@pytest.fixture
def site(people, admins):
    set_admins(ADMIN)
    track(A, page("/episode/"), {"kind": "action", "name": "scores_submit", "route": "/episode/"})
    track(B, page(), app="traitors", did="device-0002")
    return people


@pytest.mark.parametrize("path", HANDLERS)
def test_every_admin_read_is_403_for_a_non_admin(site, path):
    status, body = get(path, email="viewer@example.com")
    assert status == 403
    assert body["data"] is None


@pytest.mark.parametrize("path", HANDLERS)
def test_every_admin_read_is_403_with_the_placeholder_list(people, admins, path):
    assert get(path)[0] == 403


def test_me_answers_the_admin_email(site):
    assert get("/admin/me") == (200, {"data": {"email": ADMIN}, "error": None, "meta": None})


def test_overview_counts_today_and_the_funnel(site):
    status, body = get("/admin/overview")
    assert status == 200
    data = body["data"]
    assert data["totals"]["users"] == 3
    assert data["totals"]["dau"] == 2
    assert data["apps"]["dwts"]["dau"] == 1
    assert data["apps"]["traitors"]["dau"] == 1
    assert data["funnel"] == {"visitors": 2, "signedIn": 2, "answered": 1, "signups": 3}
    assert len(data["weeks"]) == analytics.WEEKS
    assert data["weeks"][-1]["active"] == 2
    assert data["weeks"][-1]["signups"] == 3
    this_cohort = data["retention"][-1]
    assert this_cohort["size"] == 3 and this_cohort["weeks"] == [pytest.approx(0.667)]


def test_retention_is_none_before_tracking_began(aws):
    today = datetime.now(UTC).date()
    old = (today - timedelta(weeks=3)).isoformat()
    profiles = [{"sub": A, "createdAt": f"{old}T10:00:00+00:00"}]
    d = analytics.Days([])
    rows = analytics.retention(d, profiles, today)
    cohort = next(r for r in rows if r["size"])
    assert cohort["weeks"][0] is None


def test_participation_counts_answers_per_aired_episode(site, aws):
    from scripts.seed_season import SEASONS, items, write
    from tests.conftest import CATALOG_TABLE, SCORES_TABLE

    write(aws.Table(CATALOG_TABLE), items(json.loads((SEASONS / "dwts-35.json").read_text())))
    scores = aws.Table(SCORES_TABLE)
    scores.put_item(Item={"pk": "EP#dwts#35#01", "sk": f"PERF#a#1#USER#{A}", "value": 7})
    scores.put_item(Item={"pk": "EP#dwts#35#01", "sk": f"PERF#b#1#USER#{A}", "forfeit": True})
    scores.put_item(Item={"pk": "EP#dwts#35#01", "sk": f"PERF#a#1#USER#{B}", "value": 5})
    (season,) = [s for s in analytics.participation() if s["season"] == "dwts-35"]
    first = season["episodes"][0]
    assert (first["ep"], first["users"], first["answers"], first["forfeits"]) == (1, 2, 2, 1)


def test_users_table_has_activity_and_groups(site):
    create("Watch party", A)
    status, body = get("/admin/users")
    assert status == 200
    rows = {r["sub"]: r for r in body["data"]}
    assert body["meta"]["count"] == 3
    assert rows[A]["events"] == 2 and rows[A]["answers"] == 1 and rows[A]["groups"] == 1
    assert rows[A]["email"] == "1@example.com"
    assert rows[C]["events"] == 0 and rows[C]["lastActive"] is None
    assert body["data"][0]["sub"] == A


@pytest.mark.parametrize("days", ["0", "91", "x"])
def test_users_rejects_bad_days(site, days):
    assert get("/admin/users", {"days": days})[0] == 400


def test_user_has_profile_groups_friends_devices_and_log(site, aws):
    create("Watch party", A)
    ask(A, B)
    accept(B, A)
    events.audit(ADMIN, "profile", A, "typo in name")
    status, body = get("/admin/user", {"sub": A})
    assert status == 200
    data = body["data"]
    assert data["profile"]["email"] == "1@example.com"
    assert [(g["name"], g["owner"], g["member"]) for g in data["groups"]] == [
        ("Watch party", True, True)
    ]
    assert [(f["sub"], f["status"]) for f in data["friends"]] == [(B, "friend")]
    assert data["devices"] == [
        {"did": "device-0001", "device": "phone", "last": data["events"][0]["at"], "events": 2}
    ]
    assert sorted(e["name"] for e in data["events"]) == ["page", "scores_submit"]
    assert data["daily"][-1]["events"] == 2
    assert [a["reason"] for a in data["audit"]] == ["typo in name"]


def test_user_flags_a_link_without_a_member_row(site, aws):
    from tests.conftest import GROUPS_TABLE

    gid = create("Watch party", A)[1]["data"]["id"]
    aws.Table(GROUPS_TABLE).delete_item(Key={"pk": f"GROUP#{gid}", "sk": f"MEMBER#{A}"})
    (group,) = get("/admin/user", {"sub": A})[1]["data"]["groups"]
    assert group["member"] is False


def test_user_unknown_is_404_and_bad_sub_400(site):
    assert get("/admin/user", {"sub": "3f1c2b9a-0000-4000-8000-000000000999"})[0] == 404
    assert get("/admin/user", {"sub": "nope"})[0] == 400


def test_events_are_newest_first_with_cards(site):
    status, body = get("/admin/events")
    assert status == 200
    rows = body["data"]["events"]
    assert rows[0]["sub"] == B and rows[0]["app"] == "traitors"
    assert body["data"]["people"][A]["name"] == "Ada Lovelace"
    assert "expiresAt" not in rows[0]


def test_audit_pages_newest_first_and_filters_by_target(site):
    for i in range(3):
        events.audit(ADMIN, "profile", A if i < 2 else B, f"r{i}")
        time.sleep(0.002)
    status, body = get("/admin/audit")
    assert status == 200
    assert [e["reason"] for e in body["data"]] == ["r2", "r1", "r0"]
    _, body = get("/admin/audit", {"sub": B})
    assert [e["reason"] for e in body["data"]] == ["r2"]


def test_rollup_before_today_feeds_the_week(site, aws):
    yesterday = datetime.now(UTC).date() - timedelta(days=1)
    if yesterday.weekday() == 6:
        pytest.skip("yesterday was last week")
    row = {
        "app": "dwts",
        "kind": "view",
        "session": "s",
        "did": "d9",
        "sub": C,
        "sk": f"{yesterday.isoformat()}T10:00:00.000Z#aaaaaa",
        "name": "page",
    }
    aws.Table(EVENTS_TABLE).put_item(Item=events.rollup(yesterday.isoformat(), [row]))
    data = get("/admin/overview")[1]["data"]
    assert data["weeks"][-1]["active"] == 3
    assert data["totals"]["wau"] == 3 and data["totals"]["dau"] == 2
