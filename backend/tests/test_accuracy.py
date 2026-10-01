"""The accuracy cases from PLAN.md "Test plan"."""

from decimal import Decimal

from lambdas.common.accuracy import errors, summary

A = "sub-a"
CARRIE, DEREK, BRUNO, GUEST = "carrie-ann-inaba", "derek-hough", "bruno-tonioli", "guest"
PANEL = [CARRIE, DEREK, BRUNO]


def perf(cid="tyler-cameron", state="confirmed", **judges):
    return {
        "sk": f"PERF#{cid}#1",
        "contestants": [cid],
        "rateable": True,
        "judges": {j: {"value": Decimal(str(v)), "state": state} for j, v in judges.items()},
    }


def score(value=None, cid="tyler-cameron", sub=A):
    row = {"sk": f"PERF#{cid}#1#USER#{sub}"}
    if value is None:
        row["forfeit"] = True
    else:
        row["value"] = Decimal(value)
    return row


def three(**over):
    return perf(**{CARRIE: 7, DEREK: 8, BRUNO: 9, **over})


def test_three_judge_panel():
    (row,) = errors(PANEL, [three()], [score(6)])[A]
    assert row["paddle"] == 6
    assert row["panelMean"] == 8
    assert row["error"] == 2
    assert row["judges"] == {CARRIE: 1, DEREK: 2, BRUNO: 3}


def test_two_judge_panel_skips_the_absent_judge():
    p = perf(**{CARRIE: 6, DEREK: 8})
    (row,) = errors([CARRIE, DEREK], [p], [score(8)])[A]
    assert row["error"] == 1
    assert row["judges"] == {CARRIE: 2, DEREK: 0}


def test_four_judge_panel_counts_the_guest_as_their_own_judge():
    p = perf(**{CARRIE: 8, DEREK: 8, BRUNO: 9, GUEST: 10})
    (row,) = errors([*PANEL, GUEST], [p], [score(9)])[A]
    assert row["panelMean"] == 8.75
    assert row["error"] == 0.25
    assert row["judges"][GUEST] == 1


def test_half_point_judges():
    p = perf(**{CARRIE: 7.5, DEREK: 8, BRUNO: 8.5})
    (row,) = errors(PANEL, [p], [score(7)])[A]
    assert row["error"] == 1
    assert row["judges"] == {CARRIE: 0.5, DEREK: 1, BRUNO: 1.5}


def test_any_provisional_judge_excludes_the_performance():
    p = three()
    p["judges"][DEREK]["state"] = "provisional"
    assert errors(PANEL, [p], [score(8)]) == {}


def test_a_panel_judge_with_no_value_yet_excludes_the_performance():
    p = perf(**{CARRIE: 7, DEREK: 8})
    assert errors(PANEL, [p], [score(8)]) == {}


def test_a_judge_off_the_panel_is_ignored():
    p = three(**{GUEST: 1})
    (row,) = errors(PANEL, [p], [score(8)])[A]
    assert row["error"] == 0
    assert GUEST not in row["judges"]


def test_forfeit_is_excluded():
    assert errors(PANEL, [three()], [score()]) == {}


def test_bonus_points_never_move_the_error():
    p = three()
    p["bonus"] = Decimal(10)
    (row,) = errors(PANEL, [p], [score(8)])[A]
    assert row["error"] == 0


def test_an_unrateable_dance_is_excluded():
    p = {**three(), "rateable": False}
    assert errors(PANEL, [p], [score(8)]) == {}


def test_a_scored_team_dance_counts_like_any_other():
    team = "tyler-cameron+amber-glenn"
    p = {**three(), "sk": f"PERF#{team}#1", "contestants": team.split("+")}
    (row,) = errors(PANEL, [p], [score(9, cid=team)])[A]
    assert (row["key"], row["error"]) == (f"{team}#1", 1)


def test_a_score_with_no_performance_row_yet_is_excluded():
    assert errors(PANEL, [], [score(8)]) == {}


def test_errors_are_grouped_by_owner():
    rows = errors(PANEL, [three()], [score(8), score(10, sub="sub-b")])
    assert rows[A][0]["error"] == 0
    assert rows["sub-b"][0]["error"] == 2


def test_summary_mae_overall_and_per_judge_across_panels():
    three_night = errors(PANEL, [three()], [score(6)])[A]
    two_night = errors([CARRIE, DEREK], [perf(**{CARRIE: 6, DEREK: 8})], [score(8)])[A]
    s = summary(three_night + two_night)
    assert s["count"] == 2
    assert s["mae"] == 1.5
    assert s["judges"] == {
        CARRIE: {"count": 2, "mae": 1.5},
        DEREK: {"count": 2, "mae": 1},
        BRUNO: {"count": 1, "mae": 3},
    }


def test_summary_of_nothing():
    assert summary([]) == {"count": 0, "mae": None, "judges": {}}
