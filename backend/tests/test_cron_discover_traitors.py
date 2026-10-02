import io
import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from lambdas.common import wiki_fetch
from lambdas.cron_discover_traitors import handler as discover
from lambdas.people_search import handler as search
from lambdas.traitors_player.handler import handler as player_handler
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE
from tests.events import authorized_event
from tests.social import call

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
# A finished season standing in for US season 3: Dorinda Medley played 3 and 4.
US3 = """==Contestants==
{| class="wikitable"
! Contestant !! Affiliation !! Finish
|-
! {{sortname|Dorinda|Medley|Dorinda Medley}}
| Faithful || Banished<br><small>(Episode 2)</small>
|-
! Sam Nobody
| Traitor || Winner<br><small>(Episode 2)</small>
|}
{{Episode list
| EpisodeNumber2 = 1
| OriginalAirDate = {{Start date|2025|1|9}}
}}
{{Episode list
| EpisodeNumber2 = 2
| OriginalAirDate = {{Start date|2025|1|16}}
}}
"""
TITLES["The Traitors (American TV series) season 3"] = 3
CONTENT = {74875887: BLANK_NAME, 3: US3}
# Linked articles with no page behind them.
NO_ARTICLE = {"Rob Rausch"}
SEASON_LEAD = "{} is a season."
EXTRACT_CALLS: list[dict] = []


def extracts(q: dict) -> dict:
    EXTRACT_CALLS.append(q)
    if "pageids" in q:
        pageid = int(q["pageids"])
        title = next(t for t, i in TITLES.items() if i == pageid)
        lead = SEASON_LEAD.format(title)
        return {"pages": [{"pageid": pageid, "title": title, "extract": lead}]}
    asked = q["titles"].split("|")
    return {
        "pages": [
            {"title": t, "missing": True}
            if t in NO_ARTICLE
            else {"pageid": 1, "title": t, "extract": f"\n{t} is a person.\n"}
            for t in asked
        ]
    }


def fake_urlopen(req, timeout):
    q = {k: v[0] for k, v in parse_qs(urlparse(req.full_url).query).items()}
    if q.get("prop") == "extracts":
        body = extracts(q)
    elif q.get("prop") == "revisions":
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
    EXTRACT_CALLS.clear()

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
        "seeded": [3, 4, 5],
        "refreshed": [],
        "skipped": [1, 6],
        "failed": [{"season": 2, "error": "IndexError('list index out of range')"}],
        "published": [3, 4],
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
    assert (logs["tus"]["seeded"], logs["tus"]["refreshed"]) == ([], [3, 4, 5])


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
    # Season 3 is published because it is new, not because of the flip.
    assert logs["tus"]["published"] == [3]
    assert rt(aws, "tus-4", 2) is None
    assert item(aws, "PERSON#tus#rob-rausch", "META")["seasons"] == [{"season": 4}]

    logs = run("2026-09-11T06:00:00Z")
    assert logs["tus"]["published"] == [4]
    assert rt(aws, "tus-4", 2)["state"] == "confirmed"
    assert item(aws, "PERSON#tus#rob-rausch", "META")["seasons"][0]["faction"] == "Traitor"
    assert run("2026-09-12T06:00:00Z")["tus"]["published"] == []


def test_past_season_seeded_but_never_published_is_published(aws, run):
    run("2026-10-02T06:00:00Z")
    catalog = aws.Table(CATALOG_TABLE)
    for p in catalog.query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": "SEASON#tus#4"}
    )["Items"]:
        if p["sk"].startswith("PLAYER#"):
            catalog.update_item(
                Key={"pk": p["pk"], "sk": p["sk"]},
                UpdateExpression="REMOVE #e",
                ExpressionAttributeNames={"#e": "exit"},
            )
    logs = run("2026-10-03T06:00:00Z")
    assert logs["tus"]["published"] == [4]
    assert item(aws, "SEASON#tus#4", "PLAYER#rob-rausch")["exit"] == {"ep": 11, "how": "winner"}
    assert run("2026-10-04T06:00:00Z")["tus"]["published"] == []


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


def test_summary_and_bios_are_stored(aws, run):
    run("2026-10-02T06:00:00Z")
    assert item(aws, "SEASON#tus#5", "META")["summary"] == {
        "text": "The Traitors: New Blood is a season.",
        "sourceUrl": "https://en.wikipedia.org/wiki/The_Traitors:_New_Blood",
    }
    xavier = item(aws, "SEASON#tus#5", "PLAYER#xavier-scruggs")
    assert (xavier["article"], xavier["bio"]) == (
        "Xavier Scruggs",
        {
            "text": "Xavier Scruggs is a person.",
            "sourceUrl": "https://en.wikipedia.org/wiki/Xavier_Scruggs",
        },
    )
    kim = item(aws, "SEASON#tus#5", "PLAYER#kim-daily")
    assert (kim["article"], kim["bio"]) == (None, None)
    # Linked, but no such article.
    rob = item(aws, "SEASON#tus#4", "PLAYER#rob-rausch")
    assert (rob["article"], rob["bio"]) == ("Rob Rausch", None)
    natalie = item(aws, "PERSON#tus#natalie-anderson", "META")
    assert natalie["article"] == "Natalie Anderson (television personality)"
    assert natalie["bio"]["sourceUrl"] == (
        "https://en.wikipedia.org/wiki/Natalie_Anderson_(television_personality)"
    )


def test_extracts_are_batched(aws, run):
    run("2026-10-02T06:00:00Z")
    assert all(q["exlimit"] == "20" and q["exintro"] == "1" for q in EXTRACT_CALLS)
    # One lead per seeded season: tus 3, 4, 5, tuk 4, tukc 1, 2.
    assert sum("pageids" in q for q in EXTRACT_CALLS) == 6
    # Per season, its linked cast at most 20 to a call: US 4 and Celebrity 2 link 21.
    sizes = sorted(len(q["titles"].split("|")) for q in EXTRACT_CALLS if "titles" in q)
    assert sizes == [1, 1, 1, 1, 1, 19, 20, 20]


def test_summary_is_refetched(aws, run, monkeypatch):
    run("2026-10-02T06:00:00Z")
    monkeypatch.setitem(globals(), "SEASON_LEAD", "{} was edited.")
    run("2026-10-03T06:00:00Z")
    assert item(aws, "SEASON#tus#4", "META")["summary"]["text"] == (
        "The Traitors (American TV series) season 4 was edited."
    )


def test_one_person_per_edition_across_seasons(aws, run):
    run("2026-10-02T06:00:00Z")
    dorinda = item(aws, "PERSON#tus#dorinda-medley", "META")
    assert dorinda["seasons"] == [
        {"season": 3, "faction": "Faithful", "finish": {"how": "banished", "ep": 2}},
        {"season": 4, "faction": "Faithful", "finish": {"how": "murdered", "ep": 9}},
    ]
    assert item(aws, "PEOPLE#tus", "PERSON#dorinda-medley")["seasons"] == [3, 4]
    status, body = call(
        player_handler,
        authorized_event(path="/traitors/player", query={"show": "tus", "id": "dorinda-medley"}),
    )
    assert status == 200
    assert [s["season"] for s in body["data"]["seasons"]] == ["tus-3", "tus-4"]
    assert body["data"]["bio"]["text"] == "Dorinda Medley is a person."


@pytest.mark.parametrize(
    "show,q,expected",
    [
        ("tus", "dorinda", [("dorinda-medley", [3, 4])]),
        ("tus", "sam nob", [("sam-nobody", [3])]),
        ("tus", "rausch", [("rob-rausch", [4])]),
        ("tuk", "duffy", [("rachel-duffy", [4])]),
        ("tukc", "alan carr", [("alan-carr", [1])]),
        ("tukc", "jerry hall", [("jerry-hall", [2])]),
    ],
)
def test_people_search_finds_every_seeded_season(aws, run, show, q, expected):
    run("2026-10-02T06:00:00Z")
    status, body = call(
        search.handler, authorized_event(path="/people/search", query={"show": show, "q": q})
    )
    assert status == 200
    assert [(p["id"], p["seasons"]) for p in body["data"]["players"]] == expected
