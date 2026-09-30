import io
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

import pytest

from lambdas.cron_poll_wiki import handler as poller
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE

FIXTURES = Path(__file__).parents[2] / "fixtures"
GOLDEN = {
    c["name"]: c["expected"]
    for c in json.loads((FIXTURES / "wiki-golden.json").read_text())["cases"]
}
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
EP4 = "EP#dwts#35#04"

VANDAL = ("s35-1377570871-vandal.wikitext", 1377570871, "2026-09-30T01:23:22Z")
REVERT = ("s35-1377571301-revert.wikitext", 1377571301, "2026-09-30T01:25:08Z")
FINAL = ("s35-1377681547.wikitext", 1377681547, "2026-09-30T15:03:34Z")


def page(fixture: str) -> str:
    return (FIXTURES / "wiki" / fixture).read_text()


def epoch(stamp: str) -> int:
    return int(datetime.fromisoformat(stamp).timestamp())


@pytest.fixture
def db(aws):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    return aws


class Wiki:
    """Stubs urlopen with the API's formatversion=2 response and the clock with `at`."""

    def __init__(self, monkeypatch):
        self.monkeypatch = monkeypatch
        self.calls = []

    def tick(self, rev: tuple, at: int, content: str | None = None, event: dict | None = None):
        fixture, revid, stamp = rev
        body = {
            "query": {
                "pages": [
                    {
                        "title": SEASON["wikiTitle"],
                        "revisions": [
                            {
                                "revid": revid,
                                "timestamp": stamp,
                                "slots": {"main": {"content": content or page(fixture)}},
                            }
                        ],
                    }
                ]
            }
        }

        def urlopen(req, timeout):
            self.calls.append(req)
            return io.BytesIO(json.dumps(body).encode())

        self.monkeypatch.setattr(poller, "urlopen", urlopen)
        self.monkeypatch.setattr(poller, "now", lambda: at)
        return poller.handler(event or {}, None)


@pytest.fixture
def wiki(db, monkeypatch):
    return Wiki(monkeypatch)


def perfs(db, pk=EP4) -> dict:
    rows = db.Table(PERFORMANCES_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": pk}
    )["Items"]
    return {r["sk"].removeprefix("PERF#"): r for r in rows}


def judges(db, key: str) -> dict:
    """{jid: (value, state)} for one performance."""
    return {j: (e["value"], e["state"]) for j, e in perfs(db)[key]["judges"].items()}


def catalog(db, sk: str) -> dict:
    return db.Table(CATALOG_TABLE).get_item(Key={"pk": "SEASON#dwts#35", "sk": sk})["Item"]


def everything(db) -> list:
    return [
        sorted(db.Table(t).scan()["Items"], key=lambda r: (r["pk"], r["sk"]))
        for t in (CATALOG_TABLE, PERFORMANCES_TABLE)
    ]


def last_line(capsys) -> dict:
    return json.loads(capsys.readouterr().out.splitlines()[-1])


def test_one_request_and_the_log_line(wiki, capsys):
    t = epoch(FINAL[2])
    assert wiki.tick(FINAL, t)["week"] == 4

    assert len(wiki.calls) == 1
    params = parse_qs(urlsplit(wiki.calls[0].full_url).query)
    assert params["titles"] == [SEASON["wikiTitle"]]
    assert params["rvprop"] == ["ids|timestamp|content"]
    assert wiki.calls[0].get_header("User-agent") == poller.USER_AGENT

    line = last_line(capsys)
    assert line["revid"] == FINAL[1]
    for p in line["week"]["performances"]:
        del p["style"], p["song"], p["result"]
    assert line["week"] == GOLDEN["S35 week 4 pre-show alphabetical table, empty cells"]


def test_replay_of_the_week_3_vandal_night(wiki, db):
    t0 = epoch(VANDAL[2])
    wiki.tick(VANDAL, t0)
    assert judges(db, "jenna-dewan#1")["derek-hough"] == (10, "provisional")
    assert judges(db, "connor-wood#1")["bruno-tonioli"] == (6, "provisional")
    assert judges(db, "amber-glenn#1")["carrie-ann-inaba"] == (8, "provisional")

    wiki.tick(VANDAL, t0 + 60)
    assert judges(db, "jenna-dewan#1")["derek-hough"] == (10, "provisional")

    # The revert empties both vandalised rows, so their values go with it.
    wiki.tick(REVERT, epoch(REVERT[2]))
    assert judges(db, "jenna-dewan#1") == {}
    assert judges(db, "connor-wood#1") == {}

    wiki.tick(REVERT, t0 + 180)
    assert set(judges(db, "amber-glenn#1").values()) == {(8, "confirmed")}
    assert judges(db, "jenna-dewan#1") == {}
    assert "results" not in catalog(db, "EP#04")

    tf = epoch(FINAL[2])
    wiki.tick(FINAL, tf)
    assert set(judges(db, "jenna-dewan#1").values()) == {(7, "provisional")}
    assert "results" not in catalog(db, "EP#04")

    wiki.tick(FINAL, tf + 179)
    assert set(judges(db, "jenna-dewan#1").values()) == {(7, "provisional")}
    assert "results" not in catalog(db, "EP#04")

    wiki.tick(FINAL, tf + 180)
    assert judges(db, "connor-wood#1") == {
        "carrie-ann-inaba": (7, "confirmed"),
        "derek-hough": (6, "confirmed"),
        "bruno-tonioli": (7, "confirmed"),
    }
    results = catalog(db, "EP#04")["results"]
    assert results["eliminated"] == ["taylor-hanson"]
    assert results["totals"]["jenna-dewan"] == 21
    assert catalog(db, "CONTESTANT#taylor-hanson")["eliminatedEp"] == 4
    assert catalog(db, "EP#04")["panel"] == SEASON["defaultPanel"]
    item = perfs(db)["taylor-hanson#1"]
    assert (item["style"], item["rateable"]) == ("Foxtrot", True)

    # Nothing is provisional and the revision hasn't moved: no parse, no writes.
    before = everything(db)
    calls = len(wiki.calls)
    assert wiki.tick(FINAL, tf + 240) == {"revid": FINAL[1], "unchanged": True}
    assert len(wiki.calls) == calls + 1
    assert everything(db)[1] == before[1]


def test_a_changed_value_restarts_the_clock(wiki, db):
    # Connor's swapped judges replaced by the real ones 100 s later, no revert in between.
    t0 = epoch(VANDAL[2])
    wiki.tick(VANDAL, t0)
    wiki.tick(FINAL, t0 + 100)
    wiki.tick(FINAL, t0 + 180)
    assert judges(db, "connor-wood#1") == {
        "carrie-ann-inaba": (7, "confirmed"),
        "derek-hough": (6, "provisional"),
        "bruno-tonioli": (7, "provisional"),
    }
    assert judges(db, "jenna-dewan#1")["derek-hough"] == (7, "provisional")

    wiki.tick(FINAL, t0 + 280)
    assert {s for _, s in judges(db, "connor-wood#1").values()} == {"confirmed"}


def test_sanity_failures_never_go_provisional(wiki, db):
    text = page(REVERT[0])
    connor = '! scope="row" | Connor & Rylee\n| \n'
    jenna = '! scope="row" | Jenna & Val\n| \n'
    assert connor in text and jenna in text
    text = text.replace(connor, '! scope="row" | Connor & Rylee\n| 20 (7, 7, 7)\n')
    text = text.replace(jenna, '! scope="row" | Jenna & Val\n| 14 (7, 7)\n')
    stranger = '! scope="row" | Mystery & Pro\n| 24 (8, 8, 8)\n|-\n'
    text = text.replace(
        '! scope="row" | Tyler & Sharna', stranger + '! scope="row" | Tyler & Sharna', 1
    )

    t = epoch(REVERT[2])
    wiki.tick(REVERT, t, content=text)
    wiki.tick(REVERT, t + 600, content=text)

    got = perfs(db)
    assert "connor-wood#1" not in got and "jenna-dewan#1" not in got
    assert not any("mystery" in k for k in got)
    assert set(judges(db, "amber-glenn#1").values()) == {(8, "confirmed")}


def test_nothing_publishes_before_the_episode_airs(wiki, db):
    # 7:59 pm ET on the week 3 air date: episodes 1-3 publish, 4 waits.
    before = epoch("2026-09-29T23:59:00Z")
    assert wiki.tick(FINAL, before)["episodes"] == [1, 2, 3]
    assert perfs(db) == {}
    assert perfs(db, "EP#dwts#35#05") == {}

    assert wiki.tick(FINAL, before + 60)["episodes"] == [1, 2, 3, 4]
    assert len(perfs(db)) == 13


def test_backfill_confirms_every_past_episode_and_is_idempotent(wiki, db):
    t = epoch(FINAL[2])
    res = wiki.tick(FINAL, t, event={"backfill": True})
    assert res["episodes"] == [1, 2, 3, 4] and res["pending"] is False

    expected = {
        1: "conner-leavitt",
        2: "sarah-jane-nader",
        3: "giada-de-laurentiis",
        4: "taylor-hanson",
    }
    sizes = {1: 8, 2: 8, 3: 14, 4: 13}
    for ep, out in expected.items():
        assert catalog(db, f"EP#{ep:02d}")["results"]["eliminated"] == [out]
        assert catalog(db, f"CONTESTANT#{out}")["eliminatedEp"] == ep
        rows = perfs(db, f"EP#dwts#35#{ep:02d}")
        assert len(rows) == sizes[ep]
        states = {e["state"] for r in rows.values() for e in r["judges"].values()}
        assert states == {"confirmed"}
    assert judges(db, "harry-shum-jr#1")["bruno-tonioli"] == (Decimal(8), "confirmed")
    assert "lastRevid" not in catalog(db, "META")

    before = everything(db)
    wiki.tick(FINAL, t + 3600, event={"backfill": True})
    assert everything(db) == before


def test_a_guest_judge_on_the_order_line_is_created(wiki, db):
    text = page(FINAL[0])
    head = "=== Week 3: Yacht Rock Night ===\n"
    line = (
        "''Individual judges' scores are listed in this order from left to right: "
        "Carrie Ann Inaba, Derek Hough, Guest Person, Bruno Tonioli.''\n"
    )
    assert head in text
    wiki.tick(FINAL, epoch(FINAL[2]), content=text.replace(head, head + line))

    assert catalog(db, "JUDGE#guest-person")["name"] == "Guest Person"
    assert catalog(db, "EP#04")["panel"] == [
        "carrie-ann-inaba",
        "derek-hough",
        "guest-person",
        "bruno-tonioli",
    ]
    # Three values for a panel of four: every row fails the count check.
    assert perfs(db) == {}


def test_a_failed_request_fails_the_tick(db, monkeypatch, capsys):
    def urlopen(req, timeout):
        raise HTTPError(req.full_url, 503, "Service Unavailable", {}, None)

    monkeypatch.setattr(poller, "urlopen", urlopen)

    with pytest.raises(HTTPError):
        poller.handler({}, None)
    assert capsys.readouterr().out == ""
    assert "lastRevid" not in catalog(db, "META")
