"""The cross-season person index seed_season writes, and the bio registry it reads."""

import json
from decimal import Decimal

import pytest

from scripts.find_bios import REGISTRY, day, facts, sentences
from scripts.find_headshots import everyone, fixtures
from scripts.seed_season import BIOS, SEASONS, main, people, write
from scripts.similar import category
from tests.conftest import CATALOG_TABLE

SEASONS_ALL = [json.loads(p.read_text(), parse_float=Decimal) for p in SEASONS.glob("*.json")]
BIO = {
    "title": "Derek Hough",
    "url": "https://en.wikipedia.org/wiki/Derek_Hough",
    "description": "American dancer",
    "extract": "Derek Hough is an American dancer.",
    "born": "1985-05-17",
    "died": None,
    "occupations": ["dancer"],
    "nationality": ["United States"],
}


@pytest.fixture(scope="module")
def rows():
    out = people(SEASONS_ALL, {"Derek Hough": BIO})
    return {(r["pk"], r["sk"]): r for r in out}


def person(rows, pid):
    return rows[(f"PERSON#dwts#{pid}", "META")]


def test_a_pro_who_later_judged_is_one_person_with_both_roles(rows):
    derek = person(rows, "derek-hough")
    assert derek["roles"] == ["judge", "pro"]
    pro = [e for e in derek["seasons"] if e["role"] == "pro"]
    assert pro and all(e["partners"] and e["couple"] for e in pro)
    assert any(e["role"] == "judge" and e["season"] == 35 for e in derek["seasons"])


def test_celebrities_are_keyed_by_their_contestant_id(rows):
    charli = person(rows, "charli-damelio")
    assert charli["name"] == "Charli D'Amelio"
    assert charli["seasons"][0]["couple"] == "charli-damelio"


def test_partners_point_at_each_other(rows):
    conner = person(rows, "conner-leavitt")
    (stint,) = conner["seasons"]
    assert {k: stint[k] for k in ("season", "role", "couple")} == {
        "season": 35,
        "role": "celebrity",
        "couple": "conner-leavitt",
    }
    assert [(p["id"], p["name"]) for p in stint["partners"]] == [("adele-zaikman", "Adele Zaikman")]
    adele = person(rows, "adele-zaikman")
    (conner,) = adele["seasons"][-1]["partners"]
    assert (conner["id"], conner["name"]) == ("conner-leavitt", "Conner Leavitt")


def test_bio_and_facts_come_from_the_registry(rows):
    derek = person(rows, "derek-hough")
    assert derek["bio"]["url"] == BIO["url"]
    assert derek["facts"]["born"] == "1985-05-17"
    assert person(rows, "conner-leavitt")["bio"] is None


def test_search_rows_carry_a_name_roles_image_and_season_numbers(rows):
    row = rows[("PEOPLE#dwts", "PERSON#bruno-tonioli")]
    assert row["roles"] == ["judge"]
    assert row["seasons"] == list(range(1, 36))
    assert row["headshot"] == "supplied/bruno-tonioli-ffd9a03e76.webp"
    # Exactly one search row per person.
    assert sum(pk == "PEOPLE#dwts" for pk, _ in rows) == sum(sk == "META" for _, sk in rows)


def test_nothing_gated_is_copied(rows):
    blob = json.dumps(list(rows.values()), default=str)
    for gated in ("eliminatedEp", "results", '"result"', "bonus"):
        assert gated not in blob
    # Season 35 is current: none of its couples has a place yet.
    current = [
        e for (_, sk), r in rows.items() if sk == "META" for e in r["seasons"] if e["season"] == 35
    ]
    assert current and not any("place" in e for e in current)


def places_in(rows, season):
    return {
        r["name"]: e["place"]
        for (_, sk), r in rows.items()
        if sk == "META"
        for e in r["seasons"]
        if e["season"] == season and e["role"] == "celebrity" and "place" in e
    }


def test_a_finished_season_carries_each_couples_place(rows):
    s1 = places_in(rows, 1)
    assert s1["Kelly Monaco"] == 1 and s1["John O'Hurley"] == 2
    assert s1["Trista Sutter"] == 6
    # Out the same night, so tied: Baron Davis and Corey Feldman were 13th of 14.
    s34 = places_in(rows, 34)
    assert s34["Baron Davis"] == s34["Corey Feldman"] == 13
    assert s34["Robert Irwin"] == 1 and s34["Elaine Hendrix"] == 5
    # A finalist with a blank Result cell took the place after the named ones.
    assert places_in(rows, 10)["Erin Andrews"] == 3
    winners = [n for n in range(1, 35) if n != 9]
    assert [sorted(places_in(rows, n).values()).count(1) for n in winners] == [1] * len(winners)
    stint = next(e for e in person(rows, "robert-irwin")["seasons"] if e["season"] == 34)
    assert stint["cast"] == 14
    pro = next(e for e in person(rows, "witney-carson")["seasons"] if e["season"] == 34)
    assert pro["place"] == 1


def test_partners_carry_their_headshot(rows):
    s8 = next(e for e in person(rows, "maksim-chmerkovskiy")["seasons"] if e["season"] == 8)
    (denise,) = s8["partners"]
    assert denise["headshot"]["image"].startswith("denise-richards")


@pytest.mark.parametrize(
    ("bio", "want"),
    [
        (
            {"description": "American actor & singer (born 1989)", "occupations": ["singer"]},
            "Actor",
        ),
        (
            {"description": "American singer, member of Backstreet Boys", "occupations": []},
            "Musician",
        ),
        ({"description": "American figure skater (born 1999)", "occupations": []}, "Athlete"),
        ({"description": None, "occupations": ["comedian"]}, "Comedian"),
        ({"description": "American science communicator", "occupations": ["engineer"]}, None),
        (None, None),
    ],
)
def test_category_reads_the_bio(bio, want):
    assert category(bio) == want


def test_similar_celebrities_share_a_field_a_cast_or_a_finish():
    bios = json.loads(BIOS.read_text())
    rows = {(r["pk"], r["sk"]): r for r in people(SEASONS_ALL, bios)}
    amber = person(rows, "amber-glenn")
    assert amber["category"] == "Athlete"
    similar = amber["similar"]
    assert 0 < len(similar) <= 6
    assert all(s["id"] != "amber-glenn" for s in similar)
    # Fellow athletes from her own cast come first.
    assert similar[0]["reasons"] == ["category", "cast"] and similar[0]["season"] == 35
    # Current-season finishes aren't known, so none of hers is "finish".
    assert not any("finish" in s["reasons"] for s in similar)
    assert "similar" not in person(rows, "derek-hough")


def test_seeding_writes_both_kinds_and_reseeding_is_safe(aws):
    table = aws.Table(CATALOG_TABLE)
    index = people(SEASONS_ALL, {})
    write(table, index)
    write(table, index)
    item = table.get_item(Key={"pk": "PERSON#dwts#derek-hough", "sk": "META"})["Item"]
    assert item["roles"] == ["judge", "pro"]
    found = table.query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": "PEOPLE#dwts"}
    )
    assert found["Count"] == len(index) // 2


def test_dry_run_reads_the_registry_and_writes_nothing(capsys):
    main(["dwts-35", "--dry-run"])
    assert "people: " in capsys.readouterr().out


def test_every_fixture_name_is_in_the_bio_registry():
    registry = json.loads(REGISTRY.read_text())
    assert REGISTRY == BIOS
    names = {p["name"] for path in fixtures() for p in everyone(json.loads(path.read_text()))}
    assert names <= set(registry)
    for bio in filter(None, registry.values()):
        assert bio["url"].startswith("https://en.wikipedia.org/wiki/")
        assert bio["extract"]


@pytest.mark.parametrize(
    ("extract", "want"),
    [
        ("One. Two. Three. Four.", "One. Two. Three."),
        ("Dr. Oz is a doctor. He hosts a show.", "Dr. Oz is a doctor. He hosts a show."),
        ("Born in the U.S. in 1980. She sings.", "Born in the U.S. in 1980. She sings."),
        ("J. R. Martinez is an actor. He won.", "J. R. Martinez is an actor. He won."),
        ("Short. " + "X" * 500 + ".", "Short."),
        ("x" * 500 + ".", "x" * 500 + "."),
    ],
)
def test_sentences(extract, want):
    assert sentences(extract) == want


def test_facts_keep_known_labels_in_order():
    def value(qid):
        return {"mainsnak": {"snaktype": "value", "datavalue": {"value": {"id": qid}}}}

    def time(stamp, precision):
        return [
            {
                "mainsnak": {
                    "snaktype": "value",
                    "datavalue": {"value": {"time": stamp, "precision": precision}},
                }
            }
        ]

    item = {
        "claims": {
            "P569": time("+1985-05-17T00:00:00Z", 11),
            "P106": [value("Q1"), value("Q2"), value("Q9"), value("Q3"), value("Q4")],
            "P27": [value("Q30")],
        }
    }
    names = {"Q1": "dancer", "Q2": "actor", "Q3": "singer", "Q4": "judge", "Q30": "United States"}
    assert facts(item, names) == {
        "born": "1985-05-17",
        "died": None,
        "occupations": ["dancer", "actor", "singer"],
        "nationality": ["United States"],
    }


@pytest.mark.parametrize(
    ("precision", "want"), [(11, "1985-05-17"), (10, "1985-05"), (9, "1985"), (8, None)]
)
def test_day_is_as_precise_as_the_claim(precision, want):
    assert day({"time": "+1985-05-17T00:00:00Z", "precision": precision}) == want
