"""A finished season seeded end to end: catalog, confirmed performances, results, scoring."""

import json
from decimal import Decimal

import pytest

from lambdas.episodes_state.handler import handler as state_handler
from lambdas.scores_submit.handler import handler as submit_handler
from scripts.seed_season import SEASONS, items, publish_all, write
from tests.conftest import BOARD_TABLE, CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import SUB, authorized_event

S8 = json.loads((SEASONS / "dwts-8.json").read_text(), parse_float=Decimal)
PK = "SEASON#dwts#8"
# Week 3 night 2: the results-show dance-off, Holly and Denise's second dances.
DANCE_OFF = "EP#dwts#8#05"


@pytest.fixture
def seeded(aws):
    write(aws.Table(CATALOG_TABLE), items(S8))
    publish_all(S8)
    return aws


def get(db, table, pk, sk) -> dict:
    return db.Table(table).get_item(Key={"pk": pk, "sk": sk})["Item"]


def call(handler, **kw) -> tuple[int, dict]:
    res = handler(authorized_event(**kw), None)
    return res["statusCode"], json.loads(res["body"])


def test_performances_land_confirmed_with_results(seeded):
    denise = get(seeded, PERFORMANCES_TABLE, DANCE_OFF, "PERF#denise-richards#2")
    assert {j: (e["value"], e["state"]) for j, e in denise["judges"].items()} == {
        "carrie-ann-inaba": (6, "confirmed"),
        "len-goodman": (7, "confirmed"),
        "bruno-tonioli": (7, "confirmed"),
    }
    assert denise["rev"] == S8["revid"]
    ep5 = get(seeded, CATALOG_TABLE, PK, "EP#05")
    assert ep5["results"]["eliminated"] == ["denise-richards"]
    assert ep5["results"]["totals"] == {"holly-madison": 18, "denise-richards": 20}
    assert ep5["rateableKeys"] == ["holly-madison#2", "denise-richards#2"]
    assert "performances" not in ep5
    denise_c = get(seeded, CATALOG_TABLE, PK, "CONTESTANT#denise-richards")
    assert denise_c["eliminatedEp"] == 5


def test_no_elimination_night_still_gets_results(seeded):
    # Week 1 has no Result column: nobody went home until week 2.
    ep1 = get(seeded, CATALOG_TABLE, PK, "EP#01")
    assert ep1["results"]["eliminated"] == []
    assert len(ep1["results"]["totals"]) == 13


def test_reseeding_changes_nothing(seeded):
    before = seeded.Table(PERFORMANCES_TABLE).scan()["Items"]
    publish_all(S8)
    assert seeded.Table(PERFORMANCES_TABLE).scan()["Items"] == before


def test_a_past_episode_is_scorable_behind_the_same_gate(seeded):
    status, body = call(
        state_handler, path="/episodes/state", query={"season": "dwts-8", "ep": "05"}
    )
    assert status == 200, body
    view = body["data"]
    assert (view["rateable"], view["complete"]) == (2, False)
    assert all(c["locked"] for c in view["performances"])

    status, body = call(
        submit_handler,
        path="/scores/submit",
        method="POST",
        body={"season": "dwts-8", "ep": "05", "contestant": "holly-madison", "n": 2, "value": 6},
    )
    assert status == 200, body
    # A dance from another night of the week is not part of this episode.
    status, _ = call(
        submit_handler,
        path="/scores/submit",
        method="POST",
        body={"season": "dwts-8", "ep": "05", "contestant": "holly-madison", "n": 1, "value": 6},
    )
    assert status == 400

    view = call(state_handler, path="/episodes/state", query={"season": "dwts-8", "ep": "05"})[1][
        "data"
    ]
    holly = next(c for c in view["performances"] if c["key"] == "holly-madison#2")
    assert holly["locked"] is False and holly["mine"] == {"value": 6}
    assert "results" not in view


S34 = json.loads((SEASONS / "dwts-34.json").read_text(), parse_float=Decimal)
TEAM = "danielle-fishel+whitney-leavitt+jordan-chiles+dylan-efron"


def test_a_scored_team_dance_is_answered_and_counted_like_any_other(aws):
    write(aws.Table(CATALOG_TABLE), items(S34))
    publish_all(S34)
    ref = {"season": "dwts-34", "ep": "08"}

    view = call(state_handler, path="/episodes/state", query=ref)[1]["data"]
    team = next(c for c in view["performances"] if c["key"] == f"{TEAM}#1")
    assert view["rateable"] == 10 and team["locked"] is True

    status, body = call(
        submit_handler,
        path="/scores/submit",
        method="POST",
        body={**ref, "contestant": TEAM, "n": 1, "value": 9},
    )
    assert status == 200, body

    view = call(state_handler, path="/episodes/state", query=ref)[1]["data"]
    team = next(c for c in view["performances"] if c["key"] == f"{TEAM}#1")
    assert team["locked"] is False and team["mine"] == {"value": 9}
    assert [j["value"] for j in team["judges"]] == [10, 10, 10, 10]
    board = aws.Table(BOARD_TABLE).get_item(Key={"pk": "BOARD#dwts#34", "sk": f"USER#{SUB}"})
    assert board["Item"]["n"] == 1 and board["Item"]["err"] == 1
