import json
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

from lambdas.common.wiki_parse import parse_week
from scripts.seed_season import SEASONS, items, write

FIXTURES = Path(__file__).parents[2] / "fixtures"
SEASON = json.loads((SEASONS / "dwts-35.json").read_text())
PK = "SEASON#dwts#35"


@pytest.fixture
def table(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    with mock_aws():
        yield boto3.resource("dynamodb").create_table(
            TableName="armchair-catalog",
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )


def test_one_partition_with_every_item_plus_the_season_index():
    rows = items(SEASON)
    index = [r for r in rows if r["pk"] == "SEASONS#dwts"]
    assert index == [
        {
            "pk": "SEASONS#dwts",
            "sk": "SEASON#035",
            "id": "dwts-35",
            "number": 35,
            "year": 2026,
            "current": True,
        }
    ]
    rows = [r for r in rows if r["pk"] != "SEASONS#dwts"]
    sks = [r["sk"] for r in rows]
    assert {r["pk"] for r in rows} == {PK}
    assert len(sks) == len(set(sks)) == 1 + 12 + 3 + 16
    assert [s for s in sks if s.startswith("EP#")] == [f"EP#{n:02d}" for n in range(1, 13)]


def test_premiere_is_two_episodes_of_week_one():
    eps = {r["sk"]: r for r in items(SEASON) if r["sk"].startswith("EP#")}
    assert [eps["EP#01"]["week"], eps["EP#02"]["week"], eps["EP#12"]["week"]] == [1, 1, 11]
    assert eps["EP#09"]["airDate"] == "2026-11-02"


def test_catalog_aliases_resolve_every_row_the_parser_has_seen():
    golden = json.loads((FIXTURES / "wiki-golden.json").read_text())
    aliases = {a: c["id"] for c in SEASON["contestants"] for a in c["aliases"]}
    assert aliases == golden["aliases"]["s35"]

    wikitext = (FIXTURES / "wiki" / "s35-1377681547.wikitext").read_text()
    judges = [a for j in SEASON["judges"] for a in j["aliases"]]
    for week in (1, 2, 3, 4):
        parsed = parse_week(wikitext, week, aliases)
        assert parsed["rejected"] == []
        assert parsed["panel"] == judges


def test_premiere_nights_list_the_couples_the_page_puts_on_each_night():
    aliases = {a: c["id"] for c in SEASON["contestants"] for a in c["aliases"]}
    wikitext = (FIXTURES / "wiki" / "s35-1377681547.wikitext").read_text()
    parsed = parse_week(wikitext, 1, aliases)["performances"]
    for e in SEASON["episodes"][:2]:
        danced = [f"{p['contestants'][0]}#{p['n']}" for p in parsed if p["night"] == e["ep"]]
        assert sorted(e["rateableKeys"]) == sorted(danced) and len(danced) == 8
    assert all("rateableKeys" not in e for e in SEASON["episodes"][2:])


def test_reseed_replaces_rateable_keys(table):
    rows = items(SEASON)
    table.put_item(Item={"pk": PK, "sk": "EP#01", "week": 1})
    write(table, rows)
    ep = table.get_item(Key={"pk": PK, "sk": "EP#01"})["Item"]
    assert len(ep["rateableKeys"]) == 8


def test_reseed_keeps_what_the_poller_and_admins_wrote(table):
    rows = items(SEASON)
    write(table, rows)
    table.update_item(
        Key={"pk": PK, "sk": "CONTESTANT#connor-wood"},
        UpdateExpression="SET keywordOverride = :k, eliminatedEp = :e",
        ExpressionAttributeValues={":k": "CONNORW", ":e": 7},
    )
    table.update_item(
        Key={"pk": PK, "sk": "EP#06"},
        UpdateExpression="SET panel = :p, theme = :t",
        ExpressionAttributeValues={":p": ["derek-hough", "guest"], ":t": "typo"},
    )

    write(table, rows)

    connor = table.get_item(Key={"pk": PK, "sk": "CONTESTANT#connor-wood"})["Item"]
    ep = table.get_item(Key={"pk": PK, "sk": "EP#06"})["Item"]
    assert (connor["keyword"], connor["keywordOverride"], connor["eliminatedEp"]) == (
        "Connor",
        "CONNORW",
        7,
    )
    assert (ep["panel"], ep["theme"]) == (["derek-hough", "guest"], "Super Bowl")


def test_unknowns_are_stored_as_null(table):
    write(table, items(SEASON))
    ep = table.get_item(Key={"pk": PK, "sk": "EP#12"})["Item"]
    assert ep["panel"] is None and ep["dancesPerCouple"] is None
