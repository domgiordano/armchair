import json

import pytest

from lambdas.admin_keyword.handler import handler
from lambdas.common.admins import is_admin
from lambdas.seasons_get.handler import handler as seasons_get
from scripts.seed_season import SEASONS, items, write
from tests.conftest import CATALOG_TABLE, set_admins
from tests.events import authorized_event

ADMIN = "boss@example.com"
PK = "SEASON#dwts#35"


@pytest.fixture
def catalog(aws, admins):
    tbl = aws.Table(CATALOG_TABLE)
    write(tbl, items(json.loads((SEASONS / "dwts-35.json").read_text())))
    return tbl


def call(body, email=ADMIN) -> tuple[int, dict]:
    event = authorized_event(path="/admin/keyword", method="POST", body=body, email=email)
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def stored(catalog, cid: str) -> dict:
    return catalog.get_item(Key={"pk": PK, "sk": f"CONTESTANT#{cid}"})["Item"]


def test_admin_override_reaches_the_season_roster(catalog):
    set_admins(f"other@example.com, {ADMIN.upper()}")
    status, body = call({"season": "dwts-35", "cid": "connor-wood", "keyword": " CONNOR W "})
    assert status == 200
    assert body["data"] == {"cid": "connor-wood", "keyword": "CONNOR W"}
    assert stored(catalog, "connor-wood")["keyword"] == "Connor"

    res = seasons_get(authorized_event(path="/seasons/get", query={"season": "dwts-35"}), None)
    keywords = {c["id"]: c["keyword"] for c in json.loads(res["body"])["data"]["contestants"]}
    assert keywords["connor-wood"] == "CONNOR W"
    assert keywords["conner-leavitt"] == "Conner"


def test_non_admin_is_403_and_nothing_changes(catalog):
    set_admins("other@example.com")
    status, _ = call({"season": "dwts-35", "cid": "connor-wood", "keyword": "X"})
    assert status == 403
    assert "keywordOverride" not in stored(catalog, "connor-wood")


def test_placeholder_list_admits_nobody(catalog):
    assert is_admin(ADMIN) is False


def test_unknown_contestant_is_404_and_creates_nothing(catalog):
    set_admins(ADMIN)
    status, _ = call({"season": "dwts-35", "cid": "nobody", "keyword": "X"})
    assert status == 404
    assert "Item" not in catalog.get_item(Key={"pk": PK, "sk": "CONTESTANT#nobody"})


@pytest.mark.parametrize(
    "body",
    [
        {"season": "dwts-35", "cid": "connor-wood"},
        {"season": "dwts-35", "cid": "connor-wood", "keyword": "  "},
        {"season": "dwts-35", "keyword": "X"},
        {"cid": "connor-wood", "keyword": "X"},
    ],
)
def test_missing_fields_are_400(catalog, body):
    set_admins(ADMIN)
    status, _ = call(body)
    assert status == 400
