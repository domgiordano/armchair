from pathlib import Path

import pytest

from lambdas.common import traitors_people
from lambdas.common.api import NotFoundError
from lambdas.common.traitors_catalog import items
from lambdas.common.traitors_parse import season
from lambdas.cron_poll_traitors import handler as poller
from lambdas.people_search import handler as search
from lambdas.traitors_credits.handler import handler as credits_handler
from lambdas.traitors_history.handler import handler as history_handler
from lambdas.traitors_player.handler import handler as player_handler
from lambdas.traitors_season.handler import handler as season_handler
from scripts.seed_traitors_season import write
from tests.conftest import BOARD_TABLE, CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE
from tests.events import authorized_event
from tests.social import call

WIKI = Path(__file__).parents[2] / "fixtures" / "wiki"
US4 = (WIKI / "traitors-us4-1376576846.wikitext").read_text()
NB = (WIKI / "traitors-us5-1377883386.wikitext").read_text()
PAGES = {4: US4, 5: NB}
# Every US season 4 episode is out; New Blood episode 5 releases 2026-10-09T00:00:00Z.
NOW = poller.epoch("2026-10-10T00:00:00Z")
ROB = {"image": "rob.jpg", "sourceUrl": "https://example.com/rob", "source": "search"}
ROB_BIO = {"text": "Rob Rausch is a snake handler.", "sourceUrl": "https://example.com/rob-wiki"}


@pytest.fixture
def db(aws, monkeypatch):
    catalog = aws.Table(CATALOG_TABLE)
    for number, current in ((4, False), (5, True)):
        rows = items(
            "tus",
            number,
            {"pageid": number, "title": f"Season {number}"},
            season(PAGES[number]),
            current=current,
            # Only New Blood episode 1 aired before the season opened in the app.
            open_at="2026-09-18T00:30:00Z",
        )
        write(catalog, rows, keep=set())
    catalog.update_item(
        Key={"pk": "SEASON#tus#4", "sk": "PLAYER#rob-rausch"},
        UpdateExpression="SET headshot = :h, bio = :b",
        ExpressionAttributeValues={":h": ROB, ":b": ROB_BIO},
    )
    monkeypatch.setattr(poller.time, "time", lambda: NOW)
    monkeypatch.setattr(
        poller,
        "latest",
        lambda pageid: {"revid": 3, "timestamp": "t", "content": PAGES[pageid], "title": "x"},
    )
    return aws


def backfill(season_id=None):
    event = {"backfill": True} | ({"season": season_id} if season_id else {})
    return poller.handler(event, None)


def player(aws, number, pid):
    key = {"pk": f"SEASON#tus#{number}", "sk": f"PLAYER#{pid}"}
    return aws.Table(CATALOG_TABLE).get_item(Key=key)["Item"]


def index(aws):
    """What discovery writes after publishing: a finished season with its cast, the current one bare."""
    catalog = aws.Table(CATALOG_TABLE)
    for number, cast in ((4, season(US4)["contestants"]), (5, None)):
        rows = catalog.query(
            KeyConditionExpression="pk = :pk",
            ExpressionAttributeValues={":pk": f"SEASON#tus#{number}"},
        )["Items"]
        players = [r for r in rows if r["sk"].startswith("PLAYER#")]
        traitors_people.index(catalog, "tus", number, players, cast)


def get(handler, path, **params):
    return call(handler, authorized_event(path=path, query=params))


def test_backfill_one_past_season(db):
    db.Table(SCORES_TABLE).put_item(
        Item={
            "pk": "WIN#tus#4",
            "sk": "USER#a",
            "picks": [{"player": "rob-rausch", "faction": "Traitor"}],
            "released": 0,
        }
    )
    assert backfill("tus-4") == {"polled": ["tus-4"]}
    rt = db.Table(PERFORMANCES_TABLE).get_item(Key={"pk": "EP#tus#4#02", "sk": "EVT#RT"})["Item"]
    assert (rt["state"], rt["banished"]) == ("confirmed", "porsha-williams")
    # No round table or murder covers a winner or a runner-up: the Contestants table does.
    assert player(db, 4, "rob-rausch")["exit"] == {"ep": 11, "how": "winner"}
    assert player(db, 4, "rob-rausch")["faction"] == "Traitor"
    assert player(db, 4, "maura-higgins")["exit"] == {"ep": 11, "how": "runner-up"}
    assert player(db, 4, "ian-terry")["faction"] == "Faithful"
    board = db.Table(BOARD_TABLE).get_item(Key={"pk": "BOARD#tus#4", "sk": "USER#a"})["Item"]
    assert board["pts"] == 30


def test_backfill_without_season_still_means_current_seasons(db):
    assert backfill() == {"polled": ["tus-5"]}
    assert "exit" not in player(db, 4, "rob-rausch")
    # A running season gets exits from its round tables and murders only.
    assert "faction" not in player(db, 5, "abbey-benjamin")


def test_backfill_unknown_season(db):
    with pytest.raises(NotFoundError):
        backfill("tus-9")


def test_people_index(db):
    backfill("tus-4")
    index(db)
    rob = db.Table(CATALOG_TABLE).get_item(Key={"pk": "PERSON#tus#rob-rausch", "sk": "META"})
    assert rob["Item"]["seasons"] == [
        {"season": 4, "faction": "Traitor", "finish": {"how": "winner", "ep": 11}}
    ]
    assert rob["Item"]["headshot"] == ROB
    row = db.Table(CATALOG_TABLE).get_item(Key={"pk": "PEOPLE#tus", "sk": "PERSON#rob-rausch"})
    assert {k: row["Item"][k] for k in ("name", "roles", "headshot", "seasons")} == {
        "name": "Rob Rausch",
        "roles": ["player"],
        "headshot": "rob.jpg",
        "seasons": [4],
    }
    abbey = db.Table(CATALOG_TABLE).get_item(Key={"pk": "PERSON#tus#abbey-benjamin", "sk": "META"})
    assert abbey["Item"]["seasons"] == [{"season": 5}]


def test_people_index_merges_seasons(db):
    catalog = db.Table(CATALOG_TABLE)
    rob = player(db, 4, "rob-rausch")
    traitors_people.index(catalog, "tus", 4, [rob], season(US4)["contestants"])
    traitors_people.index(catalog, "tus", 6, [{**rob, "headshot": None}], None)
    traitors_people.index(catalog, "tus", 6, [rob], None)
    item = catalog.get_item(Key={"pk": "PERSON#tus#rob-rausch", "sk": "META"})["Item"]
    assert [s["season"] for s in item["seasons"]] == [4, 6]
    assert item["headshot"] == ROB


def test_people_search_groups_players(db, monkeypatch):
    backfill("tus-4")
    index(db)
    # people_search reads `show` once PR #124 lands; until then point it at tus by hand.
    monkeypatch.setattr(search, "index", lambda show: _tus(db))
    status, body = get(search.handler, "/people/search", q="rausch")
    assert status == 200
    assert [p["id"] for p in body["data"]["players"]] == ["rob-rausch"]


def _tus(aws):
    return aws.Table(CATALOG_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": "PEOPLE#tus"}
    )["Items"]


def test_player_past_season(db):
    backfill("tus-4")
    index(db)
    status, body = get(player_handler, "/traitors/player", show="tus", id="rob-rausch")
    assert status == 200
    assert body["data"] == {
        "id": "rob-rausch",
        "name": "Rob Rausch",
        "headshot": "rob.jpg",
        "headshotCredit": {
            "source": "search",
            "sourceUrl": "https://example.com/rob",
            "author": None,
            "license": None,
        },
        "bio": ROB_BIO,
        "seasons": [
            {
                "season": "tus-4",
                "number": 4,
                "current": False,
                "championship": True,
                "finish": {"ep": 11, "how": "winner"},
                "faction": "Traitor",
                "votes": [{"ep": ep, "received": 1 if ep in (7, 8) else 0} for ep in range(2, 12)],
            }
        ],
    }


def test_player_votes_stop_at_their_exit(db):
    backfill("tus-4")
    index(db)
    _, body = get(player_handler, "/traitors/player", show="tus", id="michael-rapaport")
    assert body["data"]["seasons"][0]["votes"] == [
        {"ep": 2, "received": 4},
        {"ep": 3, "received": 1},
        {"ep": 4, "received": 0},
        {"ep": 5, "received": 11},
    ]


def test_player_current_season_shows_only_closed_exits(db):
    backfill()
    index(db)
    # Madeline went out at the episode 2 round table, which is still open to picks.
    _, body = get(player_handler, "/traitors/player", show="tus", id="madeline-kostopulos")
    assert body["data"]["seasons"] == [
        {
            "season": "tus-5",
            "number": 5,
            "current": True,
            "championship": False,
            "finish": None,
            "faction": None,
            "votes": None,
        }
    ]
    db.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#tus#5", "sk": "META"},
        UpdateExpression="SET openAt = :o",
        ExpressionAttributeValues={":o": "2026-10-01T00:00:00Z"},
    )
    _, body = get(player_handler, "/traitors/player", show="tus", id="madeline-kostopulos")
    (s,) = body["data"]["seasons"]
    assert (s["finish"], s["faction"]) == ({"ep": 2, "how": "banished"}, "Faithful")


def test_player_bad_input(db):
    assert get(player_handler, "/traitors/player", show="dwts", id="rob-rausch")[0] == 400
    assert get(player_handler, "/traitors/player", show="tus", id="Rob Rausch")[0] == 400
    assert get(player_handler, "/traitors/player", show="tus", id="nobody")[0] == 404


def test_history_of_a_past_season(db):
    backfill("tus-4")
    status, body = get(history_handler, "/traitors/history", season="tus-4")
    assert status == 200
    data = body["data"]
    assert (data["season"], data["title"]) == ("tus-4", "Season 4")
    assert data["winners"] == [{"id": "rob-rausch", "faction": "Traitor"}]
    assert len(data["players"]) == 23
    rob = next(p for p in data["players"] if p["id"] == "rob-rausch")
    assert rob == {
        "id": "rob-rausch",
        "name": "Rob Rausch",
        "headshot": "rob.jpg",
        "faction": "Traitor",
        "exit": {"ep": 11, "how": "winner"},
    }
    eps = {e["ep"]: e for e in data["episodes"]}
    assert len(eps) == 12
    assert eps[1]["roundTable"] is None
    assert eps[2]["roundTable"] == {
        "banished": "porsha-williams",
        "faction": "Faithful",
        "firstVote": {"porsha-williams": 10, "donna-kelce": 8, "michael-rapaport": 4},
    }
    assert eps[2]["murdered"] == ["ian-terry"]
    assert eps[9]["recruited"] == ["eric-nam"]
    assert eps[12]["recruited"] == []


def test_history_before_publishing_has_no_results(db):
    _, body = get(history_handler, "/traitors/history", season="tus-4")
    ep2 = body["data"]["episodes"][1]
    assert (ep2["roundTable"], ep2["murdered"], ep2["recruited"]) == (None, None, None)
    assert body["data"]["winners"] == []


def test_history_refuses_the_current_season(db):
    status, body = get(history_handler, "/traitors/history", season="tus-5")
    assert status == 403
    assert body["error"]["detail"] == {"current": True}


def test_history_bad_season(db):
    assert get(history_handler, "/traitors/history", season="dwts-3")[0] == 400
    assert get(history_handler, "/traitors/history", season="tus-9")[0] == 404


def test_player_without_a_headshot_has_no_credit(db):
    backfill("tus-4")
    index(db)
    _, body = get(player_handler, "/traitors/player", show="tus", id="maura-higgins")
    assert (body["data"]["headshot"], body["data"]["headshotCredit"]) == (None, None)


def test_credits(db):
    commons = {
        "image": "ian.webp",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:IanTerryBeach.jpg",
        "source": "commons",
        "author": "Someone",
        "license": "CC BY-SA 4.0",
    }
    db.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#tus#4", "sk": "PLAYER#ian-terry"},
        UpdateExpression="SET headshot = :h",
        ExpressionAttributeValues={":h": commons},
    )
    status, body = get(credits_handler, "/traitors/credits", season="tus-4")
    assert status == 200
    assert body["data"] == [
        {
            "id": "ian-terry",
            "name": "Ian Terry",
            "image": "ian.webp",
            "source": "commons",
            "sourceUrl": "https://commons.wikimedia.org/wiki/File:IanTerryBeach.jpg",
            "author": "Someone",
            "license": "CC BY-SA 4.0",
        },
        {
            "id": "rob-rausch",
            "name": "Rob Rausch",
            "image": "rob.jpg",
            "source": "search",
            "sourceUrl": "https://example.com/rob",
            "author": None,
            "license": None,
        },
    ]
    assert get(credits_handler, "/traitors/credits", season="tus-5")[1]["data"] == []


def test_credits_bad_season(db):
    assert get(credits_handler, "/traitors/credits", season="dwts-3")[0] == 400
    assert get(credits_handler, "/traitors/credits", season="tus-9")[0] == 404


def test_season_overview_of_a_past_season(db):
    backfill("tus-4")
    status, body = get(season_handler, "/traitors/season", season="tus-4")
    assert status == 200
    data = body["data"]
    assert data["needsBet"] is False and "betRoster" not in data
    assert data["winners"] == [
        {"id": "rob-rausch", "name": "Rob Rausch", "headshot": "rob.jpg", "faction": "Traitor"}
    ]
    cast = {p["id"]: p for p in data["cast"]}
    assert len(cast) == 23
    assert cast["maura-higgins"]["exit"] == {"ep": 11, "how": "runner-up"}
    assert (cast["ian-terry"]["faction"], cast["ian-terry"]["exit"]) == (
        "Faithful",
        {"ep": 2, "how": "murdered"},
    )


def test_season_cast_of_the_current_season_shows_closed_exits_only(db):
    backfill()
    _, body = get(season_handler, "/traitors/season", season="tus-5")
    cast = {p["id"]: p for p in body["data"]["cast"]}
    assert "winners" not in body["data"]
    # Madeline's banishment is in episode 2, still open to picks: no X, no faction.
    assert (cast["madeline-kostopulos"]["exit"], cast["madeline-kostopulos"]["faction"]) == (
        None,
        None,
    )
    assert not any(p["exit"] or p["faction"] for p in cast.values())
    db.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#tus#5", "sk": "META"},
        UpdateExpression="SET openAt = :o",
        ExpressionAttributeValues={":o": "2026-10-01T00:00:00Z"},
    )
    _, body = get(season_handler, "/traitors/season", season="tus-5")
    madeline = next(p for p in body["data"]["cast"] if p["id"] == "madeline-kostopulos")
    assert (madeline["exit"], madeline["faction"]) == ({"ep": 2, "how": "banished"}, "Faithful")
