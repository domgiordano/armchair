import json
from pathlib import Path

from lambdas.common.keywords import keywords

SEASON = json.loads(
    (Path(__file__).parents[2] / "fixtures" / "seasons" / "dwts-35.json").read_text()
)


def test_unique_first_names_use_the_first_name():
    assert keywords({"a": "Amber Glenn", "b": "Tyler Cameron"}) == {"a": "Amber", "b": "Tyler"}


def test_shared_first_name_adds_the_last_initial():
    assert keywords({"a": "John Smith", "b": "John Doe", "c": "Ciara Miller"}) == {
        "a": "John S",
        "b": "John D",
        "c": "Ciara",
    }


def test_clash_is_case_insensitive():
    assert keywords({"a": "john Smith", "b": "JOHN Doe"}) == {"a": "john S", "b": "JOHN D"}


def test_suffix_is_not_the_last_name():
    names = {
        "a": "Harry Shum Jr.",
        "b": "Harry Potter III",
        "c": "Harry Jones Sr",
        "d": "Harry Ng II",
    }
    assert keywords(names) == {"a": "Harry S", "b": "Harry P", "c": "Harry J", "d": "Harry N"}


def test_spelling_variants_do_not_clash():
    assert keywords({"a": "Conner Leavitt", "b": "Connor Wood"}) == {"a": "Conner", "b": "Connor"}


def test_override_wins():
    names = {"a": "Conner Leavitt", "b": "Connor Wood"}
    assert keywords(names, {"b": "CONNORW"}) == {"a": "Conner", "b": "CONNORW"}


def test_s35_roster_gives_the_active_keywords():
    celebs = {
        c["id"]: next(m["name"] for m in c["members"] if m["role"] == "celebrity")
        for c in SEASON["contestants"]
    }
    active = {c["id"] for c in SEASON["contestants"] if "eliminatedEp" not in c}
    got = {cid: kw for cid, kw in keywords(celebs).items() if cid in active}
    assert got == {
        "tatyana-ali": "Tatyana",
        "tyler-cameron": "Tyler",
        "jenna-dewan": "Jenna",
        "ezra-frech": "Ezra",
        "amber-glenn": "Amber",
        "maura-higgins": "Maura",
        "ciara-miller": "Ciara",
        "jackson-olson": "Jackson",
        "guillermo-rodriguez": "Guillermo",
        "harry-shum-jr": "Harry",
        "julia-stiles": "Julia",
        "connor-wood": "Connor",
    }
