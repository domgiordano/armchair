"""
The gate test suite from PLAN.md "Test plan", run through both handlers against
moto with the real S35 catalog seed.
"""

import json
from decimal import Decimal

import pytest

from lambdas.common.gate import episode_view, visible_scores
from lambdas.common.groups_dynamo import create as create_group
from lambdas.common.groups_dynamo import join as join_group
from lambdas.episodes_state.handler import handler as state_handler
from lambdas.scores_submit.handler import handler as submit_handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import (
    CATALOG_TABLE,
    GROUPS_TABLE,
    PERFORMANCES_TABLE,
    SCORES_TABLE,
    WRITEUPS_TABLE,
)
from tests.events import SUB as A
from tests.events import authorized_event
from tests.sealing import seal
from tests.seasons import close

B = "3f1c2b9a-0000-4000-8000-000000000002"
C = "3f1c2b9a-0000-4000-8000-000000000003"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
EP5 = "EP#dwts#35#05"
LOCKED = {"key", "contestants", "n", "style", "song", "locked", "writeup"}
# Ep 5: the four couples out in eps 1-4 are gone, twelve dance once each.
EP5_KEYS = sorted(f"{c['id']}#1" for c in SEASON["contestants"] if c.get("eliminatedEp") is None)
JUDGED = "tyler-cameron#1"


@pytest.fixture
def show(aws):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    aws.Table(PERFORMANCES_TABLE).put_item(
        Item={
            "pk": EP5,
            "sk": f"PERF#{JUDGED}",
            "contestants": ["tyler-cameron"],
            "rateable": True,
            "style": "Tango",
            "song": "Example Song",
            "judges": {
                "carrie-ann-inaba": {"value": Decimal(8), "state": "confirmed"},
                "derek-hough": {"value": Decimal("7.5"), "state": "provisional"},
            },
            "bonus": Decimal(2),
        }
    )
    return aws


def call(handler, event) -> tuple[int, dict]:
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def state_call(sub=A, ep="05", email="viewer@example.com", group=None) -> tuple[int, dict]:
    query = {"season": "dwts-35", "ep": ep}
    if group:
        query["group"] = group
    event = authorized_event(path="/episodes/state", sub=sub, email=email, query=query)
    return call(state_handler, event)


def state(sub=A, ep="05", email="viewer@example.com", group=None) -> dict:
    status, body = state_call(sub, ep, email, group)
    assert status == 200, body
    return body["data"]


def submit(sub=A, ep="05", **fields) -> tuple[int, dict]:
    event = authorized_event(
        path="/scores/submit",
        method="POST",
        sub=sub,
        body={"season": "dwts-35", "ep": ep, "n": 1, **fields},
    )
    return call(submit_handler, event)


def score(sub, key, ep="05", **answer):
    cid_, n = key.rsplit("#", 1)
    status, body = submit(sub=sub, ep=ep, contestant=cid_, n=int(n), **answer)
    assert status == 200, body


def cards(view) -> dict:
    return {c["key"]: c for c in view["performances"]}


def test_no_answers_means_every_card_is_locked(show):
    score(B, JUDGED, value=8)
    view = state()
    assert sorted(cards(view)) == EP5_KEYS
    for card in view["performances"]:
        assert set(card) == LOCKED and card["locked"] is True
    assert "results" not in view and "eliminated" not in view
    assert (view["rateable"], view["answered"], view["complete"]) == (12, 0, False)
    assert view["open"] is False
    raw = json.dumps(view)
    assert B not in raw and "7.5" not in raw


def test_the_locked_card_keeps_pre_show_facts(show):
    card = cards(state())[JUDGED]
    assert card == {
        "key": JUDGED,
        "contestants": ["tyler-cameron"],
        "n": 1,
        "style": "Tango",
        "song": "Example Song",
        "locked": True,
        "writeup": None,
    }


def test_answering_reveals_only_that_performance(show):
    score(B, JUDGED, value=8)
    score(C, JUDGED, forfeit=True)
    score(B, "amber-glenn#1", value=3)
    score(A, JUDGED, value=6)

    view = cards(state())
    card = view[JUDGED]
    assert card["locked"] is False
    assert card["judges"] == [
        {"id": "carrie-ann-inaba", "value": 8, "state": "confirmed"},
        {"id": "derek-hough", "value": 7.5, "state": "provisional"},
        {"id": "bruno-tonioli", "value": None, "state": "pending"},
    ]
    assert card["mine"] == {"value": 6}
    assert card["others"] == [{"sub": B, "value": 8}]
    assert card["aggregate"] == {"count": 2, "mean": 7.0}
    assert "bonus" not in card
    for key, other in view.items():
        if key != JUDGED:
            assert set(other) == LOCKED


def test_forfeit_reveals_without_a_value(show):
    score(B, JUDGED, value=9)
    score(A, JUDGED, forfeit=True)
    card = cards(state())[JUDGED]
    assert card["mine"] == {"forfeit": True}
    assert card["aggregate"] == {"count": 1, "mean": 9.0}


def test_results_open_only_after_every_rateable_performance(show):
    show.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#dwts#35", "sk": "EP#04"},
        UpdateExpression="SET results = :r",
        ExpressionAttributeValues={":r": {"eliminated": ["taylor-hanson"]}},
    )
    ep4 = sorted(cards(state(ep="04")))
    assert len(ep4) == 13 and "taylor-hanson#1" in ep4
    for key in ep4[:-1]:
        score(A, key, ep="04", value=7)
    view = state(ep="04")
    assert view["answered"] == 12
    assert "results" not in view and "eliminated" not in view

    score(A, ep4[-1], ep="04", forfeit=True)
    view = state(ep="04")
    assert view["complete"] is True
    assert view["eliminated"] == ["taylor-hanson"]
    assert view["results"] == {"eliminated": ["taylor-hanson"]}


def test_a_season_opens_to_everyone_once_it_is_no_longer_current(show):
    show.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#dwts#35", "sk": "EP#05"},
        UpdateExpression="SET results = :r",
        ExpressionAttributeValues={":r": {"eliminated": ["tyler-cameron"]}},
    )
    score(B, JUDGED, value=8)
    score(C, JUDGED, value=3)
    assert set(cards(state())[JUDGED]) == LOCKED

    close(show, SEASON)
    view = state()
    assert view["open"] is True
    assert (view["answered"], view["complete"]) == (0, True)
    assert view["results"] == {"eliminated": ["tyler-cameron"]}
    assert all(c["locked"] is False and c["mine"] is None for c in view["performances"])
    card = cards(view)[JUDGED]
    assert [j["value"] for j in card["judges"]] == [8, 7.5, None]
    assert card["others"] == [{"sub": B, "value": 8}, {"sub": C, "value": 3}]
    assert card["aggregate"] == {"count": 2, "mean": 5.5}
    assert card["bonus"] == 2
    # A group still narrows; it just has nothing left to hide.
    card = cards(episode_view(A, 5, *_ep5_inputs(show), members={C}))[JUDGED]
    assert card["others"] == [{"sub": C, "value": 3}]


def test_a_past_season_keeps_its_answers_and_takes_no_more(show):
    score(A, JUDGED, value=6)
    close(show, SEASON)
    assert cards(state())[JUDGED]["mine"] == {"value": 6}
    status, body = submit(contestant="amber-glenn", value=7)
    assert status == 403, body
    assert submit(contestant="tyler-cameron", value=6)[0] == 403
    assert len(show.Table(SCORES_TABLE).scan()["Items"]) == 1


def test_bonus_opens_with_the_episode(show):
    for key in EP5_KEYS:
        score(A, key, value=5)
    assert cards(state())[JUDGED]["bonus"] == 2


def test_team_dance_opens_with_the_episode_and_is_not_scorable(show):
    team = {
        "pk": EP5,
        "sk": "PERF#jenna-dewan#2",
        "contestants": ["jenna-dewan", "ezra-frech"],
        "rateable": False,
        "judges": {"derek-hough": {"value": Decimal(9), "state": "confirmed"}},
    }
    show.Table(PERFORMANCES_TABLE).put_item(Item=team)
    status, _ = submit(contestant="jenna-dewan", n=2, value=7)
    assert status == 400

    view = state()
    assert view["rateable"] == 12
    assert set(cards(view)["jenna-dewan#2"]) == LOCKED
    for key in EP5_KEYS:
        score(A, key, value=5)
    card = cards(state())["jenna-dewan#2"]
    assert card["locked"] is False and card["mine"] is None
    assert card["judges"][1] == {"id": "derek-hough", "value": 9, "state": "confirmed"}


def test_a_scored_team_dance_must_be_answered_like_any_other(show):
    team = "jenna-dewan+ezra-frech"
    show.Table(PERFORMANCES_TABLE).put_item(
        Item={
            "pk": EP5,
            "sk": f"PERF#{team}#1",
            "contestants": team.split("+"),
            "rateable": True,
            "judges": {"derek-hough": {"value": Decimal(9), "state": "confirmed"}},
        }
    )
    view = state()
    assert view["rateable"] == 13
    assert set(cards(view)[f"{team}#1"]) == LOCKED

    for key in EP5_KEYS:
        score(A, key, value=5)
    assert state()["complete"] is False
    status, body = submit(contestant=team, value=8)
    assert status == 200, body
    view = state()
    assert view["complete"] is True
    assert cards(view)[f"{team}#1"]["mine"] == {"value": 8}


def test_cards_stay_alphabetical_by_celebrity_whatever_is_answered(show):
    score(A, "tyler-cameron#1", value=5)
    score(A, "amber-glenn#1", value=5)
    names = {c["id"]: c["members"][0]["name"] for c in SEASON["contestants"]}
    order = [names[c["contestants"][0]] for c in state()["performances"]]
    assert order == sorted(order) and order[0] == "Amber Glenn"


def test_future_episode_uses_the_default_panel_and_one_dance(show):
    view = state(ep="06")
    assert view["panel"] == SEASON["defaultPanel"]
    assert view["rateable"] == 12


def test_admin_gets_the_same_gated_view(show, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "admin@example.com")
    score(B, JUDGED, value=8)
    view = state(email="admin@example.com")
    assert view == state()
    assert all(set(c) == LOCKED for c in view["performances"])


def test_unknown_episode_is_404(show):
    event = authorized_event(path="/episodes/state", query={"season": "dwts-35", "ep": "40"})
    assert call(state_handler, event)[0] == 404


@pytest.mark.parametrize(
    "query", [None, {"season": "dwts35", "ep": "05"}, {"season": "dwts-35", "ep": "5a"}]
)
def test_bad_episode_ref_is_400(show, query):
    event = authorized_event(path="/episodes/state", query=query)
    assert call(state_handler, event)[0] == 400


def test_missing_sub_is_401(show):
    event = authorized_event(path="/episodes/state", query={"season": "dwts-35", "ep": "05"})
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    assert call(state_handler, event)[0] == 401


def test_group_filter_through_the_handler(show):
    gid = create_group(A, "Family")["id"]
    join_group(B, create_group(C, "Other")["inviteCode"])
    join_group(B, invite_code(show, gid))
    score(B, JUDGED, value=8)
    score(C, JUDGED, value=2)

    locked = state(group=gid)
    assert set(cards(locked)[JUDGED]) == LOCKED
    assert B not in json.dumps(locked)

    score(A, JUDGED, value=6)
    card = cards(state(group=gid))[JUDGED]
    assert card["others"] == [{"sub": B, "value": 8}]
    assert card["aggregate"] == {"count": 2, "mean": 7.0}
    assert cards(state())[JUDGED]["aggregate"]["count"] == 3


def test_group_filter_is_403_for_a_non_member(show):
    gid = create_group(B, "Family")["id"]
    score(B, JUDGED, value=8)
    score(A, JUDGED, value=6)
    status, body = state_call(group=gid)
    assert status == 403
    assert body["data"] is None and B not in json.dumps(body)


def test_group_that_does_not_exist_is_403(show):
    assert state_call(group="no-such-group")[0] == 403


def invite_code(show, gid) -> str:
    meta = show.Table(GROUPS_TABLE).get_item(Key={"pk": f"GROUP#{gid}", "sk": "META"})
    return meta["Item"]["inviteCode"]


def _ep5_inputs(show):
    rows = show.Table(CATALOG_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": "SEASON#dwts#35"}
    )["Items"]
    by_sk = {r["sk"]: r for r in rows}
    contestants = [r for r in rows if r["sk"].startswith("CONTESTANT#")]
    perfs = show.Table(PERFORMANCES_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": EP5}
    )["Items"]
    scores = show.Table(SCORES_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": EP5}
    )["Items"]
    return by_sk["META"], by_sk["EP#05"], contestants, perfs, scores


def test_group_filter_never_reveals_an_unanswered_performance(show):
    score(B, JUDGED, value=8)
    view = episode_view(A, 5, *_ep5_inputs(show), members={A, B})
    assert set(cards(view)[JUDGED]) == LOCKED


def test_group_filter_narrows_others(show):
    score(B, JUDGED, value=8)
    score(C, JUDGED, value=2)
    score(A, JUDGED, value=6)
    card = cards(episode_view(A, 5, *_ep5_inputs(show), members={B}))[JUDGED]
    assert card["others"] == [{"sub": B, "value": 8}]
    assert card["aggregate"] == {"count": 2, "mean": 7.0}
    assert card["mine"] == {"value": 6}
    assert cards(episode_view(A, 5, *_ep5_inputs(show), members=set()))[JUDGED]["others"] == []


def test_stats_see_only_answered_performances(show):
    score(B, JUDGED, value=8)
    score(B, "amber-glenn#1", value=3)
    score(C, "amber-glenn#1", value=4)
    score(A, JUDGED, value=6)
    rows = _ep5_inputs(show)[-1]

    def seen(sub, members=None):
        return {tuple(r["sk"].split("#USER#")) for r in visible_scores(sub, rows, members)}

    assert seen(A) == {(f"PERF#{JUDGED}", A), (f"PERF#{JUDGED}", B)}
    assert seen(B, members={C}) == {
        (f"PERF#{JUDGED}", B),
        ("PERF#amber-glenn#1", B),
        ("PERF#amber-glenn#1", C),
    }
    opened = {tuple(r["sk"].split("#USER#")) for r in visible_scores(C, rows, opened=True)}
    assert len(opened) == len(rows) == 4


def test_resubmitting_the_same_value_returns_the_stored_row(show):
    first = submit(contestant="tyler-cameron", value=7)
    again = submit(contestant="tyler-cameron", value=7)
    assert first[0] == again[0] == 200
    assert again[1]["data"] == first[1]["data"]
    assert again[1]["data"]["value"] == 7 and again[1]["data"]["key"] == JUDGED


def test_a_different_answer_is_409_and_the_first_stands(show):
    score(A, JUDGED, value=7)
    assert submit(contestant="tyler-cameron", value=8)[0] == 409
    assert submit(contestant="tyler-cameron", forfeit=True)[0] == 409
    score(A, JUDGED, value=7)
    row = show.Table(SCORES_TABLE).get_item(Key={"pk": EP5, "sk": f"PERF#{JUDGED}#USER#{A}"})
    assert row["Item"]["value"] == 7 and "forfeit" not in row["Item"]


def test_forfeit_retry_is_200_and_value_after_it_is_409(show):
    score(A, JUDGED, forfeit=True)
    score(A, JUDGED, forfeit=True)
    assert submit(contestant="tyler-cameron", value=5)[0] == 409


@pytest.mark.parametrize(
    "fields",
    [
        {"contestant": "taylor-hanson", "value": 7},  # eliminated in ep 4
        {"contestant": "tyler-cameron", "n": 2, "value": 7},  # dancesPerCouple is 1
        {"contestant": "tyler-cameron", "value": 0},
        {"contestant": "tyler-cameron", "value": 11},
        {"contestant": "tyler-cameron", "value": 7.0},
        {"contestant": "tyler-cameron", "value": True},
        {"contestant": "tyler-cameron", "value": "7"},
        {"contestant": "tyler-cameron"},
        {"contestant": "tyler-cameron", "forfeit": False},
        {"contestant": "tyler-cameron", "forfeit": "true"},
        {"contestant": "tyler-cameron", "forfeit": True, "value": 7},
    ],
)
def test_rejected_submits_write_nothing(show, fields):
    status, body = submit(**fields)
    assert status == 400, body
    assert show.Table(SCORES_TABLE).scan()["Items"] == []


def test_unknown_contestant_is_404(show):
    assert submit(contestant="nobody", value=7)[0] == 404


def test_unknown_episode_submit_is_404(show):
    assert submit(ep="40", contestant="tyler-cameron", value=7)[0] == 404


def test_empty_roster_keeps_results_hidden(show):
    meta, episode, _, perfs, scores = _ep5_inputs(show)
    view = episode_view(
        A, 5, meta, {**episode, "results": {"eliminated": ["x"]}}, [], perfs, scores
    )
    assert "results" not in view


def test_premiere_nights_each_ask_only_for_the_couples_who_danced(show):
    one, two = state(ep="01"), state(ep="02")
    assert (one["rateable"], two["rateable"]) == (8, 8)
    assert "conner-leavitt#1" in cards(one) and "sarah-jane-nader#1" in cards(two)
    assert not set(cards(one)) & set(cards(two))

    status, body = submit(ep="01", contestant="jenna-dewan", value=7)
    assert status == 400, body


WRITEUP = {
    "pk": EP5,
    "sk": f"PERF#{JUDGED}",
    "summary": "Tyler and Sharna danced a dramatic tango.",
    "judges": [{"judge": "derek-hough", "text": "Loved the attack.", "quote": "proper tango"}],
    "highlights": ["Sharp lines"],
    "sources": ["https://www.goldderby.com/recap/"],
    "model": "claude-opus-5-5",
    "generatedAt": 1790000000,
}


def test_a_writeup_stays_locked_until_the_dance_is_answered(show):
    show.Table(WRITEUPS_TABLE).put_item(Item=WRITEUP)
    show.Table(WRITEUPS_TABLE).put_item(Item={"pk": EP5, "sk": "META", "spentUsd": Decimal(1)})
    score(B, JUDGED, value=8)
    view = state()
    assert cards(view)[JUDGED]["writeup"] == {"locked": True}
    assert cards(view)["amber-glenn#1"]["writeup"] is None
    raw = json.dumps(view)
    assert "dramatic tango" not in raw and "Loved the attack" not in raw

    score(A, JUDGED, forfeit=True)
    assert cards(state())[JUDGED]["writeup"] == {
        "summary": "Tyler and Sharna danced a dramatic tango.",
        "judges": [{"id": "derek-hough", "text": "Loved the attack.", "quote": "proper tango"}],
        "highlights": ["Sharp lines"],
        "sources": ["https://www.goldderby.com/recap/"],
    }


def test_a_past_seasons_writeups_are_open_to_everyone(show):
    show.Table(WRITEUPS_TABLE).put_item(Item=WRITEUP)
    close(show, SEASON)
    assert cards(state())[JUDGED]["writeup"]["summary"] == WRITEUP["summary"]


def test_an_empty_writeup_is_no_writeup(show):
    show.Table(WRITEUPS_TABLE).put_item(
        Item={"pk": EP5, "sk": f"PERF#{JUDGED}", "summary": None, "judges": [], "highlights": []}
    )
    score(A, JUDGED, value=6)
    assert cards(state())[JUDGED]["writeup"] is None


def test_a_sealed_dance_stays_locked_with_the_callers_answer(show):
    score(B, JUDGED, value=8)
    score(A, JUDGED, value=6)
    seal(A, f"dwts-35|5|{JUDGED}")
    view = state()
    card = cards(view)[JUDGED]
    assert card == {**cards(state(sub=C))[JUDGED], "sealed": True, "mine": {"value": 6}}
    assert view["answered"] == 1
    raw = json.dumps(view)
    assert B not in raw and "7.5" not in raw
    # Another device, the same user: no list sent, the same face-down card.
    assert cards(state())[JUDGED]["sealed"] is True


def test_a_sealed_dance_holds_the_results_even_once_closed(show):
    show.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#dwts#35", "sk": "EP#05"},
        UpdateExpression="SET results = :r",
        ExpressionAttributeValues={":r": {"eliminated": ["tyler-cameron"]}},
    )
    for key in EP5_KEYS:
        score(A, key, value=7)
    assert state()["complete"] is True
    seal(A, f"dwts-35|5|{JUDGED}")
    view = state()
    assert view["complete"] is False and "eliminated" not in view
    close(show, SEASON)
    view = state()
    assert view["complete"] is False and "results" not in view
    assert cards(view)[JUDGED]["locked"] is True
    assert cards(view)["amber-glenn#1"]["locked"] is False


def test_another_users_seal_changes_nothing(show):
    score(A, JUDGED, value=6)
    seal(B, f"dwts-35|5|{JUDGED}")
    assert cards(state())[JUDGED]["locked"] is False
