from decimal import Decimal

import pytest

from lambdas.common import claude, writeups

URL = "https://www.goldderby.com/reality-tv/2026/recap/"
PEOPLE = "https://people.com/recap-123"
PANEL = ["carrie-ann-inaba", "derek-hough", "bruno-tonioli"]
JUDGES = {
    "carrie-ann-inaba": "Carrie Ann Inaba",
    "derek-hough": "Derek Hough",
    "bruno-tonioli": "Bruno Tonioli",
}
CONTESTANTS = {
    "amber-glenn": {
        "members": [
            {"name": "Amber Glenn", "role": "celebrity"},
            {"name": "Pasha Pashkov", "role": "pro"},
        ]
    },
    "julia-stiles": {
        "members": [
            {"name": "Julia Stiles", "role": "celebrity"},
            {"name": "Ezra Sosa", "role": "pro"},
        ]
    },
}
EXCERPT = (
    "Amber Glenn and pro partner Pasha Pashkov\n"
    "Performance: Foxtrot to Hold the Line by Toto\n"
    "Carrie Ann's comments: \"I'm seeing true growth.\" It was poetic.\n"
    'Bruno\'s comments: "Like a glass of the finest champagne."'
)


def perf(values=(8, 8, 8)) -> dict:
    return {
        "sk": "PERF#amber-glenn#1",
        "contestants": ["amber-glenn"],
        "style": "Foxtrot",
        "song": '"Hold the Line" - Toto',
        "judges": {j: {"value": Decimal(v), "state": "confirmed"} for j, v in zip(PANEL, values)},
    }


def facts(values=(8, 8, 8)) -> dict:
    return writeups.facts(perf(values), PANEL, CONTESTANTS, JUDGES, [(URL, EXCERPT)])


GOOD = {
    "key": "amber-glenn#1",
    "summary": "Amber and Pasha danced a smooth foxtrot with an icy elegance. Her frame held up through the turns.",
    "judges": [
        {
            "judge": "carrie-ann-inaba",
            "paraphrase": "Saw real growth, called it poetic.",
            "quote": "I'm seeing true growth",
        },
        {
            "judge": "bruno-tonioli",
            "paraphrase": "Compared it to fine champagne.",
            "quote": "the finest champagne",
        },
    ],
    "highlights": ["Icy elegance", "Clean frame"],
    "sources": [URL],
}


def test_request_offers_the_strict_tool_with_closed_enums():
    body = writeups.request([facts()], PANEL, 3, "Yacht Rock")
    assert body["model"] == claude.MODEL
    assert body["tool_choice"] == {"type": "auto"}
    assert body["output_config"] == {"effort": claude.EFFORT}
    tool = body["tools"][0]
    assert tool["strict"] is True
    item = tool["input_schema"]["properties"]["writeups"]["items"]["properties"]
    assert item["key"]["enum"] == ["amber-glenn#1"]
    assert item["judges"]["items"]["properties"]["judge"]["enum"] == PANEL
    assert item["sources"]["items"]["enum"] == [URL]
    text = body["messages"][0]["content"]
    assert "Week 3, Yacht Rock night" in text
    assert "Carrie Ann Inaba 8, Derek Hough 8, Bruno Tonioli 8; total 24 of 30" in text
    assert EXCERPT in text
    assert "Never mention a number" in body["system"]


def test_a_clean_writeup_survives_intact():
    got, dropped = writeups.validate({"writeups": [GOOD]}, [facts()])
    assert dropped == 0
    assert got["amber-glenn#1"] == {
        "summary": GOOD["summary"],
        "judges": [
            {
                "judge": "carrie-ann-inaba",
                "text": "Saw real growth, called it poetic.",
                "quote": "I'm seeing true growth",
            },
            {
                "judge": "bruno-tonioli",
                "text": "Compared it to fine champagne.",
                "quote": "the finest champagne",
            },
        ],
        "highlights": ["Icy elegance", "Clean frame"],
        "sources": [URL],
    }


def with_(**fields) -> dict:
    return {"writeups": [{**GOOD, **fields}]}


def test_a_wrong_score_drops_the_field_and_a_right_one_stays():
    got, dropped = writeups.validate(
        with_(
            summary="They earned a 27 for the foxtrot.",
            highlights=["Straight 8s", "A 9 from Bruno"],
        ),
        [facts()],
    )
    w = got["amber-glenn#1"]
    assert w["summary"] is None
    assert w["highlights"] == ["Straight 8s"]
    assert dropped == 2


def test_spoken_scores_and_a_false_perfect_score_are_caught():
    got, _ = writeups.validate(
        with_(
            summary="Derek gave her a ten.",
            highlights=["Perfect score", "Nines across the board"],
        ),
        [facts()],
    )
    w = got["amber-glenn#1"]
    assert w["summary"] is None and w["highlights"] == []
    got, _ = writeups.validate(with_(highlights=["Perfect score"]), [facts((10, 10, 10))])
    assert got["amber-glenn#1"]["highlights"] == ["Perfect score"]


def test_decades_and_years_are_not_scores():
    got, _ = writeups.validate(
        with_(summary="A 1980s soft-rock foxtrot with a '90s twist."), [facts()]
    )
    assert got["amber-glenn#1"]["summary"].startswith("A 1980s")


def test_results_and_other_couples_never_ride_along():
    got, dropped = writeups.validate(
        with_(
            summary="She topped the leaderboard again.",
            highlights=["Safe from elimination", "Better than Julia Stiles", "Beat Stiles"],
        ),
        [facts()],
    )
    w = got["amber-glenn#1"]
    assert w["summary"] is None and w["highlights"] == []
    assert dropped == 4


def test_a_quote_not_in_the_sources_or_too_long_is_dropped_but_the_paraphrase_stays():
    judges = [
        {
            "judge": "carrie-ann-inaba",
            "paraphrase": "Loved the growth.",
            "quote": "The best foxtrot of the season",
        },
        {
            "judge": "bruno-tonioli",
            "paraphrase": "Champagne.",
            "quote": "Like a glass of the finest champagne",
        },
    ]
    got, dropped = writeups.validate(with_(judges=judges), [facts()])
    assert got["amber-glenn#1"]["judges"] == [
        {"judge": "carrie-ann-inaba", "text": "Loved the growth.", "quote": None},
        {"judge": "bruno-tonioli", "text": "Champagne.", "quote": None},
    ]
    assert dropped == 2


def test_quotes_match_through_curly_quotes_and_case():
    judges = [
        {"judge": "carrie-ann-inaba", "paraphrase": "Growth.", "quote": "“I’m Seeing True Growth”"}
    ]
    got, _ = writeups.validate(with_(judges=judges), [facts()])
    assert got["amber-glenn#1"]["judges"][0]["quote"] == "I’m Seeing True Growth"


def test_a_judge_off_the_panel_or_twice_is_dropped():
    judges = [
        GOOD["judges"][0],
        {**GOOD["judges"][0], "paraphrase": "Again."},
        {"judge": "len-goodman", "paraphrase": "Lovely.", "quote": None},
    ]
    got, dropped = writeups.validate(with_(judges=judges), [facts()])
    assert [j["judge"] for j in got["amber-glenn#1"]["judges"]] == ["carrie-ann-inaba"]
    assert dropped == 2


def test_long_summaries_and_chips_are_dropped_and_chips_capped_at_three():
    got, _ = writeups.validate(
        with_(
            summary="One. Two is fine. Three. Four. Five. Six.",
            highlights=["Ice", "Frame", "Glide", "Fourth chip", "x" * 40],
        ),
        [facts()],
    )
    w = got["amber-glenn#1"]
    assert w["summary"] is None
    assert w["highlights"] == ["Ice", "Frame", "Glide"]


def test_every_asked_key_gets_an_entry_and_unknown_keys_are_ignored():
    raw = {"writeups": [{**GOOD, "key": "someone-else#1"}]}
    got, _ = writeups.validate(raw, [facts()])
    assert got == {
        "amber-glenn#1": {"summary": None, "judges": [], "highlights": [], "sources": []}
    }


def test_sources_fall_back_to_what_was_given():
    got, _ = writeups.validate(with_(sources=[]), [facts()])
    assert got["amber-glenn#1"]["sources"] == [URL]


def test_request_leaves_effort_out_when_unset(monkeypatch):
    monkeypatch.setattr(claude, "EFFORT", "")
    assert "output_config" not in writeups.request([facts()], PANEL, 3, None)


def test_an_answer_without_the_tool_call_fails():
    # tool_choice is auto, so the model can answer in text instead.
    text_only = {"stop_reason": "end_turn", "content": [{"type": "text", "text": "Here you go"}]}
    with pytest.raises(claude.ClaudeError, match="no record_writeups tool call"):
        claude.tool_input(text_only, writeups.TOOL)


def test_cost_and_estimate(monkeypatch):
    monkeypatch.setattr(claude, "PRICE", (3.00, 15.00))
    assert claude.cost({"input_tokens": 1_000_000, "output_tokens": 100_000}) == 3.0 + 1.5
    body = writeups.request([facts()], PANEL, 3, None)
    # Every max_tokens output token is in the ceiling.
    assert claude.estimate(body) > writeups.MAX_TOKENS * claude.PRICE[1] / 1_000_000


def test_a_guest_makes_a_four_judge_dance_out_of_40():
    # S34 week 7, Alix and Val: Cheryl Burke guest-judging in the third seat.
    panel = ["carrie-ann-inaba", "derek-hough", "cheryl-burke", "bruno-tonioli"]
    judges = {**JUDGES, "cheryl-burke": "Cheryl Burke"}
    p = {
        **perf(),
        "judges": {
            j: {"value": Decimal(v), "state": "confirmed"} for j, v in zip(panel, (10, 10, 9, 10))
        },
    }
    f = writeups.facts(p, panel, CONTESTANTS, judges, [(URL, EXCERPT)])
    assert (f["total"], f["max"]) == (39, 40)
    assert f["judges"][2] == ("cheryl-burke", "Cheryl Burke", 9)
    prompt = writeups.request([f], panel, 7, "Halloween")["messages"][0]["content"]
    assert "Cheryl Burke 9, Bruno Tonioli 10; total 39 of 40" in prompt

    assert writeups.flaw("It earned 39 out of 40.", f) is None
    assert writeups.flaw("It earned 38.", f) == "names a number other than this dance's scores"
    assert writeups.flaw("A perfect 40 for Alix.", f) == "calls a score perfect that wasn't"
