"""
Scoring windows (common/window.py) against moto with the real S35 catalog: an
episode takes answers from its air time until the next one airs, and once
closed its unanswered dances are missed and its results open.
"""

import json
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from lambdas.common import window
from lambdas.leaderboard_get.handler import handler as leaderboard_handler
from lambdas.scores_reveal_all.handler import handler as reveal_all_handler
from lambdas.stats_get.handler import handler as stats_handler
from lambdas.week_board_get.handler import handler as week_board_handler
from scripts.seed_season import items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE
from tests.events import authorized_event
from tests.test_gate import SEASON, B, call, state, submit

pytestmark = pytest.mark.scoring_window

X, Y = "tyler-cameron", "amber-glenn"
PANEL = SEASON["defaultPanel"]
# Episode 5 aired 2026-10-06 at 8pm EDT and closes when episode 6 airs a week later.
EP5_OPENS = datetime(2026, 10, 7, 0, tzinfo=UTC)
EP5_CLOSES = datetime(2026, 10, 14, 0, tzinfo=UTC)
LIVE = datetime(2026, 10, 7, 12, tzinfo=UTC)


def utc(*args) -> datetime:
    return datetime(*args, tzinfo=UTC)


@pytest.fixture
def clock(monkeypatch):
    at = {"now": LIVE}
    monkeypatch.setattr(window, "now", lambda: at["now"])

    def set_to(t: datetime) -> None:
        at["now"] = t

    return set_to


@pytest.fixture
def show(aws, clock):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    for cid, values in ((X, (7, 8, 9)), (Y, (6, 6, 6))):
        aws.Table(PERFORMANCES_TABLE).put_item(
            Item={
                "pk": "EP#dwts#35#05",
                "sk": f"PERF#{cid}#1",
                "contestants": [cid],
                "rateable": True,
                "judges": {
                    j: {"value": Decimal(v), "state": "confirmed"} for j, v in zip(PANEL, values)
                },
            }
        )
    return aws


def spans() -> dict:
    meta = {"timezone": SEASON["timezone"], "current": True}
    eps = [{"sk": f"EP#{e['ep']:02d}", **e} for e in SEASON["episodes"]]
    return window.spans(meta, eps)


def test_the_two_night_premiere_closes_night_one_when_night_two_airs():
    assert spans()[1] == (utc(2026, 9, 16, 0), utc(2026, 9, 17, 0))
    assert spans()[2] == (utc(2026, 9, 17, 0), utc(2026, 9, 23, 0))


def test_each_window_is_8pm_eastern_across_the_dst_change():
    # Episode 8 airs in EDT (UTC-4), episode 9 the day after clocks fall back (UTC-5).
    assert spans()[8] == (utc(2026, 10, 28, 0), utc(2026, 11, 3, 1))


def test_the_finale_closes_a_week_after_it_airs():
    assert spans()[12] == (utc(2026, 11, 25, 1), utc(2026, 12, 2, 1))


def test_a_missing_start_is_8pm_and_a_next_night_with_no_date_closes_like_a_finale():
    meta = {"timezone": "America/New_York", "current": True}
    rows = [{"sk": "EP#01", "airDate": "2026-01-05"}, {"sk": "EP#02"}]
    assert window.spans(meta, rows) == {
        1: (utc(2026, 1, 6, 1), utc(2026, 1, 13, 1)),
        2: (None, None),
    }
    assert not window.is_live(meta, (None, None), LIVE)


def test_live_is_half_open_at_both_ends():
    meta = {"current": True}
    span = (EP5_OPENS, EP5_CLOSES)
    assert not window.is_live(meta, span, utc(2026, 10, 6, 23, 59))
    assert window.is_live(meta, span, EP5_OPENS)
    assert window.is_live(meta, span, utc(2026, 10, 13, 23, 59))
    assert not window.is_live(meta, span, EP5_CLOSES)
    assert window.closed(meta, span, EP5_CLOSES)


def test_a_past_season_is_never_live_and_always_closed():
    span = (EP5_OPENS, EP5_CLOSES)
    assert not window.is_live({}, span, LIVE)
    assert window.closed({}, span, utc(2000, 1, 1))


def test_premiere_night_one_takes_answers_until_night_two_airs(show, clock):
    key = SEASON["episodes"][0]["rateableKeys"][0].removesuffix("#1")
    clock(utc(2026, 9, 16, 23, 59))
    assert submit(ep="01", contestant=key, value=7)[0] == 200
    clock(utc(2026, 9, 17, 0))
    status, body = submit(sub=B, ep="01", contestant=key, value=7)
    assert status == 409
    assert body["error"]["detail"] == {
        "code": "episode_closed",
        "opensAt": "2026-09-16T00:00Z",
        "closesAt": "2026-09-17T00:00Z",
    }
    night_two = SEASON["episodes"][1]["rateableKeys"][0].removesuffix("#1")
    assert submit(sub=B, ep="02", contestant=night_two, value=7)[0] == 200


def test_submit_is_409_before_an_episode_airs(show):
    status, body = submit(ep="06", contestant=X, value=7)
    assert status == 409
    assert body["error"]["detail"]["code"] == "episode_not_open"
    assert body["error"]["detail"]["opensAt"] == "2026-10-14T00:00Z"


def test_reveal_all_is_409_on_a_closed_episode(show):
    event = authorized_event(
        path="/scores/reveal-all", method="POST", body={"season": "dwts-35", "ep": "04"}
    )
    status, body = call(reveal_all_handler, event)
    assert status == 409 and body["error"]["detail"]["code"] == "episode_closed"
    assert show.Table(SCORES_TABLE).scan()["Items"] == []


def test_state_carries_the_window_and_the_active_episode(show):
    assert submit(ep="05", contestant=X, value=9)[0] == 200
    view = state(ep="03")
    assert view["window"] == {
        "opensAt": "2026-09-23T00:00Z",
        "closesAt": "2026-09-30T00:00Z",
        "open": False,
    }
    assert view["activeEpisode"] == {
        "ep": 5,
        "pk": "EP#dwts#35#05",
        "opensAt": "2026-10-07T00:00Z",
        "closesAt": "2026-10-14T00:00Z",
        "answered": 1,
        "rateable": 12,
    }
    assert state(ep="05")["activeEpisode"] == view["activeEpisode"]


def test_no_active_episode_between_seasons(show, clock):
    clock(utc(2026, 12, 2, 1))
    assert state(ep="12")["activeEpisode"] is None


def test_a_closed_episode_opens_whole_and_leaves_missed_dances_missed(show, clock):
    assert submit(ep="05", contestant=X, value=9)[0] == 200
    assert submit(sub=B, ep="05", contestant=Y, value=4)[0] == 200
    live = state(ep="05")
    assert not live["complete"] and live["window"]["open"]
    assert next(c for c in live["performances"] if c["key"] == f"{Y}#1")["locked"]

    clock(EP5_CLOSES)
    assert submit(ep="05", contestant=Y, value=6)[0] == 409
    view = state(ep="05")
    assert view["complete"] and not view["window"]["open"]
    assert view["answered"] == 1 and view["rateable"] == 12
    assert "results" in view and "eliminated" in view
    assert all(not c["locked"] for c in view["performances"])
    missed = next(c for c in view["performances"] if c["key"] == f"{Y}#1")
    assert missed["mine"] is None
    assert [j["value"] for j in missed["judges"]] == [6, 6, 6]
    assert missed["others"] == [{"sub": B, "value": 4}]


def test_missed_dances_never_count_on_the_leaderboard_or_stats(show, clock):
    assert submit(ep="05", contestant=X, value=9)[0] == 200
    clock(EP5_CLOSES)
    assert submit(ep="05", contestant=Y, value=6)[0] == 409

    res = leaderboard_handler(
        authorized_event(path="/leaderboard/get", query={"season": "dwts-35"}), None
    )
    me = json.loads(res["body"])["data"]["me"]
    assert me["count"] == 1 and me["mae"] == 1.0

    res = stats_handler(authorized_event(path="/stats/get", query={"season": "dwts-35"}), None)
    mine = json.loads(res["body"])["data"]["mine"]
    assert mine["count"] == 1 and mine["mae"] == 1.0

    res = leaderboard_handler(
        authorized_event(path="/leaderboard/get", sub=B, query={"season": "dwts-35"}), None
    )
    assert json.loads(res["body"])["data"]["me"]["count"] == 0


def test_the_week_board_locks_nothing_once_closed(show, clock):
    query = {"season": "dwts-35", "ep": "05"}
    event = authorized_event(path="/week-board/get", sub=B, query=query)
    live = json.loads(week_board_handler(event, None)["body"])["data"]
    assert live["locked"] and live["window"]["open"]
    clock(EP5_CLOSES)
    board = json.loads(week_board_handler(event, None)["body"])["data"]
    assert board["locked"] == [] and not board["window"]["open"]
    assert next(r for r in board["couples"] if r["id"] == X)["judges"] == 8
