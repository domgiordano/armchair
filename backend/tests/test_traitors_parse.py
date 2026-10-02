from pathlib import Path

import pytest

from lambdas.common.traitors_parse import season

WIKI = Path(__file__).parents[2] / "fixtures" / "wiki"

# Hand-transcribed from each fixture: the episode in the banished player's Finish cell,
# the banished player, and the Vote row's counts. Nothing here comes from the parser.
ROUND_TABLES = {
    "traitors-us4-1376576846": [
        (2, "Porsha Williams", [10, 8, 4]),
        (3, "Donna Kelce", [18, 1, 1]),
        (4, "Tiffany Mitchell", [15, 2, 1]),
        (5, "Michael Rapaport", [11, 5]),
        (6, "Ron Funches", [6, 5, 4]),
        (7, "Lisa Rinna", [9, 2, 1, 1]),
        (8, "Candiace Dillard Bassett", [9, 1, 1]),
        (9, "Stephen Colletti", [5, 2, 2]),
        (10, "Natalie Anderson", [7, 1]),
        (11, "Johnny Weir", [3, 2]),
    ],
    "traitors-uk4-1374211799": [
        (2, "Judy Wilson", [16, 1, 1, 1, 1, 1]),
        (3, "Hugo Lodge", [10, 3, 2, 1, 1, 1, 1]),
        (4, "Ross Garshong", [6, 5, 3, 2, 1, 1]),
        (5, "Amanda Collier", [5, 5, 3, 1, 1, 1]),
        (6, "Fiona Hughes", [9, 4, 1]),
        (7, "Harriet Tyce", [10, 1, 1, 1]),
        (8, "Sam Little", [6, 2, 1, 1, 1]),
        (9, "Ellie Buckley", [4, 2, 2, 1]),
        (10, "Matthew Hyndman", [5, 3, 1]),
        (12, "James Baker", [3, 3]),
        (12, "Jade Scott", [3, 1, 1]),
    ],
    "traitors-ukc1-1378003069": [
        (3, "Niko Omilana", [10, 3, 2, 2, 1]),
        (3, "Tameka Empson", [4, 2, 2, 2, 1, 1, 1, 1, 1, 1]),
        (4, "Clare Balding", [7, 2, 2, 1, 1, 1]),
        (6, "Mark Bonnar", [4, 4, 2, 1, 1]),
        (6, "Stephen Fry", [4, 2, 2, 1, 1]),
        (7, "Jonathan Ross", [6, 1, 1]),
        (8, "Kate Garraway", [3, 2, 1]),
        (9, "Cat Burns", [3, 2]),
    ],
    "traitors-us5-1377883386": [
        (2, "Madeline Kostopulos", [13, 7, 1]),
        (4, "Arisa Thomas", [13, 5, 1]),
    ],
}


def parse(name: str) -> dict:
    return season((WIKI / f"{name}.wikitext").read_text())


@pytest.mark.parametrize("name", ROUND_TABLES)
def test_round_tables(name):
    done = [rt for rt in parse(name)["roundTables"] if rt["complete"]]
    assert [(rt["ep"], rt["banished"], rt["declared"]) for rt in done] == ROUND_TABLES[name]
    # The per-player cells have to reproduce the Vote row, or the names behind the counts are wrong.
    for rt in done:
        assert sorted(rt["firstVote"].values(), reverse=True) == rt["declared"]


def test_top_three_by_hand():
    us4 = {rt["ep"]: rt["firstVote"] for rt in parse("traitors-us4-1376576846")["roundTables"]}
    assert us4[2] == {"Porsha Williams": 10, "Donna Kelce": 8, "Michael Rapaport": 4}
    # Rob R.'s Dagger cell reads `Natalie (2x)`.
    assert us4[10] == {"Natalie Anderson": 7, "Tara Lipinski": 1}


def test_uk_dagger_footnote_counts_twice():
    uk4 = {rt["banished"]: rt for rt in parse("traitors-uk4-1374211799")["roundTables"]}
    assert uk4["Matthew Hyndman"]["firstVote"]["Matthew Hyndman"] == 5


def test_tie_revote_and_fate_are_one_round_table():
    uk4 = {rt["banished"]: rt for rt in parse("traitors-uk4-1374211799")["roundTables"]}
    james = uk4["James Baker"]
    assert [c["label"] for c in james["columns"]] == ["11", "11", "12"]
    assert james["fate"] is True
    assert james["firstVote"] == {"James Baker": 3, "Rachel Duffy": 3}


def test_partial_tally_is_not_complete():
    # 01:35 UTC on 9/25, mid-episode 4: Arisa's name is in, 7 of 19 votes are.
    rts = parse("traitors-us5-1376577733-partial")["roundTables"]
    arisa = next(rt for rt in rts if rt["banished"] == "Arisa Thomas")
    assert arisa["complete"] is False
    assert arisa["declared"] == []


def test_pending_round_table_has_no_result():
    pending = parse("traitors-us5-1377883386")["roundTables"][-1]
    assert (pending["ep"], pending["banished"], pending["complete"]) == (5, None, False)


def test_redirect_parses_to_nothing():
    s = parse("traitors-us5-1375764755-redirect")
    assert s["contestants"] == s["roundTables"] == s["episodes"] == []


def test_nights_and_winners():
    us4 = parse("traitors-us4-1376576846")
    assert [(m["name"], m["ep"]) for m in us4["murdered"]] == [
        ("Ian Terry", 2),
        ("Rob Cesternino", 3),
        ("Caroline Stanbury", 4),
        ("Monét X Change", 5),
        ('Yamil "Yam Yam" Arocho', 7),
        ("Colton Underwood", 8),
        ("Dorinda Medley", 9),
        ("Kristen Kish", 10),
        ("Mark Ballas", 11),
    ]
    assert us4["recruited"] == [{"name": "Eric Nam", "ep": 9}]
    assert us4["winners"] == ["Rob Rausch"]
    assert parse("traitors-uk4-1374211799")["winners"] == ["Rachel Duffy", "Stephen Libby"]

    nb = parse("traitors-us5-1377883386")
    assert [(m["name"], m["ep"]) for m in nb["murdered"]] == [
        ("Kim Daily", 2),
        ("Xavier Scruggs", 3),
        ("Logan Smith", 4),
    ]
    assert nb["recruited"] == [{"name": "Katie Fites", "ep": 3}]


def test_affiliations():
    cast = {p["name"]: p["affiliation"] for p in parse("traitors-us4-1376576846")["contestants"]}
    assert cast["Donna Kelce"] == ["Traitor"]  # "Secret Traitor"
    # A recruit's row can show only where they ended up.
    assert cast["Eric Nam"] == ["Traitor"]


def test_episodes():
    nb = parse("traitors-us5-1377883386")["episodes"]
    assert len(nb) == 12
    assert nb[0] == {
        "n": 1,
        "date": "2026-09-17",
        "title": "A New Dawn Is Rising",
        "placeholder": False,
    }
    assert nb[6]["placeholder"] is True
    assert (nb[11]["n"], nb[11]["date"]) == (12, "2026-11-19")
    celeb = parse("traitors-ukc2-1378006453")
    assert [e["date"] for e in celeb["episodes"]] == [
        "2026-10-01",
        "2026-10-02",
        "2026-10-08",
        "2026-10-09",
    ]
    assert len(celeb["contestants"]) == 21
