import json

import pytest

from lambdas.groups_create.handler import handler as create_handler
from lambdas.groups_join.handler import handler as join_handler
from lambdas.groups_mine.handler import handler as mine_handler
from tests.conftest import GROUPS_TABLE, USERS_TABLE
from tests.events import PICTURE, SUB, authorized_event

B = "3f1c2b9a-0000-4000-8000-000000000002"


def call(handler, event) -> tuple[int, dict]:
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def create(name="Family", sub=SUB) -> tuple[int, dict]:
    event = authorized_event(path="/groups/create", method="POST", sub=sub, body={"name": name})
    return call(create_handler, event)


def join(code, sub=B) -> tuple[int, dict]:
    event = authorized_event(path="/groups/join", method="POST", sub=sub, body={"code": code})
    return call(join_handler, event)


def mine(sub=SUB) -> list[dict]:
    status, body = call(mine_handler, authorized_event(path="/groups/mine", sub=sub))
    assert status == 200, body
    return body["data"]


def rows(aws, pk) -> list[dict]:
    return aws.Table(GROUPS_TABLE).query(
        KeyConditionExpression="pk = :pk", ExpressionAttributeValues={":pk": pk}
    )["Items"]


def test_create_returns_an_id_and_an_unguessable_code(aws):
    status, body = create(name="  Family  ")
    assert status == 200, body
    group = body["data"]
    assert group["name"] == "Family"
    assert len(group["inviteCode"]) == 16
    assert create()[1]["data"]["inviteCode"] != group["inviteCode"]
    assert {r["sk"] for r in rows(aws, f"GROUP#{group['id']}")} == {"META", f"MEMBER#{SUB}"}
    assert rows(aws, f"INVITE#{group['inviteCode']}")[0]["gid"] == group["id"]


@pytest.mark.parametrize("name", [None, "", "   ", 7, "x" * 41])
def test_create_rejects_a_bad_name(aws, name):
    assert create(name=name)[0] == 400
    assert aws.Table(GROUPS_TABLE).scan()["Items"] == []


def test_join_is_idempotent(aws):
    group = create()[1]["data"]
    status, body = join(group["inviteCode"])
    assert status == 200
    assert body["data"] == {"id": group["id"], "name": "Family", "pending": False}
    member = {"pk": f"GROUP#{group['id']}", "sk": f"MEMBER#{B}"}
    first = aws.Table(GROUPS_TABLE).get_item(Key=member)["Item"]["joinedAt"]

    aws.Table(GROUPS_TABLE).update_item(
        Key=member,
        UpdateExpression="SET joinedAt = :t",
        ExpressionAttributeValues={":t": "2026-09-01T00:00:00+00:00"},
    )
    assert join(group["inviteCode"])[0] == 200
    assert aws.Table(GROUPS_TABLE).get_item(Key=member)["Item"]["joinedAt"] < first
    assert len(rows(aws, f"GROUP#{group['id']}")) == 3
    assert len(rows(aws, f"USER#{B}")) == 1


def test_unknown_code_is_404_and_writes_nothing(aws):
    assert join("A" * 16)[0] == 404
    assert aws.Table(GROUPS_TABLE).scan()["Items"] == []


@pytest.mark.parametrize("code", [None, "short", "A" * 17, "../../../etc/pwd"])
def test_malformed_code_is_400(aws, code):
    assert join(code)[0] == 400


def test_mine_lists_members_with_avatars_and_no_email(aws):
    aws.Table(USERS_TABLE).put_item(
        Item={
            "sub": SUB,
            "email": "viewer@example.com",
            "name": "Test Viewer",
            "picture": PICTURE,
            "avatarKind": "google",
        }
    )
    family = create()[1]["data"]
    create(name="Work", sub=B)
    join(family["inviteCode"])

    groups = mine()
    assert [g["name"] for g in groups] == ["Family"]
    assert groups[0]["inviteCode"] == family["inviteCode"]
    members = {m["sub"]: m for m in groups[0]["members"]}
    assert members[SUB] == {
        "sub": SUB,
        "name": "Test Viewer",
        "picture": PICTURE,
        "avatarKind": "google",
    }
    # B never called /users/me, so there is no profile to show yet.
    assert members[B] == {"sub": B, "name": None, "picture": None, "avatarKind": None}
    assert "viewer@example.com" not in json.dumps(groups)
    assert sorted(g["name"] for g in mine(sub=B)) == ["Family", "Work"]


def test_mine_is_empty_before_any_group(aws):
    assert mine() == []


def test_missing_sub_is_401(aws):
    event = authorized_event(path="/groups/create", method="POST", body={"name": "Family"})
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    assert call(create_handler, event)[0] == 401
