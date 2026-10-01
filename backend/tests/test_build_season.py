from pathlib import Path

import pytest

from scripts.build_season import build, increasing, match, numbered, words

WIKI = Path(__file__).parents[2] / "fixtures" / "wiki"
SHOT = {"file": "x.jpg", "author": "a", "license": "CC BY 4.0", "sourceUrl": "u"}


def season(n: int) -> dict:
    (path,) = WIKI.glob(f"s{n}-*.wikitext")
    rev = {"revid": int(path.stem.split("-")[1]), "timestamp": "t", "text": path.read_text()}
    fixture, _ = build(n, rev, {"Bruno Tonioli": SHOT, "Kelly Monaco": SHOT})
    return fixture


@pytest.fixture(scope="module")
def s1():
    return season(1)


@pytest.fixture(scope="module")
def s8():
    return season(8)


def test_s1_roster_episodes_and_eliminations(s1):
    assert (s1["season"], s1["year"], s1["revid"], s1["current"]) == (1, 2005, 1375742773, False)
    assert s1["defaultPanel"] == ["carrie-ann-inaba", "len-goodman", "bruno-tonioli"]
    assert [(e["ep"], e["week"], e["night"], e["airDate"]) for e in s1["episodes"]] == [
        (1, 1, 1, "2005-06-01"),
        (2, 2, 1, "2005-06-08"),
        (3, 3, 1, "2005-06-15"),
        (4, 4, 1, "2005-06-22"),
        (5, 5, 1, "2005-06-29"),
        (6, 6, 1, "2005-07-06"),
    ]
    out = {c["id"]: c["eliminatedEp"] for c in s1["contestants"]}
    assert out == {
        "trista-sutter": 2,
        "evander-holyfield": 3,
        "rachel-hunter": 4,
        "joey-mcintyre": 5,
        "john-ohurley": None,
        "kelly-monaco": None,
    }
    joey = next(c for c in s1["contestants"] if c["id"] == "joey-mcintyre")
    assert joey["aliases"] == ["Joey"]
    assert [m["name"] for m in joey["members"]] == ["Joey McIntyre", "Ashly DelGrosso"]


def test_s1_group_dance_is_skipped_with_its_reason(s1):
    assert s1["skipped"] == [
        {
            "week": 4,
            "night": 1,
            "row": "Joey & Ashly\nJohn & Charlotte\nKelly & Alec\nRachel & Jonathan",
            "reason": "no scores received",
        }
    ]
    ep4 = s1["episodes"][3]
    assert ep4["rateableKeys"] == [
        "joey-mcintyre#1",
        "rachel-hunter#1",
        "john-ohurley#1",
        "kelly-monaco#1",
    ]
    assert ep4["performances"][1] == {
        "contestants": ["rachel-hunter"],
        "n": 1,
        "rateable": True,
        "total": 25,
        "judges": [7, 9, 9],
        "bonus": None,
        "style": "Samba",
        "song": '"Soul Bossa Nova" — Quincy Jones',
        "result": "Eliminated",
    }


def test_headshots_come_from_the_given_credits_by_name(s1):
    shots = {j["id"]: j["headshot"] for j in s1["judges"]}
    assert shots == {"carrie-ann-inaba": None, "len-goodman": None, "bruno-tonioli": SHOT}
    kelly = next(c for c in s1["contestants"] if c["id"] == "kelly-monaco")
    assert [m["headshot"] for m in kelly["members"]] == [SHOT, None]


def test_s8_dance_off_is_its_own_episode(s8):
    eps = [(e["week"], e["night"], e["airDate"]) for e in s8["episodes"]][:6]
    assert eps == [
        (1, 1, "2009-03-09"),
        (2, 1, "2009-03-16"),
        (2, 2, "2009-03-17"),
        (3, 1, "2009-03-23"),
        (3, 2, "2009-03-24"),
        (4, 1, "2009-03-30"),
    ]
    assert s8["episodes"][4]["rateableKeys"] == ["holly-madison#2", "denise-richards#2"]
    out = {c["id"]: c["eliminatedEp"] for c in s8["contestants"]}
    assert out["denise-richards"] == 5


def test_s8_pro_only_team_row_is_skipped_not_guessed(s8):
    assert {
        "week": 8,
        "night": 1,
        "row": "Chuck & Julianne\nLacey & Tony\nShawn & Mark",
        "reason": "unknown couple",
    } in s8["skipped"]


def test_s15_surname_columns_resolve_to_judges():
    s15 = season(15)
    assert s15["defaultPanel"] == ["carrie-ann-inaba", "len-goodman", "bruno-tonioli"]
    assert {
        "id": "paula-abdul",
        "name": "Paula Abdul",
        "aliases": ["Paula Abdul", "Abdul"],
        "headshot": None,
    } in s15["judges"]
    wk7 = next(e for e in s15["episodes"] if e["week"] == 7)
    emmitt = next(p for p in wk7["performances"] if p["contestants"] == ["emmitt-smith"])
    assert (emmitt["total"], emmitt["judges"], emmitt["bonus"]) == (27.5, [8.5, 9.5, 9.5], 7)


def test_s20_sat_out_judge_is_null_and_unpinned_dates_stay_null():
    s20 = season(20)
    wk9 = next(e for e in s20["episodes"] if e["week"] == 9)
    assert wk9["performances"][1]["judges"] == [10, 10, 10, None]
    assert wk9["rateableKeys"][:2] == ["rumer-willis#1", "rumer-willis#2"]
    assert wk9["dancesPerCouple"] == 2
    # "Season Premiere" names no week theme and the calendar count is off by the
    # dropped Spring Break special, so neither is guessed.
    dates = {e["week"]: e["airDate"] for e in s20["episodes"] if e["night"] == 1}
    assert (dates[1], dates[6], dates[7]) == (None, None, "2015-04-27")


def test_s31_guest_week_panel_is_five_judges():
    s31 = season(31)
    wk6 = next(e for e in s31["episodes"] if e["week"] == 6)
    assert wk6["panel"] == [
        "carrie-ann-inaba",
        "len-goodman",
        "michael-buble",
        "derek-hough",
        "bruno-tonioli",
    ]
    assert all("panel" not in p for p in wk6["performances"])


@pytest.mark.parametrize(
    ("header", "celebrity"),
    [
        ("Billy Ray", "Billy Ray Cyrus"),
        ("J.R.", "J. R. Martinez"),
        ("Helio", "Hélio Castroneves"),
        ("The Miz", 'Mike "The Miz" Mizanin'),
        ("Conner L.", "Conner Leavitt"),
    ],
)
def test_short_names_match_the_cast(header, celebrity):
    cast = [
        {"celebrity": celebrity, "pro": "Witney Carson"},
        {"celebrity": "Connor Wood", "pro": "Rylee Arnold"},
        {"celebrity": "Billy Dee Williams", "pro": "Emma Slater"},
    ]
    assert [c["celebrity"] for c in match(header, "Witney", cast)] == [celebrity]


def test_shared_first_name_is_settled_by_the_pro():
    cast = [
        {"celebrity": "Anna Delvey", "pro": "Ezra Sosa"},
        {"celebrity": "Anna Kournikova", "pro": "Val Chmerkovskiy"},
    ]
    assert [c["celebrity"] for c in match("Anna", "Val", cast)] == ["Anna Kournikova"]
    assert match("Nobody", "Val", cast) == []


def test_helpers():
    assert words("D. L. Hughley") == ["dl", "hughley"]
    assert numbered("Round 9 Results") == 9
    assert numbered("Episode 703A") == 3
    assert numbered("Performance Show: Week 2") == 2
    assert numbered("Latin Night") is None
    assert increasing([1, 5, 2, 3, 4]) == [1, 2, 3, 4]
