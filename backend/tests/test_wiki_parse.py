import json
from decimal import Decimal
from pathlib import Path

import pytest

from lambdas.common.wiki_parse import check, parse_week, week_format

FIXTURES = Path(__file__).parents[2] / "fixtures"
GOLDEN = json.loads((FIXTURES / "wiki-golden.json").read_text())

PAGE = """== Weekly scores ==
''Individual judges' scores in the charts below (given in parentheses) are listed in this order from left to right: [[Carrie Ann Inaba]], [[Derek Hough]], [[Bruno Tonioli]].''

=== Week 2: Test Night ===
{| class="wikitable"
|+Week 2
! scope="col" | Couple
! scope="col" | Scores<ref name="x">{{cite web |title=t}}</ref>
|-
! scope="row" | {{nowrap|Amber}} & Pasha{{dagger}}
| %s
|}
"""
ALIASES = {"Amber": "amber-glenn"}


@pytest.mark.parametrize("case", GOLDEN["cases"], ids=lambda c: c["name"])
def test_golden(case):
    text = (FIXTURES / "wiki" / case["fixture"]).read_text()
    aliases = GOLDEN["aliases"][case["aliases"]]
    week = parse_week(text, case["expected"]["week"], aliases)
    # The golden predates style, song, result and order; test_s35_week_3_columns covers those.
    for p in week["performances"]:
        del p["style"], p["song"], p["result"], p["order"]
    del week["segments"]
    assert week == case["expected"]


# Hand-transcribed from the week 3 table in s35-1377681547.wikitext.
S35_WK3_COLUMNS = [
    ("Foxtrot", '"Hold the Line" — Toto', "Safe"),
    ("Salsa", '"I Can\'t Go for That (No Can Do)" — Hall & Oates', "Safe"),
    ("Foxtrot", '"Escape (The Piña Colada Song)" — Rupert Holmes', "Safe"),
    ("Quickstep", '"Maneater" — Hall & Oates', "Safe"),
    ("Jive", '"You Make My Dreams (Come True)" — Hall & Oates', "Safe"),
    ("Foxtrot", '"What a Fool Believes" — The Doobie Brothers', "Eliminated"),
    ("Quickstep", '"Turn Your Love Around" — George Benson', "Safe"),
    ("Cha-cha-cha", '"Never Too Much" — Luther Vandross', "Safe"),
    ("Paso doble", '"Easy Lover" — Phillip Bailey & Phil Collins', "Safe"),
    ("Foxtrot", '"Everywhere" — Fleetwood Mac', "Safe"),
    ("Samba", '"Africa" — Toto', "Safe"),
    ("Jive", '"Still the One" — Orleans', "Safe"),
    ("Foxtrot", '"Just the Two of Us" — Grover Washington Jr. feat. Bill Withers', "Safe"),
]


def test_s35_week_3_columns():
    text = (FIXTURES / "wiki" / "s35-1377681547.wikitext").read_text()
    week = parse_week(text, 3, GOLDEN["aliases"]["s35"])
    got = [(p["style"], p["song"], p["result"]) for p in week["performances"]]
    assert got == S35_WK3_COLUMNS


def test_pre_show_row_has_no_columns():
    text = (FIXTURES / "wiki" / "s35-1377681547.wikitext").read_text()
    week = parse_week(text, 4, GOLDEN["aliases"]["s35"])
    assert {(p["style"], p["song"], p["result"]) for p in week["performances"]} == {
        (None, None, None)
    }


def test_music_column_matched_by_substring_and_missing_result_is_none():
    text = (FIXTURES / "wiki" / "s34-1375977389.wikitext").read_text()
    wk1 = parse_week(text, 1, GOLDEN["aliases"]["s34"])
    assert all(p["result"] is None for p in wk1["performances"])
    wk10 = parse_week(text, 10, GOLDEN["aliases"]["s34"])
    assert all(p["song"] for p in wk10["performances"])


def test_accepts_a_clean_row_with_wrappers_stripped():
    week = parse_week(PAGE % "24 (8, 8, 8)", 2, ALIASES)
    assert week["rejected"] == []
    assert week["performances"][0]["contestants"] == ["amber-glenn"]
    assert week["performances"][0]["judges"] == [8, 8, 8]


@pytest.mark.parametrize(
    ("cell", "reason"),
    [
        ("25 (8, 8, 8)", "judge values sum to 24, total is 25"),
        ("16 (8, 8)", "2 judge values for a panel of 3"),
        ("27 (11, 8, 8)", "judge value outside 1-10 in 0.5 steps"),
        ("23.3 (7.3, 8, 8)", "judge value outside 1-10 in 0.5 steps"),
        ("16 (0, 8, 8)", "judge value outside 1-10 in 0.5 steps"),
        ("24/30", "unparseable score '24/30'"),
        ("16 (8, 8, )", "unparseable score '16 (8, 8, )'"),
        ("3", "bonus row with no dance to attach to"),
    ],
)
def test_rejects_bad_rows(cell, reason):
    week = parse_week(PAGE % cell, 2, ALIASES)
    assert week["performances"] == []
    assert week["rejected"] == [{"night": 1, "row": "Amber & Pasha", "reason": reason}]


def test_rejects_unknown_couple():
    week = parse_week(PAGE % "24 (8, 8, 8)", 2, {"Amber G.": "amber-glenn"})
    assert week["rejected"] == [{"night": 1, "row": "Amber & Pasha", "reason": "unknown couple"}]


def test_half_points_pass():
    assert check(Decimal("20.5"), [Decimal("6.5"), Decimal(7), Decimal(7)], ["a", "b", "c"]) is None


def test_missing_week_is_none():
    assert parse_week(PAGE % "", 12, ALIASES) is None


def test_commented_out_week_is_none():
    # S35 keeps weeks 5-9 scaffolded inside an HTML comment until they air.
    text = (FIXTURES / "wiki" / "s35-1377681547.wikitext").read_text()
    assert "=== Week 5: Super Bowl Night ===" in text
    assert parse_week(text, 5, GOLDEN["aliases"]["s35"]) is None


def table(rows: str, caption: str = "", extra: str = "") -> str:
    head = f"|+{caption}\n" if caption else ""
    return (
        f'{{| class="wikitable"\n{head}! Couple !! Scores{extra}\n'
        + "".join(f"|-\n! {couple}\n| {cells}\n" for couple, cells in rows)
        + "|}\n"
    )


ORDER = "''Individual judges' scores are listed in this order from left to right: {}.''\n"


def week_page(body: str) -> str:
    return (
        "== Weekly scores ==\n"
        + ORDER.format("Carrie Ann Inaba, Len Goodman, Bruno Tonioli")
        + "=== Week 7 ===\n"
        + body
    )


def test_order_line_between_tables_applies_to_the_later_table_only():
    # S11 week 7: team dances by the usual three, then a per-row guest judge joins.
    page = week_page(
        table([("Amber & Pasha", "24 (8, 8, 8)")])
        + ORDER.format("Guest judge, Carrie Ann Inaba, Len Goodman, Bruno Tonioli")
        + table([("Amber & Pasha", "35 (10, 9, 8, 8)")])
    )
    week = parse_week(page, 7, ALIASES)
    assert week["rejected"] == []
    assert [(p["night"], p["n"], len(p["panel"])) for p in week["performances"]] == [
        (1, 1, 3),
        (1, 2, 4),
    ]
    assert week["performances"][1]["panel"][0] == "Guest judge"


def test_night_only_judge_leaves_the_panel_after_that_night():
    # S25 week 10: "[[Julianne Hough]] (Night 1 only)".
    page = week_page(
        ORDER.format(
            "Carrie Ann Inaba, Len Goodman, [[Julianne Hough]] (Night 1 only), Bruno Tonioli"
        )
        + ";Night 1\n"
        + table([("Amber & Pasha", "36 (9, 9, 9, 9)")])
        + ";Night 2\n"
        + table([("Amber & Pasha", "30 (10, 10, 10)")])
    )
    week = parse_week(page, 7, ALIASES)
    assert week["rejected"] == []
    assert [p["panel"] for p in week["performances"]] == [
        ["Carrie Ann Inaba", "Len Goodman", "Julianne Hough", "Bruno Tonioli"],
        ["Carrie Ann Inaba", "Len Goodman", "Bruno Tonioli"],
    ]
    assert week["panel"] == week["performances"][0]["panel"]


def test_unnumbered_night_labels_count_up():
    # S30 week 4: ";Heroes Night" then ";Villains Night".
    page = week_page(
        ";Heroes Night\n"
        + table([("Amber & Pasha", "24 (8, 8, 8)")])
        + ";Villains Night\n"
        + table([("Amber & Pasha", "27 (9, 9, 9)")])
    )
    assert [p["night"] for p in parse_week(page, 7, ALIASES)["performances"]] == [1, 2]


def test_inline_bonus_after_the_score():
    # S30 week 4: "30 (8, 7, 8, 7) + 2" for winning the Mickey Dance Challenge.
    week = parse_week(
        week_page(table([("Amber & Pasha", "{{nowrap|24 (8, 8, 8) + 2}}")])), 7, ALIASES
    )
    (perf,) = week["performances"]
    assert (perf["total"], perf["bonus"]) == (24, 2)


def test_x_is_a_judge_sitting_out():
    week = parse_week(week_page(table([("Amber & Pasha", "20 (10, '''X''', 10)")])), 7, ALIASES)
    assert week["rejected"] == []
    assert week["performances"][0]["judges"] == [10, None, 10]
    assert check(Decimal(20), [Decimal(10), None, Decimal(9)], ["a", "b", "c"]) == (
        "judge values sum to 19, total is 20"
    )


def test_no_scores_received_is_unscored_not_rejected():
    week = parse_week(PAGE % "''No scores<br>received''", 2, ALIASES)
    assert (week["performances"], week["rejected"]) == ([], [])
    assert week["unscored"] == [{"night": 1, "row": "Amber & Pasha"}]


PAIR = {"Amber": "amber-glenn", "Jenna": "jenna-dewan"}
DANCES = [("Amber & Pasha", "24 (8, 8, 8)", "Tango"), ("Jenna & Val", "27 (9, 9, 9)", "Jive")]


def dance_table(rows: list[tuple[str, str, str]]) -> str:
    return (
        '{| class="wikitable"\n! Couple !! Scores !! Dance\n'
        + "".join(f"|-\n! {couple}\n| {score}\n| {dance}\n" for couple, score, dance in rows)
        + "|}\n"
    )


def test_a_marathon_run_before_the_dances_still_gives_its_points():
    marathon = [("Amber & Pasha", "4", "Hustle Marathon"), ("Jenna & Val", "2", "Hustle Marathon")]
    week = parse_week(week_page(dance_table(marathon) + dance_table(DANCES)), 7, PAIR)
    assert week["rejected"] == []
    assert [(p["contestants"], p["n"], p["bonus"]) for p in week["performances"]] == [
        (["amber-glenn"], 1, 4),
        (["jenna-dewan"], 1, 2),
    ]
    assert [(s["label"], s["points"]) for s in week["segments"]] == [
        ("Hustle Marathon", 4),
        ("Hustle Marathon", 2),
    ]


def test_a_marathon_row_naming_every_couple_is_no_team_dance():
    everyone = ("Amber & Pasha<br>Jenna & Val", "", "Endurance Marathon")
    week = parse_week(week_page(dance_table([*DANCES, everyone])), 7, PAIR)
    assert [p["contestants"] for p in week["performances"]] == [["amber-glenn"], ["jenna-dewan"]]
    (segment,) = week["segments"]
    assert segment["contestants"] == ["amber-glenn", "jenna-dewan"]
    assert (segment["points"], segment["text"]) == (None, None)


def test_a_marathon_place_in_words_is_text_not_a_rejection():
    place = ("Amber & Pasha", "1st", "Swing Marathon")
    week = parse_week(week_page(dance_table([DANCES[0], place])), 7, PAIR)
    assert week["rejected"] == []
    assert week["performances"][0]["bonus"] is None
    assert (week["segments"][0]["points"], week["segments"][0]["text"]) == (None, "1st")


# S35 week 9's shape: a pair filled in, a pair still "TBA & TBA" with no result.
DANCE_OFFS = """{| class="wikitable"
|+Dance-offs
! Couple
! Dance
! Result
|-
! Amber & Pasha
| rowspan="2" | Salsa
| '''Winners'''
|-
! Jenna & Val
| Losers
|-
! TBA & TBA
| rowspan="2" |
|
|-
! TBA & TBA
|
|}
"""


@pytest.mark.parametrize(("prose", "points"), [("three extra points", 3), ("extra points", None)])
def test_dance_off_winners_get_the_stated_points(prose, points):
    intro = f"Each couple performed one dance and a dance-off for {prose}.\n"
    week = parse_week(week_page(intro + dance_table(DANCES) + DANCE_OFFS), 7, PAIR)
    assert week["rejected"] == []
    assert [(s["label"], s["contestants"], s["points"], s["text"]) for s in week["segments"]] == [
        ("Dance-off", ["amber-glenn"], points, "Winners"),
        ("Dance-off", ["jenna-dewan"], None, "Losers"),
    ]
    assert [p["bonus"] for p in week["performances"]] == [points, None]


CHART = """== Dance chart ==
* Weeks 1–7: One unlearned dance
* Week 9 (Quarterfinals): One unlearned dance & dance-off
<!--
* Week 10: Two dances
-->
"""


@pytest.mark.parametrize(
    ("week", "want"),
    [(3, "One unlearned dance"), (9, "One unlearned dance & dance-off"), (10, None)],
)
def test_week_format_reads_the_dance_chart(week, want):
    assert week_format(CHART, week, 1) == want


def test_a_night_only_format_line_is_that_nights():
    # S31: "* Week 5 (Night 2): One unlearned dance & dance marathon".
    chart = "* Week 5 (Night 2): Dance & dance marathon\n* Week 5: One unlearned dance\n"
    assert week_format(chart, 5, 2) == "Dance & dance marathon"
    assert week_format(chart, 5, 1) == "One unlearned dance"
