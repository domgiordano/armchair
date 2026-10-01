import json

import pytest

from lambdas.scores_reveal_all.handler import handler as reveal_handler
from scripts.seed_season import items, write
from tests.conftest import CATALOG_TABLE, SCORES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event
from tests.seasons import close
from tests.test_gate import EP5_KEYS, JUDGED, SEASON, B, score, state, submit


@pytest.fixture
def show(aws):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    return aws


def reveal_all(sub=A, ep="05") -> tuple[int, dict]:
    event = authorized_event(
        path="/scores/reveal-all", method="POST", sub=sub, body={"season": "dwts-35", "ep": ep}
    )
    res = reveal_handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def rows(show, sub=A) -> dict:
    items = show.Table(SCORES_TABLE).scan()["Items"]
    return {
        r["sk"].split("#USER#")[0].removeprefix("PERF#"): r for r in items if r["sk"].endswith(sub)
    }


def test_forfeits_only_what_is_unanswered_and_opens_the_episode(show):
    score(A, JUDGED, value=6)
    status, body = reveal_all()
    assert status == 200, body
    assert sorted(body["data"]["revealed"]) == sorted(k for k in EP5_KEYS if k != JUDGED)

    mine = rows(show)
    assert mine[JUDGED]["value"] == 6 and "forfeit" not in mine[JUDGED]
    assert all(
        mine[k]["forfeit"] is True and "value" not in mine[k] for k in EP5_KEYS if k != JUDGED
    )

    view = state()
    assert view["complete"] is True and view["answered"] == 12
    assert all(c["locked"] is False for c in view["performances"])


def test_is_idempotent(show):
    reveal_all()
    before = rows(show)
    status, body = reveal_all()
    assert status == 200 and body["data"]["revealed"] == []
    assert rows(show) == before


def test_touches_nobody_else(show):
    score(B, JUDGED, value=8)
    reveal_all()
    assert list(rows(show, B)) == [JUDGED]
    assert state(sub=B)["answered"] == 1


def test_a_value_after_reveal_all_is_409(show):
    reveal_all()
    assert submit(contestant="tyler-cameron", value=7)[0] == 409


def test_a_past_season_is_view_only(show):
    close(show, SEASON)
    assert reveal_all()[0] == 403
    assert rows(show) == {}


@pytest.mark.parametrize("fields", [{"season": "dwts-35"}, {"season": "dwts35", "ep": "05"}])
def test_bad_ref_is_400(show, fields):
    event = authorized_event(path="/scores/reveal-all", method="POST", body=fields)
    assert reveal_handler(event, None)["statusCode"] == 400
    assert show.Table(SCORES_TABLE).scan()["Items"] == []


def test_unknown_episode_is_404(show):
    assert reveal_all(ep="40")[0] == 404
