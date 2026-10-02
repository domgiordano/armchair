from pathlib import Path

import pytest

from lambdas.common.traitors_catalog import items
from lambdas.common.traitors_parse import season
from lambdas.common.traitors_publish import outcomes, winners
from lambdas.cron_poll_traitors import handler as poller
from scripts.seed_traitors_season import write
from tests.conftest import BOARD_TABLE, CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE

WIKI = Path(__file__).parents[2] / "fixtures" / "wiki"


def parsed(name):
    return season((WIKI / f"{name}.wikitext").read_text())


def test_new_blood_outcomes():
    out = outcomes(parsed("traitors-us5-1377883386"), [1, 2, 3, 4, 5])
    assert out[2]["RT"]["banished"] == "madeline-kostopulos"
    assert out[2]["RT"]["faction"] == "Faithful"
    assert out[2]["MURDER"] == {"victims": ["kim-daily"]}
    assert out[3] == {
        "RT": None,
        "MURDER": {"victims": ["xavier-scruggs"]},
        "RECRUIT": {"recruits": ["katie-fites"]},
    }
    assert out[4]["RT"]["firstVote"] == {
        "arisa-thomas": 13,
        "victor-vollbrechthausen": 5,
        "michael-foote": 1,
    }
    # Nothing after episode 4 is in yet, so its night stays open; episode 5 has nothing.
    assert out[4]["MURDER"] == {"victims": ["logan-smith"]}
    assert out[4]["RECRUIT"] is None
    assert out[5] == {"RT": None, "MURDER": None, "RECRUIT": None}
    # Episode 1 has no round table, and its night settled once episode 2 filled in.
    assert out[1] == {"RT": None, "MURDER": {"victims": []}, "RECRUIT": {"recruits": []}}


def test_partial_tally_publishes_no_round_table():
    out = outcomes(parsed("traitors-us5-1376577733-partial"), [4])
    assert out[4]["RT"] is None


def test_finished_season_settles_everything():
    p = parsed("traitors-us4-1376576846")
    out = outcomes(p, list(range(1, 13)))
    assert out[9]["RECRUIT"] == {"recruits": ["eric-nam"]}
    assert out[12]["RECRUIT"] == {"recruits": []}
    assert winners(p) == {"rob-rausch": "Traitor"}


NB = (WIKI / "traitors-us5-1377883386.wikitext").read_text()
EP4 = poller.epoch("2026-09-25T01:00:00Z")


@pytest.fixture
def db(aws):
    rows = items(
        "tus",
        5,
        {"pageid": 1, "title": "New Blood"},
        season(NB),
        current=True,
        open_at="2026-10-15T00:00:00Z",
    )
    write(aws.Table(CATALOG_TABLE), rows, keep=set())
    return aws


def tick(monkeypatch, at, event=None):
    monkeypatch.setattr(poller.time, "time", lambda: at)
    monkeypatch.setattr(
        poller, "latest", lambda pageid: {"revid": 7, "timestamp": "t", "content": NB, "title": "x"}
    )
    return poller.handler(event or {}, None)


def event(aws, ep, kind):
    return (
        aws.Table(PERFORMANCES_TABLE)
        .get_item(Key={"pk": f"EP#tus#5#{ep:02d}", "sk": f"EVT#{kind}"})
        .get("Item")
    )


def test_confirms_after_the_window_and_scores(db, monkeypatch):
    db.Table(SCORES_TABLE).put_item(
        Item={
            "pk": "EP#tus#5#04",
            "sk": "EVT#RT#USER#a",
            "picks": ["arisa-thomas", "victor-vollbrechthausen", "michael-foote"],
        }
    )
    tick(monkeypatch, EP4 + 60)
    assert event(db, 4, "RT")["state"] == "provisional"
    assert event(db, 4, "RECRUIT") is None
    # Episode 5 isn't released at this hour, even though the page has a column for it.
    assert event(db, 5, "MURDER") is None
    tick(monkeypatch, EP4 + 60 + 180)
    rt = event(db, 4, "RT")
    assert rt["state"] == "confirmed"
    assert rt["banished"] == "arisa-thomas"
    player = db.Table(CATALOG_TABLE).get_item(
        Key={"pk": "SEASON#tus#5", "sk": "PLAYER#arisa-thomas"}
    )["Item"]
    assert player["exit"] == {"ep": 4, "how": "banished"}
    assert player["faction"] == "Faithful"
    murdered = db.Table(CATALOG_TABLE).get_item(
        Key={"pk": "SEASON#tus#5", "sk": "PLAYER#logan-smith"}
    )["Item"]
    assert murdered["exit"] == {"ep": 4, "how": "murdered"}
    board = db.Table(BOARD_TABLE).get_item(Key={"pk": "BOARD#tus#5", "sk": "USER#a"})["Item"]
    assert board["pts"] == 10


def test_backfill_confirms_at_once(db, monkeypatch):
    assert tick(monkeypatch, EP4 + 30 * 24 * 3600, {"backfill": True}) == {"polled": ["tus-5"]}
    assert event(db, 2, "RT")["state"] == "confirmed"
    assert event(db, 4, "RT")["state"] == "confirmed"
