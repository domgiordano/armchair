"""/leaderboard/get and the board sums behind it, against moto with the real S35
catalog: ranks come from per-user sums, and nothing per-dance ever leaves."""

import json
from decimal import Decimal

import pytest

from lambdas.common import board_dynamo
from lambdas.common.groups_dynamo import create as create_group
from lambdas.common.groups_dynamo import join as join_group
from lambdas.leaderboard_get.handler import handler
from lambdas.scores_submit.handler import handler as submit_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import BOARD_TABLE, CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event

B = "3f1c2b9a-0000-4000-8000-000000000002"
C = "3f1c2b9a-0000-4000-8000-000000000003"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
PANEL = SEASON["defaultPanel"]
CARRIE, DEREK, BRUNO = PANEL
X, Y = "tyler-cameron", "amber-glenn"
# Panel means: X 8, Y 6.
VALUES = {X: (7, 8, 9), Y: (6, 6, 6)}
DANCES = [(ep, cid) for ep in range(1, 6) for cid in (X, Y)]
ROW_FIELDS = {"rank", "sub", "name", "picture", "avatarKind", "count", "mae", "closestJudge"}


def perf(ep: int, cid: str, state: str = "confirmed", values=None) -> dict:
    return {
        "pk": f"EP#dwts#35#{ep:02d}",
        "sk": f"PERF#{cid}#1",
        "contestants": [cid],
        "rateable": True,
        "judges": {
            j: {"value": Decimal(v), "state": state} for j, v in zip(PANEL, values or VALUES[cid])
        },
    }


@pytest.fixture
def show(aws):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    for ep, cid in DANCES:
        aws.Table(PERFORMANCES_TABLE).put_item(Item=perf(ep, cid))
    aws.Table("t-armchair-users").put_item(Item={"sub": A, "name": "Viewer A", "email": "a@x"})
    aws.Table("t-armchair-users").put_item(Item={"sub": B, "name": "Viewer B", "email": "b@x"})
    return aws


def answer(sub, cid, ep, **fields):
    event = authorized_event(
        path="/scores/submit",
        method="POST",
        sub=sub,
        body={"season": "dwts-35", "ep": f"{ep:02d}", "contestant": cid, "n": 1, **fields},
    )
    res = submit_handler(event, None)
    assert res["statusCode"] == 200, res["body"]


def answer_many(sub, value_for, count=None):
    for ep, cid in DANCES[:count]:
        answer(sub, cid, ep, value=value_for(cid))


def get(sub=A, **params) -> tuple[int, dict]:
    query = {"season": "dwts-35", **params}
    res = handler(authorized_event(path="/leaderboard/get", sub=sub, query=query), None)
    return res["statusCode"], json.loads(res["body"])


def board(sub=A, **params) -> dict:
    status, body = get(sub, **params)
    assert status == 200, body
    return body["data"]


def board_row(db, sub, season="35") -> dict:
    key = {"pk": f"BOARD#dwts#{season}", "sk": f"USER#{sub}"}
    return db.Table(BOARD_TABLE).get_item(Key=key).get("Item", {})


def test_ranks_by_mae_with_per_judge_closest(show):
    answer_many(A, lambda cid: 8 if cid == X else 6)  # dead on
    answer_many(B, lambda cid: 9 if cid == X else 7)  # off by 1 every dance
    data = board()
    assert [(r["rank"], r["sub"], r["mae"], r["count"]) for r in data["ranked"]] == [
        (1, A, 0, 10),
        (2, B, 1, 10),
    ]
    # B: X dances off Carrie 2, Derek 1, Bruno 0; Y dances off each by 1.
    assert data["ranked"][1]["closestJudge"] == {"id": BRUNO, "mae": 0.5}
    assert data["ranked"][1]["name"] == "Viewer B"
    assert data["me"]["rank"] == 1 and data["me"]["sub"] == A
    assert data["unranked"] == []


def test_five_dances_to_rank_and_fewer_listed_unranked_with_a_count(show):
    answer_many(A, lambda cid: 8, count=5)
    answer_many(B, lambda cid: 8, count=4)
    data = board()
    assert [r["sub"] for r in data["ranked"]] == [A]
    assert data["unranked"] == [
        {"sub": B, "name": "Viewer B", "picture": None, "avatarKind": None, "count": 4}
    ]
    me_b = board(B)["me"]
    assert me_b["rank"] is None and me_b["count"] == 4


def test_ties_go_to_more_dances_then_share_a_rank(show):
    def exact(cid):
        return 8 if cid == X else 6

    answer_many(A, exact, count=6)
    answer_many(B, exact)
    answer_many(C, exact, count=6)
    ranks = [(r["sub"], r["rank"]) for r in board()["ranked"]]
    assert ranks[0] == (B, 1)
    assert sorted(ranks[1:]) == sorted([(A, 2), (C, 2)])


def test_caller_with_no_dances_is_still_in_me(show):
    answer_many(B, lambda cid: 8)
    me = board()["me"]
    assert me == {
        "rank": None,
        "sub": A,
        "name": "Viewer A",
        "picture": None,
        "avatarKind": None,
        "count": 0,
        "mae": None,
        "closestJudge": None,
    }


def test_no_per_dance_value_leaves(show):
    answer_many(A, lambda cid: 3)
    answer_many(B, lambda cid: 10)
    status, body = get()
    assert status == 200
    text = json.dumps(body)
    for leak in ("paddle", "panelMean", "value", "judges", "ep", X, Y, "email"):
        assert leak not in text
    for r in body["data"]["ranked"]:
        assert set(r) == ROW_FIELDS


def test_a_forfeit_or_a_retry_never_counts(show):
    answer(A, X, 1, value=8)
    answer(A, X, 1, value=8)
    answer(A, Y, 1, forfeit=True)
    assert board_row(show, A)["n"] == 1


def test_a_paddle_before_confirm_counts_when_the_poller_reconciles(show):
    show.Table(PERFORMANCES_TABLE).put_item(Item=perf(1, X, state="provisional"))
    answer(A, X, 1, value=10)
    assert board_row(show, A) == {}

    show.Table(PERFORMANCES_TABLE).put_item(Item=perf(1, X))
    assert board_dynamo.reconcile("dwts", 35, 1, PANEL) == 1
    assert board_dynamo.reconcile("dwts", 35, 1, PANEL) == 0
    row = board_row(show, A)
    assert (row["n"], row["err"]) == (1, 2)
    assert board_row(show, A, "all")["err"] == 2


def test_a_corrected_judge_value_is_swapped_exactly(show):
    answer(A, X, 1, value=10)
    show.Table(PERFORMANCES_TABLE).put_item(Item=perf(1, X, values=(7, 8, 8)))
    assert board_dynamo.reconcile("dwts", 35, 1, PANEL) == 1
    row = board_row(show, A)
    assert (row["n"], row["err"]) == (1, Decimal("2.3333"))
    assert (row[f"J#{BRUNO}#n"], row[f"J#{BRUNO}#err"]) == (1, 2)

    show.Table(PERFORMANCES_TABLE).put_item(Item=perf(1, X, state="provisional"))
    board_dynamo.reconcile("dwts", 35, 1, PANEL)
    row = board_row(show, A)
    assert (row["n"], row["err"], row[f"J#{BRUNO}#err"]) == (0, 0, 0)
    assert board()["me"]["count"] == 0


def test_all_time_sums_every_season(show):
    answer_many(A, lambda cid: 9 if cid == X else 6, count=4)  # err 1, 0, 1, 0
    change = ("someone#1", None, board_dynamo.contribution({CARRIE: 5.0}, 8))
    assert board_dynamo.transact(board_dynamo.ops(A, "dwts", 34, 2, [change]))
    me = board(season="all")["me"]
    assert (me["rank"], me["count"], me["mae"]) == (1, 5, 1)
    assert board()["me"]["count"] == 4


def test_group_scope_is_members_only(show):
    family = create_group(A, "Family")
    join_group(B, family["inviteCode"])
    for sub in (A, B, C):
        answer_many(sub, lambda cid: 8)
    data = board(scope="group", group=family["id"])
    assert {r["sub"] for r in data["ranked"]} == {A, B}
    assert data["group"] == family["id"]
    assert {r["sub"] for r in board()["ranked"]} == {A, B, C}


def test_group_scope_is_403_for_a_non_member(show):
    gid = create_group(B, "Family")["id"]
    answer_many(B, lambda cid: 8)
    status, body = get(scope="group", group=gid)
    assert status == 403
    assert body["data"] is None and B not in json.dumps(body)


def test_group_that_does_not_exist_is_403(show):
    assert get(scope="group", group="nope")[0] == 403


@pytest.mark.parametrize(
    "params", [{"scope": "friends"}, {"scope": "everyone"}, {"scope": "group"}, {"season": "x"}]
)
def test_bad_params_are_400(show, params):
    assert get(**params)[0] == 400


def test_unknown_season_is_404(show):
    assert get(season="dwts-99")[0] == 404


def test_missing_sub_is_401(show):
    event = authorized_event(path="/leaderboard/get", query={"season": "dwts-35"})
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    assert handler(event, None)["statusCode"] == 401
