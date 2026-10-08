"""
cron_favorites and /favorites/get against moto. The rule under test: a viewer who
hasn't revealed an episode sees the board from before it, byte for byte, with the
couple or player who went out in it still on it and no market price from after it.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from lambdas.common import polymarket
from lambdas.cron_favorites import handler as cron
from lambdas.favorites_get import handler as favorites
from lambdas.scores_reveal_all.handler import handler as reveal_all_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, FAVORITES_TABLE, PERFORMANCES_TABLE, SCORES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event
from tests.social import call, post

B = "3f1c2b9a-0000-4000-8000-000000000002"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
PANEL = SEASON["defaultPanel"]
# Out on episode 5 (Oct 6), after the fixture's last recorded elimination.
GONE = "ciara-miller"
BEFORE_EP5 = datetime(2026, 10, 5, 12, tzinfo=UTC)
AFTER_EP5 = datetime(2026, 10, 7, 12, tzinfo=UTC)


def at(monkeypatch, t):
    monkeypatch.setattr(cron, "now", lambda: t)
    monkeypatch.setattr(favorites, "now", lambda: t)


def market_at(monkeypatch, prices):
    def fake(show, season, names, t):
        stamp = t.strftime("%Y-%m-%dT%H:%M:%SZ")
        return {
            "source": "Polymarket",
            "url": "https://polymarket.com/event/x",
            "capturedAt": stamp,
            "prices": prices,
        }

    monkeypatch.setattr(polymarket, "market", fake)


def perfs(aws, ep, values):
    t = aws.Table(PERFORMANCES_TABLE)
    for cid, v in values.items():
        t.put_item(
            Item={
                "pk": f"EP#dwts#35#{ep:02d}",
                "sk": f"PERF#{cid}#1",
                "contestants": [cid],
                "rateable": True,
                "judges": {j: {"value": Decimal(v), "state": "confirmed"} for j in PANEL},
            }
        )


@pytest.fixture
def show(aws):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    perfs(aws, 3, {"ezra-frech": 8, GONE: 6, "maura-higgins": 7})
    perfs(aws, 4, {"ezra-frech": 9, GONE: 5, "maura-higgins": 8})
    return aws


def finish(sub, ep):
    body = {"season": "dwts-35", "ep": f"{ep:02d}"}
    assert post(reveal_all_handler, "/scores/reveal-all", sub, body)[0] == 200


def board(sub, **params):
    event = authorized_event(path="/favorites/get", sub=sub, query={"season": "dwts-35", **params})
    status, body = call(favorites.handler, event)
    assert status == 200, body
    return body["data"]


def week5_airs(aws):
    perfs(aws, 5, {"ezra-frech": 10, GONE: 4, "maura-higgins": 8})
    aws.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#dwts#35", "sk": f"CONTESTANT#{GONE}"},
        UpdateExpression="SET eliminatedEp = :e",
        ExpressionAttributeValues={":e": 5},
    )


def test_viewer_behind_sees_the_pre_elimination_board_unchanged(show, monkeypatch):
    market_at(monkeypatch, {"ezra-frech": 0.5, GONE: 0.1, "maura-higgins": 0.2})
    at(monkeypatch, BEFORE_EP5)
    for ep in range(1, 5):
        finish(A, ep)
        finish(B, ep)
    assert cron.handler({}, None)["written"]["dwts-35"] == [0, 1, 2, 3, 4]
    before = board(A)
    assert before["asOf"] == 4 and before["behind"] is False
    assert GONE in [e["id"] for e in before["entries"]]
    assert before["source"] == "market"

    at(monkeypatch, AFTER_EP5)
    week5_airs(show)
    # The market drops her at once, and episode 5's snapshot takes that price.
    market_at(monkeypatch, {"ezra-frech": 0.7, GONE: 0.001, "maura-higgins": 0.2})
    assert cron.handler({}, None)["written"]["dwts-35"] == [5]
    finish(B, 5)

    behind = board(A)
    assert behind["asOf"] == 4 and behind["latest"] == 5 and behind["behind"] is True
    assert behind["entries"] == before["entries"]
    assert behind["market"] == before["market"]
    assert behind["market"]["capturedAt"] < "2026-10-07"

    caught_up = board(B)
    assert caught_up["asOf"] == 5 and caught_up["behind"] is False
    ids = [e["id"] for e in caught_up["entries"]]
    assert GONE not in ids and ids[0] == "ezra-frech"
    assert caught_up["entries"][0]["move"]["rank"] == 0


def test_a_rerun_never_rewrites_an_older_episode(show, monkeypatch):
    at(monkeypatch, BEFORE_EP5)
    cron.handler({}, None)
    old = show.Table(FAVORITES_TABLE).get_item(Key={"pk": "FAV#dwts#35", "sk": "EP#04"})["Item"]
    at(monkeypatch, AFTER_EP5)
    week5_airs(show)
    cron.handler({}, None)
    again = show.Table(FAVORITES_TABLE).get_item(Key={"pk": "FAV#dwts#35", "sk": "EP#04"})["Item"]
    assert again == old


def test_through_holds_the_board_for_sealed_dances(show, monkeypatch):
    at(monkeypatch, BEFORE_EP5)
    for ep in range(1, 5):
        finish(A, ep)
    cron.handler({}, None)
    assert board(A, through="3")["asOf"] == 3
    assert board(A, through="9")["asOf"] == 4


def test_an_unfinished_earlier_episode_holds_the_board_there(show, monkeypatch):
    at(monkeypatch, BEFORE_EP5)
    for ep in (1, 2, 4):
        finish(A, ep)
    cron.handler({}, None)
    assert board(A)["asOf"] == 2


def test_market_fetch_failure_keeps_the_stored_price(show, monkeypatch):
    at(monkeypatch, BEFORE_EP5)
    market_at(monkeypatch, {"ezra-frech": 0.5})
    cron.handler({}, None)

    def down(*args):
        raise OSError("offline")

    monkeypatch.setattr(polymarket, "market", down)
    cron.handler({}, None)
    item = show.Table(FAVORITES_TABLE).get_item(Key={"pk": "FAV#dwts#35", "sk": "EP#04"})["Item"]
    assert item["market"]["prices"] == {"ezra-frech": Decimal("0.5")}


def test_polymarket_prices_match_names_and_skip_placeholders():
    event = {
        "markets": [
            {"groupItemTitle": "Harry Shum Jr.", "outcomePrices": '["0.1", "0.9"]'},
            {"groupItemTitle": "Contestant 15", "outcomePrices": None},
        ]
    }
    names = {polymarket.fold("Harry Shum Jr"): "harry-shum-jr"}
    assert polymarket.prices(event, names) == {"harry-shum-jr": 0.1}


TPK = "SEASON#tus#5"
T_SEASON = "tus-5"


@pytest.fixture
def traitors(aws):
    t = aws.Table(CATALOG_TABLE)
    t.put_item(
        Item={
            "pk": TPK,
            "sk": "META",
            "current": True,
            "openAt": "2026-09-01T00:00:00Z",
            "wikiTitle": "x",
        }
    )
    t.put_item(
        Item={"pk": "SEASONS#tus", "sk": "SEASON#005", "id": T_SEASON, "number": 5, "current": True}
    )
    for n, release in ((1, "2026-10-01T00:00:00Z"), (2, "2026-10-06T00:00:00Z")):
        t.put_item(
            Item={"pk": TPK, "sk": f"EP#{n:02d}", "releaseAt": release, "noRoundTable": n == 1}
        )
    for p in ("ann", "bob", "cat"):
        t.put_item(Item={"pk": TPK, "sk": f"PLAYER#{p}", "name": p.title()})
    s = aws.Table(SCORES_TABLE)
    s.put_item(
        Item={
            "pk": "WIN#tus#5",
            "sk": f"USER#{A}",
            "picks": [{"player": "bob", "faction": "Faithful"}],
            "submittedAt": "2026-09-30T00:00:00+00:00",
        }
    )
    for kind in ("MURDER", "RECRUIT"):
        s.put_item(Item={"pk": "EP#tus#5#01", "sk": f"EVT#{kind}#USER#{A}", "forfeit": True})
    return aws


def traitors_board(sub):
    event = authorized_event(path="/favorites/get", sub=sub, query={"season": T_SEASON})
    status, body = call(favorites.handler, event)
    assert status == 200, body
    return body["data"]


def test_traitors_banished_player_stays_on_for_a_viewer_who_hasnt_picked_it(traitors, monkeypatch):
    at(monkeypatch, datetime(2026, 10, 3, tzinfo=UTC))
    cron.handler({}, None)
    before = traitors_board(A)
    assert before["asOf"] == 1 and "bob" in [e["id"] for e in before["entries"]]
    assert before["entries"][0]["id"] == "bob" and before["source"] == "model"

    at(monkeypatch, datetime(2026, 10, 7, tzinfo=UTC))
    t = traitors.Table(CATALOG_TABLE)
    t.update_item(
        Key={"pk": TPK, "sk": "PLAYER#bob"},
        UpdateExpression="SET #e = :e, faction = :f",
        ExpressionAttributeNames={"#e": "exit"},
        ExpressionAttributeValues={":e": {"ep": 2, "how": "banished"}, ":f": "Traitor"},
    )
    traitors.Table(PERFORMANCES_TABLE).put_item(
        Item={
            "pk": "EP#tus#5#02",
            "sk": "EVT#RT",
            "state": "confirmed",
            "banished": "bob",
            "firstVote": {"bob": 4},
        }
    )
    cron.handler({}, None)
    behind = traitors_board(A)
    assert behind["asOf"] == 1 and behind["behind"] is True
    assert behind["entries"] == before["entries"]
    assert all(e.get("faction") is None for e in behind["entries"])
