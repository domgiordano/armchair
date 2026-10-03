"""Recaps, bios, ballots, shields and a player's story: parsed, fetched, published, gated."""

import io
import json
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from lambdas.common import fandom, official, traitors_about
from lambdas.common.traitors_parse import season
from lambdas.common.traitors_publish import PUBLISHED
from lambdas.cron_poll_traitors import handler as poller
from lambdas.traitors_episode.handler import handler as episode_handler
from lambdas.traitors_player.handler import handler as player_handler
from lambdas.traitors_season.handler import handler as season_handler
from tests.conftest import BOARD_TABLE, CATALOG_TABLE, PERFORMANCES_TABLE, SCORES_TABLE
from tests.events import SUB
from tests.test_traitors_history import backfill, get, index, world

WIKI = Path(__file__).parents[2] / "fixtures" / "wiki"


@pytest.fixture
def db(aws, monkeypatch):
    return world(aws, monkeypatch)


def parse(name: str) -> dict:
    return season((WIKI / f"{name}.wikitext").read_text())


# Hand-copied from the US season 4 fixture's Voting history, the Episode 2 column of each
# player row (lines 426-660). Rob R.'s and Maura's rows, for example, read `| Porsha`.
US4_EP2 = {
    "Rob Rausch": "Porsha Williams",
    "Maura Higgins": "Porsha Williams",
    "Eric Nam": "Porsha Williams",
    "Tara Lipinski": "Donna Kelce",
    "Johnny Weir": "Donna Kelce",
    "Mark Ballas": "Porsha Williams",
    "Natalie Anderson": "Donna Kelce",
    "Kristen Kish": "Donna Kelce",
    "Stephen Colletti": "Porsha Williams",
    "Dorinda Medley": "Donna Kelce",
    "Candiace Dillard Bassett": "Donna Kelce",
    "Colton Underwood": "Porsha Williams",
    "Lisa Rinna": "Porsha Williams",
    'Yamil "Yam Yam" Arocho': "Michael Rapaport",
    "Ron Funches": "Porsha Williams",
    "Michael Rapaport": "Porsha Williams",
    "Monét X Change": "Michael Rapaport",
    "Tiffany Mitchell": "Michael Rapaport",
    "Caroline Stanbury": "Donna Kelce",
    "Donna Kelce": "Porsha Williams",
    "Rob Cesternino": "Michael Rapaport",
    "Porsha Williams": "Donna Kelce",
}


def test_ballots_per_voter():
    rt = next(rt for rt in parse("traitors-us4-1376576846")["roundTables"] if rt["ep"] == 2)
    assert rt["ballots"] == US4_EP2
    assert rt["daggers"] == []


def test_dagger_ballot_is_one_ballot_counted_twice():
    # `Natalie (2x){{efn|Rob R. won the Dagger...}}` in Rob R.'s Episode 10 cell.
    rt = next(rt for rt in parse("traitors-us4-1376576846")["roundTables"] if rt["ep"] == 10)
    assert rt["ballots"]["Rob Rausch"] == "Natalie Anderson"
    assert rt["daggers"] == ["Rob Rausch"]
    assert rt["firstVote"]["Natalie Anderson"] == 7
    assert len(rt["ballots"]) == 7


def test_shields_by_episode():
    shields = parse("traitors-us4-1376576846")["shields"]
    # The Shield row: episode 2 `Caroline|Colton|{{nowrap|Yam Yam}}`, 3 `None`, 5 `All`.
    assert shields[2] == ["Caroline Stanbury", "Colton Underwood", 'Yamil "Yam Yam" Arocho']
    assert 3 not in shields and 5 not in shields
    # New Blood's `3/4` column is episode 3's mission.
    assert parse("traitors-us5-1377883386")["shields"][3] == ["Clyde Moser"]


def test_short_summaries():
    eps = parse("traitors-ukc2-1378006453")["episodes"]
    assert eps[0]["summary"].startswith("After the contestants meet in the Traitors Church")
    assert "\n\nThe next day, the players succeed in the mission" in eps[0]["summary"]
    # Only a comment asking editors to keep it short.
    assert eps[1]["summary"] == ""
    uk = parse("traitors-uk4-1374211799")["episodes"]
    assert "\n\nShield Mission: The players push three throne-bearing chariots" in uk[1]["summary"]


def test_contestant_basics():
    kim = parse("traitors-us5-1377883386")["contestants"][0]
    # `! ... | Kim Daily` / `| 37` / `| [[Houston, Texas]]` / `| Lawyer`.
    assert kim["about"] == {"age": 37, "hometown": "Houston, Texas", "occupation": "Lawyer"}
    paloma = parse("traitors-ukc1-1378003069")["contestants"][0]
    assert paloma["about"] == {
        "age": 44,
        "hometown": None,
        "occupation": "Singer-songwriter & actress",
    }


# --- Fandom -------------------------------------------------------------------------------

KATIE = """{{Contestant
| image1=US5 Katie Fites.webp
| hometown=Jacksonville, Florida
}}

'''{{PAGENAME}}''' is a Recruited Traitor from {{V|US5}}.

==Profile==
''Retrieved from Entertainment Weekly:''

'''Age:''' 23<br>'''Hometown:''' Jacksonville, Fla.<br>'''Why are you going to win ''The Traitors''?'''<br>I'm gonna win The Traitors because I am a people person. I've been exposed to a lot of different people. I'm incredibly competitive.

==Trivia==
* She was banished in Episode 9.
[[Category:Contestants]]
"""


def fandom_wiki(monkeypatch, pages: dict[str, str], search: dict[str, list[str]] | None = None):
    """urlopen answering api.php from `pages` (title: wikitext) and `search` (query: titles)."""
    calls = []

    def urlopen(req, timeout=None):
        q = {k: v[0] for k, v in parse_qs(urlparse(req.full_url).query).items()}
        calls.append(q)
        if q.get("list") == "search":
            hits = [{"title": t} for t in (search or {}).get(q["srsearch"], [])]
            return io.BytesIO(json.dumps({"query": {"search": hits}}).encode())
        found = [
            {"title": t, "revisions": [{"slots": {"main": {"content": pages[t]}}}]}
            if t in pages
            else {"title": t, "missing": True}
            for t in q["titles"].split("|")
        ]
        return io.BytesIO(json.dumps({"query": {"pages": found}}).encode())

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    return calls


def test_running_season_bio_drops_every_spoiler(monkeypatch):
    fandom_wiki(monkeypatch, {"Katie Fites": KATIE})
    (bio, cut) = fandom.bios("tus", ["Katie Fites"], running=True)["Katie Fites"]
    assert cut is True
    assert bio == {
        "text": "Age: 23. Hometown: Jacksonville, Fla.\n\n"
        "I've been exposed to a lot of different people. I'm incredibly competitive.",
        "source": "fandom",
        "sourceUrl": "https://thetraitors.fandom.com/wiki/Katie_Fites",
    }


def test_finished_season_bio_keeps_the_lead(monkeypatch):
    fandom_wiki(monkeypatch, {"Katie Fites": KATIE})
    (bio, cut) = fandom.bios("tus", ["Katie Fites"], running=False)["Katie Fites"]
    assert cut is False
    assert bio["text"].startswith("Katie Fites is a Recruited Traitor from US5.\n\nAge: 23.")
    assert "banished" not in bio["text"]


@pytest.mark.parametrize(
    "sentence",
    [
        "She was banished in Episode 9.",
        "He was murdered at breakfast.",
        "She won the game.",
        "He was the runner-up.",
        "She became a Traitor.",
        "He received a shield.",
        "She was placed 4th.",
        "He was a finalist.",
    ],
)
def test_scrub_drops_spoilers(sentence):
    kept, cut = fandom.scrub([f"She is a lawyer. {sentence} She won't stop talking."])
    assert (kept, cut) == (["She is a lawyer. She won't stop talking."], True)


def test_player_found_by_nickname_title(monkeypatch):
    calls = fandom_wiki(monkeypatch, {"Yam Yam Arocho": "'''Yam Yam''' is a comedian."})
    found = fandom.players("tus", ['Yamil "Yam Yam" Arocho'])
    assert found['Yamil "Yam Yam" Arocho']["title"] == "Yam Yam Arocho"
    # The variants are asked in one batch; nothing needed a search.
    assert len(calls) == 1


def test_player_found_by_surname_search(monkeypatch):
    calls = fandom_wiki(
        monkeypatch,
        {"Andie Thurmond": "'''Andie''' is a bartender."},
        {"Andie Vanacore": ["Season 1"], "Vanacore": ["Season 1", "Andie Thurmond"]},
    )
    found = fandom.players("tus", ["Andie Vanacore"])
    assert found["Andie Vanacore"]["url"] == "https://thetraitors.fandom.com/wiki/Andie_Thurmond"
    assert [q.get("srsearch") for q in calls if "srsearch" in q] == ["Andie Vanacore", "Vanacore"]


def test_search_never_takes_someone_else(monkeypatch):
    fandom_wiki(monkeypatch, {}, {"Kim Daily": ["Kim Kardashian"], "Daily": ["Daily Mail"]})
    assert fandom.players("tus", ["Kim Daily"]) == {}


def test_allowance_and_failures_stop_quietly(monkeypatch, capsys):
    calls = fandom_wiki(monkeypatch, {"Katie Fites": KATIE})
    fandom.allow(0)
    assert fandom.bios("tus", ["Katie Fites"], running=False) == {}
    assert calls == []

    def down(req, timeout=None):
        raise OSError("503")

    fandom.allow(5)
    monkeypatch.setattr(urllib.request, "urlopen", down)
    assert fandom.bios("tus", ["Katie Fites"], running=False) == {}
    assert "503" in capsys.readouterr().out


EPISODE_PAGE = """{{CustomEpisode|series:=[[Series 4]]}}
This is the second episode of [[Series 4]].

== Summary ==

== Mission ==
Players had to roll three thrones to the castle.

== The Round Table & Traitors’ Murder ==
[[Judy Wilson|Judy]] was banished.

== Trivia ==
* Record votes.
"""


def test_fandom_recap_from_an_episode_page(monkeypatch):
    calls = fandom_wiki(monkeypatch, {"Series 4, Episode 2": EPISODE_PAGE})
    assert fandom.recaps("tuk", 4, [2, 3]) == {
        2: {
            "text": "Players had to roll three thrones to the castle.\n\nJudy was banished.",
            "source": "fandom",
            "sourceUrl": "https://thetraitorsuk.fandom.com/wiki/Series_4,_Episode_2",
        }
    }
    assert len(calls) == 1
    # The US wiki has no episode pages: nothing is asked.
    assert fandom.recaps("tus", 5, [2]) == {}
    assert len(calls) == 1


# --- Network cast pages -------------------------------------------------------------------

BBC = """<h2 id="contents">Meet The Traitors series 4 contestants</h2>
<h2 id="adam">Adam</h2></div><figure><picture><source srcset="
  https://ichef.bbci.co.uk/images/ic/944xn/p0mrg82j.jpg,
  https://ichef.bbci.co.uk/images/ic/1888xn/p0mrg82j.jpg 2x">
<img src="https://ichef.bbci.co.uk/images/ic/400xn/p0mrg82j.jpg"></picture></figure>
<div class="textComponent"><p><strong>Age:</strong> 34</p>
<p><strong>Occupation:</strong> Builder</p>
<p><strong>Why did you apply to be on The Traitors?</strong></p>
<p>Because I love a contest.</p>
<p><strong>Tell us a little bit about yourself and what you will bring to the game.</strong></p>
<p>I'm a very outspoken, dramatic sort of person.</p></div>
<h2 id="judy">Judy</h2><img src="https://ichef.bbci.co.uk/images/ic/400xn/judy.jpg">
<p>I work in fostering. I hope to win as a Faithful.</p>
<h2>Latest from the Media Centre</h2><p>Unrelated.</p>
"""

PEACOCK = """<p><strong>Carsten “Bergie” Bergersen</strong> (<em>Love Island USA</em>)&nbsp;</p>
<div><img src="/sites/peacock/files/bergie.jpg"></div>
<p><strong>Chris 'C.T.' Tamburello </strong>(<em>The Challenge</em>)</p>
<div><img src="/sites/peacock/files/ct.jpg"></div>
<p><strong>Somebody Else</strong> (<em>Host</em>)</p><div><img src="/x.jpg"></div>
"""


def test_bbc_media_pack_entries():
    page = "https://www.bbc.co.uk/mediacentre/mediapacks/the-traitors-series-4-contestants"
    got = official.entries(page, BBC, ["Adam Waughman", "Judy Wilson", "Roxy Wilson"])
    assert got["Adam Waughman"] == {
        "paragraphs": [
            "Age: 34",
            "Occupation: Builder",
            "Why did you apply to be on The Traitors?",
            "Because I love a contest.",
            "Tell us a little bit about yourself and what you will bring to the game.",
            "I'm a very outspoken, dramatic sort of person.",
        ],
        "image": "https://ichef.bbci.co.uk/images/ic/1888xn/p0mrg82j.jpg",
    }
    # Judy's entry ends at the next heading, not at the end of the page.
    assert got["Judy Wilson"]["paragraphs"] == ["I work in fostering. I hope to win as a Faithful."]
    assert "Roxy Wilson" not in got
    bio, cut = official.bio(got["Adam Waughman"]["paragraphs"], page, running=False)
    assert bio["text"] == "Age: 34. Occupation: Builder.\n\nBecause I love a contest."
    assert (bio["source"], bio["sourceUrl"], cut) == ("official", page, False)
    judy, cut = official.bio(got["Judy Wilson"]["paragraphs"], page, running=True)
    assert (judy["text"], cut) == ("I work in fostering.", True)


def test_peacock_post_entries():
    page = "https://www.peacocktv.com/blog/the-traitors-season-2-cast"
    names = ['Carsten "Bergie" Bergersen', 'Chris "CT" Tamburello']
    got = official.entries(page, PEACOCK, names)
    assert got['Carsten "Bergie" Bergersen'] == {
        "paragraphs": [],
        "image": "https://www.peacocktv.com/sites/peacock/files/bergie.jpg",
    }
    assert got['Chris "CT" Tamburello']["image"].endswith("/ct.jpg")


def test_unreachable_cast_page_is_no_source(monkeypatch, capsys):
    assert official.cast("tus", 1, ["Reza Farahan"], running=False) == {}
    assert "peacocktv.com/blog/the-traitors-season-1-cast" in capsys.readouterr().out


# --- The bio chain ------------------------------------------------------------------------

CAST = [
    {"name": "Ann Article", "article": "Ann Article"},
    {"name": "Fan Page", "article": None},
    {"name": "Net Only", "article": None},
    {"name": "Nobody", "article": None},
]
LEAD = {"text": "Ann is an actor.", "sourceUrl": "https://en.wikipedia.org/wiki/Ann_Article"}


@pytest.fixture
def sources(monkeypatch):
    asked = {"fandom": [], "official": []}

    def fan(show, names, running):
        asked["fandom"].append(list(names))
        bio = {"text": "Fan.", "source": "fandom", "sourceUrl": "https://f"}
        return {n: (bio, running) for n in names if n == "Fan Page"}

    def net(show, number, names, running):
        asked["official"].append(list(names))
        bio = {"text": "Net.", "source": "official", "sourceUrl": "https://bbc"}
        return {"Net Only": {"bio": bio, "cut": False, "image": None, "sourceUrl": "https://bbc"}}

    monkeypatch.setattr(fandom, "bios", fan)
    monkeypatch.setattr(official, "cast", net)
    return asked


def test_bio_chain_wikipedia_then_fandom_then_network(sources):
    out = traitors_about.bios("tuk", 4, CAST, {"Ann Article": LEAD}, {}, running=False)
    assert out["Ann Article"] == ({**LEAD, "source": "wikipedia"}, False)
    assert out["Fan Page"][0]["source"] == "fandom"
    assert out["Net Only"][0]["source"] == "official"
    assert out["Nobody"] == (None, False)
    assert sources == {
        "fandom": [["Fan Page", "Net Only", "Nobody"]],
        "official": [["Net Only", "Nobody"]],
    }


def test_finished_season_keeps_a_stored_bio(sources):
    stored = {"text": "Old.", "source": "fandom", "sourceUrl": "https://f"}
    have = {n: {"bio": stored} for n in ("Fan Page", "Net Only", "Nobody")}
    have["Nobody"]["bioCut"] = True
    out = traitors_about.bios("tuk", 4, CAST, {"Ann Article": LEAD}, have, running=False)
    # Only the bio scrubbed while the season ran is fetched again, now whole.
    assert sources["fandom"] == [["Nobody"]]
    assert out["Fan Page"] == (stored, False)


def test_running_season_refetches_daily(sources):
    stored = {"text": "Old.", "source": "fandom", "sourceUrl": "https://f"}
    have = {"Fan Page": {"bio": stored}}
    out = traitors_about.bios("tus", 5, CAST, {}, have, running=True)
    assert sources["fandom"] == [["Ann Article", "Fan Page", "Net Only", "Nobody"]]
    assert out["Fan Page"][1] is True


def test_recaps_prefer_wikipedia_and_keep_what_is_stored(monkeypatch):
    asked = []
    found = {"text": "From Fandom.", "source": "fandom", "sourceUrl": "https://f"}

    def recaps(show, number, eps):
        asked.append(eps)
        return {3: found}

    monkeypatch.setattr(fandom, "recaps", recaps)
    parsed = {
        "episodes": [
            {"n": 1, "summary": "Wiki one."},
            {"n": 2, "summary": ""},
            {"n": 3, "summary": ""},
            {"n": 4, "summary": ""},
        ]
    }
    kept = {"text": "Stored.", "source": "fandom", "sourceUrl": "https://f/2"}
    out = traitors_about.recaps("tuk", 4, "Season page", parsed, {2: kept}, {1, 3})
    assert out[1] == {
        "text": "Wiki one.",
        "source": "wikipedia",
        "sourceUrl": "https://en.wikipedia.org/wiki/Season_page#Episodes",
    }
    assert (out[2], out[3], out[4]) == (kept, found, None)
    # Wikipedia had episode 1, so Fandom is only asked for 3.
    assert asked == [[3]]


# --- Published and gated ------------------------------------------------------------------


def set_recap(aws, number: int, ep: int, text: str) -> None:
    aws.Table(CATALOG_TABLE).update_item(
        Key={"pk": f"SEASON#tus#{number}", "sk": f"EP#{ep:02d}"},
        UpdateExpression="SET recap = :r",
        ExpressionAttributeValues={":r": {"text": text, "source": "wikipedia", "sourceUrl": "u"}},
    )


def answer(aws, ep: int, kinds=("MURDER", "RT", "RECRUIT")) -> None:
    for kind in kinds:
        aws.Table(SCORES_TABLE).put_item(
            Item={"pk": f"EP#tus#5#{ep:02d}", "sk": f"EVT#{kind}#USER#{SUB}", "forfeit": True}
        )


def episode(ep: int) -> dict:
    status, body = get(episode_handler, "/traitors/episode", season="tus-5", ep=f"{ep:02d}")
    assert status == 200
    return body["data"]


def test_recap_waits_for_every_event(db):
    backfill()
    set_recap(db, 5, 2, "Madeline is banished.")
    assert episode(2)["recap"] is None
    answer(db, 2, ("MURDER", "RT"))
    view = episode(2)
    assert view["recap"] is None
    rt = next(c for c in view["events"] if c["type"] == "RT")
    # The round table itself is open, ballots and all: `{{nowrap|Abbey B.}}` / `| Madeline`,
    # `Ben` / `| Victor`.
    ballots = rt["result"]["ballots"]
    assert (ballots["abbey-benjamin"], ballots["ben-mcdonnell"]) == (
        "madeline-kostopulos",
        "victor-vollbrechthausen",
    )
    assert rt["result"]["daggers"] == []
    answer(db, 2)
    assert episode(2)["recap"]["text"] == "Madeline is banished."


def test_locked_round_table_shows_no_ballots(db):
    backfill()
    view = episode(2)
    rt = next(c for c in view["events"] if c["type"] == "RT")
    assert rt["locked"] is True and "result" not in rt


def test_closed_episode_shows_its_recap(db):
    backfill()
    set_recap(db, 5, 1, "They arrive.")
    assert episode(1)["recap"]["text"] == "They arrive."


def test_season_list_never_carries_a_current_recap(db):
    backfill()
    set_recap(db, 5, 1, "They arrive.")
    set_recap(db, 4, 2, "Porsha goes.")
    _, current = get(season_handler, "/traitors/season", season="tus-5")
    assert {e["recap"] for e in current["data"]["episodes"]} == {None}
    _, past = get(season_handler, "/traitors/season", season="tus-4")
    assert past["data"]["episodes"][1]["recap"]["text"] == "Porsha goes."


def story(pid: str) -> list[dict]:
    status, body = get(player_handler, "/traitors/player", show="tus", id=pid)
    assert status == 200
    return body["data"]["story"]


def test_finished_season_story(db):
    backfill("tus-4")
    index(db)
    told = story("michael-rapaport")
    assert [s["ep"] for s in told] == [1, 2, 3, 4, 5]
    assert told[0] == {
        "season": "tus-4",
        "ep": 1,
        "title": told[0]["title"],
        "voted": None,
        "votesReceived": None,
        "shield": False,
        "out": None,
    }
    # Episode 2: his row reads `| Porsha`; Yam Yam, Monét, Tiffany and Rob C. named him.
    assert (told[1]["voted"], told[1]["votesReceived"]) == ("porsha-williams", 4)
    assert told[4]["out"] == {"how": "banished"}
    assert told[4]["votesReceived"] == 11
    colton = story("colton-underwood")
    # The Shield row's episode 2 cell lists Colton.
    assert colton[1]["shield"] is True and colton[2]["shield"] is False


def test_current_season_story_stops_at_the_first_unseen_episode(db):
    backfill()
    index(db)
    # Episode 1 is closed; 2 isn't answered yet, so 3 doesn't show though it is.
    answer(db, 3)
    assert [s["ep"] for s in story("kim-daily")] == [1]
    answer(db, 2)
    told = story("victor-vollbrechthausen")
    assert [s["ep"] for s in told] == [1, 2, 3]
    assert told[0]["shield"] is True
    # Kim was murdered in episode 2: her story ends there, with how.
    kim = story("kim-daily")
    assert [s["ep"] for s in kim] == [1, 2]
    assert kim[1]["out"] == {"how": "murdered"}


def test_player_about_and_bio_source(db):
    backfill("tus-4")
    index(db)
    _, body = get(player_handler, "/traitors/player", show="tus", id="ian-terry")
    assert body["data"]["about"] == {
        "age": 34,
        "hometown": "Houston, Texas",
        "occupation": "Big Brother 14",
    }


def test_ballots_published_beside_a_confirmed_result_leave_points_alone(db, monkeypatch):
    db.Table(SCORES_TABLE).put_item(
        Item={
            "pk": "EP#tus#4#02",
            "sk": "EVT#RT#USER#a",
            "picks": ["porsha-williams", "donna-kelce", "michael-rapaport"],
        }
    )
    backfill("tus-4")
    perf = db.Table(PERFORMANCES_TABLE)
    key = {"pk": "EP#tus#4#02", "sk": "EVT#RT"}
    # As published before ballots were parsed.
    perf.update_item(Key=key, UpdateExpression="REMOVE ballots, daggers")
    before = perf.get_item(Key=key)["Item"]
    board = db.Table(BOARD_TABLE).get_item(Key={"pk": "BOARD#tus#4", "sk": "USER#a"})["Item"]

    # A live poll, with the confirm window: ballots land, the result doesn't restart.
    monkeypatch.setattr(
        poller, "latest", lambda pageid: {"revid": 9, "timestamp": "t", "content": "", "title": ""}
    )
    from lambdas.common.traitors_publish import publish_season
    from tests.test_traitors_history import US4

    rows = db.Table(CATALOG_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": "SEASON#tus#4"}
    )["Items"]
    publish_season("tus", 4, rows, season(US4), 9, poller.epoch("2026-10-10T00:00:00Z"), 180)

    after = perf.get_item(Key=key)["Item"]
    assert after["ballots"]["rob-rausch"] == "porsha-williams"
    assert {k: after[k] for k in ("state", "firstSeenAt", "rev", "value")} == {
        k: before[k] for k in ("state", "firstSeenAt", "rev", "value")
    }
    assert db.Table(BOARD_TABLE).get_item(Key={"pk": "BOARD#tus#4", "sk": "USER#a"})["Item"] == (
        board
    )
    meta = db.Table(CATALOG_TABLE).get_item(Key={"pk": "SEASON#tus#4", "sk": "META"})["Item"]
    assert meta["published"] == PUBLISHED


NB_PAGE = (WIKI / "traitors-us5-1377883386.wikitext").read_text()
EMPTY = "| ShortSummary    = \n"


def summarized(eps: dict[int, str]) -> str:
    """New Blood with ShortSummary text written into the given episodes."""
    parts = NB_PAGE.split(EMPTY)
    out = parts[0]
    for n, part in enumerate(parts[1:], start=1):
        text = eps.get(n)
        out += (f"| ShortSummary    = {text}\n" if text else EMPTY) + part
    return out


@pytest.fixture
def poll(db, monkeypatch):
    asked = []

    def recaps(show, number, eps):
        if eps:
            asked.append(eps)
        return {}

    monkeypatch.setattr(fandom, "recaps", recaps)

    def at(stamp: str, content: str) -> list[list[int]]:
        monkeypatch.setattr(
            poller,
            "latest",
            lambda pageid: {"revid": 4, "timestamp": "t", "content": content, "title": ""},
        )
        monkeypatch.setattr(poller.time, "time", lambda: poller.epoch(stamp))
        poller.handler({}, None)
        return asked

    return at


def recap_of(aws, ep: int) -> dict | None:
    key = {"pk": "SEASON#tus#5", "sk": f"EP#{ep:02d}"}
    return aws.Table(CATALOG_TABLE).get_item(Key=key)["Item"].get("recap")


def test_poller_writes_a_fresh_wikipedia_recap(db, poll):
    # Episode 5 releases 2026-10-09T00:00:00Z: ten minutes later is a live tick.
    page = summarized({1: "They arrive.", 5: "Logan is murdered."})
    poll("2026-10-09T00:10:30Z", page)
    assert recap_of(db, 5)["text"] == "Logan is murdered."
    # Only episodes under 72 hours old are the poller's; discovery has the rest.
    assert recap_of(db, 1) is None


def test_poller_asks_fandom_on_the_hourly_sweep_only(db, poll):
    assert poll("2026-10-09T00:10:30Z", NB_PAGE) == []
    assert poll("2026-10-09T03:00:20Z", NB_PAGE) == [[5]]
