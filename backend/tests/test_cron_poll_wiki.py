import io
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

import boto3
import pytest

from lambdas.cron_poll_wiki import handler as poller
from scripts.seed_season import SEASONS, items, write
from tests.conftest import BOARD_TABLE, CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE

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
        del p["style"], p["song"], p["result"], p["order"]
    assert line["week"] == GOLDEN["S35 week 4 pre-show alphabetical table, empty cells"]


def test_lineups_keep_the_running_order_and_know_a_placeholder(wiki, db):
    wiki.tick(FINAL, epoch(FINAL[2]))
    # Week 3 is scored, so its table is the order they danced.
    ep4 = catalog(db, "EP#04")
    assert ep4["runningOrder"] is True
    assert min(ep4["lineup"], key=lambda k: ep4["lineup"][k]["order"]) == "amber-glenn#1"
    assert ep4["lineup"]["amber-glenn#1"]["style"] == "Foxtrot"
    assert len(ep4["lineup"]) == 13
    # Week 4 is still the pre-show alphabetical table.
    ep5 = catalog(db, "EP#05")
    assert ep5["runningOrder"] is False and len(ep5["lineup"]) == 12


def test_a_lineup_run_writes_order_and_publishes_nothing(wiki, db):
    text = page(FINAL[0])
    # Week 4 reordered on show day: Ezra & Daniella moved to the top, nothing scored yet.
    head = text.index("=== Week 4")
    row = text.index('! scope="row" | Ezra & Daniella', head)
    end = text.index("|-", row)
    block = text[row:end]
    text = text[:row] + text[end + 3 :]
    first = text.index('! scope="row"', head)
    text = text[:first] + block + "|-\n" + text[first:]
    res = wiki.tick(FINAL, epoch("2026-10-06T18:00:00Z"), content=text, event={"lineup": True})
    assert 5 in res["lineup"]
    ep5 = catalog(db, "EP#05")
    assert ep5["runningOrder"] is True
    assert ep5["lineup"]["ezra-frech#1"]["order"] == 1
    assert perfs(db, "EP#dwts#35#05") == {} and perfs(db) == {}
    assert "lastRevid" not in catalog(db, "META")
    # Nothing changed, nothing written.
    again = wiki.tick(FINAL, epoch("2026-10-06T19:00:00Z"), content=text, event={"lineup": True})
    assert again["lineup"] == []


def test_the_press_releases_cast_order_is_a_placeholder():
    rows = [{"contestants": [c], "judges": None} for c in ("b", "a", "c")]
    names = {"a": "Ann", "b": "Bea", "c": "Cy"}
    assert poller.running(rows, names, lambda: ["x", "b", "a", "c"]) is False
    assert poller.running(rows, names, lambda: ["a", "b", "c"]) is True
    # Alphabetical never needs the release.
    alpha = sorted(rows, key=lambda r: r["contestants"][0])
    assert poller.running(alpha, names, lambda: 1 / 0) is False
    assert poller.running([{**alpha[0], "judges": [8]}, *alpha[1:]], names, list) is True


def test_press_order_reads_the_release_couples(monkeypatch):
    html = (
        "<p>The couples are the following:</p>"
        "<p>Jackson Olson and partner Emma Slater will perform a Salsa</p>"
        "<p>Tyler Cameron and partner Sharna Burgess will perform a Jazz</p>"
        "<p>Someone Else and partner X will perform</p>"
    )
    monkeypatch.setattr(poller, "urlopen", lambda req, timeout: io.BytesIO(html.encode()))
    names = {"jackson-olson": "Jackson Olson", "tyler-cameron": "Tyler Cameron"}
    url = "https://www.detpress.com/abc/pressrelease/x/"
    assert poller.press_order(url, names) == ["jackson-olson", "tyler-cameron"]

    def down(req, timeout):
        raise HTTPError(req.full_url, 503, "Service Unavailable", {}, None)

    monkeypatch.setattr(poller, "urlopen", down)
    assert poller.press_order(url, names) == []


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


def test_backfill_counts_dances_scored_before_the_judges_confirmed(wiki, db):
    sub = "3f1c2b9a-0000-4000-8000-00000000000a"
    db.Table(SCORES_TABLE).put_item(
        Item={"pk": EP4, "sk": f"PERF#harry-shum-jr#1#USER#{sub}", "value": 8}
    )
    t = epoch(FINAL[2])
    wiki.tick(FINAL, t, event={"backfill": True})
    wiki.tick(FINAL, t + 3600, event={"backfill": True})

    board = db.Table(BOARD_TABLE)
    row = board.get_item(Key={"pk": "BOARD#dwts#35", "sk": f"USER#{sub}"})["Item"]
    assert row["n"] == 1 and row["J#bruno-tonioli#err"] == 0
    assert board.get_item(Key={"pk": "BOARD#dwts#all", "sk": f"USER#{sub}"})["Item"]["n"] == 1


def test_a_team_dance_is_rateable_and_its_missing_result_holds_nothing_up(db):
    panel = SEASON["defaultPanel"]
    solo = {
        "contestants": ["tyler-cameron"],
        "n": 1,
        "rateable": True,
        "panel": panel,
        "total": Decimal(24),
        "judges": [Decimal(8)] * 3,
        "bonus": None,
        "style": "Tango",
        "song": None,
        "result": "Eliminated",
    }
    team = {**solo, "contestants": ["amber-glenn", "jenna-dewan"], "result": None}
    poller.publish({"sk": "EP#05"}, panel, [solo, team], 1, 0, 0)

    assert perfs(db, "EP#dwts#35#05")["amber-glenn+jenna-dewan#1"]["rateable"] is True
    results = catalog(db, "EP#05")["results"]
    assert results["eliminated"] == ["tyler-cameron"]
    assert results["totals"] == {"tyler-cameron": 24}


S34 = json.loads((SEASONS / "dwts-34.json").read_text(), parse_float=Decimal)
S34_REV = ("s34-1375977389.wikitext", S34["revid"], S34["revTimestamp"])
SITE_BUCKET = "t-armchair-site"
CHERYL = {
    "summary": {
        "type": "standard",
        "title": "Cheryl Burke",
        "wikibase_item": "Q2085395",
        "description": "American dancer (born 1984)",
        "extract": "Cheryl Burke is an American dancer and television personality. "
        "She is best known as a professional dancer on Dancing with the Stars. "
        "She won seasons two and three. She later hosted a podcast.",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Cheryl_Burke"}},
    },
    "entity": {
        "entities": {
            "Q2085395": {
                "claims": {
                    "P31": [{"mainsnak": {"datavalue": {"value": {"id": "Q5"}}}}],
                    "P18": [{"mainsnak": {"datavalue": {"value": "Cheryl Burke 2009.jpg"}}}],
                }
            }
        }
    },
    "file": {
        "query": {
            "pages": [
                {
                    "imagerepository": "local",
                    "imageinfo": [
                        {
                            "mime": "image/jpeg",
                            "sha1": "0123456789abcdef",
                            "thumburl": "https://upload.wikimedia.org/thumb/Cheryl_Burke_2009.jpg",
                            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Cheryl_Burke_2009.jpg",
                            "extmetadata": {
                                "Artist": {"value": "<a href='x'>Toglenn</a>"},
                                "LicenseShortName": {"value": "CC BY-SA 3.0"},
                            },
                        }
                    ],
                }
            ]
        }
    },
}


@pytest.fixture
def s34(aws, monkeypatch):
    """S34 as the live season with week 7's guest, Cheryl Burke, not yet in the catalog."""
    monkeypatch.setattr(poller, "SEASON", 34)
    monkeypatch.setattr(poller, "SEASON_PK", "SEASON#dwts#34")
    monkeypatch.setenv("SITE_BUCKET", SITE_BUCKET)
    boto3.client("s3").create_bucket(Bucket=SITE_BUCKET)
    rows = [r for r in items(S34) if r["sk"] != "JUDGE#cheryl-burke"]
    write(
        aws.Table(CATALOG_TABLE), [{**r, "panel": None} if r["sk"] == "EP#07" else r for r in rows]
    )
    return aws


def commons(monkeypatch, answers: dict | None = None):
    """Stubs Wikipedia, Wikidata and Commons for guest_judges; None leaves them offline."""
    import urllib.request

    seen = []

    def urlopen(req, timeout=None):
        url = req.full_url
        seen.append(url)
        if answers is None:
            raise OSError(f"offline: {url}")
        if "/page/summary/" in url:
            return io.BytesIO(json.dumps(answers["summary"]).encode())
        if "wikidata.org" in url:
            return io.BytesIO(json.dumps(answers["entity"]).encode())
        if "commons.wikimedia.org/w/api.php" in url:
            return io.BytesIO(json.dumps(answers["file"]).encode())
        return io.BytesIO(b"\xff\xd8 a jpeg")

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    return seen


def item(db, pk: str, sk: str = "META") -> dict:
    return db.Table(CATALOG_TABLE).get_item(Key={"pk": pk, "sk": sk})["Item"]


def s34_catalog(db, sk: str) -> dict:
    return item(db, "SEASON#dwts#34", sk)


def test_an_unknown_guest_scores_four_seats_and_gets_a_photo_and_page(s34, monkeypatch):
    commons(monkeypatch, CHERYL)
    Wiki(monkeypatch).tick(S34_REV, epoch("2026-01-01T00:00:00Z"), event={"backfill": True})

    panel = ["carrie-ann-inaba", "derek-hough", "cheryl-burke", "bruno-tonioli"]
    assert s34_catalog(s34, "EP#07")["panel"] == panel
    alix = perfs(s34, "EP#dwts#34#07")["alix-earle#1"]
    assert {j: e["value"] for j, e in alix["judges"].items()} == dict(zip(panel, (10, 10, 9, 10)))
    assert s34_catalog(s34, "EP#07")["results"]["totals"]["alix-earle"] == 39

    judge = s34_catalog(s34, "JUDGE#cheryl-burke")
    assert judge["name"] == "Cheryl Burke"
    shot = judge["headshot"]
    assert shot["image"].startswith("auto/cheryl-burke-") and shot["image"].endswith(".jpg")
    assert (shot["author"], shot["license"], shot["source"]) == ("Toglenn", "CC BY-SA 3.0", "auto")
    body = boto3.client("s3").get_object(Bucket=SITE_BUCKET, Key=f"headshots/{shot['image']}")
    assert body["ContentType"] == "image/jpeg"

    person = item(s34, "PERSON#dwts#cheryl-burke")
    assert person["roles"] == ["judge"] and person["seasons"] == [{"season": 34, "role": "judge"}]
    assert person["bio"]["extract"].count(".") == 3
    assert item(s34, "PEOPLE#dwts", "PERSON#cheryl-burke")["headshot"] == shot["image"]


def test_a_guest_lookup_that_fails_never_holds_up_scores_and_retries(s34, monkeypatch):
    commons(monkeypatch)
    wiki = Wiki(monkeypatch)
    wiki.tick(S34_REV, epoch("2026-01-01T00:00:00Z"), event={"backfill": True})

    assert len(perfs(s34, "EP#dwts#34#07")) == 9
    judge = s34_catalog(s34, "JUDGE#cheryl-burke")
    assert "headshot" not in judge and "profiledAt" not in judge

    seen = commons(monkeypatch, CHERYL)
    wiki.tick(S34_REV, epoch("2026-01-01T00:00:00Z"), event={"backfill": True})
    assert s34_catalog(s34, "JUDGE#cheryl-burke")["headshot"]["source"] == "auto"
    calls = len(seen)

    wiki.tick(S34_REV, epoch("2026-01-01T00:00:00Z"), event={"backfill": True})
    assert len(seen) == calls


def test_a_guest_already_in_the_person_index_keeps_their_photo(s34, monkeypatch):
    seen = commons(monkeypatch, CHERYL)
    shot = next(j for j in S34["judges"] if j["id"] == "cheryl-burke")["headshot"]
    s34.Table(CATALOG_TABLE).put_item(
        Item={
            "pk": "PERSON#dwts#cheryl-burke",
            "sk": "META",
            "name": "Cheryl Burke",
            "roles": ["pro"],
            "headshot": shot,
            "seasons": [{"season": 2, "role": "pro", "couple": "drew-lachey"}],
        }
    )
    Wiki(monkeypatch).tick(S34_REV, epoch("2026-01-01T00:00:00Z"), event={"backfill": True})

    assert seen == []
    assert s34_catalog(s34, "JUDGE#cheryl-burke")["headshot"] == shot
    person = item(s34, "PERSON#dwts#cheryl-burke")
    assert person["roles"] == ["judge", "pro"]
    assert [s["role"] for s in person["seasons"]] == ["pro", "judge"]


def test_a_name_that_leads_to_no_person_is_marked_and_left_to_initials(s34, monkeypatch):
    commons(monkeypatch, {**CHERYL, "summary": {**CHERYL["summary"], "type": "disambiguation"}})
    Wiki(monkeypatch).tick(S34_REV, epoch("2026-01-01T00:00:00Z"), event={"backfill": True})

    judge = s34_catalog(s34, "JUDGE#cheryl-burke")
    assert "headshot" not in judge and judge["profiledAt"]
    person = item(s34, "PERSON#dwts#cheryl-burke")
    assert person["bio"] is None and person["headshot"] is None


def test_a_non_free_photo_gives_a_bio_and_no_headshot(s34, monkeypatch):
    info = CHERYL["file"]["query"]["pages"][0]["imageinfo"][0]
    meta = {**info["extmetadata"], "LicenseShortName": {"value": "Fair use"}}
    page = {"imagerepository": "local", "imageinfo": [{**info, "extmetadata": meta}]}
    commons(monkeypatch, {**CHERYL, "file": {"query": {"pages": [page]}}})
    Wiki(monkeypatch).tick(S34_REV, epoch("2026-01-01T00:00:00Z"), event={"backfill": True})

    assert "headshot" not in s34_catalog(s34, "JUDGE#cheryl-burke")
    assert item(s34, "PERSON#dwts#cheryl-burke")["bio"]["title"] == "Cheryl Burke"
