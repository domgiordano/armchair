"""/stats/crowd against moto with the real S35 catalog: leaders by week, couple
votes, divisive dances and head-to-heads, only ever over dances the caller may see."""

import json

import pytest

from lambdas.common.groups_dynamo import create as create_group
from lambdas.common.groups_dynamo import join as join_group
from lambdas.scores_reveal_all.handler import handler as reveal_all_handler
from lambdas.stats_crowd.handler import handler
from tests import test_stats_me
from tests.events import SUB as A
from tests.events import authorized_event
from tests.sealing import VIAS, sealing
from tests.social import B, C, sign_in
from tests.test_stats_me import X, Y, Z, answer

D = "3f1c2b9a-0000-4000-8000-000000000004"
show = test_stats_me.show


def get(caller=A, **params) -> tuple[int, dict]:
    event = authorized_event(path="/stats/crowd", sub=caller, query={"season": "dwts-35", **params})
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def crowd(caller=A, **params) -> dict:
    status, body = get(caller, **params)
    assert status == 200, body
    return body["data"]


@pytest.fixture
def family(show):
    sign_in(D, "Dee Dee")
    group = create_group(A, "Family")
    join_group(B, group["inviteCode"])
    join_group(C, group["inviteCode"])
    return group["id"]


def test_leaders_by_week_and_standings_after_each(show, family):
    # Week 3 (ep 4): A dead on, B a point off, C two off. Week 4 (ep 5): C best.
    for sub, x4, x5 in ((A, 8, 10), (B, 9, 9), (C, 10, 8)):
        answer(sub, X, ep=4, value=x4)
        answer(sub, X, value=x5)
    data = crowd(scope="group", group=family)
    w3, w4 = data["weeks"]
    assert [(r["sub"], r["rank"], r["mae"]) for r in w3["leaders"]] == [
        (A, 1, 0),
        (B, 2, 1),
        (C, 3, 2),
    ]
    assert [r["sub"] for r in w4["leaders"]] == [C, B, A]
    # Below five dances nobody has a place yet, but everyone shows.
    assert {r["sub"]: r["rank"] for r in w4["standings"]} == {A: None, B: None, C: None}
    assert {r["sub"]: r["mae"] for r in w4["standings"]} == {A: 1, B: 1, C: 1}
    assert (w4["participants"], w4["dances"]) == (3, 1)
    assert data["headToHead"][A][B] == [1, 1, 0]
    assert data["headToHead"][C][A] == [1, 1, 0]
    assert {m["sub"] for m in data["members"]} == {A, B, C}
    assert set(data["people"]) == {A, B, C}


def test_couple_votes_by_week_against_the_judges(show):
    for sub, v in ((A, 9), (B, 10), (C, 8)):
        answer(sub, X, ep=4, value=v)
        answer(sub, X, value=v - 2)
    data = crowd()
    (x,) = data["couples"]
    assert x["id"] == X and x["judges"] == 8 and x["raters"] == 3
    assert [(w["ep"], w["crowd"], w["judges"], w["delta"]) for w in x["weeks"]] == [
        (4, 9, 8, 1),
        (5, 7, 8, -1),
    ]
    assert x["weeks"][0]["spread"] == 0.82
    assert data["favorites"] == [] and data["leastFavorites"] == []


def test_crowd_means_need_two_people_besides_the_caller(show):
    answer(A, X, value=8)
    answer(B, X, value=10)
    data = crowd()
    assert data["couples"][0]["crowd"] is None
    assert data["dances"][0]["crowd"] is None and data["dances"][0]["raters"] == 2


def test_dances_the_caller_has_not_answered_never_count(show, family):
    answer(B, Y, value=1)
    answer(C, Y, value=2)
    answer(D, Y, value=3)
    answer(B, X, value=8)
    answer(A, X, value=8)
    data = crowd()
    assert {d["key"] for d in data["dances"]} == {f"{X}#1"}
    assert {c["id"] for c in data["couples"]} == {X}
    assert data["count"] == 2
    assert "amber" not in json.dumps(data)
    # B answered Y, so B's view has it.
    assert {d["key"] for d in crowd(B)["dances"]} == {f"{X}#1", f"{Y}#1"}


def test_most_divisive_dances_by_spread(show):
    for sub, x, y in ((A, 8, 6), (B, 8, 1), (C, 8, 10)):
        answer(sub, X, value=x)
        answer(sub, Y, value=y)
    assert crowd()["divisive"] == [{"ep": 5, "key": f"{Y}#1"}, {"ep": 5, "key": f"{X}#1"}]


@pytest.mark.parametrize("via", VIAS)
def test_sealed_dances_and_that_nights_result_stay_out(show, via):
    for sub in (A, B, C):
        answer(sub, X, value=8)
    event = authorized_event(
        path="/scores/reveal-all", method="POST", sub=A, body={"season": "dwts-35", "ep": "04"}
    )
    assert reveal_all_handler(event, None)["statusCode"] == 200
    assert crowd()["eliminated"] == {"taylor-hanson": {"ep": 4, "week": 3}}
    sealed = crowd(**sealing(via, A, "dwts-35", (5, f"{X}#1"), (4, f"{Z}#1")))
    assert sealed["dances"] == [] and sealed["count"] == 0
    assert sealed["eliminated"] == {}


def test_group_compares_with_everyone(show, family):
    answer(A, X, value=8)
    answer(B, X, value=9)
    answer(D, X, value=4)
    data = crowd(scope="group", group=family)
    assert (data["count"], data["mae"]) == (2, 0.5)
    assert (data["global"]["count"], data["global"]["mae"]) == (3, 1.67)
    assert data["global"]["weeks"] == [
        {"ep": 5, **{k: data["global"][k] for k in ("count", "mae", "bias", "exact", "close")}}
    ]
    assert D not in data["people"]


def test_global_standings_show_the_top_three_and_the_caller(show):
    sign_in(D, "Dee Dee")
    means = {X: 8, Y: 6, Z: 7}
    for ep in (4, 5):
        for cid, mean in means.items():
            for sub, off in ((B, 0), (C, 1), (D, 2), (A, 3)):
                answer(sub, cid, ep=ep, value=min(10, mean + off))
    week = crowd()["weeks"][-1]
    assert [(r["sub"], r["rank"]) for r in week["standings"]] == [(B, 1), (C, 2), (D, 3), (A, 4)]
    assert crowd(B)["weeks"][-1]["standings"][0]["sub"] == B
    assert len(crowd(B)["weeks"][-1]["standings"]) == 3


def test_group_is_403_for_a_non_member(show):
    gid = create_group(B, "Family")["id"]
    status, body = get(scope="group", group=gid)
    assert status == 403 and B not in json.dumps(body)


def test_bad_scope_is_400(show):
    assert get(scope="world")[0] == 400
