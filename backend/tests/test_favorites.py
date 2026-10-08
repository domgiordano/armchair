"""The favorites model on fixed fixtures, and the snapshot a viewer is allowed to see."""

from decimal import Decimal

import pytest

from lambdas.common import favorites as fav

PANEL = ("a", "b", "c")


def couple(cid, out=None):
    row = {"sk": f"CONTESTANT#{cid}"}
    if out is not None:
        row["eliminatedEp"] = Decimal(out)
    return row


def perf(cid, values, state="confirmed", n=1):
    return {
        "sk": f"PERF#{cid}#{n}",
        "contestants": [cid],
        "judges": {j: {"value": Decimal(v), "state": state} for j, v in zip(PANEL, values)},
    }


def score(cid, sub, value, at="2026-09-15T21:00:00+00:00"):
    return {"sk": f"PERF#{cid}#1#USER#{sub}", "value": Decimal(value), "submittedAt": at}


COUPLES = [couple("ace"), couple("bea"), couple("cat"), couple("dan", out=2)]
EPISODES = {
    1: (
        [
            perf("ace", (8, 8, 8)),
            perf("bea", (7, 7, 7)),
            perf("cat", (5, 5, 5)),
            perf("dan", (4, 4, 4)),
        ],
        [score("ace", "u1", 9), score("bea", "u1", 7), score("cat", "u1", 9)],
    ),
    2: (
        [
            perf("ace", (9, 9, 9)),
            perf("bea", (6, 6, 6)),
            perf("cat", (6, 6, 6)),
            perf("dan", (5, 5, 5)),
        ],
        [score("cat", "u2", 10)],
    ),
}


def by_id(entries):
    return {e["id"]: e for e in entries}


def test_dwts_ranks_the_judges_leader_first_and_explains_it():
    entries = by_id(fav.dwts(2, COUPLES, EPISODES, None))
    assert set(entries) == {"ace", "bea", "cat"}
    assert sum(e["model"] for e in entries.values()) == pytest.approx(1, abs=1e-3)
    assert max(entries, key=lambda c: entries[c]["model"]) == "ace"
    assert entries["ace"]["inputs"] == {
        "average": 8.5,
        "last": 9.0,
        "trend": 1.0,
        "crowd": 9.0,
        "saves": 0,
    }
    assert entries["ace"]["why"][:3] == ["Top judges' average", "Top score last time", "Rising"]


def test_dwts_counts_a_judges_bottom_two_night_survived():
    # Night 2: dan (15) is out, bea and cat tie on 18 above him; cat sorts first.
    entries = by_id(fav.dwts(2, COUPLES, EPISODES, None))
    assert entries["bea"]["inputs"]["saves"] + entries["cat"]["inputs"]["saves"] == 1
    assert any(
        c.startswith("Saved from the bottom two") for e in entries.values() for c in e["why"]
    )


def test_dwts_snapshot_reads_nothing_after_its_episode():
    """A couple out in episode 2 is still in, untouched, on the board for episode 1."""
    first = by_id(fav.dwts(1, COUPLES, EPISODES, None))
    assert "dan" in first
    assert first == by_id(fav.dwts(1, COUPLES, {1: EPISODES[1]}, None))


def test_dwts_drops_crowd_scores_after_the_cutoff():
    late = {1: (EPISODES[1][0], [score("cat", "u3", 10, at="2026-09-22T20:30:00+00:00")])}
    entries = by_id(fav.dwts(1, COUPLES, late, "2026-09-22T20:00:00Z"))
    assert entries["cat"]["inputs"]["crowd"] is None


def test_dwts_skips_unconfirmed_judges_and_team_dances():
    team = {"sk": "PERF#ace+bea#1", "contestants": ["ace", "bea"], "judges": {}}
    eps = {1: ([perf("ace", (10, 10, 10), state="provisional"), team, perf("bea", (7, 7, 7))], [])}
    entries = by_id(fav.dwts(1, COUPLES, eps, None))
    assert entries["ace"]["inputs"]["average"] is None
    assert entries["bea"]["inputs"]["average"] == 7.0


def test_dwts_with_nothing_scored_has_no_model():
    entries = fav.dwts(0, COUPLES, {}, None)
    assert {e["model"] for e in entries} == {None}


def player(pid, out=None):
    row = {"sk": f"PLAYER#{pid}", "name": pid.title()}
    if out:
        row["exit"] = {"ep": Decimal(out), "how": "banished"}
    return row


PLAYERS = [player("ann"), player("ben"), player("cal", out=2), player("dee")]
TRAITORS_EPS = {
    1: ([{"sk": "EVT#SHIELD", "state": "confirmed", "shields": ["dee"]}], []),
    2: (
        [
            {
                "sk": "EVT#RT",
                "state": "confirmed",
                "banished": "cal",
                "firstVote": {"cal": 5, "ben": 3},
            }
        ],
        [
            {
                "sk": "EVT#RT#USER#u1",
                "picks": ["ben", "cal", "dee"],
                "submittedAt": "2026-10-01T19:00:00Z",
            }
        ],
    ),
}
BETS = [
    {
        "sk": "USER#u1",
        "picks": [{"player": "ann", "faction": "Faithful"}],
        "submittedAt": "2026-09-30T10:00:00Z",
    },
    {
        "sk": "USER#u2",
        "picks": [
            {"player": "ann", "faction": "Faithful"},
            {"player": "dee", "faction": "Traitor"},
        ],
        "submittedAt": "2026-09-30T11:00:00Z",
    },
]


def test_traitors_backs_the_crowd_pick_and_marks_down_votes():
    entries = by_id(fav.traitors(2, PLAYERS, TRAITORS_EPS, BETS, None))
    assert set(entries) == {"ann", "ben", "dee"}
    assert max(entries, key=lambda p: entries[p]["model"]) == "ann"
    assert min(entries, key=lambda p: entries[p]["model"]) == "ben"
    assert entries["ann"]["inputs"]["backing"] == 1.5
    assert entries["ben"]["inputs"]["lastVotes"] == 3
    assert "Crowd's top winner pick" in entries["ann"]["why"]
    assert "3 votes last round table" in entries["ben"]["why"]
    assert "Has held a shield" in entries["dee"]["why"]


def test_traitors_never_reads_faction():
    traitor = [{**p, "faction": "Traitor"} for p in PLAYERS]
    assert fav.traitors(2, traitor, TRAITORS_EPS, BETS, None) == fav.traitors(
        2, PLAYERS, TRAITORS_EPS, BETS, None
    )


def test_traitors_drops_bets_after_the_cutoff():
    entries = by_id(fav.traitors(1, PLAYERS, TRAITORS_EPS, BETS, "2026-09-30T10:30:00Z"))
    assert entries["dee"]["inputs"]["backing"] == 0
    assert "cal" in entries


@pytest.mark.parametrize(
    "p,odds",
    [
        (0.5, "-100"),
        (0.6, "-150"),
        (0.22, "+355"),
        (0.0001, "+99900"),
        (0.9, "-900"),
        (0.07, "+1350"),
    ],
)
def test_american(p, odds):
    assert fav.american(p) == odds


def entry(cid, model):
    return {"id": cid, "model": model, "inputs": {}, "why": []}


def test_blend_renormalizes_the_market_over_the_board():
    entries = [entry("ace", 0.5), entry("bea", 0.5)]
    market = {"ace": 0.3, "bea": 0.1, "gone": 0.6}
    chances = fav.blend(entries, market)
    assert chances["ace"] == pytest.approx(0.75)
    assert sum(chances.values()) == pytest.approx(1)


def test_blend_prices_an_unlisted_entry_from_the_model():
    entries = [entry("ace", 0.5), entry("bea", 0.3), entry("cat", 0.2)]
    chances = fav.blend(entries, {"ace": 0.6, "bea": 0.2})
    assert chances["cat"] == pytest.approx(0.2)
    assert chances["ace"] == pytest.approx(0.6)


def test_blend_market_alone_when_the_model_has_nothing():
    chances = fav.blend([entry("ace", None), entry("bea", None)], {"ace": 0.2, "bea": 0.2})
    assert chances == {"ace": 0.5, "bea": 0.5}
    assert fav.blend([entry("ace", None)], None) == {}


MARKET = "https://polymarket.com/event/x"


def snapshot(entries, market=None):
    return {"entries": entries, "market": market, "computedAt": "2026-09-30T00:00:00Z"}


SNAPS = {
    1: snapshot(
        [entry("ace", 0.4), entry("bea", 0.35), entry("dan", 0.25)],
        {
            "source": "Polymarket",
            "url": MARKET,
            "capturedAt": "2026-09-21T12:00:00Z",
            "prices": {"ace": 0.4, "bea": 0.35, "dan": 0.25},
        },
    ),
    2: snapshot(
        [entry("ace", 0.3), entry("bea", 0.7)],
        {
            "source": "Polymarket",
            "url": MARKET,
            "capturedAt": "2026-09-23T12:00:00Z",
            "prices": {"ace": 0.4, "bea": 0.6},
        },
    ),
}
STARTS = {1: "2026-09-22T00:00:00Z", 2: "2026-09-29T00:00:00Z"}


def test_viewer_behind_sees_the_board_from_before_the_elimination():
    """Episode 2 is out and dan went out in it; a viewer through episode 1 can't tell."""
    behind = fav.for_viewer(SNAPS, revealed=1, latest=2, next_start=STARTS)
    assert behind["asOf"] == 1 and behind["behind"] is True
    assert [e["id"] for e in behind["entries"]] == ["ace", "bea", "dan"]
    assert behind == fav.for_viewer({1: SNAPS[1]}, revealed=1, latest=2, next_start=STARTS)
    assert all(e["move"] is None for e in behind["entries"])


def test_caught_up_viewer_sees_the_new_board_and_movement():
    now = fav.for_viewer(SNAPS, revealed=2, latest=2, next_start=STARTS)
    assert now["asOf"] == 2 and now["behind"] is False
    assert now["source"] == "market" and now["market"]["source"] == "Polymarket"
    bea, ace = now["entries"]
    assert (bea["id"], bea["chance"], bea["odds"]) == ("bea", 0.6, "-150")
    assert bea["move"] == {"rank": 1, "chance": pytest.approx(0.25)}
    assert "Market favorite" in bea["why"]
    assert (ace["chance"], ace["model"], ace["market"]) == (0.4, 0.3, 0.4)
    assert ace["move"] == {"rank": -1, "chance": pytest.approx(0)}


def test_market_captured_after_the_next_episode_started_is_dropped():
    late = {**SNAPS[2], "market": {**SNAPS[2]["market"], "capturedAt": "2026-09-29T01:00:00Z"}}
    view = fav.for_viewer({2: late}, revealed=2, latest=3, next_start=STARTS)
    assert view["market"] is None
    assert view["source"] == "model"
    assert view["entries"][0]["chance"] == pytest.approx(0.7)
    assert view["entries"][0]["market"] is None


def test_nothing_revealed_and_no_snapshot():
    view = fav.for_viewer({1: SNAPS[1]}, revealed=0, latest=1, next_start=STARTS)
    assert view["asOf"] is None and view["entries"] == []


def test_no_movement_when_the_board_switches_source():
    snaps = {**SNAPS, 1: {**SNAPS[1], "market": None}}
    now = fav.for_viewer(snaps, revealed=2, latest=2, next_start=STARTS)
    assert {e["move"] is None for e in now["entries"]} == {True}


def test_traitors_no_votes_chip_waits_for_a_round_table():
    entries = by_id(fav.traitors(1, PLAYERS, TRAITORS_EPS, BETS, None))
    assert not any("No votes against yet" in e["why"] for e in entries.values())
