from pathlib import Path

from lambdas.common.catalog_dynamo import write
from lambdas.common.traitors_catalog import items, release_times
from lambdas.common.traitors_parse import season
from tests.conftest import CATALOG_TABLE

WIKI = Path(__file__).parents[2] / "fixtures" / "wiki"


def rows(show, number, fixture, title):
    parsed = season((WIKI / f"{fixture}.wikitext").read_text())
    page = {"pageid": 1, "title": title}
    out = items(show, number, page, parsed, current=True, open_at="2026-10-15T00:00:00Z")
    return {r["sk"]: r for r in out}


def test_new_blood_release_times():
    nb = rows("tus", 5, "traitors-us5-1377883386", "The Traitors: New Blood")
    # NBC 8 pm ET is midnight UTC; episode 2 follows episode 1 the same night.
    assert nb["EP#01"]["releaseAt"] == "2026-09-18T00:00:00Z"
    assert nb["EP#02"]["releaseAt"] == "2026-09-18T01:00:00Z"
    assert nb["EP#05"]["releaseAt"] == "2026-10-09T00:00:00Z"
    # The finale's two episodes, 11/19, after DST ends: 8 pm EST is 01:00 UTC.
    assert nb["EP#11"]["releaseAt"] == "2026-11-20T01:00:00Z"
    assert nb["EP#12"]["releaseAt"] == "2026-11-20T02:00:00Z"
    assert [nb[f"EP#{n:02d}"]["noRoundTable"] for n in (1, 2)] == [True, False]


def test_celebrity_release_and_first_round_table():
    celeb = rows("tukc", 2, "traitors-ukc2-1378006453", "The Celebrity Traitors series 2")
    assert celeb["EP#01"]["releaseAt"] == "2026-10-01T19:00:00Z"
    assert [celeb[f"EP#{n:02d}"]["noRoundTable"] for n in (1, 2, 3)] == [True, True, False]


def test_meta_index_and_players():
    nb = rows("tus", 5, "traitors-us5-1377883386", "The Traitors: New Blood")
    assert nb["META"]["episodes"] == 12
    assert nb["META"]["openAt"] == "2026-10-15T00:00:00Z"
    index = nb["SEASON#005"]
    assert (index["pk"], index["id"], index["year"], index["current"]) == (
        "SEASONS#tus",
        "tus-5",
        2026,
        True,
    )
    assert nb["PLAYER#abbey-benjamin"]["aliases"] == ["abbey", "abbey b", "abbey b.", "benjamin"]
    assert sum(sk.startswith("PLAYER#") for sk in nb) == 22
    assert not any("faction" in r or "exit" in r for r in nb.values())


def test_summary_and_bios():
    parsed = season((WIKI / "traitors-us5-1377883386.wikitext").read_text())
    lead = {"text": "New Blood.", "sourceUrl": "https://en.wikipedia.org/wiki/New_Blood"}
    bio = {"text": "A first baseman.", "sourceUrl": "https://en.wikipedia.org/wiki/Xavier_Scruggs"}
    out = items(
        "tus",
        5,
        {"pageid": 1, "title": "New Blood"},
        parsed,
        current=True,
        open_at="2026-10-15T00:00:00Z",
        summary=lead,
        bios={"Xavier Scruggs": (bio, False)},
        recaps={2: {"text": "Votes.", "source": "fandom", "sourceUrl": "https://f/2"}, 3: None},
    )
    by_sk = {r["sk"]: r for r in out}
    assert by_sk["META"]["summary"] == lead
    xavier = by_sk["PLAYER#xavier-scruggs"]
    assert (xavier["article"], xavier["bio"], xavier["bioCut"]) == ("Xavier Scruggs", bio, False)
    # Left out: a re-seed keeps whatever bio discovery wrote.
    assert by_sk["PLAYER#kim-daily"]["article"] is None
    assert "bio" not in by_sk["PLAYER#kim-daily"]
    assert by_sk["EP#02"]["recap"]["text"] == "Votes."
    assert "recap" not in by_sk["EP#03"]


def test_release_time_override():
    eps = [{"n": 1, "date": "2027-01-08"}]
    assert release_times(eps, "America/New_York", "21:00") == {1: "2027-01-09T02:00:00Z"}


def test_a_reseed_keeps_a_headshot_written_onto_the_player(aws):
    catalog = aws.Table(CATALOG_TABLE)
    shot = {"image": "kim-daily-1.webp", "sourceUrl": "https://f/File:K.webp", "source": "fandom"}
    nb = rows("tus", 5, "traitors-us5-1377883386", "The Traitors: New Blood")
    assert "headshot" not in nb["PLAYER#kim-daily"]
    catalog.put_item(Item={"pk": "SEASON#tus#5", "sk": "PLAYER#kim-daily", "headshot": shot})

    write(catalog, list(nb.values()), keep={"openAt"})

    item = catalog.get_item(Key={"pk": "SEASON#tus#5", "sk": "PLAYER#kim-daily"})["Item"]
    assert (item["name"], item["headshot"]) == ("Kim Daily", shot)
