import json

import pytest

from lambdas.admin_lineup.handler import handler as lineup_handler
from lambdas.admin_order.handler import handler as order_handler
from lambdas.cron_poll_wiki.handler import settle
from lambdas.episodes_state.handler import handler as state_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, EVENTS_TABLE, set_admins
from tests.events import authorized_event

ADMIN = "boss@example.com"
PK = "SEASON#dwts#35"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
# Ep 6: the five couples out in eps 1-5 are gone, eleven dance once each.
EP6_KEYS = sorted(
    f"{c['id']}#1" for c in SEASON["contestants"] if (c.get("eliminatedEp") or 99) > 5
)


@pytest.fixture
def catalog(aws, admins):
    tbl = aws.Table(CATALOG_TABLE)
    write(tbl, items(SEASON))
    set_admins(ADMIN)
    return tbl


def get(email=ADMIN) -> tuple[int, dict]:
    event = authorized_event(
        path="/admin/lineup", query={"season": "dwts-35", "ep": "06"}, email=email
    )
    res = lineup_handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def put(keys, email=ADMIN) -> tuple[int, dict]:
    body = {"season": "dwts-35", "ep": "06", "keys": keys}
    event = authorized_event(path="/admin/order", method="POST", body=body, email=email)
    res = order_handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def episode(catalog, ep="06") -> dict:
    return catalog.get_item(Key={"pk": PK, "sk": f"EP#{ep}"})["Item"]


def test_an_admin_sets_the_order_and_the_episode_page_follows(catalog, aws):
    status, body = get()
    assert status == 200
    keys = [d["key"] for d in body["data"]["dances"]]
    assert sorted(keys) == EP6_KEYS and body["data"]["runningOrder"] is False

    order = keys[::-1]
    status, body = put(order)
    assert status == 200
    stored = episode(catalog)
    assert stored["orderSource"] == "admin" and stored["runningOrder"] is True
    assert [k for k, _ in sorted(stored["lineup"].items(), key=lambda kv: kv[1]["order"])] == order
    audit = aws.Table(EVENTS_TABLE).scan()["Items"]
    assert [a["action"] for a in audit if a["pk"] == "AUDIT"] == ["running-order"]

    event = authorized_event(path="/episodes/state", query={"season": "dwts-35", "ep": "06"})
    view = json.loads(state_handler(event, None)["body"])["data"]
    assert [c["key"] for c in view["performances"]] == order
    assert view["orderSource"] == "admin" and view["orderAt"] == stored["orderAt"]


def test_an_order_must_name_every_dance_once(catalog):
    assert put(EP6_KEYS[:-1])[0] == 400
    assert put(EP6_KEYS + EP6_KEYS[:1])[0] == 400
    assert "lineup" not in episode(catalog)


def test_non_admins_get_403(catalog):
    assert get(email="fan@example.com")[0] == 403
    assert put(EP6_KEYS, email="fan@example.com")[0] == 403


def test_the_live_show_order_cannot_be_overridden(catalog):
    catalog.update_item(
        Key={"pk": PK, "sk": "EP#06"},
        UpdateExpression="SET orderSource = :s",
        ExpressionAttributeValues={":s": "live"},
    )
    assert put(EP6_KEYS)[0] == 409


def line(keys):
    return {k: {"order": i, "style": f"S{i}", "song": None} for i, k in enumerate(keys, 1)}


def test_settle_lets_the_page_order_stand_until_something_outranks_it():
    page = line(["a#1", "b#1", "c#1"])
    out = settle({}, page, True, False, 1_791_000_000)
    assert (out["orderSource"], out["runningOrder"]) == ("wikipedia", True)
    assert out["orderAt"].startswith("2026-")
    # The same order a tick later keeps its time.
    again = settle({**out}, page, True, False, 1_791_000_600)
    assert again["orderAt"] == out["orderAt"]
    # A placeholder page says nothing of where the order came from.
    assert settle({}, page, False, False, 1)["orderSource"] is None


def test_settle_keeps_an_admin_order_before_air_and_hands_over_to_the_show():
    admin = {"lineup": line(["c#1", "a#1", "b#1"]), "orderSource": "admin", "orderAt": "x"}
    page = line(["a#1", "b#1", "c#1", "d#1"])
    out = settle(admin, page, True, False, 1)
    assert sorted(out["lineup"], key=lambda k: out["lineup"][k]["order"]) == [
        "c#1",
        "a#1",
        "b#1",
        "d#1",
    ]
    assert out["lineup"]["c#1"]["style"] == "S3"
    assert (out["orderSource"], out["orderAt"]) == ("admin", "x")
    live = settle(admin, page, True, True, 1)
    assert live["orderSource"] == "live" and live["lineup"] == page
    # Once live, a page that loses its scores (a revert) can't move the order.
    reverted = settle({**live}, line(["d#1", "c#1", "b#1", "a#1"]), True, False, 2)
    assert reverted["orderSource"] == "live"
    assert sorted(reverted["lineup"], key=lambda k: reverted["lineup"][k]["order"]) == [
        "a#1",
        "b#1",
        "c#1",
        "d#1",
    ]
