import json
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from lambdas.common import episodes_dynamo
from lambdas.common.episodes_dynamo import create_scores
from lambdas.scores_skip_before import handler as skip
from lambdas.scores_submit.handler import handler as submit_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, SCORES_TABLE
from tests.events import SUB as A
from tests.events import authorized_event
from tests.test_gate import SEASON, B, score, state

# The morning after episode 5 aired; 6 onward are still to come.
NOW = datetime(2026, 10, 7, 12, tzinfo=UTC)


def ep_keys(ep: int) -> list[str]:
    if "rateableKeys" in SEASON["episodes"][ep - 1]:
        return SEASON["episodes"][ep - 1]["rateableKeys"]
    return [
        f"{c['id']}#1"
        for c in SEASON["contestants"]
        if c.get("eliminatedEp") is None or c["eliminatedEp"] >= ep
    ]


@pytest.fixture
def show(aws, monkeypatch):
    monkeypatch.setattr(skip, "_now", lambda: NOW)
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    return aws


def skip_before(sub=A, ep="05", season="dwts-35") -> tuple[int, dict]:
    event = authorized_event(
        path="/scores/skip-before", method="POST", sub=sub, body={"season": season, "ep": ep}
    )
    res = skip.handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def rows(show, sub=A) -> dict:
    out = {}
    for r in show.Table(SCORES_TABLE).scan()["Items"]:
        key, _, owner = r["sk"].removeprefix("PERF#").partition("#USER#")
        if owner == sub:
            out[(r["pk"], key)] = r
    return out


def test_forfeits_every_earlier_episode_and_leaves_this_one(show):
    score(A, ep_keys(3)[0], ep="03", value=6)
    status, body = skip_before()
    assert status == 200, body

    revealed = {r["ep"]: sorted(r["keys"]) for r in body["data"]["revealed"]}
    assert set(revealed) == {1, 2, 3, 4}
    assert revealed[3] == sorted(ep_keys(3)[1:])
    for ep in (1, 2, 4):
        assert revealed[ep] == sorted(ep_keys(ep))

    kept = rows(show)[("EP#dwts#35#03", ep_keys(3)[0])]
    assert kept["value"] == 6 and "forfeit" not in kept
    for ep in range(1, 5):
        view = state(ep=f"{ep:02d}")
        assert view["complete"] is True and view["answered"] == view["rateable"]
        assert all(c["mine"] is not None for c in view["performances"] if not c["locked"])
    assert state(ep="05")["answered"] == 0


def test_is_idempotent(show):
    skip_before()
    before = rows(show)
    status, body = skip_before()
    assert status == 200 and body["data"]["revealed"] == []
    assert rows(show) == before


def test_touches_nobody_else(show):
    score(B, ep_keys(4)[0], ep="04", value=8)
    skip_before()
    assert list(rows(show, B)) == [("EP#dwts#35#04", ep_keys(4)[0])]


def test_never_forfeits_an_episode_still_to_air(show):
    status, body = skip_before(ep="12")
    assert status == 200
    assert [r["ep"] for r in body["data"]["revealed"]] == [1, 2, 3, 4, 5]
    assert all(pk <= "EP#dwts#35#05" for pk, _ in rows(show))


def test_a_value_after_skipping_is_409(show):
    skip_before()
    event = authorized_event(
        path="/scores/submit",
        method="POST",
        body={
            "season": "dwts-35",
            "ep": "04",
            "contestant": ep_keys(4)[0][:-2],
            "n": 1,
            "value": 7,
        },
    )
    assert submit_handler(event, None)["statusCode"] == 409


def test_one_past_the_end_skips_a_finished_season_in_many_transactions(show):
    past = json.loads((SEASONS / "dwts-34.json").read_text(), parse_float=Decimal)
    write(show.Table(CATALOG_TABLE), items(past))
    status, body = skip_before(ep=f"{len(past['episodes']) + 1:02d}", season="dwts-34")
    assert status == 200, body

    want = sum(len(e["rateableKeys"]) for e in past["episodes"])
    assert want > episodes_dynamo.CHUNK
    assert sum(len(r["keys"]) for r in body["data"]["revealed"]) == want
    assert len(rows(show)) == want


def test_a_row_that_races_in_stands_and_the_rest_are_written(show, monkeypatch):
    monkeypatch.setattr(episodes_dynamo, "CHUNK", 2)
    pk = "EP#dwts#35#01"
    new = [
        {"pk": pk, "sk": f"PERF#c{i}#1#USER#{A}", "forfeit": True, "submittedAt": "t"}
        for i in range(5)
    ]
    show.Table(SCORES_TABLE).put_item(Item={**new[1], "value": 7, "forfeit": None})

    written = create_scores(new)
    assert [r["sk"] for r in written] == [new[i]["sk"] for i in (0, 2, 3, 4)]
    assert rows(show)[(pk, "c1#1")]["value"] == 7


@pytest.mark.parametrize(
    "fields",
    [{"season": "dwts-35"}, {"season": "dwts35", "ep": "05"}, {"season": "dwts-35", "ep": "0"}],
)
def test_bad_ref_is_400(show, fields):
    event = authorized_event(path="/scores/skip-before", method="POST", body=fields)
    assert skip.handler(event, None)["statusCode"] == 400
    assert show.Table(SCORES_TABLE).scan()["Items"] == []


def test_unknown_season_is_404(show):
    assert skip_before(season="dwts-99")[0] == 404


def test_missing_sub_is_401(show):
    event = authorized_event(
        path="/scores/skip-before", method="POST", body={"season": "dwts-35", "ep": "05"}
    )
    event["requestContext"]["authorizer"]["claims"].pop("sub")
    assert skip.handler(event, None)["statusCode"] == 401
