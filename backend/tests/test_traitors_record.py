"""Friends' and groups' picks, with points, through the gate: no peeking before your own call."""

import pytest

from lambdas.traitors_episode.handler import handler as episode_handler
from lambdas.traitors_record.handler import handler as record_handler
from tests.conftest import GROUPS_TABLE, PERFORMANCES_TABLE
from tests.social import A, B, C, accept, ask, sign_in
from tests.test_traitors_picks import bet, cards, db, get, pick  # noqa: F401

FULL = [
    {"player": "cat", "faction": "Traitor"},
    {"player": "dan", "faction": "Faithful"},
    {"player": "eve", "faction": "Faithful"},
]


@pytest.fixture
def friends(db):  # noqa: F811
    for sub, name in ((A, "Ada"), (B, "Bea"), (C, "Cy")):
        sign_in(sub, name)
        bet(sub, FULL if sub == B else FULL[:1])
    ask(A, B)
    accept(B, A)
    # Episode 2's murder confirmed too, so both of its picked events have results.
    db.Table(PERFORMANCES_TABLE).put_item(
        Item={"pk": "EP#tus#5#02", "sk": "EVT#MURDER", "state": "confirmed", "victims": ["dan"]}
    )
    pick(B, "RT", ["bob", "dan", "cat"])
    pick(B, "MURDER", ["dan"])
    pick(C, "RT", ["cat", "bob", "dan"])
    return db


def record(sub, **params):
    status, res = get(record_handler, "/traitors/record", sub, **params)
    assert status == 200, res
    return {p["sub"]: p for p in res["data"]["people"]}


def test_friends_picks_wait_for_your_own(friends):
    assert cards(A, scope="friends")["RT"]["locked"] is True
    assert record(A, scope="friends")[B]["calls"] == []

    pick(A, "RT", ["cat", "bob", "dan"])
    rt = cards(A, scope="friends")["RT"]
    # Friends only: Cy picked too but isn't one.
    assert sorted(g["sub"] for g in rt["group"]) == sorted([A, B])
    bea = next(g for g in rt["group"] if g["sub"] == B)
    # firstVote bob 3, cat 1: Bob banished, Dan out of the top 3, Cat 2nd but picked 3rd.
    assert bea["points"] == 5 + 0 + 1
    assert [c["why"] for c in bea["calls"]] == ["banished", "miss", "top3"]
    assert cards(A, scope="friends")["MURDER"]["locked"] is True

    calls = record(A, scope="friends")[B]["calls"]
    # Only the round table: Ada hasn't made her murder call.
    assert [(c["ep"], c["type"], c["points"]) for c in calls] == [(2, "RT", 6)]


def test_episode_names_the_people_shown(friends):
    pick(A, "RT", ["cat", "bob", "dan"])
    status, res = get(episode_handler, "/traitors/episode", A, ep="02", scope="friends")
    assert status == 200
    assert {s: p["name"] for s, p in res["data"]["people"].items()} == {A: "Ada", B: "Bea"}


def test_own_record_has_every_call_and_points_only_with_a_result(friends):
    pick(A, "RT", ["cat", "bob", "dan"])
    pick(A, "RECRUIT", forfeit=True)
    me = record(A)
    assert list(me) == [A]
    by_type = {c["type"]: c for c in me[A]["calls"]}
    assert by_type["RT"]["points"] == 1 + 1 + 0
    # The recruit has no confirmed result: a forfeit, and nothing scored.
    assert by_type["RECRUIT"] == {"ep": 2, "type": "RECRUIT", "picks": None, "forfeit": True}


def test_winner_bets_show_once_yours_is_complete(friends):
    assert record(A, scope="friends")[B]["winner"] is None
    assert record(A, scope="friends")[A]["winner"][0]["player"] == "cat"
    bet(A, FULL)
    assert [p["player"] for p in record(A, scope="friends")[B]["winner"]] == ["cat", "dan", "eve"]


def test_group_record_is_members_only(friends):
    groups = friends.Table(GROUPS_TABLE)
    for sub in (A, C):
        groups.put_item(Item={"pk": "GROUP#g1", "sk": f"MEMBER#{sub}"})
    pick(A, "RT", ["cat", "bob", "dan"])
    people = record(A, group="g1")
    assert set(people) == {A, C}
    assert [c["picks"] for c in people[C]["calls"]] == [["cat", "bob", "dan"]]
    assert get(record_handler, "/traitors/record", B, group="g1")[0] == 403
