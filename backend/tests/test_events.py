import json
import time
from datetime import UTC, datetime, timedelta

import pytest

from lambdas.common import events_dynamo as events
from lambdas.cron_rollup_events.handler import handler as rollup_handler
from lambdas.events_anon.handler import handler as anon_handler
from lambdas.events_track.handler import handler as track_handler
from tests.conftest import EVENTS_TABLE
from tests.events import SUB, authorized_event

B = "3f1c2b9a-0000-4000-8000-000000000002"
DID = "device-0001"


def batch(*evts, app="dwts", did=DID, session="session-01"):
    return {"app": app, "did": did, "session": session, "device": "phone", "events": list(evts)}


def view(route="/episode/?season=dwts-35&ep=02", at=None):
    e = {"kind": "view", "name": "page", "route": route}
    if at is not None:
        e["at"] = at
    return e


def act(name, route="/episode/"):
    return {"kind": "action", "name": name, "route": route}


def track(payload, sub=SUB):
    res = track_handler(
        authorized_event(path="/events/track", method="POST", body=payload, sub=sub), None
    )
    return res["statusCode"], json.loads(res["body"])


def anon(payload, headers=None):
    event = {
        "headers": {"origin": "https://dwts.armchairjudge.com", **(headers or {})},
        "body": json.dumps(payload),
        "requestContext": {"identity": {"sourceIp": "203.0.113.9"}},
    }
    res = anon_handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def stored(aws):
    return [i for i in aws.Table(EVENTS_TABLE).scan()["Items"] if i["pk"].startswith("DAY#")]


def test_signed_in_batch_is_stored_under_the_sub_with_a_ttl(aws):
    status, body = track(batch(view(), act("scores_submit")))
    assert (status, body["data"]) == (200, {"accepted": 2})
    rows = stored(aws)
    assert {r["uid"] for r in rows} == {SUB}
    assert {r["sub"] for r in rows} == {SUB}
    assert all(int(r["expiresAt"]) > time.time() + 399 * 86400 for r in rows)
    assert {r["name"] for r in rows} == {"page", "scores_submit"}


def test_route_keeps_only_allowed_params(aws):
    track(batch(view("/join/?code=SECRETCODE123&group=abc&season=dwts-35")))
    (row,) = stored(aws)
    assert row["route"] == "/join/?group=abc&season=dwts-35"


def test_client_clock_far_off_is_replaced_by_the_server_clock(aws):
    a_year_ago = int((datetime.now(UTC) - timedelta(days=365)).timestamp() * 1000)
    track(batch(view(at=a_year_ago)))
    (row,) = stored(aws)
    assert row["pk"] == f"DAY#{datetime.now(UTC).date().isoformat()}"


@pytest.mark.parametrize(
    "payload",
    [
        batch(view(), app="survivor"),
        batch(view(), did="x"),
        {**batch(view()), "device": "fridge"},
        {**batch(), "events": []},
        batch(*[view()] * 26),
        batch({"kind": "click", "name": "page", "route": "/"}),
        batch({"kind": "view", "name": "Has Spaces", "route": "/"}),
        batch({"kind": "view", "name": "page", "route": "no-slash"}),
        batch({**view(), "props": {"nested": {"a": 1}}}),
    ],
)
def test_bad_batches_are_400_and_write_nothing(aws, payload):
    status, _ = track(payload)
    assert status == 400
    assert stored(aws) == []


def test_track_without_a_sub_is_401(aws):
    event = authorized_event(path="/events/track", method="POST", body=batch(view()))
    event["requestContext"]["authorizer"]["claims"].pop("sub")
    assert track_handler(event, None)["statusCode"] == 401


def test_anonymous_batch_is_keyed_by_device_with_no_sub(aws):
    status, body = anon(batch(view("/")))
    assert (status, body["data"]) == (200, {"accepted": 1})
    (row,) = stored(aws)
    assert row["uid"] == f"anon#{DID}"
    assert "sub" not in row


@pytest.mark.parametrize("headers", [{"DNT": "1"}, {"Sec-GPC": "1"}])
def test_anonymous_do_not_track_writes_nothing(aws, headers):
    status, body = anon(batch(view("/")), headers)
    assert (status, body["data"]) == (200, {"accepted": 0})
    assert stored(aws) == []


def test_rate_limit_is_429_past_the_minute_budget(aws, monkeypatch):
    monkeypatch.setattr(events, "PER_MINUTE", 30)
    assert track(batch(*[view()] * 25))[0] == 200
    status, _ = track(batch(*[view()] * 10))
    assert status == 429
    assert len(stored(aws)) == 25
    # Another user has their own budget.
    assert track(batch(view()), sub=B)[0] == 200


def test_rollup_counts_apps_users_sessions_and_actions(aws):
    track(batch(view(), act("scores_submit"), act("scores_submit")))
    track(batch(view(), app="traitors", session="session-02"))
    track(
        batch(view(), act("traitors_pick"), app="traitors", did="device-0002", session="s-b-0001"),
        sub=B,
    )
    anon(batch(view("/"), app="hub", did="device-0003", session="s-anon-01"))

    today = datetime.now(UTC).date().isoformat()
    item = events.rollup(today, events.day_rows(today))
    assert item["events"] == 7
    assert item["apps"]["dwts"] == {
        "events": 3,
        "views": 1,
        "sessions": 1,
        "devices": {DID},
        "users": {SUB},
    }
    assert item["apps"]["traitors"]["users"] == {SUB, B}
    assert item["apps"]["traitors"]["sessions"] == 2
    assert "users" not in item["apps"]["hub"]
    assert item["apps"]["hub"]["devices"] == {"device-0003"}
    assert item["users"][SUB]["acts"] == {"scores_submit": 2}
    assert item["users"][SUB]["sessions"] == 2
    assert item["users"][SUB]["apps"] == {"dwts": 3, "traitors": 1}


def test_active_users_reads_stored_rollups_and_today(aws):
    track(batch(view(), act("traitors_pick"), app="traitors"))
    yesterday = (datetime.now(UTC).date() - timedelta(days=1)).isoformat()
    aws.Table(EVENTS_TABLE).put_item(
        Item={
            **events.rollup(
                yesterday,
                [
                    {
                        "app": "traitors",
                        "kind": "view",
                        "session": "s",
                        "did": "d",
                        "sub": B,
                        "sk": f"{yesterday}T10:00:00.000Z#aaaaaa",
                        "name": "page",
                    },
                ],
            ),
        }
    )
    assert events.active_users("traitors") == {SUB, B}
    assert events.active_users("traitors", days=1) == {SUB}
    assert events.active_users("dwts") == set()
    assert events.active_users("traitors", action="traitors_pick") == {SUB}
    with pytest.raises(ValueError):
        events.active_users("survivor")


def test_cron_rolls_up_yesterday_and_the_day_before(aws):
    tbl = aws.Table(EVENTS_TABLE)
    yesterday = (datetime.now(UTC).date() - timedelta(days=1)).isoformat()
    tbl.put_item(
        Item={
            "pk": f"DAY#{yesterday}",
            "sk": f"{yesterday}T12:00:00.000Z#abcdef",
            "uid": SUB,
            "sub": SUB,
            "did": DID,
            "app": "dwts",
            "kind": "view",
            "name": "page",
            "route": "/",
            "session": "s1",
            "device": "phone",
        }
    )
    out = rollup_handler({}, None)
    assert out[yesterday] == {"events": 1, "users": 1}
    assert len(out) == 2
    item = tbl.get_item(Key={"pk": "ROLLUP", "sk": f"DAY#{yesterday}"})["Item"]
    assert item["apps"]["dwts"]["users"] == {SUB}


def test_forget_removes_events_rollup_entries_and_audit_detail(aws):
    track(batch(view()))
    track(batch(view()), sub=B)
    today = datetime.now(UTC).date().isoformat()
    events.save_rollup(today)
    events.audit("boss@example.com", "profile", SUB, "rude name", {"name": "x"}, {"name": "y"})

    events.forget(SUB)

    assert {r["uid"] for r in stored(aws)} == {B}
    day = aws.Table(EVENTS_TABLE).get_item(Key={"pk": "ROLLUP", "sk": f"DAY#{today}"})["Item"]
    assert set(day["users"]) == {B}
    assert day["apps"]["dwts"]["users"] == {B}
    (entry,) = events.audit_log()[0]
    assert entry["target"] == SUB and "before" not in entry and "after" not in entry


def test_recent_is_newest_first_across_users(aws):
    track(batch(view("/a/")))
    track(batch(view("/b/")), sub=B)
    rows = events.recent(10)
    assert [r["route"] for r in rows] == ["/b/", "/a/"]
