"""/stats/get against moto with the real S35 catalog: accuracy only ever covers
performances the caller has answered, for their own numbers and everyone else's."""

import json
from decimal import Decimal

import pytest

from lambdas.common.groups_dynamo import create as create_group
from lambdas.common.groups_dynamo import join as join_group
from lambdas.scores_submit.handler import handler as submit_handler
from lambdas.stats_get.handler import handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event

B = "3f1c2b9a-0000-4000-8000-000000000002"
C = "3f1c2b9a-0000-4000-8000-000000000003"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
X, Y = "tyler-cameron", "amber-glenn"
CARRIE, DEREK, BRUNO = SEASON["defaultPanel"]


@pytest.fixture
def show(aws):
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
                    "style": "Tango",
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


def get(sub=A, **params) -> tuple[int, dict]:
    event = authorized_event(path="/stats/get", sub=sub, query={"season": "dwts-35", **params})
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def stats(sub=A, **params) -> dict:
    status, body = get(sub, **params)
    assert status == 200, body
    return body["data"]


def test_no_answers_means_no_stats_for_anyone(show):
    answer(B, X, value=8)
    data = stats()
    assert data["mine"] == {"count": 0, "mae": None, "judges": {}}
    assert data["episodes"] == []
    assert data["dances"] == []
    assert data["others"] == []


def test_mean_and_per_judge_over_the_season(show):
    answer(A, X, ep=4, value=6)
    answer(A, X, value=8)
    data = stats()
    assert data["mine"]["count"] == 2
    assert data["mine"]["mae"] == 1
    assert data["mine"]["judges"] == {
        CARRIE: {"count": 2, "mae": 1},
        DEREK: {"count": 2, "mae": 1},
        BRUNO: {"count": 2, "mae": 2},
    }
    assert [(e["ep"], e["mae"]) for e in data["episodes"]] == [(4, 2), (5, 0)]
    judges = {CARRIE: 7, DEREK: 8, BRUNO: 9}
    assert data["dances"] == [
        {
            "ep": 4,
            "key": f"{X}#1",
            "paddle": 6,
            "panelMean": 8,
            "error": 2,
            "style": "Tango",
            "judges": judges,
        },
        {
            "ep": 5,
            "key": f"{X}#1",
            "paddle": 8,
            "panelMean": 8,
            "error": 0,
            "style": "Tango",
            "judges": judges,
        },
    ]


def test_others_count_only_performances_the_caller_answered(show):
    answer(B, X, value=10)
    answer(B, Y, value=1)
    answer(A, X, value=8)
    assert stats()["others"] == [{"sub": B, "count": 1, "mae": 2}]
    # B answered both, so B's own stats cover both and see A only on X.
    b = stats(B)
    assert b["mine"]["count"] == 2
    assert b["others"] == [{"sub": A, "count": 1, "mae": 0}]


def test_a_forfeit_opens_others_but_never_counts_for_the_caller(show):
    answer(B, Y, value=1)
    answer(A, Y, forfeit=True)
    data = stats()
    assert data["mine"]["count"] == 0
    assert data["others"] == [{"sub": B, "count": 1, "mae": 5}]


def test_provisional_judges_keep_a_performance_out(show):
    show.Table(PERFORMANCES_TABLE).update_item(
        Key={"pk": "EP#dwts#35#05", "sk": f"PERF#{X}#1"},
        UpdateExpression="SET judges.#d.#s = :p",
        ExpressionAttributeNames={"#d": DEREK, "#s": "state"},
        ExpressionAttributeValues={":p": "provisional"},
    )
    answer(A, X, value=8)
    assert stats()["mine"]["count"] == 0


def test_dance_details_cover_only_answered_dances(show):
    answer(B, Y, value=1)
    answer(A, X, value=8)
    assert [d["key"] for d in stats()["dances"]] == [f"{X}#1"]
    assert "6" not in json.dumps(stats()["dances"][0]["judges"])


def test_ep_narrows_to_one_episode(show):
    answer(A, X, ep=4, value=6)
    answer(A, X, value=8)
    data = stats(ep="05")
    assert data["ep"] == 5
    assert [d["ep"] for d in data["dances"]] == [5]
    assert data["mine"]["mae"] == 0


def test_group_narrows_others_to_members_on_answered_performances(show):
    family = create_group(A, "Family")
    join_group(B, family["inviteCode"])
    answer(B, X, value=10)
    answer(B, Y, value=1)
    answer(C, X, value=2)
    answer(A, X, value=8)

    data = stats(group=family["id"])
    assert data["others"] == [{"sub": B, "count": 1, "mae": 2}]
    assert data["mine"]["count"] == 1
    assert {o["sub"] for o in stats()["others"]} == {B, C}


def test_group_filter_is_403_for_a_non_member(show):
    gid = create_group(B, "Family")["id"]
    answer(B, X, value=10)
    answer(A, X, value=8)
    status, body = get(group=gid)
    assert status == 403
    assert body["data"] is None and B not in json.dumps(body)


def test_group_that_does_not_exist_is_403(show):
    assert get(group="no-such-group")[0] == 403


def test_unknown_season_is_404(show):
    event = authorized_event(path="/stats/get", query={"season": "dwts-99"})
    assert handler(event, None)["statusCode"] == 404


def test_unknown_episode_is_404(show):
    assert get(ep="30")[0] == 404


@pytest.mark.parametrize("params", [{"ep": "x"}, {"ep": "00"}])
def test_bad_episode_is_400(show, params):
    assert get(**params)[0] == 400


def test_missing_season_is_400(show):
    event = authorized_event(path="/stats/get", query=None)
    assert handler(event, None)["statusCode"] == 400


def test_missing_sub_is_401(show):
    event = authorized_event(path="/stats/get", query={"season": "dwts-35"})
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    assert handler(event, None)["statusCode"] == 401
