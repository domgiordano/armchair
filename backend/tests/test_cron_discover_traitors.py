import io
import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from lambdas.common import wiki_fetch
from lambdas.cron_discover_traitors import handler as discover
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE

WIKI = Path(__file__).parents[2] / "fixtures" / "wiki"
MAIN = {
    "The Traitors (American TV series)": "traitors-main-tus-1377133951",
    "The Traitors (British TV series)": "traitors-main-tuk-1377988096",
    "The Celebrity Traitors": "traitors-main-tukc-1377995051",
}
# Real page ids. Titles left out here answer as missing pages.
TITLES = {
    "The Traitors (American TV series) season 2": 74875887,
    "The Traitors (American TV series) season 4": 80203898,
    "The Traitors: New Blood": 83493607,
    "The Traitors (American TV series) season 6": 84275548,
    "The Traitors (British TV series) series 4": 81850550,
    "The Celebrity Traitors series 1": 79971012,
    "The Celebrity Traitors series 2": 83087125,
}
REDIRECTS = {"The Traitors (American TV series) season 5": "The Traitors: New Blood"}
PAGES = {
    80203898: "traitors-us4-1376576846",
    83493607: "traitors-us5-1377883386",
    81850550: "traitors-uk4-1374211799",
    79971012: "traitors-ukc1-1378003069",
    83087125: "traitors-ukc2-1378006453",
}
# US season 6 as it stands: announced, no cast table, no dated episodes.
NO_CAST = "'''''The Traitors''''' season 6 is an upcoming season.\n==Production==\nTBA\n"
# A cast row whose name cell parses empty, as US season 2's did at rev 1376555148.
BLANK_NAME = (
    '==Contestants==\n{| class="wikitable"\n! Contestant !! Affiliation !! Finish\n'
    "|-\n! \n| Faithful || Winner\n|}\n"
)
CONTENT = {74875887: BLANK_NAME}


def fake_urlopen(req, timeout):
    q = {k: v[0] for k, v in parse_qs(urlparse(req.full_url).query).items()}
    if q.get("prop") == "revisions":
        if "titles" in q:
            title, content = q["titles"], (WIKI / f"{MAIN[q['titles']]}.wikitext").read_text()
        else:
            pageid = int(q["pageids"])
            title = next(t for t, i in TITLES.items() if i == pageid)
            if pageid in PAGES:
                content = (WIKI / f"{PAGES[pageid]}.wikitext").read_text()
            else:
                content = CONTENT.get(pageid, NO_CAST)
        rev = {"revid": 1, "timestamp": "t", "slots": {"main": {"content": content}}}
        body = {"pages": [{"title": title, "revisions": [rev]}]}
    else:
        asked = q["titles"].split("|")
        targets = {REDIRECTS.get(t, t) for t in asked}
        body = {
            "redirects": [{"from": t, "to": REDIRECTS[t]} for t in asked if t in REDIRECTS],
            "pages": [
                {"pageid": TITLES[t], "title": t} if t in TITLES else {"title": t, "missing": True}
                for t in targets
            ],
        }
    return io.BytesIO(json.dumps({"query": body}).encode())


@pytest.fixture
def run(aws, monkeypatch, capsys):
    monkeypatch.setattr(wiki_fetch, "urlopen", fake_urlopen)

    def at(when: str) -> dict[str, dict]:
        t = datetime.strptime(when, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC).timestamp()
        monkeypatch.setattr(discover.time, "time", lambda: t)
        capsys.readouterr()
        discover.handler({}, None)
        lines = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
        return {line["show"]: line for line in lines}

    return at


def item(aws, pk: str, sk: str) -> dict | None:
    return aws.Table(CATALOG_TABLE).get_item(Key={"pk": pk, "sk": sk}).get("Item")


def everything(aws) -> list[dict]:
    rows = aws.Table(CATALOG_TABLE).scan()["Items"]
    return sorted(rows, key=lambda r: (r["pk"], r["sk"]))


def test_renamed_season_found_and_no_cast_skipped(aws, run):
    logs = run("2026-10-02T06:00:00Z")
    assert logs["tus"] == {
        "show": "tus",
        "found": [1, 2, 3, 4, 5, 6],
        "seeded": [4, 5],
        "refreshed": [],
        "skipped": [1, 3, 6],
        "failed": [{"season": 2, "error": "IndexError('list index out of range')"}],
        "published": [4],
        "current": "tus-5",
    }
    meta = item(aws, "SEASON#tus#5", "META")
    assert (meta["pageid"], meta["wikiTitle"]) == (83493607, "The Traitors: New Blood")
    assert meta["openAt"] == "2026-10-02T06:00:00Z"
    assert item(aws, "SEASON#tus#5", "PLAYER#abbey-benjamin")["name"] == "Abbey Benjamin"
    assert (
        aws.Table(CATALOG_TABLE).query(
            KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": "SEASON#tus#6"}
        )["Items"]
        == []
    )
    assert item(aws, "SEASONS#tus", "SEASON#006") is None
    assert (logs["tuk"]["seeded"], logs["tuk"]["current"]) == ([4], "tuk-4")
    assert (logs["tukc"]["seeded"], logs["tukc"]["current"]) == ([1, 2], "tukc-2")


def test_current_flips_at_t_minus_7_days(aws, run):
    # New Blood episode 1 releases 2026-09-18T00:00:00Z.
    assert run("2026-09-10T06:00:00Z")["tus"]["current"] == "tus-4"
    assert item(aws, "SEASON#tus#4", "META")["current"] is True
    assert item(aws, "SEASONS#tus", "SEASON#004")["current"] is True
    assert item(aws, "SEASONS#tus", "SEASON#005")["current"] is False

    logs = run("2026-09-11T06:00:00Z")
    assert (logs["tus"]["seeded"], logs["tus"]["current"]) == ([], "tus-5")
    assert item(aws, "SEASON#tus#5", "META")["current"] is True
    assert item(aws, "SEASONS#tus", "SEASON#005")["current"] is True
    assert item(aws, "SEASON#tus#4", "META")["current"] is False
    assert item(aws, "SEASONS#tus", "SEASON#004")["current"] is False
    # Celebrity series 2's episode 1 is 2026-10-01: series 1 holds the flag until 9/24.
    assert logs["tukc"]["current"] == "tukc-1"
    assert item(aws, "SEASON#tus#5", "META")["openAt"] == "2026-09-10T06:00:00Z"


def test_rerun_is_idempotent(aws, run):
    run("2026-10-02T06:00:00Z")
    before = everything(aws)
    logs = run("2026-10-02T06:00:00Z")
    assert everything(aws) == before
    assert (logs["tus"]["seeded"], logs["tus"]["refreshed"]) == ([], [4, 5])


def test_refresh_keeps_season_settings_and_poller_writes(aws, run):
    run("2026-10-02T06:00:00Z")
    catalog = aws.Table(CATALOG_TABLE)
    catalog.update_item(
        Key={"pk": "SEASON#tus#5", "sk": "META"},
        UpdateExpression="SET releaseTime = :t",
        ExpressionAttributeValues={":t": "21:00"},
    )
    catalog.update_item(
        Key={"pk": "SEASON#tus#5", "sk": "PLAYER#arisa-thomas"},
        UpdateExpression="SET faction = :f",
        ExpressionAttributeValues={":f": "Faithful"},
    )
    run("2026-10-03T06:00:00Z")
    meta = item(aws, "SEASON#tus#5", "META")
    assert (meta["openAt"], meta["releaseTime"]) == ("2026-10-02T06:00:00Z", "21:00")
    # 9 pm EDT on 2026-09-17 is 01:00 UTC.
    assert item(aws, "SEASON#tus#5", "EP#01")["releaseAt"] == "2026-09-18T01:00:00Z"
    assert item(aws, "SEASON#tus#5", "PLAYER#arisa-thomas")["faction"] == "Faithful"


def rt(aws, season: str, ep: int) -> dict | None:
    show, number = season.split("-")
    return (
        aws.Table(PERFORMANCES_TABLE)
        .get_item(Key={"pk": f"EP#{show}#{number}#{ep:02d}", "sk": "EVT#RT"})
        .get("Item")
    )


def test_new_past_season_is_published_and_indexed(aws, run):
    run("2026-10-02T06:00:00Z")
    assert rt(aws, "tus-4", 2)["state"] == "confirmed"
    rob = item(aws, "SEASON#tus#4", "PLAYER#rob-rausch")
    assert (rob["exit"], rob["faction"]) == ({"ep": 11, "how": "winner"}, "Traitor")
    assert item(aws, "PERSON#tus#rob-rausch", "META")["seasons"] == [
        {"season": 4, "faction": "Traitor", "finish": {"how": "winner", "ep": 11}}
    ]
    # The current season is the poller's: nothing published here, and listed bare.
    assert rt(aws, "tus-5", 2) is None
    assert item(aws, "PERSON#tus#abbey-benjamin", "META")["seasons"] == [{"season": 5}]
    assert item(aws, "PEOPLE#tus", "PERSON#abbey-benjamin")["seasons"] == [5]
    assert item(aws, "PERSON#tukc#alan-carr", "META")["seasons"][0]["finish"] == {
        "how": "winner",
        "ep": 9,
    }


def test_season_closed_by_the_flip_is_published(aws, run):
    logs = run("2026-09-10T06:00:00Z")
    assert logs["tus"]["published"] == []
    assert rt(aws, "tus-4", 2) is None
    assert item(aws, "PERSON#tus#rob-rausch", "META")["seasons"] == [{"season": 4}]

    logs = run("2026-09-11T06:00:00Z")
    assert logs["tus"]["published"] == [4]
    assert rt(aws, "tus-4", 2)["state"] == "confirmed"
    assert item(aws, "PERSON#tus#rob-rausch", "META")["seasons"][0]["faction"] == "Traitor"
    assert run("2026-09-12T06:00:00Z")["tus"]["published"] == []


def d(day: str) -> datetime:
    return datetime.fromisoformat(day).replace(tzinfo=UTC)


def test_current_season_rule():
    releases = {
        4: [d("2026-01-09"), d("2026-02-27")],
        5: [d("2026-09-18"), d("2026-11-20")],
        6: [],
    }
    assert discover.current_season(releases, d("2026-03-05")) == 4
    assert discover.current_season(releases, d("2026-09-10")) == 4
    assert discover.current_season(releases, d("2026-09-11")) == 5
    assert discover.current_season(releases, d("2027-06-01")) == 5
    assert discover.current_season({6: []}, d("2027-06-01")) is None
