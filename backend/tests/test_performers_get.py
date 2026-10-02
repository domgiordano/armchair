"""/performers/get against moto with the real S34 and S35 catalogs: per-couple
numbers only ever cover dances the caller paddled, for them and for anyone else."""

import json
from decimal import Decimal

import pytest

from lambdas.common.groups_dynamo import create as create_group
from lambdas.common.groups_dynamo import join as join_group
from lambdas.common.social_dynamo import accept, block, request
from lambdas.performers_get.handler import handler
from lambdas.scores_submit.handler import handler as submit_handler
from lambdas.users_me.handler import handler as me_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event
from tests.seasons import as_current, close

B = "3f1c2b9a-0000-4000-8000-000000000002"
C = "3f1c2b9a-0000-4000-8000-000000000003"
D = "3f1c2b9a-0000-4000-8000-000000000004"
S35 = json.loads((SEASONS / "dwts-35.json").read_text())
S34 = json.loads((SEASONS / "dwts-34.json").read_text())
# Panel means: X 8, Y 6, Z 9. Y's pro, Pasha Pashkov, also partnered W in S34.
X, Y, Z, W = "tyler-cameron", "amber-glenn", "jenna-dewan", "danielle-fishel"
VALUES = {X: (7, 8, 9), Y: (6, 6, 6), Z: (9, 9, 9), W: (5, 5, 5)}


def put_perf(aws, season: dict, ep: int, cid: str, state: str = "confirmed"):
    aws.Table(PERFORMANCES_TABLE).put_item(
        Item={
            "pk": f"EP#dwts#{season['season']}#{ep:02d}",
            "sk": f"PERF#{cid}#1",
            "contestants": [cid],
            "rateable": True,
            "style": "Tango" if ep % 2 else "Jive",
            "judges": {
                j: {"value": Decimal(v), "state": state}
                for j, v in zip(season["defaultPanel"], VALUES[cid])
            },
        }
    )


@pytest.fixture
def show(aws):
    # S34 as it was while current, so it takes answers; a test closes it after.
    for season in (as_current(S34), S35):
        write(aws.Table(CATALOG_TABLE), items(season))
    for ep in (4, 5):
        for cid in (X, Y, Z):
            put_perf(aws, S35, ep, cid)
    put_perf(aws, S34, 3, W)
    return aws


def answer(sub, cid, ep=5, season="dwts-35", **fields):
    event = authorized_event(
        path="/scores/submit",
        method="POST",
        sub=sub,
        body={"season": season, "ep": f"{ep:02d}", "contestant": cid, "n": 1, **fields},
    )
    res = submit_handler(event, None)
    assert res["statusCode"] == 200, res["body"]


def get(sub=A, **params) -> tuple[int, dict]:
    query = {"season": "dwts-35", **params}
    res = handler(authorized_event(path="/performers/get", sub=sub, query=query), None)
    return res["statusCode"], json.loads(res["body"])


def performers(sub=A, **params) -> dict:
    status, body = get(sub, **params)
    assert status == 200, body
    return body["data"]


def couple(data: dict, cid: str, season: str = "dwts-35") -> dict:
    return next(c for c in data["couples"] if c["ref"] == f"{season}/{cid}")


def test_no_answers_means_no_couples(show):
    answer(B, X, value=8)
    data = performers()
    assert data["couples"] == [] and data["pros"] == [] and data["favorites"] == []


def test_your_average_against_the_judges(show):
    answer(A, X, ep=4, value=10)
    answer(A, X, value=7)
    x = couple(performers(), X)
    tyler = x["members"][0]
    assert (tyler["name"], tyler["role"]) == ("Tyler Cameron", "celebrity")
    assert tyler["headshot"]["image"] == "supplied/tyler-cameron-44f6b7906a.webp"
    assert (x["dances"], x["you"], x["judges"], x["judged"]) == (2, 8.5, 8, 2)
    assert (x["gap"], x["absGap"]) == (0.5, 1.5)
    assert (x["best"]["ep"], x["best"]["paddle"]) == (4, 10)
    assert (x["worst"]["ep"], x["worst"]["paddle"]) == (5, 7)
    assert [(w["ep"], w["paddle"], w["judges"], w["style"]) for w in x["weeks"]] == [
        (4, 10, 8, "Jive"),
        (5, 7, 8, "Tango"),
    ]
    assert "others" not in json.dumps(x)


def test_unanswered_and_skipped_dances_never_count(show):
    answer(B, Y, value=1)
    answer(C, Y, value=2)
    answer(A, Z, forfeit=True)
    answer(A, X, value=8)
    data = performers()
    assert [c["id"] for c in data["couples"]] == [X]
    assert "1" not in json.dumps(couple(data, X)["everyone"])


def test_pending_judges_count_your_paddle_but_not_the_gap(show):
    put_perf(show, S35, 5, X, state="provisional")
    answer(A, X, value=8)
    x = couple(performers(), X)
    assert (x["dances"], x["you"], x["judges"], x["judged"], x["gap"]) == (1, 8, None, 0, None)


def test_others_need_two_raters_on_the_callers_dances(show):
    answer(A, X, value=8)
    answer(B, X, value=10)
    x = couple(performers(), X)
    assert x["everyone"] == {"mean": None, "raters": 1}
    answer(C, X, value=6)
    # B's dance on Y isn't one A paddled, so it stays out.
    answer(B, Y, value=1)
    assert couple(performers(), X)["everyone"] == {"mean": 8, "raters": 2}


def test_friends_are_accepted_friends_only(show):
    request(A, B)
    accept(B, A)
    request(A, C)
    request(A, D)
    accept(D, A)
    for sub, value in ((A, 8), (B, 10), (C, 2), (D, 6)):
        answer(sub, X, value=value)
    x = couple(performers(), X)
    assert x["friends"] == {"mean": 8, "raters": 2}
    assert x["everyone"] == {"mean": 6, "raters": 3}


def test_group_narrows_friends_and_everyone(show):
    family = create_group(A, "Family")
    join_group(B, family["inviteCode"])
    join_group(C, family["inviteCode"])
    request(A, D)
    accept(D, A)
    for sub, value in ((A, 8), (B, 10), (C, 6), (D, 1)):
        answer(sub, X, value=value)
    x = couple(performers(group=family["id"]), X)
    assert x["everyone"] == {"mean": 8, "raters": 2}
    assert x["friends"] == {"mean": None, "raters": 0}


def test_group_filter_is_403_for_a_non_member(show):
    gid = create_group(B, "Family")["id"]
    answer(A, X, value=8)
    status, body = get(group=gid)
    assert status == 403 and body["data"] is None


def test_highlights(show):
    answer(A, X, value=10)  # +2 over the judges
    answer(A, Y, value=6)  # level
    answer(A, Z, value=5)  # -4
    data = performers()
    assert data["favorites"] == [f"dwts-35/{c}" for c in (X, Y, Z)]
    assert data["leastFavorites"] == []
    assert data["softerOn"] == [f"dwts-35/{X}"]
    assert data["tougherOn"] == [f"dwts-35/{Z}"]


def test_pros_and_celebrities_across_seasons(show):
    answer(A, Y, value=8)
    answer(A, W, ep=3, season="dwts-34", value=7)
    answer(A, X, value=8)
    close(show, S34)
    this = performers()
    assert {p["name"] for p in this["pros"]} == {"Pasha Pashkov", "Sharna Burgess"}

    data = performers(season="all")
    assert data["season"] == "all"
    assert {c["ref"] for c in data["couples"]} == {
        f"dwts-35/{Y}",
        f"dwts-35/{X}",
        f"dwts-34/{W}",
    }
    pasha = next(p for p in data["pros"] if p["name"] == "Pasha Pashkov")
    assert pasha["seasons"] == ["dwts-34", "dwts-35"]
    assert (pasha["couples"], pasha["dances"], pasha["you"], pasha["judges"]) == (2, 2, 7.5, 5.5)
    assert {c["name"] for c in data["celebrities"]} == {
        "Amber Glenn",
        "Tyler Cameron",
        "Danielle Fishel",
    }


def test_all_seasons_with_nothing_scored(show):
    data = performers(season="all")
    assert data["couples"] == []


def test_unknown_season_is_404(show):
    assert get(season="dwts-99")[0] == 404


@pytest.mark.parametrize("season", [None, "35", "dwts"])
def test_bad_season_is_400(show, season):
    status, _ = get(season=season)
    assert status == 400


def test_no_subject_is_401(show):
    event = authorized_event(path="/performers/get", query={"season": "dwts-35"})
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    assert handler(event, None)["statusCode"] == 401


def of(target, viewer=A, **params) -> tuple[int, dict]:
    query = {"season": "dwts-35", "sub": target, **params}
    res = handler(authorized_event(path="/performers/get", sub=viewer, query=query), None)
    return res["statusCode"], json.loads(res["body"])


def signed_in(*subs):
    for sub in subs:
        assert me_handler(authorized_event(sub=sub, name="Someone"), None)["statusCode"] == 200


def test_styles_average_your_paddle_per_style(show):
    answer(A, X, ep=4, value=10)
    answer(A, Y, ep=4, value=6)
    answer(A, X, value=4)
    styles = performers()["styles"]
    assert [(s["style"], s["dances"], s["you"]) for s in styles] == [
        ("Jive", 2, 8.0),
        ("Tango", 1, 4.0),
    ]
    assert styles[0]["judges"] == 7.0


def test_someone_else_covers_only_dances_the_viewer_answered(show):
    signed_in(A, B)
    answer(B, X, ep=4, value=10)
    answer(B, Y, ep=4, value=2)
    answer(B, X, value=7)
    status, body = of(B)
    assert status == 200
    assert body["data"]["sub"] == B
    assert body["data"]["couples"] == [] and body["data"]["styles"] == []

    answer(A, X, value=8)
    data = of(B)[1]["data"]
    assert [(c["id"], c["dances"], c["you"]) for c in data["couples"]] == [(X, 1, 7.0)]
    assert [(s["style"], s["you"]) for s in data["styles"]] == [("Tango", 7.0)]
    assert data["favorites"] == [f"dwts-35/{X}"]
    # Means over the shared dances only, and never one dance's row.
    for key in ("best", "worst", "weeks"):
        assert key not in data["couples"][0]
    assert performers(B)["couples"][0]["weeks"]


def test_someone_else_on_a_past_season_covers_every_dance_they_scored(show):
    signed_in(A, B)
    answer(B, W, ep=3, season="dwts-34", value=5)
    assert of(B, season="all")[1]["data"]["couples"] == []

    close(show, S34)
    data = of(B, season="all")[1]["data"]
    assert [(c["ref"], c["you"]) for c in data["couples"]] == [(f"dwts-34/{W}", 5.0)]


def test_someone_else_unknown_or_blocked_is_404_and_group_is_400(show):
    signed_in(A, B)
    assert of("nobody")[0] == 404
    assert of(B, group="abcdefghijkl")[0] == 400
    block(B, A)
    assert of(B)[0] == 404
    assert of(A, viewer=B)[0] == 404
