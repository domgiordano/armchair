"""/users/get against moto with the real S35 catalog: your own profile carries
your dances, anyone else's carries aggregates only, and only past the floor."""

import json
from decimal import Decimal

import pytest

from lambdas.common import board_dynamo
from lambdas.common.groups_dynamo import create as create_group
from lambdas.common.social_dynamo import accept, block, request
from lambdas.scores_submit.handler import handler as submit_handler
from lambdas.users_get.handler import handler
from lambdas.users_me.handler import handler as me_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event
from tests.seasons import close

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
    assert data["season"] == {
        "season": "dwts-35",
        "count": 4,
        "mae": None,
        "judges": {},
        "rank": None,
        "ranked": 0,
    }
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


def test_all_time_comes_from_the_leaderboard_row_with_the_same_floor(show):
    for cid in COUPLES[:4]:
        answer(B, cid, value=10)
    assert profile(sub=B)["allTime"] == {
        "count": 4,
        "mae": None,
        "closestJudge": None,
        "rank": None,
        "ranked": 0,
    }
    answer(B, COUPLES[4], value=10)
    assert profile(sub=B)["allTime"] == {
        "count": 5,
        "mae": 2.0,
        "closestJudge": {"id": BRUNO, "mae": 1.0},
        "rank": 1,
        "ranked": 1,
    }
    # Your own shows below the floor.
    answer(A, COUPLES[0], value=6)
    assert profile()["allTime"]["mae"] == 2.0


def test_recent_activity_is_counts_per_episode_newest_first(show):
    answer(B, COUPLES[0], ep=4, value=9)
    answer(B, COUPLES[0], value=9)
    answer(B, COUPLES[1], forfeit=True)
    recent = profile(sub=B)["recent"]
    assert [(r["ep"], r["answered"], r["scored"]) for r in recent] == [(5, 2, 1), (4, 1, 1)]
    assert set(recent[0]) == {"season", "ep", "week", "theme", "airDate", "answered", "scored"}
    assert profile()["recent"] == []


def test_own_detail_breaks_down_every_scored_dance(show):
    answer(A, COUPLES[0], ep=4, value=6)
    answer(A, COUPLES[0], value=9)
    answer(A, COUPLES[1], value=8)
    detail = profile()["detail"]
    assert detail["count"] == 3
    assert detail["mae"] == 1.0
    assert detail["gap"] == -0.33
    assert detail["judges"][CARRIE] == {"count": 3, "mae": 1.33}
    assert detail["styles"] == [
        {"style": "Rumba", "count": 1, "mae": 0.0, "paddle": 8.0, "judges": 8.0},
        {"style": "Tango", "count": 2, "mae": 1.5, "paddle": 7.5, "judges": 8.0},
    ]
    assert [(w["ep"], w["count"], w["mae"]) for w in detail["weeks"]] == [(4, 1, 2.0), (5, 2, 0.5)]
    assert detail["weeks"][0]["season"] == "dwts-35"
    by_score = {d["score"]: d for d in detail["distribution"]}
    assert len(by_score) == 10
    assert (by_score[6]["you"], by_score[8]["you"], by_score[8]["judges"]) == (1, 1, 3)
    assert detail["best"]["key"] == f"{COUPLES[1]}#1"
    assert detail["best"]["error"] == 0
    assert detail["worst"] == {
        "season": "dwts-35",
        "ep": 4,
        "week": detail["worst"]["week"],
        "key": f"{COUPLES[0]}#1",
        "style": "Tango",
        "members": detail["worst"]["members"],
        "paddle": 6,
        "panelMean": 8,
        "error": 2,
    }
    celebrity = detail["worst"]["members"][0]
    assert (celebrity["name"], celebrity["role"]) == ("Tyler Cameron", "celebrity")


def test_someone_elses_detail_covers_only_dances_the_viewer_answered(show):
    for cid in COUPLES:
        answer(B, cid, value=10)
    answer(B, COUPLES[0], ep=4, value=1)
    # Nothing answered: B's detail is empty though B is past the floor.
    detail = profile(sub=B)["detail"]
    assert detail["count"] == 0
    assert detail["mae"] is None and detail["gap"] is None
    assert detail["styles"] == [] and detail["weeks"] == [] and detail["judges"] == {}
    assert detail["best"] is None and detail["worst"] is None
    assert all(d["you"] == 0 for d in detail["distribution"])

    # A forfeit is an answer too: it opens that dance's results to the viewer.
    answer(A, COUPLES[1], forfeit=True)
    answer(A, COUPLES[2], value=3)
    detail = profile(sub=B)["detail"]
    assert detail["count"] == 2
    assert {s["style"] for s in detail["styles"]} == {"Rumba", "Jive"}
    assert [(w["ep"], w["count"]) for w in detail["weeks"]] == [(5, 2)]
    assert detail["best"]["paddle"] == 10
    # Episode 4's paddle of 1, which the viewer never answered, leaves no trace.
    assert sum(d["you"] for d in detail["distribution"]) == 2
    assert {detail["best"]["ep"], detail["worst"]["ep"]} == {5}


def test_someone_elses_detail_on_a_past_season_covers_every_dance(show):
    for cid in COUPLES:
        answer(B, cid, value=10)
    answer(B, COUPLES[0], ep=4, value=1)
    close(show, SEASON)
    detail = profile(sub=B)["detail"]
    assert detail["count"] == len(COUPLES) + 1
    assert [(w["ep"], w["count"]) for w in detail["weeks"]] == [(4, 1), (5, len(COUPLES))]


def test_someone_elses_detail_needs_no_floor(show):
    answer(B, COUPLES[0], value=9)
    answer(A, COUPLES[0], value=5)
    data = profile(sub=B)
    assert data["season"]["mae"] is None
    assert data["detail"]["count"] == 1
    assert data["detail"]["mae"] == 1.0


def test_season_rank_and_history_place_against_everyone(show):
    for cid in COUPLES:
        answer(B, cid, value=8)
        answer(A, cid, value=10)
    data = profile()
    assert (data["season"]["rank"], data["season"]["ranked"]) == (2, 2)
    assert data["history"] == [
        {"season": "dwts-35", "count": 5, "mae": 2.0, "rank": 2, "ranked": 2},
    ]
    assert profile(sub=B)["history"][0]["rank"] == 1


def test_history_keeps_someone_elses_error_and_place_behind_the_floor(show):
    for cid in COUPLES[:3]:
        answer(B, cid, value=8)
    assert profile(sub=B)["history"] == [
        {"season": "dwts-35", "count": 3, "mae": None, "rank": None, "ranked": 0},
    ]
    assert profile(B)["history"][0]["mae"] == 0.0


def test_all_seasons_sums_every_scored_season(show):
    answer(A, COUPLES[0], ep=4, value=6)
    answer(A, COUPLES[1], value=10)
    data = profile(season="all")
    assert data["season"]["season"] == "all"
    assert data["season"]["count"] == 2
    assert data["detail"]["count"] == 2
    assert [r["ep"] for r in data["recent"]] == [5, 4]
    assert data["recent"][0]["season"] == "dwts-35"


def test_mutual_friends_and_groups_only_on_someone_else(show):
    C = "3f1c2b9a-0000-4000-8000-000000000003"
    D = "3f1c2b9a-0000-4000-8000-000000000004"
    assert me_handler(authorized_event(sub=C, name="Cara"), None)["statusCode"] == 200
    for x, y in ((A, C), (B, C), (A, D), (B, A)):
        request(x, y)
        accept(y, x)
    shared = create_group(A, "Family")
    create_group(A, "Work")
    show.Table("t-armchair-groups").put_item(
        Item={"pk": f"USER#{B}", "sk": f"GROUP#{shared['id']}", "joinedAt": "2026-10-01"}
    )
    data = profile(sub=B)
    assert [(f["sub"], f["name"]) for f in data["mutual"]["friends"]] == [(C, "Cara")]
    assert data["mutual"]["groups"] == [{"id": shared["id"], "name": "Family"}]
    assert "mutual" not in profile()


def test_all_seasons_reads_the_shows_boards(show):
    change = ("someone#1", None, board_dynamo.contribution({CARRIE: 5.0}, 8))
    assert board_dynamo.transact(board_dynamo.ops(A, "tus", 5, 2, [change]))
    answer(A, COUPLES[0], value=6)
    answer(A, COUPLES[1], value=6)
    assert profile(season="all", show="tus")["allTime"]["count"] == 1
    assert profile(season="all")["allTime"]["count"] == 2


def test_unknown_show_is_400(show):
    status, body = get(season="all", show="traitors")
    assert status == 400
    assert body["error"]["detail"] == {"field": "show"}
