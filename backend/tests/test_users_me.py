import json

from lambdas.users_me.handler import handler
from tests.conftest import USERS_TABLE
from tests.events import PICTURE, SUB, authorized_event


def call(event) -> tuple[int, dict]:
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def stored(aws) -> dict:
    return aws.Table(USERS_TABLE).get_item(Key={"sub": SUB})["Item"]


def test_first_call_creates_the_profile(aws):
    status, body = call(authorized_event())
    assert status == 200
    assert body["error"] is None and body["meta"] is None
    data = body["data"]
    assert data == {
        "sub": SUB,
        "email": "viewer@example.com",
        "name": "Test Viewer",
        "picture": PICTURE,
        "avatarKind": "google",
        "createdAt": data["createdAt"],
        "lastSeenAt": data["createdAt"],
    }
    assert stored(aws)["email"] == "viewer@example.com"


def test_repeat_call_keeps_created_at_and_takes_the_new_name(aws):
    aws.Table(USERS_TABLE).put_item(
        Item={
            "sub": SUB,
            "email": "viewer@example.com",
            "name": "Old Name",
            "createdAt": "2026-09-01T00:00:00+00:00",
            "lastSeenAt": "2026-09-01T00:00:00+00:00",
        }
    )
    _, body = call(authorized_event(name="New Name"))
    assert body["data"]["name"] == "New Name"
    assert body["data"]["createdAt"] == "2026-09-01T00:00:00+00:00"
    assert body["data"]["lastSeenAt"] > "2026-09-01T00:00:00+00:00"


def test_missing_picture_falls_back_to_initials_and_drops_the_old_one(aws):
    call(authorized_event())
    status, body = call(authorized_event(picture=None))
    assert status == 200
    assert body["data"]["picture"] is None
    assert body["data"]["avatarKind"] == "initials"
    assert "picture" not in stored(aws)


def test_missing_name_is_stored_as_absent(aws):
    status, body = call(authorized_event(name="  "))
    assert status == 200
    assert body["data"]["name"] is None
    assert "name" not in stored(aws)


def test_missing_sub_is_401(aws):
    event = authorized_event()
    del event["requestContext"]["authorizer"]["claims"]["sub"]
    status, body = call(event)
    assert status == 401
    assert body["data"] is None
    assert "Item" not in aws.Table(USERS_TABLE).get_item(Key={"sub": SUB})


def test_access_token_without_email_is_401(aws):
    event = authorized_event()
    del event["requestContext"]["authorizer"]["claims"]["email"]
    status, _ = call(event)
    assert status == 401


def test_cors_echoes_local_dev_origin(aws):
    res = handler(authorized_event(origin="http://localhost:3000"), None)
    assert res["headers"]["Access-Control-Allow-Origin"] == "http://localhost:3000"
