"""/users/update and /users/avatar-upload against moto: the caller's name and
photo choices, and the upload policy S3 enforces."""

import base64
import json

import boto3
import pytest

from lambdas.users_avatar_upload.handler import handler as upload_handler
from lambdas.users_me.handler import handler as me_handler
from lambdas.users_update.handler import handler as update_handler
from tests.conftest import AVATARS_BUCKET, AVATARS_URL, USERS_TABLE
from tests.events import PICTURE, SUB, authorized_event

OTHER = "3f1c2b9a-0000-4000-8000-000000000002"


def call(handler, event) -> tuple[int, dict]:
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"])


def patch(sub=SUB, **fields) -> tuple[int, dict]:
    event = authorized_event(path="/users/update", method="PATCH", sub=sub, body=fields)
    return call(update_handler, event)


def presign(content_type="image/jpeg", sub=SUB) -> tuple[int, dict]:
    event = authorized_event(
        path="/users/avatar-upload", method="POST", sub=sub, body={"contentType": content_type}
    )
    return call(upload_handler, event)


def key_for(sub=SUB, ext="jpg", char="a") -> str:
    return f"avatars/{sub}/{char * 32}.{ext}"


def put_photo(key: str) -> None:
    boto3.client("s3").put_object(Bucket=AVATARS_BUCKET, Key=key, Body=b"jpeg")


def keys() -> list[str]:
    listed = boto3.client("s3").list_objects_v2(Bucket=AVATARS_BUCKET)
    return [o["Key"] for o in listed.get("Contents", [])]


@pytest.fixture
def me(aws):
    status, _ = call(me_handler, authorized_event())
    assert status == 200
    return aws


def test_name_is_trimmed_and_wins_over_google(me):
    status, body = patch(name="  Dance Mom  ")
    assert status == 200, body
    assert body["data"]["name"] == "Dance Mom"
    assert body["data"]["customName"] == "Dance Mom"
    assert body["data"]["googleName"] == "Test Viewer"
    assert me.Table(USERS_TABLE).get_item(Key={"sub": SUB})["Item"]["name"] == "Dance Mom"


@pytest.mark.parametrize("name", ["x", " x ", "y" * 41, "", 7, None])
def test_bad_names_are_400(me, name):
    fields = {"name": name} if name is not None else {"avatar": "sparkles"}
    status, body = patch(**fields)
    assert status == 400
    assert body["data"] is None


def test_an_empty_body_is_400(me):
    status, _ = patch()
    assert status == 400


def test_initials_then_back_to_google(me):
    _, body = patch(avatar="initials")
    assert (body["data"]["picture"], body["data"]["avatarKind"]) == (None, "initials")
    _, body = patch(avatar="google")
    assert (body["data"]["picture"], body["data"]["avatarKind"]) == (PICTURE, "google")


def test_upload_key_switches_to_the_upload(me):
    key = key_for()
    put_photo(key)
    status, body = patch(uploadKey=key)
    assert status == 200, body
    data = body["data"]
    assert data["picture"] == data["uploadPicture"] == f"{AVATARS_URL}/{key}"
    assert data["avatarKind"] == "upload"


def test_back_to_google_keeps_the_upload_to_switch_back_to(me):
    key = key_for()
    put_photo(key)
    patch(uploadKey=key)
    _, body = patch(avatar="google")
    assert body["data"]["picture"] == PICTURE
    assert body["data"]["uploadPicture"] == f"{AVATARS_URL}/{key}"
    _, body = patch(avatar="upload")
    assert body["data"]["picture"] == f"{AVATARS_URL}/{key}"
    assert keys() == [key]


def test_a_new_upload_deletes_the_one_it_replaces(me):
    first, second = key_for(char="a"), key_for(char="b", ext="webp")
    put_photo(first)
    put_photo(second)
    patch(uploadKey=first)
    patch(uploadKey=second)
    assert keys() == [second]


def test_choosing_upload_with_nothing_uploaded_is_400(me):
    status, body = patch(avatar="upload")
    assert status == 400
    assert body["error"]["detail"] == {"field": "avatar"}


@pytest.mark.parametrize(
    "key",
    [
        key_for(sub=OTHER),
        key_for(ext="svg"),
        f"avatars/{SUB}/../{OTHER}/{'a' * 32}.jpg",
        f"avatars/{SUB}/short.jpg",
        ["not", "a", "string"],
    ],
)
def test_someone_elses_or_a_malformed_key_is_400(me, key):
    status, body = patch(uploadKey=key)
    assert status == 400
    assert body["error"]["detail"] == {"field": "uploadKey"}


def test_upload_key_with_another_avatar_choice_is_400(me):
    status, _ = patch(uploadKey=key_for(), avatar="google")
    assert status == 400


def test_update_before_any_profile_is_404(aws):
    status, _ = patch(name="Dance Mom")
    assert status == 404


def test_presign_names_the_callers_prefix_and_extension(aws):
    status, body = presign("image/webp")
    assert status == 200, body
    data = body["data"]
    assert data["key"].startswith(f"avatars/{SUB}/") and data["key"].endswith(".webp")
    assert data["fields"]["key"] == data["key"]
    assert data["fields"]["Content-Type"] == "image/webp"
    assert data["maxBytes"] == 2 * 1024 * 1024
    policy = json.loads(base64.b64decode(data["fields"]["policy"]))
    assert {"Content-Type": "image/webp"} in policy["conditions"]
    assert ["content-length-range", 1, 2 * 1024 * 1024] in policy["conditions"]


@pytest.mark.parametrize("content_type", ["image/svg+xml", "text/html", "", None, ["image/png"]])
def test_presign_refuses_other_types(aws, content_type):
    status, body = presign(content_type)
    assert status == 400
    assert body["error"]["detail"] == {"field": "contentType"}


def test_presigned_keys_are_unique(aws):
    assert presign()[1]["data"]["key"] != presign()[1]["data"]["key"]


def test_a_presigned_key_is_accepted_by_update(me):
    key = presign("image/png")[1]["data"]["key"]
    status, body = patch(uploadKey=key)
    assert status == 200, body
    assert body["data"]["avatarKind"] == "upload"
