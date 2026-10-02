import json

from lambdas.seasons_list.handler import handler
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE
from tests.events import authorized_event


def call(query=None, **kw) -> tuple[int, dict]:
    res = handler(authorized_event(path="/seasons/list", query=query, **kw), None)
    return res["statusCode"], json.loads(res["body"])


def seed(aws, *stems):
    for stem in stems:
        write(aws.Table(CATALOG_TABLE), items(json.loads((SEASONS / f"{stem}.json").read_text())))


def test_lists_seasons_newest_first_with_the_current_one_flagged(aws):
    seed(aws, "dwts-1", "dwts-35", "dwts-15")
    status, body = call()
    assert status == 200, body
    assert body["data"] == {
        "show": "dwts",
        "seasons": [
            {"id": "dwts-35", "number": 35, "year": 2026, "current": True},
            {"id": "dwts-15", "number": 15, "year": 2012, "current": False},
            {"id": "dwts-1", "number": 1, "year": 2005, "current": False},
        ],
    }


def test_keeps_the_page_title_a_traitors_index_row_carries(aws):
    aws.Table(CATALOG_TABLE).put_item(
        Item={
            "pk": "SEASONS#tus",
            "sk": "SEASON#005",
            "id": "tus-5",
            "number": 5,
            "title": "The Traitors: New Blood",
            "year": 2026,
            "current": True,
        }
    )
    assert call({"show": "tus"})[1]["data"]["seasons"] == [
        {"id": "tus-5", "number": 5, "year": 2026, "current": True, "title": "The Traitors: New Blood"}
    ]


def test_a_show_with_no_seasons_is_an_empty_list(aws):
    assert call({"show": "traitors"})[1]["data"] == {"show": "traitors", "seasons": []}


def test_bad_show_is_400(aws):
    assert call({"show": "DWTS-35"})[0] == 400


def test_missing_sub_is_401(aws):
    assert call(sub=None)[0] == 401
