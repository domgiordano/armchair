"""/overview/get against moto with the real S35 catalog. Everything it shows of
scores comes through gate.episode_view, so these check the gate held: judge
values only where the caller answered, eliminations only from episodes they
finished, and nobody else's values at all."""

import json
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from lambdas.overview_get import handler as overview
from lambdas.scores_reveal_all.handler import handler as reveal_all_handler
from lambdas.scores_submit.handler import handler as submit_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event

B = "3f1c2b9a-0000-4000-8000-000000000002"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
X, Y = "tyler-cameron", "amber-glenn"
CARRIE = SEASON["defaultPanel"][0]
# The morning after episode 5 aired.
NOW = datetime(2026, 10, 7, 12, tzinfo=UTC)


@pytest.fixture
def show(aws, monkeypatch):
    monkeypatch.setattr(overview, "_now", lambda: NOW)
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    perfs = aws.Table(PERFORMANCES_TABLE)
    for ep in (4, 5):
        for cid, values in ((X, (7, 8, 9)), (Y, (6, 6, 6))):
            perfs.put_item(
                Item={
                    "pk": f"EP#dwts#35#{ep:02d}",
                    "sk": f"PERF#{cid}#1",
                    "contestants": [cid],
                    "rateable": True,
                    "judges": {
                        j: {"value": Decimal(v), "state": "confirmed"}
                        for j, v in zip(SEASON["defaultPanel"], values)
                    },
                }
            )
    return aws


def answer(sub, cid, ep=5, **fields):
    event = authorized_event(
        path="/scores/submit",
        method="POST",
        sub=sub,
        body={"season": "dwts-35", "ep": f"{ep:02d}", "contestant": cid, "n": 1, **fields},
    )
    assert submit_handler(event, None)["statusCode"] == 200


def finish(sub, ep):
    event = authorized_event(
        path="/scores/reveal-all",
        method="POST",
        sub=sub,
        body={"season": "dwts-35", "ep": f"{ep:02d}"},
    )
    assert reveal_all_handler(event, None)["statusCode"] == 200


def get(sub=A, season="dwts-35") -> tuple[int, dict]:
    event = authorized_event(path="/overview/get", sub=sub, query={"season": season})
    res = overview.handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def data(sub=A) -> dict:
    status, body = get(sub)
    assert status == 200, body
    return body["data"]


def couple(d: dict, cid: str) -> dict:
    return next(c for c in d["couples"] if c["id"] == cid)


def test_a_new_user_sees_the_schedule_and_nothing_scored(show):
    d = data()
    assert d["progress"] == {"aired": 5, "total": 12, "couples": 16, "couplesLeft": 16}
    assert [j["id"] for j in d["judges"]] == sorted(SEASON["defaultPanel"])
    assert d["judges"][0]["name"] == "Bruno Tonioli"
    assert d["me"] == {"scored": 0, "count": 0, "mae": None, "closestJudge": None, "streak": 0}
    assert d["next"] == {
        "ep": 6,
        "week": 5,
        "theme": "Super Bowl",
        "airDate": "2026-10-13",
        "startsAt": "2026-10-14T00:00Z",
    }
    assert d["reveals"] == []
    assert all(c["average"] is None and c["eliminated"] is None for c in d["couples"])
    ep5 = d["episodes"][4]
    assert ep5["aired"] and ep5["answered"] == 0 and not ep5["complete"]
    assert ep5["startsAt"] == "2026-10-07T00:00Z" and ep5["endsAt"] == "2026-10-07T02:00Z"
    assert d["episodes"][5] == {
        "ep": 6,
        "week": 5,
        "theme": "Super Bowl",
        "airDate": "2026-10-13",
        "startsAt": "2026-10-14T00:00Z",
        "endsAt": "2026-10-14T02:00Z",
        "aired": False,
    }


def test_judge_values_only_where_the_caller_answered_and_never_anyone_elses(show):
    answer(B, X, value=10)
    answer(B, Y, value=1)
    answer(A, X, value=7)
    d = data()
    text = json.dumps(d)
    assert B not in text
    assert couple(d, X) | {"members": None} == {
        "id": X,
        "members": None,
        "dances": 1,
        "average": 8,
        "eliminated": None,
    }
    # A hasn't answered Y, so the judges' 6s stay hidden.
    assert couple(d, Y)["average"] is None
    assert d["couples"][0]["id"] == X
    [reveal] = d["reveals"]
    assert reveal["key"] == f"{X}#1" and reveal["ep"] == 5
    assert reveal["mine"] == {"value": 7}
    assert [j["value"] for j in reveal["judges"]] == [7, 8, 9]
    assert reveal["panelMean"] == 8
    assert "others" not in reveal and "aggregate" not in reveal


def test_season_numbers_and_closest_judge(show):
    answer(A, X, value=7)
    answer(A, Y, value=8)
    answer(A, X, ep=4, forfeit=True)
    me = data()["me"]
    assert me["scored"] == 2 and me["count"] == 2
    # X: |7-8| = 1, Y: |8-6| = 2.
    assert me["mae"] == 1.5
    assert me["closestJudge"] == {"id": CARRIE, "name": "Carrie Ann Inaba", "mae": 1}


def test_accuracy_per_episode(show):
    answer(A, X, ep=4, value=6)
    answer(A, X, value=8)
    eps = data()["episodes"]
    assert [(e["ep"], e["mae"], e["scored"]) for e in eps[3:5]] == [(4, 2, 1), (5, 0, 1)]
    assert eps[2]["mae"] is None


def test_eliminations_only_from_episodes_the_caller_finished(show):
    # Conner Leavitt went out in episode 1.
    assert couple(data(), "conner-leavitt")["eliminated"] is None
    finish(A, 1)
    d = data()
    assert couple(d, "conner-leavitt")["eliminated"] == {"ep": 1, "week": 1}
    assert d["couples"][-1]["id"] == "conner-leavitt"
    assert d["progress"]["couplesLeft"] == 15
    # Someone else finishing learns nothing for A.
    finish(B, 2)
    assert data()["progress"]["couplesLeft"] == 15


def test_forfeits_open_nothing_to_compare(show):
    finish(A, 5)
    d = data()
    assert d["reveals"] == []
    assert couple(d, X)["average"] == 8 and couple(d, Y)["average"] == 6
    assert d["me"]["count"] == 0


def test_latest_three_reveals_newest_first(show):
    answer(A, X, ep=4, value=6)
    answer(A, Y, ep=4, value=6)
    answer(A, X, value=8)
    answer(A, Y, value=5)
    reveals = data()["reveals"]
    assert len(reveals) == 3
    assert [r["ep"] for r in reveals][:2] == [5, 5]


def test_the_current_season_is_not_open(show):
    d = data()
    assert d["open"] is False
    assert not any(e.get("complete") for e in d["episodes"])


def test_streak_counts_finished_episodes_back_from_the_latest(show):
    finish(A, 3)
    finish(A, 4)
    # Episode 5 aired last night and is still open: it doesn't break the streak.
    assert data()["me"]["streak"] == 2
    finish(A, 5)
    assert data()["me"]["streak"] == 3


def test_unknown_season_is_404(show):
    status, body = get(season="dwts-99")
    assert status == 404, body


def test_malformed_season_is_400(show):
    status, _ = get(season="season-thirty-five!")
    assert status == 400


def test_a_past_season_with_no_start_times_has_aired_whole(show):
    s20 = json.loads((SEASONS / "dwts-20.json").read_text(), parse_float=Decimal)
    write(show.Table(CATALOG_TABLE), items(s20))
    status, body = get(season="dwts-20")
    assert status == 200, body
    d = body["data"]
    assert d["next"] is None
    assert d["progress"]["aired"] == d["progress"]["total"] == len(s20["episodes"])
    first = d["episodes"][0]
    assert first["airDate"] is None and first["startsAt"] is None and first["endsAt"] is None
    assert first["aired"] and first["rateable"] == len(s20["episodes"][0]["rateableKeys"])
    # Open to everyone: every episode's results, nothing to catch up on, no streak unearned.
    assert d["open"] is True
    assert all(e["complete"] and e["answered"] == 0 for e in d["episodes"])
    assert d["me"]["streak"] == 0
    assert d["progress"]["couplesLeft"] < d["progress"]["couples"]
