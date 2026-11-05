import json
from datetime import UTC, datetime

import pytest

from lambdas.common import window
from lambdas.common.calls import outcome
from lambdas.overview_get import handler as overview
from lambdas.scores_call.handler import handler as call_handler
from scripts.seed_season import items, write
from tests.conftest import CATALOG_TABLE, SCORES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event
from tests.seasons import close
from tests.test_gate import EP5_KEYS, SEASON, B, score, state

X, Y, Z = "tyler-cameron", "amber-glenn", "jenna-dewan"
GONE = "conner-leavitt"
# Episode 5 airs 2026-10-06 at 8pm EDT.
SHOWTIME = datetime(2026, 10, 7, 0, tzinfo=UTC)
BEFORE = datetime(2026, 10, 6, 12, tzinfo=UTC)


def set_episode(db, ep="05", **values) -> None:
    db.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#dwts#35", "sk": f"EP#{ep}"},
        UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in values),
        ExpressionAttributeNames={f"#{k}": k for k in values},
        ExpressionAttributeValues={f":{k}": v for k, v in values.items()},
    )


@pytest.fixture
def show(aws, monkeypatch):
    """The morning before episode 5 airs, with episode 4's results in."""
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    set_episode(aws, ep="04", results={"eliminated": ["taylor-hanson"], "totals": {}, "bonus": {}})
    monkeypatch.setattr(window, "now", lambda: BEFORE)
    return aws


@pytest.fixture
def dance_off(show):
    set_episode(show, format="One unlearned dance & dance-off")
    return show


def call(picks, kind="dance-off", sub=A, ep="05") -> tuple[int, dict]:
    event = authorized_event(
        path="/scores/call",
        method="POST",
        sub=sub,
        body={"season": "dwts-35", "ep": ep, "kind": kind, "picks": picks},
    )
    res = call_handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def finish(sub=A):
    for key in EP5_KEYS:
        score(sub, key, forfeit=True)


def winners(*rows) -> dict:
    return {
        "eliminated": [],
        "totals": {},
        "bonus": {},
        "segments": [
            {"label": label, "contestants": [cid], "points": points, "text": text}
            for label, cid, points, text in rows
        ],
    }


def test_a_call_comes_back_to_its_caller_only(dance_off):
    assert call([Y, X])[0] == 200
    assert call([Z], sub=B)[0] == 200
    view = state()
    # Twelve couples dance, so at most six dance-offs are won.
    assert view["calls"] == [
        {
            "kind": "dance-off",
            "limit": 6,
            "picks": [Y, X],
            "locksAt": "2026-10-07T00:00Z",
            "open": True,
        }
    ]
    assert B not in json.dumps(view) and Z not in json.dumps(view["calls"])


def test_calls_are_final(dance_off):
    assert call([X, Y])[0] == 200
    assert call([Y, X])[0] == 200
    status, body = call([X, Z])
    assert status == 409, body
    assert state()["calls"][0]["picks"] == [Y, X]


@pytest.mark.parametrize(
    "picks",
    [[], [X, X], [GONE], ["nobody"], [X, Y, Z, "a", "b", "c", "d"], "tyler-cameron", [1]],
)
def test_bad_picks_are_400_and_write_nothing(dance_off, picks):
    assert call(picks)[0] == 400
    assert dance_off.Table(SCORES_TABLE).scan()["Items"] == []


def test_a_night_without_the_segment_takes_no_call(show):
    assert call([X])[0] == 400
    assert state()["calls"] == []
    set_episode(show, format="Dance & dance marathon")
    assert call([X])[0] == 400
    assert call([X, Y], kind="marathon")[0] == 400
    assert call([X], kind="marathon")[0] == 200


def test_a_call_counts_toward_nothing(dance_off, monkeypatch):
    call([X])
    view = state()
    assert (view["rateable"], view["answered"], view["complete"]) == (12, 0, False)
    assert "results" not in view
    monkeypatch.setattr(overview, "_now", lambda: datetime(2026, 10, 7, 12, tzinfo=UTC))
    event = authorized_event(path="/overview/get", query={"season": "dwts-35"})
    ep5 = json.loads(overview.handler(event, None)["body"])["data"]["episodes"][4]
    assert (ep5["answered"], ep5["done"]) == (0, False)


def test_the_outcome_waits_for_the_callers_results(dance_off):
    set_episode(
        dance_off,
        results=winners(
            ("Dance-off", X, 3, "Winner"),
            ("Dance-off", Y, None, "Loser"),
            ("Dance-off", Z, 3, "Winner"),
        ),
    )
    call([X, Y])
    assert "outcome" not in state()["calls"][0]
    finish()
    assert state()["calls"][0]["outcome"] == {"hits": 1, "winners": 2}


def test_a_past_season_takes_no_calls(dance_off):
    close(dance_off, SEASON)
    assert call([X])[0] == 403


@pytest.mark.parametrize("at", [SHOWTIME, datetime(2026, 10, 20, tzinfo=UTC)])
def test_calls_lock_at_showtime(dance_off, monkeypatch, at):
    monkeypatch.setattr(window, "now", lambda: at)
    status, body = call([X])
    assert status == 403 and body["error"]["detail"]["code"] == "calls_locked"
    assert dance_off.Table(SCORES_TABLE).scan()["Items"] == []
    assert state()["calls"][0]["open"] is False


def test_calls_wait_for_the_nights_couples(dance_off):
    set_episode(dance_off, ep="04", results=None)
    status, body = call([X])
    assert status == 409 and body["error"]["detail"]["code"] == "calls_not_open"
    assert state()["calls"][0]["open"] is False
    set_episode(dance_off, lineup={f"{X}#1": {"order": 1}})
    assert call([X])[0] == 200


def test_a_winner_without_stated_points_still_counts():
    rows = winners(("Dance-off", X, None, "Winner"), ("Dance-off", Y, None, "Loser"))
    assert outcome("dance-off", [X, Y], rows["segments"]) == {"hits": 1, "winners": 1}


def test_marathon_place_shares_ties_and_waits_for_points():
    label = "Hustle & Lindy Hop Marathon"
    rows = winners((label, X, 4, None), (label, Y, 2, None), (label, Z, 4, None))["segments"]
    assert outcome("marathon", [Y], rows) == {"place": 3, "of": 3}
    assert outcome("marathon", [Z], rows) == {"place": 1, "of": 3}
    assert outcome("marathon", [GONE], rows) == {"place": None, "of": 3}
    assert outcome("marathon", [X], [{**rows[0], "points": None, "text": "1st"}]) is None
