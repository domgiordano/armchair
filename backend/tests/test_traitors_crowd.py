"""The crowd on /traitors/stats: only episodes the caller has seen whole, group members only."""

import pytest

from lambdas.traitors_stats.handler import handler as stats_handler
from tests.conftest import GROUPS_TABLE, SCORES_TABLE
from tests.sealing import seal
from tests.social import A, B, C
from tests.test_traitors_boards import EP, db, get  # noqa: F401


def crowd(sub=A, **params):
    status, res = get(stats_handler, "/traitors/stats", sub, season="tus-5", **params)
    assert status == 200, res
    return res["data"]


@pytest.fixture
def answered(db):  # noqa: F811
    # Ada forfeits the recruit, so she has answered all of episode 2.
    db.Table(SCORES_TABLE).put_item(Item={"pk": EP, "sk": f"EVT#RECRUIT#USER#{A}", "forfeit": True})
    return db


def test_an_episode_you_havent_answered_tells_nothing(db):  # noqa: F811
    data = crowd(scope="global")
    assert data["episodes"] == []
    assert data["byEvent"]["RT"] == {"scored": 0, "hits": 0}
    # Episode 2's points come off everyone: only Ada's winner bet is left.
    assert [(r["name"], r["points"]) for r in data["leaders"]] == [("Ada", 30)]
    assert data["me"] == {"rank": 1, "points": 30}


def test_everyone_once_answered(answered):
    data = crowd(scope="global")
    assert data["episodes"] == [
        {
            "ep": 2,
            "title": None,
            "calls": {
                # Ada and Bea had Bob first; Cy had Cat.
                "RT": {"voters": 3, "hits": 2, "banished": "bob", "top": "bob", "topVotes": 2},
                "MURDER": {"voters": 1, "hits": 0},
            },
        }
    ]
    assert data["byEvent"]["RT"] == {"scored": 3, "hits": 2}
    assert data["mine"]["RT"] == {"scored": 1, "hits": 1}
    assert data["mine"]["MURDER"] == {"scored": 1, "hits": 0}
    assert [(r["rank"], r["name"], r["points"]) for r in data["leaders"]] == [
        (1, "Ada", 40),
        (2, "Bea", 7),
        (3, "Cy", 4),
    ]
    assert (data["me"], data["ranked"]) == ({"rank": 1, "points": 40}, 3)


def test_a_group_counts_its_members_and_only_they_may_ask(answered):
    for sub in (A, C):
        answered.Table(GROUPS_TABLE).put_item(Item={"pk": "GROUP#g1", "sk": f"MEMBER#{sub}"})
    data = crowd(scope="group", group="g1")
    rt = data["episodes"][0]["calls"]["RT"]
    # One each for Bob and Cat: the tie goes to the first by id.
    assert rt == {"voters": 2, "hits": 1, "banished": "bob", "top": "bob", "topVotes": 1}
    assert [r["name"] for r in data["leaders"]] == ["Ada", "Cy"]
    assert (
        get(stats_handler, "/traitors/stats", B, season="tus-5", scope="group", group="g1")[0]
        == 403
    )


def test_a_sealed_call_hides_its_episode(answered):
    seal(A, "tus-5|2|RT")
    data = crowd(scope="global")
    assert data["episodes"] == []
    assert data["mine"]["RT"] == {"scored": 0, "hits": 0}
    assert [r["points"] for r in data["leaders"]] == [30]


def test_unknown_scope(db):  # noqa: F811
    assert get(stats_handler, "/traitors/stats", A, season="tus-5", scope="friends")[0] == 400
