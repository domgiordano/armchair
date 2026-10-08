import pytest

from lambdas.common.traitors_board import reconcile, reconcile_winners
from lambdas.traitors_ranks.handler import handler as board_handler
from lambdas.traitors_stats.handler import handler as stats_handler
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE
from tests.events import authorized_event
from tests.social import A, B, C, accept, ask, call, sign_in

PK = "SEASON#tus#5"
EP = "EP#tus#5#02"


@pytest.fixture
def db(aws):
    for sub, name in ((A, "Ada"), (B, "Bea"), (C, "Cy")):
        sign_in(sub, name)
    t = aws.Table(CATALOG_TABLE)
    t.put_item(
        Item={
            "pk": PK,
            "sk": "META",
            "current": True,
            "openAt": "2026-01-01T00:00:00Z",
            "wikiTitle": "NB",
            "episodes": 2,
        }
    )
    for n in (1, 2):
        t.put_item(Item={"pk": PK, "sk": f"EP#{n:02d}", "releaseAt": "2026-09-01T00:00:00Z"})
    aws.Table(PERFORMANCES_TABLE).put_item(
        Item={
            "pk": EP,
            "sk": "EVT#RT",
            "state": "confirmed",
            "banished": "bob",
            "firstVote": {"bob": 3, "cat": 2, "dan": 1},
        }
    )
    aws.Table(PERFORMANCES_TABLE).put_item(
        Item={"pk": EP, "sk": "EVT#MURDER", "state": "confirmed", "victims": ["eve"]}
    )
    s = aws.Table(SCORES_TABLE)
    s.put_item(Item={"pk": EP, "sk": f"EVT#RT#USER#{A}", "picks": ["bob", "cat", "dan"]})
    s.put_item(Item={"pk": EP, "sk": f"EVT#MURDER#USER#{A}", "picks": ["dan"]})
    s.put_item(Item={"pk": EP, "sk": f"EVT#RT#USER#{B}", "picks": ["bob", "dan", "cat"]})
    s.put_item(Item={"pk": EP, "sk": f"EVT#RT#USER#{C}", "picks": ["cat", "bob", "dan"]})
    s.put_item(
        Item={
            "pk": "WIN#tus#5",
            "sk": f"USER#{A}",
            "picks": [{"player": "cat", "faction": "Traitor", "released": 0}],
            "released": 0,
        }
    )
    reconcile("tus", 5, 2)
    reconcile_winners("tus", 5, {"cat": "Traitor"}, 2)
    return aws


def get(handler, path, sub, **params):
    return call(handler, authorized_event(path=path, sub=sub, query=params))


def test_ranks_by_points_then_banishments(db):
    status, res = get(board_handler, "/traitors/ranks", B, season="tus-5")
    assert status == 200
    rows = [(r["name"], r["rank"], r["points"]) for r in res["data"]["ranked"]]
    # A: 10 + 0 + 30 winner. B: 5 + 1 + 1. C: 1 + 1 + 2.
    assert rows == [("Ada", 1, 40), ("Bea", 2, 7), ("Cy", 3, 4)]
    assert res["data"]["me"]["rank"] == 2


def test_all_time_and_friends(db):
    ask(A, B)
    accept(B, A)
    _, res = get(
        board_handler, "/traitors/ranks", A, season="all", show="tus", scope="friends"
    )
    assert [r["name"] for r in res["data"]["ranked"]] == ["Ada", "Bea"]
    assert get(board_handler, "/traitors/ranks", A, season="all")[0] == 400


def test_stats_are_the_callers_own(db):
    status, res = get(stats_handler, "/traitors/stats", A, season="tus-5")
    assert status == 200
    data = res["data"]
    assert (data["points"], data["events"], data["banishHits"], data["winnerPoints"]) == (
        40,
        2,
        1,
        30,
    )
    assert data["byEvent"]["RT"] == {"scored": 1, "hits": 1, "points": 10}
    assert data["byEvent"]["MURDER"] == {"scored": 1, "hits": 0, "points": 0}
    assert data["byEpisode"] == [{"ep": 1, "points": 0}, {"ep": 2, "points": 10}]
