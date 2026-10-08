"""Admin support actions: gated, reasoned, audited, and each one's effect."""

import io
import json

import boto3
import pytest
from botocore.stub import Stubber

from lambdas.admin_answer.handler import handler as answer_handler
from lambdas.admin_answers.handler import handler as answers_handler
from lambdas.admin_delete import handler as delete_module
from lambdas.admin_delete.handler import handler as delete_handler
from lambdas.admin_friendship.handler import handler as friendship_handler
from lambdas.admin_membership.handler import handler as membership_handler
from lambdas.admin_profile.handler import handler as profile_handler
from lambdas.admin_view import handler as view_module
from lambdas.admin_view.handler import handler as view_handler
from lambdas.common import events_dynamo
from lambdas.common.social_dynamo import peer, search, status
from scripts.seed_season import SEASONS, items, write
from tests.conftest import (
    AVATARS_BUCKET,
    BOARD_TABLE,
    CATALOG_TABLE,
    GROUPS_TABLE,
    SCORES_TABLE,
    USERS_TABLE,
    set_admins,
)
from tests.events import authorized_event
from tests.social import A, B, C, accept, ask, block, call
from tests.test_groups import create, mine
from tests.test_notifications import notes
from tests.test_traitors_picks import db  # noqa: F401 -- the Traitors season fixture

ADMIN = "boss@example.com"
POOL_ID = "us-east-1_EXAMPLE"
WRITES = {
    "/admin/profile": (profile_handler, {"sub": B, "name": "New Name", "reason": "r"}),
    "/admin/membership": (
        membership_handler,
        {"sub": B, "group": "abcdefghijkl", "action": "add", "reason": "r"},
    ),
    "/admin/friendship": (friendship_handler, {"a": A, "b": B, "action": "unblock", "reason": "r"}),
    "/admin/answer": (
        answer_handler,
        {"sub": B, "season": "dwts-35", "ep": "01", "key": "x#1", "value": 5, "reason": "r"},
    ),
    "/admin/delete": (delete_handler, {"sub": B, "reason": "r", "confirm": "2@example.com"}),
}


def post(path, payload, email=ADMIN) -> tuple[int, dict]:
    handler = WRITES[path][0]
    return call(handler, authorized_event(path=path, method="POST", email=email, body=payload))


def get(handler, path, query, email=ADMIN) -> tuple[int, dict]:
    return call(handler, authorized_event(path=path, email=email, query=query))


def last_audit() -> dict:
    return events_dynamo.audit_log(1)[0][0]


@pytest.fixture
def site(people, admins):
    set_admins(ADMIN)
    return people


@pytest.fixture
def dwts(site, aws):
    write(aws.Table(CATALOG_TABLE), items(json.loads((SEASONS / "dwts-35.json").read_text())))
    return aws


@pytest.mark.parametrize("path", WRITES)
def test_every_support_action_is_403_for_a_non_admin_and_changes_nothing(dwts, path):
    before = {t: dwts.Table(t).scan()["Items"] for t in (USERS_TABLE, GROUPS_TABLE, SCORES_TABLE)}
    status_code, _ = post(path, WRITES[path][1], email="viewer@example.com")
    assert status_code == 403
    assert {t: dwts.Table(t).scan()["Items"] for t in before} == before
    assert events_dynamo.audit_log()[0] == []


@pytest.mark.parametrize(
    ("handler", "path"),
    [(answers_handler, "/admin/answers"), (view_handler, "/admin/view")],
)
def test_support_reads_are_403_for_a_non_admin(site, handler, path):
    query = {"sub": B, "as": B, "season": "dwts-35", "ep": "01", "screen": "overview"}
    assert get(handler, path, query, email="viewer@example.com")[0] == 403


@pytest.mark.parametrize("path", WRITES)
def test_every_support_action_needs_a_reason(dwts, path):
    payload = {k: v for k, v in WRITES[path][1].items() if k != "reason"}
    status_code, body = post(path, payload)
    assert status_code == 400
    assert body["error"]["detail"]["field"] in ("reason", "group")


# Profile


def test_rename_updates_profile_search_and_audit(site):
    status_code, body = post(
        "/admin/profile", {"sub": B, "name": "  Bea Okay ", "reason": "rude name"}
    )
    assert status_code == 200
    assert body["data"]["name"] == "Bea Okay"
    assert [r["sub"] for r in search("bea ok")] == [B]
    entry = last_audit()
    assert (entry["admin"], entry["action"], entry["target"], entry["reason"]) == (
        ADMIN,
        "profile",
        B,
        "rude name",
    )
    assert entry["before"]["name"] == "Bea Arthur" and entry["after"]["name"] == "Bea Okay"


def test_null_name_goes_back_to_google(site):
    post("/admin/profile", {"sub": A, "name": "Temp", "reason": "r"})
    _, body = post("/admin/profile", {"sub": A, "name": None, "reason": "r"})
    assert body["data"]["name"] == "Ada Lovelace"
    assert body["data"]["customName"] is None


def test_reset_avatar_deletes_the_upload(site, aws):
    key = f"avatars/{A}/photo.webp"
    s3 = boto3.client("s3")
    s3.put_object(Bucket=AVATARS_BUCKET, Key=key, Body=b"x")
    aws.Table(USERS_TABLE).update_item(
        Key={"sub": A},
        UpdateExpression="SET uploadKey = :k, avatarChoice = :c",
        ExpressionAttributeValues={":k": key, ":c": "upload"},
    )
    _, body = post(
        "/admin/profile", {"sub": A, "resetAvatar": True, "reason": "inappropriate photo"}
    )
    assert body["data"]["avatarKind"] == "google"
    assert body["data"]["uploadPicture"] is None
    assert s3.list_objects_v2(Bucket=AVATARS_BUCKET).get("KeyCount") == 0


@pytest.mark.parametrize("payload", [{"name": "x"}, {"name": 5}, {}, {"resetAvatar": "yes"}])
def test_bad_profile_changes_are_400(site, payload):
    assert post("/admin/profile", {"sub": A, "reason": "r", **payload})[0] == 400


def test_profile_of_unknown_user_is_404(site):
    assert (
        post(
            "/admin/profile",
            {"sub": "3f1c2b9a-0000-4000-8000-000000000999", "name": "Name", "reason": "r"},
        )[0]
        == 404
    )


# Membership


@pytest.fixture
def group(site):
    return create("Watch party", A)[1]["data"]["id"]


def test_add_and_remove_a_member(group):
    status_code, body = post(
        "/admin/membership", {"sub": B, "group": group, "action": "add", "reason": "lost link"}
    )
    assert status_code == 200 and body["data"] == {"member": True, "linked": True, "invited": False}
    assert [g["id"] for g in mine(B)] == [group]
    entry = last_audit()
    assert entry["action"] == "membership_add" and entry["before"]["member"] is False

    assert (
        post(
            "/admin/membership", {"sub": B, "group": group, "action": "remove", "reason": "asked"}
        )[0]
        == 200
    )
    assert mine(B) == []


def test_owner_cannot_be_removed(group):
    assert (
        post("/admin/membership", {"sub": A, "group": group, "action": "remove", "reason": "r"})[0]
        == 400
    )


def test_repair_completes_a_half_written_join(group, aws):
    post("/admin/membership", {"sub": B, "group": group, "action": "add", "reason": "r"})
    aws.Table(GROUPS_TABLE).delete_item(Key={"pk": f"GROUP#{group}", "sk": f"MEMBER#{B}"})
    _, body = post(
        "/admin/membership", {"sub": B, "group": group, "action": "repair", "reason": "stuck"}
    )
    assert body["data"]["member"] is True


def test_repair_drops_a_link_to_a_deleted_group(group, aws):
    aws.Table(GROUPS_TABLE).put_item(
        Item={"pk": f"USER#{B}", "sk": "GROUP#zzzzzzzzzzzz", "joinedAt": "x"}
    )
    _, body = post(
        "/admin/membership", {"sub": B, "group": "zzzzzzzzzzzz", "action": "repair", "reason": "r"}
    )
    assert body["data"]["linked"] is False


def test_resend_sends_a_fresh_invite(group):
    status_code, body = post(
        "/admin/membership", {"sub": B, "group": group, "action": "resend", "reason": "r"}
    )
    assert status_code == 200 and body["data"]["invited"] is True
    post("/admin/membership", {"sub": B, "group": group, "action": "resend", "reason": "again"})
    assert [n["type"] for n in notes(B)[0]] == ["group_invite"]


def test_unknown_action_is_400(group):
    assert (
        post("/admin/membership", {"sub": B, "group": group, "action": "nuke", "reason": "r"})[0]
        == 400
    )


# Friendship


def test_unblock_clears_both_sides(site):
    block(A, B)
    status_code, body = post(
        "/admin/friendship", {"a": A, "b": B, "action": "unblock", "reason": "mistake"}
    )
    assert status_code == 200 and body["data"] == {"a": None, "b": None}
    assert ask(B, A)[0] == 200
    assert last_audit()["before"] == {"with": B, "a": "blocked", "b": "blocked"}


def test_unlink_ends_a_friendship(site):
    ask(A, C)
    accept(C, A)
    post("/admin/friendship", {"a": A, "b": C, "action": "unlink", "reason": "r"})
    assert status(peer(A, C)) is None


def test_same_user_twice_is_400(site):
    assert post("/admin/friendship", {"a": A, "b": A, "action": "unblock", "reason": "r"})[0] == 400


# Answers


def stored(aws, sk_part):
    rows = aws.Table(SCORES_TABLE).scan()["Items"]
    return [r for r in rows if sk_part in r["sk"]]


def test_answers_lists_the_users_own_answers_only(dwts):
    scores = dwts.Table(SCORES_TABLE)
    scores.put_item(
        Item={"pk": "EP#dwts#35#01", "sk": f"PERF#jackson-olson#1#USER#{B}", "value": 6}
    )
    scores.put_item(
        Item={"pk": "EP#dwts#35#01", "sk": f"PERF#jackson-olson#1#USER#{A}", "value": 9}
    )
    status_code, body = get(
        answers_handler, "/admin/answers", {"sub": B, "season": "dwts-35", "ep": "01"}
    )
    assert status_code == 200
    data = body["data"]
    assert data["state"] == "live" and len(data["slots"]) == 8
    by_key = {s["key"]: s for s in data["slots"]}
    assert by_key["jackson-olson#1"]["answer"] == {"value": 6}
    assert by_key["tyler-cameron#1"]["answer"] is None
    assert "Jackson Olson" in by_key["jackson-olson#1"]["label"]
    assert "9" not in json.dumps(data)


def test_set_overwrite_and_clear_a_dwts_score(dwts):
    base = {
        "sub": B,
        "season": "dwts-35",
        "ep": "01",
        "key": "tyler-cameron#1",
        "reason": "app froze",
    }
    status_code, body = post("/admin/answer", {**base, "forfeit": True})
    assert status_code == 200 and body["data"]["answer"]["forfeit"] is True
    _, body = post("/admin/answer", {**base, "value": 8})
    assert body["data"]["answer"]["value"] == 8
    (row,) = stored(dwts, f"tyler-cameron#1#USER#{B}")
    assert row["adminBy"] == ADMIN and "forfeit" not in row
    entry = last_audit()
    assert entry["before"]["answer"]["forfeit"] is True and entry["after"]["answer"]["value"] == 8
    post("/admin/answer", {**base, "clear": True})
    assert stored(dwts, f"tyler-cameron#1#USER#{B}") == []


def test_fixed_score_reaches_the_board_once_judges_confirmed(dwts, aws):
    from tests.conftest import PERFORMANCES_TABLE

    aws.Table(PERFORMANCES_TABLE).put_item(
        Item={
            "pk": "EP#dwts#35#01",
            "sk": "PERF#tyler-cameron#1",
            "judges": {
                j: {"value": 6, "state": "confirmed"}
                for j in ("carrie-ann-inaba", "derek-hough", "bruno-tonioli")
            },
        }
    )
    post(
        "/admin/answer",
        {
            "sub": B,
            "season": "dwts-35",
            "ep": "01",
            "key": "tyler-cameron#1",
            "value": 8,
            "reason": "r",
        },
    )
    board = {r["pk"]: r for r in aws.Table(BOARD_TABLE).scan()["Items"] if r["sk"] == f"USER#{B}"}
    assert int(board["BOARD#dwts#35"]["n"]) == 1
    assert float(board["BOARD#dwts#35"]["err"]) == 2
    post(
        "/admin/answer",
        {
            "sub": B,
            "season": "dwts-35",
            "ep": "01",
            "key": "tyler-cameron#1",
            "clear": True,
            "reason": "r",
        },
    )
    board = {r["pk"]: r for r in aws.Table(BOARD_TABLE).scan()["Items"] if r["sk"] == f"USER#{B}"}
    assert int(board["BOARD#dwts#35"]["n"]) == 0


def test_closed_episode_needs_override_and_confirmation(dwts):
    dwts.Table(CATALOG_TABLE).update_item(
        Key={"pk": "SEASON#dwts#35", "sk": "META"},
        UpdateExpression="SET #c = :f",
        ExpressionAttributeNames={"#c": "current"},
        ExpressionAttributeValues={":f": False},
    )
    base = {
        "sub": B,
        "season": "dwts-35",
        "ep": "01",
        "key": "tyler-cameron#1",
        "value": 4,
        "reason": "r",
    }
    status_code, body = post("/admin/answer", base)
    assert status_code == 409 and body["error"]["detail"]["code"] == "needs_override"
    assert post("/admin/answer", {**base, "override": True, "confirm": "yes"})[0] == 409
    assert stored(dwts, "USER#") == []
    status_code, body = post("/admin/answer", {**base, "override": True, "confirm": "OVERRIDE"})
    assert status_code == 200 and body["data"]["state"] == "closed"


@pytest.mark.scoring_window
def test_unaired_episode_cannot_be_answered(dwts):
    eps = [
        i
        for i in items(json.loads((SEASONS / "dwts-35.json").read_text()))
        if i["sk"].startswith("EP#")
    ]
    last = eps[-1]["sk"].removeprefix("EP#")
    status_code, body = get(
        answers_handler, "/admin/answers", {"sub": B, "season": "dwts-35", "ep": last}
    )
    if body["data"]["state"] != "upcoming":
        pytest.skip("the fixture's last episode has aired")
    key = body["data"]["slots"][0]["key"]
    payload = {
        "sub": B,
        "season": "dwts-35",
        "ep": last,
        "key": key,
        "value": 5,
        "reason": "r",
        "override": True,
        "confirm": "OVERRIDE",
    }
    status_code, body = post("/admin/answer", payload)
    assert status_code == 409 and body["error"]["detail"]["code"] == "episode_not_open"


@pytest.mark.parametrize(
    "extra",
    [
        {"key": "nobody#1", "value": 5},
        {"key": "tyler-cameron#1", "value": 11},
        {"key": "tyler-cameron#1"},
    ],
)
def test_bad_dwts_answers_are_400(dwts, extra):
    assert (
        post("/admin/answer", {"sub": B, "season": "dwts-35", "ep": "01", "reason": "r", **extra})[
            0
        ]
        == 400
    )


def test_traitors_pick_fix_validates_roster_and_scores(site, db):  # noqa: F811
    base = {"sub": B, "season": "tus-5", "ep": "02", "reason": "stuck"}
    _, body = get(answers_handler, "/admin/answers", {"sub": B, "season": "tus-5", "ep": "02"})
    assert body["data"]["state"] == "live"
    assert [s["key"] for s in body["data"]["slots"]] == ["MURDER", "RT", "RECRUIT"]
    assert post("/admin/answer", {**base, "key": "RT", "picks": ["ann", "bob", "cat"]})[0] == 400
    status_code, body = post("/admin/answer", {**base, "key": "RT", "picks": ["bob", "cat", "dan"]})
    assert status_code == 200 and body["data"]["answer"]["picks"] == ["bob", "cat", "dan"]
    pts = [r for r in db.Table(BOARD_TABLE).scan()["Items"] if r["sk"] == f"RT#USER#{B}"]
    assert len(pts) == 1


def test_traitors_closed_episode_needs_override(site, db):  # noqa: F811
    status_code, body = post(
        "/admin/answer",
        {"sub": B, "season": "tus-5", "ep": "01", "key": "MURDER", "picks": ["bob"], "reason": "r"},
    )
    assert status_code == 409 and body["error"]["detail"]["code"] == "needs_override"


# Delete


class FakeLambda:
    def __init__(self, answer: dict):
        self.answer = answer
        self.calls: list[dict] = []

    def invoke(self, FunctionName, Payload):  # noqa: N803 -- boto3's argument names
        self.calls.append({"name": FunctionName, "event": json.loads(Payload)})
        return {"StatusCode": 200, "Payload": io.BytesIO(json.dumps(self.answer).encode())}


@pytest.fixture
def cognito(site, monkeypatch):
    client = boto3.client("cognito-idp")
    stub = Stubber(client)
    stub.activate()
    monkeypatch.setenv("COGNITO_USER_POOL_ID", POOL_ID)
    monkeypatch.setattr(delete_module, "cognito", lambda: client)
    yield stub
    stub.assert_no_pending_responses()


def test_delete_invokes_users_delete_as_the_user(cognito, monkeypatch):
    cognito.add_response(
        "list_users",
        {"Users": [{"Username": "google_42"}]},
        {"UserPoolId": POOL_ID, "Filter": f'sub = "{B}"', "Limit": 1},
    )
    fake = FakeLambda({"statusCode": 200, "body": json.dumps({"data": {"ok": True}})})
    monkeypatch.setattr(delete_module, "lambdas", lambda: fake)
    status_code, body = post(
        "/admin/delete", {"sub": B, "reason": "asked by email", "confirm": " 2@EXAMPLE.com "}
    )
    assert status_code == 200
    (sent,) = fake.calls
    assert sent["name"] == "armchair-users-delete"
    claims = sent["event"]["requestContext"]["authorizer"]["claims"]
    assert (claims["sub"], claims["cognito:username"]) == (B, "google_42")
    entry = last_audit()
    assert (entry["action"], entry["target"]) == ("delete", B) and "before" not in entry


def test_delete_needs_the_email_typed_back(cognito):
    assert (
        post("/admin/delete", {"sub": B, "reason": "r", "confirm": "wrong@example.com"})[0] == 400
    )


def test_delete_reports_a_failed_users_delete(cognito, monkeypatch):
    cognito.add_response("list_users", {"Users": [{"Username": "google_42"}]})
    fake = FakeLambda({"statusCode": 500, "body": "{}"})
    monkeypatch.setattr(delete_module, "lambdas", lambda: fake)
    assert post("/admin/delete", {"sub": B, "reason": "r", "confirm": "2@example.com"})[0] == 500
    assert events_dynamo.audit_log()[0] == []


# View as


def test_view_invokes_the_screen_as_the_user(site, monkeypatch):
    fake = FakeLambda(
        {"statusCode": 200, "body": json.dumps({"data": {"season": "x"}, "error": None})}
    )
    monkeypatch.setattr(view_module, "lambdas", lambda: fake)
    query = {"as": B, "screen": "episode", "season": "dwts-35", "ep": "02"}
    status_code, body = get(view_handler, "/admin/view", query)
    assert status_code == 200
    assert body["data"] == {
        "screen": "episode",
        "status": 200,
        "data": {"season": "x"},
        "error": None,
    }
    (sent,) = fake.calls
    assert sent["name"] == "armchair-episodes-state"
    assert sent["event"]["httpMethod"] == "GET"
    assert sent["event"]["queryStringParameters"] == {"season": "dwts-35", "ep": "02"}
    assert sent["event"]["requestContext"]["authorizer"]["claims"]["sub"] == B


@pytest.mark.parametrize("screen", ["me", "users_me", "friends_list", "scores_submit", None])
def test_view_only_offers_read_only_screens(site, screen):
    query = {"as": B, **({"screen": screen} if screen else {})}
    assert get(view_handler, "/admin/view", query)[0] == 400


def test_every_view_screen_is_a_get_function():
    from pathlib import Path

    for fn in view_module.SCREENS.values():
        doc = (Path(__file__).parents[1] / "lambdas" / fn / "handler.py").read_text()
        assert doc.lstrip('"\n').startswith("GET "), fn


def test_terraform_grants_exactly_the_view_screens():
    import re
    from pathlib import Path

    tf = (Path(__file__).parents[2] / "infrastructure" / "terraform" / "lambda.tf").read_text()
    granted = re.search(r"admin_view_screens = \[(.*?)\]", tf)[1]
    assert sorted(re.findall(r'"(\w+)"', granted)) == sorted(view_module.SCREENS.values())
