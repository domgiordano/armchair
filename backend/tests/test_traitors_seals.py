"""A Traitors call kept face down (common/seals.py): every read leaves its result,
everyone else's calls on it and the points it scored out, on every device."""

import pytest

from lambdas.traitors_ranks.handler import handler as ranks_handler
from lambdas.traitors_record.handler import handler as record_handler
from lambdas.traitors_stats.handler import handler as stats_handler
from tests.sealing import seal
from tests.social import A, B, accept, ask, sign_in
from tests.test_traitors_picks import bet, cards, db, get, pick  # noqa: F401

RT = "tus-5|2|RT"


@pytest.fixture
def played(db):  # noqa: F811
    for sub, name in ((A, "Ada"), (B, "Bea")):
        sign_in(sub, name)
        bet(sub)
    # Bob was banished: A's first vote is right, B's isn't.
    pick(A, "RT", ["bob", "cat", "dan"])
    pick(B, "RT", ["cat", "bob", "eve"])
    return db


def read(handler, path, sub=A, **params) -> dict:
    status, res = get(handler, path, sub, **params)
    assert status == 200, res
    return res["data"]


def test_a_sealed_call_stays_locked_with_your_picks(played):
    assert cards(A)["RT"]["locked"] is False
    seal(A, RT)
    rt = cards(A)["RT"]
    assert rt == {
        "type": "RT",
        "picks": 3,
        "mine": {"picks": ["bob", "cat", "dan"], "submittedAt": rt["mine"]["submittedAt"]},
        "locked": True,
        "sealed": True,
    }
    assert cards(B)["RT"]["locked"] is False


def test_the_record_keeps_your_call_and_drops_the_points(played):
    (me,) = read(record_handler, "/traitors/record")["people"]
    assert me["calls"][0]["points"] > 0
    seal(A, RT)
    (me,) = read(record_handler, "/traitors/record")["people"]
    assert me["calls"] == [
        {"ep": 2, "type": "RT", "picks": ["bob", "cat", "dan"], "forfeit": False, "sealed": True}
    ]


def test_the_record_drops_everyone_elses_call_on_a_sealed_event(played):
    ask(A, B)
    accept(B, A)
    calls = {
        p["sub"]: p["calls"]
        for p in read(record_handler, "/traitors/record", scope="friends")["people"]
    }
    assert len(calls[B]) == 1
    seal(A, RT)
    calls = {
        p["sub"]: p["calls"]
        for p in read(record_handler, "/traitors/record", scope="friends")["people"]
    }
    assert calls[B] == []
    assert read(record_handler, "/traitors/record", B, scope="friends")["people"][0]["calls"]


def test_stats_leave_a_sealed_episode_out(played):
    before = read(stats_handler, "/traitors/stats")
    assert before["points"] > 0 and before["banishHits"] == 1
    seal(A, RT)
    after = read(stats_handler, "/traitors/stats")
    assert (after["points"], after["events"], after["banishHits"]) == (0, 0, 0)
    assert all(e["points"] == 0 for e in after["byEpisode"])
    assert after["byEvent"]["RT"] == {"scored": 0, "hits": 0, "points": 0}


@pytest.mark.parametrize("season", ["tus-5", "all"])
def test_ranks_move_no_one_on_a_sealed_night(played, season):
    params = {"season": season, "show": "tus"}
    before = {
        r["sub"]: r["points"] for r in read(ranks_handler, "/traitors/ranks", **params)["ranked"]
    }
    assert before[A] > 0
    seal(A, RT)
    after = read(ranks_handler, "/traitors/ranks", **params)
    assert {r["sub"]: r["points"] for r in after["ranked"]} == {A: 0}
    assert after["me"]["points"] == 0
    # B holds nothing sealed: B's board is whole.
    theirs = read(ranks_handler, "/traitors/ranks", B, **params)["ranked"]
    assert {r["sub"]: r["points"] for r in theirs} == before
