import json

from lambdas.seasons_vote.handler import handler
from tests.conftest import CATALOG_TABLE
from tests.events import authorized_event


def call() -> dict:
    res = handler(authorized_event(path="/seasons/vote"), None)
    assert res["statusCode"] == 200
    return json.loads(res["body"])["data"]


def test_lists_every_couple_alphabetically_with_its_keyword(catalog):
    data = call()
    assert data["timezone"] == "America/New_York"
    couples = data["couples"]
    assert len(couples) == 16
    assert [c["celebrity"] for c in couples[:3]] == [
        "Amber Glenn",
        "Ciara Miller",
        "Conner Leavitt",
    ]
    assert couples[0] == {
        "cid": "amber-glenn",
        "celebrity": "Amber Glenn",
        "pro": "Pasha Pashkov",
        "keyword": "Amber",
    }


def test_never_says_who_was_eliminated(catalog):
    for couple in call()["couples"]:
        assert set(couple) == {"cid", "celebrity", "pro", "keyword"}


def test_episodes_carry_the_air_window(catalog):
    episodes = call()["episodes"]
    assert episodes[5] == {"ep": 6, "airDate": "2026-10-13", "start": "20:00", "end": "22:00"}
    assert [e["ep"] for e in episodes] == list(range(1, len(episodes) + 1))


def test_override_beats_the_derived_keyword(catalog, aws):
    aws.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#dwts#35", "sk": "CONTESTANT#connor-wood"},
        UpdateExpression="SET keywordOverride = :k",
        ExpressionAttributeValues={":k": "CONNOR W"},
    )
    keywords = {c["cid"]: c["keyword"] for c in call()["couples"]}
    assert keywords["connor-wood"] == "CONNOR W"
    assert keywords["conner-leavitt"] == "Conner"
