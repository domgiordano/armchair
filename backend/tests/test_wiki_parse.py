import json
from decimal import Decimal
from pathlib import Path

import pytest

from lambdas.common.wiki_parse import check, parse_week

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
    assert parse_week(text, case["expected"]["week"], aliases) == case["expected"]


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
