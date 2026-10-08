"""/stats/me against moto with the real S35 catalog: one person's breakdown, only
ever over dances the caller may see, without the caller's sealed dances."""

import json
from decimal import Decimal

import pytest

from lambdas.common.digest import digest_pk
from lambdas.scores_submit.handler import handler as submit_handler
from lambdas.stats_me.handler import handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import BOARD_TABLE, CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event
from tests.seasons import close
from tests.social import B, C, accept, ask, block, sign_in

SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
X, Y, Z = "tyler-cameron", "amber-glenn", "jenna-dewan"
CARRIE, DEREK, BRUNO = SEASON["defaultPanel"]
# Panel means: X 8 (Tango), Y 6 (Waltz), Z 7 (Tango) on episodes 4 and 5.
PANELS = {X: ((7, 8, 9), "Tango"), Y: ((6, 6, 6), "Waltz"), Z: ((7, 7, 7), "Tango")}


@pytest.fixture
def show(aws):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    perfs = aws.Table(PERFORMANCES_TABLE)
    for ep in (4, 5):
        for cid, (values, style) in PANELS.items():
            perfs.put_item(
                Item={
                    "pk": f"EP#dwts#35#{ep:02d}",
                    "sk": f"PERF#{cid}#1",
                    "contestants": [cid],
                    "rateable": True,
                    "style": style,
                    "judges": {
                        j: {"value": Decimal(v), "state": "confirmed"}
                        for j, v in zip(SEASON["defaultPanel"], values)
                    },
                }
            )
    for sub, name in ((A, "Ada Lovelace"), (B, "Bea Arthur"), (C, "Adam Driver")):
        sign_in(sub, name)
    return aws


def answer(sub, cid, ep=5, **fields):
    event = authorized_event(
        path="/scores/submit",
        method="POST",
        sub=sub,
        body={"season": "dwts-35", "ep": f"{ep:02d}", "contestant": cid, "n": 1, **fields},
    )
    assert submit_handler(event, None)["statusCode"] == 200


def get(caller=A, **params) -> tuple[int, dict]:
    event = authorized_event(path="/stats/me", sub=caller, query={"season": "dwts-35", **params})
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def me(caller=A, **params) -> dict:
    status, body = get(caller, **params)
    assert status == 200, body
    return body["data"]


def test_breakdown_by_week_style_judge_and_couple(show):
    answer(A, X, ep=4, value=10)
    answer(A, Y, ep=4, value=6)
    answer(A, X, value=9)
    answer(A, Z, value=5)
    data = me()
    assert (data["count"], data["mae"], data["bias"]) == (4, 1.25, 0.25)
    # Y at 6 is dead on; X at 9 against 8 is within a point.
    assert data["exact"] == 0.25 and data["close"] == 0.5
    assert [(w["ep"], w["count"], w["mae"], w["rank"]) for w in data["weeks"]] == [
        (4, 2, 1, 1),
        (5, 2, 1.5, 1),
    ]
    assert {s["style"]: (s["count"], s["bias"]) for s in data["styles"]} == {
        "Tango": (3, 0.33),
        "Waltz": (1, 0),
    }
    assert {j["id"]: j["mae"] for j in data["judges"]} == {CARRIE: 1.75, DEREK: 1.25, BRUNO: 0.75}
    assert data["favorites"] == [X] and data["leastFavorites"] == [Z]
    assert data["styleLikes"] == ["Tango"] and data["styleDislikes"] == []
    assert [c["key"] for c in data["best"]] == [f"{Y}#1", f"{X}#1", f"{Z}#1"]
    assert data["worst"][0] == {
        "ep": 4,
        "week": 3,
        "key": f"{X}#1",
        "style": "Tango",
        "couples": [X],
        "paddle": 10,
        "judges": 8,
        "panel": {CARRIE: 7, DEREK: 8, BRUNO: 9},
        "gap": 2,
        "error": 2,
    }
    assert data["streak"] == {"current": 1, "best": 1}
    assert data["person"]["name"] == "Ada Lovelace"


def test_week_rank_is_among_everyone_on_dances_the_caller_saw(show):
    answer(A, X, value=6)
    answer(B, X, value=8)
    answer(B, Y, value=1)
    data = me()
    assert [(w["rank"], w["ranked"]) for w in data["weeks"]] == [(2, 2)]
    # B's Y is a dance A never answered: B's own view counts it, A's never does.
    assert me(B)["count"] == 2
    assert me(A, sub=B)["count"] == 1


def test_sealed_dances_leave_every_number(show):
    answer(A, X, value=6)
    answer(A, Y, value=6)
    sealed = me(sealed=f"5:{X}#1")
    assert sealed["count"] == 1 and sealed["mae"] == 0
    assert all(c["key"] != f"{X}#1" for c in sealed["calls"])
    assert me()["count"] == 2


def test_someone_blocked_reads_as_missing(show):
    ask(A, B)
    accept(B, A)
    assert get(A, sub=B)[0] == 200
    block(B, A)
    status, body = get(A, sub=B)
    assert status == 404 and B not in json.dumps(body)


def test_unknown_person_is_404(show):
    assert get(A, sub="no-such-sub")[0] == 404


def test_a_settled_episode_is_cached_and_forgotten(show):
    answer(A, X, value=6)
    close(show, SEASON)
    assert me()["mae"] == 2
    board = show.Table(BOARD_TABLE)
    assert board.get_item(Key={"pk": digest_pk("dwts", 35), "sk": "EP#05"}).get("Item")

    # The cache answers until something that changes an answer forgets it.
    show.Table(SCORES_TABLE).put_item(
        Item={"pk": "EP#dwts#35#05", "sk": f"PERF#{X}#1#USER#{A}", "value": Decimal(8)}
    )
    assert me()["mae"] == 2
    from lambdas.common.digest import forget

    forget("dwts", 35, 5)
    assert me()["mae"] == 0


def test_an_unsettled_episode_is_never_cached(show):
    answer(A, X, value=6)
    assert me()["count"] == 1
    assert "Item" not in show.Table(BOARD_TABLE).get_item(
        Key={"pk": digest_pk("dwts", 35), "sk": "EP#05"}
    )


def test_unknown_season_is_404(show):
    event = authorized_event(path="/stats/me", query={"season": "dwts-99"})
    assert handler(event, None)["statusCode"] == 404


def test_missing_sub_is_401(show):
    event = authorized_event(path="/stats/me", query={"season": "dwts-35"})
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    assert handler(event, None)["statusCode"] == 401


def test_deleting_an_account_drops_the_digests_holding_its_answers(show):
    from lambdas.users_delete.handler import purge

    answer(A, X, value=6)
    close(show, SEASON)
    me()
    key = {"pk": digest_pk("dwts", 35), "sk": "EP#05"}
    assert "Item" in show.Table(BOARD_TABLE).get_item(Key=key)
    purge("BOARD_TABLE", B)
    assert "Item" in show.Table(BOARD_TABLE).get_item(Key=key)
    purge("BOARD_TABLE", A)
    assert "Item" not in show.Table(BOARD_TABLE).get_item(Key=key)
