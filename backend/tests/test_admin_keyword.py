import json

import pytest

from lambdas.admin_keyword.handler import handler
from lambdas.common.admins import is_admin
from tests.conftest import CATALOG_TABLE, set_admins
from tests.events import authorized_event

ADMIN = "boss@example.com"


def call(body, email=ADMIN) -> tuple[int, dict]:
    res = handler(
        authorized_event(path="/admin/keyword", method="POST", body=body, email=email), None
    )
    return res["statusCode"], json.loads(res["body"])


def stored(aws, cid: str) -> dict:
    return aws.Table(CATALOG_TABLE).get_item(
        Key={"pk": "SEASON#dwts#35", "sk": f"CONTESTANT#{cid}"}
    )["Item"]


def test_admin_sets_the_override(catalog, aws):
    set_admins(f"other@example.com, {ADMIN.upper()}")
    status, body = call({"cid": "connor-wood", "keyword": " CONNOR W "})
    assert status == 200
    assert body["data"] == {"cid": "connor-wood", "keyword": "CONNOR W"}
    item = stored(aws, "connor-wood")
    assert item["keywordOverride"] == "CONNOR W"
    assert item["keyword"] == "Connor"


def test_non_admin_is_403_and_nothing_changes(catalog, aws):
    set_admins("other@example.com")
    status, _ = call({"cid": "connor-wood", "keyword": "X"})
    assert status == 403
    assert "keywordOverride" not in stored(aws, "connor-wood")


def test_placeholder_list_admits_nobody(catalog):
    assert is_admin(ADMIN) is False


def test_unknown_contestant_is_404_and_creates_nothing(catalog, aws):
    set_admins(ADMIN)
    status, _ = call({"cid": "nobody", "keyword": "X"})
    assert status == 404
    assert "Item" not in aws.Table(CATALOG_TABLE).get_item(
        Key={"pk": "SEASON#dwts#35", "sk": "CONTESTANT#nobody"}
    )


@pytest.mark.parametrize(
    "body", [{"cid": "connor-wood"}, {"cid": "connor-wood", "keyword": "  "}, {"keyword": "X"}]
)
def test_missing_fields_are_400(catalog, body):
    set_admins(ADMIN)
    status, _ = call(body)
    assert status == 400
