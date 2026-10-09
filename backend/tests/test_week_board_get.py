"""/week-board/get against moto with the real S35 catalog: one episode's couples
ranked four ways, over only the dances the caller paddled."""

import json
from decimal import Decimal

import pytest

from lambdas.common.groups_dynamo import create as create_group
from lambdas.common.groups_dynamo import join as join_group
from lambdas.common.social_dynamo import accept, request
from lambdas.scores_reveal_all.handler import handler as reveal_all_handler
from lambdas.scores_submit.handler import handler as submit_handler
from lambdas.week_board_get.handler import handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event
from tests.sealing import seal
from tests.seasons import close

B = "3f1c2b9a-0000-4000-8000-000000000002"
C = "3f1c2b9a-0000-4000-8000-000000000003"
D = "3f1c2b9a-0000-4000-8000-000000000004"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
X, Y, Z = "tyler-cameron", "amber-glenn", "jenna-dewan"
# Panel means: X 8, Y 6, Z 9.
VALUES = {X: (7, 8, 9), Y: (6, 6, 6), Z: (9, 9, 9)}


@pytest.fixture
def show(aws):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    for cid, values in VALUES.items():
        aws.Table(PERFORMANCES_TABLE).put_item(
            Item={
                "pk": "EP#dwts#35#05",
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


def answer(sub, cid, **fields):
    event = authorized_event(
        path="/scores/submit",
        method="POST",
        sub=sub,
        body={"season": "dwts-35", "ep": "05", "contestant": cid, "n": 1, **fields},
    )
    res = submit_handler(event, None)
    assert res["statusCode"] == 200, res["body"]


def get(sub=A, **params) -> tuple[int, dict]:
    query = {"season": "dwts-35", "ep": "05", **params}
    res = handler(authorized_event(path="/week-board/get", sub=sub, query=query), None)
    return res["statusCode"], json.loads(res["body"])


def board(sub=A, **params) -> dict:
    status, body = get(sub, **params)
    assert status == 200, body
    return body["data"]


def row(data: dict, cid: str) -> dict:
    return next(r for r in data["couples"] if r["id"] == cid)


def test_nothing_answered_locks_every_couple(show):
    answer(B, X, value=8)
    data = board()
    assert data["couples"] == [] and data["disagreements"] == []
    assert data["answered"] == 0 and data["rateable"] == len(data["locked"])
    names = [c["members"][0]["name"] for c in data["locked"]]
    assert names == sorted(names, key=str.casefold)
    # A locked couple shows who they are and nothing anyone scored.
    assert {k for c in data["locked"] for k in c} == {"id", "members"}
    assert {k for c in data["locked"] for m in c["members"] for k in m} == {
        "name",
        "role",
        "headshot",
    }


def test_a_past_season_ranks_every_couple_unanswered(show):
    answer(B, X, value=8)
    answer(C, X, value=6)
    assert board()["open"] is False
    close(show, SEASON)
    data = board()
    assert data["open"] is True and data["locked"] == []
    assert data["answered"] == 0
    assert {(r["id"], r["judges"], r["you"]) for r in data["couples"]} == {
        (X, 8, None),
        (Y, 6, None),
        (Z, 9, None),
    }
    assert row(data, X)["everyone"] == 7.0
    assert row(data, Z)["ranks"] == {"judges": 1, "you": None, "friends": None, "everyone": None}
    assert data["disagreements"] == []


def finish(sub, ep):
    event = authorized_event(
        path="/scores/reveal-all",
        method="POST",
        sub=sub,
        body={"season": "dwts-35", "ep": ep},
    )
    assert reveal_all_handler(event, None)["statusCode"] == 200


def test_eliminated_only_once_the_caller_finishes_the_episode(show):
    # Conner Leavitt went out in episode 1.
    finish(B, "01")
    assert board(ep="01")["eliminated"] == []
    finish(A, "01")
    assert board(ep="01")["eliminated"] == ["conner-leavitt"]
    # Only that night's: episode 5 sent nobody home before the caller finished it.
    assert board()["eliminated"] == []


def test_a_past_season_shows_eliminations_unanswered(show):
    close(show, SEASON)
    assert board(ep="01")["eliminated"] == ["conner-leavitt"]


def test_ranks_four_ways(show):
    for sub, values in ((A, (6, 9, 8)), (B, (9, 5, 7)), (C, (8, 6, 10))):
        for cid, v in zip((X, Y, Z), values):
            answer(sub, cid, value=v)
    request(A, B)
    accept(B, A)
    request(A, C)
    accept(C, A)
    data = board()
    assert data["answered"] == 3
    assert data["panel"] == SEASON["defaultPanel"]
    x, y, z = row(data, X), row(data, Y), row(data, Z)
    assert (x["you"], x["judges"], x["judgesTotal"], x["friends"], x["everyone"]) == (
        6,
        8,
        24,
        8.5,
        8.5,
    )
    assert x["ranks"] == {"judges": 2, "you": 3, "friends": 1, "everyone": 1}
    assert y["ranks"] == {"judges": 3, "you": 1, "friends": 3, "everyone": 3}
    assert z["ranks"] == {"judges": 1, "you": 2, "friends": 1, "everyone": 1}
    assert (x["rankDelta"], y["rankDelta"], z["rankDelta"]) == (-1, 2, -1)
    # Y by two places first, then X off by 2 points beats Z off by 1.
    assert data["disagreements"] == [Y, X, Z]


def test_only_answered_couples_are_ranked(show):
    answer(B, Y, value=1)
    answer(C, Y, value=2)
    answer(A, X, value=8)
    answer(A, Z, forfeit=True)
    data = board()
    assert [r["id"] for r in data["couples"]] == [X]
    assert {Y, Z} <= {c["id"] for c in data["locked"]}
    assert data["answered"] == 2
    blob = json.dumps(data)
    assert '"everyone": null' in blob and "1.5" not in blob


def test_one_other_rater_shows_no_average(show):
    answer(A, X, value=8)
    answer(B, X, value=10)
    x = row(board(), X)
    assert x["everyone"] is None and x["ranks"]["everyone"] is None


def test_friends_scope_narrows_everyone_to_friends(show):
    request(A, B)
    accept(B, A)
    request(A, C)
    accept(C, A)
    for sub, value in ((A, 8), (B, 10), (C, 6), (D, 1)):
        answer(sub, X, value=value)
    assert row(board(), X)["everyone"] == pytest.approx(17 / 3, abs=0.01)
    assert row(board(scope="friends"), X)["everyone"] == 8


def test_group_scope_narrows_to_members(show):
    family = create_group(A, "Family")
    join_group(B, family["inviteCode"])
    join_group(C, family["inviteCode"])
    for sub, value in ((A, 8), (B, 10), (C, 6), (D, 1)):
        answer(sub, X, value=value)
    data = board(scope="group", group=family["id"])
    assert data["group"] == family["id"]
    assert row(data, X)["everyone"] == 8


def test_group_scope_is_403_for_a_non_member(show):
    gid = create_group(B, "Family")["id"]
    answer(A, X, value=8)
    assert get(scope="group", group=gid)[0] == 403


def test_group_scope_needs_a_group(show):
    assert get(scope="group")[0] == 400


def test_bad_scope_is_400(show):
    assert get(scope="planet")[0] == 400


def test_unknown_episode_is_404(show):
    assert get(ep="30")[0] == 404


@pytest.mark.parametrize("params", [{"ep": "x"}, {"ep": None}, {"season": "35"}])
def test_bad_reference_is_400(show, params):
    assert get(**params)[0] == 400


def test_a_sealed_dance_keeps_the_paddle_and_drops_everything_else(show):
    for sub in (A, B, C):
        answer(sub, X, value=9)
        answer(sub, Y, value=5)
    seal(A, f"dwts-35|5|{X}#1")
    data = board()
    x = row(data, X)
    assert (x["you"], x["judges"], x["judgesTotal"]) == (9, None, None)
    assert (x["friends"], x["everyone"]) == (None, None)
    assert x["ranks"]["judges"] is None and x["rankDelta"] is None
    assert row(data, Y)["judges"] == 6
    assert data["sealed"] == [X]
    assert board(B)["sealed"] == [] and row(board(B), X)["judges"] == 8


def test_a_sealed_dance_holds_that_nights_eliminations(show):
    finish(A, "01")
    assert board(ep="01")["eliminated"] == ["conner-leavitt"]
    seal(A, "dwts-35|1|conner-leavitt#1")
    assert board(ep="01")["eliminated"] == []
