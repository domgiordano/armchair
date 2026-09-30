import json

from lambdas.seasons_get.handler import handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE
from tests.events import authorized_event

SEASON = json.loads((SEASONS / "dwts-35.json").read_text())


def call(query) -> tuple[int, dict]:
    res = handler(authorized_event(path="/seasons/get", query=query), None)
    return res["statusCode"], json.loads(res["body"])


def seed(aws):
    tbl = aws.Table(CATALOG_TABLE)
    write(tbl, items(SEASON))
    tbl.update_item(
        Key={"pk": "SEASON#dwts#35", "sk": "EP#04"},
        UpdateExpression="SET results = :r",
        ExpressionAttributeValues={":r": {"eliminated": ["taylor-hanson"]}},
    )
    return tbl


def test_returns_schedule_roster_and_credits(aws):
    seed(aws)
    status, body = call({"season": "dwts-35"})
    assert status == 200, body
    data = body["data"]
    assert data["season"] == "dwts-35" and data["timezone"] == "America/New_York"
    assert [e["ep"] for e in data["episodes"]] == list(range(1, 13))
    assert data["episodes"][5] == {
        "ep": 6,
        "week": 5,
        "airDate": "2026-10-13",
        "start": "20:00",
        "end": "22:00",
        "theme": "Super Bowl",
    }
    assert {j["id"] for j in data["judges"]} == set(SEASON["defaultPanel"])
    tyler = next(c for c in data["contestants"] if c["id"] == "tyler-cameron")
    assert tyler["keyword"] == "Tyler"
    assert tyler["members"][1] == {
        "name": "Sharna Burgess",
        "role": "pro",
        "headshot": SEASON["contestants"][5]["members"][1]["headshot"],
    }
    assert len(data["contestants"]) == 16


def test_never_leaks_eliminations_or_results(aws):
    seed(aws)
    raw = call({"season": "dwts-35"})[1]["data"]
    text = json.dumps(raw)
    assert "eliminatedEp" not in text and "results" not in text
    assert "dancesPerCouple" not in text and "panel" not in text


def test_keyword_override_wins(aws):
    seed(aws).update_item(
        Key={"pk": "SEASON#dwts#35", "sk": "CONTESTANT#connor-wood"},
        UpdateExpression="SET keywordOverride = :k",
        ExpressionAttributeValues={":k": "CONNOR W"},
    )
    data = call({"season": "dwts-35"})[1]["data"]
    assert next(c for c in data["contestants"] if c["id"] == "connor-wood")["keyword"] == "CONNOR W"


def test_unknown_season_is_404(aws):
    assert call({"season": "dwts-99"})[0] == 404


def test_bad_season_is_400(aws):
    assert call({"season": "dwts35"})[0] == 400
    assert call(None)[0] == 400
