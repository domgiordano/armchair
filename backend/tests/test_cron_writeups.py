import json
from datetime import date
from decimal import Decimal

import boto3
import pytest

from lambdas.common import claude, recaps, wiki_fetch
from lambdas.cron_writeups import handler as cron
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, PERFORMANCES_TABLE, WRITEUPS_TABLE

SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
PANEL = SEASON["defaultPanel"]
EP4 = "EP#dwts#35#04"
CITED = "https://people.com/dancing-with-the-stars-recap-yacht-rock-week-12148213"
GUESS = "https://www.goldderby.com/reality-tv/2026/dancing-with-the-stars-season-35-recap-yacht-rock-night/"
WIKI = f"""
=== Week 3: Yacht Rock Night ===
Couples danced.<ref>{{{{Cite news |url={CITED} |work=People}}}}</ref>
=== Week 4: Mariah Carey Night ===
"""
ARTICLE = (
    "Read on for the recap.\n"
    "Amber Glenn and pro partner Pasha Pashkov\n"
    "Performance: Foxtrot to Hold the Line by Toto\n"
    "Carrie Ann's comments: \"I'm seeing true growth.\" It was poetic.\n"
    "Julia Stiles and pro partner Ezra Sosa\n"
    "Performance: Salsa\n"
)


def perf(cid: str, values=(8, 8, 8), state="confirmed") -> dict:
    return {
        "pk": EP4,
        "sk": f"PERF#{cid}#1",
        "contestants": [cid],
        "rateable": True,
        "style": "Foxtrot",
        "song": "Hold the Line",
        "judges": {j: {"value": Decimal(v), "state": state} for j, v in zip(PANEL, values)},
    }


def response(writeups: list[dict], usage=None) -> dict:
    return {
        "model": claude.MODEL,
        "stop_reason": "tool_use",
        "content": [
            {"type": "tool_use", "name": "record_writeups", "input": {"writeups": writeups}}
        ],
        "usage": usage or {"input_tokens": 9000, "output_tokens": 1200},
    }


AMBER = {
    "key": "amber-glenn#1",
    "summary": "Amber and Pasha danced a foxtrot with real poise.",
    "judges": [{"judge": "carrie-ann-inaba", "paraphrase": "Saw growth.", "quote": "true growth"}],
    "highlights": ["Poise"],
    "sources": [CITED],
}


class Stubs:
    def __init__(self, monkeypatch):
        self.bodies: list[dict] = []
        self.fetched: list[str] = []
        self.reply = response([AMBER])
        self.articles = {CITED: ARTICLE}
        monkeypatch.setattr(claude, "_key", "test-key")
        monkeypatch.setattr(claude, "messages", self.messages)
        monkeypatch.setattr(recaps, "fetch", self.fetch)
        monkeypatch.setattr(wiki_fetch, "latest", lambda title: {"content": WIKI})
        monkeypatch.setattr(cron, "datetime", Frozen)

    def messages(self, body):
        self.bodies.append(body)
        return self.reply

    def fetch(self, url):
        self.fetched.append(url)
        text = self.articles.get(url)
        if text is None:
            return {"url": url, "status": 404, "title": "", "text": ""}
        return {"url": url, "status": 200, "title": "Recap", "text": text}


class Frozen:
    @staticmethod
    def now(tz):
        from datetime import datetime

        return datetime(2026, 9, 30, 9, 0, tzinfo=tz)


@pytest.fixture
def stubs(aws, monkeypatch):
    write(aws.Table(CATALOG_TABLE), items(SEASON))
    perfs = aws.Table(PERFORMANCES_TABLE)
    perfs.put_item(Item=perf("amber-glenn"))
    perfs.put_item(Item=perf("julia-stiles", (6, 7, 6), state="provisional"))
    return Stubs(monkeypatch)


def stored() -> dict:
    rows = boto3.resource("dynamodb").Table(WRITEUPS_TABLE).scan()["Items"]
    return {r["sk"]: r for r in rows}


def test_scheduled_run_writes_the_confirmed_dances_of_last_nights_episode(stubs):
    out = cron.handler({}, None)
    # Ep 3 aired 9/22, more than WINDOW_DAYS back.
    assert [(e["ep"], e["status"]) for e in out["episodes"]] == [(4, "written")]

    (body,) = stubs.bodies
    text = body["messages"][0]["content"]
    assert 'key="amber-glenn#1"' in text and "julia-stiles" not in text
    assert stubs.fetched == [CITED, GUESS]

    rows = stored()
    item = rows["PERF#amber-glenn#1"]
    assert item["summary"] == AMBER["summary"]
    assert item["judges"] == [
        {"judge": "carrie-ann-inaba", "text": "Saw growth.", "quote": "true growth"}
    ]
    assert item["model"] == claude.MODEL
    assert "PERF#julia-stiles#1" not in rows
    meta = rows["META"]
    assert meta["spentUsd"] == Decimal("0.06")
    assert meta["inputTokens"] == 9000 and meta["runs"] == 1


def test_a_second_run_pays_nothing_for_dances_already_written(stubs):
    cron.handler({}, None)
    cron.handler({}, None)
    assert len(stubs.bodies) == 1


def test_force_rewrites_and_adds_to_the_spend(stubs):
    cron.handler({}, None)
    cron.handler({"backfill": True, "season": "dwts-35", "weeks": [3], "force": True}, None)
    assert len(stubs.bodies) == 2
    assert stored()["META"]["spentUsd"] == Decimal("0.12")


def test_the_cap_stops_a_call_before_it_is_made(stubs, aws):
    aws.Table(WRITEUPS_TABLE).put_item(
        Item={"pk": EP4, "sk": "META", "spentUsd": Decimal(str(cron.EPISODE_CAP - 0.01))}
    )
    out = cron.handler({"backfill": True, "season": "dwts-35", "weeks": [3]}, None)
    assert out["episodes"][0]["status"] == "over cap"
    assert stubs.bodies == []


def test_no_recap_yet_spends_nothing(stubs):
    stubs.articles = {}
    out = cron.handler({"backfill": True, "season": "dwts-35", "weeks": [3]}, None)
    assert out["episodes"][0]["status"] == "no recaps yet"
    assert stubs.bodies == []


def test_backfill_takes_weeks_and_skips_what_hasnt_aired():
    eps = [
        {"sk": "EP#04", "week": 3, "airDate": "2026-09-29"},
        {"sk": "EP#05", "week": 4, "airDate": "2026-10-06"},
        {"sk": "EP#01", "week": 1, "airDate": "2026-09-15"},
    ]
    today = date(2026, 10, 3)
    assert [e["sk"] for e in cron.due(eps, today, [1, 3, 4])] == ["EP#04", "EP#01"]
    assert [e["sk"] for e in cron.due(eps, today, None)] == ["EP#04"]


def test_seasons_before_35_are_never_written(stubs):
    out = cron.handler({"backfill": True, "season": "dwts-34", "weeks": [1]}, None)
    assert out == {"episodes": []}


def test_a_refusal_fails_the_run_after_recording_the_spend(stubs):
    stubs.reply = {**response([]), "stop_reason": "refusal", "content": []}
    with pytest.raises(RuntimeError, match=r"episodes \[4\]"):
        cron.handler({"backfill": True, "season": "dwts-35", "weeks": [3]}, None)
    rows = stored()
    assert rows["META"]["runs"] == 1
    assert "PERF#amber-glenn#1" not in rows


def test_a_missing_api_key_fails_loudly_before_any_work(aws, monkeypatch, caplog):
    monkeypatch.setattr(claude, "_key", None)
    calls = []
    monkeypatch.setattr(wiki_fetch, "latest", lambda title: calls.append(title))
    with pytest.raises(Exception, match="ParameterNotFound"):
        cron.handler({}, None)
    assert calls == []


def test_the_key_comes_from_the_secure_string(aws, monkeypatch):
    monkeypatch.setattr(claude, "_key", None)
    boto3.client("ssm").put_parameter(Name=claude.KEY_PARAM, Type="SecureString", Value="sk-test")
    assert claude.api_key() == "sk-test"
