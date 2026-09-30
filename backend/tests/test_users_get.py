"""/users/get against moto with the real S35 catalog: your own profile carries
your dances, anyone else's carries aggregates only, and only past the floor."""

import json
from decimal import Decimal

import pytest

from lambdas.common.groups_dynamo import create as create_group
from lambdas.common.social_dynamo import accept, block, request
from lambdas.scores_submit.handler import handler as submit_handler
from lambdas.users_get.handler import handler
from lambdas.users_me.handler import handler as me_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event

B = "3f1c2b9a-0000-4000-8000-000000000002"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
CARRIE, DEREK, BRUNO = SEASON["defaultPanel"]
# Five couples with confirmed panels (7, 8, 9) in episodes 4 and 5.
COUPLES = ["tyler-cameron", "amber-glenn", "jenna-dewan", "ezra-frech", "maura-higgins"]
STYLES = ["Tango", "Rumba", "Jive", "Foxtrot", "Salsa"]


@pytest.fixture
def show(aws):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    perfs = aws.Table(PERFORMANCES_TABLE)
    for ep in (4, 5):
        for cid, style in zip(COUPLES, STYLES):
            perfs.put_item(
                Item={
                    "pk": f"EP#dwts#35#{ep:02d}",
                    "sk": f"PERF#{cid}#1",
                    "contestants": [cid],
                    "rateable": True,
                    "style": style,
                    "judges": {
                        j: {"value": Decimal(v), "state": "confirmed"}
                        for j, v in zip(SEASON["defaultPanel"], (7, 8, 9))
                    },
                }
            )
    for sub in (A, B):
        assert (
            me_handler(authorized_event(sub=sub, name=f"User {sub[-1]}"), None)["statusCode"] == 200
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


def get(viewer=A, **params) -> tuple[int, dict]:
    event = authorized_event(path="/users/get", sub=viewer, query={"season": "dwts-35", **params})
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def profile(viewer=A, **params) -> dict:
    status, body = get(viewer, **params)
    assert status == 200, body
    return body["data"]


def test_own_profile_lists_dances_with_styles(show):
    answer(A, COUPLES[0], ep=4, value=6)
    answer(A, COUPLES[1], value=10)
    create_group(A, "Family")
    data = profile()
    assert data["name"] == "User 1"
    assert data["memberSince"]
    assert data["groupCount"] == 1
    assert data["season"]["season"] == "dwts-35"
    assert data["season"]["count"] == 2
    assert data["season"]["mae"] == 2.0
    assert data["season"]["judges"][BRUNO] == {"count": 2, "mae": 2.0}
    assert data["dances"] == [
        {
            "ep": 4,
            "key": f"{COUPLES[0]}#1",
            "style": "Tango",
            "paddle": 6,
            "panelMean": 8,
            "error": 2,
        },
        {
            "ep": 5,
            "key": f"{COUPLES[1]}#1",
            "style": "Rumba",
            "paddle": 10,
            "panelMean": 8,
            "error": 2,
        },
    ]


def test_passing_your_own_sub_is_the_own_view(show):
    assert "dances" in profile(sub=A)


def test_someone_else_below_the_floor_shows_a_count_and_no_error(show):
    for cid in COUPLES[:4]:
        answer(B, cid, value=10)
    data = profile(sub=B)
    assert data["name"] == "User 2"
    assert data["season"] == {"season": "dwts-35", "count": 4, "mae": None, "judges": {}}
    assert "dances" not in data and "groupCount" not in data


def test_someone_else_at_the_floor_shows_aggregates_only(show):
    for cid in COUPLES:
        answer(B, cid, value=10)
    data = profile(sub=B)
    assert data["season"]["count"] == 5
    assert data["season"]["mae"] == 2.0
    assert data["season"]["judges"][CARRIE] == {"count": 5, "mae": 3.0}
    assert "dances" not in data
    assert "email" not in data


def test_forfeits_and_unconfirmed_panels_do_not_count(show):
    answer(A, COUPLES[0], forfeit=True)
    show.Table(PERFORMANCES_TABLE).update_item(
        Key={"pk": "EP#dwts#35#05", "sk": f"PERF#{COUPLES[1]}#1"},
        UpdateExpression="SET judges.#d.#s = :p",
        ExpressionAttributeNames={"#d": DEREK, "#s": "state"},
        ExpressionAttributeValues={":p": "provisional"},
    )
    answer(A, COUPLES[1], value=8)
    data = profile()
    assert data["season"]["count"] == 0
    assert data["season"]["mae"] is None
    assert data["dances"] == []


def test_the_viewers_answers_do_not_change_what_they_see_of_others(show):
    for cid in COUPLES:
        answer(B, cid, value=10)
    before = profile(sub=B)["season"]
    answer(A, COUPLES[0], value=1)
    assert profile(sub=B)["season"] == before


def test_unknown_user_is_404(show):
    status, body = get(sub="nobody")
    assert status == 404
    assert body["data"] is None


def test_unknown_season_is_404(show):
    status, _ = get(season="dwts-99")
    assert status == 404


def test_missing_season_is_400(show):
    event = authorized_event(path="/users/get", query={"sub": B})
    assert handler(event, None)["statusCode"] == 400


def test_friend_count_counts_friends_only(show):
    C = "3f1c2b9a-0000-4000-8000-000000000003"
    D = "3f1c2b9a-0000-4000-8000-000000000004"
    request(B, A)
    accept(A, B)
    request(C, B)
    accept(B, C)
    request(D, B)
    assert profile(sub=B)["friendCount"] == 2
    assert profile()["friendCount"] == 1


def test_a_block_either_way_hides_the_profile(show):
    block(B, A)
    assert get(sub=B)[0] == 404
    assert get(B, sub=A)[0] == 404
    assert get(B)[0] == 200
