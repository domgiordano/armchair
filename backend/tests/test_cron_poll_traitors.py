import json
from pathlib import Path

import pytest

from lambdas.common.traitors_catalog import items
from lambdas.common.traitors_parse import season
from lambdas.cron_poll_traitors import handler as poller
from scripts.seed_traitors_season import write
from tests.conftest import CATALOG_TABLE

WIKI = Path(__file__).parents[2] / "fixtures" / "wiki"
NB = (WIKI / "traitors-us5-1377883386.wikitext").read_text()
REDIRECT = (WIKI / "traitors-us5-1375764755-redirect.wikitext").read_text()
# Episode 5 releases 2026-10-09T00:00:00Z.
EP5 = poller.epoch("2026-10-09T00:00:00Z")


@pytest.fixture
def db(aws):
    rows = items(
        "tus",
        5,
        {"pageid": 83493607, "title": "The Traitors: New Blood"},
        season(NB),
        current=True,
        open_at="2026-10-15T00:00:00Z",
    )
    write(aws.Table(CATALOG_TABLE), rows, keep=set())
    return aws


@pytest.fixture
def wiki(monkeypatch):
    calls = []

    def run(at: int, content: str = NB):
        monkeypatch.setattr(poller.time, "time", lambda: at)
        monkeypatch.setattr(
            poller,
            "latest",
            lambda pageid: (
                calls.append(pageid)
                or {"revid": 1, "timestamp": "t", "content": content, "title": "x"}
            ),
        )
        return poller.handler({}, None)

    run.calls = calls
    return run


def test_polls_every_tick_while_fresh(db, wiki, capsys):
    assert wiki(EP5 + 10 * 60 + 30) == {"polled": ["tus-5"]}
    assert wiki.calls == [83493607]
    line = json.loads(capsys.readouterr().out.strip())
    assert line["season"] == "tus-5"
    assert [(rt["ep"], rt["banished"], rt["complete"]) for rt in line["roundTables"]] == [
        (2, "Madeline Kostopulos", True),
        (4, "Arisa Thomas", True),
        (5, None, False),
    ]


def test_hourly_sweep_after_six_hours(db, wiki):
    assert wiki(EP5 + 10 * 3600 + 30 * 60) == {"polled": []}
    assert wiki(EP5 + 10 * 3600 + 20) == {"polled": ["tus-5"]}
    assert wiki.calls == [83493607]


def test_off_air_fetches_nothing(db, wiki):
    assert wiki(EP5 - 3600) == {"polled": []}
    assert wiki(EP5 + 4 * 24 * 3600) == {"polled": []}
    assert wiki.calls == []


def test_redirect_is_skipped(db, wiki, capsys):
    assert wiki(EP5 + 60, REDIRECT) == {"polled": []}
    assert json.loads(capsys.readouterr().out)["skipped"] == "no elimination table"


def test_only_current_seasons(db, wiki):
    db.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASONS#tus", "sk": "SEASON#005"},
        UpdateExpression="SET #c = :f",
        ExpressionAttributeNames={"#c": "current"},
        ExpressionAttributeValues={":f": False},
    )
    assert wiki(EP5 + 60) == {"polled": []}
